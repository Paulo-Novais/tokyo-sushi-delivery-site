# INovas Food - V1 Release Report

Data: 2026-06-28

Versao: 1.0.0

Status: Production Ready (Pilot)

## Objetivo

Fechar a V1.0 com multi-restaurante real em modo piloto, mantendo Tokyo Sushi/default funcionando em `INOVAS_TENANT_MODE=default_only`.

## Modo Seguro

- `default_only`: modo padrao. Todos os hosts continuam resolvendo para Tokyo Sushi/default, preservando producao atual.
- `pilot`: habilita resolucao real por dominio/subdominio cadastrado e ativo, com fallback seguro para default quando o host nao esta cadastrado.
- `strict`: habilita resolucao real e nega host sem dominio cadastrado.

Nenhum tenant real e ativado em producao sem mudar explicitamente `INOVAS_TENANT_MODE`.

## Implementado

- Cadastro real de restaurante via API Master segura.
- Criacao de `tenantId`, `restaurantId` e `restaurantKey` por restaurante.
- Criacao de admin OWNER do restaurante no onboarding.
- Onboarding inicial com nome, slug, dominio/subdominio, WhatsApp, endereco, horario, entrega, pagamentos e plano inicial.
- Status de assinatura: `TRIAL`, `ACTIVE`, `EXPIRED`, `BLOCKED`, `CANCELED`.
- Bloqueio por plano/feature e por assinatura inativa.
- Login admin validando compatibilidade entre usuario, tenant e dominio.
- Resolucao real host -> restaurante em modo `pilot`/`strict`.
- `validate:v1-release-local`.

## Fluxo de Onboarding

Endpoint interno seguro:

- `POST /api/admin/master/onboard-restaurant`
- Requer usuario MASTER.
- Cria restaurante piloto, dominio, assinatura, configuracoes iniciais e usuario OWNER.

Endpoint de assinatura:

- `POST /api/admin/master/subscription`
- Requer usuario MASTER.
- Atualiza status/plano/recursos da assinatura do restaurante.

## Garantias Validadas

- Novo restaurante cadastrado com tenant fisico proprio.
- Admin do restaurante acessa apenas pelo dominio do tenant.
- Admin do restaurante nao autentica no tenant default.
- Pedido publico criado pelo dominio do tenant fica isolado.
- Dashboard/listagem admin do tenant lista somente dados do tenant.
- Tokyo Sushi/default nao enxerga pedido do tenant piloto.
- Plano START bloqueia financeiro.
- Assinatura EXPIRED bloqueia operacao admin.
- `default_only` continua resolvendo dominio piloto para default.

## Arquivos Principais

- `lib/master-platform-store.cjs`
- `lib/tenant-context.cjs`
- `lib/user-permissions.cjs`
- `lib/admin-api.cjs`
- `scripts/validate-v1-release-local.mjs`
- `package.json`

## Evidencias

Comando novo:

- `npm.cmd run validate:v1-release-local`

Validacoes existentes seguem na bateria final:

- `validate:security-guardian-local`
- `validate:tenant-context-local`
- `validate:tenant-isolation-local`
- `validate:tenant-persistence-local`
- `validate:permissions-local`
- `validate:plans-contracts-local`
- `validate:admin-local`
- `validate:platform-integration-local`

## Status

V1.0 pronta para piloto comercial controlado de restaurantes reais, sem quebrar Tokyo Sushi/default e sem ativacao involuntaria em producao.

## Status Final da Finalizacao Definitiva

Pronto para piloto:

- Cadastro real de restaurante/tenant por MASTER.
- Admin OWNER criado e vinculado ao tenant.
- Dominio/subdominio resolvendo para o tenant em `pilot`.
- `default_only` preservado como padrao seguro.
- Planos `START`, `BUSINESS` e `PRO`; `PREMIUM` preservado como alias legado completo.
- Assinaturas `TRIAL`, `ACTIVE`, `EXPIRED`, `BLOCKED` e `CANCELED`.
- Exportacao minima por tenant via `/api/admin/exports`.
- Jornada piloto validada de onboarding ate pedido, dashboard, estoque, exportacao, bloqueio por plano, bloqueio por assinatura e auditoria.

Pendencias nao criticas:

- Gateway de pagamento real segue fora da V1.
- Exportacao V1 usa JSON minimo; CSV/backend dedicado pode ficar para evolucao.
- Perfis nomeados operacionais sao modelados por `CUSTOM` + permissoes, sem entidade propria de cargo.

Riscos conhecidos e mitigacoes:

- Ativacao acidental mitigada por `default_only` como padrao.
- Tenant desconhecido em `pilot` cai no default; para negar host desconhecido existe `strict`, reservado para cutover controlado.
- Mudanca de plano agora recalcula recursos liberados para impedir permissao comercial antiga.
- Onboarding agora valida plano, assinatura, WhatsApp e e-mail do admin.

Comandos executados:

- `npm.cmd run validate:v1-security-hardening-local`
- `npm.cmd run validate:v1-onboarding-local`
- `npm.cmd run validate:v1-subscription-local`
- `npm.cmd run validate:v1-rbac-local`
- `npm.cmd run validate:v1-audit-local`
- `npm.cmd run validate:v1-export-local`
- `npm.cmd run validate:v1-pilot-journey-local`
- `npm.cmd run validate:v1-final-local`
- `npm.cmd run validate:v1-release-local`
- `npm.cmd run validate:tenant-context-local`
- `npm.cmd run validate:tenant-isolation-local`
- `npm.cmd run validate:tenant-persistence-local`
- `npm.cmd run validate:security-guardian-local`
- `npm.cmd run validate:permissions-local`
- `npm.cmd run validate:plans-contracts-local`
- `npm.cmd run validate:platform-integration-local`
- `npm.cmd run validate:admin-local`
- `npm.cmd run validate:site-layouts-local`
- `npm.cmd run validate:mobile-public-local`
- `npm.cmd run validate:business-hours`

Resultado:

- Todas as validacoes passaram.
- `node --check` passou nos arquivos tocados.
- `package.json` permaneceu valido.
- `git diff --check` passou com avisos esperados de LF/CRLF no Windows.

## Marcacao Oficial

A V1.0 esta encerrada como Release Candidate de producao:

- Versao: `1.0.0`
- Status: `Production Ready (Pilot)`
- Deploy automatico: nao executado
- Producao: nao alterada
- Proximas implementacoes: devem pertencer a V2.0
