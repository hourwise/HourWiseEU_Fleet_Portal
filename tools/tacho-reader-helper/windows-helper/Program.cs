using System.Security.Cryptography;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
var listenUrl = BuildListenUrl();
builder.WebHost.UseUrls(listenUrl);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

var app = builder.Build();
var state = new HelperState();
app.Lifetime.ApplicationStopping.Register(() => HelperDiagnostics.Record("helper_shutdown", new { HelperConstants.Version }));
HelperDiagnostics.Record("helper_startup", new
{
    HelperConstants.Version,
    listenUrl,
    HelperConstants.PlaceholderReaderEnabled,
    HelperConstants.SimulateCardPresent,
    HelperConstants.VuWorkflowEnabled,
    exportCommandConfigured = !string.IsNullOrWhiteSpace(HelperConstants.ExportCommand),
    HelperConstants.ExportOutputDirectory,
    HelperConstants.LogDirectory
});
if (!HelperConstants.PlaceholderReaderEnabled)
{
    _ = Task.Run(() => MonitorSmartCardReadersAsync(state, app.Lifetime.ApplicationStopping));
}

app.Use(async (context, next) =>
{
    context.Response.Headers.AccessControlAllowOrigin = "*";
    context.Response.Headers.AccessControlAllowMethods = "GET,POST,OPTIONS";
    context.Response.Headers.AccessControlAllowHeaders = "Content-Type";

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    await next();
});

app.MapGet("/status", () =>
{
    state.Touch();
    return Results.Json(state.ToResponse());
});

app.MapGet("/diagnostics", () =>
{
    state.Touch();
    return Results.Json(new
    {
        helperVersion = HelperConstants.Version,
        utcNow = DateTimeOffset.UtcNow.ToString("O"),
        processId = Environment.ProcessId,
        listenUrl,
        config = HelperConstants.ToDiagnosticsConfig(),
        capabilities = HelperConstants.ToCapabilities(),
        state = state.ToResponse(),
        recentEvents = HelperDiagnostics.Recent()
    });
});

app.MapGet("/diagnostics/logs", () => Results.Json(new
{
    helperVersion = HelperConstants.Version,
    utcNow = DateTimeOffset.UtcNow.ToString("O"),
    logDirectory = HelperConstants.LogDirectory,
    recentEvents = HelperDiagnostics.Recent()
}));

app.MapPost("/commands/start-read", async (StartReadRequest? request) =>
{
    if (request is null || string.IsNullOrWhiteSpace(request.CompanyId))
    {
        HelperDiagnostics.Record("start_read_rejected", new { reason = "missing_company_id" });
        return Results.BadRequest(new CommandResponse(false, "Company id is required to start a reader workflow."));
    }

    var sourceType = HelperConstants.NormalizeSourceType(request.SourceType);
    if (!HelperConstants.IsSourceTypeEnabled(sourceType))
    {
        HelperDiagnostics.Record("start_read_rejected", new { reason = "unsupported_source_type", request.SourceType });
        return Results.BadRequest(new CommandResponse(false, $"The helper workflow does not support sourceType {sourceType}."));
    }

    if (!state.CanStartRead)
    {
        HelperDiagnostics.Record("start_read_rejected", new { reason = "stage_not_ready", state.Stage });
        return Results.Json(
            new CommandResponse(false, $"Cannot start read while stage is {state.Stage}."),
            statusCode: StatusCodes.Status409Conflict);
    }

    var companyId = request.CompanyId.Trim();
    var requestedByUserId = string.IsNullOrWhiteSpace(request.RequestedByUserId) ? null : request.RequestedByUserId.Trim();

    if (HelperConstants.PlaceholderReaderEnabled)
    {
        state.BeginPlaceholderRead(companyId, requestedByUserId, sourceType);
    }
    else
    {
        var readSessionId = state.BeginExternalExportRead(companyId, requestedByUserId, sourceType);
        _ = Task.Run(() => RunExternalExportAsync(state, readSessionId, sourceType, app.Lifetime.ApplicationStopping));
    }

    return Results.Json(new
    {
        accepted = true,
        stage = state.Stage,
        readSessionId = state.ReadSessionId,
        companyId = state.CompanyId
    }, statusCode: StatusCodes.Status202Accepted);
});

