# INOVAS Food - Project Architecture Audit V1.5

Data: 2026-07-08

## Escopo

Auditoria de arquitetura interna para preparar a plataforma ate V3.0, sem criar funcionalidades, sem alterar regras de negocio, APIs publicas, autenticacao, permissoes, banco de producao, layout, UX, Design System ou identidade visual.

As alteracoes visuais foram isoladas em commits proprios. Esta auditoria registra apenas alteracoes internas seguras da fundacao V1.5.

## Inventario Geral

Arquivos versionados auditados: 359.
Tamanho total versionado: 156.4 MB.
Linhas de texto estimadas: 115.332.

| Grupo | Arquivos | Linhas | Responsabilidade |
| --- | ---: | ---: | --- |
| HTML | 12 | 2.542 | Paginas publicas, landing `/inovas`, shells admin e Master |
| CSS | 5 | 27.089 | Estilos publicos, admin, Design System, landing e restore historico |
| JS/CJS/MJS | 76 | 70.569 | Front publico, admin, API, stores, validators e middleware |
| `lib/` | 26 | 23.279 | Regras internas, stores, tenant, auth, permissoes, seguranca e branding |
| `api/` | 8 | 521 | Adaptadores HTTP serverless |
| `scripts/` | 35 | 14.843 | Validacoes locais, geracao de hash e aplicacao de config |
| Assets | 170 | n/a | Logos, fotos, imagens de catalogo e referencias |
| Docs/migrations | 84+ | 14.309+ | Roadmaps, ADRs, revisoes, migracoes e guias |

## Entry Points

- Publico: `index.html`, `cardapio.html`, `entrega.html`, `acompanhar.html`, `avaliar.html`, `historico.html`, `trabalhe-conosco.html`, `404.html`, `script.js`, `styles.css`.
- Landing INOVAS: `inovas.html`, `inovas.css`.
- Admin restaurante: `admin/index.html`, `admin/admin.js`, `admin/admin.css`, `admin/design-system.css`.
- Login admin: `admin/login.html`, `admin/admin.js`, `admin/design-system.css`.
- Painel Master: `admin/master.html`, `admin/master.js`, `admin/design-system.css`.
- Middleware: `middleware.js`.
- APIs publicas: `api/catalog.js`, `api/reviews.js`, `api/delivery-settings.js`, `api/restaurant-settings.js`, `api/orders/create.js`, `api/customer/[...action].js`, `api/auth/send-whatsapp-code.js`.
- API admin: `api/admin/[...action].js` -> `lib/admin-api.cjs`.
- Configuracao publica: `site.config.json`, `site-config.js`, `lib/app-branding.cjs`.

## Modulos `lib/`

| Modulo | Papel atual |
| --- | --- |
| `app-branding.cjs` | Branding, assets, textos, identificadores e configuracao de dominio |
| `admin-auth.cjs` | Usuarios admin configurados, hash, sessao e cookies admin |
| `admin-request.cjs` | Extracao e exigencia de sessao admin |
| `admin-api.cjs` | Roteador/admin facade para modulos internos |
| `user-permissions.cjs` | RBAC, perfis, usuarios e permissoes |
| `master-platform-store.cjs` | Plataforma SaaS, planos, dominios, contratos, restaurantes |
| `tenant-context.cjs` | Resolucao de tenant/restaurante por host e sessao |
| `security-guardian.cjs` | Guardas de seguranca, rate signals e bloqueios temporarios |
| `request-guard.cjs` | Rate limits de cliente/pedido |
| `catalog-store.cjs` | Catalogo publico/admin, promocoes e overrides |
| `order-store.cjs` | Pedidos, dashboard, metricas, auditoria e persistencia |
| `order-payload.cjs` | Normalizacao e validacao de pedidos |
| `customer-api.cjs` | Roteador cliente |
| `customer-auth.cjs` | Sessao e login de cliente |
| `customer-crm-store.cjs` | CRM e perfis de clientes |
| `customer-verification.cjs` | Fluxo de verificacao por codigo |
| `delivery-settings-store.cjs` | Configuracoes de entrega |
| `restaurant-settings-store.cjs` | Configuracoes do restaurante/site |
| `finance-store.cjs` | Fechamento e financeiro operacional |
| `inventory-store.cjs` | Estoque |
| `review-store.cjs` | Avaliacoes |
| `admin-metrics.cjs` | Agregacoes de metricas |
| `operational-day.cjs` | Janela operacional |
| `business-hours.cjs` | Regras de horario |
| `http.cjs` | Helpers HTTP |
| `whatsapp-cloud.cjs` | Envio WhatsApp Cloud |

