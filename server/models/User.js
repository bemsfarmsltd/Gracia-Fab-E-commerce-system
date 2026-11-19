import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  SKIN_TYPES,
  HAIR_TYPES,
  SHOPPING_FOR,
  BUDGETS,
  SKIN_CONCERNS,
  HAIR_CONCERNS,
} from "../config/beautyProfile.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // Set whenever the password changes (see the pre-save hook below), so
    // authMiddleware can reject a JWT that was issued before the change —
    // otherwise a token stolen before a password reset would stay valid
    // for its full 30-day lifetime.
    passwordChangedAt: {
      type: Date,
    },

    avatar: {
      type: String,
      default: "",
    },

    authProvider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },

    // ── Login OTP (second factor) — cleared as soon as it's used or expires.
    // Only the hash is stored, matching how the password itself is handled.
    otpCodeHash: {
      type: String,
    },

    otpExpiresAt: {
      type: Date,
    },

    otpAttempts: {
      type: Number,
      default: 0,
    },

    skinType: {
      type: String,
      enum: ["oily", "dry", "combination", "normal", "sensitive"],
      default: "normal",
    },

    hairType: {
      type: String,
      enum: ["straight", "wavy", "curly", "coily"],
      default: "straight",
    },

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    savedRecommendations: [
      {
        date: {
          type: Date,
          default: Date.now,
        },

        profile: {
          type: Object,
        },

        products: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
          },
        ],
      },
    ],

    isAdmin: {
      type: Boolean,
      default: false,
    },

    // ── Loyalty System
    loyaltyPoints: {
      type: Number,
      default: 0,
    },

    loyaltyTier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },

    totalSpent: {
      type: Number,
      default: 0,
    },

    pointsHistory: [
      {
        points: Number,

        reason: String,

        type: {
          type: String,
          // "reversal": points taken back when a paid order is cancelled.
          enum: ["earn", "redeem", "reversal"],
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Add inside userSchema:
    interests: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        category: String,
        viewCount: { type: Number, default: 1 },
        lastViewed: { type: Date, default: Date.now },
      },
    ],
    emailPreferences: {
      marketing: { type: Boolean, default: true },
      lastSent: Date,
    },
    // My Vanity beauty profile. Every answer is optional and starts empty (unlike
    // the older skinType/hairType above, whose defaults can't be told apart from
    // a real answer). Options: server/config/beautyProfile.js.
    beautyProfile: {
      skinType: { type: String, enum: SKIN_TYPES },
      hairType: { type: String, enum: HAIR_TYPES },
      skinConcerns: { type: [{ type: String, enum: Object.keys(SKIN_CONCERNS) }], default: undefined },
      hairConcerns: { type: [{ type: String, enum: Object.keys(HAIR_CONCERNS) }], default: undefined },
      shoppingFor: { type: [{ type: String, enum: SHOPPING_FOR }], default: undefined },
      budget: { type: String, enum: BUDGETS },
      undertone: { type: String, maxlength: 60 },
      updatedAt: Date,
    },
  },

  { timestamps: true },
);

// Encrypt password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);

  this.password = await bcrypt.hash(this.password, salt);

  // Only for an actual change, not the initial password set at registration
  // (a brand-new user has no pre-existing token that needs invalidating).
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }

  next();
});

// Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
