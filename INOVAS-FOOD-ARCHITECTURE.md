# INovas Food - Architecture Audit

Data da auditoria: 2026-06-25

Escopo: auditoria arquitetural para preparar crescimento de 1 restaurante para 10, 100 e 1000 restaurantes, sem implementar multi-restaurante, sem criar `restaurant_id`, sem alterar APIs, layout, dominio, regras de negocio ou dados reais.

## Resumo Executivo

A plataforma ja tem uma base acima da media para uma operacao de delivery: frontend publico, gestor, painel master, APIs serverless, stores separados por dominio, autenticacao administrativa, permissoes, contratos, planos, branding centralizado, feature flags e validacoes locais consistentes.

O principal limite para os proximos 5 anos nao esta na existencia de modulos, mas no isolamento de escopo. Hoje a operacao real continua sendo global/default. Apenas parte da camada master/usuarios/configuracoes ja usa `restaurant_key` como associacao preparatoria. Pedidos, clientes, catalogo, delivery, financeiro, estoque e avaliacoes ainda funcionam como dados de um unico restaurante.

O sistema pode crescer para V2 com baixo risco se a equipe preservar as APIs atuais, extrair contratos internos com cuidado, introduzir migracoes formais e planejar a futura chave de tenant antes de abrir multi-restaurante real.

## Diagrama Textual Atual

```text
Cliente publico
  -> index.html / cardapio.html / entrega.html / acompanhar.html / historico.html / avaliar.html
  -> site-config.js
  -> script.js
  -> styles.css
  -> APIs publicas
       /api/catalog
       /api/delivery-settings
       /api/restaurant-settings
       /api/orders/create
       /api/customer/*

Gestor restaurante
  -> admin/login.html
  -> admin/index.html
  -> admin/admin.js
  -> admin/admin.css
  -> middleware.js protege /admin e /api/admin
  -> /api/admin/[...action].js
       -> lib/admin-api.cjs
       -> lib/admin-auth.cjs
       -> lib/user-permissions.cjs
       -> lib/master-platform-store.cjs
       -> stores de dominio

Painel Master
  -> admin/master.html
  -> admin/master.js
  -> middleware.js exige userType MASTER para HTML
  -> /api/admin/master/*
       -> lib/admin-api.cjs
       -> lib/master-platform-store.cjs
       -> metricas agregadas de pedidos, clientes, avaliacoes e financeiro

Stores
  -> Neon quando DATABASE_URL existe
  -> arquivos .data em desenvolvimento local
  -> disabled em producao sem DATABASE_URL

Configuracao e marca
  -> site.config.json
  -> site-config.js
  -> lib/app-branding.cjs
  -> scripts/apply-site-config.py
```

## Camadas

### Frontend Publico

Arquivos principais:

- `index.html`, `cardapio.html`, `entrega.html`, `acompanhar.html`, `historico.html`, `avaliar.html`, `trabalhe-conosco.html`, `404.html`.
- `script.js` concentra configuracao runtime, catalogo base, carrinho, login do cliente, historico, entrega, mapas, horario de funcionamento, avaliacoes e pedidos.
- `styles.css` concentra o visual publico.
- `site-config.js` injeta `window.TOKYO_SITE_CONFIG` e dados de branding/layout.

Responsabilidades atuais:

- Exibir cardapio, banners, categorias, busca e produto.
- Persistir carrinho e historico em `localStorage`.
- Autenticar cliente por codigo/WhatsApp.
- Criar pedidos via `/api/orders/create`.
- Consultar configuracoes publicas de catalogo, delivery e restaurante.
- Calcular/validar entrega com ViaCEP e Google Maps quando disponivel.

Risco de escala:

- `script.js` tem cerca de 429 KB e 11.762 linhas, com muitos dominios em um unico bundle.
- O catalogo base ainda e extraido do proprio `script.js` por `lib/catalog-store.cjs`, o que acopla dado operacional a UI publica.
- Storage local do cliente usa chaves Tokyo-legadas; isso nao impede a V2, mas precisa de plano de compatibilidade antes de white-label/SaaS.

### Gestor

Arquivos principais:

