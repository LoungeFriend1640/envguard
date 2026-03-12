export type Rule = {
  required?: boolean;
  type?: "string" | "number" | "boolean" | "url" | "email" | "port";
  pattern?: RegExp;
  default?: string;
  choices?: string[];
  description?: string;
};

export type Schema = Record<string, Rule>;

export type ValidationError = {
  key: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  missing: string[];
  extra: string[];
};

const TYPE_VALIDATORS: Record<string, (v: string) => boolean> = {
  string: () => true,
  number: (v) => !isNaN(Number(v)) && v.trim() !== "",
  boolean: (v) => ["true", "false", "1", "0", "yes", "no"].includes(v.toLowerCase()),
  url: (v) => {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  },
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  port: (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 65535;
  },
};

export function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

export function validate(
  env: Record<string, string>,
  schema: Schema
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const missing: string[] = [];

  const schemaKeys = new Set(Object.keys(schema));
  const envKeys = new Set(Object.keys(env));
  const extra = [...envKeys].filter((k) => !schemaKeys.has(k));

  for (const [key, rule] of Object.entries(schema)) {
    const value = env[key];

    if (value === undefined || value === "") {
      if (rule.required !== false) {
        missing.push(key);
        errors.push({
          key,
          message: `Missing required variable${rule.description ? ` (${rule.description})` : ""}`,
          severity: "error",
        });
      } else if (rule.default === undefined) {
        warnings.push({
          key,
          message: "Optional variable not set and no default provided",
          severity: "warning",
        });
      }
      continue;
    }

    if (rule.type && rule.type in TYPE_VALIDATORS) {
      if (!TYPE_VALIDATORS[rule.type](value)) {
        errors.push({
          key,
          message: `Expected type "${rule.type}", got "${value}"`,
          severity: "error",
        });
      }
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push({
        key,
        message: `Value "${value}" does not match pattern ${rule.pattern}`,
        severity: "error",
      });
    }

    if (rule.choices && !rule.choices.includes(value)) {
      errors.push({
        key,
        message: `Value "${value}" not in allowed choices: ${rule.choices.join(", ")}`,
        severity: "error",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missing,
    extra,
  };
}

export function inferSchema(envContent: string): Schema {
  const vars = parseEnvFile(envContent);
  const schema: Schema = {};

  for (const [key, value] of Object.entries(vars)) {
    const rule: Rule = { required: true };

    if (TYPE_VALIDATORS.port(value) && /port/i.test(key)) {
      rule.type = "port";
    } else if (TYPE_VALIDATORS.url(value)) {
      rule.type = "url";
    } else if (TYPE_VALIDATORS.email(value)) {
      rule.type = "email";
    } else if (TYPE_VALIDATORS.boolean(value) && /^(enable|disable|debug|verbose|use_)/i.test(key)) {
      rule.type = "boolean";
    } else if (TYPE_VALIDATORS.number(value)) {
      rule.type = "number";
    }

    schema[key] = rule;
  }

  return schema;
}
