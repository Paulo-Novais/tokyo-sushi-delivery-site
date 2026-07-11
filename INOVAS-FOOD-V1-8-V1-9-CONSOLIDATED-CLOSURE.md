# INOVAS Food V1.8 + V1.9 - Consolidated Closure

Date: 2026-07-11
Branch: `main`
Code HEAD before report commit: `1bbc7c13e5dbdf8c9b43a07774e363a1cd92603d`

## Commits Created

- `6b3ba46 chore(release): certify V1.8 local release`
- `1bbc7c1 test(release): certify V1.9 local safeguards`

## Local Release Gates

- V1.8 local gate: PASS.
- V1.9 local gate: PASS.
- Current full command: `npm.cmd run validate:release` PASS.
- Current E2E command: `npm.cmd run test:e2e` PASS, 27/27.

## Preview Deployments

| Version | URL | Deployment | Status |
|---|---|---|---|
| V1.8 | `https://tokyo-site-1o1uktvvn-paulonovais-projects.vercel.app` | `dpl_Br9AKFJW31NuV3SaghSssgXbStBS` | READY |
| V1.9 | `https://tokyo-site-mgutszj9c-paulonovais-projects.vercel.app` | `dpl_8TjME9LKzjDfEn1ANtqyCwa3HbZi` | READY |

## Remote Smoke Caveat

Preview public smoke passed 12/13 on both previews. The only failure was the Vercel Preview toolbar trying to load `https://vercel.live/_next-live/feedback/feedback.js` and being blocked by CSP. This is external to the application bundle and was not fixed by weakening CSP.

## DNS

- `Resolve-DnsName inovasfood.com.br`: NXDOMAIN.
- `Resolve-DnsName www.inovasfood.com.br`: NXDOMAIN.
- `nslookup -type=NS inovasfood.com.br 8.8.8.8`: non-existent domain.

## Safety

- No production DB changes.
- No secrets committed.
- No destructive git commands.
- No production deploy.
- No tag created.

## Remaining External Actions

1. Configure/register DNS for `inovasfood.com.br` and `www.inovasfood.com.br`.
2. Disable/allow Vercel Preview toolbar intentionally if remote smoke must be 13/13 without CSP console noise.
3. After DNS and production approval, promote a production deployment and create tags from distinct approved commits.
