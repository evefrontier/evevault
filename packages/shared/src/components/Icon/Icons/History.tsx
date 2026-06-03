import { createSvgIcon } from './createSvgIcon'

const HistoryIcon = createSvgIcon({
  ariaLabel: 'History',
  paths: [
    {
      clipRule: 'evenodd',
      d: 'M9 0H16V16H9V14H14V2H9V0ZM7 0H0V16H7V14H2V2H7V0ZM7 4H4V12H7L7 4ZM9 12H12V4H9L9 12Z',
      fillRule: 'evenodd',
    },
  ],
})

export default HistoryIcon
