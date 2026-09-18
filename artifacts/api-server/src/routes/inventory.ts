import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, auditRecordsTable, inventoryItemsTable, stockActivitiesTable } from "@workspace/db";
import {
  AdjustInventoryQuantityBody,
  AuditRecordInput,
  BootstrapInventoryBody,
  CreateInventoryItemBody,
  CreateInventoryItemResponse,
  CreateAuditRecordBody,
  CreateAuditRecordResponse,
  DeleteAuditRecordParams,
  DeleteInventoryItemParams,
  GetInventoryStateResponse,
  InventoryItem,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
  UpdateInventoryItemResponse,
  AdjustInventoryQuantityResponse,
  BootstrapInventoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toCalendarDate(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toInventoryItem(item: typeof inventoryItemsTable.$inferSelect): InventoryItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    threshold: item.threshold,
    location: item.location,
    note: item.note ?? null,
  };
}

function toStockActivity(activity: typeof stockActivitiesTable.$inferSelect) {
  return {
    id: activity.id,
    itemId: activity.itemId,
    itemName: activity.itemName,
    action: activity.action as "take" | "stock",
    amount: activity.amount,
    quantityAfter: activity.quantityAfter,
    unit: activity.unit,
    timestamp: activity.timestamp.toISOString(),
  };
}

function toAuditRecord(record: typeof auditRecordsTable.$inferSelect) {
  return {
    id: record.id,
    date: record.date,
    itemId: record.itemId,
    itemName: record.itemName,
    quantity: record.quantity,
    unit: record.unit,
    requesterName: record.requesterName,
    department: record.department,
    purpose: record.purpose,
    createdAt: record.createdAt.toISOString(),
  };
}

async function readState() {
  const [items, activities, auditRecords] = await Promise.all([
    db.select().from(inventoryItemsTable).orderBy(inventoryItemsTable.name),
    db.select().from(stockActivitiesTable).orderBy(desc(stockActivitiesTable.timestamp)).limit(100),
    db.select().from(auditRecordsTable).orderBy(desc(auditRecordsTable.createdAt)).limit(100),
  ]);

  return GetInventoryStateResponse.parse({
    items: items.map(toInventoryItem),
    activities: activities.map(toStockActivity),
    auditRecords: auditRecords.map(toAuditRecord),
  });
}

router.get("/inventory/state", async (_req, res): Promise<void> => {
  res.json(await readState());
});

router.post("/inventory/bootstrap", async (req, res): Promise<void> => {
  const parsed = BootstrapInventoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select({ id: inventoryItemsTable.id }).from(inventoryItemsTable).limit(1);
  if (!existing.length) {
    const itemById = new Map(parsed.data.items.map((item) => [item.id, item]));
    const missingItem = parsed.data.auditRecords.find((record) => !itemById.has(record.itemId));
    if (missingItem) {
      res.status(400).json({ error: `Unknown inventory item: ${missingItem.itemId}` });
      return;
    }

    await db.transaction(async (tx) => {
      if (parsed.data.items.length) {
        await tx.insert(inventoryItemsTable).values(parsed.data.items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          threshold: item.threshold,
          location: item.location,
          note: item.note ?? null,
        })));
      }
      if (parsed.data.activities.length) {
        await tx.insert(stockActivitiesTable).values(parsed.data.activities.map((activity) => ({
          id: activity.id,
          itemId: activity.itemId,
          itemName: activity.itemName,
          action: activity.action,
          amount: activity.amount,
          quantityAfter: activity.quantityAfter,
          unit: activity.unit,
          timestamp: new Date(activity.timestamp),
        })));
      }
      if (parsed.data.auditRecords.length) {
        await tx.insert(auditRecordsTable).values(parsed.data.auditRecords.map((record) => {
          const item = itemById.get(record.itemId)!;
          return {
            id: `audit-${randomUUID()}`,
            date: toCalendarDate(record.date),
            itemId: record.itemId,
            itemName: item.name,
            quantity: record.quantity,
            unit: item.unit,
            requesterName: record.requesterName,
            department: record.department,
            purpose: record.purpose,
          };
        }));
      }
    });
  }

  res.json(BootstrapInventoryResponse.parse(await readState()));
});

router.post("/inventory/items", async (req, res): Promise<void> => {
  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(inventoryItemsTable).values({
    ...parsed.data,
    note: parsed.data.note ?? null,
  }).returning();
  res.status(201).json(CreateInventoryItemResponse.parse(toInventoryItem(item)));
});

