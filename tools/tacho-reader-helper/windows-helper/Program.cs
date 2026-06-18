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
    context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";

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

app.MapGet("/diagnostics/apdu-safety", () =>
{
    state.Touch();
    return Results.Json(WindowsTachographCardProbe.GetReadOnlySafetySelfTest());
});

app.MapGet("/diagnostics/card-probe", () =>
{
    state.Touch();
    var probe = WindowsTachographCardProbe.ReadSafeProbe();
    HelperDiagnostics.Record("card_probe_requested", new
    {
        probe.Success,
        probe.ReaderName,
        probe.ErrorCode,
        apduCount = probe.ApduResults.Length
    });
    return Results.Json(probe);
});

app.MapGet("/diagnostics/tachograph-file-map", () =>
{
    state.Touch();
    var probe = WindowsTachographCardProbe.ReadTachographFileMapProbe();
    HelperDiagnostics.Record("tachograph_file_map_probe_requested", new
    {
        probe.Success,
        probe.ReaderName,
        probe.ErrorCode,
        fileCount = probe.Files.Length
    });
    return Results.Json(probe);
});

app.MapPost("/diagnostics/apdu", (RawApduRequest? request) =>
{
    state.Touch();
    if (!HelperConstants.RawApduDiagnosticsEnabled)
    {
        return Results.Json(
            new { error = "Raw APDU diagnostics are disabled. Set TACHO_HELPER_ENABLE_RAW_APDU=true to enable this local development endpoint." },
            statusCode: StatusCodes.Status403Forbidden);
    }

    if (request is null || string.IsNullOrWhiteSpace(request.CommandHex))
    {
        return Results.BadRequest(new { error = "commandHex is required." });
    }

        var result = WindowsTachographCardProbe.TransmitRaw(request.CommandHex);
        HelperDiagnostics.Record("safe_apdu_requested", new
        {
            result.Success,
            result.ReaderName,
            result.ErrorCode,
            result.ApduResult?.StatusWord
    });
    return Results.Json(result);
});

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
    else if (HelperConstants.ExternalExporterEnabled)
    {
        var readSessionId = state.BeginExternalExportRead(companyId, requestedByUserId, sourceType);
        _ = Task.Run(() => RunExternalExportAsync(state, readSessionId, sourceType, app.Lifetime.ApplicationStopping));
    }
    else
    {
        var readSessionId = state.BeginBuiltInExportRead(companyId, requestedByUserId, sourceType);
        _ = Task.Run(() => RunBuiltInExportAsync(state, readSessionId, sourceType, app.Lifetime.ApplicationStopping));
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

static Task RunBuiltInExportAsync(HelperState state, string readSessionId, string sourceType, CancellationToken cancellationToken)
{
    try
    {
        var result = WindowsTachographCardProbe.ExportDriverCardCapture(readSessionId, sourceType, cancellationToken);
        state.MarkExportReady(readSessionId, result);
    }
    catch (OperationCanceledException)
    {
        state.FailRead(readSessionId, "card_export_cancelled", "The built-in read-only card export was cancelled.");
    }
    catch (Exception error)
    {
        state.FailRead(readSessionId, "card_export_failed", error.Message);
    }

    return Task.CompletedTask;
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
    public string? ExportFormat { get; private set; }
    public bool ExportParserReady { get; private set; } = true;
    public string? ExportNote { get; private set; }
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
                exportFormat = ExportFormat,
                exportParserReady = ExportParserReady,
                exportNote = ExportNote,
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
            ExportFormat = "placeholder_contract_bytes";
            ExportParserReady = true;
            ExportNote = "Placeholder bytes are for helper contract testing only.";
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
            ExportFormat = null;
            ExportParserReady = true;
            ExportNote = null;
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

    public string BeginBuiltInExportRead(string companyId, string? requestedByUserId, string sourceType)
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
            ExportFormat = null;
            ExportParserReady = true;
            ExportNote = null;
            ExportDownloadPath = null;
            ErrorCode = null;

            Stage = "reading";
            ProgressPercent = 45;
            Message = "Reading driver card.";
            Detail = "The helper is using the built-in read-only tachograph card capture path.";
            CanStartRead = false;
            CanCancel = true;
            LastHeartbeatAt = DateTimeOffset.UtcNow.ToString("O");
            HelperDiagnostics.Record("read_started", new
            {
                mode = "built_in_read_only_capture",
                companyId,
                requestedByUserId,
                sourceType,
                readSessionId = ReadSessionId,
                maxBytesPerFile = HelperConstants.BuiltInExportMaxBytesPerFile
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
            ExportFormat = result.Format;
            ExportParserReady = result.ParserReady;
            ExportNote = result.Note;
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
            format = result.Format,
            parserReady = result.ParserReady,
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
            ExportParserReady = true;
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
            ExportFormat = null;
            ExportParserReady = true;
            ExportNote = null;
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

sealed record CardProbeResult(
    bool Success,
    string? ReaderName,
    string? Atr,
    string? ActiveProtocol,
    string? ErrorCode,
    string Detail,
    ApduProbeResult[] ApduResults);

sealed record ApduProbeResult(
    string Name,
    string Command,
    string? ResponsePreview,
    int ResponseLength,
    string StatusWord,
    string StatusMeaning,
    bool Success);

sealed record RawApduRequest(string? CommandHex);

sealed record RawApduResult(
    bool Success,
    string? ReaderName,
    string? ActiveProtocol,
    string? ErrorCode,
    string Detail,
    ApduProbeResult? ApduResult);

sealed record TachographFileMapProbeResult(
    bool Success,
    string? ReaderName,
    string? Atr,
    string? ActiveProtocol,
    string? ErrorCode,
    string Detail,
    int MaxBytesPerFile,
    TachographFileProbeSummary[] Files);

sealed record TachographFileProbeSummary(
    string FileId,
    string Name,
    bool Selected,
    bool ReadSuccess,
    int BytesRead,
    bool Truncated,
    string? Sha256,
    string? ResponsePreview,
    string? StatusWord,
    string? StatusMeaning);

sealed record ApduSafetySelfTestResult(
    string Detail,
    string[] AllowedInstructions,
    ApduSafetyCheck[] Checks);

sealed record ApduSafetyCheck(
    string Name,
    string Command,
    bool Allowed,
    string Reason);

static class WindowsTachographCardProbe
{
    private const int ScardSuccess = 0;
    private const int ScardScopeSystem = 2;
    private const int ScardENoReadersAvailable = unchecked((int)0x8010002E);
    private const uint ScardShareShared = 2;
    private const uint ScardProtocolT0 = 1;
    private const uint ScardProtocolT1 = 2;
    private const uint ScardLeaveCard = 0;
    private const int FileMapProbeMaxBytesPerFile = 4096;
    private static readonly byte[] FirstGenerationTachographAid = [0xFF, 0x54, 0x41, 0x43, 0x48, 0x4F];
    private static readonly TachographFileCandidate[] FileMapProbeCandidates =
    [
        new("0501", "Application identification", 0x05, 0x01),
        new("050E", "Card download", 0x05, 0x0E),
        new("0520", "Card identification", 0x05, 0x20),
        new("0504", "Driver activity", 0x05, 0x04),
    ];
    private static readonly TachographFileCandidate[] BuiltInExportCandidates =
    [
        new("0501", "Application identification", 0x05, 0x01),
        new("0502", "Events data", 0x05, 0x02),
        new("0503", "Faults data", 0x05, 0x03),
        new("0504", "Driver activity", 0x05, 0x04),
        new("0505", "Vehicles used", 0x05, 0x05),
        new("0506", "Places", 0x05, 0x06),
        new("0507", "Current usage", 0x05, 0x07),
        new("0508", "Control activity", 0x05, 0x08),
        new("0509", "Specific conditions", 0x05, 0x09),
        new("050E", "Card download", 0x05, 0x0E),
        new("0520", "Card identification", 0x05, 0x20),
        new("0521", "Card certificate or license information", 0x05, 0x21),
        new("0522", "CA certificate or specific conditions", 0x05, 0x22),
        new("0523", "Extended card data", 0x05, 0x23),
        new("0524", "Extended card data", 0x05, 0x24),
    ];

    public static CardProbeResult ReadSafeProbe()
    {
        if (!OperatingSystem.IsWindows())
        {
            return Failure("pcsc_unavailable", "Windows smart-card APIs are not available on this OS.");
        }

        var establishResult = SCardEstablishContext(ScardScopeSystem, IntPtr.Zero, IntPtr.Zero, out var context);
        if (establishResult != ScardSuccess)
        {
            return Failure("pcsc_context_failed", $"Could not open Windows smart-card context: 0x{establishResult:X8}.");
        }

        try
        {
            var readers = ListReaders(context);
            if (readers.Length == 0)
            {
                return Failure("reader_not_found", "No Windows smart-card readers were detected.");
            }

            foreach (var reader in readers)
            {
                var connectResult = SCardConnect(
                    context,
                    reader,
                    ScardShareShared,
                    ScardProtocolT0 | ScardProtocolT1,
                    out var card,
                    out var activeProtocol);

                if (connectResult != ScardSuccess)
                {
                    continue;
                }

                try
                {
                    var atr = ReadAtr(card);
                    var apduResults = RunSafeApduProbe(card, activeProtocol);
                    return new CardProbeResult(
                        true,
                        reader,
                        ToHex(atr),
                        ProtocolName(activeProtocol),
                        null,
                        "Connected to card and completed safe APDU probe.",
                        apduResults);
                }
                finally
                {
                    SCardDisconnect(card, ScardLeaveCard);
                }
            }

            return Failure("card_not_connected", "No inserted card could be opened through PC/SC.");
        }
        finally
        {
            SCardReleaseContext(context);
        }
    }

    public static RawApduResult TransmitRaw(string commandHex)
    {
        var command = ParseHex(commandHex);
        if (command.Length < 4 || command.Length > 260)
        {
            return new RawApduResult(false, null, null, "invalid_apdu", "commandHex must decode to 4 to 260 bytes.", null);
        }

        var connect = ConnectFirstAvailableCard();
        if (connect.Error is not null)
        {
            return new RawApduResult(false, null, null, connect.Error, connect.Detail, null);
        }

        try
        {
            var apduResult = Transmit(connect.Card, connect.ActiveProtocol, "raw_apdu", command);
            return new RawApduResult(
                apduResult.Success,
                connect.ReaderName,
                ProtocolName(connect.ActiveProtocol),
                apduResult.StatusWord == "blocked_by_read_only_guard" ? "blocked_by_read_only_guard" : null,
                apduResult.StatusWord == "blocked_by_read_only_guard"
                    ? "APDU was blocked before PC/SC transmit because it is outside the helper read-only allowlist."
                    : "Read-only APDU transmitted through PC/SC.",
                apduResult);
        }
        finally
        {
            connect.Dispose();
        }
    }

    public static ApduSafetySelfTestResult GetReadOnlySafetySelfTest()
    {
        var samples = new (string Name, byte[] Command)[]
        {
            ("allow_select_file", [0x00, 0xA4, 0x02, 0x0C, 0x02, 0x05, 0x20]),
            ("allow_read_binary", [0x00, 0xB0, 0x00, 0x00, 0x20]),
            ("allow_read_record", [0x00, 0xB2, 0x01, 0x04, 0x00]),
            ("allow_get_response", [0x00, 0xC0, 0x00, 0x00, 0x10]),
            ("allow_get_data", [0x00, 0xCA, 0x00, 0x00, 0x00]),
            ("block_verify_pin", [0x00, 0x20, 0x00, 0x00, 0x04, 0x31, 0x32, 0x33, 0x34]),
            ("block_update_binary", [0x00, 0xD6, 0x00, 0x00, 0x01, 0x00]),
            ("block_update_record", [0x00, 0xDC, 0x01, 0x04, 0x01, 0x00]),
            ("block_erase_binary", [0x00, 0x0E, 0x00, 0x00]),
            ("block_put_data", [0x00, 0xDA, 0x00, 0x00, 0x01, 0x00]),
            ("block_external_authenticate", [0x00, 0x82, 0x00, 0x00, 0x08, 0, 0, 0, 0, 0, 0, 0, 0]),
            ("block_create_file", [0x00, 0xE0, 0x00, 0x00, 0x00]),
            ("block_delete_file", [0x00, 0xE4, 0x00, 0x00, 0x00]),
        };

        var checks = samples
            .Select(sample =>
            {
                var allowed = TryValidateReadOnlyApdu(sample.Command, out var reason);
                return new ApduSafetyCheck(
                    sample.Name,
                    ToHex(sample.Command),
                    allowed,
                    allowed ? "Allowed read-only APDU." : reason);
            })
            .ToArray();

        return new ApduSafetySelfTestResult(
            "Local APDU allowlist self-test. This endpoint does not connect to, transmit to, or modify a smart card.",
            ["SELECT", "READ BINARY", "READ RECORD", "GET RESPONSE", "GET DATA"],
            checks);
    }

    public static TachographFileMapProbeResult ReadTachographFileMapProbe()
    {
        var connect = ConnectFirstAvailableCard();
        if (connect.Error is not null)
        {
            return new TachographFileMapProbeResult(
                false,
                null,
                null,
                null,
                connect.Error,
                connect.Detail,
                FileMapProbeMaxBytesPerFile,
                []);
        }

        try
        {
            var atr = ReadAtr(connect.Card);
            var selectApplication = Transmit(
                connect.Card,
                connect.ActiveProtocol,
                "select_tachograph_application_ff544143484f",
                BuildSelectByNameCommand(0x0C, false, FirstGenerationTachographAid));

            if (!selectApplication.Success)
            {
                return new TachographFileMapProbeResult(
                    false,
                    connect.ReaderName,
                    ToHex(atr),
                    ProtocolName(connect.ActiveProtocol),
                    "tachograph_application_not_selected",
                    $"Could not select tachograph application FF544143484F: {selectApplication.StatusWord} {selectApplication.StatusMeaning}",
                    FileMapProbeMaxBytesPerFile,
                    []);
            }

            var files = FileMapProbeCandidates
                .Select(candidate => ProbeTransparentFile(connect.Card, connect.ActiveProtocol, candidate, FileMapProbeMaxBytesPerFile))
                .ToArray();

            return new TachographFileMapProbeResult(
                true,
                connect.ReaderName,
                ToHex(atr),
                ProtocolName(connect.ActiveProtocol),
                null,
                "Selected tachograph application and completed bounded read-only file-map probe.",
                FileMapProbeMaxBytesPerFile,
                files);
        }
        finally
        {
            connect.Dispose();
        }
    }

    public static ExportResult ExportDriverCardCapture(string readSessionId, string sourceType, CancellationToken cancellationToken)
    {
        if (sourceType != HelperConstants.DriverCardSourceType)
        {
            throw new InvalidOperationException($"Built-in read-only export currently supports {HelperConstants.DriverCardSourceType} only.");
        }

        cancellationToken.ThrowIfCancellationRequested();
        var connect = ConnectFirstAvailableCard();
        if (connect.Error is not null)
        {
            throw new InvalidOperationException(connect.Detail);
        }

        try
        {
            var exportedAt = DateTimeOffset.UtcNow;
            var atr = ReadAtr(connect.Card);
            var selectApplication = Transmit(
                connect.Card,
                connect.ActiveProtocol,
                "select_tachograph_application_ff544143484f_for_export",
                BuildSelectByNameCommand(0x0C, false, FirstGenerationTachographAid));

            if (!selectApplication.Success)
            {
                throw new InvalidOperationException($"Could not select tachograph application FF544143484F: {selectApplication.StatusWord} {selectApplication.StatusMeaning}");
            }

            var files = new List<TachographCaptureFileRecord>();
            foreach (var candidate in BuiltInExportCandidates)
            {
                cancellationToken.ThrowIfCancellationRequested();
                files.Add(ReadCaptureFile(connect.Card, connect.ActiveProtocol, candidate, HelperConstants.BuiltInExportMaxBytesPerFile));
            }

            var selectedFiles = files.Where(file => file.Selected).ToArray();
            if (selectedFiles.Length == 0)
            {
                throw new InvalidOperationException("No tachograph application files could be selected for export.");
            }

            var artifact = new
            {
                schema = "hourwise.tachograph.driver-card.read-only-capture.v1",
                warning = "This is a read-only HourWise capture container built from tachograph EF bytes. It is not yet a certified legal C1B encoder.",
                readSessionId,
                helperVersion = HelperConstants.Version,
                sourceType,
                exportedAt = exportedAt.ToString("O"),
                readerName = connect.ReaderName,
                activeProtocol = ProtocolName(connect.ActiveProtocol),
                atr = ToHex(atr),
                applicationAid = ToHex(FirstGenerationTachographAid),
                maxBytesPerFile = HelperConstants.BuiltInExportMaxBytesPerFile,
                readOnlyApduAllowlist = new[] { "SELECT", "READ BINARY", "READ RECORD", "GET RESPONSE", "GET DATA" },
                files
            };

            var bytes = JsonSerializer.SerializeToUtf8Bytes(artifact, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            });

            var sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
            var fileName = $"HOURWISE_CARD_CAPTURE_{exportedAt:yyyyMMddHHmmss}_{readSessionId}.C1B";
            HelperDiagnostics.Record("built_in_export_capture_created", new
            {
                readSessionId,
                fileName,
                fileSizeBytes = bytes.Length,
                sha256,
                selectedFileCount = selectedFiles.Length,
                truncatedFileCount = selectedFiles.Count(file => file.Truncated),
                HelperConstants.BuiltInExportMaxBytesPerFile
            });
            return new ExportResult(
                fileName,
                bytes,
                sha256,
                "hourwise_read_only_capture_v1",
                false,
                "Read-only HourWise EF capture. Safe for card access testing, but not yet parser-ready for Supabase processing.");
        }
        finally
        {
            connect.Dispose();
        }
    }

    private static ApduProbeResult[] RunSafeApduProbe(IntPtr card, uint activeProtocol)
    {
        var results = new List<ApduProbeResult>();

        AddProbe(results, card, activeProtocol, "select_no_data_p1_00_p2_00", [0x00, 0xA4, 0x00, 0x00]);
        AddProbe(results, card, activeProtocol, "select_no_data_p1_00_p2_0c", [0x00, 0xA4, 0x00, 0x0C]);
        AddProbe(results, card, activeProtocol, "select_without_file_id_le_00", [0x00, 0xA4, 0x00, 0x00, 0x00]);
        AddProbe(results, card, activeProtocol, "select_application_empty_name_le_00", [0x00, 0xA4, 0x04, 0x00, 0x00]);

        // Tachograph cards are file-system cards. Keep reads tiny and only probe well-known selection shapes.
        AddSelectFileProbe(results, card, activeProtocol, "select_mf_3f00_by_id_p1_00_p2_00", 0x00, 0x00, 0x3F, 0x00);
        AddSelectFileProbe(results, card, activeProtocol, "select_mf_3f00_by_id_p1_00_p2_04", 0x00, 0x04, 0x3F, 0x00);
        AddSelectFileProbe(results, card, activeProtocol, "select_mf_3f00_by_id_p1_00_p2_0c", 0x00, 0x0C, 0x3F, 0x00);
        AddSelectFileProbe(results, card, activeProtocol, "select_mf_3f00_by_file_under_current_p1_02_p2_0c", 0x02, 0x0C, 0x3F, 0x00);
        AddSelectFileProbe(results, card, activeProtocol, "select_mf_3f00_by_path_p1_08_p2_0c", 0x08, 0x0C, 0x3F, 0x00);

        AddSelectFileProbe(results, card, activeProtocol, "select_ef_dir_2f00_from_mf_p1_02_p2_0c", 0x02, 0x0C, 0x2F, 0x00);
        AddProbe(results, card, activeProtocol, "read_selected_ef_dir_record_1_probe", [0x00, 0xB2, 0x01, 0x04, 0x00]);
        AddProbe(results, card, activeProtocol, "read_selected_ef_dir_binary_probe_8", [0x00, 0xB0, 0x00, 0x00, 0x08]);
        AddProbe(results, card, activeProtocol, "read_selected_ef_dir_binary_probe_16", [0x00, 0xB0, 0x00, 0x00, 0x10]);
        AddProbe(results, card, activeProtocol, "read_selected_ef_dir_binary_probe_20", [0x00, 0xB0, 0x00, 0x00, 0x14]);
        AddProbe(results, card, activeProtocol, "read_selected_ef_dir_binary_probe_32", [0x00, 0xB0, 0x00, 0x00, 0x20]);
        AddSelectFileProbe(results, card, activeProtocol, "select_ef_atr_2f01_from_mf_p1_02_p2_0c", 0x02, 0x0C, 0x2F, 0x01);
        AddProbe(results, card, activeProtocol, "read_selected_ef_atr_binary_probe_8", [0x00, 0xB0, 0x00, 0x00, 0x08]);
        AddProbe(results, card, activeProtocol, "read_selected_ef_atr_binary_probe_16", [0x00, 0xB0, 0x00, 0x00, 0x10]);
        AddProbe(results, card, activeProtocol, "read_selected_ef_atr_binary_probe_32", [0x00, 0xB0, 0x00, 0x00, 0x20]);

        AddSelectFileProbe(results, card, activeProtocol, "select_ef_icc_0002_from_mf_p1_02_p2_0c", 0x02, 0x0C, 0x00, 0x02);
        AddProbe(results, card, activeProtocol, "read_selected_ef_icc_probe_16", [0x00, 0xB0, 0x00, 0x00, 0x10]);
        AddSelectFileProbe(results, card, activeProtocol, "select_ef_ic_0005_from_mf_p1_02_p2_0c", 0x02, 0x0C, 0x00, 0x05);
        AddProbe(results, card, activeProtocol, "read_selected_ef_ic_probe_8", [0x00, 0xB0, 0x00, 0x00, 0x08]);
        AddProbe(results, card, activeProtocol, "read_selected_ef_ic_probe_16", [0x00, 0xB0, 0x00, 0x00, 0x10]);

        AddSelectFileProbe(results, card, activeProtocol, "select_tachograph_df_0500_p1_00_p2_0c", 0x00, 0x0C, 0x05, 0x00);
        AddSelectFileProbe(results, card, activeProtocol, "select_tachograph_df_0500_p1_02_p2_0c", 0x02, 0x0C, 0x05, 0x00);
        AddSelectByNameProbe(results, card, activeProtocol, "select_tachograph_df_0500_as_name_with_le", 0x00, true, [0x05, 0x00]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_tachograph_df_0500_as_name_no_le_p2_00", 0x00, false, [0x05, 0x00]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_tachograph_df_0500_as_name_no_le_p2_0c", 0x0C, false, [0x05, 0x00]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_tachograph_aid_a000000474_with_le", 0x00, true, [0xA0, 0x00, 0x00, 0x04, 0x74]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_tachograph_aid_a000000474_no_le_p2_00", 0x00, false, [0xA0, 0x00, 0x00, 0x04, 0x74]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_tachograph_aid_a000000474_no_le_p2_0c", 0x0C, false, [0xA0, 0x00, 0x00, 0x04, 0x74]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_ef_dir_aid_ff544143484f_with_le", 0x00, true, [0xFF, 0x54, 0x41, 0x43, 0x48, 0x4F]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_ef_dir_aid_ff544143484f_no_le_p2_00", 0x00, false, [0xFF, 0x54, 0x41, 0x43, 0x48, 0x4F]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_ef_dir_aid_ff544143484f_no_le_p2_0c", 0x0C, false, [0xFF, 0x54, 0x41, 0x43, 0x48, 0x4F]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_ef_dir_aid_ff534d525444_no_le_p2_00", 0x00, false, [0xFF, 0x53, 0x4D, 0x52, 0x54, 0x44]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_ef_dir_aid_ff534d525444_no_le_p2_0c", 0x0C, false, [0xFF, 0x53, 0x4D, 0x52, 0x54, 0x44]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_atr_candidate_e065b0850500_no_le_p2_00", 0x00, false, [0xE0, 0x65, 0xB0, 0x85, 0x05, 0x00]);
        AddSelectByNameProbe(results, card, activeProtocol, "select_atr_candidate_e065b0850500_no_le_p2_0c", 0x0C, false, [0xE0, 0x65, 0xB0, 0x85, 0x05, 0x00]);

        AddSelectFileProbe(results, card, activeProtocol, "select_tachograph_application_identification_0501", 0x02, 0x0C, 0x05, 0x01);
        AddProbe(results, card, activeProtocol, "read_selected_application_identification_probe_8", [0x00, 0xB0, 0x00, 0x00, 0x08]);
        AddProbe(results, card, activeProtocol, "read_selected_application_identification_probe_16", [0x00, 0xB0, 0x00, 0x00, 0x10]);
        AddSelectFileProbe(results, card, activeProtocol, "select_tachograph_card_download_050e", 0x02, 0x0C, 0x05, 0x0E);
        AddProbe(results, card, activeProtocol, "read_selected_card_download_probe_4", [0x00, 0xB0, 0x00, 0x00, 0x04]);
        AddProbe(results, card, activeProtocol, "read_selected_card_download_probe_8", [0x00, 0xB0, 0x00, 0x00, 0x08]);
        AddProbe(results, card, activeProtocol, "read_selected_card_download_probe_16", [0x00, 0xB0, 0x00, 0x00, 0x10]);
        AddSelectFileProbe(results, card, activeProtocol, "select_tachograph_identification_0520", 0x02, 0x0C, 0x05, 0x20);
        AddProbe(results, card, activeProtocol, "read_selected_identification_probe_16", [0x00, 0xB0, 0x00, 0x00, 0x10]);
        AddProbe(results, card, activeProtocol, "read_selected_identification_probe_32", [0x00, 0xB0, 0x00, 0x00, 0x20]);
        AddSelectFileProbe(results, card, activeProtocol, "select_tachograph_driver_activity_0504", 0x02, 0x0C, 0x05, 0x04);
        AddProbe(results, card, activeProtocol, "read_selected_driver_activity_probe_16", [0x00, 0xB0, 0x00, 0x00, 0x10]);
        AddProbe(results, card, activeProtocol, "read_selected_driver_activity_probe_32", [0x00, 0xB0, 0x00, 0x00, 0x20]);
        AddProbe(results, card, activeProtocol, "get_data_probe", [0x00, 0xCA, 0x00, 0x00, 0x00]);

        var tachographAid = Environment.GetEnvironmentVariable("TACHO_HELPER_TACHOGRAPH_AID");
        if (!string.IsNullOrWhiteSpace(tachographAid))
        {
            var aidBytes = ParseHex(tachographAid);
            if (aidBytes.Length > 0 && aidBytes.Length <= 16)
            {
                AddSelectByNameProbe(results, card, activeProtocol, "select_configured_tachograph_aid_with_le", 0x00, true, aidBytes);
                AddSelectByNameProbe(results, card, activeProtocol, "select_configured_tachograph_aid_no_le_p2_00", 0x00, false, aidBytes);
                AddSelectByNameProbe(results, card, activeProtocol, "select_configured_tachograph_aid_no_le_p2_0c", 0x0C, false, aidBytes);
            }
            else
            {
                results.Add(new ApduProbeResult(
                    "select_configured_tachograph_aid",
                    tachographAid,
                    null,
                    0,
                    "invalid",
                    "TACHO_HELPER_TACHOGRAPH_AID must be 1 to 16 hex bytes.",
                    false));
            }
        }

        return results.ToArray();
    }

    private static void AddProbe(List<ApduProbeResult> results, IntPtr card, uint activeProtocol, string name, byte[] command) =>
        results.Add(Transmit(card, activeProtocol, name, command));

    private static void AddSelectFileProbe(
        List<ApduProbeResult> results,
        IntPtr card,
        uint activeProtocol,
        string name,
        byte p1,
        byte p2,
        byte fileHigh,
        byte fileLow) =>
        AddProbe(results, card, activeProtocol, name, [0x00, 0xA4, p1, p2, 0x02, fileHigh, fileLow]);

    private static void AddSelectByNameProbe(
        List<ApduProbeResult> results,
        IntPtr card,
        uint activeProtocol,
        string name,
        byte p2,
        bool includeLe,
        byte[] nameBytes)
    {
        AddProbe(results, card, activeProtocol, name, BuildSelectByNameCommand(p2, includeLe, nameBytes));
    }

    private static byte[] BuildSelectByNameCommand(byte p2, bool includeLe, byte[] nameBytes)
    {
        var command = new byte[5 + nameBytes.Length + (includeLe ? 1 : 0)];
        command[0] = 0x00;
        command[1] = 0xA4;
        command[2] = 0x04;
        command[3] = p2;
        command[4] = (byte)nameBytes.Length;
        Buffer.BlockCopy(nameBytes, 0, command, 5, nameBytes.Length);
        if (includeLe)
        {
            command[^1] = 0x00;
        }

        return command;
    }

    private static TachographFileProbeSummary ProbeTransparentFile(
        IntPtr card,
        uint activeProtocol,
        TachographFileCandidate candidate,
        int maxBytes)
    {
        var select = Transmit(
            card,
            activeProtocol,
            $"select_tachograph_file_{candidate.FileId}",
            [0x00, 0xA4, 0x02, 0x0C, 0x02, candidate.HighByte, candidate.LowByte]);

        if (!select.Success)
        {
            return new TachographFileProbeSummary(
                candidate.FileId,
                candidate.Name,
                false,
                false,
                0,
                false,
                null,
                null,
                select.StatusWord,
                select.StatusMeaning);
        }

        var read = ReadTransparentFile(card, activeProtocol, maxBytes);
        var bytes = read.Bytes.ToArray();
        return new TachographFileProbeSummary(
            candidate.FileId,
            candidate.Name,
            true,
            bytes.Length > 0 || read.EndStatusWord is "9000",
            bytes.Length,
            read.Truncated,
            bytes.Length == 0 ? null : Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),
            bytes.Length == 0 ? null : ToHex(bytes.Take(32).ToArray()),
            read.EndStatusWord,
            read.EndStatusMeaning);
    }

    private static TachographCaptureFileRecord ReadCaptureFile(
        IntPtr card,
        uint activeProtocol,
        TachographFileCandidate candidate,
        int maxBytes)
    {
        var select = Transmit(
            card,
            activeProtocol,
            $"select_tachograph_capture_file_{candidate.FileId}",
            [0x00, 0xA4, 0x02, 0x0C, 0x02, candidate.HighByte, candidate.LowByte]);

        if (!select.Success)
        {
            return new TachographCaptureFileRecord(
                candidate.FileId,
                candidate.Name,
                false,
                false,
                0,
                false,
                null,
                select.StatusWord,
                select.StatusMeaning,
                null);
        }

        var read = ReadTransparentFile(card, activeProtocol, maxBytes);
        var bytes = read.Bytes;
        var readSuccess = bytes.Length > 0 || read.EndStatusWord is "9000";
        return new TachographCaptureFileRecord(
            candidate.FileId,
            candidate.Name,
            true,
            readSuccess,
            bytes.Length,
            read.Truncated,
            bytes.Length == 0 ? null : Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),
            read.EndStatusWord,
            read.EndStatusMeaning,
            bytes.Length == 0 ? null : Convert.ToBase64String(bytes));
    }

    private static TransparentReadResult ReadTransparentFile(IntPtr card, uint activeProtocol, int maxBytes)
    {
        var output = new List<byte>(Math.Min(maxBytes, 1024));
        string? endStatusWord = null;
        string? endStatusMeaning = null;

        while (output.Count < maxBytes)
        {
            var remaining = maxBytes - output.Count;
            var maxChunk = Math.Min(0xFF, remaining);
            var chunk = FindLargestReadableChunk(card, activeProtocol, output.Count, maxChunk);
            endStatusWord = chunk.StatusWord;
            endStatusMeaning = chunk.StatusMeaning;

            if (!chunk.Success || chunk.Data.Length == 0)
            {
                return new TransparentReadResult(output.ToArray(), false, endStatusWord, endStatusMeaning);
            }

            output.AddRange(chunk.Data);

            if (chunk.Data.Length < maxChunk)
            {
                return new TransparentReadResult(output.ToArray(), false, endStatusWord, endStatusMeaning);
            }
        }

        return new TransparentReadResult(output.ToArray(), true, endStatusWord, endStatusMeaning);
    }

    private static ApduDataResult FindLargestReadableChunk(IntPtr card, uint activeProtocol, int offset, int maxLength)
    {
        ApduDataResult? best = null;
        ApduDataResult? lastFailure = null;
        var low = 1;
        var high = maxLength;

        while (low <= high)
        {
            var length = (low + high) / 2;
            var command = BuildReadBinaryCommand(offset, length);
            var result = TransmitForData(card, activeProtocol, $"read_binary_offset_{offset}_length_{length}", command);
            if (result.Success)
            {
                best = result;
                low = length + 1;
            }
            else
            {
                lastFailure = result;
                high = length - 1;
            }
        }

        return best ?? lastFailure ?? new ApduDataResult(false, [], "missing", "No readable chunk length was attempted.");
    }

    private static byte[] BuildReadBinaryCommand(int offset, int length) =>
    [
        0x00,
        0xB0,
        (byte)((offset >> 8) & 0x7F),
        (byte)(offset & 0xFF),
        (byte)length
    ];

    private static CardConnection ConnectFirstAvailableCard()
    {
        if (!OperatingSystem.IsWindows())
        {
            return CardConnection.Failed("pcsc_unavailable", "Windows smart-card APIs are not available on this OS.");
        }

        var establishResult = SCardEstablishContext(ScardScopeSystem, IntPtr.Zero, IntPtr.Zero, out var context);
        if (establishResult != ScardSuccess)
        {
            return CardConnection.Failed("pcsc_context_failed", $"Could not open Windows smart-card context: 0x{establishResult:X8}.");
        }

        var readers = ListReaders(context);
        if (readers.Length == 0)
        {
            SCardReleaseContext(context);
            return CardConnection.Failed("reader_not_found", "No Windows smart-card readers were detected.");
        }

        foreach (var reader in readers)
        {
            var connectResult = SCardConnect(
                context,
                reader,
                ScardShareShared,
                ScardProtocolT0 | ScardProtocolT1,
                out var card,
                out var activeProtocol);

            if (connectResult == ScardSuccess)
            {
                return new CardConnection(context, card, activeProtocol, reader, null, "Connected to inserted card.");
            }
        }

        SCardReleaseContext(context);
        return CardConnection.Failed("card_not_connected", "No inserted card could be opened through PC/SC.");
    }

    private static ApduProbeResult Transmit(IntPtr card, uint activeProtocol, string name, byte[] command)
    {
        if (!TryValidateReadOnlyApdu(command, out var blockReason))
        {
            return new ApduProbeResult(
                name,
                ToHex(command),
                null,
                0,
                "blocked_by_read_only_guard",
                blockReason,
                false);
        }

        var initial = TransmitOnce(card, activeProtocol, name, command);
        if (initial.PcscError is not null || initial.RawResponse.Length < 2)
        {
            return initial.ToProbeResult();
        }

        var sw1 = initial.RawResponse[^2];
        var sw2 = initial.RawResponse[^1];

        if (sw1 == 0x61)
        {
            var le = sw2 == 0x00 ? (byte)0x00 : sw2;
            var followUpCommand = new byte[] { 0x00, 0xC0, 0x00, 0x00, le };
            if (!TryValidateReadOnlyApdu(followUpCommand, out var followUpBlockReason))
            {
                return new ApduProbeResult(
                    $"{name}_get_response",
                    ToHex(followUpCommand),
                    null,
                    0,
                    "blocked_by_read_only_guard",
                    followUpBlockReason,
                    false);
            }

            var followUp = TransmitOnce(card, activeProtocol, $"{name}_get_response", followUpCommand);
            return CombineFollowUp(initial, followUp);
        }

        if (sw1 == 0x6C && command.Length > 4)
        {
            var corrected = command.ToArray();
            corrected[^1] = sw2;
            if (!TryValidateReadOnlyApdu(corrected, out var correctedBlockReason))
            {
                return new ApduProbeResult(
                    $"{name}_correct_length",
                    ToHex(corrected),
                    null,
                    0,
                    "blocked_by_read_only_guard",
                    correctedBlockReason,
                    false);
            }

            var followUp = TransmitOnce(card, activeProtocol, $"{name}_correct_length", corrected);
            return CombineFollowUp(initial, followUp);
        }

        return initial.ToProbeResult();
    }

    private static ApduDataResult TransmitForData(IntPtr card, uint activeProtocol, string name, byte[] command)
    {
        if (!TryValidateReadOnlyApdu(command, out var blockReason))
        {
            return new ApduDataResult(false, [], "blocked_by_read_only_guard", blockReason);
        }

        var initial = TransmitOnce(card, activeProtocol, name, command);
        if (initial.PcscError is not null)
        {
            return new ApduDataResult(false, [], initial.PcscError, "PC/SC transmit failed.");
        }

        if (initial.RawResponse.Length < 2)
        {
            return new ApduDataResult(false, initial.RawResponse, "missing", "Card response did not include a status word.");
        }

        var sw1 = initial.RawResponse[^2];
        var sw2 = initial.RawResponse[^1];
        if (sw1 == 0x6C && command.Length > 4)
        {
            var corrected = command.ToArray();
            corrected[^1] = sw2;
            if (!TryValidateReadOnlyApdu(corrected, out var correctedBlockReason))
            {
                return new ApduDataResult(false, [], "blocked_by_read_only_guard", correctedBlockReason);
            }

            return ExchangeToDataResult(TransmitOnce(card, activeProtocol, $"{name}_correct_length", corrected));
        }

        if (sw1 == 0x61)
        {
            var le = sw2 == 0x00 ? (byte)0x00 : sw2;
            var followUpCommand = new byte[] { 0x00, 0xC0, 0x00, 0x00, le };
            if (!TryValidateReadOnlyApdu(followUpCommand, out var followUpBlockReason))
            {
                return new ApduDataResult(false, [], "blocked_by_read_only_guard", followUpBlockReason);
            }

            return ExchangeToDataResult(TransmitOnce(card, activeProtocol, $"{name}_get_response", followUpCommand));
        }

        return ExchangeToDataResult(initial);
    }

    private static ApduDataResult ExchangeToDataResult(ApduExchange exchange)
    {
        if (exchange.PcscError is not null)
        {
            return new ApduDataResult(false, [], exchange.PcscError, "PC/SC transmit failed.");
        }

        if (exchange.RawResponse.Length < 2)
        {
            return new ApduDataResult(false, exchange.RawResponse, "missing", "Card response did not include a status word.");
        }

        var sw1 = exchange.RawResponse[^2];
        var sw2 = exchange.RawResponse[^1];
        var data = exchange.RawResponse[..^2];
        var statusWord = $"{sw1:X2}{sw2:X2}";
        return new ApduDataResult(statusWord == "9000", data, statusWord, StatusMeaning(sw1, sw2));
    }

    private static ApduExchange TransmitOnce(IntPtr card, uint activeProtocol, string name, byte[] command)
    {
        if (!TryValidateReadOnlyApdu(command, out var blockReason))
        {
            return new ApduExchange(name, command, [], $"blocked_by_read_only_guard:{blockReason}");
        }

        var sendPci = new ScardIoRequest
        {
            Protocol = activeProtocol,
            PciLength = 8
        };
        var recvPci = new ScardIoRequest
        {
            Protocol = activeProtocol,
            PciLength = 8
        };
        var response = new byte[258];
        var responseLength = response.Length;
        var result = SCardTransmit(card, ref sendPci, command, command.Length, ref recvPci, response, ref responseLength);
        if (result != ScardSuccess)
        {
            return new ApduExchange(
                name,
                command,
                [],
                $"pcsc_error_0x{result:X8}");
        }

        var actual = response.Take(responseLength).ToArray();
        return new ApduExchange(name, command, actual, null);
    }

    private static bool TryValidateReadOnlyApdu(byte[] command, out string blockReason)
    {
        if (command.Length < 4)
        {
            blockReason = "APDU must include at least CLA, INS, P1, and P2.";
            return false;
        }

        var cla = command[0];
        var ins = command[1];
        var p1 = command[2];
        var p2 = command[3];

        if (cla != 0x00)
        {
            blockReason = $"APDU CLA 0x{cla:X2} is not in the read-only diagnostics allowlist.";
            return false;
        }

        switch (ins)
        {
            case 0xA4:
                if (p1 is 0x00 or 0x02 or 0x04 or 0x08 && p2 is 0x00 or 0x04 or 0x0C)
                {
                    blockReason = string.Empty;
                    return true;
                }

                blockReason = $"SELECT FILE parameters P1=0x{p1:X2}, P2=0x{p2:X2} are outside the read-only allowlist.";
                return false;

            case 0xB0:
                blockReason = string.Empty;
                return true;

            case 0xB2:
                blockReason = string.Empty;
                return true;

            case 0xC0:
                blockReason = string.Empty;
                return true;

            case 0xCA:
                blockReason = string.Empty;
                return true;

            default:
                blockReason = $"APDU INS 0x{ins:X2} is blocked. The helper only allows SELECT, READ BINARY, READ RECORD, GET RESPONSE, and GET DATA.";
                return false;
        }
    }

    private static ApduProbeResult CombineFollowUp(ApduExchange initial, ApduExchange followUp)
    {
        if (followUp.PcscError is not null || followUp.RawResponse.Length < 2)
        {
            return followUp.ToProbeResult($"{initial.StatusWord} then {followUp.StatusWord}");
        }

        return followUp.ToProbeResult($"{initial.StatusWord} then {followUp.StatusWord}");
    }

    private sealed record ApduExchange(string Name, byte[] CommandBytes, byte[] RawResponse, string? PcscError)
    {
        public string StatusWord
        {
            get
            {
                if (PcscError is not null) return PcscError;
                if (RawResponse.Length < 2) return "missing";
                return $"{RawResponse[^2]:X2}{RawResponse[^1]:X2}";
            }
        }

        public ApduProbeResult ToProbeResult(string? statusOverride = null)
        {
            if (PcscError is not null)
            {
                return new ApduProbeResult(
                    Name,
                    ToHex(CommandBytes),
                    null,
                    0,
                    statusOverride ?? PcscError,
                    "PC/SC transmit failed.",
                    false);
            }

            if (RawResponse.Length < 2)
            {
                return new ApduProbeResult(
                    Name,
                    ToHex(CommandBytes),
                    ToHex(RawResponse),
                    RawResponse.Length,
                    statusOverride ?? "missing",
                    "Card response did not include a status word.",
                    false);
            }

            var sw1 = RawResponse[^2];
            var sw2 = RawResponse[^1];
            var data = RawResponse[..^2];
            var statusWord = $"{sw1:X2}{sw2:X2}";
            var finalStatus = statusOverride ?? statusWord;
            return new ApduProbeResult(
                Name,
                ToHex(CommandBytes),
                data.Length == 0 ? null : ToHex(data.Take(32).ToArray()),
                data.Length,
                finalStatus,
                StatusMeaning(sw1, sw2),
                statusWord is "9000" || sw1 == 0x61);
        }
    }

    private sealed record TachographFileCandidate(string FileId, string Name, byte HighByte, byte LowByte);

    private sealed record TachographCaptureFileRecord(
        string FileId,
        string Name,
        bool Selected,
        bool ReadSuccess,
        int BytesRead,
        bool Truncated,
        string? Sha256,
        string? StatusWord,
        string? StatusMeaning,
        string? DataBase64);

    private sealed record TransparentReadResult(byte[] Bytes, bool Truncated, string? EndStatusWord, string? EndStatusMeaning);

    private sealed record ApduDataResult(bool Success, byte[] Data, string StatusWord, string StatusMeaning);

    private sealed class CardConnection : IDisposable
    {
        private readonly IntPtr context;
        private bool disposed;

        private CardConnection(string error, string detail)
        {
            context = IntPtr.Zero;
            Card = IntPtr.Zero;
            ActiveProtocol = 0;
            ReaderName = null;
            Error = error;
            Detail = detail;
        }

        public CardConnection(IntPtr context, IntPtr card, uint activeProtocol, string readerName, string? error, string detail)
        {
            this.context = context;
            Card = card;
            ActiveProtocol = activeProtocol;
            ReaderName = readerName;
            Error = error;
            Detail = detail;
        }

        public IntPtr Card { get; }
        public uint ActiveProtocol { get; }
        public string? ReaderName { get; }
        public string? Error { get; }
        public string Detail { get; }

        public static CardConnection Failed(string error, string detail) => new(error, detail);

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            if (Card != IntPtr.Zero)
            {
                SCardDisconnect(Card, ScardLeaveCard);
            }
            if (context != IntPtr.Zero)
            {
                SCardReleaseContext(context);
            }
        }
    }

    private static byte[] ReadAtr(IntPtr card)
    {
        var readerNameLength = 0;
        var atr = new byte[64];
        var atrLength = atr.Length;
        var result = SCardStatus(card, null, ref readerNameLength, out _, out _, atr, ref atrLength);
        if (result != ScardSuccess || atrLength <= 0)
        {
            return [];
        }

        return atr.Take(atrLength).ToArray();
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

    private static CardProbeResult Failure(string errorCode, string detail) =>
        new(false, null, null, null, errorCode, detail, []);

    private static string ProtocolName(uint protocol) =>
        protocol switch
        {
            ScardProtocolT0 => "T=0",
            ScardProtocolT1 => "T=1",
            ScardProtocolT0 | ScardProtocolT1 => "T=0/T=1",
            _ => $"0x{protocol:X}"
        };

    private static string StatusMeaning(byte sw1, byte sw2) =>
        (sw1, sw2) switch
        {
            (0x90, 0x00) => "Success",
            (0x61, _) => $"Success; {sw2} response bytes available",
            (0x62, _) => "Warning; non-volatile memory unchanged",
            (0x63, _) => "Warning; non-volatile memory changed",
            (0x67, 0x00) => "Wrong length",
            (0x69, 0x82) => "Security status not satisfied",
            (0x69, 0x85) => "Conditions of use not satisfied",
            (0x69, 0x86) => "Command not allowed",
            (0x6A, 0x81) => "Function not supported",
            (0x6A, 0x82) => "File or application not found",
            (0x6A, 0x84) => "Not enough memory space in file",
            (0x6A, 0x86) => "Incorrect P1/P2",
            (0x6A, 0x88) => "Referenced data not found",
            (0x6D, 0x00) => "Instruction code not supported",
            (0x6E, 0x00) => "Class not supported",
            (0x6F, 0x00) => "Card returned an unspecified error",
            _ => "Card returned status word"
        };

    private static byte[] ParseHex(string value)
    {
        var hex = new string(value.Where(Uri.IsHexDigit).ToArray());
        if (hex.Length == 0 || hex.Length % 2 != 0)
        {
            return [];
        }

        var bytes = new byte[hex.Length / 2];
        for (var index = 0; index < bytes.Length; index++)
        {
            bytes[index] = Convert.ToByte(hex.Substring(index * 2, 2), 16);
        }

        return bytes;
    }

    private static string ToHex(byte[] bytes) =>
        Convert.ToHexString(bytes).ToLowerInvariant();

    [DllImport("winscard.dll", EntryPoint = "SCardEstablishContext")]
    private static extern int SCardEstablishContext(int scope, IntPtr reserved1, IntPtr reserved2, out IntPtr context);

    [DllImport("winscard.dll", EntryPoint = "SCardReleaseContext")]
    private static extern int SCardReleaseContext(IntPtr context);

    [DllImport("winscard.dll", EntryPoint = "SCardListReadersW", CharSet = CharSet.Unicode)]
    private static extern int SCardListReaders(IntPtr context, string? groups, char[]? readers, ref int readersLength);

    [DllImport("winscard.dll", EntryPoint = "SCardConnectW", CharSet = CharSet.Unicode)]
    private static extern int SCardConnect(
        IntPtr context,
        string readerName,
        uint shareMode,
        uint preferredProtocols,
        out IntPtr card,
        out uint activeProtocol);

    [DllImport("winscard.dll", EntryPoint = "SCardDisconnect")]
    private static extern int SCardDisconnect(IntPtr card, uint disposition);

    [DllImport("winscard.dll", EntryPoint = "SCardStatusW", CharSet = CharSet.Unicode)]
    private static extern int SCardStatus(
        IntPtr card,
        System.Text.StringBuilder? readerName,
        ref int readerNameLength,
        out uint state,
        out uint protocol,
        byte[] atr,
        ref int atrLength);

    [DllImport("winscard.dll", EntryPoint = "SCardTransmit")]
    private static extern int SCardTransmit(
        IntPtr card,
        ref ScardIoRequest sendPci,
        byte[] sendBuffer,
        int sendLength,
        ref ScardIoRequest recvPci,
        byte[] recvBuffer,
        ref int recvLength);

    [StructLayout(LayoutKind.Sequential)]
    private struct ScardIoRequest
    {
        public uint Protocol;
        public uint PciLength;
    }
}

sealed record ExportResult(
    string FileName,
    byte[] Bytes,
    string Sha256,
    string? Format = null,
    bool ParserReady = true,
    string? Note = null);

sealed class ExportCommandMissingException(string message) : Exception(message);

static class ExternalCardExporter
{
    public static async Task<ExportResult> ExportAsync(string readSessionId, string sourceType, CancellationToken cancellationToken)
    {
        if (!HelperConstants.ExternalExporterEnabled)
        {
            throw new ExportCommandMissingException("External card exporters are disabled. The built-in helper path is read-only guarded; set TACHO_HELPER_ENABLE_EXTERNAL_EXPORTER=true only for a reviewed external exporter.");
        }

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
        return new ExportResult(Path.GetFileName(outputPath), bytes, sha256, "external_export", true, null);
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
    public const string Version = "dotnet-shell-0.5.8";
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

    public static bool RawApduDiagnosticsEnabled =>
        string.Equals(
            Environment.GetEnvironmentVariable("TACHO_HELPER_ENABLE_RAW_APDU"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    public static bool ExternalExporterEnabled =>
        string.Equals(
            Environment.GetEnvironmentVariable("TACHO_HELPER_ENABLE_EXTERNAL_EXPORTER"),
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

    public static int BuiltInExportMaxBytesPerFile =>
        int.TryParse(Environment.GetEnvironmentVariable("TACHO_HELPER_BUILTIN_EXPORT_MAX_BYTES_PER_FILE"), out var value) && value > 0
            ? Math.Clamp(value, 1024, 1024 * 1024)
            : 64 * 1024;

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
        RawApduDiagnosticsEnabled,
        VuWorkflowEnabled,
        ExternalExporterEnabled,
        exportCommandConfigured = !string.IsNullOrWhiteSpace(ExportCommand),
        exportArgumentsConfigured = !string.IsNullOrWhiteSpace(ExportArguments),
        ExportTimeoutSeconds,
        BuiltInExportMaxBytesPerFile,
        ExportOutputDirectory,
        LogDirectory
    };

    public static object ToCapabilities() => new
    {
        sourceTypes = VuWorkflowEnabled
            ? new[] { DriverCardSourceType, VehicleUnitSourceType }
            : new[] { DriverCardSourceType },
        diagnostics = new[] { "/diagnostics", "/diagnostics/logs", "/diagnostics/apdu-safety", "/diagnostics/card-probe", "/diagnostics/tachograph-file-map" },
        rawApduDiagnostics = RawApduDiagnosticsEnabled,
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
