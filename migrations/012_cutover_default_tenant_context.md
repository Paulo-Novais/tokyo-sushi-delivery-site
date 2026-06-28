# 012 - Cutover Default Tenant Context

Status: futuro, nao executavel.

## Objetivo

Ativar `TenantContext` interno em modo default-only, ainda sem multi-restaurante real.

## Dependencias

- Todas as migrations anteriores planejadas e validadas.
- Suite de testes anti-vazamento criada.
- Rollback ensaiado.

## Mudancas Futuras Planejadas

- Resolver todo request para o restaurante default.
- Passar contexto interno a stores e APIs.
- Manter contratos externos iguais.
- Validar que `restaurant_key = "default"` continua operando.

## Validacoes Futuras

- Todas as validacoes existentes continuam passando.
- Testes tenant default-only passam.
- Tokyo Sushi nao muda visual, dominio, pedido, sessao ou admin.

## Rollback Futuro

- Desativar `TenantContext` via feature flag operacional.
- Reverter stores para modo legado default-only.
- Manter tabelas novas sem uso ate nova tentativa.
