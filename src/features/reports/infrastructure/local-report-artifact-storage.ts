import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";

export type StoredReportArtifact = {
  stream: ReadableStream<Uint8Array>;
  byteSize: bigint;
};

export interface ReportArtifactStorage {
  write(input: { storageKey: string; content: Uint8Array; checksumSha256: string }): Promise<void>;
  open(input: { storageKey: string; checksumSha256: string }): Promise<StoredReportArtifact | null>;
  remove(input: { storageKey: string }): Promise<void>;
}

export class ReportArtifactStorageConfigurationError extends Error {
  constructor() {
    super("Private report artifact storage is not configured safely.");
  }
}

function checksum(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

function isContained(root: string, target: string) {
  const pathRelative = relative(root, target);
  return (
    pathRelative !== "" &&
    !pathRelative.startsWith(`..${sep}`) &&
    pathRelative !== ".." &&
    !isAbsolute(pathRelative)
  );
}

function validateStorageKey(storageKey: string) {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(storageKey)) {
    throw new ReportArtifactStorageConfigurationError();
  }
  if (storageKey.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new ReportArtifactStorageConfigurationError();
  }
}

export class LocalReportArtifactStorage implements ReportArtifactStorage {
  constructor(private readonly rootDirectory: string) {}

  private resolveKey(storageKey: string) {
    validateStorageKey(storageKey);
    const target = resolve(this.rootDirectory, storageKey);
    if (!isContained(this.rootDirectory, target))
      throw new ReportArtifactStorageConfigurationError();
    return target;
  }

  async write(input: { storageKey: string; content: Uint8Array; checksumSha256: string }) {
    if (checksum(input.content) !== input.checksumSha256) {
      throw new ReportArtifactStorageConfigurationError();
    }
    const target = this.resolveKey(input.storageKey);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, input.content, { flag: "wx" });
      const written = await readFile(temporary);
      if (checksum(written) !== input.checksumSha256)
        throw new ReportArtifactStorageConfigurationError();
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async open(input: {
    storageKey: string;
    checksumSha256: string;
  }): Promise<StoredReportArtifact | null> {
    const target = this.resolveKey(input.storageKey);
    try {
      const metadata = await stat(target);
      if (!metadata.isFile()) return null;
      const content = await readFile(target);
      if (checksum(content) !== input.checksumSha256) {
        throw new ReportArtifactStorageConfigurationError();
      }
      return {
        stream: Readable.toWeb(Readable.from(content)) as ReadableStream<Uint8Array>,
        byteSize: BigInt(metadata.size),
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    }
  }
  async remove(input: { storageKey: string }) {
    await rm(this.resolveKey(input.storageKey), { force: true });
  }
}

export function getLocalReportArtifactStorage(
  environment: NodeJS.ProcessEnv = process.env
): LocalReportArtifactStorage {
  const configuredRoot = environment.REPORT_ARTIFACT_STORAGE_ROOT;
  if (environment.NODE_ENV === "production" && !configuredRoot) {
    throw new ReportArtifactStorageConfigurationError();
  }
  const root = configuredRoot
    ? resolve(/* turbopackIgnore: true */ configuredRoot)
    : resolve(process.cwd(), ".local-report-artifacts");
  const publicDirectory = resolve("public");
  if (root === publicDirectory || root.startsWith(`${publicDirectory}${sep}`)) {
    throw new ReportArtifactStorageConfigurationError();
  }
  return new LocalReportArtifactStorage(root);
}
