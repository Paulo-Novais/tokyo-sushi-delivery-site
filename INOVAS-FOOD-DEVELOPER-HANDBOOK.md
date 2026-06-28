# INovas Food - Developer Handbook

Data: 2026-06-26

Escopo: guia de onboarding tecnico para novos desenvolvedores. Este documento nao altera codigo, APIs, banco, layout, deploy ou regras de negocio.

## 1. Visao Geral

### O que e a INovas Food

A INovas Food e uma plataforma SaaS em evolucao para operacao digital de restaurantes. A base atual usa o Tokyo Sushi como Cliente Modelo e mantem a operacao em modo monorestaurante, com preparacao documental e estrutural para crescimento futuro.

Superficies principais:

- Site publico para cliente final.
- Gestor do restaurante para operacao diaria.
- Painel Master INovas Food para administracao da plataforma.
- APIs serverless para catalogo, pedidos, cliente, admin e configuracoes.
- Stores em `lib/` com fallback local e suporte a Neon quando `DATABASE_URL` existe.

### Objetivo da plataforma

O objetivo e permitir que restaurantes gerenciem cardapio, pedidos, entrega, clientes, avaliacoes, usuarios, permissoes, planos, contratos, estoque e financeiro a partir de uma base unica.

Importante: a plataforma ainda nao possui multi-restaurante real. A preparacao atual usa `restaurant_key = "default"` por compatibilidade. Nao criar `restaurant_id`, tenant real ou multi-restaurante sem seguir o plano de migracao documentado.

### Filosofia do projeto

- Preservar o Cliente Modelo funcionando antes de expandir.
- Evoluir por fases pequenas, validadas e reversiveis.
- Nao quebrar dominio, cookies, headers, rotas, prefixo de pedido ou regras existentes.
- Tratar documentacao, testes e scripts de validacao como parte do produto.
- Preparar SaaS sem antecipar arquitetura ainda nao ativada.
- Se houver duvida, documentar e preservar compatibilidade.

### Estrutura geral

```text
Cliente
  -> Site publico
  -> APIs publicas
  -> Stores
  -> Banco Neon ou armazenamento local
  -> Resposta ao cliente

Gestor
  -> Admin UI
  -> API admin
  -> Autenticacao/permissoes/plano
  -> Stores de dominio
  -> Banco Neon ou armazenamento local

Painel Master
  -> Master UI
  -> API admin/master
  -> Store de plataforma
  -> Planos, contratos, dominios e flags simulados/preparados
```

## 2. Estrutura de Pastas

### Raiz

Contem paginas publicas HTML, assets globais, configuracoes, documentacao principal e arquivos grandes legados.

Arquivos importantes:

- `index.html`: home publica.
- `cardapio.html`: cardapio publico.
- `entrega.html`: pagina/fluxo de entrega.
- `acompanhar.html`: acompanhamento de pedido.
- `historico.html`: historico do cliente.
- `avaliar.html`: avaliacoes.
- `trabalhe-conosco.html`: pagina institucional.
- `404.html`: pagina de erro.
- `script.js`: JavaScript publico principal.
- `styles.css`: CSS publico principal.
- `site.config.json`: configuracao editavel da marca/site.
- `site-config.js`: configuracao gerada/consumida em runtime.
- `maps-config.js`: chave publica Google Maps atual; deve ser restrita por dominio/referrer no Google Cloud.
- `middleware.js`: protecao de rotas admin/API.
- `vercel.json`: rewrites, redirects e configuracao de deploy Vercel.

### `admin/`

Area administrativa.

- `admin/index.html`: Gestor do Restaurante.
- `admin/login.html`: login administrativo.
- `admin/master.html`: Painel Master INovas Food.
- `admin/admin.js`: logica principal do gestor.
- `admin/master.js`: logica principal do master.
- `admin/admin.css`: estilos do gestor/master.
- `admin/orders-production-restore.css`: arquivo de restauracao/historico visual de pedidos; nao remover sem decisao formal.

### `api/`

Entrypoints serverless.

