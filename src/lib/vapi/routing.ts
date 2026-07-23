const TOGO_E164 = /^\+228\d{8}$/;

export function getOutboundPhoneNumberId(destination: string): string {
  if (destination.startsWith("+228") && !TOGO_E164.test(destination)) {
    throw new Error(
      "Numéro togolais invalide : le format attendu est +228 suivi de 8 chiffres."
    );
  }

  if (TOGO_E164.test(destination)) {
    const localSimPhoneNumberId = process.env.VAPI_LOCAL_SIM_PHONE_NUMBER_ID;
    if (!localSimPhoneNumberId) {
      throw new Error(
        "VAPI_LOCAL_SIM_PHONE_NUMBER_ID non configuré : la passerelle SIM locale n'est pas encore prête."
      );
    }
    return localSimPhoneNumberId;
  }

  const defaultPhoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!defaultPhoneNumberId) {
    throw new Error("VAPI_PHONE_NUMBER_ID non configuré");
  }

  return defaultPhoneNumberId;
}
