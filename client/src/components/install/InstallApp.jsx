import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { detectPlatform, isIOS } from "./installPlatform";
import "./InstallApp.css";

// "Add to home screen" for both apps, on every phone.
// - Android / Chrome: the browser's install dialog.
// - iPhone: there is no install button a website can trigger (Apple only
//   allows Share → Add to Home Screen), so we show those steps.
// Shows itself once (a slim banner after `delay`, if not dismissed in the
// last 14 days and not already installed), and opens any time with
// window.dispatchEvent(new CustomEvent("gf:install")).

const DISMISS_DAYS = 14;
const ShareIcon = () => (
  <svg className="install-share-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </svg>
);
const PlusIcon = () => (
  <svg className="install-share-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
);

let deferred = null; // the browser's install event, kept for later
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; window.dispatchEvent(new Event("gf:installable")); });
}

const dismissedRecently = (key) => {
  try { const t = Number(localStorage.getItem(key)); return t && Date.now() - t < DISMISS_DAYS * 86400000; } catch { return true; }
};

export default function InstallApp({ appName, icon, storageKey, delay = 30000, waitFor }) {
  const [platform, setPlatform] = useState(() => detectPlatform({ hasPrompt: Boolean(deferred) }));
  const [banner, setBanner] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const update = () => setPlatform(detectPlatform({ hasPrompt: Boolean(deferred) }));
    const installed = () => { setBanner(false); setSheet(false); setPlatform("installed"); };
    const open = () => { setBanner(false); setSheet(true); };
    window.addEventListener("gf:installable", update);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("gf:install", open);
    return () => {
      window.removeEventListener("gf:installable", update);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("gf:install", open);
    };
  }, []);

  // The one-time banner: only where installing is possible, and not while
  // something else (e.g. a guided tour) should go first.
  useEffect(() => {
    if (platform === "installed" || platform === "manual" || dismissedRecently(storageKey)) return undefined;
    if (waitFor && !waitFor()) {
      const retry = () => { if (waitFor()) setTimeout(() => setBanner(true), 1500); };
      window.addEventListener("gf:tour-closed", retry);
      return () => window.removeEventListener("gf:tour-closed", retry);
    }
    const t = setTimeout(() => setBanner(true), delay);
    return () => clearTimeout(t);
  }, [platform, storageKey, delay, waitFor]);

  const dismiss = () => {
    setBanner(false);
    setSheet(false);
    try { localStorage.setItem(storageKey, String(Date.now())); } catch { /* private mode */ }
  };

  const install = useCallback(async () => {
    if (deferred && platform === "prompt") {
      deferred.prompt();
      const { outcome } = await deferred.userChoice.catch(() => ({}));
      deferred = null;
      setBanner(false);
      setSheet(false);
      if (outcome === "accepted") setPlatform("installed");
      return;
    }
    setBanner(false);
    setSheet(true);
  }, [platform]);

  if (platform === "installed") return null;

  const steps = {
    "ios-safari": [
      <>Tap <strong>Share</strong> <ShareIcon /> at the bottom of Safari (at the top on iPad).</>,
      <>Scroll down and tap <strong>Add to Home Screen</strong> <PlusIcon />.</>,
      <>Tap <strong>Add</strong>. {appName} appears on your home screen and opens full-screen, like an app.</>,
    ],
    "ios-other": [
      <>Tap <strong>Share</strong> <ShareIcon /> in the address bar.</>,
      <>Tap <strong>Add to Home Screen</strong> <PlusIcon /> (you may need to tap <strong>More</strong> first).</>,
      <>Tap <strong>Add</strong>. If you don't see it, open this page in <strong>Safari</strong> and use Share there.</>,
    ],
    "in-app": [
      <>This page is open inside another app (Instagram, WhatsApp…), which can't add it to your home screen.</>,
      <>Tap the <strong>⋯</strong> menu and choose <strong>Open in Safari</strong> (or Open in browser).</>,
      <>Then tap <strong>Share</strong> <ShareIcon /> → <strong>Add to Home Screen</strong>.</>,
    ],
    manual: [
      <>Open your browser's menu (<strong>⋮</strong> or <strong>⋯</strong>).</>,
      <>Choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</>,
    ],
    prompt: [<>Tap <strong>Install</strong> and confirm. {appName} opens from your home screen like an app.</>],
  }[platform];

  return createPortal(
    <>
      {banner && !sheet && (
        <div className="install-banner" role="region" aria-label={`Install ${appName}`}>
          <img className="install-banner-icon" src={icon} alt="" width="44" height="44" />
          <div className="install-banner-text">
            <strong>Add {appName} to your home screen</strong>
            <span>{isIOS(platform) || platform === "in-app" ? "Two taps, no App Store needed." : "Opens full-screen, like an app. No app store needed."}</span>
          </div>
          <button type="button" className="install-banner-btn" onClick={install}>{platform === "prompt" ? "Install" : "Show me"}</button>
          <button type="button" className="install-banner-close" onClick={dismiss} aria-label="Not now">×</button>
        </div>
      )}
      {sheet && (
        <div className="install-backdrop" onClick={dismiss}>
          <div className="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(e) => e.stopPropagation()}>
            <img className="install-sheet-icon" src={icon} alt="" width="64" height="64" />
            <p className="install-eyebrow">Install</p>
            <h2 className="install-title" id="install-title">Add {appName} to your home screen</h2>
            <ol className="install-steps">
              {steps.map((s, i) => <li key={i}><span className="install-step-num" aria-hidden="true">{i + 1}</span><span>{s}</span></li>)}
            </ol>
            <div className="install-actions">
              <button type="button" className="install-btn-text" onClick={dismiss}>{platform === "prompt" ? "Not now" : "Close"}</button>
              {platform === "prompt" && <button type="button" className="install-btn-primary" onClick={install}>Install</button>}
            </div>
            {platform === "ios-safari" && <div className="install-pointer" aria-hidden="true" />}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
