"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertCircle, Package, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { usePermissions } from "@/lib/permissions";
import { CashierContactModal } from "./CashierContactModal";
import { BarcodeScanner } from "@/components/barcode/scanner";

type PickStatus = "pending" | "picked" | "not_found";

type PickItem = {
  item_id: number;
  product_id: string;
  product_name: string;
  quantity: string;
  unit_name: string;
  cell_code: string | null;
  rack_name: string | null;
  row_name: string | null;
  warehouse_name: string | null;
  pick_status: PickStatus;
  parent_product_id: string | null;
  parent_product_name: string | null;
  is_bundle_component: boolean;
};

type PickGroup = {
  parentId: string | null;
  parentName: string | null;
  items: PickItem[];
};

type PickDetail = {
  order_id: string;
  doc_number: string;
  customer_name: string;
  total_items: number;
  picked_count: number;
  not_found_count: number;
  items: PickItem[];
};

type Filter = "all" | "pending" | "picked" | "not_found";

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "pending", label: "Kutilmoqda" },
  { key: "picked", label: "Topildi" },
  { key: "not_found", label: "Topilmadi" },
];

function LocationBadge({ item }: { item: PickItem }) {
  if (!item.cell_code) {
    return (
      <span className="text-[11px] text-slate-400 italic">Joyi belgilanmagan</span>
    );
  }
  const parts = [item.warehouse_name, item.row_name, item.rack_name, item.cell_code]
    .filter(Boolean)
    .join(" / ");
  return (
    <span className="inline-block text-[11px] bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 rounded px-2 py-0.5 font-mono">
      {parts}
    </span>
  );
}

type ItemCardProps = {
  item: PickItem;
  pickingId: number | null;
  can: (permission: string) => boolean;
  onPick: (item: PickItem) => void;
  onContact: (item: PickItem) => void;
  tp: ReturnType<typeof useTranslations>;
};

