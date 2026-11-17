// Loads an external script once, on demand, instead of from index.html.
//
// Third-party scripts in <head> are downloaded and run before the page can
// render, on every page, for every visitor. Monnify's SDK is only needed at
// checkout, so Checkout loads it when it opens.
//
// `isReady` lets callers skip loading when the global is already there (e.g.
// a previous visit, or a test that provides a fake).
const pending = new Map();

export const MONNIFY_SDK_URL = "https://sdk.monnify.com/plugin/monnify.js";

export function loadScript(src, { isReady } = {}) {
  if (isReady?.()) return Promise.resolve();
  if (pending.has(src)) return pending.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pending.delete(src); // allow a retry (e.g. after a network blip)
      script.remove();
      reject(new Error(`Couldn't load ${src}`));
    };
    document.head.appendChild(script);
  });

  pending.set(src, promise);
  return promise;
}

export const loadMonnify = () =>
  loadScript(MONNIFY_SDK_URL, { isReady: () => Boolean(window.MonnifySDK) });
