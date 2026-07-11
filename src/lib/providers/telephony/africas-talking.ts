import AfricasTalking from "africastalking";
import {
  CallHandle,
  OutboundCallParams,
  ProviderError,
  TelephonyProvider,
} from "../types";

/**
 * Provider téléphonie Africa's Talking (SDK officiel `africastalking`).
 *
 * Bien implanté en Afrique de l'Ouest — pertinent pour le Togo. Voir
 * TELEPHONY.md pour obtenir un numéro et configurer les callbacks.
 *
 * Configuration :
 * - `AFRICASTALKING_API_KEY`   : clé API (dashboard AT)
 * - `AFRICASTALKING_USERNAME`  : username AT (`sandbox` pour les tests)
 * - `AFRICASTALKING_PHONE_NUMBER` : numéro vocal acheté chez AT (E.164)
 *
 * ⚠️ Limite documentée (honnêteté technique) : Africa's Talking ne fournit
 * PAS de flux média bidirectionnel temps réel équivalent aux Twilio Media
 * Streams. La conversation IA passe donc par un **mode tour-par-tour** :
 * le callback voix AT enregistre l'énoncé de l'appelant (`<Record>`), le
 * serveur le transcrit (STT) puis répond avec l'audio TTS (`<Play>`), en
 * boucle. Latence plus élevée qu'un vrai streaming — voir TELEPHONY.md.
 * `supportsMediaStreaming()` retourne donc `false`.
 */
export class AfricasTalkingProvider implements TelephonyProvider {
  readonly name = "africas-talking";

  private getClient() {
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const username = process.env.AFRICASTALKING_USERNAME;
    if (!apiKey || !username) {
      throw new ProviderError(
        "telephony",
        this.name,
        "AFRICASTALKING_API_KEY / AFRICASTALKING_USERNAME non configurés (voir TELEPHONY.md)"
      );
    }
    return AfricasTalking({ apiKey, username });
  }

  async makeCall(params: OutboundCallParams): Promise<CallHandle> {
    const client = this.getClient();

    let response;
    try {
      response = await client.VOICE.call({
        callFrom: params.from,
        callTo: [params.to],
        // Permet de relier le callback voix à l'agent et à l'organisation.
        clientRequestId: `${params.organizationId}:${params.agentId}`,
      });
    } catch (error) {
      throw new ProviderError(
        "telephony",
        this.name,
        "échec de l'appel sortant Africa's Talking",
        error
      );
    }

    const entry = response.entries?.[0];
    if (!entry) {
      throw new ProviderError(
        "telephony",
        this.name,
        response.errorMessage ?? "aucune entrée retournée par Africa's Talking"
      );
    }

    return {
      providerCallId: entry.sessionId ?? `${this.name}:${params.to}:${Date.now()}`,
      provider: this.name,
      status: entry.status,
    };
  }

  async hangup(): Promise<void> {
    // L'API Africa's Talking termine un appel en répondant une action vide
    // (ou <Reject/>) au prochain callback de la session. Il n'existe pas
    // d'endpoint REST public « hangup by sessionId » : la fin d'appel est
    // pilotée par la réponse XML du webhook voix (voir la route
    // /api/telephony/africas-talking/voice).
    return;
  }

  supportsMediaStreaming(): boolean {
    return false; // Pas de media streams temps réel chez AT (voir TELEPHONY.md).
  }
}

/**
 * Construit la réponse XML attendue par les callbacks voix Africa's Talking.
 * https://developers.africastalking.com/docs/voice/actions
 */
export function buildAtVoiceResponse(actions: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${actions.join("")}</Response>`;
}

export function atSay(text: string): string {
  return `<Say voice="woman">${escapeXml(text)}</Say>`;
}

export function atPlay(url: string): string {
  return `<Play url="${escapeXml(url)}"/>`;
}

/** Enregistre l'énoncé de l'appelant puis rappelle le callback avec l'URL. */
export function atRecord(opts: { maxLengthSeconds?: number } = {}): string {
  const maxLen = opts.maxLengthSeconds ?? 20;
  return `<Record maxLength="${maxLen}" trimSilence="true" playBeep="false" finishOnKey="#"></Record>`;
}

export function atReject(): string {
  return `<Reject/>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
