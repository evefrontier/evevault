import Heading from '#/components/Heading'
import Icon from '#/components/Icon'
import HeaderMobile from '../Header'

export function SubpageHeader({
  title,
  email,
  address,
  onBack,
}: {
  title: string
  email: string
  address: string
  onBack?: () => void
}) {
  return (
    <>
      <HeaderMobile
        address={address}
        email={email}
        onTransactionsClick={onBack}
      />
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center p-1 bg-transparent border-none cursor-pointer hover:opacity-80"
          >
            <Icon name="ArrowLeft" size="medium" color="quantum" />
          </button>
        )}
        <Heading level={2}>{title}</Heading>
      </div>
    </>
  )
}
