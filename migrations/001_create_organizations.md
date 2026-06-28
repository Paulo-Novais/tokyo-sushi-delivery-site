# 001 - Create Organizations

Status: futuro, nao executavel.

## Objetivo

Criar a entidade comercial raiz da plataforma.

## Dependencias

- ADR-001 aprovado.
- Definicao de status comerciais.
- Estrategia de seed da organizacao default.

## Mudancas Futuras Planejadas

- Criar tabela futura `organizations`.
- Criar uma organizacao default para Tokyo Sushi.
- Definir `public_key`/slug estavel para uso interno.

## Campos Conceituais

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

## Validacoes Futuras

- Existe exatamente uma organizacao default para migracao inicial.
- Nenhuma API publica muda comportamento.
- Nenhum dado operacional passa a depender de organization ainda.

## Rollback Futuro

- Remover apenas entidades criadas nesta etapa se ainda nao houver restaurantes vinculados.
