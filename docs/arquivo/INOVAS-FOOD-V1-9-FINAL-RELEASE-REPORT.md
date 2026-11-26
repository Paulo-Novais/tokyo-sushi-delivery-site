# INOVAS Food V1.9 - Final Release Report

Date: 2026-07-11
Branch: `main`
V1.9 commit: `1bbc7c1 test(release): certify V1.9 local safeguards`
Decision: **GO for local V1.9 safeguards**

## Scope Delivered

- Version bumped to `1.9.0`.
- V1.9 E2E tests added for auth, security headers, RBAC, tenant isolation and admin responsiveness.
- Local validation server now runs tenant pilot mode by default for E2E.
- Public footer no longer depends on reveal-on-scroll for visibility.
- `validate:release` now syntax-checks the V1.9 specs and `script.js`.

## Evidence

- `npm.cmd run test:e2e`: PASS, 27/27 tests.
- `npm.cmd run validate:release`: PASS.
- `npm.cmd run validate:mobile-public-local`: PASS, 74 scenarios.
- `npm.cmd audit --omit=dev`: PASS, 0 vulnerabilities.
- Secret scan in `validate:release`: PASS.

## Vercel Preview

- Preview URL: `https://tokyo-site-mgutszj9c-paulonovais-projects.vercel.app`
- Deployment id: `dpl_8TjME9LKzjDfEn1ANtqyCwa3HbZi`
- Inspect URL: `https://vercel.com/paulonovais-projects/tokyo-site/8TjME9LKzjDfEn1ANtqyCwa3HbZi`
- Vercel status: READY, target preview.

Remote public smoke: 12/13 passed. The single failure was the Vercel Preview toolbar script `https://vercel.live/_next-live/feedback/feedback.js` being blocked by CSP. Local product gates are green and the CSP was not weakened for the Preview overlay.

## External Blockers

- `inovasfood.com.br`: NXDOMAIN.
- `www.inovasfood.com.br`: NXDOMAIN.

## Not Done

- No production deployment.
- No tag.
- No force push.
- No production database mutation.
