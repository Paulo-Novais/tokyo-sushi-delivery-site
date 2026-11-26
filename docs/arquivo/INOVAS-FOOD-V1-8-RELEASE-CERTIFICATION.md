# INOVAS Food V1.8 - Release Certification

Date: 2026-07-11
Certified commit: `6b3ba46`
Certification status: **LOCAL PASS**

## Certification Matrix

| Area | Result |
|---|---|
| Version alignment `1.8.0` | PASS |
| Sanitized `.env.example` | PASS |
| Google Maps tracked fallback removed | PASS |
| Vercel security headers | PASS |
| Admin Kanban desktop layout | PASS |
| Master error contract `master_access_required` | PASS |
| Local Playwright web server | PASS |
| E2E public/admin smoke | PASS |
| Full local release gate | PASS |
| Vercel Preview creation | PASS |
| Official INOVAS DNS | BLOCKED EXTERNAL: NXDOMAIN |

## Commands Passed

- `npm.cmd run validate:release`
- `npm.cmd run validate:release:fast`
- `npm.cmd run test:e2e`
- `npm.cmd audit --omit=dev`
- `npx.cmd --yes vercel --yes`
- `npx.cmd --yes vercel inspect tokyo-site-1o1uktvvn-paulonovais-projects.vercel.app`

## Certification Decision

V1.8 is certified as a local release baseline and has a READY Vercel Preview. Public DNS for `inovasfood.com.br` remains outside the repository and must be corrected before official domain certification.