- `admin/login.html`, `admin/index.html`.
- `admin/admin.js` com cerca de 510 KB e 12.572 linhas.
- `admin/admin.css` com cerca de 344 KB e 10.489 linhas.
- `admin/orders-production-restore.css` mantem historico/restauracao de layout de pedidos.

Responsabilidades atuais:

- Login administrativo.
- Dashboard de pedidos.
- Kanban/status de pedido.
- Catalogo e promocoes.
- Delivery.
- Configuracoes do restaurante/layout/SEO.
- Financeiro.
- Estoque.
- Clientes/CRM.
- Avaliacoes.
- Usuarios e permissoes.

Risco de escala:

- O gestor ja tem modulos suficientes, mas o bundle e monolitico.
- Carregamento inicial do gestor tende a piorar conforme novas areas forem adicionadas.
- A UI chama muitas rotas diretamente de `admin/admin.js`; quando houver 100 restaurantes, sera importante separar estado por modulo e padronizar cache/invalidation.

### Painel Master

Arquivos principais:

- `admin/master.html`.
- `admin/master.js`.
- `lib/master-platform-store.cjs`.

Responsabilidades atuais:

- Mostrar visao da plataforma.
- Representar restaurantes, planos, recursos, dominios, contratos, assinaturas, relatorios, logs e auditoria.
- Manter feature flags comerciais.
- Simular preparo para `restaurant_key`.

Ponto importante:

- O painel master e uma boa fundacao conceitual, mas ainda nao e multi-restaurante real. `resolveRestaurantByHost` sempre retorna a operacao default. O proprio snapshot declara `multiRestaurantActive: false`.

### APIs

| Rota | Handler | Autenticacao | Stores principais |
| --- | --- | --- | --- |
| `/api/catalog` | `api/catalog.js` | Publica | `catalog-store`, `review-store` quando `publicView=reviews` |
| `/api/delivery-settings` | `api/delivery-settings.js` | Publica | `delivery-settings-store` |
| `/api/restaurant-settings` | `api/restaurant-settings.js` | Publica | `restaurant-settings-store` |
| `/api/orders/create` | `api/orders/create.js` | Guarda publica + cliente opcional | `catalog-store`, `restaurant-settings-store`, `order-store`, `customer-auth` |
| `/api/customer/[...action]` | `lib/customer-api.cjs` | Sessao cliente quando necessario | `customer-auth`, `order-store`, `order-payload` |
| `/api/admin/[...action]` | `lib/admin-api.cjs` | Sessao admin + permissoes + plano | todos os stores administrativos |
| `/api/auth/send-whatsapp-code` | `api/auth/send-whatsapp-code.js` | Publica controlada | `whatsapp-cloud`, verificacao cliente |

Observacao: `api/admin/[...action].js` e `api/customer/[...action].js` sao wrappers finos que delegam para `lib/admin-api.cjs` e `lib/customer-api.cjs`.

### Autenticacao

Administrativa:

- `lib/admin-auth.cjs`.
- Cookie `tokyo_admin_session` vindo de `IDENTIFIERS.cookieNames.adminSession`.
- Sessao assinada por HMAC, validade de 12 horas.
- Password hashing com `scrypt`.
- `middleware.js` protege `/admin`, `/admin/:path*` e `/api/admin/:path*`.

Cliente:

- `lib/customer-auth.cjs`.
- Cookies `tokyo_customer_session` e `tokyo_customer_login_challenge`.
- Headers `x-tokyo-customer-client-token` e `x-tokyo-customer-key`.
- Fluxo usado por historico, pedido ativo e login por codigo.

Ponto de escala:

- Cookies e headers estao acoplados a Tokyo por compatibilidade. Para SaaS, a troca deve ser planejada como versionamento/alias, nao como rename simples.

### Permissoes

Arquivo principal: `lib/user-permissions.cjs`.

Modelo atual:

- Tipos: `MASTER`, `DESENVOLVEDOR`, `OWNER`, `CUSTOM`.
- Modulos e acoes por permissao.
- Tabela `admin_users` ja tem `restaurant_key`, mas usa `RESTAURANT_KEY = "default"`.
- `login TEXT NOT NULL UNIQUE` e global.
- Snapshot informa `restaurantIdImplemented: false`.

