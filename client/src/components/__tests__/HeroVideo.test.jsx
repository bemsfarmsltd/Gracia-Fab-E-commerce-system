import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import HeroVideo, {
  HERO_POSTER,
  HERO_VIDEO_DESKTOP,
  HERO_MOBILE_STILL,
} from "../HeroVideo";

function setMedia({ narrow = false, reducedMotion = false } = {}) {
  window.matchMedia = vi.fn((q) => ({
    matches: q.includes("max-width") ? narrow : q.includes("reduce") ? reducedMotion : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("HeroVideo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "readyState", { configurable: true, get: () => "complete" });
    Object.defineProperty(navigator, "connection", { configurable: true, value: undefined });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the still image at once on desktop and only adds the video after the page has loaded", () => {
    setMedia();
    const { container } = render(<HeroVideo className="ysl-hero-video" />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video.getAttribute("poster")).toBe(HERO_POSTER);
    expect(video.getAttribute("src")).toBeNull();

    act(() => vi.advanceTimersByTime(300));
    expect(video.getAttribute("src")).toBe(HERO_VIDEO_DESKTOP);
  });

  it("renders a Cloudinary still image and no video on phones (<=768px)", () => {
    setMedia({ narrow: true });
    const { container } = render(<HeroVideo className="ysl-hero-video" />);
    act(() => vi.advanceTimersByTime(2000));

    expect(container.querySelector("video")).toBeNull();
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe(HERO_MOBILE_STILL);
    expect(img.getAttribute("src")).toContain("so_2,c_fill,g_auto,ar_9:16,w_828,q_auto,f_auto");
    expect(img.className).toContain("ysl-hero-still");
  });

  it("keeps just the still poster on desktop with data saver or reduced motion", () => {
    setMedia({ reducedMotion: true });
    const a = render(<HeroVideo />);
    act(() => vi.advanceTimersByTime(300));
    expect(a.container.querySelector("video").getAttribute("src")).toBeNull();
    a.unmount();

    setMedia();
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
    const b = render(<HeroVideo />);
    act(() => vi.advanceTimersByTime(300));
    expect(b.container.querySelector("video").getAttribute("src")).toBeNull();
  });
});
