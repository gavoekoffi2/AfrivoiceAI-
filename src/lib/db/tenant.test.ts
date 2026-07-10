import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock du module DB pour intercepter la transaction sans base réelle.
const h = vi.hoisted(() => {
  const execute = vi.fn(async () => {});
  const fakeTx = { execute };
  const transaction = vi.fn(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(fakeTx)
  );
  return { execute, fakeTx, transaction };
});

vi.mock("./index", () => ({ db: { transaction: h.transaction } }));

import { withTenant, withServiceContext } from "./tenant";

const VALID_ORG = "11111111-2222-4333-8444-555555555555";

describe("withTenant (isolation multi-tenant)", () => {
  beforeEach(() => {
    h.execute.mockClear();
    h.transaction.mockClear();
  });

  it("ouvre une transaction, pose le contexte org, puis exécute le callback", async () => {
    const result = await withTenant(VALID_ORG, async (tx) => {
      expect(tx).toBe(h.fakeTx);
      return "ok";
    });
    expect(result).toBe("ok");
    expect(h.transaction).toHaveBeenCalledTimes(1);
    // set_config('app.current_org', ...) exécuté exactement une fois.
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it("rejette un organizationId non-UUID (défense contre injection de contexte)", async () => {
    await expect(
      withTenant("not-a-uuid", async () => "x")
    ).rejects.toThrow(/organizationId invalide/);
    expect(h.transaction).not.toHaveBeenCalled();
  });
});

describe("withServiceContext (bypass RLS réservé au système)", () => {
  beforeEach(() => {
    h.execute.mockClear();
    h.transaction.mockClear();
  });

  it("pose le drapeau de bypass puis exécute le callback", async () => {
    const result = await withServiceContext(async () => 42);
    expect(result).toBe(42);
    expect(h.execute).toHaveBeenCalledTimes(1);
  });
});
