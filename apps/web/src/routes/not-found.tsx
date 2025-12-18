import { NotFoundScreen } from "@evevault/shared/components";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/not-found")({
  component: NotFoundScreen,
});
