import { describe, expect, it } from 'vitest'
import { hintFor } from './urlHint.js'

const URL = ['https://example.invalid', 'part-a', 'part-b', 'secretvalue5678'].join('/')

describe('hintFor', () => {
  it('keeps the ids but masks the secret', () => {
    const hint = hintFor(URL)
    expect(hint).toBe('part-a/part-b/…5678')
    expect(hint).not.toContain('secretvalue')
  })

  it('masks a short secret entirely', () => {
    expect(hintFor('https://example.invalid/a/b/xy')).toBe('a/b/…')
  })
})
