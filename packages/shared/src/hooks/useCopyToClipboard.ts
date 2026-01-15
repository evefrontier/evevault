import { copyToClipboard } from "../utils/address";

export function useCopyToClipboard(
  _successMessage: string = "Copied!",
  _errorMessage: string = "Failed to copy",
  _messageDuration: number = 2000,
) {
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
