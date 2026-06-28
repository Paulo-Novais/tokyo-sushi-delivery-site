# INovas Food - DevOps Strategy

Data: 2026-06-25

Escopo: estrategia DevOps/Cloud futura. Este documento nao altera infraestrutura, nao instala ferramentas e nao faz deploy.

## Objetivo

Preparar a INovas Food para operar como SaaS profissional, com releases previsiveis, ambientes separados, seguranca de secrets, observabilidade, backup e resposta a incidentes.

## Estado Atual

Base atual:

- Site publico estatico.
- APIs serverless em `/api`.
- Gestor em `/admin`.
- Painel Master em `/admin/master.html`.
- Vercel como caminho de deploy.
- Neon/Postgres via `DATABASE_URL`.
- Arquivo local em desenvolvimento.
- Persistencia desabilitada em producao sem banco.
- Tokyo Sushi como cliente modelo.
- Sem multi-restaurante real.

## Ambientes Recomendados

| Ambiente | Objetivo | Dados |
| --- | --- | --- |
| Local | desenvolvimento e validacoes | locais/sinteticos |
| Preview | validar PR/release sem dominio real | sinteticos |
| Staging | ensaio proximo de producao | anonimizados/sinteticos |
| Production | operacao real | reais |

Regras:

- Secrets separados por ambiente.
- Banco separado por ambiente.
- Nunca usar dados reais em local/preview sem anonimizar.
- Preview nao altera dominio real.

## Infraestrutura Alvo

Camadas:

- DNS/CDN/WAF: Cloudflare futuro.
- Hosting/serverless: Vercel.
- Banco: Neon/Postgres.
- Storage de uploads: provider dedicado futuro.
- Logs/metricas/traces: stack observability.
- Alertas: ferramenta externa e canal interno.
- CI/CD: GitHub Actions + Vercel.

## Seguranca Operacional

Obrigatorio:

- `.env` fora do Git.
- Secret scanning.
- Minimo privilegio.
- Rotacao de secrets.
- Separacao de contas/projetos por ambiente.
- MFA em GitHub/Vercel/Cloudflare/banco.
- Auditoria de mudancas.

## Configuracao

Principios:

- Config nao sensivel versionada.
- Secret em cofre/env.
- Toda mudanca de config critica exige diff/review.
- Feature flags auditadas.

## Deploy

Regras:

- Deploy apenas com pipeline verde.
- Preview antes de producao.
- Smoke test apos deploy.
- Rollback documentado.
- Tags de versao.
- Release notes.

## Operacao 24h

Para operar 24h, a plataforma precisa:

- Uptime monitoring externo.
- Alertas P1/P2.
- Runbooks.
- Escala de plantao.
- Backup testado.
- Restore testado.
- Observabilidade por rota.
- Logs sem secrets.
- Status page.

Hoje, a plataforma ainda nao esta pronta para compromisso 24x7 formal.

## Ferramentas Futuras

- GitHub Actions: CI/CD.
- Vercel: preview/deploy/logs.
- Cloudflare: DNS, WAF, CDN.
- Grafana: dashboards.
- Prometheus ou backend compativel: metricas.
- OpenTelemetry: padrao de instrumentacao.
- Sentry: erros e performance.
- UptimeRobot: uptime/status externo.

Links oficiais:

- GitHub Actions: https://docs.github.com/en/actions
- Vercel: https://vercel.com/docs
- Cloudflare: https://developers.cloudflare.com/fundamentals/
- Grafana: https://grafana.com/docs/grafana/latest/
- Prometheus: https://prometheus.io/docs/introduction/overview/
- OpenTelemetry: https://opentelemetry.io/docs/what-is-opentelemetry/
- Sentry: https://docs.sentry.io/
- UptimeRobot: https://uptimerobot.com/

## Roadmap DevOps

1. Consolidar checklist manual.
2. Automatizar checks estaticos.
3. Automatizar validacoes seguras.
4. Criar preview smoke.
5. Criar secret scanning.
6. Criar monitor uptime externo.
7. Criar dashboard operacional.
8. Criar backup/restore testado.
9. Criar incident response.
10. Criar SLOs por plano.
