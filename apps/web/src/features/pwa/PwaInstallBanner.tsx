import { Button } from "@evevault/shared/components";
import Icon from "@evevault/shared/components/Icon";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)
  );
}

export function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"chromium" | "ios" | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (isStandalone()) return;

    if (isIOSSafari()) {
      setMode("ios");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setMode("chromium");
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setMode(null);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setMode(null);
    setInstallPrompt(null);
  };

  if (!mode) return null;

  return (
    <aside
      className="fixed bottom-0 left-0 right-0 z-[9998] flex items-stretch backdrop-blur-[2px] bg-[var(--toast-backdrop)] border-t border-[var(--neutral-50)] animate-[pwa-slide-up_300ms_ease-out]"
      aria-label="Install EVE Vault"
    >
      {/* Red accent bar */}
      <div
        className="shrink-0 w-0.5 self-stretch bg-[var(--martian-red)]"
        aria-hidden
      />

      {/* Panel */}
      <div className="flex flex-1 items-center gap-4 min-w-0 py-3 px-6 bg-matter-01">
        {/* Text */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <p className="m-0 font-headline text-sm font-normal leading-[1.1] uppercase text-[var(--neutral-90)] whitespace-nowrap">
            Install EVE Vault
          </p>
          {mode === "ios" ? (
            <p className="m-0 text-sm font-light leading-[1.5] tracking-[-0.02em] text-[var(--neutral-80)]">
              Tap the{" "}
              <svg
                className="inline-block align-middle w-[14px] h-[14px] relative -top-px text-[var(--neutral-80)]"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="Share"
                role="img"
              >
                <path d="M12 2l-4 4h3v8h2V6h3L12 2zm-6 14v4h12v-4h-2v2H8v-2H6z" />
              </svg>{" "}
              Share button, then{" "}
              <strong className="font-medium text-[var(--neutral-90)]">
                Add to Home Screen
              </strong>
              .
            </p>
          ) : (
            <p className="m-0 text-sm font-light leading-[1.5] tracking-[-0.02em] text-[var(--neutral-80)]">
              Install the app for faster access and a native feel.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {mode === "chromium" && (
            <Button size="small" variant="primary" onClick={install}>
              Install
            </Button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 m-0 p-[2px] border-none rounded-sm bg-transparent cursor-pointer leading-none opacity-90 text-[var(--neutral-90)] hover:opacity-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--neutral-50)]"
            aria-label="Dismiss"
          >
            <Icon
              name="Close"
              width={16}
              height={16}
              color="neutral"
              aria-hidden
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
