import { useEffect, useRef, useState } from "react";

// Reads a barcode with the phone or laptop camera and hands back the code.
// Uses the browser's built-in BarcodeDetector where it exists (Chrome on
// Android: fast), otherwise loads the ZXing reader (iPhone, Firefox) only
// when the camera is opened. Handheld USB/Bluetooth scanners don't need
// this: they type the code into the search box and press Enter.
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

// continuous: keep the camera open and hand back every read (stock take).
// The same code read again within 1.5 s is ignored, so holding the camera on
// one item doesn't count it twice. `message` shows the last result.
export default function BarcodeScanner({ onCode, onClose, continuous = false, message = "" }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("Starting the camera…");
  const [error, setError] = useState("");
  const onCodeRef = useRef(onCode);
  useEffect(() => { onCodeRef.current = onCode; }, [onCode]);

  useEffect(() => {
    let stream;
    let stopped = false;
    let zxingControls;
    let timer;
    let last = { code: null, at: 0 };
    const done = (code) => {
      if (stopped) return;
      const now = Date.now();
      if (continuous && code === last.code && now - last.at < 1500) return;
      last = { code, at: now };
      if (!continuous) stopped = true;
      if (navigator.vibrate) navigator.vibrate(80);
      onCodeRef.current(code);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use the camera. Type the code instead.");
        if ("BarcodeDetector" in window) {
          const supported = await window.BarcodeDetector.getSupportedFormats?.().catch(() => FORMATS) ?? FORMATS;
          const detector = new window.BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (stopped) return;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("Point the camera at the barcode");
          const tick = async () => {
            if (stopped) return;
            try {
              const found = await detector.detect(videoRef.current);
              if (found[0]?.rawValue) {
                done(found[0].rawValue);
                if (!continuous) return;
              }
            } catch { /* frame not ready */ }
            timer = setTimeout(tick, 150);
          };
          tick();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          setStatus("Point the camera at the barcode");
          zxingControls = await reader.decodeFromConstraints(
            { video: { facingMode: "environment" }, audio: false },
            videoRef.current,
            (result) => { if (result) done(result.getText()); },
          );
        }
      } catch (err) {
        const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
        setError(denied
          ? "Camera access was refused. Allow the camera for this site in the browser settings, or type the code."
          : err?.name === "NotFoundError" ? "No camera found on this device. Type the code instead." : err.message || "The camera couldn't start.");
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      zxingControls?.stop?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [continuous]);

  return (
    <div className="scanner-backdrop" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <div className="scanner">
        <video ref={videoRef} className="scanner-video" muted playsInline />
        <div className="scanner-frame" aria-hidden="true" />
        <p className="scanner-status" role="status">{error || message || status}</p>
        <button type="button" className="btn-admin-cancel scanner-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
