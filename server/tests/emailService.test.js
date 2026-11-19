import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const send = vi.fn(async () => ({ error: null }));
// A class, because the code calls `new Resend(...)` (Vitest 4+ won't `new` an arrow mock).
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const load = async () => {
  vi.resetModules();
  return import("../services/emailService.js");
};

describe("sendEmail sender settings", () => {
  beforeEach(() => {
    send.mockClear();
    vi.stubEnv("RESEND_API_KEY", "re_test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends from the verified domain and sets reply-to when configured", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "Gracia Fab <orders@graciafab.com>");
    vi.stubEnv("RESEND_REPLY_TO", "shop@example.com");
    const { sendEmail } = await load();

    await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>" });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      from: "Gracia Fab <orders@graciafab.com>",
      replyTo: "shop@example.com",
      text: "x",
    }));
  });

  it("sends a plain-text part, escapes names and keeps emojis out of subjects", async () => {
    const { sendEmail, emailTemplates } = await load();
    const t = emailTemplates.loginOtp("<b>Ada</b>", "123456");
    expect(t.html).toContain("&lt;b&gt;Ada&lt;/b&gt;");

    await sendEmail({ to: "a@b.com", ...t });
    const { text } = send.mock.calls[0][0];
    expect(text).toContain("123456");
    expect(text).not.toMatch(/<(div|p|h1)\b|style=/);

    const subjects = [
      emailTemplates.orderConfirmed("A", "1", 100, []),
      emailTemplates.orderShipped("A", "1"),
      emailTemplates.orderDelivered("A"),
      emailTemplates.welcome("A"),
    ].map((x) => x.subject);
    for (const s of subjects) expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("leaves reply-to out, and doesn't invite replies, when no inbox is set", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "Gracia Fab <orders@graciafab.com>");
    vi.stubEnv("RESEND_REPLY_TO", "");
    const { sendEmail, emailTemplates } = await load();

    await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>" });
    expect(send.mock.calls[0][0]).not.toHaveProperty("replyTo");

    const { html } = emailTemplates.orderCancelled("Ada", "1", 0);
    expect(html).toContain("message us on WhatsApp");
    expect(html).not.toMatch(/reply to this email/);

    vi.stubEnv("RESEND_REPLY_TO", "shop@example.com");
    expect(emailTemplates.orderCancelled("Ada", "1", 0).html).toMatch(/reply to this email/);
  });
});
