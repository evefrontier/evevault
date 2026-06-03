import { createSvgIcon } from './createSvgIcon'

const TokensIcon = createSvgIcon({
  ariaLabel: 'Tokens',
  paths: [
    {
      clipRule: 'evenodd',
      d: 'M0 0H16V7H14V2H2V7H0V0ZM0 9V16H16V9H14V14H2V9H0ZM4 9V12H12V9H4ZM12 7V4H4V7H12Z',
      fillRule: 'evenodd',
    },
  ],
  svgFill: 'color',
})

export default TokensIcon
