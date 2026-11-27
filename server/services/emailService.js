import { Resend } from "resend";
import logger from "../utils/logger.js";
import { siteUrl, siteHost } from "../utils/siteUrl.js";
import { htmlToText } from "../utils/htmlToText.js";

// Customer-supplied text (e.g. names) going into HTML emails.
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Sends over HTTPS via Resend's API rather than raw SMTP — Render (and most
// PaaS hosts) block outbound SMTP ports (25/465/587) to prevent spam relay
// abuse, so a direct nodemailer/Gmail connection can never succeed there.
// RESEND_FROM_EMAIL is the sender on the verified graciafab.com domain
// (e.g. "Gracia Fab <orders@graciafab.com>"); without it, Resend's test sender
// onboarding@resend.dev is used. graciafab.com has no inbox, so replies only
// reach someone when RESEND_REPLY_TO is set to a real mailbox.
let resend = null;

const getClient = () => {
  if (resend) return resend;

  if (!process.env.RESEND_API_KEY) {
    logger.warn("No RESEND_API_KEY — emails will be logged only");
    return null;
  }

  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
};

export const sendEmail = async ({ to, subject, html, text, headers }) => {
  const client = getClient();

  if (!client) {
    logger.info({ to, subject }, "No email client configured — email not sent");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "Gracia Fab Beauty <onboarding@resend.dev>";

  const replyTo = process.env.RESEND_REPLY_TO?.trim();

  const { error } = await client.emails.send({
    from,
    to,
    subject,
    html,
    // Plain-text part: HTML-only mail is more likely to land in spam.
    text: text || htmlToText(html),
    ...(replyTo ? { replyTo } : {}),
    ...(headers ? { headers } : {}),
  });

  if (error) {
    logger.error({ err: error, to }, "Email failed");
    throw new Error(error.message || "Email send failed");
  }

  logger.info({ to }, "Email sent");
};

// ── Email templates
const emailShell = ({ headline, content, cta, reason }) => `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FBF3E7; table-layout: fixed; margin: 0; padding: 0;">
  <tr>
    <td align="center" style="padding: 24px 12px 36px 12px; background-color: #FBF3E7;">
      <!--[if (gte mso 9)|(IE)]>
      <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
      <tr>
      <td align="center" valign="top" width="600">
      <![endif]-->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #EEDCBE; overflow: hidden; text-align: left;">
        <tr>
          <td align="center" style="padding: 28px 24px 20px 24px; background-color: #FAF4EB; border-bottom: 1px solid #F0E2D0;">
            <a href="${siteUrl()}" target="_blank" style="text-decoration: none;">
              <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: normal; letter-spacing: 3px; color: #7A2432; text-transform: uppercase; display: inline-block;">GRACIA FAB</span>
            </a>
            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #8E3B14; margin-top: 5px;">Luxury Beauty &amp; Wellness</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 32px 28px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #241310;">
            ${headline ? `<h2 style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: normal; color: #7A2432; line-height: 1.3;">${headline}</h2>` : ""}
            ${content}
            ${
              cta
                ? `
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto 0 auto;">
              <tr>
                <td align="center" bgcolor="#7A2432" style="border-radius: 6px; background-color: #7A2432;">
                  <a href="${cta.url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #FFFFFF; text-decoration: none; border-radius: 6px; background-color: #7A2432; letter-spacing: 0.5px;">
                    ${cta.label}
                  </a>
                </td>
              </tr>
            </table>`
                : ""
            }
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 24px 24px 28px 24px; background-color: #FAF4EB; border-top: 1px solid #F0E2D0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; color: #6E4F45;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #52362F;">Gracia Fab &middot; Umuahia, Abia State, Nigeria</p>
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6E4F45;">${reason}</p>
            <p style="margin: 0; font-size: 12px;">
              <a href="${siteUrl()}" target="_blank" style="color: #7A2432; text-decoration: underline;">${siteHost()}</a>
            </p>
          </td>
        </tr>
      </table>
      <!--[if (gte mso 9)|(IE)]>
      </td>
      </tr>
      </table>
      <![endif]-->
    </td>
  </tr>
</table>
`;

export const emailTemplates = {
  orderConfirmed: (name, orderId, total, items) => ({
    subject: `Order confirmed: #${orderId} | Gracia Fab`,
    html: emailShell({
      headline: "Order Confirmed",
      reason: "You're receiving this because you placed an order at Gracia Fab.",
      cta: {
        label: "Track My Order",
        url: `${siteUrl()}/my-orders`,
      },
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Hi <strong style="color: #7A2432;">${escapeHtml(name)}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #3A241E;">
          Thank you for shopping with Gracia Fab. Your order has been confirmed and our team is preparing it for delivery.
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF4EB; border: 1px solid #EEDCBE; border-radius: 6px; margin: 0 0 24px 0;">
          <tr>
            <td style="padding: 16px 20px;">
              <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #8E3B14; margin-bottom: 4px;">ORDER REFERENCE</div>
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: bold; color: #7A2432;">#${orderId}</div>
            </td>
          </tr>
        </table>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 0 0 8px 0;">
          <thead>
            <tr>
              <th align="left" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8E3B14; border-bottom: 1px solid #EEDCBE;">Item</th>
              <th align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8E3B14; border-bottom: 1px solid #EEDCBE;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(items || [])
              .map(
                (item) => `
              <tr>
                <td style="padding: 12px 0; font-family: Arial, sans-serif; font-size: 14px; color: #241310; border-bottom: 1px solid #F0E2D0; line-height: 1.4;">
                  ${escapeHtml(item.name)} × ${item.quantity}
                </td>
                <td align="right" style="padding: 12px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; color: #241310; border-bottom: 1px solid #F0E2D0; white-space: nowrap;">
                  ₦${(item.price * item.quantity).toLocaleString()}
                </td>
              </tr>
            `,
              )
              .join("")}
            <tr>
              <td style="padding: 16px 0 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: bold; color: #7A2432;">
                Total
              </td>
              <td align="right" style="padding: 16px 0 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: bold; color: #7A2432; white-space: nowrap;">
                ₦${total.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      `,
    }),
  }),

  orderShipped: (name, orderId) => ({
    subject: `Your order #${orderId} is on its way | Gracia Fab`,
    html: emailShell({
      headline: "Your Order Is on Its Way",
      reason: "You're receiving this because you placed an order at Gracia Fab.",
      cta: {
        label: "Track Order",
        url: `${siteUrl()}/my-orders`,
      },
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Hi <strong style="color: #7A2432;">${escapeHtml(name)}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #3A241E;">
          Great news! Your Gracia Fab order <strong style="color: #7A2432;">#${orderId}</strong> has been shipped and is on its way to your delivery address.
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF4EB; border: 1px solid #EEDCBE; border-radius: 6px; margin: 0 0 20px 0;">
          <tr>
            <td style="padding: 16px 20px;">
              <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #8E3B14; margin-bottom: 4px;">ORDER REFERENCE</div>
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: bold; color: #7A2432;">#${orderId}</div>
            </td>
          </tr>
        </table>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #52362F;">
          You can track the progress of your delivery or view your receipt anytime in your Gracia Fab account.
        </p>
      `,
    }),
  }),

  orderCancelled: (name, orderId, refundAmount) => ({
    subject: `Order #${orderId} cancelled | Gracia Fab`,
    html: emailShell({
      headline: "Order Cancelled",
      reason: `You're receiving this regarding your order #${orderId}.`,
      cta: {
        label: "View My Orders",
        url: `${siteUrl()}/my-orders`,
      },
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Hi <strong style="color: #7A2432;">${escapeHtml(name)}</strong>,
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #3A241E;">
          Your Gracia Fab order <strong>#${orderId}</strong> has been cancelled.
        </p>
        ${
          refundAmount
            ? `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">A refund of <strong style="color: #7A2432;">₦${refundAmount.toLocaleString()}</strong> will be sent to your original payment method. We'll email you when it's on its way.</p>`
            : ""
        }
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #52362F;">
          If you have any questions, ${process.env.RESEND_REPLY_TO?.trim() ? "just reply to this email or " : ""}message us on WhatsApp.
        </p>
      `,
    }),
  }),

  refundSent: (name, orderId, amount) => ({
    subject: `Refund sent for order #${orderId} | Gracia Fab`,
    html: emailShell({
      headline: "Your Refund Is on Its Way",
      reason: `You're receiving this regarding your refund on order #${orderId}.`,
      cta: {
        label: "View My Orders",
        url: `${siteUrl()}/my-orders`,
      },
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Hi <strong style="color: #7A2432;">${escapeHtml(name)}</strong>,
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #3A241E;">
          We've sent your refund of <strong style="color: #7A2432;">₦${amount.toLocaleString()}</strong> for order <strong>#${orderId}</strong>.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #52362F;">
          Depending on your bank, it can take a few working days to show in your account.
        </p>
      `,
    }),
  }),

  orderDelivered: (name) => ({
    subject: `Your order has been delivered | Gracia Fab`,
    html: emailShell({
      headline: "Your Order Has Arrived",
      reason: "You're receiving this because you placed an order at Gracia Fab.",
      cta: {
        label: "View My Orders",
        url: `${siteUrl()}/my-orders`,
      },
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Hi <strong style="color: #7A2432;">${escapeHtml(name)}</strong>,
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #3A241E;">
          Your Gracia Fab order has arrived. We hope you love your new beauty selections.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #52362F;">
          Don't forget to leave a review — it helps other beauty lovers discover their perfect match.
        </p>
      `,
    }),
  }),

  loginOtp: (name, code) => ({
    subject: `Your Gracia Fab verification code: ${code}`,
    html: emailShell({
      headline: "Sign-In Verification",
      reason: "You're receiving this because a sign-in verification code was requested.",
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Hi <strong style="color: #7A2432;">${escapeHtml(name)}</strong>, enter this code to finish signing in:
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" align="center" style="margin: 20px 0;">
          <tr>
            <td align="center" style="background-color: #FAF4EB; border: 1px solid #EEDCBE; border-radius: 6px; padding: 20px 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #7A2432; display: inline-block;">${code}</span>
            </td>
          </tr>
        </table>
        <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.5; color: #6E4F45; text-align: center;">
          This code expires in 10 minutes. If you didn't try to sign in, you can safely ignore this email.
        </p>
      `,
    }),
  }),

  // A new staff member with no account: set a password to start.
  staffInvite: (name, ownerName, link) => ({
    subject: "You've been added to the Gracia Fab staff portal",
    html: emailShell({
      headline: "Welcome to the Team",
      reason: `You're receiving this because ${escapeHtml(ownerName)} added you as Gracia Fab staff.`,
      cta: { label: "Set my password", url: link },
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Hi <strong style="color: #7A2432;">${escapeHtml(name)}</strong>,
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #3A241E;">
          ${escapeHtml(ownerName)} has given you access to the Gracia Fab staff portal. Choose a password with the button below, then sign in at <strong>${escapeHtml(siteHost())}/admin</strong>. Each time you sign in we'll also email you a 6-digit code.
        </p>
        <p style="margin: 0 0 0 0; font-size: 13px; line-height: 1.5; color: #6E4F45;">
          The link works once and expires in 48 hours. If you weren't expecting this, you can ignore this email.
        </p>
      `,
    }),
  }),

  // An existing account was given staff access: same password as before.
  staffAccessGranted: (name, ownerName) => ({
    subject: "You now have access to the Gracia Fab staff portal",
    html: emailShell({
      headline: "Staff Access Added",
      reason: `You're receiving this because ${escapeHtml(ownerName)} gave your account staff access.`,
      cta: { label: "Open the staff portal", url: `${siteUrl()}/admin` },
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Hi <strong style="color: #7A2432;">${escapeHtml(name)}</strong>,
        </p>
        <p style="margin: 0 0 0 0; font-size: 15px; line-height: 1.6; color: #3A241E;">
          ${escapeHtml(ownerName)} has given your Gracia Fab account access to the staff portal. Sign in at <strong>${escapeHtml(siteHost())}/admin</strong> with your usual email and password, plus the 6-digit code we email you.
        </p>
      `,
    }),
  }),

  welcome: (name) => ({
    subject: `Welcome to Gracia Fab, ${name}`,
    html: emailShell({
      headline: "Thoughtful Beauty for Every Complexion",
      reason: "You're receiving this because you created an account with Gracia Fab.",
      cta: {
        label: "Get My Recommendations",
        url: `${siteUrl()}/recommend`,
      },
      content: `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #241310;">
          Welcome, <strong style="color: #7A2432;">${escapeHtml(name)}</strong>!
        </p>
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #3A241E;">
          Thank you for joining Gracia Fab. We curate authentic beauty, premium hair care, and skincare formulated to celebrate and nurture African complexions.
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF4EB; border: 1px solid #EEDCBE; border-radius: 6px; margin: 0 0 20px 0;">
          <tr>
            <td style="padding: 18px 24px;">
              <ul style="margin: 0; padding-left: 18px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #3A241E;">
                <li style="margin-bottom: 4px;">Personalized skincare and undertone matching</li>
                <li style="margin-bottom: 4px;">Authentic formulations with verified ingredients</li>
                <li>Earn loyalty points with every beauty order</li>
              </ul>
            </td>
          </tr>
        </table>
      `,
    }),
  }),
};
