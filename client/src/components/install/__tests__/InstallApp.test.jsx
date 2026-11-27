import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { detectPlatform, openInstall } from "../installPlatform";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  iphoneInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
};

describe("which way a device installs", () => {
  it("tells iPhone Safari, iPhone Chrome, in-app browsers, iPads and Android apart", () => {
    expect(detectPlatform({ ua: UA.iphoneSafari, standalone: false })).toBe("ios-safari");
    expect(detectPlatform({ ua: UA.iphoneChrome, standalone: false })).toBe("ios-other");
    expect(detectPlatform({ ua: UA.iphoneInstagram, standalone: false })).toBe("in-app");
    expect(detectPlatform({ ua: UA.ipad, standalone: false, maxTouchPoints: 5 })).toBe("ios-safari");
    expect(detectPlatform({ ua: UA.ipad, standalone: false, maxTouchPoints: 0 })).toBe("manual"); // a real Mac
    expect(detectPlatform({ ua: UA.android, standalone: false, hasPrompt: true })).toBe("prompt");
    expect(detectPlatform({ ua: UA.iphoneSafari, standalone: true })).toBe("installed");
  });
});

// The component reads the platform when it mounts, so each test loads it fresh.
async function mountWith(ua, props = {}) {
  vi.resetModules();
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
  const { default: InstallApp } = await import("../InstallApp");
  return render(<InstallApp appName="Gracia Fab Admin" icon="/icons/admin-icon-192.png" storageKey="gf-install-test" delay={100} {...props} />);
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("install prompt", () => {
  it("on an iPhone, offers the Share → Add to Home Screen steps", async () => {
    await mountWith(UA.iphoneSafari);
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(screen.getByText("Add Gracia Fab Admin to your home screen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    const sheet = screen.getByRole("dialog", { name: "Add Gracia Fab Admin to your home screen" });
    expect(sheet.textContent).toMatch(/Tap Share.*bottom of Safari/);
    expect(sheet.textContent).toMatch(/Add to Home Screen/);
  });

  it("inside Instagram, says to open the page in Safari first", async () => {
    await mountWith(UA.iphoneInstagram);
    act(() => openInstall());
    expect(screen.getByRole("dialog").textContent).toMatch(/Open in Safari/);
  });

  it("on Android, uses the browser's own install dialog", async () => {
    vi.resetModules();
    Object.defineProperty(window.navigator, "userAgent", { value: UA.android, configurable: true });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    const { default: InstallApp } = await import("../InstallApp");
    const prompt = vi.fn();
    const evt = new Event("beforeinstallprompt");
    evt.prompt = prompt;
    evt.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(evt);
    render(<InstallApp appName="Gracia Fab" icon="/icons/icon-192.png" storageKey="gf-install-test" delay={100} />);
    await act(async () => { vi.advanceTimersByTime(150); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Install" })); });
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByText(/to your home screen/)).toBeNull(); // installed: gone
  });

  it("stays quiet once installed, and for 14 days after Not now", async () => {
    vi.resetModules();
    Object.defineProperty(window.navigator, "userAgent", { value: UA.iphoneSafari, configurable: true });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }); // running from the home screen
    const { default: InstallApp } = await import("../InstallApp");
    const { container } = render(<InstallApp appName="X" icon="/i.png" storageKey="k1" delay={10} />);
    await act(async () => { vi.advanceTimersByTime(50); });
    expect(container.ownerDocument.querySelector(".install-banner")).toBeNull();

    document.body.innerHTML = "";
    await mountWith(UA.iphoneSafari, { storageKey: "k2" });
    await act(async () => { vi.advanceTimersByTime(150); });
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(Number(localStorage.getItem("k2"))).toBeGreaterThan(0);
  });

  it("waits for the guided tour to finish first", async () => {
    let tourDone = false;
    await mountWith(UA.iphoneSafari, { waitFor: () => tourDone });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.queryByText(/to your home screen/)).toBeNull();
    tourDone = true;
    await act(async () => { window.dispatchEvent(new Event("gf:tour-closed")); vi.advanceTimersByTime(2000); });
    expect(screen.getByText("Add Gracia Fab Admin to your home screen")).toBeInTheDocument();
  });
});
