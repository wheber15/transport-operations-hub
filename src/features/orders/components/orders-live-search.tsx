"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function OrdersLiveSearch({ initialQuery }: { initialQuery?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery ?? "");
  const [pending, startTransition] = useTransition();
  const ownQueryRef = useRef(initialQuery ?? "");

  useEffect(() => {
    const urlQuery = initialQuery ?? "";
    if (urlQuery !== ownQueryRef.current) setValue(urlQuery);
    ownQueryRef.current = urlQuery;
  }, [initialQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim()) next.set("query", value.trim()); else next.delete("query");
      next.set("page", "1");
      if (next.get("query") !== searchParams.get("query") || searchParams.get("page") !== "1") {
        ownQueryRef.current = value.trim();
        startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams, value]);

  return <div className="relative min-w-0 flex-1"><label className="sr-only" htmlFor="order-search">Search order, delivery, customer, Ship-To, route or Shipment</label><Search aria-hidden="true" className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" /><input className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border pr-10 pl-9 text-sm outline-none focus-visible:ring-[3px]" id="order-search" onChange={(event) => setValue(event.target.value)} placeholder="Search order, delivery, customer, Ship-To, route or Shipment" type="search" value={value} />{value ? <Button aria-label="Clear order search" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => { ownQueryRef.current = ""; setValue(""); }} size="icon-xs" type="button" variant="ghost"><X /></Button> : null}<span aria-live="polite" className="sr-only">{pending ? "Updating Orders" : ""}</span></div>;
}
