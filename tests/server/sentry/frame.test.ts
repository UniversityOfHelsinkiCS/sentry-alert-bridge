import { describe, expect, it } from 'vitest'
import { topFrame } from '../../../src/server/sentry/frame.js'
import { apiEventSchema } from '../../../src/server/sentry/types.js'

function event(payload: unknown) {
  const parsed = apiEventSchema.safeParse(payload)
  return parsed.success ? parsed.data : null
}

function exceptionEvent(frames: unknown[]) {
  return event({
    entries: [{ type: 'exception', data: { values: [{ stacktrace: { frames } }] } }],
  })
}

describe('topFrame', () => {
  it('picks the deepest in-app frame and renders path, line, column and function', () => {
    const parsed = exceptionEvent([
      { absPath: '/opt/app-root/src/node_modules/express/lib/router.js', lineNo: 1, inApp: false },
      { absPath: '/opt/app-root/src/src/server/updater/index.ts', lineNo: 9, colNo: 3, function: 'run', inApp: true },
      { absPath: '/opt/app-root/src/src/server/updater/util.ts', lineNo: 27, colNo: 20, function: 'safeBulkCreate', inApp: true },
      { absPath: '/opt/app-root/src/node_modules/sequelize/lib/model.js', lineNo: 77, inApp: false },
    ])

    expect(topFrame(parsed)).toBe(
      '/opt/app-root/src/src/server/updater/util.ts:27:20 in safeBulkCreate',
    )
  })

  it('falls back to the deepest frame when nothing is marked in-app', () => {
    const parsed = exceptionEvent([
      { filename: 'a.js', lineNo: 1 },
      { filename: 'b.js', lineNo: 2, function: 'boom' },
    ])
    expect(topFrame(parsed)).toBe('b.js:2 in boom')
  })

  it('prefers absPath, then filename, then module', () => {
    expect(topFrame(exceptionEvent([{ module: 'app.updater.util', lineNo: 4 }]))).toBe(
      'app.updater.util:4',
    )
  })

  it('omits the column when only a line number is known', () => {
    expect(topFrame(exceptionEvent([{ filename: 'a.ts', lineNo: 5 }]))).toBe('a.ts:5')
  })

  it('uses the last raised exception when an error is chained', () => {
    const parsed = event({
      entries: [
        {
          type: 'exception',
          data: {
            values: [
              { stacktrace: { frames: [{ filename: 'outer.ts', lineNo: 1 }] } },
              { stacktrace: { frames: [{ filename: 'inner.ts', lineNo: 2 }] } },
            ],
          },
        },
      ],
    })
    expect(topFrame(parsed)).toBe('inner.ts:2')
  })

  it('returns null for a message-only event', () => {
    expect(topFrame(event({ entries: [{ type: 'message', data: { formatted: 'hi' } }] }))).toBeNull()
  })

  it('returns null rather than throwing on empty, missing or malformed payloads', () => {
    expect(topFrame(null)).toBeNull()
    expect(topFrame(event({}))).toBeNull()
    expect(topFrame(event({ entries: [] }))).toBeNull()
    expect(topFrame(event({ entries: [{ type: 'exception', data: 'nonsense' }] }))).toBeNull()
    expect(topFrame(exceptionEvent([]))).toBeNull()
    expect(topFrame(exceptionEvent([{ function: 'anonymous' }]))).toBeNull()
  })
})
