# INovas Food - CI/CD Strategy

Data: 2026-06-25

Escopo: pipeline ideal futuro. Este documento nao cria workflow, nao altera deploy e nao instala ferramentas.

## Objetivo

Reduzir risco de release e permitir que a INovas Food evolua com previsibilidade, mantendo qualidade, seguranca e rollback.

## Pipeline Ideal

```text
Commit
  -> Lint
  -> Testes
  -> Build
  -> Security checks
  -> Preview/Homologacao
  -> Smoke test
  -> Aprovacao
  -> Deploy producao
  -> Smoke test producao
  -> Monitoramento pos-release
```

## Estagios

### 1. Commit

Regras:

- Commits pequenos e tematicos.
- Separar docs, codigo, assets e evidencias.
- Nunca commitar `.env`, `.tmp`, `.codex-tools`, `.data`, secrets ou outputs locais.

### 2. Lint

Futuro:

- ESLint ou equivalente para JS.
- Stylelint opcional para CSS.
- Markdown lint opcional para docs.

Inicialmente nao bloquear por estilo antigo; bloquear apenas erros novos de alto risco.

### 3. Testes

Suite segura atual:

- `validate:business-hours`
- `validate:admin-local`
- `validate:permissions-local`
- `validate:master-panel-local`
- `validate:platform-integration-local`
- `validate:site-layouts-local`
- `validate:domains-local`
- `validate:plans-contracts-local`
- `validate:stage-3-ui-local`
- `validate:whatsapp`

Regras:

- Scripts destrutivos continuam bloqueados por padrao.
- Testes com dados reais nunca rodam em CI.
- Massa sintetica isolada.

### 4. Build

Validar:

- Sintaxe JS/CJS/MJS.
- JSON parse.
- Python compile.
- Vercel build futuro.
- Tamanho de bundles/assets.

### 5. Security Checks

Obrigatorio futuro:

- Secret scanning.
- Dependabot ou equivalente.
- Checagem de env files.
- `git diff --check`.
- Lista de arquivos proibidos.

### 6. Homologacao/Preview

Regras:

- Preview sem dados reais.
- Dominio real nao alterado automaticamente.
- Variaveis de preview separadas.
- Smoke test publico/admin.
- Validar rewrites e headers.

### 7. Deploy

Regras:

- Deploy de producao apenas apos validacoes verdes.
- Janela de release definida.
- Rollback conhecido.
- Tag de versao.
- Release notes.

### 8. Smoke Test Pos-Deploy

Validar:

- Home.
- Cardapio.
- API catalog.
- Delivery settings.
- Admin login.
- Criacao de pedido sintetico somente se ambiente permitir.
- Master para usuario Master.

### 9. Monitoramento Pos-Release

Durante 30 a 60 minutos:

- Erro 5xx.
- Latencia.
- Falhas de pedido.
- Falhas de login.
- Logs de WhatsApp/Maps.
- Reports de frontend.

## Branching

Modelo recomendado:

- `main`: producao.
- `develop` ou branch de integracao: opcional se time crescer.
- `feature/*`: trabalho de modulo.
- `fix/*`: correcao.
- `hotfix/*`: producao urgente.
- `release/*`: estabilizacao.

Para time pequeno, trunk-based com PRs curtos pode ser melhor.

## Gates de Release

Nao liberar se:

- Teste seguro falhou.
- Secret detectado.
- `.tmp` ou `.codex-tools` rastreados.
- `git diff --check` falhou.
- API de pedido falhou no smoke.
- Preview nao foi validado.
- Mudanca de banco sem backup/rollback.
- Mudanca de dominio sem aprovacao.

## Ambientes

| Ambiente | Uso | Dados |
| --- | --- | --- |
| Local | Desenvolvimento | Sinteticos/local |
| Preview | Homologacao por PR/release | Sinteticos |
| Staging futuro | Ensaio de producao | Dados anonimizados |
| Production | Cliente real | Dados reais |

## Ferramentas Futuras

- GitHub Actions para pipeline: https://docs.github.com/en/actions
- Vercel para preview/deploy: https://vercel.com/docs
- Sentry para erro pos-release: https://docs.sentry.io/
- UptimeRobot para smoke externo/status: https://uptimerobot.com/

## Roadmap CI/CD

1. Documentar checks manuais.
2. Criar workflow de docs/checks estaticos.
3. Adicionar testes seguros.
4. Adicionar secret scanning.
5. Adicionar preview smoke.
6. Adicionar release tags.
7. Adicionar rollback runbook.
8. Adicionar dashboards pos-release.
