import { createSvgIcon } from './createSvgIcon'

const SettingsIcon = createSvgIcon({
  ariaLabel: 'Settings',
  paths: [
    {
      clipRule: 'evenodd',
      d: 'M16 0H0V16H16V0ZM4 4H12V12H4V4ZM2 14V2H14V14H2Z',
      fillRule: 'evenodd',
    },
  ],
})

export default SettingsIcon