router.patch("/inventory/items/:id", async (req, res): Promise<void> => {
  const params = UpdateInventoryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.update(inventoryItemsTable)
    .set({ ...parsed.data, note: parsed.data.note ?? null, updatedAt: new Date() })
    .where(eq(inventoryItemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }
  res.json(UpdateInventoryItemResponse.parse(toInventoryItem(item)));
});

router.delete("/inventory/items/:id", async (req, res): Promise<void> => {
  const params = DeleteInventoryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db.delete(inventoryItemsTable)
    .where(eq(inventoryItemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/inventory/adjustments", async (req, res): Promise<void> => {
  const parsed = AdjustInventoryQuantityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const activity = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, parsed.data.itemId));
    if (!item) return null;
    const nextQuantity = parsed.data.quantity;
    const actualChange = nextQuantity - item.quantity;
    if (!actualChange) return "unchanged" as const;

    await tx.update(inventoryItemsTable)
      .set({ quantity: nextQuantity, updatedAt: new Date() })
      .where(eq(inventoryItemsTable.id, item.id));
    const [created] = await tx.insert(stockActivitiesTable).values({
      id: `activity-${randomUUID()}`,
      itemId: item.id,
      itemName: item.name,
      action: actualChange > 0 ? "stock" : "take",
      amount: Math.abs(actualChange),
      quantityAfter: nextQuantity,
      unit: item.unit,
      timestamp: new Date(),
    }).returning();
    return created;
  });

  if (!activity) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }
  if (activity === "unchanged") {
    res.status(400).json({ error: "Quantity is unchanged" });
    return;
  }
  res.json(AdjustInventoryQuantityResponse.parse(toStockActivity(activity)));
});

router.post("/inventory/audit-records", async (req, res): Promise<void> => {
  const parsed = CreateAuditRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, parsed.data.itemId));
    if (!item) return { kind: "not_found" as const };
    if (item.quantity < parsed.data.quantity) {
      return { kind: "insufficient", itemName: item.name, available: item.quantity, unit: item.unit };
    }

    const nextQuantity = item.quantity - parsed.data.quantity;
    await tx.update(inventoryItemsTable)
      .set({ quantity: nextQuantity, updatedAt: new Date() })
      .where(eq(inventoryItemsTable.id, item.id));
    await tx.insert(stockActivitiesTable).values({
      id: `activity-${randomUUID()}`,
      itemId: item.id,
      itemName: item.name,
      action: "take",
      amount: parsed.data.quantity,
      quantityAfter: nextQuantity,
      unit: item.unit,
      timestamp: new Date(),
    });
    const [record] = await tx.insert(auditRecordsTable).values({
      id: `audit-${randomUUID()}`,
      date: toCalendarDate(parsed.data.date),
      itemId: item.id,
      itemName: item.name,
      quantity: parsed.data.quantity,
      unit: item.unit,
      requesterName: parsed.data.requesterName,
      department: parsed.data.department,
      purpose: parsed.data.purpose,
    }).returning();
    if (!record) {
      throw new Error("Audit record insert returned no record");
    }
    return { kind: "created" as const, record: record! };
  });

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }
  if (result.kind === "insufficient") {
    res.status(409).json({ error: `${result.itemName} has only ${result.available} ${result.unit} available.` });
    return;
  }
  res.status(201).json(CreateAuditRecordResponse.parse(toAuditRecord(result.record!)));
});

router.delete("/inventory/audit-records/:id", async (req, res): Promise<void> => {
  const params = DeleteAuditRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [record] = await tx.select().from(auditRecordsTable).where(eq(auditRecordsTable.id, params.data.id));
    if (!record) return null;
    const [item] = await tx.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, record.itemId));
    if (item) {
      await tx.update(inventoryItemsTable)
        .set({ quantity: item.quantity + record.quantity, updatedAt: new Date() })
        .where(eq(inventoryItemsTable.id, item.id));
      await tx.insert(stockActivitiesTable).values({
        id: `activity-${randomUUID()}`,
        itemId: item.id,
        itemName: item.name,
        action: "stock",
        amount: record.quantity,
        quantityAfter: item.quantity + record.quantity,
        unit: item.unit,
        timestamp: new Date(),
      });
    }
    await tx.delete(auditRecordsTable).where(eq(auditRecordsTable.id, record.id));
    return record;
  });

  if (!result) {
    res.status(404).json({ error: "Audit record not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;