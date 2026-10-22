import { describe, expect, it } from "vitest";

import { mockService } from "@/services/mock-service";

describe("mock project file validation", () => {
  it("accepts project files regardless of their size", async () => {
    const largeFile = {
      name: "large-project.zip",
      size: 5 * 1024 * 1024 * 1024,
    } as File;

    await expect(mockService.validateProjectFiles([largeFile])).resolves.toEqual([
      {
        name: "large-project.zip",
        valid: true,
        reason: "Berkas valid dan siap diproses",
      },
    ]);
  });
});
