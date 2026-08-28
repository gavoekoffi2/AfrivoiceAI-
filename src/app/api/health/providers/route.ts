import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ProviderCheck = {
  configured: boolean;
  reachable?: boolean;
  status?: number;
  count?: number;
  configuredPhoneNumberPresent?: boolean;
  error?: string;
};

function redactError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 180);
  if (typeof error === "string") return error.slice(0, 180);
  return "Erreur inconnue";
}

async function checkVapi(): Promise<{
  api: ProviderCheck;
  phoneNumbers: ProviderCheck;
}> {
  const apiKey = process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!apiKey) {
    return {
      api: { configured: false, reachable: false, error: "VAPI_API_KEY manquant" },
      phoneNumbers: {
        configured: Boolean(phoneNumberId),
        reachable: false,
        configuredPhoneNumberPresent: false,
        error: "VAPI_API_KEY manquant",
      },
    };
  }

  const headers = { Authorization: `Bearer ${apiKey}` };
  const api: ProviderCheck = { configured: true };
  const phoneNumbers: ProviderCheck = { configured: Boolean(phoneNumberId) };

  try {
    const response = await fetch("https://api.vapi.ai/assistant", {
      headers,
      cache: "no-store",
    });
    api.status = response.status;
    api.reachable = response.ok;
    if (response.ok) {
      const data = await response.json();
      api.count = Array.isArray(data) ? data.length : undefined;
    } else {
      api.error = `Vapi assistant check HTTP ${response.status}`;
    }
  } catch (error) {
    api.reachable = false;
    api.error = redactError(error);
  }

  try {
    const response = await fetch("https://api.vapi.ai/phone-number", {
      headers,
      cache: "no-store",
    });
    phoneNumbers.status = response.status;
    phoneNumbers.reachable = response.ok;
    if (response.ok) {
      const data = await response.json();
      phoneNumbers.count = Array.isArray(data) ? data.length : undefined;
      phoneNumbers.configuredPhoneNumberPresent = Array.isArray(data)
        ? data.some((phoneNumber) => phoneNumber?.id === phoneNumberId)
        : false;
    } else {
      phoneNumbers.configuredPhoneNumberPresent = false;
      phoneNumbers.error = `Vapi phone-number check HTTP ${response.status}`;
    }
  } catch (error) {
    phoneNumbers.reachable = false;
    phoneNumbers.configuredPhoneNumberPresent = false;
    phoneNumbers.error = redactError(error);
  }

  return { api, phoneNumbers };
}

export async function GET() {
  const vapi = await checkVapi();
  const database = {
    configured: Boolean(process.env.DATABASE_URL),
  };

  const billing = {
    exchangeRateConfigured: Boolean(process.env.EXCHANGE_RATE_USD_TO_FCFA),
    marginConfigured: Boolean(process.env.PROFIT_MARGIN_PERCENTAGE),
  };

  const ok =
    vapi.api.reachable === true &&
    vapi.phoneNumbers.reachable === true &&
    vapi.phoneNumbers.configuredPhoneNumberPresent === true &&
    database.configured;

  return NextResponse.json({
    status: ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    providers: { vapi, database, billing },
  });
}
