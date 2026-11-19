import { describe, it, expect } from "vitest";
import { htmlToText } from "../utils/htmlToText.js";

describe("htmlToText", () => {
  it("keeps the words, links and line breaks of an email", () => {
    const html = `<style>p{color:red}</style><div><h1>Gracia Fab</h1><p>Hi Ada,<br>your order is &amp; ready.</p>
      <ul><li>Glow Serum</li><li>Body Butter</li></ul>
      <a href="https://www.graciafab.com/my-orders" style="x">Track My Order &rarr;</a></div>`;
    expect(htmlToText(html)).toBe(
      "Gracia Fab\nHi Ada,\nyour order is & ready.\n\n- Glow Serum\n- Body Butter\n\nTrack My Order → (https://www.graciafab.com/my-orders)",
    );
  });

  it("decodes numeric entities and drops empty markup", () => {
    expect(htmlToText("<p>It&#39;s &#8358;5,000</p><img src=x>")).toBe("It's ₦5,000");
    expect(htmlToText(undefined)).toBe("");
  });
});