- `api/catalog.js`: catalogo publico e avaliacoes publicas.
- `api/delivery-settings.js`: configuracoes publicas de entrega.
- `api/restaurant-settings.js`: configuracoes publicas do restaurante.
- `api/orders/create.js`: criacao de pedido.
- `api/customer/[...action].js`: wrapper para API de cliente.
- `api/admin/[...action].js`: wrapper para API administrativa.
- `api/auth/send-whatsapp-code.js`: envio/validacao inicial via WhatsApp.

Padrao: arquivos em `api/` devem ser finos. A regra de negocio fica em `lib/`.

### `lib/`

Camada de dominio, persistencia, autenticacao, validacoes e stores.

Principais arquivos:

- `http.cjs`: helpers HTTP, JSON, cookies, origem e erros.
- `request-guard.cjs`: guards publicos, origem, tamanho de payload e rate limit.
- `admin-auth.cjs`: sessao e autenticacao admin.
- `admin-request.cjs`: requisito de sessao admin.
- `admin-api.cjs`: roteador administrativo central.
- `customer-auth.cjs`: sessao de cliente.
- `customer-api.cjs`: roteador de cliente.
- `user-permissions.cjs`: usuarios, tipos e permissoes.
- `master-platform-store.cjs`: planos, contratos, flags, dominios e snapshot master.
- `catalog-store.cjs`: catalogo e promocoes.
- `order-store.cjs`: pedidos, status, metricas e auditoria.
- `restaurant-settings-store.cjs`: configuracoes do restaurante.
- `delivery-settings-store.cjs`: configuracoes de entrega.
- `finance-store.cjs`: fechamento financeiro.
- `inventory-store.cjs`: estoque.
- `review-store.cjs`: avaliacoes.
- `customer-crm-store.cjs`: clientes/CRM.
- `business-hours.cjs`: horario de funcionamento.
- `app-branding.cjs`: marca, identificadores e templates.
- `whatsapp-cloud.cjs`: integracao WhatsApp Cloud.

### `scripts/`

Scripts de validacao, configuracao e apoio.

- `apply-site-config.py`: aplica configuracoes do site.
- `generate-admin-password-hash.mjs`: gera hash de senha admin.
- `validate-*.mjs`: validacoes locais seguras ou historicas.

Atencao: scripts `validate:stage-*` estao bloqueados por padrao porque suas versoes antigas podem apagar `.data`. Use somente comandos seguros documentados no `package.json`.

### `tests/`

Testes Playwright e validacoes de UI.

- `tests/validate-stage-3-ui.spec.js`: validacao UI com Playwright.

### `docs/`

Documentacao tecnica estruturada.

- `docs/adr/`: Architecture Decision Records.
- ADRs atuais definem organizacao/restaurante, `restaurant_key`, migracao, rollback e isolamento de dados.

### `migrations/`

Documentos de migracao planejada.

- `001_create_organizations.md` ate `012_cutover_default_tenant_context.md`.
- Sao planos/documentos; nao executar como migrations reais sem processo formal de banco, backup e rollback.

### `site-images/`

Imagens do site publico e catalogo.

Atencao: existem imagens pesadas. Nao substituir ou apagar sem plano de otimizacao.

### `assets/`

Assets de branding/admin/login e referencias visuais.

### `menu_pdf_images/` e `menu_pdf_crops/`

Imagens derivadas/importadas de cardapio PDF e cortes de referencia.

### `.tmp/`, `.codex-tools/`, `_tmp*`, `__pycache__/`

Artefatos locais, evidencias e caches. Devem permanecer fora do Git. Nao usar como fonte de produto.

### `styles/`

Nao existe como pasta hoje. O CSS publico fica em `styles.css` e o CSS admin fica em `admin/admin.css`.

## 3. Fluxo da Aplicacao

### Fluxo publico de catalogo

```text
Cliente
  -> Site publico
  -> script.js
  -> /api/catalog
  -> lib/catalog-store.cjs
  -> Banco Neon ou fallback local
  -> JSON de catalogo
  -> renderizacao no site
```

### Fluxo publico de pedido

```text
Cliente
  -> Carrinho no site publico
  -> /api/orders/create
  -> request-guard
  -> normalizacao do pedido
  -> validacao de catalogo
  -> validacao de horario de funcionamento
  -> order-store
  -> Banco Neon ou fallback local
  -> resposta com pedido criado
```

