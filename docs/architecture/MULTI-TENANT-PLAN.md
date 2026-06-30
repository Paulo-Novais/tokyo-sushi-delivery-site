# INOVAS FOOD - Plano Multi-Tenant V2.0

Status: preparacao documental.
Escopo: plano tecnico, sem alterar banco, APIs, autenticacao, deploy, commit ou tag.

## 1. Situacao Atual

A plataforma possui fundacao multi-tenant inicial:

- `tenantContext` com `tenantId`, `restaurantId`, `restaurantKey`, `restaurantName`.
- Modo default em `lib/tenant-context.cjs`: `default_only`.
- Modos previstos: `pilot` e `strict`.
- Restaurante atual padrao: `restaurantKey: "default"`.
- Tenant fisico padrao: `tenant_default`.
- Restaurante fisico padrao: `restaurant_default`.
- Onboarding de restaurante em `lib/admin-api.cjs` via grupo `master`.
- Vinculo comercial `seller_id` ja previsto no onboarding.

O sistema ainda opera principalmente com um restaurante real publicado: Tokyo Sushi Delivery.

## 2. Separacao de Conceitos

Para V2.0, estes conceitos precisam ficar definitivos:

- `tenantId`: identificador fisico/logico do tenant no banco.
- `restaurantId`: identificador fisico do restaurante.
- `restaurantKey`: chave historica/operacional usada pelo codigo atual.
- `restaurantSlug`: slug publico legivel para URL e painel.
- `restaurantDomain`: dominio principal ou dominio customizado.
- `organizationId`: grupo empresarial futuro, caso um cliente tenha varios restaurantes.
- `sellerId`: usuario vendedor responsavel pela aquisicao.

Recomendacao: usar `tenantId + restaurantId` como isolamento primario. Manter `restaurantKey` como compatibilidade e indice auxiliar ate cutover completo.

## 3. Hipoteses Single-Restaurant Encontradas

Pontos que ainda assumem restaurante unico ou default:

- `RESTAURANT_KEY = "default"` em stores e permissoes.
- `DEFAULT_TENANT_MODE = "default_only"` em `lib/tenant-context.cjs`.
- `site-config.js` e `site.config.json` centrados em Tokyo Sushi Delivery.
- Storage keys publicas com prefixo `tokyo_*`.
- Headers/cookies com nomes historicos `tokyo_*`.
- Textos publicos e SEO com Tokyo como fallback.
- `script.js` carrega configuracao publica default.
- Admin tem drafts/fallbacks de restaurante com Tokyo/default.
- Arquivos de imagem publica ainda sao do cliente Tokyo, o que e correto para o site publico atual, mas precisa virar configuracao por restaurante.

Impacto: dominios futuros podem herdar marca, cookie, SEO ou dados do Tokyo se a resolucao de tenant falhar.
Risco: exposicao cruzada, pedido no restaurante errado, branding errado, suporte confuso.
Prioridade: alta.

## 4. Tabelas e Dados com Escopo de Restaurante

Entidades operacionais que devem sempre carregar `tenant_id`, `restaurant_id` e `restaurant_key`:

- `orders`
- `order_items`
- `order_status_events`
- `customers`
- `customer_crm_profiles`
- `customer_reviews`
- `catalog_item_overrides`
- `catalog_promotions`
- `catalog_runtime_state`
- `delivery_settings`
- `restaurant_settings`
- `inventory_runtime_state`
- `finance_closings`
- `scheduled_orders` ou equivalente futuro
- `audit_logs` operacionais

Entidades de plataforma:

- `organizations`
- `restaurants`
- `restaurant_domains`
- `plans`
- `contracts`
- `subscriptions`
- `system_users`
- `restaurant_users`
- `seller_restaurant_links`
- `platform_audit_logs`

## 5. Campos Minimos por Tipo

Restaurantes:

- `id` ou `restaurant_id`
- `tenant_id`
- `restaurant_key`
- `restaurant_slug`
- `restaurant_domain`
- `name`
- `trade_name`
- `status`
- `plan_key`
- `seller_id`
- `created_by`
- `updated_by`
- `deleted_at`

