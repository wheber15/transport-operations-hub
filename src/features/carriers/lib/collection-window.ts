export function formatCollectionWindow(start: string | null, end: string | null) {
  if (!start) return "Not set";
  return end ? `${start}–${end}` : `From ${start} · End time not set`;
}

export function formatCarrierSelectorLabel(carrier: {
  name: string;
  carrierNumber: string;
  collectionStartTime: string | null;
  collectionEndTime: string | null;
  dailyTrailerLimit: number | null;
}) {
  const parts = [`${carrier.name} — ${carrier.carrierNumber}`];
  if (carrier.collectionStartTime)
    parts.push(
      carrier.collectionEndTime
        ? `Collection ${carrier.collectionStartTime}–${carrier.collectionEndTime}`
        : `Collection from ${carrier.collectionStartTime}`
    );
  if (carrier.dailyTrailerLimit) parts.push(`Limit ${carrier.dailyTrailerLimit}`);
  return parts.join(" · ");
}