Pontos importantes:

- `POST /api/orders/create` aceita apenas `POST`.
- O corpo deve ser JSON valido.
- A origem publica e validada quando `ALLOWED_PUBLIC_ORIGINS` esta configurado.
- Ha limite de payload e rate limit.
- Pedido imediato respeita horario de funcionamento.
- A resposta segue `ok`, `created`, `storageMode` e `order`.

### Fluxo cliente autenticado

```text
Cliente
  -> Login/codigo via WhatsApp
  -> api/auth/send-whatsapp-code.js
  -> customer-verification / whatsapp-cloud
  -> cookie/sessao de cliente
  -> api/customer/[...action].js
  -> lib/customer-api.cjs
  -> stores
  -> historico/pedido ativo
```

### Fluxo administrativo

```text
Usuario admin
  -> admin/login.html
  -> /api/admin/login
  -> lib/admin-api.cjs
  -> lib/admin-auth.cjs
  -> lib/user-permissions.cjs
  -> cookie de sessao admin
  -> admin/index.html
  -> admin/admin.js
  -> /api/admin/*
  -> sessao + permissao + plano
  -> stores de dominio
```

### Fluxo Master

```text
Usuario MASTER
  -> admin/master.html
  -> admin/master.js
  -> /api/admin/master/*
  -> lib/admin-api.cjs
  -> lib/master-platform-store.cjs
  -> snapshot de plataforma
```

O Master mostra preparacao de plataforma, planos, contratos, dominios e flags. Ele nao ativa multi-restaurante real.

## 4. Como Rodar Localmente

### Pre-requisitos

- Node.js compativel com o projeto.
- npm.
- Python para `scripts/apply-site-config.py`.
- PowerShell no Windows.
- Conta/CLI Vercel apenas se precisar emular rotas serverless.

### Instalar dependencias

```powershell
npm.cmd install
```

Se for rodar teste Playwright diretamente:

```powershell
npx.cmd playwright install
```

### Variaveis de ambiente

Use `.env.example` como referencia de nomes. Nao commitar `.env`, `.env.*` ou arquivos locais com segredos.

Variaveis comuns:

- `DATABASE_URL`
- `ADMIN_LOGIN`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_PASSWORD`
- `ADMIN_DISPLAY_NAME`
- `ADMIN_SESSION_SECRET`
- `CUSTOMER_SESSION_SECRET`
- `ALLOWED_PUBLIC_ORIGINS`
- `ORDER_RATE_LIMIT_WINDOW_MS`
- `ORDER_RATE_LIMIT_MAX_REQUESTS`
- `ORDER_MAX_BODY_BYTES`
- `CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS`
- `CUSTOMER_AUTH_START_MAX_REQUESTS`
- `CUSTOMER_AUTH_VERIFY_MAX_REQUESTS`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TEMPLATE_NAME`
- `WHATSAPP_VERIFY_TEMPLATE_LANGUAGE`
- `WHATSAPP_GRAPH_API_VERSION`

Nao copie valores reais para documentacao, issue, PR ou chat.

### Rodar a aplicacao

Para testar apenas paginas estaticas, qualquer servidor estatico local pode servir a raiz do projeto.

Para testar APIs serverless e rewrites da Vercel, use ambiente local compativel com Vercel:

```powershell
npx.cmd vercel dev
```

Se a porta estiver ocupada, use outra porta conforme orientacao do CLI.

### Validacoes seguras

Use `npm.cmd` no PowerShell:

```powershell
npm.cmd run validate:business-hours
npm.cmd run validate:admin-local
npm.cmd run validate:permissions-local
npm.cmd run validate:master-panel-local
npm.cmd run validate:platform-integration-local
npm.cmd run validate:site-layouts-local
npm.cmd run validate:domains-local
npm.cmd run validate:plans-contracts-local
npm.cmd run validate:stage-3-ui-local
npm.cmd run validate:whatsapp
```

Checks complementares:

```powershell
node --check .\api\catalog.js
node --check .\api\orders\create.js
python -m py_compile .\scripts\apply-site-config.py
git diff --check
```

Para JSONs principais:

