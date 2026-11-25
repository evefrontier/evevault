import Icon from '#/components/Icon'
import type { IconName } from '#/types'

/** Diamond frame with crosshair ticks, the nav icon centred inside, label below. */
export function DiamondTabContent({
  icon,
  label,
}: {
  icon: string
  label: string
}) {
  return (
    <>
      <svg
        className="diamond-tab__frame"
        viewBox="0 0 80 80"
        aria-hidden="true"
      >
        <path className="diamond-tab__dia" d="M40 5 75 40 40 75 5 40Z" />
        <path d="M37 5h6M40 2v6M72 40h6M75 37v6M37 75h6M40 72v6M2 40h6M5 37v6" />
      </svg>
      <span className="diamond-tab__icon">
        <Icon
          name={icon as IconName}
          width={18}
          height={18}
          color="currentColor"
        />
      </span>
      <span className="diamond-tab__label">{label}</span>
    </>
  )
}
