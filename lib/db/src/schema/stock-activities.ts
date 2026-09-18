import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stockActivitiesTable = pgTable("stock_activities", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  action: text("action").notNull(),
  amount: integer("amount").notNull(),
  quantityAfter: integer("quantity_after").notNull(),
  unit: text("unit").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStockActivitySchema = createInsertSchema(stockActivitiesTable);
export type InsertStockActivity = z.infer<typeof insertStockActivitySchema>;
export type StockActivity = typeof stockActivitiesTable.$inferSelect;