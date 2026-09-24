import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Layers3,
  MapPin,
  Menu,
  Minus,
  MinusCircle,
  PackageOpen,
  Package,
  Pencil,
  Plus,
  PlusCircle,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  adjustInventoryQuantity,
  bootstrapInventory,
  createAuditRecord,
  createBorrowedItem,
  createInventoryItem,
  deleteBorrowedItem,
  deleteAuditRecord as deleteAuditRecordRequest,
  deleteInventoryItem,
  getInventoryState,
  importInventoryItems,
  updateInventoryItem,
  updateBorrowedItem,
} from '@workspace/api-client-react';
import type { BorrowedItem, BorrowedItemInput, InventoryState as ApiInventoryState } from '@workspace/api-client-react';
import logoAsset from '@assets/image_1789625612704.png';

const queryClient = new QueryClient();
const STORAGE_KEY = 'creative-inventory-items-v1';
const ACTIVITY_STORAGE_KEY = 'creative-inventory-activity-v1';
const AUDIT_STORAGE_KEY = 'creative-inventory-audit-v1';

type Category = 'Paper' | 'Cards' | 'Finishing' | 'Vinyl' | 'Ink' | 'Office' | 'Tools' | 'Packaging' | 'Safety';
type View = 'overview' | 'inventory' | 'borrowed' | 'records';
type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';
type OperationalStatus = 'Available' | 'Low Stock' | 'Out of Stock' | 'Borrowed' | 'Needs Repair';
type InventorySortKey = 'name' | 'category' | 'quantity' | 'unit' | 'pricePerUnit' | 'threshold' | 'status' | 'location';
type SortDirection = 'asc' | 'desc';

type InventoryItem = {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  threshold: number;
  location: string;
  note?: string;
  pricePerUnit: number;
  imageUrl: string | null;
};

const seedItems = ([
  { id: 'paper-a3-uncoated', name: 'Premium uncoated A3', category: 'Paper', quantity: 184, unit: 'sheets', threshold: 80, location: 'Bay A · Shelf 1', note: '120 gsm, bright white' },
  { id: 'paper-a4-matte', name: 'Matte coated A4', category: 'Paper', quantity: 62, unit: 'sheets', threshold: 75, location: 'Bay A · Shelf 2', note: '170 gsm, presentation finish' },
  { id: 'paper-kraft', name: 'Recycled kraft A4', category: 'Paper', quantity: 118, unit: 'sheets', threshold: 40, location: 'Bay A · Shelf 3', note: '110 gsm, warm stock' },
  { id: 'paper-synthetic', name: 'Synthetic waterproof A3', category: 'Paper', quantity: 24, unit: 'sheets', threshold: 20, location: 'Bay A · Shelf 4', note: 'For outdoor wayfinding' },
  { id: 'cards-pvc-white', name: 'PVC access cards', category: 'Cards', quantity: 43, unit: 'cards', threshold: 25, location: 'Bay B · Drawer 1', note: 'CR80, white matte' },
  { id: 'cards-pvc-clear', name: 'PVC clear cards', category: 'Cards', quantity: 18, unit: 'cards', threshold: 20, location: 'Bay B · Drawer 1', note: 'CR80, transparent' },
  { id: 'finish-a4-pouches', name: 'Laminating pouches A4', category: 'Finishing', quantity: 96, unit: 'pouches', threshold: 40, location: 'Bay C · Shelf 1', note: '125 micron, gloss' },
  { id: 'finish-a3-pouches', name: 'Laminating pouches A3', category: 'Finishing', quantity: 31, unit: 'pouches', threshold: 30, location: 'Bay C · Shelf 1', note: '125 micron, gloss' },
  { id: 'finish-double-sided', name: 'Double-sided mounting tape', category: 'Finishing', quantity: 7, unit: 'rolls', threshold: 8, location: 'Bay C · Drawer 2', note: '19 mm × 25 m' },
  { id: 'vinyl-white', name: 'White vinyl roll', category: 'Vinyl', quantity: 3, unit: 'rolls', threshold: 2, location: 'Bay D · Rack 1', note: '610 mm × 25 m' },
  { id: 'vinyl-clear', name: 'Clear vinyl roll', category: 'Vinyl', quantity: 1, unit: 'rolls', threshold: 2, location: 'Bay D · Rack 1', note: '610 mm × 25 m' },
  { id: 'ink-black', name: 'Black pigment ink', category: 'Ink', quantity: 2, unit: 'cartridges', threshold: 2, location: 'Bay E · Drawer 1', note: 'Epson SureColor' },
  { id: 'ink-cyan', name: 'Cyan pigment ink', category: 'Ink', quantity: 4, unit: 'cartridges', threshold: 2, location: 'Bay E · Drawer 1', note: 'Epson SureColor' },
  { id: 'ink-magenta', name: 'Magenta pigment ink', category: 'Ink', quantity: 1, unit: 'cartridges', threshold: 2, location: 'Bay E · Drawer 1', note: 'Epson SureColor' },
  { id: 'office-markers', name: 'Permanent marker set', category: 'Office', quantity: 4, unit: 'sets', threshold: 2, location: 'Shelf 2 · Drawer B', note: 'Black, blue, red, green' },
  { id: 'office-notebooks', name: 'Project notebooks', category: 'Office', quantity: 12, unit: 'pieces', threshold: 4, location: 'Shelf 2 · Drawer B', note: 'A5 ruled notebooks' },
  { id: 'tools-screwdriver', name: 'Precision screwdriver set', category: 'Tools', quantity: 1, unit: 'set', threshold: 1, location: 'Shelf 3 · Tool tray', note: 'For equipment adjustments' },
  { id: 'tools-utility-blades', name: 'Utility knife blades', category: 'Tools', quantity: 9, unit: 'packs', threshold: 3, location: 'Shelf 3 · Tool tray', note: '18 mm replacement blades' },
  { id: 'packaging-tape', name: 'Packing tape', category: 'Packaging', quantity: 6, unit: 'rolls', threshold: 3, location: 'Shelf 4 · Drawer A', note: 'Clear 48 mm tape' },
  { id: 'safety-gloves', name: 'Nitrile safety gloves', category: 'Safety', quantity: 3, unit: 'boxes', threshold: 2, location: 'Shelf 4 · Drawer C', note: 'Medium, powder-free' },
] as Array<Omit<InventoryItem, 'pricePerUnit' | 'imageUrl'>>).map((item) => ({
  ...item,
  pricePerUnit: 0,
  imageUrl: null,
}));

const categoryMeta: Record<Category, { icon: typeof Archive; tone: string; tint: string }> = {
  Paper: { icon: Layers3, tone: 'text-[#286e7d]', tint: 'bg-[#e2f0ef]' },
  Cards: { icon: ClipboardList, tone: 'text-[#8d5f24]', tint: 'bg-[#f6ead5]' },
  Finishing: { icon: Sparkles, tone: 'text-[#a95242]', tint: 'bg-[#f8e2db]' },
  Vinyl: { icon: Archive, tone: 'text-[#5d6596]', tint: 'bg-[#e8e8f2]' },
  Ink: { icon: Printer, tone: 'text-[#274e4b]', tint: 'bg-[#deebe1]' },
  Office: { icon: Briefcase, tone: 'text-[#a1464f]', tint: 'bg-[#f9e5e8]' },
  Tools: { icon: Wrench, tone: 'text-[#535e78]', tint: 'bg-[#e7ebf3]' },
  Packaging: { icon: Package, tone: 'text-[#94621e]', tint: 'bg-[#f6ead5]' },
  Safety: { icon: ShieldCheck, tone: 'text-[#32705d]', tint: 'bg-[#e2f1e9]' },
};

const categories: Array<'All' | Category> = ['All', 'Paper', 'Cards', 'Finishing', 'Vinyl', 'Ink', 'Office', 'Tools', 'Packaging', 'Safety'];

type StockActivity = {
  id: string;
  itemId: string;
  itemName: string;
  action: 'take' | 'stock';
  amount: number;
  quantityAfter: number;
  unit: string;
  timestamp: number;
};

type AuditRecord = {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  requesterName: string;
  department: string;
  purpose: string;
  pricePerUnit?: number;
  createdAt: number;
};

function loadItems(): InventoryItem[] {
  if (typeof window === 'undefined') return seedItems;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return seedItems;
    const parsed = JSON.parse(saved) as Array<Partial<InventoryItem>>;
    return Array.isArray(parsed) && parsed.length
      ? parsed.map((item) => ({
        ...item,
        id: String(item.id ?? `item-${Date.now()}`),
        name: String(item.name ?? 'Unnamed material'),
        category: (item.category ?? 'Office') as Category,
        quantity: Number(item.quantity ?? 0),
        unit: String(item.unit ?? 'units'),
        threshold: Number(item.threshold ?? 0),
        location: String(item.location ?? 'Unassigned'),
        note: item.note,
        pricePerUnit: Number(item.pricePerUnit ?? 0),
        imageUrl: item.imageUrl ? String(item.imageUrl) : null,
      }))
      : seedItems;
  } catch {
    return seedItems;
  }
}

function loadActivities(): StockActivity[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as StockActivity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadAuditRecords(): AuditRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as AuditRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeDate(value: string | null | undefined, fallback = '') {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

function getImageSrc(imageUrl: string | null | undefined) {
  if (!imageUrl) return undefined;
  return imageUrl.startsWith('/objects/') ? `/api/storage${imageUrl}` : imageUrl;
}

async function uploadInventoryImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Images must be 10 MB or smaller.');

  const response = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!response.ok) throw new Error('The image upload could not be started.');
  const upload = await response.json() as { uploadURL?: string; objectPath?: string };
  if (!upload.uploadURL || !upload.objectPath) throw new Error('The upload response was incomplete.');

  const uploaded = await fetch(upload.uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploaded.ok) throw new Error('The image upload failed.');
  return upload.objectPath;
}

