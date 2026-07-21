"use client";

import { Filter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const fields = ["goodsIssueFrom", "goodsIssueTo", "customer", "route", "shipTo", "shipmentState", "palletState", "status", "recordState"] as const;
type Field = (typeof fields)[number];
type Draft = Record<Field, string>;
const empty = (): Draft => ({ goodsIssueFrom: "", goodsIssueTo: "", customer: "", route: "", shipTo: "", shipmentState: "all", palletState: "all", status: "", recordState: "active" });

export function OrdersFilters({ canViewDeletedOrders }: { canViewDeletedOrders: boolean }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const current = (): Draft => Object.fromEntries(fields.map((field) => [field, params.get(field) ?? empty()[field]])) as Draft;
  const [open, setOpen] = useState(false); const [draft, setDraft] = useState<Draft>(empty);
  const activeCount = fields.filter((field) => { const value = params.get(field); return value && !["all", "active"].includes(value); }).length;
  const apply = (values: Draft) => { const next = new URLSearchParams(params.toString()); fields.forEach((field) => { const value = values[field]; if (!value || ["all", "active"].includes(value)) next.delete(field); else next.set(field, value); }); next.set("page", "1"); if (values.goodsIssueFrom || values.goodsIssueTo) next.set("datePreset", "custom"); router.push(`${pathname}?${next}`); setOpen(false); };
  const update = (field: Field, value: string) => setDraft((previous) => ({ ...previous, [field]: value }));
  const recordOptions = canViewDeletedOrders ? ["active", "deleted", "all"] : ["active"];
  return <><Button onClick={() => { setDraft(current()); setOpen(true); }} size="sm" type="button" variant="outline"><Filter />Filters{activeCount ? ` ${activeCount}` : ""}</Button>{open ? <div aria-modal="true" className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4" onKeyDown={(event) => event.key === "Escape" && setOpen(false)} role="dialog"><div className="bg-background border-border w-full max-w-lg rounded-xl border p-5 shadow-xl"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Filters</h2><Button aria-label="Close filters" onClick={() => setOpen(false)} size="icon-xs" type="button" variant="ghost"><X /></Button></div><div className="grid gap-3 sm:grid-cols-2">{([['goodsIssueFrom','Goods Issue Date from','date'],['goodsIssueTo','Goods Issue Date to','date'],['customer','Customer','text'],['route','Route','text'],['shipTo','Ship-To','text'],['status','Operational status','text']] as const).map(([field,label,type]) => <label className="text-sm" key={field}>{label}<input className="border-input mt-1 h-9 w-full rounded-md border px-2" onChange={(e)=>update(field,e.target.value)} type={type} value={draft[field]} /></label>)}{([['shipmentState','Shipment assignment',['all','unassigned','assigned']],['palletState','Pallet capture',['all','awaiting','captured']],['recordState','Record state',recordOptions]] as const).map(([field,label,options])=><label className="text-sm" key={field}>{label}<select className="border-input mt-1 h-9 w-full rounded-md border px-2" onChange={(e)=>update(field,e.target.value)} value={draft[field]}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>)}</div><div className="mt-5 flex justify-end gap-2"><Button onClick={()=>apply(empty())} type="button" variant="outline">Reset</Button><Button onClick={()=>setOpen(false)} type="button" variant="outline">Cancel</Button><Button onClick={()=>apply(draft)} type="button">Apply filters</Button></div></div></div> : null}</>;
}
