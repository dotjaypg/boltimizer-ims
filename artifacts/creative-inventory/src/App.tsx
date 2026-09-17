import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Briefcase,
  Boxes,
  Check,
  ClipboardList,
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
import logoAsset from '@assets/image_1789625612704.png';

const queryClient = new QueryClient();
const STORAGE_KEY = 'creative-inventory-items-v1';
const ACTIVITY_STORAGE_KEY = 'creative-inventory-activity-v1';

type Category = 'Paper' | 'Cards' | 'Finishing' | 'Vinyl' | 'Ink' | 'Office' | 'Tools' | 'Packaging' | 'Safety';
type View = 'overview' | 'inventory';

type InventoryItem = {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  threshold: number;
  location: string;
  note?: string;
};

const seedItems: InventoryItem[] = [
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
];

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

function loadItems(): InventoryItem[] {
  if (typeof window === 'undefined') return seedItems;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return seedItems;
    const parsed = JSON.parse(saved) as InventoryItem[];
    return Array.isArray(parsed) && parsed.length ? parsed : seedItems;
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

function Dashboard() {
  const [items, setItems] = useState<InventoryItem[]>(loadItems);
  const [activities, setActivities] = useState<StockActivity[]>(loadActivities);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | Category>('All');
  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialog, setDialog] = useState<{ mode: 'add' | 'edit'; item?: InventoryItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'neutral' } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const lowStock = useMemo(() => items.filter((item) => item.quantity <= item.threshold), [items]);
  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.location.toLowerCase().includes(query);
      const matchesCategory = category === 'All' || item.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [category, items, search]);

  const showToast = (message: string, tone: 'success' | 'neutral' = 'success') => setToast({ message, tone });

  const setExactQuantity = (id: string, requestedQuantity: number) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const nextQuantity = Math.max(0, Math.round(requestedQuantity));
    const actualChange = nextQuantity - item.quantity;
    if (!actualChange) {
      return;
    }
    const action: StockActivity['action'] = actualChange > 0 ? 'stock' : 'take';
    setItems((current) => current.map((entry) => entry.id === id ? { ...entry, quantity: nextQuantity } : entry));
    setActivities((current) => [{
      id: `activity-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      action,
      amount: Math.abs(actualChange),
      quantityAfter: nextQuantity,
      unit: item.unit,
      timestamp: Date.now(),
    }, ...current].slice(0, 18));
    setFlashId(id);
    window.setTimeout(() => setFlashId((current) => current === id ? null : current), 450);
    showToast(`${item.name} ${actualChange > 0 ? 'stocked' : 'taken'}.`);
  };

  const adjustQuantity = (id: string, amount: number) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (amount < 0 && item.quantity === 0) {
      showToast(`${item.name} is already at zero.`, 'neutral');
      return;
    }
    setExactQuantity(id, item.quantity + amount);
  };

  const saveItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    const next: InventoryItem = {
      id: dialog?.item?.id || `item-${Date.now()}`,
      name,
      category: String(form.get('category')) as Category,
      quantity: Math.max(0, Number(form.get('quantity')) || 0),
      unit: String(form.get('unit') || 'units').trim(),
      threshold: Math.max(0, Number(form.get('threshold')) || 0),
      location: String(form.get('location') || 'Unassigned').trim(),
      note: String(form.get('note') || '').trim(),
    };
    setItems((current) => dialog?.mode === 'edit'
      ? current.map((item) => item.id === next.id ? next : item)
      : [next, ...current]);
    showToast(dialog?.mode === 'edit' ? 'Inventory record updated.' : 'New material added.');
    setDialog(null);
  };

  const deleteItem = () => {
    if (!deleteTarget) return;
    setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
    showToast(`${deleteTarget.name} removed from inventory.`, 'neutral');
    setDeleteTarget(null);
  };

  const resetFilters = () => {
    setSearch('');
    setCategory('All');
    showToast('Filters cleared.', 'neutral');
  };

  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <div className="inventory-shell paper-grain min-h-[100dvh] text-[#111522]">
      <div className="flex min-h-[100dvh]">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-[#f0dfe2] bg-white px-5 py-6 text-[#111522] shadow-[12px_0_32px_rgba(17,21,34,.08)] transition-transform duration-200 lg:relative lg:z-auto lg:translate-x-0 lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
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
            </nav>
          </div>

          <div className="mt-auto rounded-xl border border-[#f0d5d9] bg-[#fff4f5] p-4">
            <div className="flex items-center justify-between">
               <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e40012] text-white"><Sparkles size={16} /></span>
               <span className="font-mono text-[10px] uppercase tracking-wider text-[#aa7c82]">Signal</span>
            </div>
             <p className="mt-4 text-sm font-semibold text-[#111522]">{lowStock.length ? `${lowStock.length} ${lowStock.length === 1 ? 'item needs' : 'items need'} a look.` : 'Cabinet is in good shape.'}</p>
             <p className="mt-1 text-xs leading-relaxed text-[#777c86]">{lowStock.length ? 'Review before the next print run.' : 'No urgent stock decisions today.'}</p>
          </div>
          <div className="mt-5 flex items-center gap-2 px-2 text-xs text-[#777c86]">
            <span className="h-2 w-2 rounded-full bg-[#10a77b]" />
            Local workspace
          </div>
        </aside>

        {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-[#111522]/35 lg:hidden" onClick={() => setSidebarOpen(false)} data-testid="button-overlay-close" />}

        <main className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-[#f0dfe2] bg-white/95 px-5 backdrop-blur-md sm:px-8 lg:px-12">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSidebarOpen(true)} className="relative z-10 rounded-lg p-2 text-[#4e535f] hover:bg-[#fff0f2] lg:hidden" aria-label="Open menu" aria-expanded={sidebarOpen} data-testid="button-open-menu"><Menu size={20} /></button>
              <div className="hidden items-center gap-2 text-xs font-semibold text-[#777c86] sm:flex"><span>Boltimizer operations</span><span className="text-[#e5b7bd]">/</span><span className="text-[#111522]">{view === 'overview' ? 'Overview' : 'Inventory'}</span></div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#aa7c82] sm:hidden">{view}</span>
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
              <StatCard label="Materials tracked" value={items.length} detail="distinct records" icon={<PackageOpen size={18} />} tone="navy" testId="stat-materials" />
              <StatCard label="Units on hand" value={totalUnits.toLocaleString()} detail="across the cabinet" icon={<Boxes size={18} />} tone="teal" testId="stat-units" />
              <StatCard label="Needs attention" value={lowStock.length} detail={lowStock.length ? 'at or below threshold' : 'nothing urgent'} icon={<AlertTriangle size={18} />} tone={lowStock.length ? 'coral' : 'sage'} testId="stat-low-stock" />
               <StatCard label="Cabinet" value={1} detail="active location" icon={<MapPin size={18} />} tone="gold" testId="stat-bays" />
            </section>

            <section className="appear-3 mt-8 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
              <div className="rounded-xl border border-[#f0dfe2] bg-white p-5 sm:p-6 soft-shadow">
                <div className="flex items-start justify-between gap-4">
                   <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">Operations pulse</p><h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">What needs a decision?</h2></div>
                </div>
                <div className="mt-5 space-y-2">
                  {lowStock.slice(0, 3).map((item) => <LowStockRow key={item.id} item={item} onAdjust={adjustQuantity} onEdit={() => setDialog({ mode: 'edit', item })} />)}
                  {!lowStock.length && <div className="flex items-center gap-3 rounded-xl bg-[#e2f0e5] px-4 py-4 text-sm text-[#2e604d]"><Check size={18} /><span>Everything is above its minimum threshold. Nice and quiet.</span></div>}
                  {lowStock.length > 3 && <p className="px-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-[#87909e]">+ {lowStock.length - 3} more in inventory</p>}
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
              </div>

              {filteredItems.length > 0 ? (
                 <div className="mt-4 overflow-hidden rounded-xl border border-[#f0dfe2] bg-white soft-shadow">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] border-collapse text-left">
                       <thead><tr className="border-b border-[#f0dfe2] bg-[#fff7f8] text-[10px] uppercase tracking-[0.12em] text-[#92747b]"><th className="px-5 py-4 font-mono font-medium">Item name</th><th className="px-3 py-4 font-mono font-medium">Category</th><th className="px-3 py-4 font-mono font-medium">Quantity in stock</th><th className="px-3 py-4 font-mono font-medium">Unit</th><th className="px-3 py-4 font-mono font-medium">Min. threshold</th><th className="px-3 py-4 font-mono font-medium">Cabinet location</th><th className="px-5 py-4 text-right font-mono font-medium">Actions</th></tr></thead>
                       <tbody>{filteredItems.map((item) => <InventoryRow key={item.id} item={item} flash={flashId === item.id} onAdjust={adjustQuantity} onSetQuantity={setExactQuantity} onEdit={() => setDialog({ mode: 'edit', item })} onDelete={() => setDeleteTarget(item)} />)}</tbody>
                    </table>
                  </div>
                   <div className="flex items-center justify-between border-t border-[#f0dfe2] bg-[#fff7f8] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#92747b]"><span data-testid="text-filter-count">{filteredItems.length} of {items.length} materials shown</span><span>All changes sync instantly</span></div>
                </div>
              ) : (
                <EmptyState search={search} category={category} onReset={resetFilters} onAdd={() => { setDialog({ mode: 'add' }); setView('inventory'); }} />
              )}
             </section>}
          </div>
        </main>
      </div>

       {toast && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#111522] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(17,21,34,.22)]" role="status" data-testid="status-toast"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${toast.tone === 'success' ? 'bg-[#e40012] text-white' : 'bg-[#f6cdd2] text-[#111522]'}`}><Check size={13} strokeWidth={3} /></span>{toast.message}</div>}
      {dialog && <ItemDialog dialog={dialog} onClose={() => setDialog(null)} onSave={saveItem} />}
      {deleteTarget && <DeleteDialog item={deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={deleteItem} />}
    </div>
  );
}

