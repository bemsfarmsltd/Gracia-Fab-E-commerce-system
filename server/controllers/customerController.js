import { listCustomers, getCustomer, addCustomerNote, deleteCustomerNote } from "../services/customers.js";
import { customerListQuerySchema } from "../validators/customerValidators.js";
import { sendServerError } from "../utils/httpErrors.js";

const badQuery = (res, error) =>
  res.status(400).json({
    message: "Validation failed",
    errors: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });

// @route GET /api/admin/customers?search=&sort=newest|spent|last-order|name&page=&limit=
export const getCustomers = async (req, res) => {
  const parsed = customerListQuerySchema.safeParse(req.query);
  if (!parsed.success) return badQuery(res, parsed.error);
  try {
    res.json(await listCustomers(parsed.data));
  } catch (error) {
    return sendServerError(res, error, "getCustomers error");
  }
};

// @route GET /api/admin/customers/:id
export const getCustomerDetail = async (req, res) => {
  try {
    const data = await getCustomer(req.params.id);
    if (!data) return res.status(404).json({ message: "Customer not found" });
    res.json(data);
  } catch (error) {
    return sendServerError(res, error, "getCustomerDetail error");
  }
};

// @route POST /api/admin/customers/:id/notes  { text }
export const postCustomerNote = async (req, res) => {
  try {
    const note = await addCustomerNote(req.params.id, req.user._id, req.body.text);
    if (!note) return res.status(404).json({ message: "Customer not found" });
    res.status(201).json(note);
  } catch (error) {
    return sendServerError(res, error, "postCustomerNote error");
  }
};

// @route DELETE /api/admin/customers/:id/notes/:noteId
export const removeCustomerNote = async (req, res) => {
  try {
    const ok = await deleteCustomerNote(req.params.id, req.params.noteId);
    if (!ok) return res.status(404).json({ message: "Note not found" });
    res.json({ message: "Note deleted" });
  } catch (error) {
    return sendServerError(res, error, "removeCustomerNote error");
  }
};
