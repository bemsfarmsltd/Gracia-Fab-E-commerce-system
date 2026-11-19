import { unsubscribeUrl, unsubscribeHeaders } from "../utils/unsubscribe.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Groq from "groq-sdk";
import { addToQueue, emailQueue } from "../queues/index.js";
import logger from "../utils/logger.js";
import { siteUrl, siteHost } from "../utils/siteUrl.js";

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let groqClient = null;
const getGroq = () => {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
};

// Generate personalized email content with AI
const generateEmailContent = async (userName, products, topCategory) => {
  try {
    const productList = products
      .map((p) => `${p.name} (₦${p.price?.toLocaleString()})`)
      .join(", ");

    const completion = await getGroq().chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Write a short, friendly beauty email for a Nigerian beauty store customer.

Customer name: ${userName}
They've been viewing: ${topCategory} products
Recommended products: ${productList}

Requirements:
- 2-3 short sentences max
- Warm and encouraging tone
- Mention 1-2 products naturally
- End with a call to action
- No emojis in the subject line

Return ONLY JSON: {"subject": "...", "body": "..."}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      max_tokens: 250,
      temperature: 0.6,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
};

// @desc  Send marketing emails to interested users
//        Run this via a scheduled job or manually
export const sendMarketingEmails = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find users with recent interests who haven't received email this week
    const users = await User.find({
      "interests.0": { $exists: true },
      "emailPreferences.marketing": { $ne: false },
      $or: [
        { "emailPreferences.lastSent": { $lt: oneWeekAgo } },
        { "emailPreferences.lastSent": { $exists: false } },
      ],
    }).limit(50);

    logger.info({ userCount: users.length }, "Processing users for marketing emails");
    let sent = 0;

    for (const user of users) {
      try {
        // Find their top interest category
        const categoryCounts = {};
        for (const interest of user.interests || []) {
          categoryCounts[interest.category] =
            (categoryCounts[interest.category] || 0) + interest.viewCount;
        }
        const topCategory = Object.entries(categoryCounts).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0];

        if (!topCategory) continue;

        // Get recommended products for their interests
        const viewedIds = (user.interests || [])
          .map((i) => i.productId?.toString())
          .filter(Boolean);
        const products = await Product.find({
          category: topCategory,
          _id: { $nin: viewedIds }, // Don't recommend what they already saw
        })
          .sort({ rating: -1 })
          .limit(3)
          .lean();

        if (products.length === 0) continue;

        // Generate AI email content
        const content = await generateEmailContent(
          user.name?.split(" ")[0] || "Beauty Lover",
          products,
          topCategory,
        );

        if (!content) continue;

        // Build HTML email
        const html = `
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
            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #8E3B14; margin-top: 5px;">Your Beauty Update</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 32px 28px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #241310;">
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #3A241E;">${escapeHtml(content.body)}</p>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px 0;">
              <tr>
                ${products
                  .map(
                    (p) => `
                  <td width="33%" align="center" valign="top" style="padding: 0 6px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF4EB; border: 1px solid #EEDCBE; border-radius: 6px; overflow: hidden; text-align: center;">
                      <tr>
                        <td align="center" style="padding: 0; background-color: #F5E7D2;">
                          <img src="${p.image}" alt="${escapeHtml(p.name)}" width="170" height="130" style="display: block; width: 100%; max-width: 170px; height: 130px; object-fit: cover; border: 0;" />
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 10px 8px;">
                          <p style="margin: 0 0 4px 0; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #241310; line-height: 1.3;">${escapeHtml(p.name)}</p>
                          <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; font-weight: bold; color: #7A2432;">₦${p.price?.toLocaleString()}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                `,
                  )
                  .join("")}
              </tr>
            </table>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto 0 auto;">
              <tr>
                <td align="center" bgcolor="#7A2432" style="border-radius: 6px; background-color: #7A2432;">
                  <a href="${siteUrl()}/products?category=${encodeURIComponent(topCategory)}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #FFFFFF; text-decoration: none; border-radius: 6px; background-color: #7A2432; letter-spacing: 0.5px;">
                    Shop Now &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 24px 24px 28px 24px; background-color: #FAF4EB; border-top: 1px solid #F0E2D0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; color: #6E4F45;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #52362F;">Gracia Fab &middot; Umuahia, Abia State, Nigeria</p>
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6E4F45;">
              You&#39;re receiving this because you&#39;re a Gracia Fab member.
              <a href="${unsubscribeUrl(user._id)}" style="color: #7A2432; text-decoration: underline;">Unsubscribe</a>
            </p>
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
</table>`;

        // Queue the email
        await addToQueue(emailQueue, "marketing-email", {
          to: user.email,
          subject: content.subject,
          html,
          type: "marketing",
          headers: unsubscribeHeaders(user._id),
        });

        // Update last sent date
        user.emailPreferences = {
          ...(user.emailPreferences || {}),
          lastSent: new Date(),
        };
        await user.save();
        sent++;
      } catch (userErr) {
        logger.error({ err: userErr, email: user.email }, "Marketing email failed for user");
      }
    }

    logger.info({ sent }, "Queued marketing emails");
    return sent;
  } catch (err) {
    logger.error({ err }, "Marketing email batch error");
    throw err;
  }
};
