import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Sequelize } from 'sequelize'
import { SequelizeStorage, Umzug } from 'umzug'
import { config } from '../config.js'
import { logger } from '../logger.js'

/**
 * Sequelize is here for the migrations only — queries go through the pg pool in
 * pool.ts — so it keeps a small pool of its own.
 */
export const sequelize = new Sequelize(config.DATABASE_URL, {
  logging: false,
  pool: { max: 2 },
})

// Migrations run as .ts under tsx in development and as compiled .js from dist
// in production, so the glob follows this module rather than the cwd.
const migrationsGlob = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
  import.meta.url.endsWith('.ts') ? '*.ts' : '*.js',
)

type MigrationContext = ReturnType<Sequelize['getQueryInterface']>

export type Migration = (params: {
  name: string
  path?: string
  context: MigrationContext
}) => Promise<unknown>

const umzug = new Umzug({
  migrations: {
    glob: migrationsGlob,
    // A migration is a .ts file under tsx and a .js file in dist. Recording the
    // bare name keeps both environments agreeing on what has already run.
    resolve: ({ name, path: file, context }) => {
      const load = async (): Promise<{ up: Migration; down?: Migration }> => {
        if (!file) throw new Error(`migration ${name} has no path`)
        return (await import(pathToFileURL(file).href)) as { up: Migration; down?: Migration }
      }
      return {
        name: path.basename(name, path.extname(name)),
        up: async () => (await load()).up({ name, path: file, context }),
        down: async () => (await load()).down?.({ name, path: file, context }),
      }
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger,
})

const runMigrations = async (): Promise<void> => {
  const applied = await umzug.up()
  logger.info({ applied: applied.map((m) => m.name) }, 'migrations up to date')
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const RETRY_DELAY_MS = 5_000
const MAX_ATTEMPTS = 12

/**
 * Waits for the database to come up, then migrates. The container starts
 * alongside postgres, so the first few attempts failing is normal — but it
 * gives up eventually instead of retrying forever, so a genuinely wrong
 * DATABASE_URL surfaces as a crash rather than a silent hang.
 */
export const connectToDatabase = async (attempt = 1): Promise<void> => {
  try {
    await sequelize.authenticate()
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) {
      logger.error({ err, attempt }, 'could not connect to the database, giving up')
      throw err
    }
    logger.warn({ attempt, retryInMs: RETRY_DELAY_MS }, 'database not reachable yet, retrying')
    await sleep(RETRY_DELAY_MS)
    return connectToDatabase(attempt + 1)
  }

  logger.info('connected to database')
  await runMigrations()
}

export const closeDatabase = async (): Promise<void> => {
  await sequelize.close()
}
