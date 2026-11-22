# Stonksi SaaS – staged rollout and security gates

Status: **planning** (2026-11-22). This branch must not create subscriptions, charge users, enable paid access, or change live AI quotas.

## What is already present (read-only review)
- Public GitHub Pages PWA `NOxi-cloud/stonksi-pages`, Supabase authentication and user-bound RLS on research reports, watchlists, stock sync and investment theses.
- AI research Edge Function `stock-reseach` authenticates bearer token with `auth.getUser` even though its deployment has `verify_jwt=false`. Audit each endpoint independently before changing verification.
- Current AI settings cap at 5 requests per user per day and 10 globally per day. **Proposed monthly plan limits must not be treated as active** or bypass these existing caps.
- Security advisors: five externally callable SECURITY DEFINER RPCs need function-level permission audits; 10 RLS tables without policies may be intentional private service-only data; leaked-password protection disabled.
- Existing parser tests and `secret-guard` workflow.
- 2026-11-10 work queue flags source verification, ESEF company facts, price history and valuations as unfinished. Avoid promising verified target prices as a paid feature yet.

## Proposed consumer prices (gross, subject to review)
- Free €0/mo, draft 1 AI analysis/mo.
- Basic €9.90/mo, draft 10 AI analyses/mo.
- Pro €19.90/mo, draft 40 AI analyses/mo.
All figures in `saas/plan-catalog.mjs` are **non-authoritative presentation data**, not entitlements, quotas, subscription status, or actual Stripe Price IDs.

## Required gates before enabling subscriptions
1. **Product/data/legal:** audit source data redistribution rights and financial analysis/recommendation regulation; confirm VAT, consumer terms, refunds, privacy and account deletion.
2. **Security:** inspect five SECURITY DEFINER functions and their auth checks; use least privilege without breaking existing callers; verify Edge Function authentication, CORS, rate limits and secret isolation. Never put payment secrets in GitHub Pages JS.
3. **Server-owned subscription model:** add migration-reviewed server-only `billing_customers`, `subscriptions`, `billing_events` and entitlement computation. Restrict all writes to trusted server-side paths. Users cannot self-upgrade via RLS, client metadata or JWT editable fields.
4. **Stripe integration:** server-generated checkout sessions with authenticated user binding; Stripe-provided price IDs stored server-side; verified raw-body webhook signatures; event deduplication; out-of-order event reconciliation using provider state; subscription cancellation, trial, failed payments and grace periods; no client-side payment truth. Test mode only before launch.
5. **Atomic usage:** server-side quotas that combine paid entitlement, monthly reset, per-user request costs and the existing global safety caps; explicit user action for all AI analysis. No AI cron loops. Failed calls and retries accounted for.
6. **Quality:** confidence/source freshness gates, issuer LEI/ISIN validation, corporate actions, reproducible pricing inputs. No paid verified price target unless source and calculation are valid.
7. **Tests:** cross-account isolation; forged and duplicate webhook; revoked subscriptions; race conditions; free tier; billing outage fail-closed; safe cancellation; zero real charges. Run CI before merging.
8. **Launch:** private pilot, cost and conversion metrics, support and legal documentation, only then reviewed production rollout.

## Rollback
Keep live Free access as currently configured. New billing features must be feature-flagged **off by default**. Revert SaaS branch without touching live auth, existing AI request guards or market data. Existing subscribers must be handled carefully once real billing eventually exists.

## Non-goals
No automatic trades, background AI analysis, persistent external content scraping, or hardcoding secret keys. No price or entitlement derived from UI/client state.
