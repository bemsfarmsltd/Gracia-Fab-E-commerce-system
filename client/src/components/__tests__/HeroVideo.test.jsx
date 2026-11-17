import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import HeroVideo, { HERO_POSTER, HERO_VIDEO_DESKTOP, HERO_VIDEO_MOBILE } from "../HeroVideo";

function setMedia({ narrow = false, reducedMotion = false } = {}) {
  window.matchMedia = vi.fn((q) => ({
    matches: q.includes("max-width") ? narrow : q.includes("reduce") ? reducedMotion : false,
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

  it("shows the still image at once and only adds the video after the page has loaded", () => {
    setMedia();
    const { container } = render(<HeroVideo className="ysl-hero-video" />);
    const video = container.querySelector("video");
    expect(video.getAttribute("poster")).toBe(HERO_POSTER);
    expect(video.getAttribute("src")).toBeNull();

    act(() => vi.advanceTimersByTime(300));
    expect(video.getAttribute("src")).toBe(HERO_VIDEO_DESKTOP);
  });

  it("serves the smaller video on phones", () => {
    setMedia({ narrow: true });
    const { container } = render(<HeroVideo />);
    act(() => vi.advanceTimersByTime(300));
    expect(container.querySelector("video").getAttribute("src")).toBe(HERO_VIDEO_MOBILE);
  });

  it("keeps just the still image with data saver or reduced motion", () => {
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