```powershell
node -e "for (const f of ['package.json','package-lock.json','site.config.json','vercel.json','site.webmanifest']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('JSON OK')"
```

### Scripts destrutivos

Nao rode:

- `validate:stage-1-1:destructive`
- `validate:stage-2:destructive`
- `validate:stage-3:destructive`

As versoes sem sufixo destrutivo estao bloqueadas por seguranca.

## 5. Convencoes

### Nomes de arquivos

- APIs: nomes claros por recurso ou catch-all quando ja existir padrao.
- Stores: `<dominio>-store.cjs`.
- Validacoes: `validate-<area>-local.mjs` para checks locais seguros.
- Documentos estrategicos: `INOVAS-FOOD-<TEMA>.md`.
- ADRs: `docs/adr/ADR-000-titulo.md`.

### Funcoes

- Usar nomes verbais e especificos: `getPublicCatalogState`, `updateDeliverySettings`, `createOrder`.
- Funcoes de validacao devem usar prefixo `assert` quando lancam erro.
- Funcoes de normalizacao devem usar prefixo `normalize`.
- Funcoes de serializacao devem usar prefixo `serialize`.
- Funcoes de construcao de payload devem usar prefixo `build`.

### Variaveis

- Usar `camelCase` em JS.
- Usar constantes em `UPPER_SNAKE_CASE`.
- Nao introduzir abreviacoes novas sem necessidade.
- Manter `restaurantKey`/`restaurant_key` enquanto a plataforma estiver em modo default-only.

### Stores

- Store deve concentrar persistencia e regras de dados do dominio.
- API nao deve acessar banco diretamente se ja existe store para o dominio.
- Cada store deve preservar fallback local quando o padrao atual ja usa `file`.
- Em producao sem `DATABASE_URL`, stores criticas devem falhar de forma explicita quando aplicavel.

### APIs

- Validar metodo HTTP.
- Retornar `405` com header `Allow` quando metodo nao for permitido.
- Usar `parseJsonBody(req.body, { strict: true })` para payload obrigatorio.
- Usar `json(res, status, payload, headers)` de `lib/http.cjs`.
- Respostas de sucesso devem incluir `ok: true` quando o padrao local ja usa isso.
- Respostas de erro devem incluir `error` e `errorCode`.
- Nao expor stack trace ou segredo.

### CSS

- Publico: `styles.css`.
- Admin: `admin/admin.css`.
- Nao alterar layout visual sem tarefa especifica.
- Evitar criar estilos paralelos quando ja existe padrao no arquivo atual.
- Preservar classes usadas por testes e scripts de validacao.

### Documentacao

- Documentar decisoes grandes em ADR.
- Documentar riscos e tradeoffs.
- Nao prometer funcionalidade que ainda nao existe.
- Separar claramente "atual", "preparado" e "futuro".

### Commits

- Commits pequenos, tematicos e revisaveis.
- Separar docs, codigo, assets e evidencias.
- Nao commitar `.env`, `.tmp`, `.codex-tools`, `.data`, logs, dumps ou backups locais.

## 6. Como Criar um Novo Modulo

Exemplo: adicionar modulo Fidelidade.

Antes de implementar, validar se o modulo pertence a V1.5 conforme roadmap e se existe decisao de produto aprovada.

### Arquivos normalmente envolvidos

Possiveis pontos, dependendo do escopo real:

- `lib/master-platform-store.cjs`: recurso comercial/plano/feature flag, se o modulo for controlado por plano.
- `lib/user-permissions.cjs`: novas permissoes, se houver acoes administrativas.
- `lib/<modulo>-store.cjs`: persistencia e regras do dominio.
- `lib/admin-api.cjs`: rotas administrativas.
- `api/admin/[...action].js`: normalmente nao muda, pois delega para `lib/admin-api.cjs`.
- `admin/admin.js`: UI e estado do gestor.
- `admin/admin.css`: estilos do gestor.
- `scripts/validate-<modulo>-local.mjs`: validacao segura local.
- `INOVAS-FOOD-*.md` ou ADR: documentacao se houver decisao arquitetural.

### Padrao a seguir

