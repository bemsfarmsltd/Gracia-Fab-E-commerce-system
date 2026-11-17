import Voucher from "../models/Voucher.js";
import logger from "../utils/logger.js";
import { sendServerError } from "../utils/httpErrors.js";
import { checkVoucher, describeVoucher, VoucherError } from "../services/vouchers.js";

// @desc   Vouchers to advertise on product pages (active, not expired)
// @route  GET /api/vouchers/public
export const getPublicVouchers = async (req, res) => {
  try {
    const now = new Date();
    const vouchers = await Voucher.find({
      active: true,
      showOnProductPage: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
      ],
    }).sort({ createdAt: 1 });

    res.json(
      vouchers
        .filter((v) => !v.usageLimit || v.usedCount < v.usageLimit)
        .map(describeVoucher),
    );
  } catch (error) {
    logger.error({ err: error }, "getPublicVouchers error");
    res.status(500).json({ message: "Couldn't load vouchers" });
  }
};

// @desc   Preview a code at checkout (the order is re-checked on creation)
// @route  POST /api/vouchers/validate
export const validateVoucher = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const { voucher, discount } = await checkVoucher({
      code,
      userId: req.user._id,
      itemsPrice: subtotal,
    });
    res.json({ ...describeVoucher(voucher), discount });
  } catch (error) {
    if (error instanceof VoucherError) {
      return res.status(400).json({ message: error.message });
    }
    logger.error({ err: error }, "validateVoucher error");
    res.status(500).json({ message: "Couldn't check that code. Please try again." });
  }
};

// ── Admin ──

// @route  GET /api/admin/vouchers
export const listVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    res.json(vouchers.map((v) => ({ ...v.toObject(), ...describeVoucher(v) })));
  } catch (error) {
    return sendServerError(res, error, "voucherController error");
  }
};

// @route  POST /api/admin/vouchers
export const createVoucher = async (req, res) => {
  try {
    if (await Voucher.exists({ code: req.body.code })) {
      return res.status(400).json({ message: `A voucher with code ${req.body.code} already exists` });
    }
    const voucher = await Voucher.create(req.body);
    res.status(201).json({ ...voucher.toObject(), ...describeVoucher(voucher) });
  } catch (error) {
    return sendServerError(res, error, "voucherController error");
  }
};

// @route  PUT /api/admin/vouchers/:id
export const updateVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });
    if (req.body.code && req.body.code !== voucher.code) {
      if (await Voucher.exists({ code: req.body.code })) {
        return res.status(400).json({ message: `A voucher with code ${req.body.code} already exists` });
      }
    }
    Object.assign(voucher, req.body);
    await voucher.save();
    res.json({ ...voucher.toObject(), ...describeVoucher(voucher) });
  } catch (error) {
    return sendServerError(res, error, "voucherController error");
  }
};

// @route  DELETE /api/admin/vouchers/:id
export const deleteVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });
    res.json({ message: "Voucher deleted" });
  } catch (error) {
    return sendServerError(res, error, "voucherController error");
  }
};
