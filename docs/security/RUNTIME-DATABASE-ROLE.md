# Role minima do runtime do INOVAS Food

Esta matriz foi derivada das consultas SQL executadas por `lib/` e `api/` no
commit de seguranca que separa runtime e migrations. Ela nao inclui operacoes
DDL: em `NODE_ENV=production`, os stores apenas verificam se as relations
esperadas existem e falham com `database_migration_required` quando o schema
nao foi preparado.

## Conexoes

| Variavel | Role | Uso |
| --- | --- | --- |
| `MIGRATION_DATABASE_URL` | `neondb_owner` | Migrations e manutencao estrutural controlada. |
| `DATABASE_URL` | `inovas_app_<ambiente>` | Runtime de APIs e funcoes serverless. |

A role de runtime deve usar `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`,
`NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, limite de 50
conexoes, `search_path=pg_catalog,public`, nenhum ownership e nenhum membership.

## Matriz de tabelas

| Recurso | Operacoes | Justificativa |
| --- | --- | --- |
| `admin_users` | SELECT, INSERT, UPDATE, DELETE | Login, usuarios do restaurante, onboarding e desativacao controlada. |
| `auth_sessions` | SELECT, INSERT, UPDATE | Criacao, validacao e revogacao de sessoes. |
| `cash_payment_sets` | SELECT, INSERT | Idempotencia e registro do conjunto de pagamentos. |
| `cash_payments` | SELECT, INSERT | Persistencia dos meios e parcelas de pagamento. |
| `cash_register_audit_events` | SELECT, INSERT | Historico e auditoria do Caixa. |
| `cash_register_movements` | INSERT | Lancamentos financeiros gerados pelo Caixa. |
| `cash_register_sessions` | SELECT, INSERT, UPDATE | Abertura, consulta e fechamento do caixa. |
| `catalog_item_overrides` | SELECT, DELETE | Leitura e remocao de sobrescritas legadas. |
| `catalog_promotions` | SELECT, INSERT, UPDATE, DELETE | CRUD de promocoes do cardapio. |
| `catalog_runtime_state` | SELECT, INSERT, UPDATE | Estado versionado do cardapio e upsert. |
| `customer_crm_profiles` | SELECT, INSERT, UPDATE | Leitura e upsert do perfil CRM. |
| `customer_reviews` | SELECT, INSERT, UPDATE, DELETE | Fluxo publico e moderacao de avaliacoes. |
| `customers` | SELECT, INSERT, UPDATE | Upsert de cliente e `RETURNING id` na criacao de pedido. |
| `delivery_settings` | SELECT, INSERT, UPDATE | Leitura e upsert das configuracoes de entrega. |
| `dining_order_batches` | SELECT, INSERT | Envio incremental de itens para producao. |
| `dining_tab_items` | SELECT, INSERT, UPDATE, DELETE | Itens pendentes, enviados e remocao permitida. |
| `dining_tables` | SELECT, INSERT, UPDATE | Configuracao, ocupacao e liberacao de mesas. |
| `dining_tabs` | SELECT, INSERT, UPDATE | Abertura, totais e fechamento de comandas. |
| `finance_closings` | SELECT, INSERT, UPDATE | Consulta e upsert de fechamento financeiro. |
| `identities` | SELECT, INSERT, UPDATE | Provisionamento e ciclo de vida de identidades. |
| `inventory_runtime_state` | SELECT, INSERT, UPDATE | Estado agregado do estoque, sem baixa por ingrediente. |
| `master_platform_state` | SELECT, INSERT, UPDATE | Estado administrativo da plataforma. |
| `order_items` | SELECT, INSERT | Itens dos pedidos. |
| `order_status_events` | SELECT, INSERT | Historico de status dos pedidos. |
| `orders` | SELECT, INSERT, UPDATE | Criacao, painel e atualizacao de pedidos. |
| `platform_health_snapshots` | INSERT | Persistencia de snapshots operacionais. |
| `public_restaurant_routes` | SELECT, INSERT, UPDATE, DELETE | Projecao publica sincronizada de restaurantes. |
| `restaurant_memberships` | SELECT, INSERT, UPDATE | Provisionamento e dependencia das policies de identidade. |
| `restaurant_settings` | SELECT, INSERT, UPDATE | Leitura e upsert das configuracoes do restaurante. |
| `system_principals` | INSERT, UPDATE | Provisionamento e upsert de principals SYSTEM. |
| `system_support_sessions` | SELECT, INSERT, UPDATE | Inicio, validacao e revogacao de suporte explicito. |
| `tenant_health_scores` | INSERT, UPDATE | Upsert de saude por restaurante. |
| `user_audit_events` | INSERT | Registro imutavel de auditoria de usuarios. |

As tabelas `integration_health`, `invitations`, `password_reset_tokens`,
`permission_definitions`, `permission_overrides`, `platform_usage_daily`,
`restaurant_role_bindings`, `role_definitions`, `role_permission_bindings`,
`system_alerts` e `system_role_bindings` nao sao acessadas pelo runtime atual e
nao recebem privilegios.

## Outros objetos

| Recurso | Operacao | Justificativa |
| --- | --- | --- |
| Database `neondb` | CONNECT | Conexao pelo pool Neon. `TEMPORARY` nao e concedido. |
| Schema `public` | USAGE | Resolucao das tabelas permitidas. `CREATE` nao e concedido. |
| Sequences | Nenhuma | O catalogo auditado nao possui sequences; IDs sao gerados na aplicacao. |
| Views/materialized views | Nenhuma | Nenhum objeto desse tipo existe ou e utilizado. |
| Funcoes `public` | Nenhum grant direto | O runtime nao chama funcoes proprias. As rotinas `pgcrypto`, todas sem `SECURITY DEFINER`, continuam executaveis pelo grant padrao a `PUBLIC` do Neon. |
| Triggers | Nenhuma | Nenhum trigger existe no catalogo auditado. |

As policies RLS usam `app.audience`, `app.tenant_id`, `app.restaurant_id`,
`app.identity_id`, `app.login`, `app.support_mode` e
`app.support_session_id`, definidos por `lib/tenant-sql.cjs` em cada transacao.