Risco futuro:

- Login unico global simplifica hoje, mas em SaaS pode impedir o mesmo email/login em organizacoes diferentes.
- A permissao precisa ficar subordinada a tenant/organizacao/restaurante antes de multi-restaurante real.

### Planos, Contratos e Feature Flags

Arquivo principal: `lib/master-platform-store.cjs`.

Modelo atual:

- Planos e recursos comerciais ficam no estado master.
- Contrato atual do restaurante modelo fica como PREMIUM/ACTIVE.
- Feature flags incluem modulos comerciais, inclusive IA/WhatsApp como futuro.
- `getPlanAccessForAdminModule` protege acoes administrativas por plano/contrato/recurso.

Ponto forte:

- A separacao entre permissao de usuario e permissao comercial ja existe.

Ponto de atencao:

- O estado master fica em um unico registro por `state_key` (`inovas_food_platform`), com JSON grande. Para 100/1000 restaurantes, isso deve evoluir para tabelas normalizadas.

### Branding, Layouts e Configuracoes

Arquivos principais:

- `site.config.json`.
- `site-config.js`.
- `lib/app-branding.cjs`.
- `scripts/apply-site-config.py`.
- `lib/restaurant-settings-store.cjs`.

Modelo atual:

- `app-branding.cjs` centraliza marca, assets, textos, identificadores, flags e templates.
- `restaurant-settings-store.cjs` permite ajustes de restaurante, visual, SEO, endereco, horarios e base de entrega.
- Layouts e temas publicos sao configuraveis no gestor.

Ponto forte:

- Existe uma camada clara de configuracao e branding.

Risco:

- Muitos fallbacks ainda sao Tokyo-specific; isso e aceitavel enquanto o dominio atual nao mudar, mas precisa ser classificado como compatibilidade legada.

### Delivery

Arquivos principais:

- `lib/delivery-settings-store.cjs`.
- `lib/restaurant-settings-store.cjs`.
- `script.js`.
- `maps-config.js`.

Modelo atual:

- Configuracoes de entrega, faixas, entregadores, frete gratis, retirada, disponibilidade e area.
- Frontend usa ViaCEP e Google Maps quando disponivel.
- Pedido usa validacao de horario antes da criacao.

Risco:

- Delivery e configuracao global. Em multi-restaurante precisara de escopo por restaurante, area de entrega por unidade e cache por tenant.

### Pedidos

Arquivo principal: `lib/order-store.cjs`.

Tabelas atuais:

- `customers`
- `orders`
- `order_items`
- `order_status_events`

Indices atuais:

- `orders_status_created_at_idx`
- `orders_customer_key_created_at_idx`
- `orders_request_signature_idx`
- `order_items_order_id_idx`
- `order_status_events_order_id_created_at_idx`
- `order_status_events_admin_login_created_at_idx`
- `order_status_events_action_created_at_idx`

Pontos fortes:

- Tem idempotencia por `customer_key` + `request_signature`.
- Tem eventos de status.
- Tem dashboard e auditoria.

Riscos:

- Nao ha escopo por tenant/restaurante.
- `public_id` e `customer_key` sao unicos globais.
- Dashboard faz varias consultas agregadas separadas; em 1000 restaurantes isso deve virar agregacao por escopo e/ou materializacao.

### Financeiro

Arquivo principal: `lib/finance-store.cjs`.

Modelo atual:

- Fechamentos por `period_key`.
- Financeiro administrativo usa pedidos para montar resumos e salvar fechamento.

Risco:

- `period_key` global colide em multi-restaurante.
- Fechamento precisa de escopo por restaurante, caixa/canal e periodo operacional.

### Estoque

Arquivo principal: `lib/inventory-store.cjs`.

Modelo atual:

- Estado runtime unico por `state_key`.
- Itens, ajustes e visao administrativa dentro de JSON.

Risco:

- Para 100 restaurantes, estoque precisa de tabela normalizada por local/unidade/item/lote/movimento.
- Para 1000, precisa evitar JSON unico por restaurante com historico ilimitado.

### Relatorios

Arquivos principais:

