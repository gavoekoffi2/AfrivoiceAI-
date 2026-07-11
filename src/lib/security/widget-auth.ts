import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

/**
 * Sécurité du widget embarquable (Partie E).
 *
 * Modèle :
 * 1. Chaque organisation possède une **clé publique** `pk_...` (non secrète,
 *    visible dans le snippet HTML par construction) et une **allowlist de
 *    domaines** autorisés à charger le widget.
 * 2. Le widget appelle `POST /api/widget/session` avec la clé publique ;
 *    le serveur vérifie clé + Origin ∈ allowlist, puis délivre un **token de
 *    session éphémère signé HMAC** (aucun secret côté client).
 * 3. Les échanges suivants portent ce token, revalidé à chaque requête.
 */

export function generatePublicKey(): string {
  return `pk_${crypto.randomBytes(18).toString("hex")}`;
}

/** Normalise un domaine saisi par l'utilisateur (URL complète, host, etc.). */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Vérifie qu'une Origin appartient à l'allowlist de l'organisation.
 * `localhost` n'est accepté que s'il figure explicitement dans la liste.
 * Un sous-domaine est couvert par une entrée `exemple.com` (match suffixe).
 */
export function isOriginAllowed(
  origin: string | null,
  allowedDomains: string[] | null | undefined
): boolean {
  if (!origin) return false;
  if (!allowedDomains || allowedDomains.length === 0) return false;

  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  return allowedDomains.some((domain) => {
    const normalized = normalizeDomain(domain);
    if (!normalized) return false;
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

// --- Token de session éphémère ----------------------------------------------

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getSigningSecret(): string {
  const secret = process.env.WIDGET_SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "WIDGET_SESSION_SECRET non configuré (>= 16 caractères requis) : widget désactivé."
    );
  }
  return secret;
}

export interface WidgetSessionPayload {
  organizationId: string;
  agentId: string;
  /** Epoch ms d'expiration. */
  exp: number;
}

export function signWidgetSession(
  payload: Omit<WidgetSessionPayload, "exp">,
  now: number = Date.now()
): string {
  const full: WidgetSessionPayload = { ...payload, exp: now + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const mac = crypto
    .createHmac("sha256", getSigningSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${mac}`;
}

export function verifyWidgetSession(
  token: string | null | undefined,
  now: number = Date.now()
): WidgetSessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(body)
    .digest("base64url");
  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (
    macBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(macBuf, expectedBuf)
  ) {
    return null;
  }

  let payload: WidgetSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.organizationId || !payload.agentId) return null;
  if (typeof payload.exp !== "number" || now >= payload.exp) return null;
  return payload;
}

// --- Résolution d'organisation par clé publique ------------------------------

export async function findOrganizationByPublicKey(publicKey: string) {
  if (!/^pk_[0-9a-f]{36}$/.test(publicKey)) return null;
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.publicKey, publicKey))
    .limit(1);
  return rows[0] ?? null;
}
