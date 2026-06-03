import { createSvgIcon } from './createSvgIcon'

const ChevronArrowLeftIcon = createSvgIcon({
  ariaLabel: 'Chevron Arrow Left',
  paths: [
    {
      d: 'M11 3L6 8L11 13',
      stroke: 'color',
      strokeWidth: 2,
    },
  ],
})

export default ChevronArrowLeftIcon
