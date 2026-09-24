import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db, auditRecordsTable, borrowedItemsTable, inventoryItemsTable, stockActivitiesTable } from "@workspace/db";
import {
  AdjustInventoryQuantityBody,
  AuditRecordInput,
  BootstrapInventoryBody,
  CreateBorrowedItemBody,
  CreateBorrowedItemResponse,
  CreateInventoryItemBody,
  CreateInventoryItemResponse,
  CreateAuditRecordBody,
  CreateAuditRecordResponse,
  DeleteBorrowedItemParams,
  DeleteAuditRecordParams,
  DeleteInventoryItemParams,
  GetInventoryStateResponse,
  ImportInventoryItemsBody,
  ImportInventoryItemsResponse,
  InventoryItem,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
  UpdateInventoryItemResponse,
  AdjustInventoryQuantityResponse,
  BootstrapInventoryResponse,
  UpdateBorrowedItemBody,
  UpdateBorrowedItemParams,
  UpdateBorrowedItemResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toCalendarDate(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toInventoryItem(item: typeof inventoryItemsTable.$inferSelect): InventoryItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category as InventoryItem["category"],
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

function toBorrowedItem(record: typeof borrowedItemsTable.$inferSelect) {
  return {
    id: record.id,
    dateBorrowed: record.dateBorrowed,
    borrowerName: record.borrowerName,
    itemId: record.itemId,
    itemName: record.itemName,
    quantity: record.quantity,
    unit: record.unit,
    conditionBorrowed: record.conditionBorrowed,
    dateReturned: record.dateReturned,
    conditionReturned: record.conditionReturned,
    status: record.status as "Borrowed" | "Broke" | "Returned",
    createdAt: record.createdAt.toISOString(),
  };
}

function isActiveBorrow(status: string) {
  return status !== "Returned";
}

async function readState() {
  const [items, activities, auditRecords, borrowedItems] = await Promise.all([
    db.select().from(inventoryItemsTable).orderBy(inventoryItemsTable.name),
    db.select().from(stockActivitiesTable).orderBy(desc(stockActivitiesTable.timestamp)).limit(100),
    db.select().from(auditRecordsTable).orderBy(desc(auditRecordsTable.createdAt)).limit(100),
    db.select().from(borrowedItemsTable).orderBy(desc(borrowedItemsTable.createdAt)).limit(100),
  ]);

  return GetInventoryStateResponse.parse({
    items: items.map(toInventoryItem),
    activities: activities.map(toStockActivity),
    auditRecords: auditRecords.map(toAuditRecord),
    borrowedItems: borrowedItems.map(toBorrowedItem),
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
    const missingItem = parsed.data.auditRecords.find((record) => !itemById.has(record.itemId))
      ?? parsed.data.borrowedItems.find((record) => !itemById.has(record.itemId));
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
      if (parsed.data.borrowedItems.length) {
        await tx.insert(borrowedItemsTable).values(parsed.data.borrowedItems.map((record) => {
          const item = itemById.get(record.itemId)!;
          return {
            id: `borrow-${randomUUID()}`,
            dateBorrowed: toCalendarDate(record.dateBorrowed),
            borrowerName: record.borrowerName,
            itemId: record.itemId,
            itemName: item.name,
            quantity: record.quantity,
            unit: item.unit,
            conditionBorrowed: record.conditionBorrowed,
            dateReturned: record.dateReturned ? toCalendarDate(record.dateReturned) : null,
            conditionReturned: record.conditionReturned ?? null,
            status: record.status,
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

router.post("/inventory/import", async (req, res): Promise<void> => {
  const parsed = ImportInventoryItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ids = parsed.data.items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    res.status(409).json({ error: "The import contains duplicate item IDs." });
    return;
  }

  const existing = await db.select({ id: inventoryItemsTable.id })
    .from(inventoryItemsTable)
    .where(inArray(inventoryItemsTable.id, ids));
  if (existing.length) {
    res.status(409).json({ error: `These item IDs already exist: ${existing.map((item) => item.id).join(", ")}` });
    return;
  }

  const created = await db.insert(inventoryItemsTable).values(parsed.data.items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    threshold: item.threshold,
    location: item.location,
    note: item.note ?? null,
  }))).returning();

  res.status(201).json(ImportInventoryItemsResponse.parse({
    insertedCount: created.length,
    items: created.map(toInventoryItem),
  }));
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
  const activeBorrow = await db.select({ id: borrowedItemsTable.id })
    .from(borrowedItemsTable)
    .where(and(eq(borrowedItemsTable.itemId, params.data.id), ne(borrowedItemsTable.status, "Returned")))
    .limit(1);
  if (activeBorrow.length) {
    res.status(409).json({ error: "Return or resolve active borrowed records before removing this item." });
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

router.post("/inventory/borrowed-items", async (req, res): Promise<void> => {
  const parsed = CreateBorrowedItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.status === "Returned" && !parsed.data.dateReturned) {
    res.status(400).json({ error: "Returned records need a return date." });
    return;
  }
  if (parsed.data.status !== "Returned" && parsed.data.dateReturned) {
    res.status(400).json({ error: "Only returned records can have a return date." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, parsed.data.itemId));
    if (!item) return { kind: "not_found" as const };
    const active = isActiveBorrow(parsed.data.status);
    if (active && item.quantity < parsed.data.quantity) {
      return { kind: "insufficient", itemName: item.name, available: item.quantity, unit: item.unit };
    }

    const nextQuantity = active ? item.quantity - parsed.data.quantity : item.quantity;
    if (active) {
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
    }

    const [record] = await tx.insert(borrowedItemsTable).values({
      id: `borrow-${randomUUID()}`,
      dateBorrowed: toCalendarDate(parsed.data.dateBorrowed),
      borrowerName: parsed.data.borrowerName,
      itemId: item.id,
      itemName: item.name,
      quantity: parsed.data.quantity,
      unit: item.unit,
      conditionBorrowed: parsed.data.conditionBorrowed,
      dateReturned: parsed.data.dateReturned ? toCalendarDate(parsed.data.dateReturned) : null,
      conditionReturned: parsed.data.conditionReturned ?? null,
      status: parsed.data.status,
    }).returning();
    if (!record) throw new Error("Borrowed item insert returned no record");
    return { kind: "created" as const, record };
  });

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }
  if (result.kind === "insufficient") {
    res.status(409).json({ error: `${result.itemName} has only ${result.available} ${result.unit} available.` });
    return;
  }
  res.status(201).json(CreateBorrowedItemResponse.parse(toBorrowedItem(result.record!)));
});

router.patch("/inventory/borrowed-items/:id", async (req, res): Promise<void> => {
  const params = UpdateBorrowedItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBorrowedItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.status === "Returned" && !parsed.data.dateReturned) {
    res.status(400).json({ error: "Returned records need a return date." });
    return;
  }
  if (parsed.data.status !== "Returned" && parsed.data.dateReturned) {
    res.status(400).json({ error: "Only returned records can have a return date." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(borrowedItemsTable).where(eq(borrowedItemsTable.id, params.data.id));
    if (!existing) return { kind: "not_found" as const };
    if (existing.itemId !== parsed.data.itemId) {
      return { kind: "item_change" as const };
    }

    const [item] = await tx.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, existing.itemId));
    if (!item) return { kind: "not_found" as const };

    const oldDeduction = isActiveBorrow(existing.status) ? existing.quantity : 0;
    const newDeduction = isActiveBorrow(parsed.data.status) ? parsed.data.quantity : 0;
    const deductionDelta = newDeduction - oldDeduction;
    if (deductionDelta > 0 && item.quantity < deductionDelta) {
      return { kind: "insufficient", itemName: item.name, available: item.quantity, unit: item.unit };
    }

    const nextQuantity = item.quantity - deductionDelta;
    if (deductionDelta) {
      await tx.update(inventoryItemsTable)
        .set({ quantity: nextQuantity, updatedAt: new Date() })
        .where(eq(inventoryItemsTable.id, item.id));
      await tx.insert(stockActivitiesTable).values({
        id: `activity-${randomUUID()}`,
        itemId: item.id,
        itemName: item.name,
        action: deductionDelta > 0 ? "take" : "stock",
        amount: Math.abs(deductionDelta),
        quantityAfter: nextQuantity,
        unit: item.unit,
        timestamp: new Date(),
      });
    }

    const [record] = await tx.update(borrowedItemsTable).set({
      dateBorrowed: toCalendarDate(parsed.data.dateBorrowed),
      borrowerName: parsed.data.borrowerName,
      quantity: parsed.data.quantity,
      conditionBorrowed: parsed.data.conditionBorrowed,
      dateReturned: parsed.data.dateReturned ? toCalendarDate(parsed.data.dateReturned) : null,
      conditionReturned: parsed.data.conditionReturned ?? null,
      status: parsed.data.status,
      updatedAt: new Date(),
    }).where(eq(borrowedItemsTable.id, existing.id)).returning();
    if (!record) throw new Error("Borrowed item update returned no record");
    return { kind: "updated" as const, record };
  });

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Borrowed item or inventory item not found" });
    return;
  }
  if (result.kind === "item_change") {
    res.status(400).json({ error: "Changing the item on a borrowed record is not supported. Delete it and create a new record." });
    return;
  }
  if (result.kind === "insufficient") {
    res.status(409).json({ error: `${result.itemName} has only ${result.available} ${result.unit} available.` });
    return;
  }
  res.json(UpdateBorrowedItemResponse.parse(toBorrowedItem(result.record!)));
});

router.delete("/inventory/borrowed-items/:id", async (req, res): Promise<void> => {
  const params = DeleteBorrowedItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [record] = await tx.select().from(borrowedItemsTable).where(eq(borrowedItemsTable.id, params.data.id));
    if (!record) return null;
    if (isActiveBorrow(record.status)) {
      const [item] = await tx.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, record.itemId));
      if (item) {
        const nextQuantity = item.quantity + record.quantity;
        await tx.update(inventoryItemsTable)
          .set({ quantity: nextQuantity, updatedAt: new Date() })
          .where(eq(inventoryItemsTable.id, item.id));
        await tx.insert(stockActivitiesTable).values({
          id: `activity-${randomUUID()}`,
          itemId: item.id,
          itemName: item.name,
          action: "stock",
          amount: record.quantity,
          quantityAfter: nextQuantity,
          unit: item.unit,
          timestamp: new Date(),
        });
      }
    }
    await tx.delete(borrowedItemsTable).where(eq(borrowedItemsTable.id, record.id));
    return record;
  });

  if (!result) {
    res.status(404).json({ error: "Borrowed item record not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;