app.MapPost("/commands/cancel", () =>
{
    if (!state.CanCancel)
    {
        HelperDiagnostics.Record("cancel_rejected", new { reason = "stage_not_cancellable", state.Stage });
        return Results.Json(
            new CommandResponse(false, $"Cannot cancel while stage is {state.Stage}."),
            statusCode: StatusCodes.Status409Conflict);
    }

    state.Reset("The active helper workflow was cancelled.");
    return Results.Json(new { accepted = true, stage = state.Stage }, statusCode: StatusCodes.Status202Accepted);
});

app.MapPost("/imports/register", (RegisterImportRequest? request) =>
{
    if (request is null)
    {
        HelperDiagnostics.Record("import_register_rejected", new { reason = "missing_payload" });
        return Results.BadRequest(new CommandResponse(false, "Registration payload is required."));
    }

    if (string.IsNullOrWhiteSpace(state.ReadSessionId) || request.ReadSessionId != state.ReadSessionId)
    {
        HelperDiagnostics.Record("import_register_rejected", new
        {
            reason = "read_session_mismatch",
            expectedReadSessionId = state.ReadSessionId,
            receivedReadSessionId = request.ReadSessionId
        });
        return Results.Json(
            new CommandResponse(false, $"Read session mismatch. Expected {state.ReadSessionId ?? "none"}."),
            statusCode: StatusCodes.Status409Conflict);
    }

    if (string.IsNullOrWhiteSpace(request.ImportId))
    {
        HelperDiagnostics.Record("import_register_rejected", new { reason = "missing_import_id", request.ReadSessionId });
        return Results.BadRequest(new CommandResponse(false, "Import id is required."));
    }

    if (string.IsNullOrWhiteSpace(request.UploadedStoragePath))
    {
        HelperDiagnostics.Record("import_register_rejected", new { reason = "missing_storage_path", request.ReadSessionId, request.ImportId });
        return Results.BadRequest(new CommandResponse(false, "Uploaded storage path is required."));
    }

    state.MarkRegistered(
        request.ImportId.Trim(),
        request.UploadedStoragePath.Trim(),
        string.IsNullOrWhiteSpace(request.SourceType) ? null : request.SourceType.Trim());
    return Results.Json(new
    {
        accepted = true,
        stage = state.Stage,
        importId = state.ImportId,
        backendJobId = state.BackendJobId
    }, statusCode: StatusCodes.Status202Accepted);
});

app.MapGet("/exports/{readSessionId}/file", (string readSessionId) =>
{
    if (readSessionId != state.ReadSessionId || state.ExportBytes is null || string.IsNullOrWhiteSpace(state.ExportFileName))
    {
        HelperDiagnostics.Record("export_download_rejected", new { reason = "export_not_found", readSessionId });
        return Results.NotFound(new { error = "Export not found", readSessionId });
    }

    HelperDiagnostics.Record("export_downloaded", new { readSessionId, state.ExportFileName, state.ExportFileSizeBytes });
    return Results.File(state.ExportBytes, "application/octet-stream", state.ExportFileName);
});

app.MapFallback(() => Results.NotFound(new { error = "Route not found" }));

app.Run();

static async Task RunExternalExportAsync(HelperState state, string readSessionId, string sourceType, CancellationToken cancellationToken)
{
    try
    {
        var result = await ExternalCardExporter.ExportAsync(readSessionId, sourceType, cancellationToken);
        state.MarkExportReady(readSessionId, result);
    }
    catch (ExportCommandMissingException error)
    {
        state.FailRead(readSessionId, "export_tool_missing", error.Message);
    }
    catch (TimeoutException error)
    {
        state.FailRead(readSessionId, "card_export_timeout", error.Message);
    }
    catch (FileNotFoundException error)
    {
        state.FailRead(readSessionId, "export_file_missing", error.Message);
    }
    catch (OperationCanceledException)
    {
        state.FailRead(readSessionId, "card_export_cancelled", "The card export was cancelled.");
    }
    catch (Exception error)
    {
        state.FailRead(readSessionId, "card_export_failed", error.Message);
    }
}

