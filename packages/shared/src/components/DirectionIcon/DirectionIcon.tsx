/** Boxed arrow: out of the box (brand) for sent or spent, into it (teal) for received. */
export function DirectionIcon({
  out,
  label = out ? 'Sent' : 'Received',
}: {
  out: boolean
  label?: string
}) {
  return (
    <span
      className={`c-dir ${out ? 'c-dir--out' : 'c-dir--in'}`}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d={out ? 'M2 8 8 2M3.5 2H8v4.5' : 'M8 2 2 8M6.5 8H2V3.5'} />
      </svg>
    </span>
  )
}

export default DirectionIcon