- `lib/admin-metrics.cjs`.
- `lib/order-store.cjs`.
- `lib/master-platform-store.cjs`.
- `lib/admin-api.cjs`.

Modelo atual:

- Relatorios dependem principalmente de pedidos, clientes, reviews e financeiro.
- Master monta snapshot com chamadas para listas/metricas existentes.

Risco:

- Relatorio operacional ainda e calculado on demand.
- Multi-tenant exigira filtros obrigatorios, agregacoes materializadas e limites por periodo.

### Usuarios

Arquivo principal: `lib/user-permissions.cjs`.

Modelo atual:

- Usuarios gerenciaveis pelo gestor.
- Permissoes granulares por modulo/acao.
- Seed/config via env para admin inicial.

Risco:

- `login` unico global.
- Usuarios ainda estao fixados em `restaurant_key default`.
- SaaS exigira separacao entre identidade, membership, papel e escopo.

## Stores e Dados

| Store | Arquivo | Estado atual | Preparacao multi-tenant |
| --- | --- | --- | --- |
| Branding | `lib/app-branding.cjs` | Config central com fallbacks Tokyo | Precisa namespace por tenant/dominio no futuro |
| Master | `lib/master-platform-store.cjs` | `restaurant_key default`, JSON de plataforma | Boa fundacao conceitual; precisa normalizar por entidade |
| Usuarios | `lib/user-permissions.cjs` | `restaurant_key default`, login global | Precisa membership por tenant/org/restaurante |
| Restaurante | `lib/restaurant-settings-store.cjs` | `restaurant_key` como PK | Ja aponta caminho; ainda single default |
| Catalogo | `lib/catalog-store.cjs` | Overrides e runtime globais | Precisa escopo por restaurante/canal |
| Pedidos | `lib/order-store.cjs` | Pedidos/clientes globais | Precisa escopo obrigatorio antes de multi-restaurante |
| Delivery | `lib/delivery-settings-store.cjs` | Config global | Precisa escopo por unidade/raio/faixa |
| Financeiro | `lib/finance-store.cjs` | Fechamento por periodo global | Precisa escopo por restaurante/caixa/canal |
| Estoque | `lib/inventory-store.cjs` | Estado runtime global | Precisa item/local/movimento por restaurante |
| Avaliacoes | `lib/review-store.cjs` | Reviews globais | Precisa escopo por restaurante/pedido/cliente |
| CRM | `lib/customer-crm-store.cjs` | Perfil por `customer_key` global | Precisa cliente por tenant e identidade global opcional |

## Acoplamentos com Tokyo Sushi

### Alto Impacto

| Local | Tipo | Motivo |
| --- | --- | --- |
| `site.config.json` e `site-config.js` | dominio, marca, cookies, storage, headers, globals | Contrato de runtime e compatibilidade publica/admin |
| `lib/app-branding.cjs` | fallbacks centrais Tokyo/TKY | Afeta todos os consumidores de configuracao |
| `lib/admin-auth.cjs` | cookie admin `tokyo_admin_session` | Alteracao derruba sessoes e testes |
| `lib/customer-auth.cjs` | cookies/headers de cliente | Alteracao quebra historico, tracking e login cliente |
| `lib/order-store.cjs` | prefixo `TKY` de pedido | Alteracao afeta identificadores publicos |
| `vercel.json` | redirect dominio Tokyo | Alteracao mexe em dominio real, proibido nesta tarefa |
| `tests` e `scripts/validate-*` | asserts de dominio/cookies/TKY | Protegem explicitamente a regra de nao mudar dominio atual |

### Medio Impacto

| Local | Tipo | Motivo |
| --- | --- | --- |
| `script.js` | variaveis `TOKYO_*`, localStorage, textos e alt fallbacks | Grande alcance, mas parte vem de config |
| `admin/admin.js` | branding, textos, placeholders, `Gestor Tokyo` | Afeta UI administrativa e testes visuais |
| `admin/master.js` | textos "Tokyo Sushi/default" | Nao muda contrato publico, mas comunica escopo atual |
| `admin/index.html`, `admin/login.html`, `admin/master.html` | titulos, logos e labels | Conteudo visivel, proibido alterar layout/marca agora |
| `maps-config.js` | chave/global Google Maps Tokyo | Precisa plano de seguranca/config no futuro |
| `scripts/apply-site-config.py` | templates/fallbacks Tokyo | Ferramenta de geracao de config, alto alcance operacional |