static async Task MonitorSmartCardReadersAsync(HelperState state, CancellationToken cancellationToken)
{
    while (!cancellationToken.IsCancellationRequested)
    {
        try
        {
            state.ApplyReaderSnapshot(
                HelperConstants.SimulateCardPresent
                    ? new ReaderSnapshot(true, true, "Simulated PC/SC reader", "Simulated card present for external export testing.", null)
                    : WindowsSmartCardProbe.ReadSnapshot());
        }
        catch (Exception error)
        {
            state.ApplyReaderSnapshot(ReaderSnapshot.Error(
                "reader_probe_failed",
                $"Windows smart-card probe failed: {error.Message}"));
        }

        try
        {
            await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }
    }
}

static string BuildListenUrl()
{
    var host = Environment.GetEnvironmentVariable("TACHO_HELPER_HOST");
    if (string.IsNullOrWhiteSpace(host))
    {
        host = "127.0.0.1";
    }

    if (host != "127.0.0.1" && host != "localhost")
    {
        throw new InvalidOperationException("The helper shell must bind to localhost only.");
    }

    var port = Environment.GetEnvironmentVariable("TACHO_HELPER_PORT");
    if (string.IsNullOrWhiteSpace(port))
    {
        port = "47231";
    }

    return $"http://{host}:{port}";
}

sealed class HelperState
{
    private readonly object syncRoot = new();

    public string Stage { get; private set; } = "ready";
    public int ProgressPercent { get; private set; } = 10;
    public string Message { get; private set; } = "HourWise reader helper shell online.";
    public string Detail { get; private set; } = "No real reader integration is wired yet. This shell validates the localhost contract.";
    public bool ReaderConnected { get; private set; }
    public bool CardPresent { get; private set; }
    public bool CanStartRead { get; private set; }
    public bool CanCancel { get; private set; }
    public string LastHeartbeatAt { get; private set; } = DateTimeOffset.UtcNow.ToString("O");
    public string? CompanyId { get; private set; }
    public string? RequestedByUserId { get; private set; }
    public string? SourceType { get; private set; }
    public string? ReadSessionId { get; private set; }
    public string? ImportId { get; private set; }
    public string? BackendJobId { get; private set; }
    public string? UploadedStoragePath { get; private set; }
    public string? ExportFileName { get; private set; }
    public string? ExportDownloadPath { get; private set; }
    public long? ExportFileSizeBytes { get; private set; }
    public string? ExportSha256 { get; private set; }
    public byte[]? ExportBytes { get; private set; }
    public string? ReaderDeviceName { get; private set; }
    public string? ErrorCode { get; private set; }

    public HelperState()
    {
        if (HelperConstants.PlaceholderReaderEnabled)
        {
            ReaderConnected = true;
            CardPresent = true;
            CanStartRead = true;
            Message = "HourWise reader helper shell online with placeholder reader enabled.";
            Detail = "Placeholder mode is for contract testing only. It does not read real tachograph hardware.";
        }
    }

    public void Touch()
    {
        lock (syncRoot)
        {
            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
        }
    }

    public object ToResponse()
    {
        lock (syncRoot)
        {
            return new
            {
                stage = Stage,
                progressPercent = ProgressPercent,
                message = Message,
                detail = Detail,
                helperVersion = HelperConstants.Version,
                readerConnected = ReaderConnected,
                cardPresent = CardPresent,
                canStartRead = CanStartRead,
                canCancel = CanCancel,
                lastHeartbeatAt = LastHeartbeatAt,
                companyId = CompanyId,
                requestedByUserId = RequestedByUserId,
                sourceType = SourceType,
                readSessionId = ReadSessionId,
                importId = ImportId,
                backendJobId = BackendJobId,
                uploadedStoragePath = UploadedStoragePath,
                exportFileName = ExportFileName,
                exportDownloadPath = ExportDownloadPath,
                exportFileSizeBytes = ExportFileSizeBytes,
                exportSha256 = ExportSha256,
                readerDeviceName = ReaderDeviceName,
                errorCode = ErrorCode
            };
        }
    }

