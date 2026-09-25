import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '../logger.js'
import { pool } from './pool.js'

// dist/server/db/migrate.js and src/server/db/migrate.ts are both three levels
// below the directory that holds migrations/.
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
)

export async function migrate(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query(`
      create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

    const { rows } = await client.query<{ name: string }>('select name from schema_migrations')
    const applied = new Set(rows.map((r) => r.name))

    for (const file of files) {
      if (applied.has(file)) continue

      const sql = await readFile(path.join(migrationsDir, file), 'utf8')
      logger.info({ migration: file }, 'applying migration')

      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('insert into schema_migrations (name) values ($1)', [file])
        await client.query('commit')
      } catch (err) {
        await client.query('rollback')
        throw err
      }
    }
  } finally {
    client.release()
  }
}
