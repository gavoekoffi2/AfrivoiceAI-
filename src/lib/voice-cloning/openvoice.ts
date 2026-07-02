type OpenVoiceCloneRequest = {
  profileId: string;
  name: string;
  referenceAudioUrl: string;
  text: string;
  language: string;
  callbackUrl?: string;
};

type OpenVoiceCloneResponse = {
  status?: "queued" | "training" | "ready" | "failed";
  voiceId?: string;
  previewAudioUrl?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type OpenVoiceServiceHealth = {
  configured: boolean;
  ok: boolean;
  status: "not_configured" | "online" | "offline";
  baseUrl?: string;
  message?: string;
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function getOpenVoiceConfig() {
  const baseUrl = process.env.OPENVOICE_API_URL?.trim();
  const apiKey = process.env.OPENVOICE_API_KEY?.trim();
  const callbackSecret = process.env.OPENVOICE_CALLBACK_SECRET?.trim();

  return {
    configured: Boolean(baseUrl),
    baseUrl: baseUrl ? normalizeBaseUrl(baseUrl) : undefined,
    apiKey,
    callbackSecret,
  };
}

function buildHeaders(apiKey?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

export async function checkOpenVoiceService(): Promise<OpenVoiceServiceHealth> {
  const config = getOpenVoiceConfig();
  if (!config.baseUrl) {
    return {
      configured: false,
      ok: false,
      status: "not_configured",
      message: "OPENVOICE_API_URL n’est pas encore configuré.",
    };
  }

  try {
    const response = await fetch(`${config.baseUrl}/health`, {
      headers: buildHeaders(config.apiKey),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    return {
      configured: true,
      ok: response.ok,
      status: response.ok ? "online" : "offline",
      baseUrl: config.baseUrl,
      message: response.ok
        ? "Service OpenVoice joignable."
        : `Service OpenVoice indisponible (${response.status}).`,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      status: "offline",
      baseUrl: config.baseUrl,
      message: error instanceof Error ? error.message : "Service OpenVoice indisponible.",
    };
  }
}

export async function requestOpenVoiceClone(
  payload: OpenVoiceCloneRequest
): Promise<OpenVoiceCloneResponse> {
  const config = getOpenVoiceConfig();
  if (!config.baseUrl) {
    throw new Error("OPENVOICE_API_URL n’est pas configuré. Déployez d’abord le service GPU OpenVoice.");
  }

  const response = await fetch(`${config.baseUrl}/clone`, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(120000),
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { message: await response.text().catch(() => "") };

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string" && body.message
        ? body.message
        : `OpenVoice a refusé la génération (${response.status}).`
    );
  }

  return body as OpenVoiceCloneResponse;
}

export function defaultOpenVoicePreviewText() {
  return "Bonjour, je suis votre assistant AfrivoxAI. Cette voix a été générée à partir d’un échantillon autorisé pour vos campagnes commerciales.";
}
