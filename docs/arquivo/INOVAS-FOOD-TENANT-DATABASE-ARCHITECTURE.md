# INovas Food - Tenant Database Architecture

Data: 2026-06-25

Escopo: preparacao documental para futura migracao multi-restaurante. Este documento nao cria tabelas, nao altera schema, nao executa migrations, nao muda APIs, nao altera dados reais e preserva `restaurant_key = "default"` como comportamento atual.

## Regra de Compatibilidade

Durante V1/V2, Tokyo Sushi continua sendo o restaurante operacional default.

Contratos que devem continuar funcionando:

- `restaurant_key = "default"`.
- Dominio atual.
- Cookies e headers atuais.
- Prefixo publico de pedido atual.
- APIs atuais.
- Dados atuais sem migracao automatica.
- Regras de negocio atuais.

## Modelagem Futura

Hierarquia alvo:

```text
Organization
  -> Restaurant
       -> Users / Memberships
       -> Operational Data
       -> Settings / Branding / Delivery / Integrations
```

Entidades futuras planejadas, sem criacao de tabelas nesta etapa:

- `organizations`
- `restaurants`
- `restaurant_domains`
- `restaurant_users`
- `restaurant_plans`
- `restaurant_contracts`
- `restaurant_settings`
- `restaurant_branding`
- `restaurant_delivery`
- `restaurant_integrations`

### Organization

Representa o cliente comercial da INovas Food: uma empresa, grupo, franquia ou operador independente.

Campos futuros sugeridos:

- `id`
- `public_key`
- `name`
- `legal_name`
- `document`
- `billing_email`
- `status`
- `plan_key`
- `created_at`
- `updated_at`

Responsabilidades:

- Dono comercial do contrato.
- Agrupar um ou muitos restaurantes.
- Centralizar billing, permissoes enterprise e relatorios consolidados.

Decisao:

- `organization_id` deve existir nas entidades comerciais e de administracao.
- Dados operacionais podem usar `restaurant_id` como escopo principal e derivar `organization_id` pelo restaurante.

### Restaurant

Representa uma operacao/unidade que recebe pedidos, tem cardapio, entrega, horarios, estoque e financeiro.

Campos futuros sugeridos:

- `id`
- `organization_id`
- `public_key`
- `legacy_restaurant_key`
- `name`
- `slug`
- `status`
- `timezone`
- `created_at`
- `updated_at`

Responsabilidades:

- Escopo obrigatorio dos dados operacionais.
- Base para dominio, branding, delivery, integracoes e usuarios.
- Ponte de compatibilidade com `restaurant_key = "default"`.

Decisao:

- `restaurant_id` sera a chave operacional futura.
- `legacy_restaurant_key` preserva `default` durante a transicao.

### Restaurant Domains

Mapeia dominios/subdominios para restaurantes.

Campos futuros sugeridos:

- `id`
- `organization_id`
- `restaurant_id`
- `domain`
- `domain_type`
- `status`
- `ssl_status`
- `is_primary`
- `created_at`
- `updated_at`

Responsabilidades:

- Resolver request publica para restaurante.
- Permitir dominio proprio sem alterar contrato de API.
- Controlar SSL, dominio primario e redirecionamentos.

### Restaurant Users

Membership entre identidade administrativa e restaurante/organizacao.

Modelo futuro sugerido:

```text
users
  -> identidade global: login, email, nome, senha/sso, status

restaurant_users
  -> organization_id
  -> restaurant_id
  -> user_id
  -> role
  -> permissions
  -> status
```

Responsabilidades:

- Permitir o mesmo usuario em varios restaurantes.
- Permitir papeis diferentes por unidade.
- Evitar `login UNIQUE` como limitador de SaaS multi-organizacao.

### Restaurant Plans

Representa plano contratado por organizacao/restaurante.

Campos futuros sugeridos:

- `id`
- `organization_id`
- `restaurant_id` opcional
- `plan_key`
- `status`
- `included_modules`
- `limits_json`
- `created_at`
- `updated_at`

Responsabilidades:

- Determinar recursos comerciais disponiveis.
- Apoiar feature flags por plano.
- Permitir overrides enterprise.