function PickItemCard({ item, pickingId, can, onPick, onContact, tp }: ItemCardProps) {
  const isPicked = item.pick_status === "picked";
  const isNotFound = item.pick_status === "not_found";
  const isPicking = pickingId === item.item_id;

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-lg border transition-colors ${
        isPicked
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20"
          : isNotFound
          ? "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/20"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="font-medium text-sm text-slate-900 dark:text-slate-100 leading-tight">
            {item.product_name}
          </p>
          {isNotFound && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 rounded-full font-medium">
              <AlertCircle size={11} /> {tp("badge_not_found")}
            </span>
          )}
          {isPicked && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle2 size={11} /> {tp("badge_picked")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-slate-500">
            {item.quantity} {item.unit_name}
          </span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <LocationBadge item={item} />
        </div>

        {!isPicked && (
          <div className="flex gap-2 mt-3">
            {can("order.pick.execute") && (
              <button
                onClick={() => onPick(item)}
                disabled={isPicking}
                className="flex-1 min-h-[48px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm rounded-lg disabled:opacity-60 transition-colors"
              >
                {isPicking ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {tp("btn_picked")}
              </button>
            )}
            {can("order.pick.contact") && (
              <button
                onClick={() => onContact(item)}
                disabled={isPicking}
                className="flex-1 min-h-[48px] flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold text-sm rounded-lg disabled:opacity-60 transition-colors"
              >
                {tp("btn_cashier")}
              </button>
            )}
          </div>
        )}

        {isPicked && can("order.pick.contact") && (
          <button
            onClick={() => onContact(item)}
            className="w-full mt-3 min-h-[44px] flex items-center justify-center gap-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-sm rounded-lg transition-colors"
          >
            {tp("btn_cashier")}
          </button>
        )}
      </div>
    </div>
  );
}

type BundleGroupProps = {
  parentName: string;
  items: PickItem[];
  pickingId: number | null;
  can: (permission: string) => boolean;
  onPick: (item: PickItem) => void;
  onContact: (item: PickItem) => void;
  tp: ReturnType<typeof useTranslations>;
};

function BundleGroup({ parentName, items, pickingId, can, onPick, onContact, tp }: BundleGroupProps) {
  const pickedCount = items.filter((i) => i.pick_status === "picked").length;

  return (
    <div className="bg-brand-50/50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-base font-bold text-slate-900 dark:text-slate-100">
            🧩 {parentName}
          </span>
          <span className="text-xs text-slate-500">
            {tp("bundle_badge")} — {tp("bundle_components_count", { n: items.length })}
          </span>
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-300">
          {tp("bundle_progress", { picked: pickedCount, total: items.length })}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.item_id} className="pl-3 border-l-2 border-brand-300 dark:border-brand-700">
            <PickItemCard
              item={item}
              pickingId={pickingId}
              can={can}
              onPick={onPick}
              onContact={onContact}
              tp={tp}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MobileOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTranslations("mobile.pick");
  const ts = useTranslations("barcode.scan");
  const { can, loading: permLoading } = usePermissions();

  const [detail, setDetail] = useState<PickDetail | null>(null);
  const [localItems, setLocalItems] = useState<PickItem[]>([]);
  const [localPicked, setLocalPicked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [contactModal, setContactModal] = useState<{ open: boolean; item: PickItem | null }>({
    open: false,
    item: null,
  });

  const groupedItems = useMemo((): PickGroup[] => {
    const grouped = new Map<string, PickItem[]>();
    for (const item of localItems) {
      const key = item.parent_product_id ?? `__solo__${item.item_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    const groups: PickGroup[] = [];
    for (const [key, items] of grouped) {
      if (key.startsWith("__solo__")) {
        groups.push({ parentId: null, parentName: null, items });
      } else {
        groups.push({ parentId: key, parentName: items[0].parent_product_name, items });
      }
    }
    return groups;
  }, [localItems]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<PickDetail>(`/orders/${id}/pick`);
      setDetail(r.data);
      setLocalItems(r.data.items || []);
      setLocalPicked(r.data.picked_count);
    } catch (e) {
      toast.error(getErrorMessage(e, "Buyurtmani yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (permLoading) return;
    if (!can("order.pick.view")) {
      toast.error("Sizda bu sahifani ko'rish uchun ruxsat yo'q.");
      router.replace("/m/orders");
      return;
    }
    load();
  }, [permLoading, can, load, router]);

  async function handlePick(item: PickItem) {
    if (item.pick_status === "picked" || pickingId === item.item_id) return;
    if (!can("order.pick.execute")) {
      toast.error("Sizda 'Topildi' belgilash uchun ruxsat yo'q.");
      return;
    }

    const prevStatus: PickStatus = item.pick_status;
    setPickingId(item.item_id);
    setLocalItems((prev) =>
      prev.map((i) => i.item_id === item.item_id ? { ...i, pick_status: "picked" } : i)
    );
    setLocalPicked((prev) => prev + 1);

    try {
      const r = await api.patch<{
        item_id: number;
        pick_status: PickStatus;
        order_totals: { total_items: number; picked_count: number; not_found_count: number };
      }>(`/orders/${id}/items/${item.item_id}/pick`, {
        status: "picked",
        product_id: item.product_id,
      });
      setLocalPicked(r.data.order_totals.picked_count);
      toast.success(`${item.product_name} — topildi!`);
    } catch (e) {
      setLocalItems((prev) =>
        prev.map((i) => i.item_id === item.item_id ? { ...i, pick_status: prevStatus } : i)
      );
      setLocalPicked((prev) => prev - 1);
      toast.error(getErrorMessage(e, "Holat yangilanmadi"));
    } finally {
      setPickingId(null);
    }
  }

  const handleScanPick = useCallback(async (code: string) => {
    const matched = localItems.find(
      (i) => i.pick_status !== "picked" && (i.product_id === code || (i as PickItem & { barcode?: string }).barcode === code)
    );
    if (!matched) {
      const alreadyPicked = localItems.find(
        (i) => i.pick_status === "picked" && ((i as PickItem & { barcode?: string }).barcode === code)
      );
      if (alreadyPicked) {
        toast.info(ts("already_picked"));
      } else {
        toast.error(ts("item_not_in_order"));
      }
      navigator.vibrate?.(200);
      return;
    }
    await handlePick(matched);
  }, [localItems, handlePick, ts]);

  async function markNotFound(item: PickItem) {
    const prevItems = localItems;
    setLocalItems((prev) =>
      prev.map((i) =>
        i.item_id === item.item_id && i.pick_status === "pending"
          ? { ...i, pick_status: "not_found" }
          : i
      )
    );
    try {
      await api.patch(`/orders/${id}/items/${item.item_id}/pick`, {
        status: "not_found",
        product_id: item.product_id,
      });
    } catch (e) {
      setLocalItems(prevItems);
      toast.error(getErrorMessage(e, tp("action_failed")));
    }
  }

  function openContact(item: PickItem) {
    setContactModal({ open: true, item });
  }

  const filteredGroups = useMemo((): PickGroup[] => {
    if (filter === "all") return groupedItems;
    return groupedItems
      .map((group) => ({
        ...group,
        items: group.items.filter((i) => i.pick_status === filter),
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedItems, filter]);

  const totalItems = detail?.total_items ?? 0;
  const pct = totalItems > 0 ? Math.round((localPicked / totalItems) * 100) : 0;

  if (permLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 py-3 flex items-center gap-3">
          <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 animate-pulse" />
        </div>
        <div className="p-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-40 mb-2" />
              <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-24 mb-4" />
              <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-4 text-center text-slate-500 py-20">
        <Package size={40} className="mx-auto mb-3 opacity-40" />
        <p>Buyurtma topilmadi</p>
        <button onClick={() => router.back()} className="mt-4 text-brand-600 text-sm underline">
          Orqaga
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Orqaga"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-slate-400 -ml-2"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate">{detail.doc_number}</div>
            <div className="text-xs text-slate-500 truncate">{detail.customer_name}</div>
          </div>
          <div className="text-right shrink-0 flex items-center gap-2">
            <div>
              <div className="text-sm font-semibold text-emerald-600">
                {localPicked}/{totalItems}
              </div>
              <div className="text-[10px] text-slate-400">topildi</div>
            </div>
            {can("order.pick.execute") && (
              <button
                onClick={() => setScanOpen(true)}
                aria-label={ts("open_scanner")}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-brand-600 text-white rounded-lg"
              >
                <ScanLine size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Jarayon</span>
            <span className="font-medium text-emerald-600">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-3 py-2 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTER_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 min-h-[36px] px-3 text-xs font-medium rounded-full border transition-colors ${
              filter === key
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3 pb-6">
        {filteredGroups.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Package size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Bu filtrda mahsulot yo'q</p>
          </div>
        ) : (
          filteredGroups.map((group, gi) =>
            group.parentId === null ? (
              <PickItemCard
                key={group.items[0].item_id}
                item={group.items[0]}
                pickingId={pickingId}
                can={can}
                onPick={handlePick}
                onContact={openContact}
                tp={tp}
              />
            ) : (
              <BundleGroup
                key={`bundle-${gi}-${group.parentId}`}
                parentName={group.parentName ?? ""}
                items={group.items}
                pickingId={pickingId}
                can={can}
                onPick={handlePick}
                onContact={openContact}
                tp={tp}
              />
            )
          )
        )}
      </div>

      {scanOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end">
          <div className="w-full bg-slate-900 rounded-t-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <span className="text-white font-medium text-sm">{ts("open_scanner")}</span>
              <button
                onClick={() => setScanOpen(false)}
                aria-label={ts("close_scanner")}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300"
              >
                <X size={20} />
              </button>
            </div>
            <BarcodeScanner
              onScan={handleScanPick}
              onError={() => {}}
              className="w-full h-64"
            />
          </div>
        </div>
      )}

      {contactModal.item && (
        <CashierContactModal
          open={contactModal.open}
          onClose={() => setContactModal({ open: false, item: null })}
          orderId={id}
          productName={contactModal.item.product_name}
          onNotFound={() => {
            if (contactModal.item) markNotFound(contactModal.item);
          }}
        />
      )}
    </div>
  );
}
