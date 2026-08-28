import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth-crypto";

describe("local authentication", () => {
  it("hashes and verifies a password without storing it in clear text", async () => {
    const password = "CorrectHorseBatteryStaple!";
    const result = await hashPassword(password);

    expect(result.hash).not.toBe(password);
    expect(result.salt).toHaveLength(32);
    await expect(verifyPassword(password, result.salt, result.hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", result.salt, result.hash)).resolves.toBe(false);
  });
});