function StatCard({ label, value, detail, icon, tone, testId }: { label: string; value: number | string; detail: string; icon: ReactNode; tone: 'navy' | 'teal' | 'coral' | 'sage' | 'gold'; testId: string }) {
  const tones = { navy: 'bg-[#111522] text-white', teal: 'bg-[#fff0f2] text-[#a9000d]', coral: 'bg-[#ffe4e7] text-[#b0000f]', sage: 'bg-[#e7f5ef] text-[#14704f]', gold: 'bg-[#fff1f2] text-[#8d2632]' };
  return <div className={`lift rounded-xl border border-[#f0dfe2] p-5 ${tones[tone]}`} data-testid={testId}><div className="flex items-start justify-between"><p className="text-xs font-bold opacity-75">{label}</p><span className="opacity-80">{icon}</span></div><div className="mt-5 flex items-end justify-between"><p className="text-3xl font-extrabold tracking-[-0.07em]" data-testid={`${testId}-value`}>{value}</p><p className="pb-1 text-right font-mono text-[9px] uppercase tracking-wider opacity-70">{detail}</p></div></div>;
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
      {activities.length ? <div className="mt-5 space-y-2">
        {activities.slice(0, 5).map((activity) => {
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

function LowStockRow({ item, onAdjust, onEdit }: { item: InventoryItem; onAdjust: (id: string, amount: number) => void; onEdit: () => void }) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  return <div className="flex items-center gap-3 rounded-xl border border-[#e5dbcf] bg-[#faf4e9] px-3 py-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tint} ${meta.tone}`}><Icon size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#9298a0]">{item.quantity} {item.unit} · minimum {item.threshold}</p></div><span className="hidden rounded-full bg-[#f5d9d1] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#984c40] sm:inline">Low</span><div className="flex items-center gap-1"><button type="button" onClick={() => onAdjust(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#dcd1c3] text-[#586578] hover:bg-[#f0e5d7]" aria-label={`Decrease ${item.name}`} data-testid={`button-decrease-alert-${item.id}`}><Minus size={13} /></button><button type="button" onClick={() => onAdjust(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#dcd1c3] text-[#586578] hover:bg-[#f0e5d7]" aria-label={`Increase ${item.name}`} data-testid={`button-increase-alert-${item.id}`}><Plus size={13} /></button><button type="button" onClick={onEdit} className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-[#8d7567] hover:bg-[#f0e5d7]" aria-label={`Edit ${item.name}`} data-testid={`button-edit-alert-${item.id}`}><Pencil size={13} /></button></div></div>;
}

function InventoryRow({ item, flash, onAdjust, onSetQuantity, onEdit, onDelete }: { item: InventoryItem; flash: boolean; onAdjust: (id: string, amount: number) => void; onSetQuantity: (id: string, quantity: number) => void; onEdit: () => void; onDelete: () => void }) {
  const [draftQuantity, setDraftQuantity] = useState(String(item.quantity));
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  const isLow = item.quantity <= item.threshold;
  useEffect(() => setDraftQuantity(String(item.quantity)), [item.quantity]);
  const commitQuantity = () => {
    const parsed = Number(draftQuantity);
    const nextQuantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    onSetQuantity(item.id, nextQuantity);
    setDraftQuantity(String(Math.max(0, Math.round(nextQuantity))));
  };
  return <tr className={`border-b border-[#e8e0d5] last:border-0 transition-colors hover:bg-[#f8f0e5] ${flash ? 'flash' : ''}`} data-testid={`row-inventory-${item.id}`}>
    <td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tint} ${meta.tone}`}><Icon size={16} /></span><div><p className="text-sm font-bold text-[#25344c]">{item.name}</p><p className="mt-0.5 max-w-[180px] truncate text-xs text-[#8b9199]">{item.note || 'No notes added'}</p></div></div></td>
    <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.tint} ${meta.tone}`}>{item.category}</span></td>
    <td className="px-3 py-4"><div className="flex items-center gap-2"><div className={`flex items-center rounded-lg border ${isLow ? 'border-[#e8b7aa] bg-[#fff0eb]' : 'border-[#ddd3c4] bg-[#f9f3e9]'}`}><button type="button" onClick={() => onAdjust(item.id, -1)} className="flex h-8 w-8 items-center justify-center text-[#788294] hover:bg-[#f0e3d6]" aria-label={`Decrease ${item.name}`} data-testid={`button-decrease-${item.id}`}><Minus size={13} /></button><input type="number" min="0" step="1" value={draftQuantity} onChange={(event) => setDraftQuantity(event.target.value)} onBlur={commitQuantity} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitQuantity(); event.currentTarget.blur(); } }} className={`h-8 w-[48px] border-0 bg-transparent p-0 text-center font-mono text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#e40012]/30 ${isLow ? 'text-[#a95242]' : 'text-[#25344c]'}`} aria-label={`Quantity for ${item.name}`} data-testid={`text-quantity-${item.id}`} /><button type="button" onClick={() => onAdjust(item.id, 1)} className="flex h-8 w-8 items-center justify-center text-[#788294] hover:bg-[#f0e3d6]" aria-label={`Increase ${item.name}`} data-testid={`button-increase-${item.id}`}><Plus size={13} /></button></div>{isLow && <span className="font-mono text-[9px] uppercase tracking-wider text-[#a95242]">Check</span>}</div></td>
    <td className="px-3 py-4 font-mono text-xs text-[#6e7888]">{item.unit}</td>
    <td className="px-3 py-4 font-mono text-xs text-[#6e7888]">{item.threshold}</td>
    <td className="px-3 py-4"><span className="flex items-center gap-1.5 text-xs text-[#667184]"><MapPin size={13} className="text-[#a1a7ad]" />{item.location}</span></td>
    <td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#788294] hover:bg-[#e9dfd2] hover:text-[#1c2b45]" aria-label={`Edit ${item.name}`} data-testid={`button-edit-${item.id}`}><Pencil size={14} /></button><button type="button" onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a58a82] hover:bg-[#f6dfd8] hover:text-[#a95242]" aria-label={`Delete ${item.name}`} data-testid={`button-delete-${item.id}`}><Trash2 size={14} /></button></div></td>
  </tr>;
}

function EmptyState({ search, category, onReset, onAdd }: { search: string; category: string; onReset: () => void; onAdd: () => void }) {
  return <div className="mt-4 rounded-xl border border-dashed border-[#e6b9bf] bg-white px-6 py-16 text-center soft-shadow"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#fff0f2] text-[#e40012]"><Search size={24} /></span><h3 className="mt-5 text-lg font-extrabold tracking-[-0.04em]">Nothing in this view yet.</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7b8490]">{search ? `No materials match “${search}”.` : `There are no ${category.toLowerCase()} materials in the cabinet.`} Try another filter, or add the material if it belongs here.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={onReset} className="rounded-lg border border-[#f0d5d9] px-3.5 py-2.5 text-xs font-bold text-[#5d687b] hover:bg-[#fff0f2]" data-testid="button-reset-filters">Clear filters</button><button type="button" onClick={onAdd} className="rounded-lg bg-[#e40012] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#c80010]" data-testid="button-empty-add">Add material</button></div></div>;
}

function ItemDialog({ dialog, onClose, onSave }: { dialog: { mode: 'add' | 'edit'; item?: InventoryItem }; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  const item = dialog.item;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#111522]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title" data-testid="dialog-item"><div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl border border-[#f0dfe2] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d10011]">{dialog.mode === 'edit' ? 'Edit record' : 'New record'}</p><h2 id="item-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-0.06em]">{dialog.mode === 'edit' ? 'Update material' : 'Add a material'}</h2><p className="mt-1 text-sm text-[#778191]">Keep the shelf language simple for the next person.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[#8a9099] hover:bg-[#fff0f2] hover:text-[#111522]" aria-label="Close dialog" data-testid="button-close-item-dialog"><X size={18} /></button></div><form onSubmit={onSave} className="mt-7 space-y-4"><Field label="Item name" name="name" defaultValue={item?.name} placeholder="e.g. Neon yellow vinyl" required testId="input-item-name" /><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#4f5c70]">Category</span><select name="category" defaultValue={item?.category || 'Paper'} className="h-11 w-full rounded-xl border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#26364d] focus:border-[#e40012] focus:outline-none" data-testid="select-item-category">{categories.slice(1).map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label><Field label="Unit" name="unit" defaultValue={item?.unit} placeholder="sheets, rolls..." required testId="input-item-unit" /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity in stock" name="quantity" type="number" min="0" defaultValue={item?.quantity ?? 0} required testId="input-item-quantity" /><Field label="Minimum threshold" name="threshold" type="number" min="0" defaultValue={item?.threshold ?? 0} required testId="input-item-threshold" /></div><Field label="Cabinet location" name="location" defaultValue={item?.location} placeholder="e.g. Bay A · Shelf 2" required testId="input-item-location" /><Field label="Note" name="note" defaultValue={item?.note} placeholder="Optional finish, size, or machine detail" testId="input-item-note" /><div className="flex flex-col-reverse gap-2 border-t border-[#f0dfe2] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-[#667184] hover:bg-[#fff0f2]" data-testid="button-cancel-item">Cancel</button><button type="submit" className="rounded-lg bg-[#e40012] px-5 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#111522] hover:bg-[#c80010]" data-testid="button-save-item">{dialog.mode === 'edit' ? 'Save changes' : 'Add to cabinet'}</button></div></form></div></div>;
}

function Field({ label, name, defaultValue, placeholder, required, type = 'text', min, testId }: { label: string; name: string; defaultValue?: string | number; placeholder?: string; required?: boolean; type?: string; min?: string; testId: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#4f535e]">{label}</span><input name={name} type={type} min={min} defaultValue={defaultValue} placeholder={placeholder} required={required} className="h-11 w-full rounded-lg border border-[#f0dfe2] bg-[#fff8f9] px-3 text-sm text-[#111522] placeholder:text-[#a3a7aa] focus:border-[#e40012] focus:bg-white focus:outline-none" data-testid={testId} /></label>;
}

function DeleteDialog({ item, onClose, onDelete }: { item: InventoryItem; onClose: () => void; onDelete: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111522]/45 p-5 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" data-testid="dialog-delete"><div className="w-full max-w-[420px] rounded-xl border border-[#f0dfe2] bg-white p-6 shadow-2xl"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff0f2] text-[#e40012]"><Trash2 size={19} /></span><h2 id="delete-dialog-title" className="mt-5 text-xl font-extrabold tracking-[-0.05em]">Remove this material?</h2><p className="mt-2 text-sm leading-6 text-[#778191]"><strong className="text-[#111522]">{item.name}</strong> will be removed from this browser’s cabinet list. This can’t be undone.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#667184] hover:bg-[#fff0f2]" data-testid="button-cancel-delete">Keep it</button><button type="button" onClick={onDelete} className="rounded-lg bg-[#e40012] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c80010]" data-testid="button-confirm-delete">Remove material</button></div></div></div>;
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