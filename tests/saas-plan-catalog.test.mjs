import test from "node:test";
import assert from "node:assert/strict";
import {SAAS_LAUNCH_STATE, DRAFT_PLAN_CATALOG, draftPlan, projectedGrossMonthlyCents} from "../saas/plan-catalog.mjs";

test("SaaS is dormant until payment, entitlement and legal reviews are complete", () => {
  assert.equal(SAAS_LAUNCH_STATE, "planning");
});
test("draft plans have unique IDs, nonnegative prices and bounded positive quotas", () => {
  const plans = Object.values(DRAFT_PLAN_CATALOG);
  assert.equal(new Set(plans.map(plan => plan.id)).size, plans.length);
  for (const plan of plans) {
    assert.equal(draftPlan(plan.id), plan);
    assert.equal(Number.isSafeInteger(plan.monthlyPriceCents), true);
    assert.ok(plan.monthlyPriceCents >= 0);
    assert.ok(Number.isSafeInteger(plan.proposedAiAnalysesPerMonth));
    assert.ok(plan.proposedAiAnalysesPerMonth > 0);
  }
  assert.equal(draftPlan("admin"), null);
  assert.equal(draftPlan("__proto__"), null);
});
test("projected gross monthly revenue uses integer cents and rejects unsafe input", () => {
  assert.equal(projectedGrossMonthlyCents({free:100,basic:80,pro:20}),119000);
  assert.equal(projectedGrossMonthlyCents({}),0);
  for (const bad of [{basic:-1},{basic:0.5},{enterprise:1},{basic:NaN},{pro:Number.MAX_SAFE_INTEGER}]) {
    assert.throws(()=>projectedGrossMonthlyCents(bad));
  }
  assert.throws(()=>projectedGrossMonthlyCents(null));
});
