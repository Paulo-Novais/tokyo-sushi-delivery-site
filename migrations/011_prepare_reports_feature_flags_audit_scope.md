# 011 - Prepare Reports, Feature Flags And Audit Scope

Status: futuro, nao executavel.

## Objetivo

Preparar relatorios, feature flags e auditoria para escopos operacional, organizacional e master.

## Dependencias

- Migrations de escopo operacional planejadas.
- Normalizacao parcial do master data.

## Mudancas Futuras Planejadas

- Criar agregacoes por restaurante/organizacao.
- Escopar feature flags por organizacao/restaurante.
- Escopar logs/auditoria por ator, restaurante e organizacao.
- Garantir que master possa ver agregado sem contaminar gestor.

## Validacoes Futuras

- Gestor ve somente seu restaurante.
- Master ve todos os restaurantes conforme permissao.
- Relatorios por organizacao nao incluem restaurantes fora da organizacao.

## Rollback Futuro

- Voltar relatorios ao modo default-only.