function applyApiState(state: Pick<ApiInventoryState, 'items' | 'activities' | 'auditRecords'> & { borrowedItems?: ApiInventoryState['borrowedItems'] }) {
  return {
    items: state.items.map((item) => ({
      ...item,
      category: item.category as Category,
      note: item.note ?? undefined,
      pricePerUnit: Number(item.pricePerUnit ?? 0),
      imageUrl: item.imageUrl ?? null,
    })),
    activities: state.activities.map((activity) => ({
      ...activity,
      action: activity.action as StockActivity['action'],
      timestamp: new Date(activity.timestamp).getTime(),
    })),
    auditRecords: state.auditRecords.map((record) => ({
      ...record,
      date: safeDate(record.date, new Date().toISOString()).slice(0, 10),
      pricePerUnit: record.pricePerUnit,
      createdAt: new Date(record.createdAt).getTime(),
    })),
    borrowedItems: (state.borrowedItems ?? []).map((record) => ({
      ...record,
      dateBorrowed: safeDate(record.dateBorrowed, new Date().toISOString()).slice(0, 10),
      dateReturned: record.dateReturned ? safeDate(record.dateReturned, '')?.slice(0, 10) || null : null,
      conditionReturned: record.conditionReturned ?? null,
    })),
  };
}

function getOperationalStatus(item: InventoryItem, borrowedItems: BorrowedItem[]): OperationalStatus {
  const itemRecords = borrowedItems.filter((record) => record.itemId === item.id);
  if (itemRecords.some((record) => record.status === 'Broke')) return 'Needs Repair';
  if (itemRecords.some((record) => record.status === 'Borrowed')) return 'Borrowed';
  if (item.quantity === 0) return 'Out of Stock';
  if (item.quantity <= item.threshold) return 'Low Stock';
  return 'Available';
}

function recordDateInRange(value: string, period: AnalyticsPeriod, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(now);
  if (period === 'daily') start.setHours(0, 0, 0, 0);
  if (period === 'weekly') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }
  if (period === 'monthly') {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  return date >= start && date <= now;
}

