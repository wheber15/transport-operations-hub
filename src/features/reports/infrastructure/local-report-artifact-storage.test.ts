import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getLocalReportArtifactStorage,
  LocalReportArtifactStorage,
  ReportArtifactStorageConfigurationError,
} from "./local-report-artifact-storage";

const temporaryDirectories: string[] = [];

function checksum(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("private report artifact storage", () => {
  it("writes atomically and verifies the checksum before reading", async () => {
    const root = await mkdtemp(join(tmpdir(), "axon-reports-"));
    temporaryDirectories.push(root);
    const storage = new LocalReportArtifactStorage(root);
    const content = new TextEncoder().encode("immutable report artifact");
    await storage.write({
      storageKey: "reports/run-1/report.xlsx",
      content,
      checksumSha256: checksum(content),
    });

    const stored = await storage.open({
      storageKey: "reports/run-1/report.xlsx",
      checksumSha256: checksum(content),
    });
    expect(stored?.byteSize).toBe(BigInt(content.byteLength));
    await expect(
      storage.open({ storageKey: "reports/run-1/report.xlsx", checksumSha256: "0".repeat(64) })
    ).rejects.toBeInstanceOf(ReportArtifactStorageConfigurationError);
  });

  it("rejects traversal and unsafe production configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "axon-reports-"));
    temporaryDirectories.push(root);
    const storage = new LocalReportArtifactStorage(root);
    const content = new TextEncoder().encode("artifact");
    await expect(
      storage.write({ storageKey: "../outside", content, checksumSha256: checksum(content) })
    ).rejects.toBeInstanceOf(ReportArtifactStorageConfigurationError);
    expect(() => getLocalReportArtifactStorage({ NODE_ENV: "production" })).toThrow(
      ReportArtifactStorageConfigurationError
    );
    expect(() =>
      getLocalReportArtifactStorage({
        NODE_ENV: "development",
        REPORT_ARTIFACT_STORAGE_ROOT: "public/reports",
      })
    ).toThrow(ReportArtifactStorageConfigurationError);
  });
});
