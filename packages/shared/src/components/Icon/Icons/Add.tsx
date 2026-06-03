import { createSvgIcon } from './createSvgIcon'

const AddIcon = createSvgIcon({
  ariaLabel: 'Add',
  paths: [
    {
      clipRule: 'evenodd',
      d: 'M9 2H7V7H2V9H7V14H9V9H14V7H9V2Z',
      fillRule: 'evenodd',
    },
  ],
  svgFill: 'color',
})

export default AddIcon
