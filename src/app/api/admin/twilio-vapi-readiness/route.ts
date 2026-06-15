import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN_HASH = "fc9e4315cac2b9ef7adcc0f3ac1351589a05e17e326ef0fcc37719460cb03972";

type JsonRecord = Record<string, unknown>;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isAuthorized(req: Request): boolean {
  const token = req.headers.get("x-diag-token") ?? "";
  return Boolean(token) && hash(token) === TOKEN_HASH;
}

function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

function maskPhone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***${value.slice(-4)}`;
}

function redactError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 220);
  if (typeof error === "string") return error.slice(0, 220);
  try {
    return JSON.stringify(error).slice(0, 220);
  } catch {
    return "Erreur inconnue";
  }
}

async function fetchJson(url: string, headers: HeadersInit): Promise<{ ok: boolean; status: number; data?: JsonRecord; error?: string }> {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    const text = await res.text();
    let data: JsonRecord | undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = { raw: text.slice(0, 300) };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: redactError(error) };
  }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const phoneSid = process.env.TWILIO_PHONE_NUMBER_SID;
  const vapiKey = process.env.VAPI_API_KEY;
  const vapiPhoneId = process.env.VAPI_PHONE_NUMBER_ID;

  const result: JsonRecord = {
    timestamp: new Date().toISOString(),
    envConfigured: {
      twilioAccountSid: Boolean(sid),
      twilioAuthToken: Boolean(token),
      twilioPhoneNumberSid: Boolean(phoneSid),
      vapiApiKey: Boolean(vapiKey),
      vapiPhoneNumberId: Boolean(vapiPhoneId),
    },
  };

  if (sid && token) {
    const authHeaders = { Authorization: basicAuth(sid, token) };
    const account = await fetchJson(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, authHeaders);
    const balance = await fetchJson(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, authHeaders);
    const togo = await fetchJson("https://voice.twilio.com/v1/DialingPermissions/Countries/TG", authHeaders);

    result.twilioAccount = {
      ok: account.ok,
      status: account.status,
      accountStatus: account.data?.status,
      accountType: account.data?.type,
      errorCode: account.data?.code,
      errorMessage: account.data?.message,
      requestError: account.error,
    };

    result.twilioBalance = {
      ok: balance.ok,
      status: balance.status,
      currency: balance.data?.currency,
      balancePresent: typeof balance.data?.balance === "string",
      requestError: balance.error,
    };

    result.twilioTogoPermissions = {
      ok: togo.ok,
      status: togo.status,
      isoCode: togo.data?.iso_code,
      countryName: togo.data?.name,
      lowRiskNumbersEnabled: togo.data?.low_risk_numbers_enabled,
      highRiskSpecialNumbersEnabled: togo.data?.high_risk_special_numbers_enabled,
      highRiskTollfraudNumbersEnabled: togo.data?.high_risk_tollfraud_numbers_enabled,
      errorCode: togo.data?.code,
      errorMessage: togo.data?.message,
      requestError: togo.error,
    };

    if (phoneSid) {
      const number = await fetchJson(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${phoneSid}.json`, authHeaders);
      const capabilities = number.data?.capabilities as JsonRecord | undefined;
      result.twilioNumber = {
        ok: number.ok,
        status: number.status,
        friendlyName: number.data?.friendly_name,
        phoneNumberMasked: maskPhone(number.data?.phone_number),
        numberStatus: number.data?.status,
        voice: capabilities?.voice,
        sms: capabilities?.sms,
        mms: capabilities?.mms,
        errorCode: number.data?.code,
        errorMessage: number.data?.message,
        requestError: number.error,
      };
    }
  }

  if (vapiKey) {
    const vapiNumbers = await fetchJson("https://api.vapi.ai/phone-number", {
      Authorization: `Bearer ${vapiKey}`,
    });
    const arr = Array.isArray(vapiNumbers.data) ? vapiNumbers.data : [];
    const configured = arr.find((item) => (item as JsonRecord)?.id === vapiPhoneId) as JsonRecord | undefined;
    result.vapiPhoneNumbers = {
      ok: vapiNumbers.ok,
      status: vapiNumbers.status,
      count: arr.length,
      configuredPhoneNumberPresent: Boolean(configured),
      configuredProvider: configured?.provider,
      configuredNumberMasked: maskPhone(configured?.number),
      configuredTwilioAccountSidMasked: typeof configured?.twilioAccountSid === "string" ? `${String(configured.twilioAccountSid).slice(0, 4)}***` : undefined,
      requestError: vapiNumbers.error,
    };
  }

  return NextResponse.json(result);
}
