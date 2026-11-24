CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"customer_id" text,
	"service" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"staff" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_status_check" CHECK ("bookings"."status" in ('booked', 'completed', 'cancelled', 'no-show')),
	CONSTRAINT "bookings_duration_check" CHECK ("bookings"."duration_minutes" between 15 and 600),
	CONSTRAINT "bookings_time_check" CHECK ("bookings"."ends_at" > "bookings"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_status_check" CHECK ("contacts"."status" in ('new', 'read', 'replied'))
);
--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"author_id" text,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_notes_length_check" CHECK (char_length("customer_notes"."text") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"position" integer NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"price" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"delivery_full_name" text,
	"delivery_phone" text,
	"delivery_address" text,
	"delivery_city" text,
	"delivery_state" text,
	"payment_reference" text,
	"payment_result" jsonb,
	"items_price" integer NOT NULL,
	"voucher_code" text,
	"discount" integer DEFAULT 0 NOT NULL,
	"delivery_price" integer NOT NULL,
	"total_price" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"is_delivered" boolean DEFAULT false NOT NULL,
	"delivered_at" timestamp with time zone,
	"stock_committed" jsonb,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"refund_status" text DEFAULT 'none' NOT NULL,
	"refund_amount" integer,
	"refund_reference" text,
	"refund_note" text,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
	CONSTRAINT "orders_refund_status_check" CHECK ("orders"."refund_status" in ('none', 'pending', 'refunded')),
	CONSTRAINT "orders_money_check" CHECK ("orders"."items_price" >= 0 and "orders"."discount" >= 0 and "orders"."delivery_price" >= 0 and "orders"."total_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "points_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"points" integer NOT NULL,
	"reason" text,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_history_type_check" CHECK ("points_history"."type" in ('earn', 'redeem', 'reversal'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"image" text NOT NULL,
	"secondary_image" text,
	"category" text NOT NULL,
	"brand" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"suitable_skin_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"suitable_hair_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"suitable_concerns" text[] DEFAULT '{}'::text[] NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_in_stock" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"num_reviews" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_check" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_stock_check" CHECK ("products"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"skin_type" text,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "saved_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"profile" jsonb,
	"product_ids" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text,
	"category" text,
	"view_count" integer DEFAULT 1 NOT NULL,
	"last_viewed" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"password_changed_at" timestamp with time zone,
	"avatar" text DEFAULT '' NOT NULL,
	"auth_provider" text DEFAULT 'local' NOT NULL,
	"otp_code_hash" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"skin_type" text DEFAULT 'normal' NOT NULL,
	"hair_type" text DEFAULT 'straight' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"loyalty_tier" text DEFAULT 'bronze' NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"marketing_emails" boolean DEFAULT true NOT NULL,
	"marketing_last_sent" timestamp with time zone,
	"beauty_profile" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_provider_check" CHECK ("users"."auth_provider" in ('local', 'google', 'facebook')),
	CONSTRAINT "users_loyalty_tier_check" CHECK ("users"."loyalty_tier" in ('bronze', 'silver', 'gold', 'platinum')),
	CONSTRAINT "users_points_check" CHECK ("users"."loyalty_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"value" integer NOT NULL,
	"max_discount" integer,
	"min_subtotal" integer DEFAULT 0 NOT NULL,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"show_on_product_page" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vouchers_type_check" CHECK ("vouchers"."type" in ('percent', 'fixed')),
	CONSTRAINT "vouchers_code_format_check" CHECK ("vouchers"."code" ~ '^[A-Z0-9_-]{3,30}$'),
	CONSTRAINT "vouchers_value_check" CHECK ("vouchers"."value" >= 1),
	CONSTRAINT "vouchers_used_check" CHECK ("vouchers"."used_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_history" ADD CONSTRAINT "points_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_recommendations" ADD CONSTRAINT "saved_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_starts_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id","starts_at");--> statement-breakpoint
CREATE INDEX "contacts_created_idx" ON "contacts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "customer_notes_customer_idx" ON "customer_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_payment_reference_key" ON "orders" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "points_history_user_idx" ON "points_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_featured_idx" ON "products" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "products_tags_idx" ON "products" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_product_user_key" ON "reviews" USING btree ("product_id","user_id");--> statement-breakpoint
CREATE INDEX "saved_recommendations_user_idx" ON "saved_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_interests_user_idx" ON "user_interests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers" USING btree ("code");