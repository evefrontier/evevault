import type { FC } from 'react'

type IdenticonPattern = readonly string[]

const CELL_SIZE = 8
const STROKE_COLOR = '#FF4700'

const IDENTICON_PATTERNS = [
  ['0100', '1110', '0111', '0001'],
  ['1000', '1111', '0010', '0101'],
  ['0110', '1101', '0010', '1001'],
  ['1011', '0111', '1100', '0010'],
] as const satisfies readonly IdenticonPattern[]

const IDENTICON_CELLS = Array.from({ length: 4 }, (_, row) =>
  Array.from({ length: 4 }, (_, column) => ({
    column,
    id: `${row}-${column}`,
    row,
  })),
).flat()

const IDENTICONS = IDENTICON_PATTERNS.map((pattern) => {
  return function IdenticonComponent() {
    return <Identicon pattern={pattern} />
  }
}) as readonly FC[]

/**
 * Returns slightly different rect dimensions for active and inactive cells so
 * the generated icons preserve the original hand-drawn visual weight.
 */
function getCellProps(row: number, column: number, isActive: boolean) {
  const offset = isActive ? 1 : 0.5

  return {
    height: isActive ? 4 : 5,
    stroke: STROKE_COLOR,
    strokeOpacity: isActive ? undefined : '0.5',
    strokeWidth: isActive ? 2 : undefined,
    width: isActive ? 4 : 5,
    x: column * CELL_SIZE + offset,
    y: row * CELL_SIZE + offset,
  }
}

/**
 * Wraps a static pattern in a component so callers can keep treating
 * identicons as ordinary React nodes.
 */
function Identicon({ pattern }: { pattern: IdenticonPattern }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {IDENTICON_CELLS.map(({ column, id, row }) => (
        <rect
          key={id}
          {...getCellProps(row, column, pattern[row][column] === '1')}
        />
      ))}
    </svg>
  )
}

/**
 * Keeps dropdown callers on numeric avatar ids while wrapping indexes larger
 * than the available pattern set.
 */
export const getIdenticon = (index: number) => {
  const Icon = IDENTICONS[index % IDENTICONS.length]
  return <Icon />
}
