import crypto from "node:crypto";
import User from "../models/User.js";
import { sendEmail, emailTemplates } from "../services/emailService.js";
import { siteUrl } from "../utils/siteUrl.js";
import { roleOf, permissionsOf } from "../utils/roles.js";
import { PERMISSIONS, STAFF_PERMISSIONS } from "../config/permissions.js";
import { sendServerError } from "../utils/httpErrors.js";
import logger from "../utils/logger.js";

const INVITE_HOURS = 48;
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const staffView = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: roleOf(u),
  addedAt: u.staffAddedAt || null,
  // Invited but hasn't set a password yet.
  invitePending: Boolean(u.inviteTokenHash),
  inviteExpiresAt: u.inviteExpiresAt || null,
});

async function sendInvite(user, owner) {
  const token = crypto.randomBytes(32).toString("hex");
  user.inviteTokenHash = hash(token);
  user.inviteExpiresAt = new Date(Date.now() + INVITE_HOURS * 60 * 60 * 1000);
  await user.save();
  const link = `${siteUrl()}/admin/set-password?token=${token}`;
  const t = emailTemplates.staffInvite(user.name, owner.name, link);
  await sendEmail({ to: user.email, subject: t.subject, html: t.html });
}

// @desc   Owners and staff, plus what staff can do
// @route  GET /api/admin/staff
export const listStaff = async (req, res) => {
  try {
    const people = await User.find({ $or: [{ isAdmin: true }, { role: "staff" }] })
      .select("name email isAdmin role staffAddedAt inviteTokenHash inviteExpiresAt")
      .sort({ isAdmin: -1, name: 1 })
      .lean();
    res.json({
      people: people.map(staffView),
      staffPermissions: STAFF_PERMISSIONS.map((key) => ({ key, label: PERMISSIONS[key] })),
    });
  } catch (error) {
    return sendServerError(res, error, "listStaff error");
  }
};

// @desc   Give someone staff access. An existing account keeps its password
//         and gets a notice; a new email gets an account and a set-password link.
// @route  POST /api/admin/staff   { name, email }
export const addStaff = async (req, res) => {
  try {
    const { name, email } = req.body;
    let user = await User.findOne({ email });

    if (user) {
      if (user.isAdmin) return res.status(400).json({ message: "That person is already an owner." });
      if (user.role === "staff") return res.status(400).json({ message: "That person is already staff." });
      user.role = "staff";
      user.staffAddedBy = req.user._id;
      user.staffAddedAt = new Date();
      await user.save();
      const t = emailTemplates.staffAccessGranted(user.name, req.user.name);
      sendEmail({ to: user.email, subject: t.subject, html: t.html })
        .catch((err) => logger.error({ err }, "staff access email failed"));
      res.locals.activity = { targetType: "staff", targetId: String(user._id), summary: `Gave staff access to ${user.name} (${user.email}), existing account` };
      return res.status(201).json(staffView(user));
    }

    user = new User({
      name,
      email,
      // Unusable until they choose one through the invite link.
      password: crypto.randomBytes(32).toString("hex"),
      authProvider: "local",
      role: "staff",
      staffAddedBy: req.user._id,
      staffAddedAt: new Date(),
    });
    await user.save();
    await sendInvite(user, req.user);
    res.locals.activity = { targetType: "staff", targetId: String(user._id), summary: `Invited ${user.name} (${user.email}) as staff` };
    res.status(201).json(staffView(user));
  } catch (error) {
    return sendServerError(res, error, "addStaff error");
  }
};

// @desc   Send a fresh set-password link (the old one stops working)
// @route  POST /api/admin/staff/:id/resend-invite
export const resendInvite = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: "staff" });
    if (!user) return res.status(404).json({ message: "Staff member not found" });
    if (!user.inviteTokenHash) return res.status(400).json({ message: "They've already set a password." });
    await sendInvite(user, req.user);
    res.locals.activity = { targetType: "staff", summary: `Re-sent the staff invite to ${user.name} (${user.email})` };
    res.json(staffView(user));
  } catch (error) {
    return sendServerError(res, error, "resendInvite error");
  }
};

// @desc   Remove staff access. The account stays (as a customer account);
//         access ends on their next request.
// @route  DELETE /api/admin/staff/:id
export const removeStaff = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "staff") return res.status(404).json({ message: "Staff member not found" });
    user.role = "customer";
    user.inviteTokenHash = undefined;
    user.inviteExpiresAt = undefined;
    await user.save();
    res.locals.activity = { targetType: "staff", summary: `Removed staff access from ${user.name} (${user.email})` };
    res.json({ removed: true });
  } catch (error) {
    return sendServerError(res, error, "removeStaff error");
  }
};

// @desc   A new staff member chooses their password from the invite link
// @route  POST /api/auth/set-password   { token, password }  (public)
export const setPasswordFromInvite = async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ inviteTokenHash: hash(token) });
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      return res.status(400).json({ message: "This link has expired or was already used. Ask the owner to send a new one." });
    }
    user.password = password; // hashed by the model
    user.inviteTokenHash = undefined;
    user.inviteExpiresAt = undefined;
    await user.save();
    res.json({ message: "Password set. You can sign in now.", email: user.email, role: roleOf(user), permissions: permissionsOf(user) });
  } catch (error) {
    return sendServerError(res, error, "setPasswordFromInvite error");
  }
};
