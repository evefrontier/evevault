import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CallbackScreen } from "../features/auth/components/CallbackScreen";

const searchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/callback")({
  component: CallbackScreen,
  validateSearch: searchSchema,
  meta: () => [
    {
      title: "EVE Vault - Authenticating",
    },
  ],
});