### Baixo Impacto

| Local | Tipo | Motivo |
| --- | --- | --- |
| `package.json` | nome `tokyo-site` | Nome interno, nao quebra runtime |
| Comentarios e docs historicos | referencias Tokyo | Baixo risco se tratados em etapa de limpeza |
| Fixtures locais e mocks | `admin@tokyo.test`, `TKY-*` | Sao intencionais para validacao atual |
| Assets com `tokyo` no nome | logos/imagens | Devem permanecer enquanto dominio/marca atual nao mudar |

## Mapa Futuro Para Tenant

Nao implementar agora. Este mapa e apenas tecnico.

| Area | Chave futura provavel | Onde entraria | Observacao |
| --- | --- | --- | --- |
| Resolver dominio -> restaurante | `tenant_id`, `restaurant_id` | `middleware.js`, `master-platform-store`, camada de request context | Deve nascer antes de APIs multi-restaurante |
| Pedidos | `restaurant_id`, `tenant_id` | `orders`, `order_items`, `order_status_events` | Filtro obrigatorio em toda leitura/escrita |
| Clientes | `tenant_id`, `customer_id`, talvez identidade global | `customers`, `customer_crm_profiles`, customer auth | Evitar misturar historico entre restaurantes |
| Catalogo | `restaurant_id` | `catalog_item_overrides`, `catalog_promotions`, `catalog_runtime_state` | PKs atuais globais precisarao virar compostas |
| Delivery | `restaurant_id`, `delivery_zone_id` | `delivery_settings`, mapas, faixas, areas | Pode evoluir para multi-unidade |
| Configuracoes do restaurante | `restaurant_id` | `restaurant_settings` | `restaurant_key` atual e ponte conceitual |
| Usuarios | `organization_id`, `restaurant_id`, `membership_id` | `admin_users` e permissoes | Separar identidade de vinculo |
| Planos/contratos | `organization_id`, `subscription_id` | master store | Contrato pode ser por organizacao, nao por restaurante isolado |
| Financeiro | `restaurant_id`, `cash_register_id`, `period_id` | `finance_closings` | `period_key` global nao escala |
| Estoque | `restaurant_id`, `inventory_location_id` | `inventory_runtime_state` | Precisa movimentos normalizados |
| Avaliacoes | `restaurant_id`, `order_id`, `customer_id` | `customer_reviews` | Moderacao e exibicao por restaurante |
| Relatorios | `tenant_id`, `restaurant_id` | admin metrics/master reports | Agregacoes por periodo e escopo |
| Feature flags | `organization_id`, `restaurant_id` | master store/admin payload | Flags comerciais por plano e override |
| Apps externos | `tenant_id`, `provider_account_id` | WhatsApp, Meta, iFood, Rappi, Maps, pagamentos | Cada credencial deve ter dono e ambiente |

## Contratos Que Nao Devem Ser Mexidos Agora

- Dominio `tokyosushidelivery.com.br`.
- Cookies `tokyo_admin_session`, `tokyo_customer_session`, `tokyo_customer_login_challenge`.
- Headers `x-tokyo-customer-client-token`, `x-tokyo-customer-key`.
- Prefixo publico `TKY`.
- Globais `TOKYO_SITE_CONFIG`, `TokyoBusinessHours`, `TokyoStoreHours`, `TOKYO_GOOGLE_MAPS_API_KEY`.
- Rotas atuais de API.
- Layouts publico/admin.
- Regras de negocio de pedido, horario, delivery, financeiro e permissoes.

## Conclusao

A arquitetura esta bem organizada para uma plataforma ainda single-restaurant, com varios pontos ja preparados conceitualmente para evoluir. O proximo passo correto nao e criar multi-restaurante agora, e sim reduzir os acoplamentos estruturais que encarecem a migracao: monolitos JS/CSS, stores repetidos, falta de migracoes formais, dados globais em tabelas centrais e contratos legados sem namespace.
