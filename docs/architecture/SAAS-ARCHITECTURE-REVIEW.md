# INOVAS FOOD - Revisao de Arquitetura SaaS V2.0

Status: preparacao documental.
Escopo: revisao estatica, sem alteracao de funcionalidade, API, autenticacao, banco, deploy, commit ou tag.

## 1. Situacao Atual

A plataforma ja deixou de ser apenas um gestor operacional isolado e passou a ter fundacoes SaaS em V1.2:

- `lib/tenant-context.cjs` resolve contexto de tenant/restaurante.
- `lib/master-platform-store.cjs` concentra entidades de plataforma, planos, restaurantes, dominios e onboarding.
- `lib/user-permissions.cjs` separa usuarios de sistema e usuarios de restaurante.
- `lib/admin-api.cjs` centraliza login, sessao, rotas admin, rotas master, usuarios e operacoes.
- `admin/admin.js` controla quase todo o painel operacional e parte da navegacao SaaS.
- `admin/design-system.css` aplica tokens visuais oficiais da INOVAS Food sobre a base admin existente.
- `migrations/001` a `013` documentam preparacao progressiva para multi-tenant fisico.

Arquivos com maior concentracao de responsabilidade observada:

- `admin/admin.js`: 13541 linhas.
- `script.js`: 11781 linhas.
- `admin/admin.css`: 11232 linhas.
- `styles.css`: 6961 linhas.
- `lib/order-store.cjs`: 3178 linhas.
- `lib/catalog-store.cjs`: 2144 linhas.
- `lib/admin-api.cjs`: 2110 linhas.
- `lib/master-platform-store.cjs`: 1931 linhas.
- `lib/user-permissions.cjs`: 1641 linhas.

## 2. Estrutura Atual

Principais areas:

- Publico: `index.html`, paginas publicas, `script.js`, `styles.css`, `site-config.js`.
- Admin restaurante/sistema: `admin/index.html`, `admin/login.html`, `admin/admin.js`, `admin/admin.css`, `admin/design-system.css`.
- Painel master: `admin/master.html`, `admin/master.js`.
- APIs serverless: `api/**`.
- Dominio/backend: `lib/**`.
- Validadores: `scripts/validate-*.mjs`.
- Migrations/documentacao: `migrations/**`, `docs/**`.
- Assets: `assets/**`, `site-images/**`.

## 3. Modulos e Acoplamentos

O desenho atual funciona para V1.2, mas ainda carrega acoplamentos fortes:

- `lib/admin-api.cjs` atua como roteador, camada de seguranca, controller e orquestrador de stores.
- `admin/admin.js` renderiza navegacao, usuarios, pedidos, dashboard, cardapio, clientes, metricas, financeiro, estoque, configuracoes e handlers.
- `script.js` concentra catalogo publico, carrinho, login do cliente, historico, avaliacoes, entrega, SEO e renderizacao.
- Stores ainda misturam normalizacao, schema, leitura/escrita local, Neon, serializacao e regras do dominio.
- `site-config.js` e `site.config.json` ainda sao centrados no restaurante Tokyo/default, o que e aceitavel para o cliente atual, mas nao para SaaS dinamico.

Impacto: adicionar novos restaurantes, novas rotas ou novos modulos tende a tocar muitos arquivos grandes.
Risco: regressao transversal, dificuldade de revisar, aumento de tempo de validacao.
Prioridade: alta antes de V2.0 com muitos tenants.

## 4. Rotas e APIs

Rotas admin sao encaminhadas por `api/admin/[...action].js` para `lib/admin-api.cjs`.

Grupos reconhecidos no backend:

- `orders`
- `catalog`
- `promotions`
- `reviews`
- `delivery-settings`
- `settings`
- `finance`
- `inventory`
- `customers`
- `users`
- `exports`
- `master`

Separacoes ja existentes:

- Publico: `/api/catalog`, `/api/orders/create`, `/api/reviews`, `/api/delivery-settings`.
- Cliente: `/api/customer/*`.
- Admin: `/api/admin/*`.
- Plataforma: grupo `master` dentro de `/api/admin/*`.

Ponto de atencao: a rota `/api/admin/master/*` depende de rewrite correto no ambiente de deploy. O `vercel.json` lista varios rewrites admin, mas a revisao encontrou risco de lacuna para grupo `master` quando chamado diretamente por caminho especifico. Isso deve ser tratado em revisao futura de roteamento, sem alterar agora.