## Arquivos Grandes

| Arquivo | Linhas | Risco |
| --- | ---: | --- |
| `admin/admin.js` | 15.365 | Muito acoplado: navegacao, render, estado, handlers e chamadas API no mesmo arquivo |
| `script.js` | 13.471 | Front publico monolitico: catalogo, carrinho, login, entrega, footer, tracking |
| `admin/admin.css` | 13.309 | CSS legado amplo com hardcoded colors e muitos blocos especificos |
| `styles.css` | 8.155 | CSS publico monolitico |
| `lib/order-store.cjs` | 3.516 | Store com schema, persistencia, dashboard, finance, audit e status |
| `admin/orders-production-restore.css` | 3.077 | Arquivo restore historico, alto risco de confusao |
| `lib/master-platform-store.cjs` | 2.496 | Plataforma, planos, dominios, contracts e onboarding no mesmo modulo |
| `lib/admin-api.cjs` | 2.471 | Facade admin com muitos grupos e dispatch |
| `lib/catalog-store.cjs` | 2.467 | Catalogo, promocoes, parsing de `script.js` e persistence |
| `admin/master.js` | 2.134 | Painel Master com render e actions no mesmo bundle |

## Funcoes Grandes

| Arquivo | Funcao | Linha | Tamanho aproximado |
| --- | --- | ---: | ---: |
| `admin/admin.js` | `initDashboardPage` | 13802 | 1430 linhas |
| `admin/admin.js` | `renderOrderDetails` | 11228 | 489 linhas |
| `admin/admin.js` | `renderFinanceModule` | 6558 | 390 linhas |
| `admin/admin.js` | `renderRestaurantSettingsModule` | 8614 | 328 linhas |
| `script.js` | `renderAuthPanel` | 8634 | 323 linhas |
| `script.js` | `handleDocumentClick` | 13108 | 300 linhas |
| `lib/order-store.cjs` | `ensureNeonSchema` | 147 | 313 linhas |
| `lib/order-store.cjs` | `createOrderInNeon` | 1862 | 300 linhas |
| `lib/order-store.cjs` | `getDashboardFromNeon` | 2189 | 284 linhas |

## Acoplamento

- `lib/admin-api.cjs` importa 15 modulos internos e atua como gateway para quase todos os dominios administrativos.
- `api/orders/create.js` importa 11 dependencias internas e concentra validacao, seguranca, catalogo e persistencia do pedido.
- `script.js` e `admin/admin.js` concentram estado global, render HTML por string e handlers de documento.
- Stores misturam schema SQL, file-store, normalizacao e formatacao de payload no mesmo modulo.
- Scripts de validacao repetem padroes de servidor estatico, ambiente temporario e login admin.

## Duplicacoes e Repeticoes

- Helpers `cloneJson`, `normalizeText`, `normalizeObject` e variacoes aparecem em varios stores.
- Padrao de `LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", ...)` aparece em stores diferentes.
- Validadores repetem boilerplate de `mkdtemp`, `process.chdir`, copy de `script.js`, servidor estatico e restauracao de env.
- Assets duplicados por hash foram encontrados entre `menu_pdf_images/catalog/*` e `site-images/*`, alem de alguns pares em `assets/`.
- CSS publico/admin ainda carrega muitas cores hardcoded fora dos tokens.

## CSS e Design System

`admin/design-system.css` deve ser tratado como fonte oficial de tokens admin. Ainda existem literais de cor fora de blocos de token:

| Arquivo | Literais de cor | Fora de blocos de token conhecidos |
| --- | ---: | ---: |
| `admin/design-system.css` | 117 | 55 |
| `admin/admin.css` | 1555 | 1555 |
| `admin/orders-production-restore.css` | 333 | 333 |
| `styles.css` | 883 | 883 |
| `inovas.css` | 63 | 40 |

