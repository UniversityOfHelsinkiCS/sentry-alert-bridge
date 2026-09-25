import 'dotenv/config'
import { z } from 'zod'

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
  // Polling is the only way issues reach the app, so without this there is
  // nothing the app can do.
  SENTRY_AUTH_TOKEN: z.string().min(1, 'SENTRY_AUTH_TOKEN is required'),
  POLL_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(5),

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

  return {
    ...env,
    isProduction: env.NODE_ENV === 'production',
    pollIntervalMs: env.POLL_INTERVAL_MINUTES * 60_000,
  }
}

export const config: Config = Object.freeze(parse())
