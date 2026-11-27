import { useCallback, useEffect, useState } from "react";

// Opens a tour once per person/device (remembered in localStorage), after a
// short delay so the page has settled, and lets it be replayed with
// window.dispatchEvent(new CustomEvent("gf:tour", { detail: name })).
export const tourSeen = (key) => {
  try { return localStorage.getItem(key) === "done"; } catch { return true; } // storage blocked: don't nag
};
const markSeen = (key) => {
  try { localStorage.setItem(key, "done"); } catch { /* private mode */ }
};

export default function useFirstRunTour({ name, storageKey, enabled = true, delay = 1500 }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || tourSeen(storageKey)) return undefined;
    const t = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(t);
  }, [enabled, storageKey, delay]);

  useEffect(() => {
    const replay = (e) => { if (!e.detail || e.detail === name) setOpen(true); };
    window.addEventListener("gf:tour", replay);
    return () => window.removeEventListener("gf:tour", replay);
  }, [name]);

  const close = useCallback(() => {
    markSeen(storageKey);
    setOpen(false);
    // Lets things that wait for the tour (the install banner) go next.
    window.dispatchEvent(new Event("gf:tour-closed"));
  }, [storageKey]);

  return { open, close, start: () => setOpen(true) };
}

export const startTour = (name) => window.dispatchEvent(new CustomEvent("gf:tour", { detail: name }));
