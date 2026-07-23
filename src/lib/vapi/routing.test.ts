import { afterEach, describe, expect, it } from "vitest";
import { getOutboundPhoneNumberId } from "./routing";

const originalDefault = process.env.VAPI_PHONE_NUMBER_ID;
const originalLocalSim = process.env.VAPI_LOCAL_SIM_PHONE_NUMBER_ID;

afterEach(() => {
  process.env.VAPI_PHONE_NUMBER_ID = originalDefault;
  process.env.VAPI_LOCAL_SIM_PHONE_NUMBER_ID = originalLocalSim;
});

describe("getOutboundPhoneNumberId", () => {
  it("routes an exact Togolese E.164 destination through the local SIM", () => {
    process.env.VAPI_PHONE_NUMBER_ID = "twilio-id";
    process.env.VAPI_LOCAL_SIM_PHONE_NUMBER_ID = "local-sim-id";

    expect(getOutboundPhoneNumberId("+22890123456")).toBe("local-sim-id");
  });

  it("never falls back to Twilio when the local SIM route is missing", () => {
    process.env.VAPI_PHONE_NUMBER_ID = "twilio-id";
    delete process.env.VAPI_LOCAL_SIM_PHONE_NUMBER_ID;

    expect(() => getOutboundPhoneNumberId("+22890123456")).toThrow(
      "VAPI_LOCAL_SIM_PHONE_NUMBER_ID"
    );
  });

  it("keeps non-Togolese calls on the configured default provider", () => {
    process.env.VAPI_PHONE_NUMBER_ID = "twilio-id";
    process.env.VAPI_LOCAL_SIM_PHONE_NUMBER_ID = "local-sim-id";

    expect(getOutboundPhoneNumberId("+15145550123")).toBe("twilio-id");
  });

  it("rejects malformed destinations carrying the Togo prefix", () => {
    process.env.VAPI_PHONE_NUMBER_ID = "twilio-id";
    process.env.VAPI_LOCAL_SIM_PHONE_NUMBER_ID = "local-sim-id";

    expect(() => getOutboundPhoneNumberId("+228123")).toThrow(
      "Numéro togolais invalide"
    );
  });
});
