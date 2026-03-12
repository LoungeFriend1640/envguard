# envguard

Validate `.env` files against a schema. Catch missing or malformed variables before they crash production.

## Install

```bash
npm install envguard
```

## Quick Start

Generate a schema from your existing `.env`:

```bash
npx envguard --init > .env.schema.json
```

Validate your `.env`:

```bash
npx envguard
```

Or validate against `.env.example` directly:

```bash
npx envguard --example .env.example
```

## Schema Format

`.env.schema.json`:

```json
{
  "DATABASE_URL": {
    "required": true,
    "type": "url",
    "description": "PostgreSQL connection string"
  },
  "PORT": {
    "type": "port",
    "default": "3000"
  },
  "NODE_ENV": {
    "choices": ["development", "production", "test"]
  },
  "DEBUG": {
    "type": "boolean",
    "required": false
  }
}
```

## Supported Types

| Type | Validates |
|------|-----------|
| `string` | Any non-empty value |
| `number` | Parseable as a number |
| `boolean` | `true`, `false`, `1`, `0`, `yes`, `no` |
| `url` | Valid URL (parsed by `new URL()`) |
| `email` | Basic email format |
| `port` | Integer between 1 and 65535 |

## Programmatic Usage

```typescript
import { parseEnvFile, validate } from "envguard";
import { readFileSync } from "fs";

const env = parseEnvFile(readFileSync(".env", "utf-8"));
const schema = JSON.parse(readFileSync(".env.schema.json", "utf-8"));
const result = validate(env, schema);

if (!result.valid) {
  console.error("Missing:", result.missing);
  console.error("Errors:", result.errors);
  process.exit(1);
}
```

## CLI Options

```
envguard [options] [env-file]

  --schema <file>    Schema file (default: .env.schema.json)
  --example <file>   Infer schema from .env.example
  --init             Generate schema from current .env
  --strict           Treat warnings as errors
  --quiet            Only output errors
```

## License

MIT
