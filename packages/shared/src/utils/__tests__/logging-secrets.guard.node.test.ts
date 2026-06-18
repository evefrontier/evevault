import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SENSITIVE_FIELDS } from '../redact'

/**
 * Regression guard for audit finding "secrets and proof material are logged".
 * It scans the highest-risk source files and fails if a logger call passes a
 * known-sensitive identifier as an argument. Literal text is ignored so log
 * *messages* mentioning these words don't trip it — only values do.
 *
 * The sensitive-identifier list is SENSITIVE_FIELDS from redact.ts, so this
 * guard and the runtime redactor can never drift apart.
 *
 * Extend GUARDED_FILES as new secret-handling modules are added.
 */
const GUARDED_FILES = [
  '../../services/keeperService.ts',
  '../../stores/deviceStore/actions/proofHelpers.ts',
]

const LOGGER_METHODS = new Set(['debug', 'info', 'warn', 'error'])
const SENSITIVE_IDENTIFIER_SET = SENSITIVE_FIELDS

function findSensitiveLoggerArgs(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    'guarded-source.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  )
  const offenders: string[] = []

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isLoggerCall(node)) {
      for (const argument of node.arguments) {
        const identifier = findSensitiveIdentifier(argument)
        if (identifier) {
          offenders.push(`${identifier}: ${argument.getText(sourceFile)}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return offenders
}

function isLoggerCall(node: ts.CallExpression): boolean {
  const { expression } = node
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'log' &&
    LOGGER_METHODS.has(expression.name.text)
  )
}

function findSensitiveIdentifier(node: ts.Node): string | undefined {
  if (ts.isStringLiteralLike(node)) {
    return undefined
  }
  if (ts.isIdentifier(node) && SENSITIVE_IDENTIFIER_SET.has(node.text)) {
    return node.text
  }

  return ts.forEachChild(node, findSensitiveIdentifier)
}

describe('logging does not leak secrets', () => {
  for (const relativePath of GUARDED_FILES) {
    it(`passes no sensitive identifier to the logger in ${relativePath}`, () => {
      const source = readFileSync(
        fileURLToPath(new URL(relativePath, import.meta.url)),
        'utf-8',
      )
      const offenders = findSensitiveLoggerArgs(source)

      expect(offenders).toEqual([])
    })
  }
})

describe('findSensitiveLoggerArgs', () => {
  it('ignores literal text but checks template interpolation expressions', () => {
    const interpolation = '${' + 'pin}'
    const offenders = findSensitiveLoggerArgs(`
      log.debug('pin')
      log.debug(\`pin=${interpolation}\`)
    `)

    expect(offenders).toEqual([`pin: \`pin=${interpolation}\``])
  })
})
