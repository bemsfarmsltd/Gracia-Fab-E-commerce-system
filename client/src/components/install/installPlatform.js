// Which way this device installs a web app.
//   "installed"  already running from the home screen
//   "prompt"     Android / desktop Chrome / Edge: the browser's own install
//                dialog (beforeinstallprompt) is available
//   "ios-safari" iPhone/iPad Safari: Share → Add to Home Screen
//   "ios-other"  Chrome/Edge/Firefox on iPhone (iOS 16.4+): Share in the
//                address bar → Add to Home Screen
//   "in-app"     Instagram, Facebook, WhatsApp… built-in browsers can't
//                install: open in Safari first
//   "manual"     anything else: browser menu → Install / Add to Home Screen

export function detectPlatform({ ua = navigator.userAgent, standalone, hasPrompt = false, maxTouchPoints = navigator.maxTouchPoints || 0 } = {}) {
  const isStandalone = standalone ?? (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  if (isStandalone) return "installed";
  // iPadOS reports itself as a Mac; touch points give it away.
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|; wv\)/i.test(ua)) return "in-app";
  // iPhones only ever install through Share, whatever the browser says.
  if (iOS) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "ios-safari";
  if (hasPrompt) return "prompt";
  return "manual";
}

export const isIOS = (platform) => platform === "ios-safari" || platform === "ios-other";

// Opens the install steps from anywhere (menu links).
export const openInstall = () => window.dispatchEvent(new CustomEvent("gf:install"));