### Restaurant Contracts

Contrato comercial e status de assinatura.

Campos futuros sugeridos:

- `id`
- `organization_id`
- `restaurant_id` opcional
- `contract_number`
- `status`
- `billing_status`
- `starts_at`
- `ends_at`
- `next_billing_at`
- `metadata_json`

Responsabilidades:

- Controlar acesso comercial.
- Relacionar financeiro da plataforma, nao o financeiro do restaurante.
- Apoiar bloqueios por inadimplencia/contrato.

### Restaurant Settings

Configuracoes operacionais basicas do restaurante.

Campos futuros sugeridos:

- `restaurant_id`
- `timezone`
- `business_schedule_json`
- `address_json`
- `contact_json`
- `seo_json`
- `updated_by_user_id`
- `updated_at`

Responsabilidades:

- Configuracoes publicas e operacionais.
- Horario de funcionamento.
- Endereco/base de atendimento.

### Restaurant Branding

Marca visual e textos publicos.

Campos futuros sugeridos:

- `restaurant_id`
- `brand_name`
- `logo_url`
- `banner_url`
- `primary_color`
- `secondary_color`
- `theme`
- `layout`
- `public_text_json`
- `updated_at`

Responsabilidades:

- Separar marca de configuracao operacional.
- Permitir white-label por restaurante sem mexer em codigo.
- Preservar branding Tokyo durante compatibilidade.

### Restaurant Delivery

Configuracao de delivery por restaurante/unidade.

Campos futuros sugeridos:

- `restaurant_id`
- `status_json`
- `service_area_json`
- `fee_bands_json`
- `couriers_json` inicialmente ou tabelas normalizadas depois
- `pickup_json`
- `free_shipping_json`
- `updated_at`

Responsabilidades:

- Isolar raio, faixas e regras de entrega.
- Preparar rotas e app entregador.
- Evitar que uma loja use configuracao de outra.

### Restaurant Integrations

Credenciais, status e configuracoes de provedores externos.

Campos futuros sugeridos:

- `id`
- `organization_id`
- `restaurant_id`
- `provider`
- `environment`
- `status`
- `credentials_ref`
- `settings_json`
- `last_sync_at`
- `created_at`
- `updated_at`

Responsabilidades:

- WhatsApp, Meta, Google Maps, iFood, Rappi, gateways e Pix.
- Isolar credenciais por restaurante/organizacao.
- Permitir auditoria e rotacao de chaves.

## Tabelas Atuais

Inventario encontrado nos stores atuais:

