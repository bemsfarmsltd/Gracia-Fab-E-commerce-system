import { describe, it, expect, afterEach, vi } from "vitest";
import { geminiModel, groqModel, STORE_FACTS } from "../config/ai.js";

afterEach(() => vi.unstubAllEnvs());

describe("AI settings", () => {
  it("use the defaults unless Render sets a model", () => {
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubEnv("GROQ_MODEL", "");
    expect(geminiModel()).toBe("gemini-2.0-flash");
    expect(groqModel()).toBe("llama-3.1-8b-instant");
    vi.stubEnv("GEMINI_MODEL", "gemini-new");
    vi.stubEnv("GROQ_MODEL", "llama-new");
    expect(geminiModel()).toBe("gemini-new");
    expect(groqModel()).toBe("llama-new");
  });

  it("give the assistant the owner's facts and a rule against inventing", () => {
    for (const fact of ["Bems Group", "2024", "Umuahia North", "8am to 6pm", "wig installs", "bridal makeup", "consultations with the MD", "₦2,500"]) {
      expect(STORE_FACTS).toContain(fact);
    }
    expect(STORE_FACTS).toMatch(/don't invent/i);
  });
});
