import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditRecordsTable = pgTable("audit_records", {
  id: text("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull(),
  requesterName: text("requester_name").notNull(),
  department: text("department").notNull(),
  purpose: text("purpose").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditRecordSchema = createInsertSchema(auditRecordsTable).omit({
  createdAt: true,
});
export type InsertAuditRecord = z.infer<typeof insertAuditRecordSchema>;
export type AuditRecord = typeof auditRecordsTable.$inferSelect;