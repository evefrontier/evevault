import type { FC } from 'react'

const CELL_SIZE = 8
const STROKE_COLOR = '#FF4700'

type IdenticonPattern = readonly string[]
type IdenticonCell = {
  column: number
  id: string
  row: number
}

const IDENTICON_PATTERNS = [
  ['0100', '1110', '0111', '0001'],
  ['1000', '1111', '0010', '0101'],
  ['0110', '1101', '0010', '1001'],
  ['0100', '1110', '0111', '0001'],
] as const satisfies readonly IdenticonPattern[]

const IDENTICON_CELLS: readonly IdenticonCell[] = [
  { column: 0, id: '0-0', row: 0 },
  { column: 1, id: '0-1', row: 0 },
  { column: 2, id: '0-2', row: 0 },
  { column: 3, id: '0-3', row: 0 },
  { column: 0, id: '1-0', row: 1 },
  { column: 1, id: '1-1', row: 1 },
  { column: 2, id: '1-2', row: 1 },
  { column: 3, id: '1-3', row: 1 },
  { column: 0, id: '2-0', row: 2 },
  { column: 1, id: '2-1', row: 2 },
  { column: 2, id: '2-2', row: 2 },
  { column: 3, id: '2-3', row: 2 },
  { column: 0, id: '3-0', row: 3 },
  { column: 1, id: '3-1', row: 3 },
  { column: 2, id: '3-2', row: 3 },
  { column: 3, id: '3-3', row: 3 },
]

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