| Tabela atual | Store | Estado atual | Futuro `restaurant_id`? | Futuro `organization_id`? | Continuara global? | Sera separada/normalizada? | Precisa migration? | Prioridade |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `customers` | `lib/order-store.cjs` | Cliente operacional global por `customer_key` | Sim | Indireto/possivel em tabela de identidade | Nao | Talvez separar identidade global e perfil por restaurante | Sim | Critica |
| `orders` | `lib/order-store.cjs` | Pedido global, `public_id` unico global | Sim | Derivado por restaurante | Nao | Nao inicialmente; adicionar escopo e indices | Sim | Critica |
| `order_items` | `lib/order-store.cjs` | Itens ligados a `orders.id` | Sim, denormalizado recomendado | Derivado | Nao | Nao inicialmente | Sim | Critica |
| `order_status_events` | `lib/order-store.cjs` | Eventos ligados a pedido | Sim, denormalizado recomendado | Derivado | Nao | Nao inicialmente | Sim | Critica |
| `customer_crm_profiles` | `lib/customer-crm-store.cjs` | Perfil CRM por `customer_key` global | Sim | Derivado/possivel | Nao | Sim, por restaurante e talvez identidade global | Sim | Alta |
| `customer_reviews` | `lib/review-store.cjs` | Avaliacoes globais | Sim | Derivado | Nao | Nao inicialmente | Sim | Alta |
| `catalog_item_overrides` | `lib/catalog-store.cjs` | Override por `item_id` global | Sim | Derivado | Nao | Pode virar PK composta `restaurant_id + item_id` | Sim | Alta |
| `catalog_promotions` | `lib/catalog-store.cjs` | Promocoes globais | Sim | Opcional para campanhas de rede | Nao | Talvez separar promo de rede/restaurante | Sim | Alta |
| `catalog_runtime_state` | `lib/catalog-store.cjs` | Estado unico por `state_key = current` | Sim | Derivado | Nao | PK composta `restaurant_id + state_key` | Sim | Alta |
| `delivery_settings` | `lib/delivery-settings-store.cjs` | Config unica por `settings_key` | Sim | Derivado | Nao | Pode migrar para `restaurant_delivery` | Sim | Alta |
| `restaurant_settings` | `lib/restaurant-settings-store.cjs` | Config por `restaurant_key`, default atual | Sim | Derivado | Nao | Separar settings, branding e delivery | Sim | Alta |
| `finance_closings` | `lib/finance-store.cjs` | Fechamento por `period_key` global | Sim | Derivado/possivel consolidado | Nao | Futuro caixa/periodo por restaurante | Sim | Alta |
| `inventory_runtime_state` | `lib/inventory-store.cjs` | Estado unico por `state_key` | Sim | Derivado | Nao | Sim, itens/movimentos/localizacao no futuro | Sim | Alta |
| `admin_users` | `lib/user-permissions.cjs` | Usuario admin com `restaurant_key default` e `login UNIQUE` | Via membership, nao na identidade | Sim via membership | Identidade pode ser global; membership nao | Sim, separar `users` e `restaurant_users` | Sim | Critica |
| `master_platform_state` | `lib/master-platform-store.cjs` | Estado master JSON com `restaurant_key default` | Parcial | Sim | Parte da configuracao de plataforma sim | Sim, normalizar entidades master | Sim | Alta |

## Stores e Bibliotecas Atuais

| Store/Biblioteca | Persiste dados? | Futuro tenant context? | Estrategia futura | Prioridade |
| --- | --- | --- | --- | --- |
| `lib/order-store.cjs` | Sim | Obrigatorio | Toda funcao deve receber contexto interno antes de ler/escrever | Critica |
| `lib/catalog-store.cjs` | Sim | Obrigatorio | Catalogo e promocoes por restaurante/canal | Alta |
| `lib/delivery-settings-store.cjs` | Sim | Obrigatorio | Delivery por restaurante/unidade | Alta |
| `lib/restaurant-settings-store.cjs` | Sim | Obrigatorio | Migrar de `restaurant_key` para `restaurant_id` com compatibilidade | Alta |
| `lib/customer-crm-store.cjs` | Sim | Obrigatorio | Perfil cliente por restaurante, identidade compartilhada opcional | Alta |
| `lib/review-store.cjs` | Sim | Obrigatorio | Avaliacoes por restaurante e pedido | Alta |
| `lib/finance-store.cjs` | Sim | Obrigatorio | Fechamentos por restaurante/caixa/periodo | Alta |
| `lib/inventory-store.cjs` | Sim | Obrigatorio | Estoque por restaurante/local/item | Alta |
| `lib/user-permissions.cjs` | Sim | Obrigatorio | Separar identidade e membership | Critica |
| `lib/master-platform-store.cjs` | Sim | Obrigatorio | Normalizar organizations/restaurants/domains/plans/contracts | Alta |
| `lib/app-branding.cjs` | Config | Sim | Branding por restaurante com fallback Tokyo | Media |
| `lib/admin-api.cjs` | Nao diretamente | Obrigatorio | Resolver contexto antes de cada rota protegida | Critica |
| `lib/customer-api.cjs` | Nao diretamente | Obrigatorio | Sessao cliente deve carregar escopo | Alta |
| `api/orders/create.js` | Nao diretamente | Obrigatorio | Criacao de pedido deve usar restaurante resolvido pelo request | Critica |
| `api/catalog.js` | Nao diretamente | Obrigatorio | Catalogo publico por dominio/restaurante | Alta |
| `api/delivery-settings.js` | Nao diretamente | Obrigatorio | Config publica por dominio/restaurante | Alta |
| `api/restaurant-settings.js` | Nao diretamente | Obrigatorio | Settings publico por dominio/restaurante | Alta |
| `api/customer/[...action].js` | Nao diretamente | Obrigatorio | Historico ativo por restaurante | Alta |
| `api/auth/send-whatsapp-code.js` | Nao diretamente | Sim | Templates/credenciais por restaurante | Media |
| `lib/admin-auth.cjs` | Sessao cookie | Sim | Sessao deve incluir membership/escopo sem quebrar cookie atual | Critica |
| `lib/customer-auth.cjs` | Sessao cookie/header | Sim | Sessao cliente deve incluir restaurante ou resolver por request | Alta |
| `lib/customer-verification.cjs` | Verificacao | Sim | Desafios por restaurante/cliente/dispositivo | Media |
| `lib/request-guard.cjs` | Nao | Sim | Origem/dominio deve resolver contexto | Alta |
| `lib/admin-metrics.cjs` | Nao | Obrigatorio | Metricas por restaurante e agregadas por organizacao/master | Alta |
| `lib/business-hours.cjs` | Nao | Indireto | Receber schedule ja resolvido por restaurante | Media |
| `lib/operational-day.cjs` | Nao | Indireto | Calculos por timezone/restaurante | Media |
| `lib/order-payload.cjs` | Nao | Indireto | Validar contra catalogo do restaurante | Alta |
| `lib/whatsapp-cloud.cjs` | Integracao | Sim | Credenciais/templates por restaurante | Media |
| `lib/http.cjs` | Nao | Nao | Pode continuar global | Baixa |

