import { afterEach, describe, expect, it } from "vitest";
import {
  getOutboundPhoneNumberId,
  resolvePhoneLineVapiId,
} from "./routing";

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

describe("resolvePhoneLineVapiId", () => {
  it("uses the verified organization line selected by the campaign", () => {
    expect(
      resolvePhoneLineVapiId(
        {
          connectionType: "sip_trunk",
          status: "active",
          verificationStatus: "verified",
          vapiPhoneNumberId: "customer-line-id",
        },
        "+151****0123"
      )
    ).toBe("customer-line-id");
  });

  it("rejects a line that is not active and verified", () => {
    expect(() =>
      resolvePhoneLineVapiId(
        {
          connectionType: "sim_gateway",
          status: "pending",
          verificationStatus: "pending",
          vapiPhoneNumberId: null,
        },
        "+228" + "12" + "345678"
      )
    ).toThrow("n’est pas encore active et vérifiée");
  });

  it("keeps a managed platform line on the environment routing policy", () => {
    process.env.VAPI_PHONE_NUMBER_ID = "twilio-id";
    process.env.VAPI_LOCAL_SIM_PHONE_NUMBER_ID = "local-sim-id";

    expect(
      resolvePhoneLineVapiId(
        {
          connectionType: "platform",
          status: "active",
          verificationStatus: "verified",
          vapiPhoneNumberId: null,
        },
        "+228" + "12" + "345678"
      )
    ).toBe("local-sim-id");
  });
});
