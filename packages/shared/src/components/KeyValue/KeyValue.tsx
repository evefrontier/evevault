/** One `.c-kv` row; renders nothing when there is no value. */
export function KvRow({
  label,
  value,
  title,
}: {
  label: string
  value: string | null | undefined
  /** Hover text when the shown value is shortened */
  title?: string
}) {
  if (!value) return null
  return (
    <>
      <dt>{label}</dt>
      <dd title={title ?? value}>{value}</dd>
    </>
  )
}

export default KvRow
