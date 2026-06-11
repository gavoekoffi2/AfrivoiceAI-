import { describe, expect, it, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { verifyVapiWebhook } from "./verify";

const SECRET = "mon-secret-vapi";
const BODY = JSON.stringify({ message: { type: "status-update" } });

describe("verifyVapiWebhook", () => {
  const originalSecret = process.env.VAPI_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.VAPI_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.VAPI_WEBHOOK_SECRET;
    } else {
      process.env.VAPI_WEBHOOK_SECRET = originalSecret;
    }
  });

  it("accepte le header x-vapi-secret envoyé par défaut par Vapi", () => {
    expect(verifyVapiWebhook(BODY, { secret: SECRET, signature: null })).toBe(
      true
    );
  });

  it("rejette un x-vapi-secret incorrect", () => {
    expect(
      verifyVapiWebhook(BODY, { secret: "mauvais-secret", signature: null })
    ).toBe(false);
  });

  it("accepte une signature HMAC hex valide", () => {
    const signature = crypto
      .createHmac("sha256", SECRET)
      .update(BODY, "utf8")
      .digest("hex");
    expect(verifyVapiWebhook(BODY, { secret: null, signature })).toBe(true);
  });

  it("rejette une signature HMAC invalide", () => {
    expect(
      verifyVapiWebhook(BODY, { secret: null, signature: "deadbeef" })
    ).toBe(false);
  });

  it("rejette une requête sans aucun header d'authentification", () => {
    expect(verifyVapiWebhook(BODY, { secret: null, signature: null })).toBe(
      false
    );
  });

  it("accepte tout quand aucun secret n'est configuré (dev)", () => {
    delete process.env.VAPI_WEBHOOK_SECRET;
    expect(verifyVapiWebhook(BODY, { secret: null, signature: null })).toBe(
      true
    );
  });
});
