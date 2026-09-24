import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "C:/Users/Rochelle Dycoco/Downloads/Creative-Supply-Hub/lib/db/src/schema/*",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});