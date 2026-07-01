import type React from 'react'
import type { AliasesScreenProps } from '#/types/components'

export const AliasesScreen: React.FC<AliasesScreenProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col gap-4 w-full">
      <button type="button" onClick={onBack}>
        Back
      </button>
      <div className="flex flex-col items-start p-4 px-2 gap-4 w-full min-h-[207px] bg-crude-dark border border-quantum-60">
        {/* TODO: build out the Aliases management UI */}
      </div>
    </div>
  )
}

export default AliasesScreen