    public void ApplyReaderSnapshot(ReaderSnapshot snapshot)
    {
        object? diagnostic = null;
        lock (syncRoot)
        {
            if (HelperConstants.PlaceholderReaderEnabled || !CanApplyReaderSnapshot())
            {
                return;
            }

            var previousStage = Stage;
            var previousReaderConnected = ReaderConnected;
            var previousCardPresent = CardPresent;
            var previousErrorCode = ErrorCode;

            ReaderConnected = snapshot.ReaderConnected;
            CardPresent = snapshot.CardPresent;
            ReaderDeviceName = snapshot.ReaderName;
            ErrorCode = snapshot.ErrorCode;

            if (snapshot.CardPresent)
            {
                Stage = "card_inserted";
                ProgressPercent = 20;
                Message = "Driver card detected.";
                Detail = snapshot.Detail;
                CanStartRead = true;
                CanCancel = false;
            }
            else
            {
                Stage = "ready";
                ProgressPercent = snapshot.ReaderConnected ? 15 : 10;
                Message = snapshot.ReaderConnected ? "Reader connected. Waiting for a driver card." : "No smart-card reader detected.";
                Detail = snapshot.Detail;
                CanStartRead = false;
                CanCancel = false;
            }

            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
            if (previousStage != Stage
                || previousReaderConnected != ReaderConnected
                || previousCardPresent != CardPresent
                || previousErrorCode != ErrorCode)
            {
                diagnostic = new
                {
                    stage = Stage,
                    ReaderConnected,
                    CardPresent,
                    ReaderDeviceName,
                    ErrorCode,
                    previousStage,
                    previousReaderConnected,
                    previousCardPresent,
                    previousErrorCode
                };
            }
        }

        if (diagnostic is not null)
        {
            HelperDiagnostics.Record("reader_snapshot_changed", diagnostic);
        }
    }

    public void BeginPlaceholderRead(string companyId, string? requestedByUserId, string sourceType)
    {
        string? readSessionId;
        lock (syncRoot)
        {
            CompanyId = companyId;
            RequestedByUserId = requestedByUserId;
            SourceType = sourceType;
            ReadSessionId = $"read_{Guid.NewGuid():N}";
            BackendJobId = null;
            ImportId = null;
            UploadedStoragePath = null;

            ExportFileName = $"HOURWISE_PLACEHOLDER_{DateTimeOffset.UtcNow:yyyyMMddHHmmss}{HelperConstants.GetExportExtension(sourceType)}";
            ExportBytes = RandomNumberGenerator.GetBytes(4096);
            ExportFileSizeBytes = ExportBytes.LongLength;
            ExportSha256 = Convert.ToHexString(SHA256.HashData(ExportBytes)).ToLowerInvariant();
            ExportDownloadPath = $"/exports/{ReadSessionId}/file";
            ErrorCode = null;

            Stage = "uploading";
            ProgressPercent = 70;
            Message = "Placeholder export ready.";
            Detail = "This shell has generated placeholder bytes. Replace this path with real card export integration.";
            ReaderConnected = true;
            CardPresent = true;
            CanStartRead = false;
            CanCancel = true;
            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
            readSessionId = ReadSessionId;
        }

        HelperDiagnostics.Record("read_started", new
        {
            mode = "placeholder",
            companyId,
            requestedByUserId,
            sourceType,
            readSessionId
        });
        HelperDiagnostics.Record("export_ready", new
        {
            mode = "placeholder",
            sourceType,
            readSessionId,
            fileName = ExportFileName,
            fileSizeBytes = ExportFileSizeBytes,
            sha256 = ExportSha256
        });
    }

    public string BeginExternalExportRead(string companyId, string? requestedByUserId, string sourceType)
    {
        lock (syncRoot)
        {
            CompanyId = companyId;
            RequestedByUserId = requestedByUserId;
            SourceType = sourceType;
            ReadSessionId = $"read_{Guid.NewGuid():N}";
            BackendJobId = null;
            ImportId = null;
            UploadedStoragePath = null;
            ExportFileName = null;
            ExportBytes = null;
            ExportFileSizeBytes = null;
            ExportSha256 = null;
            ExportDownloadPath = null;
            ErrorCode = null;

            Stage = "reading";
            ProgressPercent = 45;
            Message = "Reading driver card.";
            Detail = "The helper is running the configured local card export command.";
            CanStartRead = false;
            CanCancel = true;
            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
            HelperDiagnostics.Record("read_started", new
            {
                mode = "external_command",
                companyId,
                requestedByUserId,
                sourceType,
                readSessionId = ReadSessionId,
                exportCommandConfigured = !string.IsNullOrWhiteSpace(HelperConstants.ExportCommand)
            });
            return ReadSessionId;
        }
    }

