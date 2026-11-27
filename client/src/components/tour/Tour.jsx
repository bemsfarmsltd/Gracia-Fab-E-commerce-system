import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./Tour.css";

// A guided tour: a soft spotlight on one part of the page and a card that
// explains it. Used for the shop's first visit and the admin's first sign-in.
//
// steps: [{ id, title, body, target?, placement?, eyebrow?, image?, primary? }]
//   target: CSS selector or a list of them; the first one visible is used.
//           Without a target the card sits in the centre (welcome / finish).
//           A step whose target isn't on the page is skipped.
// Keyboard: → / Enter next, ← back, Esc closes.

const PAD = 8; // space around the highlighted element
const GAP = 14; // between highlight and card
const MOBILE = 640;

function visible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
}

function findTarget(target) {
  if (!target) return null;
  for (const sel of Array.isArray(target) ? target : [target]) {
    const found = [...document.querySelectorAll(sel)].find(visible);
    if (found) return found;
  }
  return null;
}

function placeCard(rect, card, preferred) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = card?.offsetWidth || 360;
  const h = card?.offsetHeight || 220;
  const clampX = (x) => Math.max(12, Math.min(x, vw - w - 12));
  const clampY = (y) => Math.max(12, Math.min(y, vh - h - 12));
  const spots = {
    bottom: { top: rect.bottom + GAP, left: clampX(rect.left + rect.width / 2 - w / 2), fits: rect.bottom + GAP + h < vh - 8 },
    top: { top: rect.top - GAP - h, left: clampX(rect.left + rect.width / 2 - w / 2), fits: rect.top - GAP - h > 8 },
    right: { top: clampY(rect.top + rect.height / 2 - h / 2), left: rect.right + GAP, fits: rect.right + GAP + w < vw - 8 },
    left: { top: clampY(rect.top + rect.height / 2 - h / 2), left: rect.left - GAP - w, fits: rect.left - GAP - w > 8 },
  };
  const order = [preferred, "bottom", "top", "right", "left"].filter(Boolean);
  const pick = order.find((p) => spots[p]?.fits) || "bottom";
  return { top: clampY(spots[pick].top), left: spots[pick].left, side: pick };
}

export default function Tour({ steps, open, onClose, label = "Guided tour" }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < MOBILE);
  const cardRef = useRef(null);
  const primaryRef = useRef(null);
  const dirRef = useRef(1);
  const step = steps[index];

  // Start from the beginning each time the tour opens.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(0);
      dirRef.current = 1;
    }
  }, [open]);

  const finish = useCallback((completed) => onClose?.({ completed, step: steps[index]?.id }), [onClose, steps, index]);
  const go = useCallback((delta) => {
    dirRef.current = delta;
    setIndex((i) => {
      const next = i + delta;
      if (next >= steps.length) { onClose?.({ completed: true }); return i; }
      return Math.max(0, next);
    });
  }, [steps.length, onClose]);

  // Measure the target (and skip the step if it isn't on the page).
  const measure = useCallback(() => {
    if (!open || !step) return;
    setNarrow(window.innerWidth < MOBILE);
    if (!step.target) { setRect(null); return; }
    const el = findTarget(step.target);
    if (!el) {
      const next = index + dirRef.current;
      if (next < 0 || next >= steps.length) onClose?.({ completed: next >= steps.length });
      else setIndex(next);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, bottom: r.bottom + PAD, right: r.right + PAD });
  }, [open, step, index, steps.length, onClose]);

  useLayoutEffect(() => {
    if (!open || !step) return undefined;
    const el = step.target ? findTarget(step.target) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 70) {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView?.({ block: "center", behavior: reduce ? "auto" : "smooth" });
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    const t = setTimeout(measure, 380); // after a smooth scroll settles
    let frame;
    const onMove = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, step, measure]);

  // Place the card next to the highlight (or as a bottom sheet on phones).
  useLayoutEffect(() => {
    if (!open) return;
    setPos(rect && !narrow ? placeCard(rect, cardRef.current, step?.placement) : null);
  }, [rect, narrow, open, step, index]);

  useEffect(() => {
    if (!open) return undefined;
    primaryRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, go, finish]);

  if (!open || !step) return null;
  const centred = !step.target || !rect;
  const last = index === steps.length - 1;
  const counted = steps.filter((s) => s.target);
  const countIndex = counted.indexOf(step);

  const card = (
    <div
      ref={cardRef}
      className={`tour-card ${centred ? "tour-card-centre" : ""} ${narrow && !centred ? "tour-card-sheet" : ""} ${pos ? `tour-side-${pos.side}` : ""}`}
      style={pos && !centred ? { top: pos.top, left: pos.left } : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tour-title-${step.id}`}
      aria-describedby={`tour-body-${step.id}`}
    >
      {centred && step.image && <div className="tour-hero" aria-hidden="true"><img src={step.image} alt="" /></div>}
      <p className="tour-eyebrow">{step.eyebrow || (countIndex >= 0 ? `${countIndex + 1} of ${counted.length}` : label)}</p>
      <h2 className="tour-title" id={`tour-title-${step.id}`}>{step.title}</h2>
      <div className="tour-body" id={`tour-body-${step.id}`}>{step.body}</div>
      {counted.length > 1 && !centred && (
        <div className="tour-dots" aria-hidden="true">
          {counted.map((s) => <span key={s.id} className={s === step ? "is-on" : ""} />)}
        </div>
      )}
      <div className="tour-actions">
        {index > 0 && !last && <button type="button" className="tour-btn-text" onClick={() => go(-1)}>Back</button>}
        {!last && <button type="button" className="tour-btn-text tour-skip" onClick={() => finish(false)}>{index === 0 ? "Not now" : "Skip tour"}</button>}
        <button type="button" ref={primaryRef} className="tour-btn-primary" onClick={() => (last ? finish(true) : go(1))}>
          {step.primary || (last ? "Done" : index === 0 ? "Show me around" : "Next")}
        </button>
      </div>
    </div>
  );

  return createPortal(
    <div className="tour-root" aria-live="polite">
      {/* Catches clicks so the page can't be used behind the tour. */}
      <div className={`tour-blocker ${centred ? "tour-blocker-dim" : ""}`} onClick={(e) => e.stopPropagation()} />
      {!centred && <div className="tour-spotlight" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden="true" />}
      {card}
    </div>,
    document.body,
  );
}
