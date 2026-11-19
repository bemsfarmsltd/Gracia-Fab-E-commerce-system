import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const send = vi.fn(async () => ({ error: null }));
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send } })) }));

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
    }));
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
