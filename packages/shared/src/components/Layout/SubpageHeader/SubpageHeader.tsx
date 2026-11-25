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
      <HeaderMobile address={address} email={email} />
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 grid size-7 place-items-center border-none bg-transparent text-(--n50) cursor-pointer hover:text-(--brand) focus-visible:outline focus-visible:outline-1 focus-visible:outline-(--ink)"
          >
            <Icon
              name="ArrowLeft"
              width={16}
              height={16}
              color="currentColor"
            />
          </button>
        )}
        <Heading level={2}>{title}</Heading>
      </div>
    </>
  )
}