## APIs Impactadas no Futuro

| API | Impacto futuro | Motivo |
| --- | --- | --- |
| `/api/orders/create` | Critico | Criacao de pedido precisa escopo correto por dominio/restaurante |
| `/api/customer/*` | Alto | Historico, pedido ativo e sessao cliente devem ser isolados |
| `/api/catalog` | Alto | Cardapio e avaliacoes publicas dependem do restaurante |
| `/api/delivery-settings` | Alto | Taxas, areas e entrega sao por restaurante |
| `/api/restaurant-settings` | Alto | Branding/settings publicos sao por restaurante |
| `/api/admin/*` | Critico | Toda leitura/escrita admin precisa membership e escopo |
| `/api/admin/master/*` | Alto | Master deve consultar organizacoes/restaurantes de forma agregada |
| `/api/auth/send-whatsapp-code` | Medio | Integracao WhatsApp pode variar por restaurante |

## Riscos de Vazamento ou Mistura de Dados

### Critico

| Area | Risco | Mitigacao futura |
| --- | --- | --- |
| Pedidos | Admin de um restaurante listar/alterar pedido de outro | `TenantContext` obrigatorio em `order-store` + testes de isolamento |
| Clientes/CRM | Historico de cliente cruzar restaurantes | `customer_key` escopado ou tabela de membership cliente/restaurante |
| Usuarios admin | Usuario com login global receber permissao errada | Separar identidade global e `restaurant_users` |
| APIs admin | Rota esquecer filtro de escopo | Middleware/context resolver + store exige contexto |
| Relatorios | Dashboard/master agregar dados indevidos | Queries por escopo e agregacoes auditaveis |

### Alto

| Area | Risco | Mitigacao futura |
| --- | --- | --- |
| Catalogo | Restaurante exibir/preco de outro | PK composta por restaurante e cache por escopo |
| Delivery | Taxa/raio de uma loja aplicado em outra | `restaurant_delivery` por restaurante |
| Financeiro | Fechamento de caixa/periodo cruzado | `restaurant_id + period + caixa` |
| Estoque | Itens e saldos compartilhados indevidamente | Estoque por restaurante/local |
| Sessao admin | Cookie valido sem membership correto | Sessao com membership e revalidacao server-side |
| Feature flags | Modulo pago liberar para restaurante errado | Flags por organizacao/restaurante |

### Medio

| Area | Risco | Mitigacao futura |
| --- | --- | --- |
| Branding | Logo/texto errado por dominio | Resolver dominio antes do render/API |
| WhatsApp | Template/numero errado | Integracoes por restaurante |
| Google Maps | Chave/config comum demais | Credencial por ambiente e governanca |
| Avaliacoes | Review aparecer no restaurante errado | Review por restaurante/pedido |
| Cache/localStorage | Cliente manter estado legado Tokyo | Namespaces futuros com compatibilidade |

