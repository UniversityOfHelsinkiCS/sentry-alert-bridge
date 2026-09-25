import pg from 'pg'
import { config } from '../config.js'
import { logger } from '../logger.js'

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
})

pool.on('error', (err) => {
  logger.error({ err }, 'idle postgres client errored')
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never)
}
