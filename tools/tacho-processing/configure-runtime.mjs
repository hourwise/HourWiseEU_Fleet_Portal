const args = process.argv.slice(2);

function parseArgs(inputArgs) {
  const options = {};

  for (let index = 0; index < inputArgs.length; index += 1) {
    const arg = inputArgs[index];

    if (arg === "--status") {
      options.status = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = inputArgs[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function parseBoolean(value, flagName) {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${flagName} must be true or false.`);
}

function resolveOption(options, key, envName) {
  return options[key] ?? process.env[envName];
}

function maskUrl(value) {
  if (!value) {
    return null;
  }

  return value;
}

async function main() {
  const options = parseArgs(args);
  const functionUrl = resolveOption(options, "function-url", "TACHO_RUNTIME_CONFIG_URL");
  const adminToken = resolveOption(options, "admin-token", "TACHO_RUNTIME_ADMIN_TOKEN");

  if (!functionUrl) {
    throw new Error("Missing --function-url or TACHO_RUNTIME_CONFIG_URL.");
  }

  if (!adminToken) {
    throw new Error("Missing --admin-token or TACHO_RUNTIME_ADMIN_TOKEN.");
  }

  const headers = {
    "Content-Type": "application/json",
    "x-tacho-runtime-admin-token": adminToken,
  };

  if (options.status) {
    const response = await fetch(functionUrl, { method: "GET", headers });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? `Runtime status request failed with ${response.status}.`);
    }

    console.log(JSON.stringify(body.runtime, null, 2));
    return;
  }

  const patch = {};
  const triggerEnabled = parseBoolean(resolveOption(options, "enable", "TACHO_RUNTIME_TRIGGER_ENABLED"), "--enable");
  const processTachoUrl = resolveOption(options, "process-url", "TACHO_PROCESS_TACHO_URL");
  const triggerToken = resolveOption(options, "trigger-token", "PROCESS_TACHO_TRIGGER_TOKEN");

  if (triggerEnabled !== undefined) {
    patch.triggerEnabled = triggerEnabled;
  }

  if (processTachoUrl !== undefined) {
    patch.processTachoUrl = processTachoUrl;
  }

  if (triggerToken !== undefined) {
    patch.triggerToken = triggerToken;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error(
      "Nothing to update. Provide --enable, --process-url, or --trigger-token, or use --status."
    );
  }

  const response = await fetch(functionUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(patch),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? `Runtime update failed with ${response.status}.`);
  }

  console.log(JSON.stringify({
    ...body.runtime,
    processTachoUrl: maskUrl(body.runtime?.processTachoUrl),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
