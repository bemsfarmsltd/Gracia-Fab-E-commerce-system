import { useEffect, useRef, useState } from "react";

// The home page hero media, made cheap to show.
//
// Desktop (>768px):
//   1. A 32 KB still of the first frame (Cloudinary-generated) shows at once,
//      so the hero appears fast.
//   2. The video only starts downloading once the page has finished loading.
//   3. Cloudinary resizes and recompresses it (~1.25 MB at 1280 px).
//   4. Visitors with data saver on, or who prefer reduced motion, just get the
//      still image.
//
// Mobile (<=768px):
//   Shows a single 9:16 still frame cropped from the hero video itself (~60 KB)
//   and renders no <video> at all so phones download zero bytes of video.
const CLOUDINARY = "https://res.cloudinary.com/dyzkjerez/video/upload";
const VIDEO_ID = "v1789284554/Generate_a_high_end_glossy_c_1_arwzb5";

// Recommended frame: 2s (facing the camera, hands in her twists, full wine background).
export const HERO_MOBILE_FRAME_SECONDS = 2;
export const HERO_MOBILE_STILL = `${CLOUDINARY}/so_${HERO_MOBILE_FRAME_SECONDS},c_fill,g_auto,ar_9:16,w_828,q_auto,f_auto/${VIDEO_ID}.jpg`;

export const HERO_POSTER = `${CLOUDINARY}/so_0,w_1280,q_auto/${VIDEO_ID}.jpg`;
export const HERO_VIDEO_DESKTOP = `${CLOUDINARY}/q_auto,vc_auto,w_1280/${VIDEO_ID}.mp4`;
export const HERO_VIDEO_MOBILE = `${CLOUDINARY}/q_auto:eco,vc_auto,w_720/${VIDEO_ID}.mp4`;

const MOBILE_QUERY = "(max-width: 768px)";

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.(MOBILE_QUERY)?.matches);
}

function shouldSkipVideo() {
  if (typeof window === "undefined") return true;
  if (isMobileViewport()) return true;
  const saveData = navigator.connection?.saveData === true;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return saveData || reducedMotion;
}

function HeroVideo({ className }) {
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [src, setSrc] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    if (mql.addListener) {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (isMobile || shouldSkipVideo()) return undefined;
    let idleHandle;
    const start = () => {
      // The idle callback can be postponed indefinitely on a busy page (seen
      // on a throttled connection), so give it a deadline.
      if (typeof window !== "undefined" && window.requestIdleCallback) {
        const id = window.requestIdleCallback(() => setSrc(HERO_VIDEO_DESKTOP), { timeout: 1500 });
        idleHandle = { type: "idle", id };
      } else {
        const id = setTimeout(() => setSrc(HERO_VIDEO_DESKTOP), 200);
        idleHandle = { type: "timeout", id };
      }
    };
    if (typeof window !== "undefined") {
      if (document.readyState === "complete") start();
      else window.addEventListener("load", start, { once: true });
    }
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("load", start);
      if (idleHandle) {
        if (idleHandle.type === "idle" && typeof window !== "undefined" && window.cancelIdleCallback) {
          window.cancelIdleCallback(idleHandle.id);
        } else if (idleHandle.type === "timeout") {
          clearTimeout(idleHandle.id);
        }
      }
    };
  }, [isMobile]);

  // Some browsers don't autoplay a <video> whose src is set after mount.
  useEffect(() => {
    if (!isMobile && src) videoRef.current?.play?.().catch(() => {});
  }, [isMobile, src]);

  if (isMobile) {
    return (
      <img
        className={`${className || ""} ysl-hero-still`.trim()}
        src={HERO_MOBILE_STILL}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      poster={HERO_POSTER}
      src={src || undefined}
      autoPlay
      loop
      muted
      playsInline
      preload="none"
      aria-hidden="true"
    />
  );
}

export default HeroVideo;
