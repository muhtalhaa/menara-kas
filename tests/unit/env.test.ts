import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("env negative case", () => {
  it("menolak AUTH_SECRET yang terlalu pendek", () => {
    const schema = z.object({
      AUTH_SECRET: z.string().min(32, "AUTH_SECRET minimal 32 karakter"),
    });

    const result = schema.safeParse({ AUTH_SECRET: "pendek" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("minimal 32");
    }
  });
});
