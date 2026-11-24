// `npx drizzle-kit generate` writes the SQL for schema changes to db/migrations.
export default {
  dialect: "postgresql",
  schema: "./db/schema.js",
  out: "./db/migrations",
};
