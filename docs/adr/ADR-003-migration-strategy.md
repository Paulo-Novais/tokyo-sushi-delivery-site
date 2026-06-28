# ADR-003 - Estrategia de Migracao Multi-Restaurante

Status: proposto

Data: 2026-06-25

## Contexto

A plataforma atual e single-tenant operacional. Criar multi-restaurante de uma vez aumentaria risco de perda de compatibilidade, vazamento de dados e indisponibilidade.

## Decisao

Usar migracao progressiva em modo default-only:

1. Criar entidades futuras vazias.
2. Criar organizacao e restaurante default.
3. Mapear dominio atual para restaurante default.
4. Criar memberships equivalentes aos usuarios atuais.
5. Preparar colunas/indices de escopo em tabelas operacionais em migrations futuras.
6. Fazer backfill controlado para default.
7. Ativar `TenantContext` interno ainda retornando apenas default.
8. Criar testes anti-vazamento.
9. So entao abrir multi-restaurante real.

## Consequencias Positivas

- Permite validar cada etapa isoladamente.
- Evita big bang.
- Preserva contratos atuais.
- Facilita rollback por fase.

## Consequencias Negativas

- A migracao completa levara mais tempo.
- Durante transicao algumas consultas terao compatibilidade dupla.
- Exige disciplina para nao criar novos modulos globais.

## Principio

Toda nova estrutura futura deve nascer tenant-aware, mesmo que em V1 receba sempre o restaurante default.
