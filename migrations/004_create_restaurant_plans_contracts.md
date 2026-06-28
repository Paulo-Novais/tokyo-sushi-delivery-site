# 004 - Create Restaurant Plans And Contracts

Status: futuro, nao executavel.

## Objetivo

Normalizar planos, contratos, assinaturas e recursos comerciais.

## Dependencias

- `001_create_organizations`.
- `002_create_restaurants`.
- Regras comerciais atuais documentadas.

## Mudancas Futuras Planejadas

- Criar tabelas futuras para planos/contratos/assinaturas.
- Migrar conceito hoje presente em `master_platform_state`.
- Manter plano PREMIUM/ACTIVE para o restaurante default.

## Entidades Conceituais

- `plans`
- `plan_features`
- `restaurant_plans`
- `restaurant_contracts`
- `organization_subscriptions`

## Validacoes Futuras

- `getPlanAccessForAdminModule` continua retornando os mesmos acessos para default.
- Feature flags atuais preservadas.
- Nenhum modulo muda visibilidade por engano.

## Rollback Futuro

- Reativar leitura do estado master JSON antigo enquanto tabelas normalizadas ficam ignoradas.
