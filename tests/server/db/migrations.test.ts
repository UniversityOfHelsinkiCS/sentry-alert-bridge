import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../src/server/db/migrations/', import.meta.url),
)

const ALLOWED_SPECIFIERS = ['sequelize', '../connection.js']

const IMPORT_SPECIFIER = /(?:^|\n)\s*import\s[^'"]*from\s*['"]([^'"]+)['"]/g

function importsOf(file: string): string[] {
  const source = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
  return [...source.matchAll(IMPORT_SPECIFIER)].map((match) => match[1] as string)
}

describe('migrations are self standing', () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.ts'))

  it('finds the migration files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s imports nothing from the app', (file) => {
    expect(importsOf(file).filter((s) => !ALLOWED_SPECIFIERS.includes(s))).toEqual([])
  })

  it.each(files)('%s does not use an ORM model', (file) => {
    const source = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    expect(source).not.toMatch(/\bfrom '\.\.\/model/)
  })
})
