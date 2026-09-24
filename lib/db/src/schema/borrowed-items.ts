import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const borrowedItemsTable = pgTable("borrowed_items", {
  id: text("id").primaryKey(),
  dateBorrowed: date("date_borrowed", { mode: "string" }).notNull(),
  borrowerName: text("borrower_name").notNull(),
  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull(),
  conditionBorrowed: text("condition_borrowed").notNull(),
  dateReturned: date("date_returned", { mode: "string" }),
  conditionReturned: text("condition_returned"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBorrowedItemSchema = createInsertSchema(borrowedItemsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertBorrowedItem = z.infer<typeof insertBorrowedItemSchema>;
export type BorrowedItem = typeof borrowedItemsTable.$inferSelect;