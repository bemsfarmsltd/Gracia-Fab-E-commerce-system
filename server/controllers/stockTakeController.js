import StockTake from "../models/StockTake.js";
import {
  startStockTake, scanIntoCount, setCount, addToCount, removeLine, preview, completeStockTake, cancelStockTake, StockTakeError,
} from "../services/stockTake.js";
import { sendServerError } from "../utils/httpErrors.js";

const isId = (v) => typeof v === "string" && /^[0-9a-f]{24}$/.test(v);

const fail = (res, error, context) => {
  if (error instanceof StockTakeError) return res.status(error.status).json({ message: error.message });
  return sendServerError(res, error, context);
};

async function withPreview(take) {
  const plain = take.toObject ? take.toObject() : take;
  const { lines, ...rest } = plain;
  return { ...rest, ...(await preview(plain)) };
}

const guardId = (req, res) => {
  if (isId(req.params.id)) return true;
  res.status(404).json({ message: "Stock take not found" });
  return false;
};

// @route  GET /api/admin/stocktakes/current   → the open count (or null)
export const getCurrent = async (req, res) => {
  try {
    const take = await StockTake.findOne({ status: "open" }).lean();
    res.json(take ? await withPreview(take) : null);
  } catch (error) {
    return fail(res, error, "getCurrent stocktake error");
  }
};

// @route  GET /api/admin/stocktakes   → past counts, newest first
export const listStockTakes = async (req, res) => {
  try {
    const items = await StockTake.find({}).select("name category status startedByName completedByName createdAt completedAt totals zeroedUncounted").sort({ createdAt: -1 }).limit(50).lean();
    res.json({ items });
  } catch (error) {
    return fail(res, error, "listStockTakes error");
  }
};

// @route  GET /api/admin/stocktakes/:id   → one count with its results
export const getStockTake = async (req, res) => {
  try {
    if (!guardId(req, res)) return;
    const take = await StockTake.findById(req.params.id).lean();
    if (!take) return res.status(404).json({ message: "Stock take not found" });
    res.json(take.status === "open" ? await withPreview(take) : take);
  } catch (error) {
    return fail(res, error, "getStockTake error");
  }
};

// @route  POST /api/admin/stocktakes   { name, category? }
export const postStockTake = async (req, res) => {
  try {
    const take = await startStockTake(req.body, req.user);
    res.locals.activity = { targetType: "stocktake", targetId: String(take._id), summary: `Started stock take "${take.name}"${take.category ? ` (${take.category})` : ""}` };
    res.status(201).json(await withPreview(take));
  } catch (error) {
    return fail(res, error, "postStockTake error");
  }
};

// @route  POST /api/admin/stocktakes/:id/scan   { code }   (+1)
export const postScan = async (req, res) => {
  try {
    if (!guardId(req, res)) return;
    const { take, product } = await scanIntoCount(req.params.id, req.body.code, req.user);
    const line = take.lines.find((l) => String(l.product) === String(product._id));
    res.json({ product: { _id: product._id, name: product.name }, counted: line?.counted ?? 0 });
  } catch (error) {
    return fail(res, error, "postScan error");
  }
};

// @route  PUT /api/admin/stocktakes/:id/lines/:productId   { counted }   or   { by }
export const putLine = async (req, res) => {
  try {
    if (!guardId(req, res)) return;
    if (!isId(req.params.productId)) return res.status(404).json({ message: "Product not found" });
    const { take } = typeof req.body.by === "number"
      ? await addToCount(req.params.id, req.params.productId, req.body.by, req.user)
      : await setCount(req.params.id, req.params.productId, req.body.counted, req.user);
    // A line taken below 0 by "−1" taps stays at 0.
    const line = take.lines.find((l) => String(l.product) === req.params.productId);
    if (line && line.counted < 0) {
      const { take: fixed } = await setCount(req.params.id, req.params.productId, 0, req.user);
      return res.json(await withPreview(fixed));
    }
    res.json(await withPreview(take));
  } catch (error) {
    return fail(res, error, "putLine error");
  }
};

// @route  DELETE /api/admin/stocktakes/:id/lines/:productId   (uncount)
export const deleteLine = async (req, res) => {
  try {
    if (!guardId(req, res)) return;
    const take = await removeLine(req.params.id, req.params.productId);
    res.json(await withPreview(take));
  } catch (error) {
    return fail(res, error, "deleteLine error");
  }
};

// @route  POST /api/admin/stocktakes/:id/complete   { zeroUncounted? }   (owner)
export const postComplete = async (req, res) => {
  try {
    if (!guardId(req, res)) return;
    const take = await completeStockTake(req.params.id, req.body, req.user);
    res.locals.activity = {
      targetType: "stocktake",
      summary: `Approved stock take "${take.name}": ${take.totals.missingUnits} unit(s) missing, ${take.totals.extraUnits} extra, across ${take.totals.products} product(s)${take.zeroedUncounted ? "; uncounted products set to 0" : ""}`,
      changes: { totals: take.totals },
    };
    res.json(take);
  } catch (error) {
    return fail(res, error, "postComplete error");
  }
};

// @route  POST /api/admin/stocktakes/:id/cancel   (owner; nothing changes)
export const postCancel = async (req, res) => {
  try {
    if (!guardId(req, res)) return;
    const take = await cancelStockTake(req.params.id);
    res.locals.activity = { targetType: "stocktake", summary: `Cancelled stock take "${take.name}" (no stock changed)` };
    res.json(take);
  } catch (error) {
    return fail(res, error, "postCancel error");
  }
};
