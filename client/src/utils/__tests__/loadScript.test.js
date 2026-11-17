import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "../loadScript";

describe("loadScript", () => {
  beforeEach(() => {
    document.head.querySelectorAll("script[data-test]").forEach((s) => s.remove());
    document.head.querySelectorAll("script").forEach((s) => s.remove());
  });

  it("does nothing when the script's global is already available", async () => {
    await loadScript("https://cdn.example.com/a.js", { isReady: () => true });
    expect(document.head.querySelector('script[src="https://cdn.example.com/a.js"]')).toBeNull();
  });

  it("adds the script once, even when requested several times", async () => {
    const p1 = loadScript("https://cdn.example.com/b.js");
    const p2 = loadScript("https://cdn.example.com/b.js");
    const tags = document.head.querySelectorAll('script[src="https://cdn.example.com/b.js"]');
    expect(tags).toHaveLength(1);
    expect(tags[0].async).toBe(true);
    tags[0].onload();
    await expect(Promise.all([p1, p2])).resolves.toBeDefined();
  });

  it("rejects on failure and allows a retry", async () => {
    const p = loadScript("https://cdn.example.com/c.js");
    document.head.querySelector('script[src="https://cdn.example.com/c.js"]').onerror();
    await expect(p).rejects.toThrow(/Couldn't load/);

    loadScript("https://cdn.example.com/c.js");
    expect(document.head.querySelectorAll('script[src="https://cdn.example.com/c.js"]')).toHaveLength(1);
  });
});
