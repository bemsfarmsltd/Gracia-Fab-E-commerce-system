import mongoose from "mongoose";

// A private staff note on a customer ("prefers bone straight", "call after
// 4pm"). Only admins see these; the customer never does.
const customerNoteSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

export default mongoose.model("CustomerNote", customerNoteSchema);
