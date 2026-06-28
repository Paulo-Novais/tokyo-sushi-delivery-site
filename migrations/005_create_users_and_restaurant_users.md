# 005 - Create Users And Restaurant Users

Status: futuro, nao executavel.

## Objetivo

Separar identidade administrativa de membership em restaurante/organizacao.

## Dependencias

- `001_create_organizations`.
- `002_create_restaurants`.
- ADR-005 aprovado.

## Mudancas Futuras Planejadas

- Criar tabela futura `users` para identidade global.
- Criar tabela futura `restaurant_users` para vinculo, papel e permissoes.
- Migrar `admin_users` default para membership do restaurante default em etapa futura.

## Campos Conceituais

`users`:

- `id`
- `login`
- `email`
- `display_name`
- `password_hash`
- `status`
- `created_at`
- `updated_at`

`restaurant_users`:

- `id`
- `organization_id`
- `restaurant_id`
- `user_id`
- `role`
- `permissions_json`
- `status`
- `created_at`
- `updated_at`

## Validacoes Futuras

- Login admin atual continua funcionando.
- Usuario MASTER continua acessando painel master.
- Usuario sem membership nao acessa dados operacionais.

## Rollback Futuro

- Voltar autenticacao para `admin_users` enquanto tabelas novas ficam somente leitura.
