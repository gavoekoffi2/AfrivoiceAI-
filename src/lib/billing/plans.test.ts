import { describe, expect, it } from "vitest";
import {
  BILLING_PLANS,
  MINUTE_PACKS,
  allocateBillableMinutes,
  calculateCallChargeFcfa,
  getBillingPlan,
} from "./plans";

describe("AfrivoxAI billing plans", () => {
  it("reduces the AI minute rate as committed capacity grows", () => {
    expect(BILLING_PLANS.essential.minuteRateFcfa).toBeGreaterThan(
      BILLING_PLANS.growth.minuteRateFcfa
    );
    expect(BILLING_PLANS.growth.minuteRateFcfa).toBeGreaterThan(
      BILLING_PLANS.business.minuteRateFcfa
    );
  });

  it("applies the selected plan rate to a normal call", () => {
    const result = calculateCallChargeFcfa({
      planCode: "growth",
      durationSeconds: 120,
      providerCostUsd: 0.1,
      exchangeRateUsdToFcfa: 620,
    });

    expect(result.usageChargeFcfa).toBe(250);
    expect(result.providerFloorFcfa).toBe(104);
    expect(result.clientChargeFcfa).toBe(250);
    expect(result.billedMinuteRateFcfa).toBe(125);
  });

  it("never bills below provider cost plus the safety margin", () => {
    const result = calculateCallChargeFcfa({
      planCode: "business",
      durationSeconds: 60,
      providerCostUsd: 0.8149,
      exchangeRateUsdToFcfa: 620,
    });

    expect(result.providerFloorFcfa).toBe(844);
    expect(result.clientChargeFcfa).toBe(844);
  });

  it("uses a 30-second minimum billable duration", () => {
    const result = calculateCallChargeFcfa({
      planCode: "essential",
      durationSeconds: 8,
      providerCostUsd: 0,
      exchangeRateUsdToFcfa: 620,
    });

    expect(result.billableMinutes).toBe(0.5);
    expect(result.clientChargeFcfa).toBe(75);
  });

  it("falls back to the essential plan for unknown codes", () => {
    expect(getBillingPlan("legacy").code).toBe("essential");
  });

  it("offers flexible packs up to one thousand bonus minutes", () => {
    expect(MINUTE_PACKS.boost30.minutes).toBe(30);
    expect(MINUTE_PACKS.boost60.minutes).toBe(60);
    expect(MINUTE_PACKS.boost1000.minutes).toBe(1_000);
    expect(MINUTE_PACKS.boost1000.priceFcfa).toBeGreaterThan(
      MINUTE_PACKS.boost60.priceFcfa
    );
  });

  it("uses monthly minutes, then bonus minutes, before overage", () => {
    expect(
      allocateBillableMinutes({
        billableMinutes: 12,
        monthlyMinutesRemaining: 5,
        bonusMinutesBalance: 4,
      })
    ).toEqual({
      monthlyMinutesUsed: 5,
      bonusMinutesUsed: 4,
      overageMinutes: 3,
    });
  });
});
