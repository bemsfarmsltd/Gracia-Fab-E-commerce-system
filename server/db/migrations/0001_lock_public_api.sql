-- Supabase serves every table in the public schema through its REST API to
-- anyone holding the project's public (anon) key. Row-level security with no
-- policies closes that: only the server, which connects as the database
-- owner, can read or write. Never add a policy without a security review.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wishlist_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_interests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vouchers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscribers" ENABLE ROW LEVEL SECURITY;
