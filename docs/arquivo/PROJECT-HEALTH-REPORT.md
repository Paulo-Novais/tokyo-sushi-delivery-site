# INOVAS Food - Project Health Report V1.5

Data: 2026-07-08

## Resumo Executivo

A plataforma esta funcionalmente bem protegida por validacoes locais e ja possui separacao importante em `lib/`, APIs serverless, tenant context, RBAC, security guardian e configuracao de branding. O maior risco para V2/V3 nao e ausencia de features, mas concentracao de codigo em arquivos monoliticos, duplicacao de assets/CSS e falta de boundaries menores entre render, estado, dominio e persistencia.

Nesta sprint foram aplicados apenas ajustes internos seguros:

- Configuracao central de dominio em `lib/app-branding.cjs`.
- Uso dessa configuracao pelo fallback de dominio do painel Master.
- Relatorios de arquitetura e saude.

Nao foram alterados layout, UX, Design System, APIs publicas, autenticacao, permissoes, banco ou regras de negocio.

## Arquitetura

Pontos fortes:

- APIs externas sao finas e delegam para `lib/`.
- `tenant-context.cjs` prepara a base multi-tenant.
- `user-permissions.cjs` concentra RBAC e perfis.
- `security-guardian.cjs` e `request-guard.cjs` reduzem risco de abuso.
- `site.config.json`, `site-config.js` e `app-branding.cjs` ja formam uma base de configuracao.
- Validadores locais cobrem tenants, permissoes, plataforma, site, mobile e release final.

Pontos fracos:

- `admin/admin.js` e `script.js` sao bundles monoliticos e dificeis de evoluir com seguranca.
- Stores combinam schema, leitura/escrita, normalizacao e payload em um unico arquivo.
- `lib/admin-api.cjs` e um facade grande com muitos dominios acoplados.
- Validadores repetem muito boilerplate local.
- CSS legado ainda compete com a camada oficial de tokens.

## Qualidade

Indicadores:

- 359 arquivos versionados.
- 115.332 linhas de texto estimadas.
- 76 arquivos JS/CJS/MJS.
- 5 arquivos CSS com 27.089 linhas.
- 84 documentos Markdown.
- 170 assets versionados.

Qualidade atual:

- Boa cobertura por scripts de validacao.
- Boa disciplina de stores isolados por dominio.
- Risco de regressao alto em arquivos grandes por falta de modularidade.
- Higiene do workspace local fraca por volume de `_tmp*`, `.tmp/`, `NUL` e evidencias antigas ignoradas.

## Complexidade

Complexidade alta:

- `admin/admin.js`: 15.365 linhas; inicializacao, navegacao, render, estado e handlers.
- `script.js`: 13.471 linhas; catalogo, carrinho, auth, entrega e paginas publicas.
- `admin/admin.css`: 13.309 linhas; estilos legados e especificos.
- `styles.css`: 8.155 linhas; site publico e modulos acumulados.
- `lib/order-store.cjs`: 3.516 linhas; schema, persistencia, dashboard e auditoria.

Complexidade media:

- `lib/master-platform-store.cjs`: crescimento natural de SaaS, planos, dominios e onboarding.
- `lib/admin-api.cjs`: roteador admin com muitos grupos.
- `lib/catalog-store.cjs`: catalogo, promocoes, base extraida de `script.js` e persistence.
- `admin/master.js`: render e handlers do painel Master.

Complexidade baixa:

- Adaptadores `api/*`.
- Helpers dedicados como `http.cjs`, `operational-day.cjs`, `business-hours.cjs`.
- Validators unitarios menores.

## Debitos Tecnicos

- Front publico e admin precisam ser quebrados por dominio antes de V2.
- Render por template string exige cuidado constante com escape.
- CSS hardcoded ainda e amplo fora de `admin/design-system.css`.
- Assets duplicados aumentam peso do repositorio e custo de deploy.
- Artefatos ignorados locais poluem auditorias e aumentam risco operacional.
- Validadores locais poderiam compartilhar infraestrutura comum.
- Configuracao de dominio ainda aparece em docs e scripts de validacao porque eles fixam o dominio atual por contrato V1.
- `orders-production-restore.css` deve ser revisado como arquivo historico/restore, nao como fonte ativa de Design System.

## Riscos

