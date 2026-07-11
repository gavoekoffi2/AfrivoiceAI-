/**
 * Déclarations minimales pour le SDK officiel `africastalking` (JavaScript,
 * sans types publiés). Seule la surface utilisée par AfrivoiceAI est typée.
 */
declare module "africastalking" {
  interface AfricasTalkingOptions {
    apiKey: string;
    username: string;
  }

  interface VoiceCallOptions {
    callFrom: string;
    callTo: string[];
    clientRequestId?: string;
  }

  interface VoiceCallEntry {
    phoneNumber: string;
    status: string;
    sessionId?: string;
  }

  interface VoiceCallResponse {
    entries?: VoiceCallEntry[];
    errorMessage?: string;
  }

  interface VoiceService {
    call(options: VoiceCallOptions): Promise<VoiceCallResponse>;
  }

  interface AfricasTalkingClient {
    VOICE: VoiceService;
  }

  function AfricasTalking(
    options: AfricasTalkingOptions
  ): AfricasTalkingClient;

  export = AfricasTalking;
}