function Dashboard() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activities, setActivities] = useState<StockActivity[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [borrowedItems, setBorrowedItems] = useState<BorrowedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | Category>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | OperationalStatus>('All');
  const [inventorySort, setInventorySort] = useState<{ key: InventorySortKey; direction: SortDirection } | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('weekly');
  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialog, setDialog] = useState<{ mode: 'add' | 'edit'; item?: InventoryItem } | null>(null);
  const [borrowedDialog, setBorrowedDialog] = useState<{ mode: 'add' | 'edit'; item?: BorrowedItem } | null>(null);
  const [borrowedDeleteTarget, setBorrowedDeleteTarget] = useState<BorrowedItem | null>(null);
  const [importState, setImportState] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'neutral' } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const loadDatabaseState = async () => {
      try {
        let state = await getInventoryState();
        if (!state.items.length) {
          const localItems = loadItems();
          const localActivities = loadActivities();
          const localAuditRecords = loadAuditRecords();
          state = await bootstrapInventory({
            items: localItems,
            activities: localActivities.map((activity) => ({
              ...activity,
              timestamp: new Date(activity.timestamp).toISOString(),
            })),
            auditRecords: localAuditRecords.map(({ date, itemId, quantity, requesterName, department, purpose }) => ({
              date,
              itemId,
              quantity,
              requesterName,
              department,
              purpose,
            })),
            borrowedItems: [],
          });
        }
        if (!active) return;
        const next = applyApiState(state);
        setItems(next.items);
        setActivities(next.activities);
        setAuditRecords(next.auditRecords);
        setBorrowedItems(next.borrowedItems);
        setLoadError(null);
      } catch {
        if (active) setLoadError('The inventory database could not be reached. Refresh to try again.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadDatabaseState();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const lowStock = useMemo(() => items.filter((item) => item.quantity > 0 && item.quantity <= item.threshold), [items]);
  const outOfStock = useMemo(() => items.filter((item) => item.quantity === 0), [items]);
  const borrowedCount = useMemo(() => borrowedItems.filter((item) => item.status !== 'Returned').length, [borrowedItems]);
  const repairCount = useMemo(() => borrowedItems.filter((item) => item.status === 'Broke').length, [borrowedItems]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchingItems = items.filter((item) => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.location.toLowerCase().includes(query);
      const matchesCategory = category === 'All' || item.category === category;
      const matchesStatus = statusFilter === 'All' || getOperationalStatus(item, borrowedItems) === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
    if (!inventorySort) return matchingItems;

    const sortedItems = [...matchingItems].sort((a, b) => {
      const valueFor = (item: InventoryItem): string | number => {
        if (inventorySort.key === 'status') return getOperationalStatus(item, borrowedItems);
        if (inventorySort.key === 'pricePerUnit') return item.pricePerUnit;
        return item[inventorySort.key];
      };
      const aValue = valueFor(a);
      const bValue = valueFor(b);
      const comparison = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base', numeric: true });
      if (comparison !== 0) return inventorySort.direction === 'asc' ? comparison : -comparison;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
    return sortedItems;
  }, [borrowedItems, category, inventorySort, items, search, statusFilter]);

  const analytics = useMemo(() => {
    const usage = auditRecords.filter((record) => recordDateInRange(record.date, analyticsPeriod));
    const borrowed = borrowedItems.filter((record) => record.status !== 'Returned' && recordDateInRange(record.dateBorrowed, analyticsPeriod));
    const usedQuantity = usage.reduce((total, record) => total + record.quantity, 0);
    const borrowedQuantity = borrowed.reduce((total, record) => total + record.quantity, 0);
    const spent = usage.reduce((total, record) => {
      const itemPrice = items.find((item) => item.id === record.itemId)?.pricePerUnit ?? 0;
      return total + record.quantity * Number(record.pricePerUnit ?? itemPrice);
    }, 0);
    return { usedQuantity, borrowedQuantity, spent };
  }, [analyticsPeriod, auditRecords, borrowedItems, items]);

  const showToast = (message: string, tone: 'success' | 'neutral' = 'success') => setToast({ message, tone });

  const refreshDatabaseState = async () => {
    const state = applyApiState(await getInventoryState());
    setItems(state.items);
    setActivities(state.activities);
    setAuditRecords(state.auditRecords);
    setBorrowedItems(state.borrowedItems);
  };

  const setExactQuantity = async (id: string, requestedQuantity: number) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const nextQuantity = Math.max(0, Math.round(requestedQuantity));
    const actualChange = nextQuantity - item.quantity;
    if (!actualChange) {
      return;
    }
    try {
      await adjustInventoryQuantity({ itemId: id, quantity: nextQuantity });
      setItems((current) => current.map((entry) => entry.id === id ? { ...entry, quantity: nextQuantity } : entry));
      await refreshDatabaseState();
      setFlashId(id);
      window.setTimeout(() => setFlashId((current) => current === id ? null : current), 450);
      showToast(`${item.name} ${actualChange > 0 ? 'stocked' : 'taken'}.`);
    } catch {
      showToast('The quantity could not be saved.', 'neutral');
    }
  };

  const adjustQuantity = async (id: string, amount: number) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (amount < 0 && item.quantity === 0) {
      showToast(`${item.name} is already at zero.`, 'neutral');
      return;
    }
    await setExactQuantity(id, item.quantity + amount);
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    const selectedImage = form.get('imageFile');
    let imageUrl = String(form.get('imageUrl') || '').trim() || null;
    try {
      if (selectedImage instanceof File && selectedImage.size > 0) {
        imageUrl = await uploadInventoryImage(selectedImage);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The image upload failed.', 'neutral');
      return;
    }
    const next: InventoryItem = {
      id: dialog?.item?.id || `item-${Date.now()}`,
      name,
      category: String(form.get('category')) as Category,
      quantity: Math.max(0, Number(form.get('quantity')) || 0),
      unit: String(form.get('unit') || 'units').trim(),
      threshold: Math.max(0, Number(form.get('threshold')) || 0),
      location: String(form.get('location') || 'Unassigned').trim(),
      note: String(form.get('note') || '').trim(),
      pricePerUnit: Math.max(0, Number(form.get('pricePerUnit')) || 0),
      imageUrl,
    };
    try {
      if (dialog?.mode === 'edit') {
        await updateInventoryItem(next.id, next);
      } else {
        await createInventoryItem(next);
      }
      await refreshDatabaseState();
      showToast(dialog?.mode === 'edit' ? 'Inventory record updated.' : 'New material added.');
      setDialog(null);
    } catch {
      showToast('The inventory record could not be saved.', 'neutral');
    }
  };

  const saveAuditRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const itemId = String(form.get('itemId') || '');
    const item = items.find((entry) => entry.id === itemId);
    const requesterName = String(form.get('requesterName') || '').trim();
    const department = String(form.get('department') || '').trim();
    const purpose = String(form.get('purpose') || '').trim();
    if (!item || !requesterName || !department || !purpose) return;
    const quantity = Math.max(1, Math.round(Number(form.get('quantity')) || 0));
    const date = String(form.get('date') || new Date().toISOString().slice(0, 10));
    try {
      await createAuditRecord({ date, itemId, quantity, requesterName, department, purpose });
      await refreshDatabaseState();
      formElement.reset();
      showToast(`${quantity} ${item.unit} deducted and request recorded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      showToast(message || 'The request could not be recorded.', 'neutral');
    }
  };

  const deleteAuditRecord = async (id: string) => {
    try {
      await deleteAuditRecordRequest(id);
      await refreshDatabaseState();
       showToast('Record removed and quantity restored.', 'neutral');
    } catch {
       showToast('The record could not be removed.', 'neutral');
    }
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInventoryItem(deleteTarget.id);
      await refreshDatabaseState();
      showToast(`${deleteTarget.name} removed from inventory.`, 'neutral');
      setDeleteTarget(null);
    } catch {
      showToast('The inventory record could not be removed.', 'neutral');
    }
  };

  const saveBorrowedRecord = async (input: BorrowedItemInput, id?: string) => {
    try {
      if (id) {
        await updateBorrowedItem(id, input);
      } else {
        await createBorrowedItem(input);
      }
      await refreshDatabaseState();
      setBorrowedDialog(null);
      showToast(id ? 'Borrowed record updated.' : 'Borrowed item checked out.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      showToast(message || 'The borrowed record could not be saved.', 'neutral');
    }
  };

  const removeBorrowedRecord = async () => {
    if (!borrowedDeleteTarget) return;
    try {
      await deleteBorrowedItem(borrowedDeleteTarget.id);
      await refreshDatabaseState();
      showToast('Borrowed record removed and inventory reconciled.', 'neutral');
      setBorrowedDeleteTarget(null);
    } catch {
      showToast('The borrowed record could not be removed.', 'neutral');
    }
  };

  const importItems = async (file: File) => {
    setImportState(null);
    try {
      if (file.type && file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
        throw new Error('Choose a JSON file.');
      }
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { items?: unknown }).items)) {
        throw new Error('The file must contain an items array.');
      }
      const rawItems = (parsed as { items: unknown[] }).items;
       const requiredFields = ['id', 'name', 'category', 'quantity', 'unit', 'threshold', 'location'];
      const validCategories = categories.slice(1);
      const errors: string[] = [];
      const itemsToImport = rawItems.map((raw, index) => {
        if (!raw || typeof raw !== 'object') {
          errors.push(`Item ${index + 1} is not an object.`);
          return null;
        }
        const candidate = raw as Record<string, unknown>;
        const missing = requiredFields.filter((field) => candidate[field] === undefined || candidate[field] === '');
        if (missing.length) errors.push(`Item ${index + 1} is missing ${missing.join(', ')}.`);
        if (!validCategories.includes(candidate.category as Category)) errors.push(`Item ${index + 1} has an invalid category.`);
        if (
          typeof candidate.quantity !== 'number' || !Number.isInteger(candidate.quantity) || candidate.quantity < 0
          || typeof candidate.threshold !== 'number' || !Number.isInteger(candidate.threshold) || candidate.threshold < 0
        ) {
          errors.push(`Item ${index + 1} must use non-negative whole numbers for quantity and threshold.`);
        }
        return {
          id: String(candidate.id ?? ''),
          name: String(candidate.name ?? ''),
          category: candidate.category as Category,
          quantity: Number(candidate.quantity),
          unit: String(candidate.unit ?? ''),
          threshold: Number(candidate.threshold),
          location: String(candidate.location ?? ''),
          note: candidate.note == null ? null : String(candidate.note),
           pricePerUnit: Math.max(0, Number(candidate.pricePerUnit ?? 0) || 0),
           imageUrl: candidate.imageUrl == null || candidate.imageUrl === '' ? null : String(candidate.imageUrl),
        };
      }).filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (errors.length) throw new Error(errors.slice(0, 3).join(' '));
      if (!itemsToImport.length) throw new Error('Add at least one item to import.');
      const result = await importInventoryItems({ items: itemsToImport });
      await refreshDatabaseState();
      setImportState({ tone: 'success', message: `${result.insertedCount} material${result.insertedCount === 1 ? '' : 's'} imported and synced.` });
      showToast('Bulk import complete.');
    } catch (error) {
      setImportState({ tone: 'error', message: error instanceof Error ? error.message : 'The JSON file could not be imported.' });
    }
  };

  const exportItems = () => {
    const payload = { items: items.map(({ id, name, category, quantity, unit, threshold, location, note, pricePerUnit, imageUrl }) => ({ id, name, category, quantity, unit, threshold, location, note: note ?? null, pricePerUnit, imageUrl })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boltimizer-inventory-register.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Inventory register exported.', 'neutral');
  };

  const resetFilters = () => {
    setSearch('');
    setCategory('All');
    setStatusFilter('All');
    setInventorySort(null);
    showToast('Filters cleared.', 'neutral');
  };

  const sortInventory = (key: InventorySortKey) => {
    setInventorySort((current) => current?.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  if (isLoading) {
    return <div className="inventory-shell paper-grain flex min-h-[100dvh] items-center justify-center px-6 text-[#111522]"><div className="rounded-xl border border-[#f0dfe2] bg-white px-6 py-5 text-center soft-shadow"><span className="mx-auto flex h-10 w-10 animate-pulse items-center justify-center rounded-lg bg-[#fff0f2] text-[#e40012]"><Archive size={18} /></span><p className="mt-3 text-sm font-bold">Connecting to the materials database…</p><p className="mt-1 text-xs text-[#777c86]">Loading the shared cabinet state.</p></div></div>;
  }

  if (loadError) {
    return <div className="inventory-shell paper-grain flex min-h-[100dvh] items-center justify-center px-6 text-[#111522]"><div className="max-w-md rounded-xl border border-[#f0dfe2] bg-white px-6 py-5 text-center soft-shadow"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ffe4e7] text-[#b0000f]"><X size={18} /></span><p className="mt-3 text-sm font-bold">{loadError}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-[#e40012] px-4 py-2.5 text-sm font-bold text-white">Refresh workspace</button></div></div>;
  }

  return (
    <div className="inventory-shell paper-grain min-h-[100dvh] text-[#111522]">
      <div className="flex min-h-[100dvh]">
          <aside
           className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[268px] flex-col overflow-y-auto border-r border-[#f0dfe2] bg-white px-5 py-6 text-[#111522] shadow-[12px_0_32px_rgba(17,21,34,.08)] transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-start justify-between">
            <button type="button" onClick={() => { setView('overview'); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="group text-left" data-testid="button-brand-home">
              <span className="flex items-center gap-3">
                <img src={logoAsset} alt="Boltimizer" className="h-12 w-12 object-contain" />
                <span>
                  <span className="block text-[19px] font-bold leading-none tracking-[-0.06em]">BOLTIMIZER</span>
                  <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-[#e40012]">Engineering solutions</span>
                </span>
              </span>
              <span className="mt-5 block font-mono text-[10px] uppercase tracking-[0.22em] text-[#a66a72]">Materials control room</span>
              <span className="mt-1 block text-[18px] font-bold tracking-[-0.04em]">Inventory / 01</span>
            </button>
            <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-[#777c86] hover:bg-[#fdecef] lg:hidden" aria-label="Close menu" data-testid="button-close-menu">
              <X size={18} />
            </button>
          </div>

          <div className="mt-14">
            <p className="px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#aa7c82]">Workspace</p>
            <nav className="mt-3 space-y-1" aria-label="Main navigation">
              <button type="button" onClick={() => { setView('overview'); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${view === 'overview' ? 'bg-[#fff0f2] text-[#e40012]' : 'text-[#747983] hover:bg-[#fff4f5] hover:text-[#111522]'}`} data-testid="button-nav-overview">
                <ClipboardList size={17} /> Overview
              </button>
              <button type="button" onClick={() => { setView('inventory'); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${view === 'inventory' ? 'bg-[#fff0f2] text-[#e40012]' : 'text-[#747983] hover:bg-[#fff4f5] hover:text-[#111522]'}`} data-testid="button-nav-inventory">
                <Archive size={17} /> Inventory <span className="ml-auto rounded-md bg-[#e40012] px-1.5 py-0.5 font-mono text-[10px] text-white">{items.length}</span>
              </button>
              <button type="button" onClick={() => { setView('borrowed'); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${view === 'borrowed' ? 'bg-[#fff0f2] text-[#e40012]' : 'text-[#747983] hover:bg-[#fff4f5] hover:text-[#111522]'}`} data-testid="button-nav-borrowed">
                <PackageOpen size={17} /> Borrowed <span className="ml-auto rounded-md bg-[#f6cdd2] px-1.5 py-0.5 font-mono text-[10px] text-[#8d2632]">{borrowedCount}</span>
              </button>
               <button type="button" onClick={() => { setView('records'); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${view === 'records' ? 'bg-[#fff0f2] text-[#e40012]' : 'text-[#747983] hover:bg-[#fff4f5] hover:text-[#111522]'}`} data-testid="button-nav-records">
                 <ClipboardCheck size={17} /> Records <span className="ml-auto rounded-md bg-[#f6cdd2] px-1.5 py-0.5 font-mono text-[10px] text-[#8d2632]">{auditRecords.length + borrowedItems.length}</span>
              </button>
            </nav>
          </div>

          <div className="mt-auto rounded-xl border border-[#f0d5d9] bg-[#fff4f5] p-4">
            <div className="flex items-center justify-between">
               <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e40012] text-white"><Sparkles size={16} /></span>
               <span className="font-mono text-[10px] uppercase tracking-wider text-[#aa7c82]">Signal</span>
            </div>
              <p className="mt-4 text-sm font-semibold text-[#111522]">{lowStock.length + outOfStock.length ? `${lowStock.length + outOfStock.length} ${(lowStock.length + outOfStock.length) === 1 ? 'item needs' : 'items need'} a look.` : 'Cabinet is in good shape.'}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#777c86]">{lowStock.length + outOfStock.length ? 'Review before the next print run.' : 'No urgent stock decisions today.'}</p>
          </div>
          <div className="mt-5 flex items-center gap-2 px-2 text-xs text-[#777c86]">
            <span className="h-2 w-2 rounded-full bg-[#10a77b]" />
             Shared database
          </div>
        </aside>

        {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-[#111522]/35 lg:hidden" onClick={() => setSidebarOpen(false)} data-testid="button-overlay-close" />}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#f0dfe2] bg-white/95 px-5 backdrop-blur-md sm:px-8 lg:px-12">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSidebarOpen(true)} className="relative z-10 rounded-lg p-2 text-[#4e535f] hover:bg-[#fff0f2] lg:hidden" aria-label="Open menu" aria-expanded={sidebarOpen} data-testid="button-open-menu"><Menu size={20} /></button>
               <div className="hidden items-center gap-2 text-xs font-semibold text-[#777c86] sm:flex"><span>Boltimizer operations</span><span className="text-[#e5b7bd]">/</span><span className="text-[#111522]">{view === 'overview' ? 'Overview' : view === 'inventory' ? 'Inventory' : view === 'borrowed' ? 'Borrowed / pull-out' : 'Records'}</span></div>
               <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#aa7c82] sm:hidden">{view === 'borrowed' ? 'pull-out' : view === 'records' ? 'Records' : view}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button type="button" onClick={() => { setView('inventory'); window.setTimeout(() => searchRef.current?.focus(), 20); }} className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#747983] hover:bg-[#fff0f2] md:flex" data-testid="button-focus-search"><Search size={15} /> Find material <kbd className="rounded border border-[#f0d5d9] bg-[#fff7f8] px-1.5 py-0.5 font-mono text-[9px]">/</kbd></button>
            </div>
          </header>

           <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
             {view === 'overview' && <>
             <section className="appear">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#d10011]">{dateLabel} <span className="text-[#bd969b]">·</span> boltimizer / production desk</p>
                <h1 className="mt-2 max-w-2xl text-[clamp(2rem,4vw,3.7rem)] font-extrabold leading-[.98] tracking-[-0.07em] text-[#111522]">Materials ready<br /><span className="text-[#e40012]">for the next solution.</span></h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#5f6570]">A precise read on the components behind every maintenance, control, and engineering job.</p>
              </div>
            </section>

             <section className="appear-2 mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Inventory summary">
               <StatCard label="Low stock" value={lowStock.length} detail={lowStock.length ? 'below threshold' : 'clear'} icon={<AlertTriangle size={18} />} tone={lowStock.length ? 'coral' : 'sage'} testId="stat-low-stock" />
               <StatCard label="Out of stock" value={outOfStock.length} detail={outOfStock.length ? 'needs replenishment' : 'none'} icon={<MinusCircle size={18} />} tone={outOfStock.length ? 'coral' : 'teal'} testId="stat-out-of-stock" />
               <StatCard label="Borrowed items" value={borrowedCount} detail="currently out" icon={<PackageOpen size={18} />} tone="navy" testId="stat-borrowed" />
               <StatCard label="Needs repair" value={repairCount} detail={repairCount ? 'returned damaged' : 'no repair flags'} icon={<Wrench size={18} />} tone={repairCount ? 'gold' : 'sage'} testId="stat-needs-repair" />
            </section>
             <AnalyticsPanel period={analyticsPeriod} onPeriodChange={setAnalyticsPeriod} usedQuantity={analytics.usedQuantity} borrowedQuantity={analytics.borrowedQuantity} spent={analytics.spent} />

            <section className="appear-3 mt-8 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
              <div className="rounded-xl border border-[#f0dfe2] bg-white p-5 sm:p-6 soft-shadow">
                <div className="flex items-start justify-between gap-4">
                   <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Operations pulse</p><h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">What needs a decision?</h2></div>
                </div>
                 <div className="panel-scroll mt-5 h-[360px] overflow-y-auto pr-2">
                    {lowStock.map((item) => <LowStockRow key={item.id} item={item} onAdjust={adjustQuantity} onEdit={() => setDialog({ mode: 'edit', item })} />)}
                    {outOfStock.map((item) => <LowStockRow key={item.id} item={item} onAdjust={adjustQuantity} onEdit={() => setDialog({ mode: 'edit', item })} />)}
                   {!lowStock.length && !outOfStock.length && <div className="flex items-center gap-3 rounded-xl bg-[#e2f0e5] px-4 py-4 text-sm text-[#2e604d]"><Check size={18} /><span>Everything is above its minimum threshold. Nice and quiet.</span></div>}
                </div>
              </div>
              <ActivityLog activities={activities} />
            </section>
             </>}

             {view === 'inventory' && <section className="appear-4" aria-labelledby="inventory-heading">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                 <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">The materials register</p><h1 id="inventory-heading" className="mt-1 text-[clamp(2rem,4vw,3.4rem)] font-extrabold tracking-[-0.07em]">Inventory, at a glance.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#5f6570]">Manage everyday office supplies, tools, print materials, and finishing stock from one cabinet.</p></div>
                 <button type="button" onClick={() => setDialog({ mode: 'add' })} className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#e40012] px-4 py-3 text-sm font-bold text-white shadow-[4px_4px_0_#111522] transition hover:-translate-y-0.5 hover:shadow-[5px_6px_0_#111522] active:translate-y-0" data-testid="button-add-item">
                   <Plus size={17} /> Add material <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                 </button>
              </div>

                  <BulkImportPanel importState={importState} onImport={importItems} onExport={exportItems} />
                  <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#f0dfe2] bg-white p-3 sm:p-4 soft-shadow">
                <div className="flex flex-col gap-3 md:flex-row">
                  <label className="relative flex-1">
                    <span className="sr-only">Search materials</span>
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8993a0]" />
                     <input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplies, tools, or locations" className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] pl-10 pr-4 text-sm text-[#111522] placeholder:text-[#9ca2aa] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid="input-search-inventory" />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2" aria-label="Filter by category">
                   {categories.map((entry) => <button type="button" key={entry} onClick={() => setCategory(entry)} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${category === entry ? 'border-[#e40012] bg-[#e40012] text-white' : 'border-[#f0dfe2] bg-[#fff8f9] text-[#677286] hover:border-[#e6a0a8] hover:text-[#111522]'}`} data-testid={`button-filter-${entry.toLowerCase()}`}>{entry}{entry !== 'All' && <span className={`ml-1.5 font-mono text-[10px] ${category === entry ? 'text-[#ffdfe2]' : 'text-[#a3a4a5]'}`}>{items.filter((item) => item.category === entry).length}</span>}</button>)}
                </div>
                  <div className="flex flex-col gap-2 border-t border-[#f0dfe2] pt-3 sm:flex-row sm:items-center sm:justify-between">
                     <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#92747b]">Filter by status</p><p className="mt-1 text-xs text-[#89909b]">Show only materials with a selected operational status.</p></div>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | OperationalStatus)} className="h-10 rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-xs font-bold text-[#4f535e] focus:border-[#e40012] focus:outline-none" data-testid="select-inventory-status-filter">
                      <option value="All">All statuses</option>
                      <option value="Available">Available</option>
                      <option value="Low Stock">Low Stock</option>
                      <option value="Out of Stock">Out of Stock</option>
                      <option value="Borrowed">Borrowed</option>
                      <option value="Needs Repair">Needs Repair</option>
                    </select>
                 </div>
              </div>

               {filteredItems.length > 0 ? (
                 <>
                   <div className="inventory-table-scroll mt-4 h-[540px] overflow-auto rounded-xl border border-[#f0dfe2] bg-white soft-shadow" aria-label="Inventory table scroll area" data-testid="inventory-table-scroll">
                     <table className="w-full min-w-[1020px] border-collapse text-left">
                           <thead className="sticky top-0 z-20"><tr className="border-b border-[#f0dfe2] bg-[#fff7f8] text-[10px] uppercase tracking-[0.12em] text-[#92747b]"><th scope="col" className="px-5 py-4 font-mono font-medium">Preview</th><SortableHeader label="Item name" sortKey="name" sort={inventorySort} onSort={sortInventory} /><SortableHeader label="Category" sortKey="category" sort={inventorySort} onSort={sortInventory} /><SortableHeader label="Quantity in stock" sortKey="quantity" sort={inventorySort} onSort={sortInventory} /><SortableHeader label="Unit" sortKey="unit" sort={inventorySort} onSort={sortInventory} /><SortableHeader label="Price per Unit" sortKey="pricePerUnit" sort={inventorySort} onSort={sortInventory} /><SortableHeader label="Min. threshold" sortKey="threshold" sort={inventorySort} onSort={sortInventory} /><SortableHeader label="Operational status" sortKey="status" sort={inventorySort} onSort={sortInventory} /><SortableHeader label="Cabinet location" sortKey="location" sort={inventorySort} onSort={sortInventory} /><th scope="col" className="px-5 py-4 text-right font-mono font-medium">Actions</th></tr></thead>
                         <tbody>{filteredItems.map((item) => <InventoryRow key={item.id} item={item} borrowedItems={borrowedItems} flash={flashId === item.id} onAdjust={adjustQuantity} onSetQuantity={setExactQuantity} onEdit={() => setDialog({ mode: 'edit', item })} onDelete={() => setDeleteTarget(item)} />)}</tbody>
                    </table>
                   </div>
                    <div className="flex items-center justify-between border-t border-[#f0dfe2] bg-[#fff7f8] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#92747b]"><span data-testid="text-filter-count">{filteredItems.length} of {items.length} materials shown</span><span>All changes sync instantly</span></div>
                 </>
              ) : (
                 <EmptyState search={search} category={category} statusFilter={statusFilter} onReset={resetFilters} onAdd={() => { setDialog({ mode: 'add' }); setView('inventory'); }} />
              )}
             </section>}

               {view === 'borrowed' && <BorrowedView records={borrowedItems} onAdd={() => setBorrowedDialog({ mode: 'add' })} onEdit={(item) => setBorrowedDialog({ mode: 'edit', item })} onDelete={(item) => setBorrowedDeleteTarget(item)} />}
               {view === 'records' && <RecordsView items={items} records={auditRecords} borrowedItems={borrowedItems} onSave={saveAuditRecord} onDelete={deleteAuditRecord} />}
          </div>
        </main>
      </div>

       {toast && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#111522] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(17,21,34,.22)]" role="status" data-testid="status-toast"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${toast.tone === 'success' ? 'bg-[#e40012] text-white' : 'bg-[#f6cdd2] text-[#111522]'}`}><Check size={13} strokeWidth={3} /></span>{toast.message}</div>}
      {dialog && <ItemDialog dialog={dialog} onClose={() => setDialog(null)} onSave={saveItem} />}
      {deleteTarget && <DeleteDialog item={deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={deleteItem} />}
       {borrowedDialog && <BorrowedDialog dialog={borrowedDialog} items={items} onClose={() => setBorrowedDialog(null)} onSave={saveBorrowedRecord} />}
       {borrowedDeleteTarget && <BorrowedDeleteDialog item={borrowedDeleteTarget} onClose={() => setBorrowedDeleteTarget(null)} onDelete={removeBorrowedRecord} />}
    </div>
  );
}

function StatCard({ label, value, detail, icon, tone, testId }: { label: string; value: number | string; detail: string; icon: ReactNode; tone: 'navy' | 'teal' | 'coral' | 'sage' | 'gold'; testId: string }) {
  const tones = { navy: 'bg-[#111522] text-white', teal: 'bg-[#fff0f2] text-[#a9000d]', coral: 'bg-[#ffe4e7] text-[#b0000f]', sage: 'bg-[#e7f5ef] text-[#14704f]', gold: 'bg-[#fff1f2] text-[#8d2632]' };
  return <div className={`lift rounded-xl border border-[#f0dfe2] p-5 ${tones[tone]}`} data-testid={testId}><div className="flex items-start justify-between"><p className="text-xs font-bold opacity-75">{label}</p><span className="opacity-80">{icon}</span></div><div className="mt-5 flex items-end justify-between"><p className="text-3xl font-extrabold tracking-[-0.07em]" data-testid={`${testId}-value`}>{value}</p><p className="pb-1 text-right font-mono text-[9px] uppercase tracking-wider opacity-70">{detail}</p></div></div>;
}

function AnalyticsPanel({ period, onPeriodChange, usedQuantity, borrowedQuantity, spent }: { period: AnalyticsPeriod; onPeriodChange: (period: AnalyticsPeriod) => void; usedQuantity: number; borrowedQuantity: number; spent: number }) {
  const periodLabel = period === 'daily' ? 'today' : period === 'weekly' ? 'last 7 days' : 'last 30 days';
  return <section className="appear-3 mt-5 rounded-xl border border-[#f0dfe2] bg-white p-5 soft-shadow sm:p-6" aria-label="Operations analytics" data-testid="panel-analytics">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Usage intelligence</p><h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">The cabinet, in motion.</h2><p className="mt-1 text-xs text-[#7d8490]">Live totals from records and pull-outs for {periodLabel}.</p></div>
      <div className="flex rounded-lg border border-[#f0dfe2] bg-[#fff8f9] p-1" role="group" aria-label="Analytics timeframe">
        {(['daily', 'weekly', 'monthly'] as AnalyticsPeriod[]).map((entry) => <button type="button" key={entry} onClick={() => onPeriodChange(entry)} className={`rounded-md px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition ${period === entry ? 'bg-[#111522] text-white' : 'text-[#8d747b] hover:bg-[#fff0f2]'}`} data-testid={`button-analytics-${entry}`}>{entry}</button>)}
       </div>
     </div>
    <div className="mt-5 grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border border-[#e9e3d8] bg-[#fbf7ef] p-4" data-testid="analytics-items-used"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-[#8c756d]">Items used</span><BarChart3 size={16} className="text-[#e40012]" /></div><p className="mt-3 text-2xl font-extrabold tracking-[-0.06em] text-[#111522]">{usedQuantity}</p><p className="mt-1 text-xs text-[#7c828a]">consumed material units</p></div>
      <div className="rounded-lg border border-[#e0e5e2] bg-[#f2f7f4] p-4" data-testid="analytics-items-borrowed"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-[#567569]">Items borrowed</span><PackageOpen size={16} className="text-[#286e7d]" /></div><p className="mt-3 text-2xl font-extrabold tracking-[-0.06em] text-[#111522]">{borrowedQuantity}</p><p className="mt-1 text-xs text-[#7c828a]">active pull-out units</p></div>
      <div className="rounded-lg border border-[#ead9d2] bg-[#fff5ef] p-4" data-testid="analytics-expenses"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-[#8b6357]">Expenses spent</span><CircleDollarSign size={16} className="text-[#a95242]" /></div><p className="mt-3 text-2xl font-extrabold tracking-[-0.06em] text-[#111522]">{formatCurrency(spent)}</p><p className="mt-1 text-xs text-[#7c828a]">used material value</p></div>
    </div>
  </section>;
}

function formatActivityTime(timestamp: number) {
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ActivityLog({ activities }: { activities: StockActivity[] }) {
  return <div className="relative overflow-hidden rounded-xl bg-[#111522] p-5 text-white sm:p-6">
    <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border-[22px] border-[#e40012]/35" />
    <div className="absolute bottom-[-34px] right-12 h-24 w-24 rounded-full border-[13px] border-[#f6a6ad]/25" />
    <div className="relative">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f6a6ad]">Stock activity</p>
      <h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">Recent movements</h2>
      {activities.length ? <div className="panel-scroll mt-5 h-[360px] space-y-2 overflow-y-auto pr-2">
        {activities.map((activity) => {
          const isStock = activity.action === 'stock';
          const Icon = isStock ? PlusCircle : MinusCircle;
          return <div key={activity.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.06] px-3 py-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isStock ? 'bg-[#e40012] text-white' : 'bg-[#f6cdd2] text-[#111522]'}`}><Icon size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{activity.itemName}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-[#c6aeb3]">{isStock ? 'Stocked' : 'Taken'} {activity.amount} {activity.unit} · {formatActivityTime(activity.timestamp)}</p>
            </div>
            <span className="font-mono text-xs text-[#f6a6ad]">{activity.quantityAfter}</span>
          </div>;
        })}
      </div> : <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-white/[.04] px-4 py-5 text-sm leading-6 text-[#dbc8cc]">Stock movements will appear here when materials are taken or replenished.</div>}
    </div>
  </div>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function formatAuditDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
}

function RecordsView({ items, records, borrowedItems, onSave, onDelete }: { items: InventoryItem[]; records: AuditRecord[]; borrowedItems: BorrowedItem[]; onSave: (event: FormEvent<HTMLFormElement>) => void; onDelete: (id: string) => void }) {
  const defaultItemId = items.find((item) => item.name.toLowerCase().includes('a4'))?.id || items[0]?.id || '';
  const today = new Date().toISOString().slice(0, 10);
  const combinedRecords = [
    ...records.map((record) => ({
      id: record.id,
      recordType: 'Material usage',
      status: 'Consumed',
      date: record.date,
      person: record.requesterName,
      itemName: record.itemName,
      quantity: record.quantity,
      unit: record.unit,
      pricePerUnit: Number(record.pricePerUnit ?? items.find((item) => item.id === record.itemId)?.pricePerUnit ?? 0),
      detail: `${record.department} · ${record.purpose}`,
      deletable: true,
    })),
    ...borrowedItems.map((record) => ({
      id: `borrowed-${record.id}`,
      recordType: 'Pull-out',
      status: record.status,
      date: record.dateBorrowed,
      person: record.borrowerName,
      itemName: record.itemName,
      quantity: record.quantity,
      unit: record.unit,
      pricePerUnit: Number(record.pricePerUnit ?? items.find((item) => item.id === record.itemId)?.pricePerUnit ?? 0),
      detail: record.dateReturned ? `Returned ${formatAuditDate(record.dateReturned)}` : 'Still out',
      deletable: false,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return <section className="appear-4" aria-labelledby="records-heading">
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Records / operation log</p>
      <h1 id="records-heading" className="mt-1 text-[clamp(2rem,4vw,3.4rem)] font-extrabold tracking-[-0.07em]">Keep every handoff legible.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f6570]">Keep a clear handoff trail when another department takes supplies from the Boltimizer cabinet.</p>
    </div>

    <div className="mt-8 grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
       <form onSubmit={onSave} className="rounded-xl border border-[#f0dfe2] bg-white p-5 soft-shadow sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
             <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Material request</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">Who took what?</h2>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff0f2] text-[#e40012]"><ClipboardCheck size={17} /></span>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Date</span>
              <input name="date" type="date" defaultValue={today} required className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid="input-record-date" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Quantity</span>
              <input name="quantity" type="number" min="1" step="1" defaultValue="1" required className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid="input-record-quantity" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Requested material</span>
            <select name="itemId" defaultValue={defaultItemId} required className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid="select-record-item">
              {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Person requesting</span>
            <input name="requesterName" type="text" placeholder="e.g. Jordan Lee" required className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] placeholder:text-[#a3a7aa] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid="input-record-requester" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Department</span>
            <input name="department" type="text" placeholder="e.g. Maintenance or Sales" required className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] placeholder:text-[#a3a7aa] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid="input-record-department" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Purpose</span>
            <textarea name="purpose" rows={3} placeholder="What will the material be used for?" required className="w-full resize-none rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 py-3 text-sm text-[#111522] placeholder:text-[#a3a7aa] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid="input-record-purpose" />
          </label>
        </div>

        <div className="mt-5 border-t border-[#f0dfe2] pt-4">
          <p className="text-xs leading-5 text-[#777c86]">Saving this request deducts the requested quantity from cabinet stock and adds a “taken” activity.</p>
           <button type="submit" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#e40012] px-4 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#111522] transition hover:bg-[#c80010]" data-testid="button-save-record">
             <ClipboardCheck size={16} /> Save request record
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-[#f0dfe2] bg-white p-5 soft-shadow sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
           <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Combined record log</p>
           <h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">Usage and pull-outs</h2>
          </div>
           <span className="rounded-full bg-[#fff0f2] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#a9000d]">{combinedRecords.length} records</span>
        </div>

          {combinedRecords.length ? <div className="panel-scroll mt-5 h-[540px] space-y-2 overflow-y-auto pr-2">
           {combinedRecords.map((record) => <div key={record.id} className="rounded-lg border border-[#f0dfe2] bg-[#fff8f9] p-4" data-testid={`record-log-${record.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#111522]">{record.itemName}</p>
                 <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#92747b]">{formatAuditDate(record.date)} · {record.quantity} {record.unit} · {record.recordType}</p>
              </div>
               {record.deletable ? <button type="button" onClick={() => onDelete(record.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#a58a82] hover:bg-[#ffe4e7] hover:text-[#e40012]" aria-label={`Delete record for ${record.itemName}`} data-testid={`button-delete-record-${record.id}`}><Trash2 size={14} /></button> : <span className="rounded-full bg-[#fff1d6] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#8d5f24]">Read-only</span>}
            </div>
            <div className="mt-3 grid gap-2 border-t border-[#f0dfe2] pt-3 text-xs sm:grid-cols-2">
               <p><span className="font-semibold text-[#777c86]">Person</span><br /><span className="font-bold text-[#111522]">{record.person}</span></p>
               <p><span className="font-semibold text-[#777c86]">Status</span><br /><span className="font-bold text-[#111522]">{record.status}</span></p>
            </div>
             <div className="mt-3 grid gap-2 border-t border-[#f0dfe2] pt-3 text-xs sm:grid-cols-2"><p><span className="font-semibold text-[#777c86]">Estimated Price</span><br /><span className="font-mono font-bold text-[#111522]">{formatCurrency(record.pricePerUnit)} / {record.unit}</span></p><p><span className="font-semibold text-[#777c86]">Total Expense Spent</span><br /><span className="font-mono font-bold text-[#e40012]">{formatCurrency(record.quantity * record.pricePerUnit)}</span></p></div>
             <p className="mt-3 text-sm leading-5 text-[#5f6570]"><span className="font-semibold text-[#777c86]">Details:</span> {record.detail}</p>
          </div>)}
        </div> : <div className="mt-5 rounded-lg border border-dashed border-[#e6b9bf] bg-[#fff8f9] px-5 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#fff0f2] text-[#e40012]"><ClipboardCheck size={22} /></span>
           <h3 className="mt-4 text-base font-extrabold">No records yet.</h3>
           <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#777c86]">The next material use or pull-out will appear here with its cost and owner.</p>
        </div>}
      </div>
    </div>
  </section>;
}

function BulkImportPanel({ importState, onImport, onExport }: { importState: { tone: 'success' | 'error'; message: string } | null; onImport: (file: File) => void; onExport: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const downloadTemplate = () => {
    const template = {
      items: [{
        id: 'sample-paper-a4-matte',
        name: 'Matte coated A4',
        category: 'Paper',
        quantity: 62,
        unit: 'sheets',
        threshold: 75,
        location: 'Bay A · Shelf 2 · Bin B',
        note: '170 gsm, presentation finish',
         pricePerUnit: 0.18,
         imageUrl: null,
      }],
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boltimizer-inventory-template.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="mt-5 rounded-xl border border-[#e8d8cb] bg-[#fbf5ed] p-4 sm:p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Batch intake</p>
        <h2 className="mt-1 text-base font-extrabold tracking-[-0.03em]">Import a JSON register</h2>
        <p className="mt-1 max-w-xl text-xs leading-5 text-[#777c86]">Validate a complete item list in the browser, then send it to the shared cabinet database.</p>
      </div>
       <div className="flex flex-wrap gap-2"><button type="button" onClick={onExport} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#e2c8bc] bg-white px-3 py-2 text-xs font-bold text-[#6d5960] hover:bg-[#fff9f7]" data-testid="button-export-json"><Download size={14} /> Export register</button><button type="button" onClick={downloadTemplate} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#e2c8bc] bg-white px-3 py-2 text-xs font-bold text-[#6d5960] hover:bg-[#fff9f7]" data-testid="button-download-json-template"><Download size={14} /> Download template</button></div>
    </div>
    <label onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files[0]; if (file) onImport(file); }} className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition ${isDragging ? 'border-[#e40012] bg-[#fff0f2]' : 'border-[#d9bdb3] bg-white/70 hover:border-[#e40012]'}`} data-testid="dropzone-json-import">
      <input type="file" accept="application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = ''; }} data-testid="input-json-import" />
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff0f2] text-[#e40012]"><Archive size={16} /></span>
      <span className="mt-2 text-sm font-bold text-[#333846]">Drop a JSON file here or browse</span>
       <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[#9b8583]">Required fields: id, name, category, quantity, unit, threshold, location · optional: pricePerUnit, imageUrl</span>
    </label>
    {importState && <p className={`mt-3 rounded-lg px-3 py-2.5 text-xs font-semibold ${importState.tone === 'success' ? 'bg-[#e7f5ef] text-[#14704f]' : 'bg-[#ffe4e7] text-[#b0000f]'}`} role="status" data-testid={`status-json-import-${importState.tone}`}>{importState.message}</p>}
  </div>;
}

function BorrowedView({ records, onAdd, onEdit, onDelete }: { records: BorrowedItem[]; onAdd: () => void; onEdit: (item: BorrowedItem) => void; onDelete: (item: BorrowedItem) => void }) {
  return <section className="appear-4" aria-labelledby="borrowed-heading">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Borrowed / pull-out register</p>
        <h1 id="borrowed-heading" className="mt-1 text-[clamp(2rem,4vw,3.4rem)] font-extrabold tracking-[-0.07em]">Track what leaves the desk.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f6570]">Record equipment and material handoffs with condition notes. Inventory availability is adjusted transactionally by the server.</p>
      </div>
      <button type="button" onClick={onAdd} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#e40012] px-4 py-3 text-sm font-bold text-white shadow-[4px_4px_0_#111522] hover:bg-[#c80010]" data-testid="button-add-borrowed"><Plus size={17} /> Log pull-out</button>
    </div>
    <div className="mt-8 overflow-hidden rounded-xl border border-[#f0dfe2] bg-white soft-shadow">
      <div className="flex items-center justify-between border-b border-[#f0dfe2] bg-[#fff7f8] px-5 py-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Handoff history</p><h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">Active and closed pull-outs</h2></div>
        <span className="rounded-full bg-[#fff0f2] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#a9000d]" data-testid="text-borrowed-count">{records.length} records</span>
      </div>
      {records.length ? <div className="inventory-table-scroll h-[520px] overflow-auto"><table className="w-full min-w-[1060px] border-collapse text-left">
        <thead className="sticky top-0 z-20 bg-white"><tr className="border-b border-[#f0dfe2] bg-[#fff7f8] text-[10px] uppercase tracking-[0.12em] text-[#92747b]"><th className="px-5 py-4 font-mono font-medium">Borrower / item</th><th className="px-3 py-4 font-mono font-medium">Date borrowed</th><th className="px-3 py-4 font-mono font-medium">Qty</th><th className="px-3 py-4 font-mono font-medium">Condition out</th><th className="px-3 py-4 font-mono font-medium">Date returned</th><th className="px-3 py-4 font-mono font-medium">Condition in</th><th className="px-3 py-4 font-mono font-medium">Status</th><th className="px-5 py-4 text-right font-mono font-medium">Actions</th></tr></thead>
        <tbody>{records.map((record) => <BorrowedRow key={record.id} record={record} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />)}</tbody>
      </table></div> : <div className="px-6 py-16 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#fff0f2] text-[#e40012]"><PackageOpen size={22} /></span><h3 className="mt-4 text-base font-extrabold">No pull-outs recorded.</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#777c86]">When a tool or material leaves the cabinet, log it here so the next handoff starts with a clean count.</p></div>}
    </div>
  </section>;
}

function BorrowedRow({ record, onEdit, onDelete }: { record: BorrowedItem; onEdit: () => void; onDelete: () => void }) {
  const statusClass = record.status === 'Borrowed' ? 'bg-[#fff1d6] text-[#8d5f24]' : record.status === 'Broke' ? 'bg-[#ffe4e7] text-[#b0000f]' : 'bg-[#e7f5ef] text-[#14704f]';
  return <tr className="border-b border-[#e8e0d5] last:border-0 hover:bg-[#fffaf5]" data-testid={`row-borrowed-${record.id}`}>
    <td className="px-5 py-4"><p className="text-sm font-bold text-[#25344c]">{record.borrowerName}</p><p className="mt-1 text-xs text-[#7b8490]">{record.itemName} · {record.quantity} {record.unit}</p></td>
    <td className="px-3 py-4 font-mono text-xs text-[#6e7888]">{formatAuditDate(record.dateBorrowed)}</td>
    <td className="px-3 py-4 font-mono text-xs text-[#6e7888]">{record.quantity} {record.unit}</td>
    <td className="max-w-[160px] px-3 py-4 text-xs text-[#596475]">{record.conditionBorrowed}</td>
    <td className="px-3 py-4 font-mono text-xs text-[#6e7888]">{record.dateReturned ? formatAuditDate(record.dateReturned) : '—'}</td>
    <td className="max-w-[160px] px-3 py-4 text-xs text-[#596475]">{record.conditionReturned || '—'}</td>
    <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`} data-testid={`status-borrowed-${record.id}`}>{record.status}</span></td>
    <td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#788294] hover:bg-[#e9dfd2] hover:text-[#1c2b45]" aria-label={`Edit borrowed record for ${record.itemName}`} data-testid={`button-edit-borrowed-${record.id}`}><Pencil size={14} /></button><button type="button" onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a58a82] hover:bg-[#f6dfd8] hover:text-[#a95242]" aria-label={`Delete borrowed record for ${record.itemName}`} data-testid={`button-delete-borrowed-${record.id}`}><Trash2 size={14} /></button></div></td>
  </tr>;
}

function BorrowedDialog({ dialog, items, onClose, onSave }: { dialog: { mode: 'add' | 'edit'; item?: BorrowedItem }; items: InventoryItem[]; onClose: () => void; onSave: (input: BorrowedItemInput, id?: string) => Promise<void> }) {
  const record = dialog.item;
  const defaultItemId = record?.itemId || items[0]?.id || '';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: BorrowedItemInput = {
      dateBorrowed: String(form.get('dateBorrowed') || ''),
      borrowerName: String(form.get('borrowerName') || '').trim(),
      itemId: String(form.get('itemId') || ''),
      quantity: Math.max(1, Math.round(Number(form.get('quantity')) || 0)),
      conditionBorrowed: String(form.get('conditionBorrowed') || '').trim(),
      dateReturned: String(form.get('dateReturned') || '') || null,
      conditionReturned: String(form.get('conditionReturned') || '').trim() || null,
      status: String(form.get('status') || 'Borrowed') as BorrowedItemInput['status'],
    };
    void onSave(input, record?.id || undefined);
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#111522]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="borrowed-dialog-title" data-testid="dialog-borrowed"><div className="max-h-[92dvh] w-full max-w-[620px] overflow-y-auto rounded-t-2xl border border-[#f0dfe2] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-7">
    <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">{dialog.mode === 'edit' ? 'Edit handoff' : 'New handoff'}</p><h2 id="borrowed-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-0.06em]">{dialog.mode === 'edit' ? 'Update pull-out' : 'Log a pull-out'}</h2><p className="mt-1 text-sm text-[#778191]">Condition and return details stay with the record.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[#8a9099] hover:bg-[#fff0f2]" aria-label="Close borrowed dialog" data-testid="button-close-borrowed-dialog"><X size={18} /></button></div>
    <form onSubmit={submit} className="mt-7 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Date borrowed" name="dateBorrowed" type="date" defaultValue={record?.dateBorrowed || new Date().toISOString().slice(0, 10)} required testId="input-borrowed-date" /><Field label="Borrower name" name="borrowerName" defaultValue={record?.borrowerName} placeholder="e.g. Jordan Lee" required testId="input-borrower-name" /></div>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]"><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Item</span><select name="itemId" defaultValue={defaultItemId} required className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] focus:border-[#e40012] focus:outline-none" data-testid="select-borrowed-item">{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}</select></label><Field label="Quantity" name="quantity" type="number" min="1" defaultValue={record?.quantity ?? 1} required testId="input-borrowed-quantity" /></div>
      <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Condition borrowed</span><input name="conditionBorrowed" defaultValue={record?.conditionBorrowed || 'Good'} placeholder="e.g. Good, sealed, minor wear" required className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] placeholder:text-[#a3a7aa] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid="input-condition-borrowed" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Date returned" name="dateReturned" type="date" defaultValue={record?.dateReturned || ''} testId="input-borrowed-return-date" /><Field label="Condition returned" name="conditionReturned" defaultValue={record?.conditionReturned || ''} placeholder="e.g. Good or damaged" testId="input-condition-returned" /></div>
      <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Status</span><select name="status" defaultValue={record?.status || 'Borrowed'} className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] focus:border-[#e40012] focus:outline-none" data-testid="select-borrowed-status"><option value="Borrowed">Borrowed</option><option value="Broke">Broke</option><option value="Returned">Returned</option></select></label>
      <div className="flex flex-col-reverse gap-2 border-t border-[#f0dfe2] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-[#667184] hover:bg-[#fff0f2]" data-testid="button-cancel-borrowed">Cancel</button><button type="submit" className="rounded-lg bg-[#e40012] px-5 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#111522] hover:bg-[#c80010]" data-testid="button-save-borrowed">{dialog.mode === 'edit' ? 'Save changes' : 'Log pull-out'}</button></div>
    </form>
  </div></div>;
}

function BorrowedDeleteDialog({ item, onClose, onDelete }: { item: BorrowedItem; onClose: () => void; onDelete: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111522]/45 p-5 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="delete-borrowed-title" data-testid="dialog-delete-borrowed"><div className="w-full max-w-[420px] rounded-xl border border-[#f0dfe2] bg-white p-6 shadow-2xl"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff0f2] text-[#e40012]"><Trash2 size={19} /></span><h2 id="delete-borrowed-title" className="mt-5 text-xl font-extrabold tracking-[-0.05em]">Remove this pull-out?</h2><p className="mt-2 text-sm leading-6 text-[#778191]"><strong className="text-[#111522]">{item.itemName}</strong> for {item.borrowerName} will be removed and the server will reconcile availability.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#667184] hover:bg-[#fff0f2]" data-testid="button-cancel-delete-borrowed">Keep it</button><button type="button" onClick={onDelete} className="rounded-lg bg-[#e40012] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c80010]" data-testid="button-confirm-delete-borrowed">Remove record</button></div></div></div>;
}

function LowStockRow({ item, onAdjust, onEdit }: { item: InventoryItem; onAdjust: (id: string, amount: number) => void; onEdit: () => void }) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  const status = item.quantity === 0 ? 'Out of stock' : 'Low stock';
  return <div className="flex items-center gap-3 rounded-xl border border-[#e5dbcf] bg-[#faf4e9] px-3 py-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tint} ${meta.tone}`}><Icon size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#9298a0]">{item.quantity} {item.unit} · minimum {item.threshold}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#786a61]"><MapPin size={11} />{item.location}</p></div><span className="hidden rounded-full bg-[#f5d9d1] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#984c40] sm:inline">{status}</span><div className="flex items-center gap-1"><button type="button" onClick={() => onAdjust(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#dcd1c3] text-[#586578] hover:bg-[#f0e5d7]" aria-label={`Decrease ${item.name}`} data-testid={`button-decrease-alert-${item.id}`}><Minus size={13} /></button><button type="button" onClick={() => onAdjust(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#dcd1c3] text-[#586578] hover:bg-[#f0e5d7]" aria-label={`Increase ${item.name}`} data-testid={`button-increase-alert-${item.id}`}><Plus size={13} /></button><button type="button" onClick={onEdit} className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-[#8d7567] hover:bg-[#f0e5d7]" aria-label={`Edit ${item.name}`} data-testid={`button-edit-alert-${item.id}`}><Pencil size={13} /></button></div></div>;
}

function SortableHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: InventorySortKey; sort: { key: InventorySortKey; direction: SortDirection } | null; onSort: (key: InventorySortKey) => void }) {
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : null;
  return <th scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'} className="px-3 py-4 font-mono font-medium">
    <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 text-left transition hover:text-[#e40012] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e40012]/40" aria-label={`${label}: ${active ? direction === 'asc' ? 'ascending, click to sort descending' : 'descending, click to sort ascending' : 'not sorted, click to sort ascending'}`} data-testid={`button-sort-${sortKey}`}>
      <span>{label}</span>
      {direction === 'asc' ? <ChevronUp size={13} aria-hidden="true" /> : direction === 'desc' ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronsUpDown size={13} aria-hidden="true" />}
    </button>
  </th>;
}

function InventoryRow({ item, borrowedItems, flash, onAdjust, onSetQuantity, onEdit, onDelete }: { item: InventoryItem; borrowedItems: BorrowedItem[]; flash: boolean; onAdjust: (id: string, amount: number) => void; onSetQuantity: (id: string, quantity: number) => void; onEdit: () => void; onDelete: () => void }) {
  const [draftQuantity, setDraftQuantity] = useState(String(item.quantity));
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  const status = getOperationalStatus(item, borrowedItems);
  const isLow = status === 'Low Stock' || status === 'Out of Stock';
  const imageSrc = getImageSrc(item.imageUrl);
  useEffect(() => setDraftQuantity(String(item.quantity)), [item.quantity]);
  const commitQuantity = () => {
    const parsed = Number(draftQuantity);
    const nextQuantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    onSetQuantity(item.id, nextQuantity);
    setDraftQuantity(String(Math.max(0, Math.round(nextQuantity))));
  };
  return <tr className={`border-b border-[#e8e0d5] last:border-0 transition-colors hover:bg-[#f8f0e5] ${flash ? 'flash' : ''}`} data-testid={`row-inventory-${item.id}`}>
      <td className="px-5 py-4"><div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-[#f0dfe2] bg-[#fff0f2] text-sm font-extrabold text-[#e40012]"><img src={imageSrc} alt="" className={`h-full w-full object-cover ${imageSrc ? '' : 'hidden'}`} onError={(event) => { event.currentTarget.classList.add('hidden'); event.currentTarget.nextElementSibling?.classList.remove('hidden'); }} /><span className={imageSrc ? 'hidden' : ''}>{item.name.slice(0, 1).toUpperCase()}</span></div></td>
     <td className="px-3 py-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tint} ${meta.tone}`}><Icon size={16} /></span><div><p className="text-sm font-bold text-[#25344c]">{item.name}</p><p className="mt-0.5 max-w-[180px] truncate text-xs text-[#8b9199]">{item.note || 'No notes added'}</p></div></div></td>
    <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.tint} ${meta.tone}`}>{item.category}</span></td>
    <td className="px-3 py-4"><div className="flex items-center gap-2"><div className={`flex items-center rounded-lg border ${isLow ? 'border-[#e8b7aa] bg-[#fff0eb]' : 'border-[#ddd3c4] bg-[#f9f3e9]'}`}><button type="button" onClick={() => onAdjust(item.id, -1)} className="flex h-8 w-8 items-center justify-center text-[#788294] hover:bg-[#f0e3d6]" aria-label={`Decrease ${item.name}`} data-testid={`button-decrease-${item.id}`}><Minus size={13} /></button><input type="number" min="0" step="1" value={draftQuantity} onChange={(event) => setDraftQuantity(event.target.value)} onBlur={commitQuantity} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitQuantity(); event.currentTarget.blur(); } }} className={`h-8 w-[48px] border-0 bg-transparent p-0 text-center font-mono text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#e40012]/30 ${isLow ? 'text-[#a95242]' : 'text-[#25344c]'}`} aria-label={`Quantity for ${item.name}`} data-testid={`text-quantity-${item.id}`} /><button type="button" onClick={() => onAdjust(item.id, 1)} className="flex h-8 w-8 items-center justify-center text-[#788294] hover:bg-[#f0e3d6]" aria-label={`Increase ${item.name}`} data-testid={`button-increase-${item.id}`}><Plus size={13} /></button></div>{isLow && <span className="font-mono text-[9px] uppercase tracking-wider text-[#a95242]">Check</span>}</div></td>
      <td className="px-3 py-4 font-mono text-xs text-[#6e7888]">{item.unit}</td>
      <td className="px-3 py-4 font-mono text-xs text-[#6e7888]">{formatCurrency(item.pricePerUnit)}</td>
     <td className="px-3 py-4 font-mono text-xs text-[#6e7888]">{item.threshold}</td>
      <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status === 'Needs Repair' ? 'bg-[#ffe4e7] text-[#b0000f]' : status === 'Borrowed' ? 'bg-[#fff1d6] text-[#8d5f24]' : status === 'Out of Stock' ? 'bg-[#ffe4e7] text-[#b0000f]' : status === 'Low Stock' ? 'bg-[#fff0eb] text-[#a95242]' : 'bg-[#e7f5ef] text-[#14704f]'}`} data-testid={`status-inventory-${item.id}`}>{status}</span></td>
    <td className="px-3 py-4"><span className="flex items-center gap-1.5 text-xs text-[#667184]"><MapPin size={13} className="text-[#a1a7ad]" />{item.location}</span></td>
    <td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#788294] hover:bg-[#e9dfd2] hover:text-[#1c2b45]" aria-label={`Edit ${item.name}`} data-testid={`button-edit-${item.id}`}><Pencil size={14} /></button><button type="button" onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a58a82] hover:bg-[#f6dfd8] hover:text-[#a95242]" aria-label={`Delete ${item.name}`} data-testid={`button-delete-${item.id}`}><Trash2 size={14} /></button></div></td>
  </tr>;
}

function EmptyState({ search, category, statusFilter, onReset, onAdd }: { search: string; category: string; statusFilter: 'All' | OperationalStatus; onReset: () => void; onAdd: () => void }) {
  const message = search
    ? `No materials match “${search}”.`
    : statusFilter !== 'All'
      ? `There are no ${statusFilter.toLowerCase()} materials in the cabinet.`
      : `There are no ${category.toLowerCase()} materials in the cabinet.`;
  return <div className="mt-4 rounded-xl border border-dashed border-[#e6b9bf] bg-white px-6 py-16 text-center soft-shadow"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#fff0f2] text-[#e40012]"><Search size={24} /></span><h3 className="mt-5 text-lg font-extrabold tracking-[-0.04em]">Nothing in this view yet.</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7b8490]">{message} Try another filter, or add the material if it belongs here.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={onReset} className="rounded-lg border border-[#f0d5d9] px-3.5 py-2.5 text-xs font-bold text-[#5d687b] hover:bg-[#fff0f2]" data-testid="button-reset-filters">Clear filters</button><button type="button" onClick={onAdd} className="rounded-lg bg-[#e40012] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#c80010]" data-testid="button-empty-add">Add material</button></div></div>;
}

 function ItemDialog({ dialog, onClose, onSave }: { dialog: { mode: 'add' | 'edit'; item?: InventoryItem }; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  const item = dialog.item;
    return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#111522]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title" data-testid="dialog-item"><div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl border border-[#f0dfe2] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">{dialog.mode === 'edit' ? 'Edit record' : 'New record'}</p><h2 id="item-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-0.06em]">{dialog.mode === 'edit' ? 'Update material' : 'Add a material'}</h2><p className="mt-1 text-sm text-[#778191]">Keep the shelf language simple for the next person.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[#8a9099] hover:bg-[#fff0f2] hover:text-[#111522]" aria-label="Close dialog" data-testid="button-close-item-dialog"><X size={18} /></button></div><form onSubmit={onSave} className="mt-7 space-y-4"><Field label="Item name" name="name" defaultValue={item?.name} placeholder="e.g. Neon yellow vinyl" required testId="input-item-name" /><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#4f5c70]">Category</span><select name="category" defaultValue={item?.category || 'Paper'} className="h-11 w-full rounded-xl border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#26364d] focus:border-[#e40012] focus:outline-none" data-testid="select-item-category">{categories.slice(1).map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label><Field label="Unit" name="unit" defaultValue={item?.unit} placeholder="sheets, rolls..." required testId="input-item-unit" /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity in stock" name="quantity" type="number" min="0" defaultValue={item?.quantity ?? 0} required testId="input-item-quantity" /><Field label="Minimum threshold" name="threshold" type="number" min="0" defaultValue={item?.threshold ?? 0} required testId="input-item-threshold" /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Price per unit" name="pricePerUnit" type="number" min="0" defaultValue={item?.pricePerUnit ?? 0} placeholder="0.00" required testId="input-item-price" /><Field label="Image URL" name="imageUrl" type="text" defaultValue={item?.imageUrl ?? ''} placeholder="https://... or stored path" testId="input-item-image-url" /><label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-[#4f535e]">Upload image file</span><input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="block h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 py-2 text-sm text-[#111522] file:mr-3 file:rounded-md file:border-0 file:bg-[#fff0f2] file:px-2.5 file:py-1 file:text-xs file:font-bold file:text-[#a9000d]" data-testid="input-item-image-file" /><p className="mt-1.5 text-[11px] text-[#89909b]">Up to 10 MB. Uploading a file replaces the image URL.</p></label></div><Field label="Cabinet location" name="location" defaultValue={item?.location} placeholder="e.g. Bay A · Shelf 2" required testId="input-item-location" /><Field label="Note" name="note" defaultValue={item?.note} placeholder="Optional finish, size, or machine detail" testId="input-item-note" /><div className="flex flex-col-reverse gap-2 border-t border-[#f0dfe2] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-[#667184] hover:bg-[#fff0f2]" data-testid="button-cancel-item">Cancel</button><button type="submit" className="rounded-lg bg-[#e40012] px-5 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#111522] hover:bg-[#c80010]" data-testid="button-save-item">{dialog.mode === 'edit' ? 'Save changes' : 'Add to cabinet'}</button></div></form></div></div>;
}

function Field({ label, name, defaultValue, placeholder, required, type = 'text', min, testId }: { label: string; name: string; defaultValue?: string | number; placeholder?: string; required?: boolean; type?: string; min?: string; testId: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#4f535e]">{label}</span><input name={name} type={type} min={min} defaultValue={defaultValue} placeholder={placeholder} required={required} className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] placeholder:text-[#a3a7aa] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid={testId} /></label>;
}

function DeleteDialog({ item, onClose, onDelete }: { item: InventoryItem; onClose: () => void; onDelete: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111522]/45 p-5 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" data-testid="dialog-delete"><div className="w-full max-w-[420px] rounded-xl border border-[#f0dfe2] bg-white p-6 shadow-2xl"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff0f2] text-[#e40012]"><Trash2 size={19} /></span><h2 id="delete-dialog-title" className="mt-5 text-xl font-extrabold tracking-[-0.05em]">Remove this material?</h2><p className="mt-2 text-sm leading-6 text-[#778191]"><strong className="text-[#111522]">{item.name}</strong> will be removed from the shared cabinet database. This can’t be undone.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#667184] hover:bg-[#fff0f2]" data-testid="button-cancel-delete">Keep it</button><button type="button" onClick={onDelete} className="rounded-lg bg-[#e40012] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c80010]" data-testid="button-confirm-delete">Remove material</button></div></div></div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Dashboard} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;