### Baixo

| Area | Risco | Mitigacao futura |
| --- | --- | --- |
| Nome de pacote | `tokyo-site` interno | Renomear em etapa sem impacto operacional |
| Fixtures | `TKY`, Tokyo em testes | Manter ate haver cenarios multi-tenant |
| Comentarios/docs antigas | Referencias Tokyo | Limpeza progressiva |

## Sequencia Conceitual de Migracao de Dados

1. Criar tabelas futuras vazias.
2. Criar organizacao default para Tokyo Sushi.
3. Criar restaurante default com `legacy_restaurant_key = "default"`.
4. Criar dominios atuais apontando para o restaurante default.
5. Criar memberships equivalentes aos admins atuais.
6. Adicionar colunas de escopo em tabelas operacionais em migration futura.
7. Popular escopo default em backfill controlado.
8. Criar indices compostos por escopo.
9. Validar leituras dual-read/default-only.
10. Ativar contexto interno em modo compatibilidade.
11. Ativar multi-restaurante apenas depois dos testes de isolamento.

## Decisoes de Nao Implementacao Agora

- Nao criar `restaurant_id` em tabelas existentes.
- Nao criar tabelas reais.
- Nao migrar `restaurant_key`.
- Nao executar SQL.
- Nao trocar cookies/headers.
- Nao alterar APIs publicas ou admin.
- Nao alterar `restaurant_key = "default"`.

## Relatorio de Impacto

Quanto precisara mudar para virar multi-restaurante:

- Banco: alto impacto. As tabelas operacionais precisam escopo e indices.
- Backend: alto impacto. Stores e APIs precisam contexto obrigatorio.
- Frontend: medio impacto. Publico pode resolver por dominio; gestor precisara contexto/membership.
- Master: medio-alto impacto. Conceito existe, mas precisa persistencia normalizada.
- Testes: alto impacto. Precisara suite anti-vazamento entre restaurantes.

Modulos praticamente preparados:

- Master conceitual de planos/contratos/feature flags.
- Permissoes por modulo/acao.
- Configuracoes de restaurante com `restaurant_key default`.
- Middleware admin/master.
- Separacao de stores por dominio.

Modulos que exigirao refatoracao:

- Pedidos.
- Clientes/CRM.
- Catalogo.
- Delivery.
- Financeiro.
- Estoque.
- Avaliacoes.
- Login/membership admin.
- Relatorios.

Arquitetura reaproveitavel:

- Aproximadamente 70% dos dominios e fluxos podem ser reaproveitados.
- O maior retrabalho esta em escopo de dados, nao em regra de negocio.

## Notas de Preparacao

| Area | Nota | Leitura |
| --- | ---: | --- |
| Banco | 52 | Stores bem separados, mas tabelas operacionais ainda globais |
| Backend | 68 | APIs e stores organizados; falta `TenantContext` obrigatorio |
| Frontend | 74 | Pode resolver por dominio/config; precisa namespacing futuro |
| Master | 78 | Conceito forte, persistencia ainda em JSON default |
| Gestor | 70 | Permissoes boas; precisa membership e escopo em toda chamada |
| Site Publico | 76 | Configuravel; precisa catalogo/delivery/settings por dominio |
| Seguranca | 66 | Boa auth atual; isolamento tenant ainda inexistente |
| Preparacao Multi-Tenant | 58 | Fundacao conceitual existe, dados ainda single-tenant |
| Preparacao SaaS | 62 | Planos/contratos ajudam; onboarding e billing real faltam |
| Preparacao Enterprise | 48 | Falta organizacao multi-unidade, SSO, auditoria forte e BI |

## Conclusao

A migracao multi-restaurante deve ser tratada como evolucao de isolamento de dados, nao como reescrita de produto. A INovas Food ja tem dominios bem separados e uma camada master promissora; o trabalho futuro sera introduzir contexto obrigatorio, migracoes versionadas, tabelas normalizadas e testes anti-vazamento antes de permitir qualquer restaurante alem do default.