1. Confirmar escopo no roadmap.
2. Definir contrato de dados sem quebrar dados existentes.
3. Criar store separada para o dominio.
4. Expor via API administrativa seguindo `errorCode` e permissoes.
5. Proteger por plano/feature flag se for modulo comercial.
6. Proteger por permissao se houver acoes de usuario.
7. Criar validacao local segura.
8. Atualizar documentacao.

### O que nao fazer

- Nao misturar regras de fidelidade dentro de `order-store.cjs` sem necessidade.
- Nao criar `restaurant_id` agora.
- Nao ativar multi-restaurante real.
- Nao alterar checkout existente para acomodar modulo futuro sem requisito aprovado.

## 7. Como Criar uma Nova API

### Padrao estrutural

API nova deve ser fina e delegar para `lib/`.

Exemplo conceitual:

```text
api/<recurso>.js
  -> valida metodo
  -> valida JSON/origem/sessao
  -> chama lib/<recurso>-store.cjs ou lib/<recurso>-api.cjs
  -> retorna JSON padronizado
```

### Validacoes

- Metodo HTTP.
- JSON valido.
- Tamanho de payload.
- Origem, quando endpoint publico.
- Sessao admin ou cliente, quando necessario.
- Permissao do usuario, quando endpoint admin.
- Plano/feature flag, quando modulo comercial.
- Regra de negocio existente.

### Permissoes

Para admin:

- Usar `requireAdminSession`.
- Usar `getAdminAccessContext`/fluxo existente de permissoes via `admin-api`.
- Verificar plano com `getPlanAccessForAdminModule` quando o recurso for comercial.

### Logs

Hoje a plataforma ainda nao tem logger estruturado completo. Enquanto isso:

- Nao registrar secrets.
- Nao registrar payloads completos de cliente quando contiver dados pessoais.
- Preferir mensagens objetivas e mascaradas.
- Seguir o plano de observabilidade documentado antes de ampliar logs.

### Erros

Usar `buildHttpError(statusCode, message, errorCode, extra)` quando precisar lancar erro controlado.

Respostas de erro devem seguir:

```json
{
  "error": "Mensagem segura para operador/cliente.",
  "errorCode": "codigo_estavel"
}
```

### Respostas

Sucesso:

```json
{
  "ok": true
}
```

Erro:

```json
{
  "error": "Mensagem.",
  "errorCode": "codigo"
}
```

Evitar mudar contratos existentes sem versionamento.

## 8. Como Criar uma Nova Tela

### Site Publico

Arquivos provaveis:

- Novo `.html` na raiz, se for pagina publica.
- `script.js`, se precisar comportamento publico.
- `styles.css`, se precisar estilos publicos.
- `site.config.json`/`site-config.js`, se depender de configuracao.
- APIs publicas, se precisar dados dinamicos.

Regras:

- Preservar layout visual existente.
- Nao quebrar SEO/metatags das paginas atuais.
- Evitar duplicar logica de carrinho, catalogo, login e entrega.
- Testar responsividade em mobile, tablet e desktop.

### Gestor

Arquivos provaveis:

- `admin/index.html`.
- `admin/admin.js`.
- `admin/admin.css`.
- `lib/admin-api.cjs`.
- Store do modulo em `lib/`.
- Validacao local em `scripts/`.

Regras:

- Respeitar permissoes.
- Respeitar plano/feature flag.
- Nao criar nova navegacao sem avaliar impacto nos testes.
- Manter feedback de erro claro.

### Painel Master

Arquivos provaveis:

- `admin/master.html`.
- `admin/master.js`.
- `lib/master-platform-store.cjs`.
- `lib/admin-api.cjs`.

Regras:

- Master nao deve virar atalho para burlar regra do gestor.
- Dados comerciais devem permanecer separados de operacao diaria.
- Nao ativar multi-restaurante real sem plano de tenant.

### Padroes de UI

- Seguir componentes e classes existentes.
- Evitar alteracao visual ampla em tarefa funcional.
- Preservar textos e labels que testes esperam.
- Garantir que estados vazio, carregando, erro e sucesso existam.

## 9. Como Funcionam

### Permissoes

Arquivo principal: `lib/user-permissions.cjs`.

Tipos:

- `MASTER`: acesso total, incluindo areas tecnicas.
- `DESENVOLVEDOR`: acesso total ao restaurante e permissoes tecnicas.
- `OWNER`: acesso total ao restaurante.
- `CUSTOM`: permissoes granulares.

