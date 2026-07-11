import { TelephonyProvider } from "../types";
import { AfricasTalkingProvider } from "./africas-talking";
import { TwilioTelephonyStub } from "./twilio-stub";

/**
 * Sélection du provider télécom : `TELEPHONY_PROVIDER` =
 * "africas-talking" (défaut) | "twilio" (stub documenté, non déployé).
 */
export function createTelephonyProvider(): TelephonyProvider {
  const name = (process.env.TELEPHONY_PROVIDER ?? "africas-talking").toLowerCase();
  switch (name) {
    case "twilio":
      return new TwilioTelephonyStub();
    case "africas-talking":
    default:
      return new AfricasTalkingProvider();
  }
}

/** Numéro sortant configuré pour l'organisation/plateforme. */
export function getOutboundPhoneNumber(): string | undefined {
  return (
    process.env.AFRICASTALKING_PHONE_NUMBER ??
    process.env.TELEPHONY_OUTBOUND_NUMBER
  )?.trim();
}