    public void MarkExportReady(string readSessionId, ExportResult result)
    {
        lock (syncRoot)
        {
            if (ReadSessionId != readSessionId || Stage != "reading")
            {
                return;
            }

            ExportFileName = result.FileName;
            ExportBytes = result.Bytes;
            ExportFileSizeBytes = result.Bytes.LongLength;
            ExportSha256 = result.Sha256;
            ExportDownloadPath = $"/exports/{readSessionId}/file";
            SourceType ??= HelperConstants.DriverCardSourceType;

            Stage = "uploading";
            ProgressPercent = 70;
            Message = "Reader export ready for portal upload.";
            Detail = $"{ExportFileName} is ready for browser-assisted upload.";
            CanStartRead = false;
            CanCancel = true;
            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
        }

        HelperDiagnostics.Record("export_ready", new
        {
            readSessionId,
            sourceType = SourceType,
            fileName = result.FileName,
            fileSizeBytes = result.Bytes.LongLength,
            sha256 = result.Sha256,
            downloadPath = $"/exports/{readSessionId}/file"
        });
    }

    public void FailRead(string readSessionId, string errorCode, string detail)
    {
        lock (syncRoot)
        {
            if (ReadSessionId != readSessionId && ReadSessionId is not null)
            {
                return;
            }

            Stage = "error";
            ProgressPercent = 100;
            Message = "Reader helper export failed.";
            Detail = detail;
            ErrorCode = errorCode;
            CanStartRead = CardPresent;
            CanCancel = false;
            ExportDownloadPath = null;
            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
        }

        HelperDiagnostics.Record("read_failed", new { readSessionId, errorCode, detail });
    }

    public void MarkRegistered(string importId, string uploadedStoragePath, string? sourceType)
    {
        lock (syncRoot)
        {
            ImportId = importId;
            UploadedStoragePath = uploadedStoragePath;
            BackendJobId = $"job_{Guid.NewGuid():N}";
            SourceType = sourceType ?? SourceType;
            if (HelperConstants.PlaceholderReaderEnabled || HelperConstants.CompleteAfterRegister)
            {
                Stage = "complete";
                ProgressPercent = 100;
                Message = HelperConstants.PlaceholderReaderEnabled ? "Placeholder helper workflow complete." : "Helper workflow complete after registration.";
                Detail = HelperConstants.PlaceholderReaderEnabled
                    ? $"Import {ImportId} was registered by the browser. Placeholder mode has no real backend processing."
                    : $"Import {ImportId} was registered by the browser. Completion-after-register mode is enabled for local contract testing.";
                CanStartRead = true;
                CanCancel = false;
            }
            else
            {
                Stage = "processing";
                ProgressPercent = 90;
                Message = "Portal registration acknowledged.";
                Detail = $"Import {ImportId} was registered by the browser. Waiting for portal-side processing.";
                CanStartRead = false;
                CanCancel = true;
            }
            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
        }

        HelperDiagnostics.Record("import_registered", new
        {
            readSessionId = ReadSessionId,
            importId,
            uploadedStoragePath,
            sourceType = SourceType,
            stage = Stage
        });
    }

    public void Reset(string detail)
    {
        string? previousReadSessionId;
        lock (syncRoot)
        {
            previousReadSessionId = ReadSessionId;
            Stage = "ready";
            ProgressPercent = 10;
            Message = "HourWise reader helper shell online.";
            Detail = detail;
            ReaderConnected = HelperConstants.PlaceholderReaderEnabled;
            CardPresent = HelperConstants.PlaceholderReaderEnabled;
            CanStartRead = HelperConstants.PlaceholderReaderEnabled;
            CanCancel = false;
            CompanyId = null;
            RequestedByUserId = null;
            SourceType = null;
            ReadSessionId = null;
            ImportId = null;
            BackendJobId = null;
            UploadedStoragePath = null;
            ExportFileName = null;
            ExportDownloadPath = null;
            ExportFileSizeBytes = null;
            ExportSha256 = null;
            ExportBytes = null;
            ErrorCode = null;
            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
        }

        HelperDiagnostics.Record("workflow_reset", new { previousReadSessionId, detail });
    }

