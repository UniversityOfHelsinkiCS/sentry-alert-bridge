export interface RecapMatchInput {
  title: string
  culprit?: string | null
}

export interface RecapPattern {
  source: string
  regex: RegExp
}

export function compilePatterns(patterns: string[] | null | undefined): RecapPattern[] {
  if (!Array.isArray(patterns)) return []

  const compiled: RecapPattern[] = []

  for (const source of patterns) {
    try {
      compiled.push({ source, regex: new RegExp(source, 'i') })
    } catch {
      continue
    }
  }

  return compiled
}

export function matchRecap(issue: RecapMatchInput, patterns: RecapPattern[]): string | null {
  for (const pattern of patterns) {
    if (pattern.regex.test(issue.title)) return pattern.source
    if (issue.culprit && pattern.regex.test(issue.culprit)) return pattern.source
  }

  return null
}
