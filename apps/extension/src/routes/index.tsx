import { createFileRoute } from "@tanstack/react-router";
import PopupApp from "../features/wallet/components/PopupApp";

export const Route = createFileRoute("/")({
  component: () => <PopupApp />,
});