    private bool CanApplyReaderSnapshot() =>
        Stage is "ready" or "card_inserted" or "error";
}

sealed record ReaderSnapshot(
    bool ReaderConnected,
    bool CardPresent,
    string? ReaderName,
    string Detail,
    string? ErrorCode)
{
    public static ReaderSnapshot Error(string errorCode, string detail) =>
        new(false, false, null, detail, errorCode);
}

static class WindowsSmartCardProbe
{
    private const int ScardSuccess = 0;
    private const int ScardScopeSystem = 2;
    private const int ScardENoReadersAvailable = unchecked((int)0x8010002E);
    private const uint ScardStateUnaware = 0x0000;
    private const uint ScardStatePresent = 0x0020;

    public static ReaderSnapshot ReadSnapshot()
    {
        if (!OperatingSystem.IsWindows())
        {
            return ReaderSnapshot.Error("pcsc_unavailable", "Windows smart-card APIs are not available on this OS.");
        }

        var establishResult = SCardEstablishContext(ScardScopeSystem, IntPtr.Zero, IntPtr.Zero, out var context);
        if (establishResult != ScardSuccess)
        {
            return ReaderSnapshot.Error("pcsc_context_failed", $"Could not open Windows smart-card context: 0x{establishResult:X8}.");
        }

        try
        {
            var readers = ListReaders(context);
            if (readers.Length == 0)
            {
                return new ReaderSnapshot(false, false, null, "No Windows smart-card readers were detected.", null);
            }

            foreach (var reader in readers)
            {
                var state = new ScardReaderState
                {
                    ReaderName = reader,
                    CurrentState = ScardStateUnaware,
                    Atr = new byte[36],
                };
                var states = new[] { state };
                var statusResult = SCardGetStatusChange(context, 0, states, states.Length);
                if (statusResult != ScardSuccess)
                {
                    continue;
                }

                var cardPresent = (states[0].EventState & ScardStatePresent) == ScardStatePresent;
                if (cardPresent)
                {
                    return new ReaderSnapshot(true, true, reader, $"Card present in reader '{reader}'.", null);
                }
            }

            return new ReaderSnapshot(true, false, readers[0], $"Reader '{readers[0]}' connected. Waiting for a driver card.", null);
        }
        finally
        {
            SCardReleaseContext(context);
        }
    }

    private static string[] ListReaders(IntPtr context)
    {
        var length = 0;
        var initialResult = SCardListReaders(context, null, null, ref length);
        if (initialResult == ScardENoReadersAvailable)
        {
            return [];
        }

        if (initialResult != ScardSuccess || length <= 0)
        {
            return [];
        }

        var buffer = new char[length];
        var result = SCardListReaders(context, null, buffer, ref length);
        if (result != ScardSuccess)
        {
            return [];
        }

        return new string(buffer)
            .Split('\0', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    [DllImport("winscard.dll", EntryPoint = "SCardEstablishContext")]
    private static extern int SCardEstablishContext(int scope, IntPtr reserved1, IntPtr reserved2, out IntPtr context);

    [DllImport("winscard.dll", EntryPoint = "SCardReleaseContext")]
    private static extern int SCardReleaseContext(IntPtr context);

    [DllImport("winscard.dll", EntryPoint = "SCardListReadersW", CharSet = CharSet.Unicode)]
    private static extern int SCardListReaders(IntPtr context, string? groups, char[]? readers, ref int readersLength);

    [DllImport("winscard.dll", EntryPoint = "SCardGetStatusChangeW", CharSet = CharSet.Unicode)]
    private static extern int SCardGetStatusChange(
        IntPtr context,
        int timeout,
        [In, Out] ScardReaderState[] readerStates,
        int readerCount);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct ScardReaderState
    {
        [MarshalAs(UnmanagedType.LPTStr)]
        public string ReaderName;

        public IntPtr UserData;
        public uint CurrentState;
        public uint EventState;
        public uint AtrLength;

        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 36)]
        public byte[] Atr;
    }
}

sealed record ExportResult(string FileName, byte[] Bytes, string Sha256);

sealed class ExportCommandMissingException(string message) : Exception(message);

