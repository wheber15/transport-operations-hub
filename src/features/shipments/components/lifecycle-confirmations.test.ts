import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const componentFiles = [
  "delivery-assignment-action.tsx",
  "close-shipment-button.tsx",
  "delete-shipment-button.tsx",
  "delivery-import-workflow.tsx",
];

describe("Shipment lifecycle confirmations", () => {
  it("uses AXon confirmation dialogs instead of browser confirmation calls", async () => {
    const contents = await Promise.all(
      componentFiles.map((file) =>
        readFile(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8")
      )
    );

    expect(contents.join("\n")).not.toContain("window.confirm");
    expect(contents.join("\n")).toContain("ConfirmationDialog");
  });

  it("keeps the release-count consequence in the delete confirmation", async () => {
    const source = await readFile(
      fileURLToPath(new URL("./delete-shipment-button.tsx", import.meta.url)),
      "utf8"
    );

    expect(source).toContain("This will release {deliveryCount} assigned");
  });
});
