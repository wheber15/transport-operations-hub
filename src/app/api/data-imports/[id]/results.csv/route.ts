import { getCurrentUser } from "@/features/auth/application/session";
import { getBatch } from "@/features/data-management/application/data-import-service";
import { neutralizeCsvCell } from "@/features/data-management/lib/parsing";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentication is required.", { status: 401 });
  try {
    const { batch } = await getBatch(user, (await params).id);
    const quote = (value: string | number | null) =>
      `"${neutralizeCsvCell(String(value ?? "")).replaceAll('"', '""')}"`;
    const csv = [
      "Source Row,Identifier,Classification,Message",
      ...batch.rows.map((row) =>
        [row.sourceRowNumber, row.identifier, row.classification, row.message].map(quote).join(",")
      ),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="import-results-${batch.id}.csv"`,
      },
    });
  } catch {
    return new Response("Import results are unavailable.", { status: 404 });
  }
}
