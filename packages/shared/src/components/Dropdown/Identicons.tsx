import type { FC } from 'react'

const CELL_SIZE = 8
const STROKE_COLOR = '#FF4700'

type IdenticonPattern = readonly string[]

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

function createIdenticon(index: number): FC {
  return function IdenticonComponent() {
    return <Identicon pattern={IDENTICON_PATTERNS[index]} />
  }
}

export const Identicon1 = createIdenticon(0)
export const Identicon2 = createIdenticon(1)
export const Identicon3 = createIdenticon(2)
export const Identicon4 = createIdenticon(3)

export const IDENTICONS = [
  Identicon1,
  Identicon2,
  Identicon3,
  Identicon4,
] as const

export const getIdenticon = (index: number) => {
  const Icon = IDENTICONS[index % IDENTICONS.length]
  return <Icon />
}
