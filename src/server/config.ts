import 'dotenv/config'
import { z } from 'zod'
import type { IngestMode } from '../shared/types.js'

/**
 * The only module in the app that reads process.env. Everything else imports
 * `config`. Adding an env var means adding a line here and to .env.example.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  TZ: z.string().default('Europe/Helsinki'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  SENTRY_BASE_URL: z.string().url().default('https://toska.it.helsinki.fi'),
  SENTRY_ORG_SLUG: z.string().min(1).default('sentry'),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  SENTRY_CLIENT_SECRET: z.string().min(1).optional(),
  POLL_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(5),
  INGEST_MODE_DEFAULT: z.enum(['webhook', 'polling']).default('polling'),

  ACCESS_TOKEN: z
    .string()
    .min(32, 'ACCESS_TOKEN must be at least 32 characters (openssl rand -hex 32)'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters (openssl rand -hex 32)'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24),

  GIT_SHA: z.string().optional(),
  IMAGE_SHA: z.string().optional(),
  RELEASE_VERSION: z.string().optional(),
  STAGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

type Env = z.infer<typeof schema>

export interface Config extends Env {
  isProduction: boolean
  pollIntervalMs: number
}

/**
 * A blank line in .env ("STAGING=") arrives as an empty string, which is not
 * the same as unset to zod — it would fail an enum or a min(1) instead of
 * falling back to the default. Copying .env.example is the normal way to start,
 * so empty means "not set" here.
 */
function withoutBlanks(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => {
      const value = entry[1]
      return typeof value === 'string' && value.trim() !== ''
    }),
  )
}

function parse(): Config {
  const parsed = schema.safeParse(withoutBlanks(process.env))
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment:\n${lines.join('\n')}`)
  }

  const env = parsed.data

  // The default mode must be usable, otherwise the app boots into a mode it
  // cannot run. Non-default modes are checked when they are switched on.
  const missing = missingVarsFor(env.INGEST_MODE_DEFAULT, env)
  if (missing.length > 0) {
    throw new Error(
      `Invalid environment:\n  INGEST_MODE_DEFAULT=${env.INGEST_MODE_DEFAULT} requires ${missing.join(', ')}`,
    )
  }

  return {
    ...env,
    isProduction: env.NODE_ENV === 'production',
    pollIntervalMs: env.POLL_INTERVAL_MINUTES * 60_000,
  }
}

/** Which env vars a given ingest mode needs but does not have. */
export function missingVarsFor(
  mode: IngestMode,
  env: Pick<Env, 'SENTRY_AUTH_TOKEN' | 'SENTRY_CLIENT_SECRET'> = config,
): string[] {
  if (mode === 'polling') return env.SENTRY_AUTH_TOKEN ? [] : ['SENTRY_AUTH_TOKEN']
  return env.SENTRY_CLIENT_SECRET ? [] : ['SENTRY_CLIENT_SECRET']
}

export const config: Config = Object.freeze(parse())
