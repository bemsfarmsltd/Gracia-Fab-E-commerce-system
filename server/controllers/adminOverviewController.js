import { buildOverview } from "../services/adminOverview.js";
import { sendServerError } from "../utils/httpErrors.js";

// @desc   Figures for the admin Overview (see services/adminOverview.js)
// @route  GET /api/admin/overview
export const getOverview = async (req, res) => {
  try {
    res.json(await buildOverview());
  } catch (error) {
    return sendServerError(res, error, "getOverview error");
  }
};
