# 009 - Prepare Customers And Reviews Scope

Status: futuro, nao executavel.

## Objetivo

Preparar clientes, CRM e avaliacoes para isolamento por restaurante.

## Dependencias

- `008_prepare_orders_scope`.
- Modelo de identidade cliente decidido.

## Tabelas Impactadas Futuramente

- `customers`
- `customer_crm_profiles`
- `customer_reviews`

## Mudancas Futuras Planejadas

- Escopar `customer_key` por restaurante ou introduzir identidade global + perfil por restaurante.
- Escopar CRM por restaurante.
- Escopar reviews por restaurante/pedido.

## Validacoes Futuras

- Historico do cliente default permanece igual.
- Cliente de restaurante A nao aparece no CRM de B.
- Review de A nao aparece no site de B.

## Rollback Futuro

- Preservar `customer_key` legado e voltar consultas para modo default-only.
