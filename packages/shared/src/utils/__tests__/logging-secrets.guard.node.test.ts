import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard for audit finding "secrets and proof material are logged".
 * It scans the highest-risk source files and fails if a logger call passes a
 * known-sensitive identifier as an argument. String literals are stripped first
 * so log *messages* mentioning these words don't trip it — only values do.
 *
 * Extend GUARDED_FILES as new secret-handling modules are added.
 */
const GUARDED_FILES = [
  '../../services/keeperService.ts',
  '../../stores/deviceStore/actions/proofHelpers.ts',
]

const SENSITIVE_IDENTIFIERS = [
  'pin',
  'hashedSecretKey',
  'secretKey',
  'privateKey',
  'private_key',
  'mnemonic',
  'seed',
  'zkProof',
  'userSignature',
  'msgBytes',
]

// Replace string/template literals with empty placeholders so we only inspect
// the *code* passed to the logger, not human-readable message text.
function stripStringLiterals(source: string): string {
  return source
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

// Extract the argument text of every log.{debug,info,warn,error}(...) call,
// handling multi-line calls via balanced-parenthesis matching.
function extractLoggerCallArgs(strippedSource: string): string[] {
  const calls: string[] = []
  const opener = /\blog\.(?:debug|info|warn|error)\(/g
  let match: RegExpExecArray | null = opener.exec(strippedSource)
  while (match !== null) {
    let depth = 1
    let i = match.index + match[0].length
    const start = i
    while (i < strippedSource.length && depth > 0) {
      const ch = strippedSource[i]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      i++
    }
    calls.push(strippedSource.slice(start, i - 1))
    opener.lastIndex = i
    match = opener.exec(strippedSource)
  }
  return calls
}

describe('logging does not leak secrets', () => {
  for (const relativePath of GUARDED_FILES) {
    it(`passes no sensitive identifier to the logger in ${relativePath}`, () => {
      const source = readFileSync(
        fileURLToPath(new URL(relativePath, import.meta.url)),
        'utf-8',
      )
      const callArgs = extractLoggerCallArgs(stripStringLiterals(source))

      const offenders = callArgs.filter((args) =>
        SENSITIVE_IDENTIFIERS.some((id) =>
          new RegExp(`\\b${id}\\b`).test(args),
        ),
      )

      expect(offenders).toEqual([])
    })
  }
})
