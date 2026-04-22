import { Button } from "@evevault/shared/components";
import Icon from "@evevault/shared/components/Icon";
import { useEffect, useState } from "react";
import "./PwaInstallBanner.css";

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
    <aside className="pwa-banner" aria-label="Install EVE Vault">
      <div className="pwa-banner__accent" aria-hidden />
      <div className="pwa-banner__panel">
        <div className="pwa-banner__body">
          <p className="pwa-banner__title">Install EVE Vault</p>
          {mode === "ios" ? (
            <p className="pwa-banner__message">
              Tap the{" "}
              <svg
                className="pwa-banner__ios-share"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="Share"
                role="img"
              >
                <path d="M12 2l-4 4h3v8h2V6h3L12 2zm-6 14v4h12v-4h-2v2H8v-2H6z" />
              </svg>{" "}
              Share button, then <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="pwa-banner__message">
              Install as an app for faster access and a native feel.
            </p>
          )}
        </div>
        <div className="pwa-banner__actions">
          {mode === "chromium" && (
            <Button size="small" variant="primary" onClick={install}>
              Install
            </Button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="pwa-banner__close"
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
