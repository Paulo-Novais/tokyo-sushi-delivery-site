# INovas Food - Code Review

Data: 2026-06-25

Escopo: revisao estatica de codigo e organizacao. Nao houve remocao de codigo, alteracao de arquivos-fonte, refatoracao, deploy ou execucao de scripts destrutivos.

## Sumario

O codigo esta funcional e organizado por camadas, mas a plataforma chegou ao ponto em que a proxima evolucao precisa ser modularizacao controlada. O problema principal nao e bug evidente; e concentracao de responsabilidades.

O projeto possui bons sinais:

- APIs publicas e administrativas separadas.
- Wrappers finos em `api/admin/[...action].js` e `api/customer/[...action].js`.
- Stores por dominio em `lib`.
- Auth e permissoes centralizadas.
- Testes locais numerosos.
- Documentacao arquitetural consistente.

Mas tambem ha riscos claros:

- Arquivos gigantes.
- Funcoes/blocos muito longos.
- Duplicacao de persistencia e normalizacao.
- Dados operacionais globais.
- Acoplamentos legados Tokyo.
- Build/output e evidencias temporarias aparecendo no status Git.

## Estrutura de Pastas

| Area | Leitura |
| --- | --- |
| `api/` | Boa separacao entre endpoints publicos, admin, cliente e pedidos. Catch-all admin/cliente reduz duplicacao de arquivos de rota. |
| `lib/` | Boa separacao por dominio, mas cada store repete infraestrutura de storage e schema. |
| `admin/` | UI administrativa rica, mas muito concentrada em `admin/admin.js` e `admin/admin.css`. |
| raiz HTML | Paginas publicas claras e estaticas. Repetem estrutura de header/footer. |
| `scripts/` | Validacoes locais fortes. Alguns scripts destrutivos foram bloqueados por comandos seguros no `package.json`, boa decisao. |
| `docs/adr` | Excelente base de decisoes arquiteturais. |
| `migrations/` | Documentacao futura em Markdown, nao executavel, boa decisao de seguranca. |
| assets/imagens | Muitos assets reais e evidencias; precisa politica clara do que entra no repo/producao. |

## Arquivos Gigantes

Arquivos-fonte com maior impacto:

| Arquivo | Linhas | Risco |
| --- | ---: | --- |
| `admin/admin.js` | 12.572 | Gestor inteiro, modulos, estado, eventos e renderizacao no mesmo arquivo. |
| `script.js` | 11.762 | Site publico, catalogo, carrinho, login, entrega, reviews, historico e mapas no mesmo bundle. |
| `admin/admin.css` | 10.489 | Cascata visual grande e risco de regressao em ajustes pequenos. |
| `styles.css` | 6.407 | CSS publico grande. |
| `lib/order-store.cjs` | 2.882 | Pedidos, dashboard, auditoria, detalhes e consultas no mesmo store. |
| `admin/orders-production-restore.css` | 2.356 | Arquivo de restauracao/historico com peso de manutencao. |
| `lib/catalog-store.cjs` | 1.892 | Catalogo, promocoes, extracao de dados de UI e persistencia. |
| `lib/admin-api.cjs` | 1.458 | Roteador admin central com muitos dominios. |

Classificacao: alto impacto.

Recomendacao: nao quebrar tudo agora. Dividir por etapas e preservar contratos.

## Funcoes e Blocos Grandes

Blocos identificados como candidatos a decomposicao futura:

| Arquivo | Bloco | Linha aproximada | Motivo |
| --- | --- | ---: | --- |
| `admin/admin.js` | `initDashboardPage` | 12871 | Inicializacao, listeners e roteamento de UI concentrados. |
| `admin/admin.js` | `renderOrderDetails` | 10455 | Muitos estados e renderizacoes de detalhe no mesmo fluxo. |
| `admin/admin.js` | `renderFinanceModule` | 6365 | Modulo com muitas responsabilidades de exibicao e formulario. |
| `admin/admin.js` | `renderRestaurantSettingsModule` | 8421 | Configuracoes, SEO, endereco, horarios e branding juntos. |
| `admin/admin.js` | `renderMetricsModule` | 7144 | Muitas secoes de indicadores e relatorios. |
| `script.js` | `renderAuthPanel` | 8620 | Login, estados, mensagens e formulario em bloco unico. |
| `script.js` | `handleDocumentClick` | 13075 | Delegacao global de muitos fluxos. |
| `script.js` | `renderTrackingPage` | 9406 | Varios estados do acompanhamento. |
| `script.js` | `renderCatalog` | 12645 | Renderizacao pesada do catalogo publico. |
| `script.js` | `calculateDeliveryEstimate` | 11909 | Integra CEP, Maps, fallback e mensagens. |
| `lib/order-store.cjs` | `createOrderInNeon` | 1676 | SQL, idempotencia, insert de pedido, itens e eventos. |
| `lib/order-store.cjs` | `getDashboardFromNeon` | 1974 | Consultas agregadas e montagem de dashboard. |
| `lib/order-store.cjs` | `getOrderDetailsFromNeon` | 2310 | Detalhe operacional e historico. |
| `lib/order-payload.cjs` | `normalizeOrderSubmission` | 292 | Normalizacao central de payload. |

Observacao: a medicao de blocos foi estatica e indicativa. O ponto importante e o padrao: varios fluxos grandes misturam dados, estado, renderizacao e evento.

## Duplicacoes

Duplicacoes relevantes:

- `getStorageMode` aparece em muitos stores.
- `readFileStore` e `writeFileStore` aparecem repetidos em stores.
- `cloneJson` aparece em varios arquivos.
- `normalizeText` aparece com variacoes em varios stores.
- `ensureNeonSchema` ou bootstrap de schema aparece espalhado.
- Tratamento de erro de API segue padrao similar, mas repetido.
- Admin possui varias rotinas `loadX`, `saveX`, `renderX` com estrutura parecida.

Classificacao: medio-alto.

Recomendacao: criar helpers compartilhados apenas para novos stores ou durante refatoracoes naturais. Evitar grande refactor antes da V1.

## Codigo Legado e Acoplamentos

Acoplamentos intencionais que devem permanecer por compatibilidade:

- Cookies `tokyo_admin_session`, `tokyo_customer_session`, `tokyo_customer_login_challenge`.
- Headers `x-tokyo-customer-client-token`, `x-tokyo-customer-key`.
- Storage local com nomes Tokyo.
- Prefixo `TKY`.
- Global `TOKYO_SITE_CONFIG`.
- Globais `TokyoBusinessHours`, `TokyoStoreHours`, `TOKYO_GOOGLE_MAPS_API_KEY`.
- `restaurant_key = "default"`.

Esses itens nao sao bugs. Sao contratos legados. O risco e renomear sem aliases.

## Codigo Morto, TODOs e FIXMEs

Busca estatica por `TODO`, `FIXME`, `HACK`, `XXX`, `deprecated` e `debugger` nao encontrou alertas relevantes em fonte real, excluindo docs/artefatos.

Pontos de atencao:

- Existem muitos placeholders validos de UI, nao necessariamente divida.
- Existem mocks em scripts de validacao, intencionais.
- Existem referencias legacy em auth/permissoes, intencionais.
- `lib/whatsapp-cloud.cjs` usa fallback de logger com `console.log`; nao e bug, mas e melhor encapsular log estruturado no futuro.

## Imports Desnecessarios e Funcoes Nunca Usadas

Nao foi executado analisador estatico completo de unused exports/imports. Pela leitura, o maior risco de codigo morto esta em:

- Funcoes internas grandes em `admin/admin.js` e `script.js` que sao usadas por delegacao/eventos e dificeis de rastrear manualmente.
- Arquivos de restore/evidencia como `admin/orders-production-restore.css`.
- Rotas antigas deletadas no status Git e substituidas por catch-all.
- Pastas geradas como `.vercel/output` e evidencias `_tmp*`.

Recomendacao:

- Introduzir lint/unused-check de forma nao bloqueante primeiro.
- Mapear exports de `lib` antes de remover qualquer funcao.
- Nunca remover legacy sem teste que prove compatibilidade.

## Complexidade

Classificacao por area:

| Area | Complexidade | Motivo |
| --- | --- | --- |
| Site publico | Alta | Muitos fluxos em `script.js`: catalogo, carrinho, auth, mapas, reviews, historico. |
| Gestor | Muito alta | Muitos modulos, renderizacao e estado em um arquivo. |
| Master | Media | Conceitual e relativamente isolado. |
| APIs | Media-alta | Admin central concentra muitos grupos. |
| Stores | Media-alta | Bons dominios, mas persistencia repetida e dados globais. |
| Testes | Media | Muitos scripts, alguns antigos/destrutivos bloqueados por comando seguro. |

## Nomenclatura

Pontos bons:

- Nome dos stores e modulos e claro.
- `master-platform-store`, `restaurant-settings-store`, `delivery-settings-store`, `user-permissions` comunicam bem o dominio.
- Rotas admin agrupadas por recurso.

Pontos de atencao:

- `tokyo-site` no `package.json` e nomes Tokyo continuam corretos por compatibilidade, mas precisam de plano futuro.
- Mistura de nomes em portugues/ingles aparece em payloads e UI. Aceitavel hoje, mas para API publica futura deve haver padrao.
- `restaurantKey` e `restaurant_key` coexistem por ponte JS/DB. Documentar sempre.

## Separacao de Responsabilidades

Boa separacao macro:

- Front publico.
- Admin.
- Master.
- API.
- Stores.
- Auth.
- Permissoes.

Separacao que precisa evoluir:

- `script.js` deve virar modulos: catalogo, carrinho, auth cliente, delivery, reviews, historico, UI comum.
- `admin/admin.js` deve virar modulos: orders, catalog, promotions, delivery, settings, users, finance, inventory, CRM, reviews, metrics.
- `lib/admin-api.cjs` deve reduzir roteamento central quando novos modulos entrarem.
- Stores devem compartilhar persistencia e erros.

## Ordem Recomendada de Refatoracao

1. Nao refatorar antes da V1 preview.
2. Criar camada compartilhada de storage para novos stores.
3. Separar catalogo base de `script.js`.
4. Extrair helpers de erro/API admin.
5. Separar `script.js` por dominios sem mudar HTML/layout.
6. Separar `admin/admin.js` por modulos de baixo risco.
7. Manter testes atuais verdes a cada etapa.
8. So depois preparar `TenantContext` em stores.

## Riscos Que Nao Devem Virar Acao Imediata

- Renomear cookies/headers.
- Remover `restaurant_key`.
- Trocar prefixo `TKY`.
- Remover arquivos legacy sem rastrear uso.
- Dividir todo admin de uma vez.
- Criar `restaurant_id`.
- Alterar APIs para "ficarem bonitas".

## Veredito de Codigo

O codigo e bom o suficiente para V1 controlada e forte o suficiente para justificar investimento. Mas chegou ao ponto de saturacao de monolitos. A proxima fase de engenharia deve reduzir superficie de risco sem mudar comportamento.

Nota de codigo: 76/100.