static class ExternalCardExporter
{
    public static async Task<ExportResult> ExportAsync(string readSessionId, string sourceType, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(HelperConstants.ExportCommand))
        {
            throw new ExportCommandMissingException("No card export command is configured. Set TACHO_HELPER_EXPORT_COMMAND.");
        }

        Directory.CreateDirectory(HelperConstants.ExportOutputDirectory);
        var outputFileName = $"{HelperConstants.GetExportFilePrefix(sourceType)}_{DateTimeOffset.UtcNow:yyyyMMddHHmmss}_{readSessionId}{HelperConstants.GetExportExtension(sourceType)}";
        var outputPath = Path.Combine(HelperConstants.ExportOutputDirectory, outputFileName);
        var arguments = BuildArguments(readSessionId, outputPath);
        HelperDiagnostics.Record("export_command_starting", new
        {
            readSessionId,
            sourceType,
            outputPath,
            commandConfigured = !string.IsNullOrWhiteSpace(HelperConstants.ExportCommand),
            timeoutSeconds = HelperConstants.ExportTimeoutSeconds
        });

        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = HelperConstants.ExportCommand,
            Arguments = arguments,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
        };
        process.StartInfo.Environment["HOURWISE_TACHO_READ_SESSION_ID"] = readSessionId;
        process.StartInfo.Environment["HOURWISE_TACHO_SOURCE_TYPE"] = sourceType;
        process.StartInfo.Environment["HOURWISE_TACHO_EXPORT_OUTPUT_PATH"] = outputPath;
        process.StartInfo.Environment["HOURWISE_TACHO_EXPORT_OUTPUT_DIR"] = HelperConstants.ExportOutputDirectory;

        if (!process.Start())
        {
            throw new InvalidOperationException("The configured card export command could not be started.");
        }

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(HelperConstants.ExportTimeoutSeconds));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

        try
        {
            await process.WaitForExitAsync(linked.Token);
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            TryKill(process);
            throw new TimeoutException($"Card export command timed out after {HelperConstants.ExportTimeoutSeconds} seconds.");
        }

        var stdout = await process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderr = await process.StandardError.ReadToEndAsync(cancellationToken);
        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"Card export command exited with code {process.ExitCode}. {stderr} {stdout}".Trim());
        }

        if (!File.Exists(outputPath))
        {
            throw new FileNotFoundException($"Card export command completed but did not create expected output file: {outputPath}", outputPath);
        }

        var bytes = await File.ReadAllBytesAsync(outputPath, cancellationToken);
        if (bytes.Length == 0)
        {
            throw new InvalidOperationException("Card export command created an empty file.");
        }

        var sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        return new ExportResult(Path.GetFileName(outputPath), bytes, sha256);
    }

    private static string BuildArguments(string readSessionId, string outputPath)
    {
        if (string.IsNullOrWhiteSpace(HelperConstants.ExportArguments))
        {
            return Quote(outputPath);
        }

        return HelperConstants.ExportArguments
            .Replace("{readSessionId}", readSessionId, StringComparison.OrdinalIgnoreCase)
            .Replace("{outputPath}", outputPath, StringComparison.OrdinalIgnoreCase)
            .Replace("{outputDir}", HelperConstants.ExportOutputDirectory, StringComparison.OrdinalIgnoreCase);
    }

    private static string Quote(string value) => $"\"{value.Replace("\"", "\\\"")}\"";

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // Best-effort cleanup. The helper reports timeout even if the child has already exited.
        }
    }
}

sealed record StartReadRequest(
    string? RequestedAt,
    string? CompanyId,
    string? RequestedByUserId,
    string? SourceType);

sealed record RegisterImportRequest(
    string? RequestedAt,
    string? ReadSessionId,
    string? ImportId,
    string? UploadedStoragePath,
    string? FileName,
    string? FileType,
    string? SourceType);

sealed record CommandResponse(bool Accepted, string Error);

static class HelperConstants
{
    public const string Version = "dotnet-shell-0.4.0";
    public const string DriverCardSourceType = "driver_card";
    public const string VehicleUnitSourceType = "vehicle_unit";

