const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const ALLOWED_KEYS = [
  "OWNER_EMAIL",
  "BIRTHDAY_CALENDAR_ID",
  "BIRTHDAY_CALENDAR_NAME",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "TIME_ZONE",
  "DRAFT_SUBJECT_PREFIX",
  "SUMMARY_SUBJECT_PREFIX"
];

function parseDotEnv(text) {
  const values = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function readEnvValues() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Missing .env file at ${ENV_PATH}`);
  }

  const parsed = parseDotEnv(fs.readFileSync(ENV_PATH, "utf8"));
  const properties = {};

  for (const key of ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      properties[key] = parsed[key];
    }
  }

  if (Object.keys(properties).length === 0) {
    throw new Error("No supported Script Properties were found in .env");
  }

  return properties;
}

function runClasp(args) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd.exe" : "npx";
  const commandArgs = isWindows
    ? ["/d", "/s", "/c", "npx.cmd", "clasp"].concat(args)
    : ["clasp"].concat(args);
  const result = spawnSync(command, commandArgs, {
    cwd: PROJECT_ROOT,
    encoding: "utf8"
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const apiExecutableError =
    result.stderr &&
    result.stderr.includes("deployed as API executable");

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0 || apiExecutableError) {
    if (apiExecutableError) {
      console.error(
        [
          "Apps Script remote execution is not enabled for this project.",
          "Open the Apps Script editor, then go to Deploy > Test deployments,",
          "enable deployment types, and enable API Executable once.",
          "After that, rerun `npm.cmd run sync:props`."
        ].join("\n")
      );
    }
    process.exit(result.status || 1);
  }
}

function main() {
  const properties = readEnvValues();
  const propertyKeys = Object.keys(properties);

  console.log(`Syncing Script Properties: ${propertyKeys.join(", ")}`);
  runClasp(["push"]);
  runClasp([
    "run",
    "syncScriptProperties",
    "--params",
    JSON.stringify([properties])
  ]);
}

main();
