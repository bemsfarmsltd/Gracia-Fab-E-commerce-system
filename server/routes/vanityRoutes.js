import express from "express";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { getVanity, updateBeautyProfile, clearBeautyProfile } from "../controllers/vanityController.js";
import { beautyProfileSchema } from "../validators/vanityValidators.js";

// My Vanity: the logged-in customer's private page. Every route is theirs only.
const router = express.Router();

router.get("/", protect, getVanity);
router.put("/profile", protect, validate(beautyProfileSchema), updateBeautyProfile);
router.delete("/profile", protect, clearBeautyProfile);

export default router;
