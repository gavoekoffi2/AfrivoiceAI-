import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "crypto";
import { verifyVapiWebhook } from "./verify";

const BODY = JSON.stringify({ message: { type: "status-update" } });

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyVapiWebhook (fail-closed)", () => {
  const original = process.env.VAPI_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.VAPI_WEBHOOK_SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.VAPI_WEBHOOK_SECRET;
    else process.env.VAPI_WEBHOOK_SECRET = original;
  });

  it("refuse quand aucun secret n'est configuré (fail-closed)", () => {
    expect(verifyVapiWebhook(BODY, sign(BODY, "peu importe"))).toBe(false);
  });

  it("refuse une signature absente", () => {
    process.env.VAPI_WEBHOOK_SECRET = "s3cret-value-1234";
    expect(verifyVapiWebhook(BODY, null)).toBe(false);
  });

  it("accepte une signature valide", () => {
    process.env.VAPI_WEBHOOK_SECRET = "s3cret-value-1234";
    expect(verifyVapiWebhook(BODY, sign(BODY, "s3cret-value-1234"))).toBe(true);
  });

  it("refuse une signature invalide", () => {
    process.env.VAPI_WEBHOOK_SECRET = "s3cret-value-1234";
    expect(verifyVapiWebhook(BODY, sign(BODY, "mauvais-secret"))).toBe(false);
  });
});
