import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generatePublicKey,
  isOriginAllowed,
  normalizeDomain,
  signWidgetSession,
  verifyWidgetSession,
} from "./widget-auth";
import { generateApiKey, hashApiKey, isWellFormedApiKey } from "./api-keys";
import {
  _resetRateLimiter,
  consumeRateLimit,
  ruleForPlan,
} from "./rate-limit";
import { SentenceChunker } from "@/lib/pipeline/sentence-chunker";

describe("widget-auth : allowlist de domaines", () => {
  it("normalise les domaines saisis", () => {
    expect(normalizeDomain("https://www.monsite.com/page")).toBe("www.monsite.com");
    expect(normalizeDomain("Monsite.COM")).toBe("monsite.com");
    expect(normalizeDomain("")).toBeNull();
  });

  it("refuse sans allowlist ou sans origin", () => {
    expect(isOriginAllowed(null, ["monsite.com"])).toBe(false);
    expect(isOriginAllowed("https://monsite.com", [])).toBe(false);
    expect(isOriginAllowed("https://monsite.com", null)).toBe(false);
  });

  it("accepte un domaine listé et ses sous-domaines", () => {
    expect(isOriginAllowed("https://monsite.com", ["monsite.com"])).toBe(true);
    expect(isOriginAllowed("https://shop.monsite.com", ["monsite.com"])).toBe(true);
  });

  it("refuse un domaine non listé, y compris par suffixe trompeur", () => {
    expect(isOriginAllowed("https://autre.com", ["monsite.com"])).toBe(false);
    // « evil-monsite.com » ne doit PAS matcher « monsite.com ».
    expect(isOriginAllowed("https://evil-monsite.com", ["monsite.com"])).toBe(false);
  });
});

describe("widget-auth : tokens de session éphémères", () => {
  const original = process.env.WIDGET_SESSION_SECRET;
  beforeEach(() => {
    process.env.WIDGET_SESSION_SECRET = "secret-de-test-widget-123";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.WIDGET_SESSION_SECRET;
    else process.env.WIDGET_SESSION_SECRET = original;
  });

  const payload = {
    organizationId: "11111111-2222-4333-8444-555555555555",
    agentId: "66666666-7777-4888-9999-000000000000",
  };

  it("signe et vérifie un token valide", () => {
    const token = signWidgetSession(payload);
    const verified = verifyWidgetSession(token);
    expect(verified?.organizationId).toBe(payload.organizationId);
    expect(verified?.agentId).toBe(payload.agentId);
  });

  it("refuse un token falsifié", () => {
    const token = signWidgetSession(payload);
    const [body] = token.split(".");
    expect(verifyWidgetSession(`${body}.fausse-signature`)).toBeNull();

    // Payload modifié avec la même signature.
    const tampered = Buffer.from(
      JSON.stringify({ ...payload, organizationId: "autre-org" })
    ).toString("base64url");
    expect(verifyWidgetSession(`${tampered}.${token.split(".")[1]}`)).toBeNull();
  });

  it("refuse un token expiré", () => {
    const token = signWidgetSession(payload, Date.now() - 60 * 60 * 1000);
    expect(verifyWidgetSession(token)).toBeNull();
  });

  it("fail-closed sans secret configuré", () => {
    delete process.env.WIDGET_SESSION_SECRET;
    expect(() => signWidgetSession(payload)).toThrow(/WIDGET_SESSION_SECRET/);
  });

  it("génère des clés publiques bien formées", () => {
    expect(generatePublicKey()).toMatch(/^pk_[0-9a-f]{36}$/);
  });
});

describe("api-keys", () => {
  it("génère une clé bien formée avec hash et préfixe", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(isWellFormedApiKey(key)).toBe(true);
    expect(key.startsWith(prefix)).toBe(true);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).not.toContain(key.slice(9)); // le hash ne révèle pas le secret
  });

  it("rejette les formats invalides", () => {
    expect(isWellFormedApiKey("avk_live_court")).toBe(false);
    expect(isWellFormedApiKey("sk_autre_prefix")).toBe(false);
  });
});

describe("rate-limit par plan", () => {
  beforeEach(() => _resetRateLimiter());

  it("applique le quota de la fenêtre puis bloque", () => {
    const rule = { limit: 3, windowMs: 60_000 };
    const t0 = 1_000_000;
    expect(consumeRateLimit("k", rule, t0).allowed).toBe(true);
    expect(consumeRateLimit("k", rule, t0).allowed).toBe(true);
    expect(consumeRateLimit("k", rule, t0).allowed).toBe(true);
    const blocked = consumeRateLimit("k", rule, t0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("réinitialise après la fenêtre", () => {
    const rule = { limit: 1, windowMs: 1000 };
    const t0 = 1_000_000;
    expect(consumeRateLimit("k", rule, t0).allowed).toBe(true);
    expect(consumeRateLimit("k", rule, t0 + 500).allowed).toBe(false);
    expect(consumeRateLimit("k", rule, t0 + 1001).allowed).toBe(true);
  });

  it("les quotas dépendent du plan", () => {
    expect(ruleForPlan("free").limit).toBeLessThan(ruleForPlan("pro").limit);
    expect(ruleForPlan("pro").limit).toBeLessThan(ruleForPlan("enterprise").limit);
    expect(ruleForPlan("inconnu").limit).toBe(ruleForPlan("free").limit);
    expect(ruleForPlan(null).limit).toBe(ruleForPlan("free").limit);
  });

  it("les clés sont indépendantes", () => {
    const rule = { limit: 1, windowMs: 60_000 };
    expect(consumeRateLimit("a", rule, 0).allowed).toBe(true);
    expect(consumeRateLimit("b", rule, 0).allowed).toBe(true);
  });
});

describe("SentenceChunker", () => {
  it("découpe aux fins de phrases", () => {
    const chunker = new SentenceChunker();
    expect(chunker.push("Bonjour. Comment ")).toEqual(["Bonjour."]);
    expect(chunker.push("allez-vous ? Très")).toEqual(["Comment allez-vous ?"]);
    expect(chunker.flush()).toBe("Très");
  });

  it("coupe les textes longs sans ponctuation au dernier espace", () => {
    const chunker = new SentenceChunker(20);
    const out = chunker.push("mot ".repeat(15));
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].length).toBeLessThanOrEqual(20);
  });

  it("flush retourne null si vide", () => {
    expect(new SentenceChunker().flush()).toBeNull();
  });
});
