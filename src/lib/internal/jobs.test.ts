import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isInternalJobRequest } from "./jobs";

const TOKEN = "internal-token-abcdef123456"; // >= 16 caractères

function makeReq(token?: string): Request {
  return new Request("http://localhost/api/calls/initiate", {
    method: "POST",
    headers: token ? { "x-internal-job-token": token } : {},
  });
}

describe("isInternalJobRequest (token interne dédié, fail-closed)", () => {
  const original = process.env.INTERNAL_JOB_TOKEN;

  beforeEach(() => {
    delete process.env.INTERNAL_JOB_TOKEN;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_JOB_TOKEN;
    else process.env.INTERNAL_JOB_TOKEN = original;
  });

  it("refuse si le token n'est pas configuré", () => {
    expect(isInternalJobRequest(makeReq(TOKEN))).toBe(false);
  });

  it("refuse un token trop court (traité comme non configuré)", () => {
    process.env.INTERNAL_JOB_TOKEN = "court";
    expect(isInternalJobRequest(makeReq("court"))).toBe(false);
  });

  it("accepte le bon token", () => {
    process.env.INTERNAL_JOB_TOKEN = TOKEN;
    expect(isInternalJobRequest(makeReq(TOKEN))).toBe(true);
  });

  it("refuse un mauvais token", () => {
    process.env.INTERNAL_JOB_TOKEN = TOKEN;
    expect(isInternalJobRequest(makeReq("mauvais-token-000000"))).toBe(false);
  });

  it("refuse l'absence de header", () => {
    process.env.INTERNAL_JOB_TOKEN = TOKEN;
    expect(isInternalJobRequest(makeReq())).toBe(false);
  });
});
