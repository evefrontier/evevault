import { useToast } from "../components/Toast";
import { copyToClipboard } from "../utils/address";

export function useCopyToClipboard(
  successMessage: string = "Copied!",
  errorMessage: string = "Failed to copy",
  messageDuration: number = 2000,
) {
  // const { showToast } = useToast();

  const copy = async (text: string): Promise<boolean> => {
    const success = await copyToClipboard(text);

    if (success) {
      // showToast(successMessage, messageDuration);
    } else {
      // showToast(errorMessage, messageDuration);
    }

    return success;
  };

  return { copy };
}
