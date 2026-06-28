# 003 - Create Restaurant Domains

Status: futuro, nao executavel.

## Objetivo

Preparar resolucao dominio/subdominio para restaurante.

## Dependencias

- `002_create_restaurants`.
- Validacao dos dominios atuais.

## Mudancas Futuras Planejadas

- Criar tabela futura `restaurant_domains`.
- Inserir dominio atual do Tokyo Sushi apontando para restaurante default.
- Adicionar dominio primario e aliases.

## Campos Conceituais

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

## Validacoes Futuras

- Dominio atual resolve para restaurante default.
- Hosts desconhecidos nao acessam dados indevidos.
- Redirects atuais continuam preservados.

## Rollback Futuro

- Desativar resolver de dominios e voltar ao default hardcoded.
