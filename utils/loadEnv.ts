const fs = require('fs');
const path = require('path');

function parseEnvFile(contents) {
  const values: Record<string, string> = {};
  for (const rawLine of String(contents || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value.replace(/\\n/g, '\n');
  }
  return values;
}

function loadEnv(filePath = path.resolve(process.cwd(), '.env')) {
  try {
    // dotenv remains the preferred parser when dependencies are installed.
    require('dotenv').config({ path: filePath });
    return { source: 'dotenv', loaded: true };
  } catch (error) {
    // Some game-server panels start index.ts directly before installing
    // package dependencies. Keep startup readable instead of crashing with a
    // misleading "Cannot find module dotenv" error.
    const missingDotenv =
      error?.code === 'MODULE_NOT_FOUND' &&
      String(error?.message || '').includes("'dotenv'");
    if (!missingDotenv) throw error;
  }

  if (!fs.existsSync(filePath)) return { source: 'fallback', loaded: false };

  const values = parseEnvFile(fs.readFileSync(filePath, 'utf8'));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return { source: 'fallback', loaded: Object.keys(values).length > 0 };
}

module.exports = { loadEnv };