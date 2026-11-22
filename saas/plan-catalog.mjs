/**
 * Draft Stonksi SaaS catalog (UI/planning only).
 *
 * IMPORTANT:
 * - This module does NOT grant access or enforce quotas.
 * - All paid entitlements must eventually be verified server-side against
 *   a subscription state trusted from signed payment-provider webhooks.
 * - Prices/limits are proposals; no checkout is enabled by this file.
 */
export const SAAS_LAUNCH_STATE = "planning";

export const DRAFT_PLAN_CATALOG = Object.freeze({
  free: Object.freeze({
    id: "free",
    title: "Stonksi Free",
    monthlyPriceCents: 0,
    proposedAiAnalysesPerMonth: 1
  }),
  basic: Object.freeze({
    id: "basic",
    title: "Stonksi Basic",
    monthlyPriceCents: 990,
    proposedAiAnalysesPerMonth: 10
  }),
  pro: Object.freeze({
    id: "pro",
    title: "Stonksi Pro",
    monthlyPriceCents: 1990,
    proposedAiAnalysesPerMonth: 40
  })
});

export function draftPlan(id) {
  if (typeof id !== "string" || !Object.hasOwn(DRAFT_PLAN_CATALOG, id)) {
    return null;
  }
  return DRAFT_PLAN_CATALOG[id];
}

export function projectedGrossMonthlyCents(subscribersByPlan) {
  if (subscribersByPlan === null || typeof subscribersByPlan !== "object" ||
      Array.isArray(subscribersByPlan)) {
    throw new TypeError("Expected plan-to-subscriber-count object");
  }
  let total = 0;
  for (const [id, count] of Object.entries(subscribersByPlan)) {
    const plan = draftPlan(id);
    if (!plan || !Number.isSafeInteger(count) || count < 0) {
      throw new RangeError("Unknown plan or invalid subscriber count");
    }
    const subtotal = plan.monthlyPriceCents * count;
    if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(total + subtotal)) {
      throw new RangeError("Projected gross exceeds supported integer range");
    }
    total += subtotal;
  }
  return total;
}