## 5. Duplicacoes e Codigo Legado

Duplicacoes/riscos observados:

- Dois formatos de permissao convivem: legado `module_action` e SaaS `module.action`.
- Componentes visuais sao renderizados repetidamente via template string em `admin/admin.js`, `admin/master.js` e `script.js`.
- CSS legado e CSS novo convivem em `admin/admin.css` e `admin/design-system.css`.
- Existem seletores `legacy-dark-disabled`, indicando compatibilidade visual antiga ainda embutida.
- Existem arquivos temporarios ou de restauracao no workspace, por exemplo `_tmp*`, `NUL`, `admin/_tmp_orders_revert.css` e `admin/orders-production-restore.css`.

Nao foi removido nada, pois o escopo e apenas documentar.

## 6. Arquivos Possivelmente Mortos ou Temporarios

Itens que devem ser avaliados antes de qualquer limpeza:

- Arquivos `_tmp*` na raiz: foram encontrados muitos artefatos de screenshots, relatorios e scripts temporarios.
- Arquivo `NUL` na raiz.
- `admin/_tmp_orders_revert.css`.
- `admin/orders-production-restore.css`.
- Artefatos em `_tmp_chunks`, `_tmp_cookie_dir`, `_tmp_prod_ref`.
- Prints e relatorios historicos de validacao na raiz.

Recomendacao: criar uma etapa separada de limpeza com `git status`, conferindo `.gitignore`, referencias em HTML/CSS/JS e validadores. Nao remover por inferencia.

## 7. Pontos Fortes

- Validadores locais extensos para V1, V1.1, V1.2, permissoes, plataforma e final.
- Separacao inicial entre usuario do sistema e usuario de restaurante.
- Hierarquia SaaS inicial no backend.
- Tenant context ja preparado com `tenantId`, `restaurantId`, `restaurantKey`.
- Migrations documentais evolutivas.
- Design System oficial aplicado no admin.
- Smoke tests e scripts de producao ja fazem parte do fluxo operacional.

## 8. Problemas Principais

| Problema | Prioridade | Impacto | Risco |
| --- | --- | --- | --- |
| Monolitos frontend grandes | Alta | Dificulta evoluir modulos SaaS | Regressao visual e funcional |
| `admin-api.cjs` concentrando muitas responsabilidades | Alta | Dificulta autorizacao por rota | Bypass acidental ou erro de escopo |
| Configuracao publica Tokyo/default global | Alta | Bloqueia multi-restaurante real | Restaurante errado em dominio novo |
| Permissoes duplicadas em dois formatos | Media | Confusao em validadores e UI | Divergencia de autorizacao |
| CSS historico junto ao Design System | Media | Visual inconsistente | Regressao em telas antigas |
| Artefatos temporarios no workspace | Baixa/Media | Ruido e risco de vazamento se publicados | Deploy com arquivo indevido |

## 9. Recomendacoes

Alta prioridade:

- Separar `admin/admin.js` por modulos: navegacao, usuarios, pedidos, catalogo, financeiro, estoque, settings.
- Separar `admin-api.cjs` em controllers por grupo: `admin-orders`, `admin-users`, `admin-master`, `admin-finance`.
- Criar um manifesto de rotas com `scope`, `permissions`, `planAction`, `tenantRequirement`.
- Definir contrato unico de tenant: `tenantId`, `restaurantId`, `restaurantKey`, `restaurantSlug`, `restaurantDomain`.
- Transformar `site-config.js` em configuracao por restaurante/dominio.

Media prioridade:

- Consolidar componentes visuais admin em classes reutilizaveis.
- Reduzir CSS legado apos validacao visual.
- Criar auditoria automatica para hardcoded `Tokyo`, `default`, `tokyo_`.
- Criar script de higiene para listar arquivos temporarios fora de `test-results`.

Baixa prioridade:

- Padronizar nomes entre ingles/portugues em propriedades internas.
- Reduzir aliases antigos apenas depois de janela de compatibilidade.

## 10. Recomendacao Final

A arquitetura atual esta apta como base de V1.2, mas a V2.0 deve comecar por modularizacao, roteamento declarativo e tenant context obrigatorio por modulo. A prioridade nao e criar novas funcionalidades, e sim impedir que o crescimento multi-restaurante dependa de defaults globais e arquivos monoliticos.
