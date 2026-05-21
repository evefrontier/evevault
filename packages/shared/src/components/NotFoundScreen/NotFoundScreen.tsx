import { useNavigate } from '@tanstack/react-router'
import Button from '#/components/Button'
import Heading from '#/components/Heading'
import Text from '#/components/Text'

export function NotFoundScreen() {
  const navigate = useNavigate()

  const handleGoHome = () => {
    navigate({ to: '/' })
  }

  return (
    <div>
      <Heading level={1} variant="bold">
        404 - Page Not Found
      </Heading>
      <Text>The page you're looking for doesn't exist.</Text>
      <Button onClick={handleGoHome}>Go to Home</Button>
    </div>
  )
}
