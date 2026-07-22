"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Carrier = {
  id: string;
  carrierNumber: string;
  name: string;
  active: boolean;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  collectionTime: string | null;
  dailyTrailerLimit: number | null;
  notes: string | null;
};
type Form = {
  carrierNumber: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  collectionTime: string;
  dailyTrailerLimit: string;
  notes: string;
  active: boolean;
};
const blank: Form = {
  carrierNumber: "",
  name: "",
  contactName: "",
  email: "",
  phone: "",
  collectionTime: "",
  dailyTrailerLimit: "",
  notes: "",
  active: true,
};
const fields: Array<[keyof Form, string]> = [
  ["carrierNumber", "Carrier Number"],
  ["name", "Carrier Name"],
  ["contactName", "Contact Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["collectionTime", "Collection Time"],
  ["dailyTrailerLimit", "Daily Trailer Limit"],
];
function asForm(carrier: Carrier): Form {
  return {
    ...carrier,
    contactName: carrier.contactName ?? "",
    email: carrier.email ?? "",
    phone: carrier.phone ?? "",
    collectionTime: carrier.collectionTime ?? "",
    dailyTrailerLimit: carrier.dailyTrailerLimit?.toString() ?? "",
    notes: carrier.notes ?? "",
  };
}

export function CarrierManagement({ items, canManage }: { items: Carrier[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<string | null>(null);
  function begin(carrier?: Carrier) {
    setEditing(carrier ?? null);
    setForm(carrier ? asForm(carrier) : blank);
    setError(null);
    setOpen(true);
  }
  async function submit() {
    const response = await fetch(editing ? `/api/carriers/${editing.id}` : "/api/carriers", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      setError(payload?.error?.message ?? "Carrier could not be saved.");
      return;
    }
    setOpen(false);
    router.refresh();
  }
  async function changeStatus(carrier: Carrier) {
    await fetch(`/api/carriers/${carrier.id}/${carrier.active ? "deactivate" : "activate"}`, {
      method: "POST",
    });
    router.refresh();
  }
  return (
    <>
      <Button disabled={!canManage} onClick={() => begin()} type="button">
        Create Carrier
      </Button>
      {open ? (
        <div
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="border-border bg-background max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border shadow-xl">
            <header className="border-b p-5">
              <h2 className="font-semibold">{editing ? "Edit Carrier" : "Create Carrier"}</h2>
            </header>
            <div className="grid gap-3 p-5">
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              {fields.map(([key, label]) => (
                <label className="grid gap-1 text-sm" key={key}>
                  {label}
                  <input
                    className="border-input h-9 rounded border px-2"
                    type={
                      key === "collectionTime"
                        ? "time"
                        : key === "dailyTrailerLimit"
                          ? "number"
                          : "text"
                    }
                    value={String(form[key])}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  />
                </label>
              ))}
              <label className="grid gap-1 text-sm">
                Notes
                <textarea
                  className="border-input min-h-20 rounded border p-2"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  type="checkbox"
                />
                Active
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t p-4">
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button onClick={submit} type="button">
                Save Carrier
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-muted/40 sticky top-0">
              <tr>
                {[
                  "Carrier Number",
                  "Carrier Name",
                  "Contact",
                  "Email",
                  "Phone",
                  "Collection Time",
                  "Daily Trailer Limit",
                  "Status",
                  "Actions",
                ].map((column) => (
                  <th className="px-3 py-3 text-left text-xs uppercase" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((carrier) => (
                <tr className="border-b" key={carrier.id}>
                  <td className="p-3 text-sm">{carrier.carrierNumber}</td>
                  <td className="p-3 text-sm font-medium">{carrier.name}</td>
                  <td className="p-3 text-sm">{carrier.contactName ?? "—"}</td>
                  <td className="p-3 text-sm">{carrier.email ?? "—"}</td>
                  <td className="p-3 text-sm">{carrier.phone ?? "—"}</td>
                  <td className="p-3 text-sm">{carrier.collectionTime ?? "—"}</td>
                  <td className="p-3 text-sm">{carrier.dailyTrailerLimit ?? "—"}</td>
                  <td className="p-3 text-sm">{carrier.active ? "Active" : "Inactive"}</td>
                  <td className="flex gap-2 p-3">
                    <Button
                      disabled={!canManage}
                      onClick={() => begin(carrier)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={!canManage}
                      onClick={() => changeStatus(carrier)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {carrier.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
