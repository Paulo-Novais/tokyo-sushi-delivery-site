# ADR-004 - Estrategia de Rollback

Status: proposto

Data: 2026-06-25

## Contexto

Migracoes de tenant afetam dados centrais. Um rollback inseguro pode causar perda de pedidos, clientes, financeiro ou historico.

## Decisao

Usar rollback por fase, com dual-read/dual-write apenas quando necessario e com feature flags operacionais.

Regras:

- Nunca remover coluna/tabela legada na mesma fase em que a nova estrutura entra.
- Backfills devem ser idempotentes.
- Cada migration real deve ter plano de rollback documentado.
- Cutover de contexto deve ser desligavel por flag ate estabilizacao.
- Backups devem existir antes de qualquer backfill real.

## Consequencias Positivas

- Reduz risco de indisponibilidade.
- Permite reverter comportamento sem apagar dados novos.
- Ajuda a validar default-only antes de multi-restaurante real.

## Consequencias Negativas

- Aumenta complexidade temporaria.
- Exige monitoramento e disciplina de limpeza posterior.

## Criterios de Rollback

- Erro de leitura/escrita em pedidos.
- Divergencia entre dados legados e novos.
- Qualquer sinal de vazamento entre escopos.
- Regressao em login/admin.
- Regressao em pedido publico.