Nada foi substituido nesta sprint alem do que ja estava pendente da V1.4, para nao alterar layout/UX.

## Assets

Maiores assets versionados:

- `menu_pdf_images/catalog/teppan-camarao.png`: 20.3 MB.
- `site-images/teppan-camarao.png`: 20.3 MB.
- `menu_pdf_images/catalog/temaki-hot.png`: 12.9 MB.
- `site-images/temaki-hot.png`: 12.9 MB.
- `assets/login-cover.png`: 3.3 MB.
- `assets/tokyo-poster-reference.png`: 3.3 MB.
- `assets/inovas-food-logo-oficial.png`: 1.9 MB.

Duplicacoes confirmadas por hash incluem:

- `assets/login-cover-floating.png` e `site-images/login-cover-floating.png`.
- `assets/login-cover.png` e `assets/tokyo-poster-reference.png`.
- `assets/profile-avatar-chef-dev.png` e `menu_pdf_images/support-avatar-chef-dev.png`.
- `assets/tokyo-logo-custom.png` e `assets/tokyo-logo-sidebar.png`.
- `assets/tokyo-logo-premium-transparent.png` e `site-images/tokyo-logo-premium-transparent.png`.
- Diversos pares `menu_pdf_images/catalog/*` e `site-images/*`.

Possiveis assets orfaos foram listados por busca estatica, mas nao foram removidos porque nomes podem ser usados por dados dinamicos de catalogo ou configuracao.

## QA E Higiene

- TODO/FIXME/HACK em codigo real: nenhum achado relevante.
- `console.log`: encontrado em scripts de validacao e no fallback de logger em `lib/whatsapp-cloud.cjs`; nao e debug esquecido de tela.
- Artefatos ignorados no workspace: 332 entradas.
- Temporarios/artefatos raiz ignorados: 321 entradas, incluindo `.tmp/`, `NUL` e muitos `_tmp*`.
- Nenhum arquivo temporario foi removido nesta sprint para evitar perda de evidencias.

## Seguranca

Pontos positivos:

- Sessao admin centralizada em `admin-auth.cjs`.
- RBAC centralizado em `user-permissions.cjs`.
- Resolucao tenant em `tenant-context.cjs`.
- Guardas de seguranca em `security-guardian.cjs` e `request-guard.cjs`.
- Cookies admin e cliente passam por helpers dedicados.

Pontos a acompanhar:

- Muito HTML e render dinamico por string em `admin/admin.js`, `admin/master.js` e `script.js`; manter `escapeHtml` obrigatorio.
- APIs admin usam cookie de sessao; uma futura camada CSRF explicita pode reduzir risco quando houver mais operacoes sensiveis.
- CSP ainda deve ser tratada como hardening de V2, para nao quebrar scripts inline/legados na V1.

## Mudancas Aplicadas Na Sprint V1.5

- `lib/app-branding.cjs`: criada `DOMAIN_CONFIG` como fronteira server-side para dominio atual, origem canonica, dominios alternativos, hostnames permitidos e imagem social.
- `lib/master-platform-store.cjs`: fallback de dominio passou a usar `DOMAIN_CONFIG.primaryDomain`.
- `PROJECT-ARCHITECTURE-AUDIT.md`: este relatorio.
- `PROJECT-HEALTH-REPORT.md`: relatorio de saude geral.

## Recomendacoes De Refactor Seguro

1. Extrair `admin/admin.js` por dominio: `orders`, `dashboard`, `catalog`, `finance`, `settings`, `users`, `customers`, `inventory`.
2. Extrair `script.js` por dominio publico: catalogo, carrinho, auth, entrega, historico, footer e tracking.
3. Criar helpers compartilhados em `lib/shared-utils.cjs` para `cloneJson`, normalizacao e coercao.
4. Criar helper de validacao local para servidores estaticos e ambiente temporario dos scripts.
5. Consolidar assets duplicados somente apos mapeamento de referencias runtime.
6. Planejar migracao gradual de cores hardcoded para tokens, tela por tela, com screenshots.
7. Manter `site.config.json` como fonte de dominio e impedir novos fallbacks hardcoded.

## Status

Auditoria concluida. Refactors aplicados foram conservadores e de baixa superficie.

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
