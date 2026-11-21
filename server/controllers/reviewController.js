import Review from "../models/Review.js";
import Product from "../models/Product.js";
import { sendServerError } from "../utils/httpErrors.js";
import { recalculateProductRating } from "../services/ratings.js";
import Order from "../models/Order.js";

// @route POST /api/reviews/:productId
export const addReview = async (req, res) => {
  const { rating, comment, skinType } = req.body;
  const productId = req.params.productId;

  try {
    // Check if already reviewed
    const existing = await Review.findOne({
      product: productId,
      user: req.user._id,
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "You already reviewed this product" });
    }

    // Check if user has purchased this product
    const hasPurchased = await Order.findOne({
      user: req.user._id,
      isPaid: true,
      "orderItems.product": productId,
    });

    const review = await Review.create({
      product: productId,
      user: req.user._id,
      name: req.user.name,
      rating: Number(rating),
      comment,
      skinType,
      verified: !!hasPurchased,
    });

    // The product's rating comes only from its real reviews.
    await recalculateProductRating(productId);

    res.status(201).json(review);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "You already reviewed this product" });
    }
    return sendServerError(res, error, "reviewController error");
  }
};

// @route GET /api/reviews/:productId
export const getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId }).sort({
      createdAt: -1,
    });
    res.json(reviews);
  } catch (error) {
    return sendServerError(res, error, "reviewController error");
  }
};

// @route DELETE /api/reviews/:id
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (
      review.user.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await review.deleteOne();
    await recalculateProductRating(review.product);
    res.json({ message: "Review deleted" });
  } catch (error) {
    return sendServerError(res, error, "reviewController error");
  }
};
