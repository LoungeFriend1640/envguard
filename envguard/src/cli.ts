#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnvFile, validate, inferSchema, type Schema } from "./index.js";

const args = process.argv.slice(2);

function usage(): never {
  console.log(`envguard - Validate .env files against a schema

Usage:
  envguard [options] [env-file]

Options:
  --schema <file>    Schema file (JSON). Default: .env.schema.json
  --example <file>   Infer schema from .env.example instead
  --init             Generate schema from current .env file
  --strict           Treat warnings as errors
  --quiet            Only output errors
  -h, --help         Show this help

Examples:
  envguard                          # validate .env against .env.schema.json
  envguard --example .env.example   # validate .env against .env.example
  envguard --init > .env.schema.json  # generate schema from .env
  envguard staging.env --strict     # validate specific file, strict mode`);
  process.exit(0);
}

if (args.includes("-h") || args.includes("--help")) usage();

const strict = args.includes("--strict");
const quiet = args.includes("--quiet");
const init = args.includes("--init");

function findArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const schemaPath = findArg("--schema");
const examplePath = findArg("--example");
const envFile = args.find((a) => !a.startsWith("-") && a !== schemaPath && a !== examplePath) ?? ".env";

// --init mode: generate schema from .env
if (init) {
  const envPath = resolve(envFile);
  if (!existsSync(envPath)) {
    console.error(`Error: ${envFile} not found`);
    process.exit(1);
  }
  const schema = inferSchema(readFileSync(envPath, "utf-8"));
  console.log(JSON.stringify(schema, null, 2));
  process.exit(0);
}

// Load env file
const envPath = resolve(envFile);
if (!existsSync(envPath)) {
  console.error(`Error: ${envFile} not found`);
  process.exit(1);
}
const env = parseEnvFile(readFileSync(envPath, "utf-8"));

// Load or infer schema
let schema: Schema;

if (examplePath) {
  const exPath = resolve(examplePath);
  if (!existsSync(exPath)) {
    console.error(`Error: ${examplePath} not found`);
    process.exit(1);
  }
  schema = inferSchema(readFileSync(exPath, "utf-8"));
} else {
  const sPath = resolve(schemaPath ?? ".env.schema.json");
  if (!existsSync(sPath)) {
    console.error(`Error: No schema found. Create .env.schema.json or use --example .env.example`);
    process.exit(1);
  }
  schema = JSON.parse(readFileSync(sPath, "utf-8"));
}

// Validate
const result = validate(env, schema);

if (!quiet) {
  if (result.extra.length > 0) {
    console.log(`\x1b[33m⚠ Extra vars not in schema: ${result.extra.join(", ")}\x1b[0m`);
  }

  for (const w of result.warnings) {
    console.log(`\x1b[33m⚠ ${w.key}: ${w.message}\x1b[0m`);
  }
}

for (const e of result.errors) {
  console.error(`\x1b[31m✗ ${e.key}: ${e.message}\x1b[0m`);
}

if (result.valid && !(strict && result.warnings.length > 0)) {
  if (!quiet) {
    console.log(`\x1b[32m✓ ${envFile} is valid (${Object.keys(env).length} vars checked)\x1b[0m`);
  }
  process.exit(0);
} else {
  const total = result.errors.length + (strict ? result.warnings.length : 0);
  console.error(`\x1b[31m✗ ${total} issue${total !== 1 ? "s" : ""} found\x1b[0m`);
  process.exit(1);
}
