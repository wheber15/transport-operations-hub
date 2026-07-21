import { describe, expect, it, vi } from "vitest";
import { dataImportPaths, dataImportRequest } from "./api-client";

function response(body: string, status: number, contentType: string) {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

describe("Data Management API client", () => {
  it("uses the GET batch endpoint returned by upload and the sheet-selection endpoint", () => {
    const id = "batch-123";
    expect(dataImportPaths.batch(id)).toBe("/api/data-imports/batch-123");
    expect(dataImportPaths.sheet(id)).toBe("/api/data-imports/batch-123/sheet");
  });
  it("returns a planner-safe error for an HTML 404 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response("<!DOCTYPE html>", 404, "text/html"))
    );
    await expect(dataImportRequest("/api/data-imports/missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Import endpoint not found.",
    });
  });
  it("returns a planner-safe error for unsupported methods and non-JSON server responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response("Method Not Allowed", 405, "text/plain"))
    );
    await expect(
      dataImportRequest("/api/data-imports/batch", { method: "POST" })
    ).rejects.toMatchObject({
      code: "METHOD_NOT_ALLOWED",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("failure", 500, "text/plain")));
    await expect(dataImportRequest("/api/data-imports/batch")).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
    });
  });
  it.each(["import.csv", "import.xlsx"])(
    "supports %s workflows through the shared sheet endpoint",
    (fileName) => {
      expect(dataImportPaths.sheet(`batch-for-${fileName}`)).toBe(
        `/api/data-imports/batch-for-${fileName}/sheet`
      );
    }
  );
});
