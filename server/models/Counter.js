import mongoose from "mongoose";

// Running numbers (e.g. in-store sale S-000123). nextNumber() is atomic, so
// two tills can't get the same number.
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model("Counter", counterSchema);

export async function nextNumber(name) {
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}

export default Counter;
