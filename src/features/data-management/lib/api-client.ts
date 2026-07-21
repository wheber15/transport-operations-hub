export class DataImportApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
    this.name = "DataImportApiError";
  }
}

export const dataImportPaths = {
  upload: () => "/api/data-imports/upload",
  batch: (id: string) => `/api/data-imports/${encodeURIComponent(id)}`,
  sheet: (id: string) => `/api/data-imports/${encodeURIComponent(id)}/sheet`,
  header: (id: string) => `/api/data-imports/${encodeURIComponent(id)}/header`,
  mapping: (id: string) => `/api/data-imports/${encodeURIComponent(id)}/mapping`,
  preview: (id: string) => `/api/data-imports/${encodeURIComponent(id)}/preview`,
  commit: (id: string) => `/api/data-imports/${encodeURIComponent(id)}/commit`,
  rows: (id: string) => `/api/data-imports/${encodeURIComponent(id)}/rows`,
} as const;

function fallbackError(status: number) {
  if (status === 404)
    return new DataImportApiError("Import endpoint not found.", "NOT_FOUND", status);
  if (status === 405)
    return new DataImportApiError(
      "This import step is no longer available.",
      "METHOD_NOT_ALLOWED",
      status
    );
  return new DataImportApiError(
    "The server returned an unexpected response.",
    "UNEXPECTED_RESPONSE",
    status
  );
}

export async function dataImportRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const contentType = response.headers.get("content-type") ?? "";
  if (process.env.NODE_ENV === "development" && !response.ok)
    console.warn("Data Management request failed", { path, status: response.status });
  if (!contentType.includes("application/json")) throw fallbackError(response.status);
  let body: { data?: T; error?: { code?: string; message?: string } };
  try {
    body = (await response.json()) as { data?: T; error?: { code?: string; message?: string } };
  } catch {
    throw fallbackError(response.status);
  }
  if (!response.ok) {
    throw new DataImportApiError(
      body.error?.message ?? fallbackError(response.status).message,
      body.error?.code ?? fallbackError(response.status).code,
      response.status
    );
  }
  if (!("data" in body)) throw fallbackError(response.status);
  return body.data as T;
}