Usuarios do sistema:

- `id`
- `email/login`
- `user_type`
- `status`
- `platform_scope`
- `created_by`
- `updated_by`
- `deleted_at`

Usuarios de restaurante:

- `id`
- `email/login`
- `user_type`
- `tenant_id`
- `restaurant_id`
- `restaurant_key`
- `status`
- `created_by`
- `updated_by`
- `deleted_at`

Registros operacionais:

- `tenant_id`
- `restaurant_id`
- `restaurant_key`
- `created_by`
- `updated_by`
- `deleted_at` quando houver exclusao logica.

## 6. APIs por Escopo

Separacao recomendada para V2.0:

- Publico: `/api/public/:restaurantScope/*`
- Cliente: `/api/customer/:restaurantScope/*`
- Restaurante/Admin operacional: `/api/admin/restaurant/*`
- Sistema/Plataforma: `/api/admin/platform/*`
- Master interno: `/api/admin/master/*`

Scopes propostos:

- `masterScope`: acesso total, sem restaurante obrigatorio.
- `platformScope`: usuario de sistema com acesso a plataforma.
- `sellerScope`: vendedor acessa clientes vinculados por `seller_id`.
- `restaurantScope`: usuario de restaurante acessa somente seu restaurante.
- `ownerScope`: OWNER administra usuarios e configuracoes do proprio restaurante.

Recomendacao: cada rota deve declarar escopo esperado, permissoes, plano e necessidade de tenant.

## 7. Resolucao de Tenant

Fluxo futuro recomendado:

1. Resolver host/dominio.
2. Buscar `restaurantDomain`.
3. Resolver `tenantId`, `restaurantId`, `restaurantKey`, `restaurantSlug`.
4. Validar status do restaurante e contrato.
5. Aplicar escopo da rota.
6. Bloquear fallback `default` em modo `strict`, exceto em ambiente local/seed.

Estado atual:

- `default_only`: seguro para cliente unico.
- `pilot`: permite testes controlados.
- `strict`: deve ser usado apenas apos dados e dominios completos.

## 8. Cutover Proposto

Fase 1 - Preparacao:

- Criar checklist automatica para hardcoded `Tokyo`, `tokyo_`, `default`.
- Garantir que todos os stores recebam `tenantContext`.
- Separar rotas por escopo sem mudar comportamento.
- Documentar contratos de payload por modulo.

Fase 2 - Banco:

- Executar migrations em staging.
- Backfill de `tenant_id`, `restaurant_id`, `restaurant_key`.
- Criar indices compostos.
- Validar contadores de registros sem tenant.

Fase 3 - Dominio:

- Ativar resolucao por dominio em `pilot`.
- Cadastrar 1 restaurante teste.
- Validar pedidos, catalogo, CRM, estoque, financeiro e usuarios.

Fase 4 - Strict:

- Bloquear fallback silencioso.
- Exigir tenant resolvido para rotas publicas e operacionais.
- Manter bypass apenas para seeds e testes locais.

## 9. Problemas, Prioridade e Risco

| Item | Prioridade | Impacto | Risco |
| --- | --- | --- | --- |
| Fallback default em varios stores | Alta | Dados podem cair no restaurante errado | Alto em multi-restaurante |
| `site-config.js` global | Alta | Branding e SEO nao escalam | Medio/Alto |
| Cookies/storage com prefixo Tokyo | Media | Colisao entre restaurantes no mesmo navegador | Medio |
| Rotas admin misturadas | Alta | Dificulta isolamento por escopo | Alto |
| Filtros por restaurante no frontend | Media | Usuario sistema pode ver dados sem filtro claro | Medio |

## 10. Recomendacao Final

A V2.0 deve tratar multi-tenant como contrato estrutural, nao como filtro opcional. O restaurante `default` deve continuar existindo para Tokyo e legado, mas nao pode ser fallback invisivel em producao multi-restaurante. A chave de sucesso e migrar gradualmente para `tenantId + restaurantId`, mantendo `restaurantKey` como compatibilidade ate o cutover.