    public static bool PlaceholderReaderEnabled =>
        string.Equals(
            Environment.GetEnvironmentVariable("TACHO_HELPER_PLACEHOLDER_READER"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    public static bool SimulateCardPresent =>
        string.Equals(
            Environment.GetEnvironmentVariable("TACHO_HELPER_SIMULATE_CARD_PRESENT"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    public static bool CompleteAfterRegister =>
        string.Equals(
            Environment.GetEnvironmentVariable("TACHO_HELPER_COMPLETE_AFTER_REGISTER"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    public static bool VuWorkflowEnabled =>
        string.Equals(
            Environment.GetEnvironmentVariable("TACHO_HELPER_ENABLE_VU_WORKFLOW"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    public static string? ExportCommand => Environment.GetEnvironmentVariable("TACHO_HELPER_EXPORT_COMMAND");

    public static string? ExportArguments => Environment.GetEnvironmentVariable("TACHO_HELPER_EXPORT_ARGS");

    public static int ExportTimeoutSeconds =>
        int.TryParse(Environment.GetEnvironmentVariable("TACHO_HELPER_EXPORT_TIMEOUT_SECONDS"), out var value) && value > 0
            ? value
            : 120;

    public static string ExportOutputDirectory =>
        Environment.GetEnvironmentVariable("TACHO_HELPER_EXPORT_OUTPUT_DIR")
        ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "HourWise",
            "TachoReaderHelper",
            "exports");

    public static string LogDirectory =>
        Environment.GetEnvironmentVariable("TACHO_HELPER_LOG_DIR")
        ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "HourWise",
            "TachoReaderHelper",
            "logs");

    public static string NormalizeSourceType(string? sourceType) =>
        string.IsNullOrWhiteSpace(sourceType) ? DriverCardSourceType : sourceType.Trim().ToLowerInvariant();

    public static bool IsSourceTypeEnabled(string sourceType) =>
        sourceType == DriverCardSourceType || (sourceType == VehicleUnitSourceType && VuWorkflowEnabled);

    public static string GetExportFilePrefix(string sourceType) =>
        sourceType == VehicleUnitSourceType ? "HOURWISE_VU" : "HOURWISE_CARD";

    public static string GetExportExtension(string sourceType) =>
        sourceType == VehicleUnitSourceType ? ".DDD" : ".C1B";

    public static object ToDiagnosticsConfig() => new
    {
        PlaceholderReaderEnabled,
        SimulateCardPresent,
        CompleteAfterRegister,
        VuWorkflowEnabled,
        exportCommandConfigured = !string.IsNullOrWhiteSpace(ExportCommand),
        exportArgumentsConfigured = !string.IsNullOrWhiteSpace(ExportArguments),
        ExportTimeoutSeconds,
        ExportOutputDirectory,
        LogDirectory
    };

    public static object ToCapabilities() => new
    {
        sourceTypes = VuWorkflowEnabled
            ? new[] { DriverCardSourceType, VehicleUnitSourceType }
            : new[] { DriverCardSourceType },
        diagnostics = new[] { "/diagnostics", "/diagnostics/logs" },
        exportDownload = true,
        browserRegistrationHandoff = true
    };
}

sealed record DiagnosticEvent(string Timestamp, string Event, object? Data);

static class HelperDiagnostics
{
    private const int MaxEvents = 120;
    private static readonly object SyncRoot = new();
    private static readonly List<DiagnosticEvent> Events = [];
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static void Record(string eventName, object? data = null)
    {
        var entry = new DiagnosticEvent(DateTimeOffset.UtcNow.ToString("O"), eventName, data);
        lock (SyncRoot)
        {
            Events.Add(entry);
            if (Events.Count > MaxEvents)
            {
                Events.RemoveRange(0, Events.Count - MaxEvents);
            }
        }

        TryAppend(entry);
    }

    public static DiagnosticEvent[] Recent()
    {
        lock (SyncRoot)
        {
            return Events.ToArray();
        }
    }

    private static void TryAppend(DiagnosticEvent entry)
    {
        try
        {
            Directory.CreateDirectory(HelperConstants.LogDirectory);
            var logPath = Path.Combine(HelperConstants.LogDirectory, $"helper-{DateTimeOffset.UtcNow:yyyyMMdd}.jsonl");
            File.AppendAllText(logPath, JsonSerializer.Serialize(entry, JsonOptions) + Environment.NewLine);
        }
        catch
        {
            // Logging must never break the localhost helper contract.
        }
    }
}