| Risco | Severidade | Motivo | Caminho seguro |
| --- | --- | --- | --- |
| Regressao no admin ao mexer em `admin/admin.js` | Alta | Arquivo monolitico e event handlers globais | Extrair por modulo com validacao visual por etapa |
| Regressao no site publico ao mexer em `script.js` | Alta | Muitos fluxos de cliente no mesmo arquivo | Extrair catalogo/carrinho/auth em sprints pequenas |
| Divergencia visual | Alta | CSS legado + tokens V1.4 coexistem | Migrar por tela, com screenshots |
| Peso de assets | Media | Duplicatas e PNGs grandes | Mapa de uso antes de remover/comprimir |
| Dominio hardcoded em novas features | Media | Historico Tokyo ainda aparece por contrato V1 | Exigir `DOMAIN_CONFIG` e `site.config.json` em novos codigos |
| XSS por render string | Media | Muito `innerHTML` dinamico | Reforcar escaping e migrar render para helpers menores |
| CSRF futuro em admin | Media | Operacoes autenticadas por cookie | Planejar token same-site/CSRF para V2 |
| Workspace com temporarios | Baixa/Media | Muitos artefatos ignorados | Limpeza manual controlada fora de sprint funcional |

## Problemas Corrigidos

- Dominio atual foi encapsulado em `DOMAIN_CONFIG` no servidor.
- Fallback de dominio do Master deixou de ter string direta de Tokyo.
- Arquitetura, qualidade, complexidade e debitos foram documentados em relatorios dedicados.

## Problemas Encontrados E Nao Corrigidos

- Monolitos grandes: `admin/admin.js`, `script.js`, `admin/admin.css`, `styles.css`.
- Funcoes grandes: `initDashboardPage`, `renderOrderDetails`, `renderFinanceModule`, `renderAuthPanel`, `handleDocumentClick`.
- CSS hardcoded fora de tokens em arquivos legados.
- Assets duplicados por hash.
- Possiveis assets orfaos, nao removidos por risco de uso dinamico.
- Boilerplate repetido nos scripts de validacao.
- `console.log` em scripts de validacao e fallback de logger do WhatsApp.
- Grande volume de temporarios ignorados no workspace.

## Pontos Fortes

- Validacoes locais maduras e abrangentes.
- Base multi-tenant ja planejada.
- RBAC e security guardian ja existem.
- Configuracao de marca esta centralizada o suficiente para evoluir.
- API admin e API cliente ja delegam para camadas internas.
- Documentacao de produto, arquitetura, seguranca e operacao e extensa.

## Pontos Fracos

- Frontend ainda nao e modular.
- CSS legado ainda pesa mais do que o Design System oficial.
- Muitos assets de catalogo e referencia vivem no repositorio principal.
- Stores sao grandes e misturam responsabilidades.
- Falta uma camada compartilhada para fixtures/servidor de validacao.

## Oportunidades Para V2

1. Criar `admin/modules/*` e mover render/estado/actions por modulo.
2. Criar `public/modules/*` para catalogo, carrinho, auth, entrega e tracking.
3. Criar `lib/shared-utils.cjs` e migrar helpers repetidos.
4. Criar `scripts/local-validation-server.mjs` para reduzir duplicacao dos validators.
5. Criar `docs/asset-inventory.md` com origem, uso e politica de compressao.
6. Migrar CSS legado para tokens em ondas pequenas.
7. Criar politica de CSP por etapa.
8. Criar protecao CSRF para rotas admin mutantes.
9. Separar schema SQL de stores operacionais.
10. Definir limite de tamanho por arquivo e por funcao para novas sprints.

## Recomendacao De Roadmap Tecnico

V1.5:

- Concluir auditoria, documentacao e refactors seguros de configuracao.
- Nao quebrar bundles grandes ainda.

V2.0:

- Modularizar admin por dominio.
- Compartilhar infraestrutura de validators.
- Criar asset inventory e limpeza controlada.

V2.5:

- Modularizar front publico.
- Aplicar CSP incremental.
- Iniciar CSS token migration por tela.

V3.0:

- Bundles separados por area.
- Stores menores com repository/query/schema separados.
- Dominio INOVAS como primeira classe de plataforma, mantendo restaurantes como tenants/clientes.

## Estado De Saude

Classificacao geral: saudavel para V1, mas com complexidade alta para escala V2/V3.

Prioridade maxima: reduzir monolitos antes de adicionar muitos modulos novos.

Validacoes V1.5 executadas com sucesso:

- `git diff --check`: OK, apenas avisos LF/CRLF.
- `node --check lib/app-branding.cjs`: OK.
- `node --check lib/master-platform-store.cjs`: OK.
- `npm.cmd run validate:v1-3-platform-local`: OK.
- `npm.cmd run validate:v1-1-users-local`: OK.
- `npm.cmd run validate:v1-2-saas-local`: OK.
- `npm.cmd run validate:permissions-local`: OK.
- `npm.cmd run validate:platform-integration-local`: OK.
- `npm.cmd run validate:v1-final-local`: OK.

Status: pronto para fechamento da fundacao tecnica V1.5.
