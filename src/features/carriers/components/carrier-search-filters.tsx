"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  type CarrierFilterState,
  updateCarrierFilterSearchParams,
} from "@/features/carriers/lib/carrier-filter-state";

type CarrierSearchFiltersProps = {
  canManage: boolean;
  initialQuery?: string;
  initialState: CarrierFilterState;
};

function toHref(pathname: string, params: URLSearchParams) {
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function CarrierSearchFilters({
  canManage,
  initialQuery,
  initialState,
}: CarrierSearchFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [pending, startTransition] = useTransition();
  const ownQueryRef = useRef(initialQuery ?? "");
  const ownStateRef = useRef(initialState);

  useEffect(() => {
    const nextQuery = initialQuery ?? "";
    if (nextQuery !== ownQueryRef.current) setQuery(nextQuery);
    ownQueryRef.current = nextQuery;
  }, [initialQuery]);

  useEffect(() => {
    ownStateRef.current = initialState;
  }, [initialState]);

  const navigateQuery = useCallback(
    (value: string, replace: boolean) => {
      const next = updateCarrierFilterSearchParams(new URLSearchParams(searchParams.toString()), {
        query: value,
        state: ownStateRef.current,
      });
      ownQueryRef.current = value.trim();
      startTransition(() => {
        const href = toHref(pathname, next);
        if (replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim() !== (initialQuery ?? "")) navigateQuery(query, true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [initialQuery, navigateQuery, query]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateQuery(query, false);
  }

  function changeState(state: CarrierFilterState) {
    ownStateRef.current = state;
    const next = updateCarrierFilterSearchParams(new URLSearchParams(searchParams.toString()), {
      query,
      state,
    });
    startTransition(() => router.push(toHref(pathname, next), { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form className="relative min-w-0 flex-1" onSubmit={submitSearch} role="search">
        <label className="sr-only" htmlFor="carrier-search">
          Search by Carrier number, name, contact, email, or phone
        </label>
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border pr-10 pl-9 text-sm outline-none focus-visible:ring-[3px]"
          id="carrier-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Carriers"
          type="search"
          value={query}
        />
        {query ? (
          <Button
            aria-label="Clear Carrier search"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setQuery("")}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        ) : null}
      </form>
      <label className="sr-only" htmlFor="carrier-status">
        Carrier status
      </label>
      <select
        className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canManage}
        id="carrier-status"
        onChange={(event) => changeState(event.target.value as CarrierFilterState)}
        value={initialState}
      >
        <option value="active">Active</option>
        {canManage ? <option value="inactive">Inactive</option> : null}
        {canManage ? <option value="all">All</option> : null}
      </select>
      <span aria-live="polite" className="sr-only">
        {pending ? "Updating Carriers" : ""}
      </span>
    </div>
  );
}
