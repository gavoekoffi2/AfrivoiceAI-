import {
  CallHandle,
  NotDeployedError,
  OutboundCallParams,
  TelephonyProvider,
} from "../types";

/**
 * STUB Twilio — non déployé, documenté.
 *
 * Twilio est le second provider télécom prévu (voir TELEPHONY.md §Twilio).
 * Contrairement à Africa's Talking, Twilio offre des **Media Streams**
 * (WebSocket bidirectionnel temps réel), qui permettent de brancher
 * directement `VoiceAgentPipeline` sur l'audio de l'appel — c'est la voie
 * recommandée pour la latence < 1,5 s.
 *
 * Pour l'activer :
 * 1. `npm install twilio`
 * 2. Configurer `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
 * 3. Remplacer ce stub par l'implémentation (makeCall via
 *    `client.calls.create({ twiml: <Connect><Stream url="wss://..."/> })`,
 *    MediaBridge WebSocket côté serveur Docker)
 *
 * Ce stub échoue proprement : il ne simule JAMAIS un appel.
 */
export class TwilioTelephonyStub implements TelephonyProvider {
  readonly name = "twilio-stub";

  async makeCall(_params: OutboundCallParams): Promise<CallHandle> {
    throw new NotDeployedError(
      "telephony",
      this.name,
      "installer le SDK `twilio` et configurer TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER (voir TELEPHONY.md)"
    );
  }

  async hangup(): Promise<void> {
    throw new NotDeployedError(
      "telephony",
      this.name,
      "stub non déployé (voir TELEPHONY.md)"
    );
  }

  supportsMediaStreaming(): boolean {
    return true; // Twilio Media Streams — une fois le SDK réellement branché.
  }
}
