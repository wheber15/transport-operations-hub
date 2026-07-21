"use client";

import { Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type OrderActionData = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  deliveryNumber: string | null;
  pickingNumber: string | null;
  goodsIssueDate: string | null;
  shipToNumber: string | null;
  routeCode: string | null;
  shippingPoint: string | null;
  grossWeightKg: string | null;
  deletedAt: string | null;
};

type Draft = Omit<
  OrderActionData,
  "id" | "orderNumber" | "customerName" | "deliveryNumber" | "deletedAt"
>;

function initialDraft(order: OrderActionData): Draft {
  return {
    pickingNumber: order.pickingNumber,
    goodsIssueDate: order.goodsIssueDate,
    shipToNumber: order.shipToNumber,
    routeCode: order.routeCode,
    shippingPoint: order.shippingPoint,
    grossWeightKg: order.grossWeightKg,
  };
}

async function request(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  if (response.ok) return;
  const body = response.headers.get("content-type")?.includes("application/json")
    ? ((await response.json()) as { error?: { message?: string } })
    : null;
  throw new Error(body?.error?.message ?? "The server returned an unexpected response.");
}

export function OrderAdminActions({ order }: { order: OrderActionData }) {
  const router = useRouter();
  const [mode, setMode] = useState<"edit" | "delete" | "restore" | null>(null);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(order));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setMode(null);
    setError(null);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      await request(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      toast.success("Order saved successfully.");
      router.refresh();
      close();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "The Order could not be saved."
      );
    } finally {
      setPending(false);
    }
  }

  async function changeState() {
    setPending(true);
    setError(null);
    try {
      if (mode === "delete") {
        await request(`/api/orders/${order.id}`, { method: "DELETE" });
        toast.success("Order moved to Deleted Orders.");
      } else {
        await request(`/api/orders/${order.id}/restore`, { method: "POST" });
        toast.success("Order restored successfully.");
      }
      router.refresh();
      close();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The Order state could not be changed."
      );
    } finally {
      setPending(false);
    }
  }

  if (order.deletedAt) {
    return (
      <>
        <Button onClick={() => setMode("restore")} size="xs" type="button" variant="outline">
          <RotateCcw />
          Restore
        </Button>
        {mode === "restore" ? (
          <ConfirmationDialog
            error={error}
            onCancel={close}
            onConfirm={changeState}
            pending={pending}
            title="Restore Order?"
          >
            Sales Order {order.orderNumber} will return to active operational queries. Its Delivery
            and pallet history will remain unchanged.
          </ConfirmationDialog>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="inline-flex items-center justify-end gap-1">
        <Button
          aria-label={`Edit Order ${order.orderNumber}`}
          onClick={() => setMode("edit")}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Pencil />
        </Button>
        <Button
          aria-label={`Delete Order ${order.orderNumber}`}
          onClick={() => setMode("delete")}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
      {mode === "edit" ? (
        <EditDialog
          draft={draft}
          error={error}
          onCancel={close}
          onChange={setDraft}
          onSave={save}
          pending={pending}
        />
      ) : null}
      {mode === "delete" ? (
        <ConfirmationDialog
          error={error}
          onCancel={close}
          onConfirm={changeState}
          pending={pending}
          title="Delete Order?"
        >
          <span>Sales Order {order.orderNumber}</span>
          <span>Delivery {order.deliveryNumber ?? "Not available"}</span>
          <span>Customer {order.customerName ?? "Not available"}</span>
          <p className="text-muted-foreground mt-2">
            The Order will be soft-deleted. Delivery, pallet, shipment, and import history remain
            available for audit and recovery.
          </p>
        </ConfirmationDialog>
      ) : null}
    </>
  );
}

function EditDialog({
  draft,
  error,
  onCancel,
  onChange,
  onSave,
  pending,
}: {
  draft: Draft;
  error: string | null;
  onCancel: () => void;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  pending: boolean;
}) {
  const field = (key: keyof Draft, label: string, type = "text") => (
    <label className="grid gap-1 text-sm" key={key}>
      {label}
      <input
        className="border-input bg-background h-9 rounded-md border px-2"
        onChange={(event) => onChange({ ...draft, [key]: event.target.value || null })}
        type={type}
        value={draft[key] ?? ""}
      />
    </label>
  );
  return (
    <div
      aria-labelledby="edit-order-title"
      aria-modal="true"
      className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="border-border bg-background max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border shadow-xl">
        <header className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold" id="edit-order-title">
            Edit Order
          </h2>
          <Button
            aria-label="Close Order editor"
            onClick={onCancel}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {error ? (
            <p className="text-destructive sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
          {field("pickingNumber", "Picking number")}
          {field("goodsIssueDate", "Goods Issue date", "date")}
          {field("shipToNumber", "Ship-To")}
          {field("routeCode", "Route")}
          {field("shippingPoint", "Shipping point")}
          {field("grossWeightKg", "SAP gross weight (kg)", "text")}
        </div>
        <footer className="border-border flex justify-end gap-2 border-t px-5 py-4">
          <Button disabled={pending} onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} onClick={onSave} type="button">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function ConfirmationDialog({
  children,
  error,
  onCancel,
  onConfirm,
  pending,
  title,
}: {
  children: React.ReactNode;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  title: string;
}) {
  return (
    <div
      aria-labelledby="order-confirmation-title"
      aria-modal="true"
      className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="border-border bg-background w-full max-w-md rounded-xl border p-5 shadow-xl">
        <h2 className="font-semibold" id="order-confirmation-title">
          {title}
        </h2>
        <div className="text-foreground mt-3 grid gap-1 text-sm">{children}</div>
        {error ? (
          <p className="text-destructive mt-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button disabled={pending} onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} onClick={onConfirm} type="button" variant="destructive">
            {pending ? "Working…" : title.startsWith("Restore") ? "Restore Order" : "Delete Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
