import { Background, Button, Heading, Text } from "@evevault/shared/components";
import type { ErrorComponentProps } from "@tanstack/react-router";

/**
 * Route-level error boundary component
 * Provides consistent error UI across the application
 */
export function RouteErrorBoundary({ error, reset }: ErrorComponentProps) {
  const handleReset = () => {
    reset();
    window.location.href = "/";
  };

  return (
    <Background>
      <div className="app-shell">
        <main className="app-shell__content">
          <div className="card">
            <Heading level={1} variant="bold">
              Something went wrong
            </Heading>
            <Text color="error">
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred"}
            </Text>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              <Button onClick={handleReset}>Go Home</Button>
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </main>
      </div>
    </Background>
  );
}