Formato das permissoes:

```text
<modulo>_<acao>
```

Exemplos:

- `orders_view`
- `orders_edit`
- `financial_view`
- `settings_edit`

### Planos

Arquivo principal: `lib/master-platform-store.cjs`.

Planos atuais documentados:

- START
- PRO
- PREMIUM

O plano controla acesso comercial a recursos. Permissao de usuario e permissao comercial sao camadas diferentes.

### Feature Flags

Feature flags ficam no contexto do master/platform store. Algumas indicam recursos ativos, outras recursos futuros.

Regra: nao liberar recurso futuro apenas porque existe flag no estado. A flag precisa estar ligada a implementacao, permissao, plano, testes e decisao de produto.

### Branding

Arquivos:

- `lib/app-branding.cjs`
- `site.config.json`
- `site-config.js`
- `scripts/apply-site-config.py`

Branding centraliza marca, textos, imagens, identificadores e configuracao visual. Varios fallbacks ainda sao Tokyo-specific por compatibilidade.

### Configuracoes

Configuracoes publicas e administrativas aparecem em:

- `restaurant-settings-store.cjs`
- `delivery-settings-store.cjs`
- `site.config.json`
- `site-config.js`

### Restaurant Settings

`restaurant-settings-store.cjs` usa `restaurant_key` como preparacao. O valor atual operacional e `default`.

Nao trocar para `restaurant_id` nesta fase.

## 10. Fluxo Git

### Branch

Padrao recomendado:

- `feature/<tema>` para recurso.
- `fix/<tema>` para correcao.
- `docs/<tema>` para documentacao.
- `hotfix/<tema>` para emergencia.

### Commit

Boas mensagens:

- `docs: add developer handbook`
- `fix: validate order payload origin`
- `test: add admin permissions validation`

Separar commits por natureza:

- Documentacao.
- Codigo.
- Assets.
- Validacoes.
- Configuracao.

### PR

Um PR deve conter:

- Resumo.
- Escopo.
- Riscos.
- Testes executados.
- Prints/evidencias quando houver UI.
- Observacao sobre env/migrations, se aplicavel.

### Validacao

Antes de pedir review, rodar os checks seguros relevantes. Para mudanca ampla, rodar a suite completa documentada neste handbook.

### Deploy

Nao fazer deploy direto sem pipeline, preview, smoke test e aprovacao. Seguir `INOVAS-FOOD-CI-CD.md` e `INOVAS-FOOD-RELEASE-STRATEGY.md`.

## 11. Checklist Antes de Commit

### Git

```powershell
git status --short
git diff --check
```

Verificar:

- Nenhum `.env`.
- Nenhum arquivo temporario.
- Nenhum segredo.
- Nenhum dump/log local.
- Nenhuma alteracao fora do escopo.

### Lint/sintaxe JS

Nao ha script de lint formal ainda. Use sintaxe Node nos arquivos alterados:

```powershell
node --check .\caminho\arquivo.js
node --check .\caminho\arquivo.cjs
node --check .\caminho\arquivo.mjs
```

### JSON

```powershell
node -e "for (const f of ['package.json','package-lock.json','site.config.json','vercel.json','site.webmanifest']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('JSON OK')"
```

### Python

```powershell
python -m py_compile .\scripts\apply-site-config.py
```

### Validacoes seguras

```powershell
npm.cmd run validate:business-hours
npm.cmd run validate:admin-local
npm.cmd run validate:permissions-local
npm.cmd run validate:master-panel-local
npm.cmd run validate:platform-integration-local
npm.cmd run validate:site-layouts-local
npm.cmd run validate:domains-local
npm.cmd run validate:plans-contracts-local
npm.cmd run validate:stage-3-ui-local
npm.cmd run validate:whatsapp
```

### Testes

Se mexer em UI Playwright:

```powershell
npm.cmd run validate:stage-3-ui
```

## 12. Erros Comuns

### PowerShell

