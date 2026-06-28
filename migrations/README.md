# INovas Food - Future Tenant Migrations

Status: documentacao futura, nao executavel.

Esta pasta descreve a ordem planejada de migrations para uma futura migracao multi-restaurante. Nenhum arquivo aqui deve ser aplicado automaticamente ao banco atual. Os arquivos usam `.md` de proposito para evitar execucao acidental como SQL.

## Regras

- Nao executar estas migrations agora.
- `tenant_id` e `restaurant_id` podem existir nas tabelas operacionais apenas como preparacao fisica segura.
- Manter `INOVAS_TENANT_MODE=default_only` como comportamento padrao ate o cutover real.
- Nao alterar dados reais.
- Nao quebrar `restaurant_key = "default"`.
- Antes de virar SQL real, cada etapa deve ter ADR aprovado, backup, teste local, teste staging, rollback e validacao de isolamento.

## Ordem Planejada

| Ordem | Arquivo | Objetivo |
| --- | --- | --- |
| 001 | `001_create_organizations.md` | Criar entidade comercial raiz |
| 002 | `002_create_restaurants.md` | Criar restaurantes vinculados a organizacoes |
| 003 | `003_create_restaurant_domains.md` | Mapear dominios para restaurantes |
| 004 | `004_create_restaurant_plans_contracts.md` | Normalizar planos, contratos e assinaturas |
| 005 | `005_create_users_and_restaurant_users.md` | Separar identidade de membership |
| 006 | `006_split_restaurant_settings_branding_delivery_integrations.md` | Separar settings, branding, delivery e integracoes |
| 007 | `007_prepare_catalog_scope.md` | Preparar catalogo para escopo por restaurante |
| 008 | `008_prepare_orders_scope.md` | Preparar pedidos para escopo por restaurante |
| 009 | `009_prepare_customers_reviews_scope.md` | Preparar clientes, CRM e avaliacoes |
| 010 | `010_prepare_finance_inventory_scope.md` | Preparar financeiro e estoque |
| 011 | `011_prepare_reports_feature_flags_audit_scope.md` | Preparar relatorios, flags e auditoria |
| 012 | `012_cutover_default_tenant_context.md` | Ativar contexto default-only antes do multi-restaurante real |
| 013 | `013_prepare_physical_tenant_persistence.md` | Adicionar escopo fisico tenant/restaurante aos dados operacionais |

## Regra de Cutover

A migracao so deve sair de default-only para multi-restaurante real quando:

- Todas as tabelas operacionais tiverem escopo.
- Todas as leituras/escritas passarem por contexto interno.
- Testes anti-vazamento estiverem verdes.
- Rollback estiver ensaiado.
- Tokyo Sushi continuar funcionando com dados e identificadores atuais.
