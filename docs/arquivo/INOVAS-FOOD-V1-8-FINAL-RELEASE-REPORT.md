# INOVAS Food V1.8 - Final Release Report

Date: 2026-07-11
Branch: `main`
V1.8 commit: `6b3ba46 chore(release): certify V1.8 local release`
Decision: **GO for local release baseline**

## Result

V1.8 was closed locally with a real Playwright harness, local validation server, release gate, security header hardening, version alignment and responsive fixes.

## Evidence

- `npm.cmd run validate:release`: PASS on V1.8 before commit.
- `npm.cmd run test:e2e`: PASS, 19/19 tests.
- `npm.cmd audit --omit=dev`: PASS, 0 vulnerabilities.
- Secret scan in `validate:release`: PASS, no high-confidence tracked secret hits.
- JSON/syntax checks: PASS.
- `git diff --check`: PASS; only Windows LF/CRLF warnings.

## Vercel Preview

- Preview URL: `https://tokyo-site-1o1uktvvn-paulonovais-projects.vercel.app`
- Deployment id: `dpl_Br9AKFJW31NuV3SaghSssgXbStBS`
- Inspect URL: `https://vercel.com/paulonovais-projects/tokyo-site/Br9AKFJW31NuV3SaghSssgXbStBS`
- Vercel status: READY, target preview.

Remote public smoke: 12/13 passed. The single failure was the Vercel Preview toolbar script `https://vercel.live/_next-live/feedback/feedback.js` being blocked by the product CSP. This was classified as a Preview overlay artifact, not an application regression.

## External Blockers

- `inovasfood.com.br`: NXDOMAIN.
- `www.inovasfood.com.br`: NXDOMAIN.
- `nslookup -type=NS inovasfood.com.br 8.8.8.8`: non-existent domain.

## Notes

- No production database changes were made.
- No secrets were printed or committed.
- No production deployment was promoted.
