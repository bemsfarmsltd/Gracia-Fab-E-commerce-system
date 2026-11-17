import { useEffect, useRef, useState } from "react";

// The home page hero video, made cheap to show.
//
// The original was a 3.3 MB MP4 that every visitor downloaded straight away,
// competing with the rest of the page. Now:
//   1. A 32 KB still of the first frame (Cloudinary-generated) shows at once,
//      so the hero appears fast.
//   2. The video only starts downloading once the page has finished loading.
//   3. Cloudinary resizes and recompresses it: ~1.25 MB at 1280 px for wider
//      screens, ~0.54 MB at 720 px for phones.
//   4. Visitors with data saver on, or who prefer reduced motion, just get the
//      still image.
const CLOUDINARY = "https://res.cloudinary.com/dyzkjerez/video/upload";
const VIDEO_ID = "v1789284554/Generate_a_high_end_glossy_c_1_arwzb5";

export const HERO_POSTER = `${CLOUDINARY}/so_0,w_1280,q_auto/${VIDEO_ID}.jpg`;
export const HERO_VIDEO_DESKTOP = `${CLOUDINARY}/q_auto,vc_auto,w_1280/${VIDEO_ID}.mp4`;
export const HERO_VIDEO_MOBILE = `${CLOUDINARY}/q_auto:eco,vc_auto,w_720/${VIDEO_ID}.mp4`;

function shouldSkipVideo() {
  if (typeof window === "undefined") return true;
  const saveData = navigator.connection?.saveData === true;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return saveData || reducedMotion;
}

function pickSource() {
  const narrow = window.matchMedia?.("(max-width: 768px)").matches;
  return narrow ? HERO_VIDEO_MOBILE : HERO_VIDEO_DESKTOP;
}

function HeroVideo({ className }) {
  const [src, setSrc] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (shouldSkipVideo()) return undefined;
    let idleHandle;
    const start = () => {
      // The idle callback can be postponed indefinitely on a busy page (seen
      // on a throttled connection), so give it a deadline.
      const schedule = window.requestIdleCallback
        ? (cb) => window.requestIdleCallback(cb, { timeout: 1500 })
        : (cb) => setTimeout(cb, 200);
      idleHandle = schedule(() => setSrc(pickSource()));
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idleHandle && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
    };
  }, []);

  // Some browsers don't autoplay a <video> whose src is set after mount.
  useEffect(() => {
    if (src) videoRef.current?.play?.().catch(() => {});
  }, [src]);

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
