import { useNavigate } from "@tanstack/react-router";
import Background from "../Background";
import Button from "../Button";
import Heading from "../Heading";
import Text from "../Text";

export function NotFoundScreen() {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate({ to: "/" });
  };

  return (
    <Background>
      <div className="app-shell">
        <main className="app-shell__content">
          <div className="card">
            <Heading level={1} variant="bold">
              404 - Page Not Found
            </Heading>
            <Text>The page you're looking for doesn't exist.</Text>
            <Button onClick={handleGoHome}>Go to Home</Button>
          </div>
        </main>
      </div>
    </Background>
  );
}
