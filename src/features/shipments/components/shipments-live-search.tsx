"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { updateShipmentSearchParams } from "@/features/shipments/lib/shipment-url-state";

export function ShipmentsLiveSearch({ initialQuery }: { initialQuery?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [pending, startTransition] = useTransition();
  const ownQueryRef = useRef(initialQuery ?? "");

  useEffect(() => {
    const value = initialQuery ?? "";
    if (value !== ownQueryRef.current) setQuery(value);
    ownQueryRef.current = value;
  }, [initialQuery]);

  const navigate = useCallback(
    (value: string, replace: boolean) => {
      const next = updateShipmentSearchParams(new URLSearchParams(params.toString()), {
        q: value.trim() || undefined,
        query: undefined,
        page: "1",
      });
      ownQueryRef.current = value.trim();
      const href = `${pathname}${next.size ? `?${next.toString()}` : ""}`;
      startTransition(() =>
        replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })
      );
    },
    [params, pathname, router]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim() !== (initialQuery ?? "")) navigate(query, true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [initialQuery, navigate, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(query, false);
  }

  return (
    <form className="relative min-w-0 flex-1" onSubmit={submit} role="search">
      <label className="sr-only" htmlFor="shipment-search">
        Search Shipment number, Carrier, Delivery, or Sales Order
      </label>
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <input
        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border pr-10 pl-9 text-sm outline-none focus-visible:ring-[3px]"
        id="shipment-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Shipment, Carrier, Delivery, or Order"
        type="search"
        value={query}
      />
      {query ? (
        <Button
          aria-label="Clear Shipment search"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => setQuery("")}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <X />
        </Button>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {pending ? "Updating Shipments" : ""}
      </span>
    </form>
  );
}