Use `npm.cmd`, `npx.cmd` e caminhos com `.\`.

Exemplo:

```powershell
npm.cmd run validate:admin-local
```

### `npm` vs `npm.cmd`

No PowerShell, `npm.cmd` evita problemas de resolucao de comando.

### Google Maps

`maps-config.js` contem chave publica client-side. Nao trocar agora sem tarefa especifica.

Antes de producao, a chave deve estar restrita por:

- HTTP referrer.
- APIs permitidas.
- Cotas/alertas.

### Variaveis

Problemas comuns:

- `DATABASE_URL` ausente em producao.
- `ADMIN_SESSION_SECRET` ausente.
- `CUSTOMER_SESSION_SECRET` ausente.
- `ALLOWED_PUBLIC_ORIGINS` incorreto.
- Secrets reais copiados para arquivo rastreado.

### Git

Problemas comuns:

- `.tmp/` ou `_tmp*` entrando no diff.
- `.env.production.local` aparecendo em status.
- Arquivos gerados misturados com codigo.
- Refatoracao grande junto com feature pequena.

### Vercel

Problemas comuns:

- Testar API sem `vercel dev`.
- Divergencia entre env local, preview e producao.
- Redirect/rewrite alterado sem smoke test.
- Deploy sem validar dominio e headers.

## 13. Roadmap Resumido

### V1

- Plataforma profissional estavel.
- Tokyo Sushi como Cliente Modelo.
- Site publico.
- Gestor.
- Painel Master.
- Usuarios e permissoes.
- Planos START, PRO e PREMIUM.
- Dominios/contratos simulados/preparados.
- Validacoes locais e pre-deploy.

### V1.5

- Operacao presencial e fidelizacao.
- QR Code mesa.
- PDV.
- Caixa.
- KDS.
- App garcom.
- Comanda digital.
- Fidelidade.
- Cashback.
- Cupons.

### V2

- IA operacional e marketing.
- IA WhatsApp.
- IA relatorios.
- IA estoque.
- IA marketing.
- Campanhas automaticas.
- Recuperacao de clientes.
- Alertas inteligentes.

### V2.5

- Entrega avancada por rota real.
- App entregador.
- Rastreamento em tempo real.
- Mapa no gestor.
- Historico de entregas.
- Ranking de entregadores.

### V3

- SaaS multi-restaurante completo.
- Onboarding automatico.
- Cobranca real.
- DNS/SSL automatico.
- App mobile.
- Marketplace de modulos.
- Isolamento real de dados por restaurante.

## 14. Boas Praticas

### O que nunca fazer

- Nunca commitar secrets.
- Nunca mexer em dados reais para teste.
- Nunca criar `restaurant_id` fora do plano aprovado.
- Nunca ativar multi-restaurante real por atalho.
- Nunca alterar dominio real sem aprovacao.
- Nunca quebrar cookies, headers, prefixo `TKY` ou rotas existentes sem versao/migracao.
- Nunca rodar script destrutivo sem backup e autorizacao formal.
- Nunca misturar refatoracao grande com feature.
- Nunca alterar layout visual em tarefa tecnica sem requisito claro.

### O que sempre fazer

- Ler `INOVAS-FOOD-PLATFORM-STATUS.md` antes de mudanca grande.
- Verificar ADRs em `docs/adr/`.
- Rodar validacoes seguras relevantes.
- Usar stores existentes.
- Manter APIs finas.
- Documentar decisoes e riscos.
- Preservar compatibilidade do Cliente Modelo.
- Separar permissao de usuario, plano comercial e feature flag.

### O que evitar

- Duplicar estado entre frontend e store.
- Criar nova convencao quando ja existe padrao.
- Introduzir dependencia externa sem justificativa.
- Adicionar campos globais que precisarao virar tenant-aware depois.
- Aumentar `script.js` e `admin/admin.js` sem plano de modularizacao.
- Usar logs com dados pessoais ou secrets.

## Tempo Estimado de Onboarding

Um desenvolvedor experiente levaria de 1 a 2 dias para entender a arquitetura geral usando toda a documentacao existente, e de 3 a 5 dias para contribuir com seguranca em modulos centrais como pedidos, permissoes, gestor ou stores.

Para uma contribuicao pequena e bem delimitada, como documentacao, validacao local ou ajuste isolado, o tempo pode cair para algumas horas.
