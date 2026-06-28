# INovas Food - Backup Plan

Data: 2026-06-25

Escopo: plano futuro de backup e restore. Este documento nao altera banco, nao cria jobs, nao exporta dados e nao toca em dados reais.

## Objetivo

Garantir que a INovas Food consiga recuperar pedidos, configuracoes, contratos, usuarios, assets e logs depois de falhas, erros humanos, incidentes de seguranca ou indisponibilidade de fornecedor.

## Principios

- Backup sem restore testado nao e backup confiavel.
- Dados de pedido e financeiro tem prioridade maxima.
- Backups devem ser criptografados.
- Acesso a backup deve ser restrito e auditado.
- Retencao deve equilibrar custo, LGPD e necessidade operacional.
- Cada tenant/restaurante futuro deve poder ser exportado e restaurado por escopo.

## Escopo de Backup

| Area | Exemplos | Criticidade |
| --- | --- | --- |
| Banco | pedidos, clientes, usuarios, permissoes, settings, contratos, estoque, financeiro | Critica |
| Assets | imagens de cardapio, logos, banners, uploads futuros | Alta |
| Configuracoes | env vars, feature flags, planos, dominios, delivery, horarios | Critica |
| Logs | auditoria, eventos tecnicos, incidentes | Alta |
| Contratos | planos, status comercial, billing futuro | Critica |
| Restaurantes | dados de tenant, dominio, branding, integracoes | Critica |
| Codigo | repositorio Git, tags e releases | Critica |

## Estrategia de Backup do Banco

### Diario

- Backup completo diario.
- Janela preferencial: madrugada no timezone principal da operacao.
- Retencao: 30 dias.
- Validacao: checar existencia, tamanho, checksum e capacidade de abrir snapshot.

### Semanal

- Backup completo semanal preservado.
- Retencao: 12 semanas.
- Um backup mensal pode ser preservado por 12 meses quando houver contratos/billing real.

### Antes de Mudancas Criticas

Gerar snapshot antes de:

- Migration real.
- Backfill.
- Cutover de tenant.
- Mudanca de plano/contrato em massa.
- Alteracao de schema central.
- Importacao grande de catalogo.

### RPO e RTO

| Fase | RPO alvo | RTO alvo |
| --- | ---: | ---: |
| V1 preview | 24h | 4h |
| V1 producao pequena | 4h | 2h |
| 100 restaurantes | 1h | 1h |
| 1000 restaurantes | 15min ou menor | 30min a 1h |

RPO: perda maxima aceitavel de dados.
RTO: tempo maximo para restaurar servico.

## Assets e Uploads

Estado atual:

- Assets vivem no repositorio em `assets/`, `site-images/`, `menu_pdf_images/` e diretorios relacionados.
- Uploads reais em storage externo ainda nao estao formalizados.

Plano futuro:

- Assets de produto versionados no Git.
- Uploads de clientes em storage externo com versionamento.
- Backup diario de metadados.
- Replicacao/storage com lifecycle policy.
- Thumbnails regeneraveis sempre que possivel.

Retencao sugerida:

- Originais: enquanto o cliente estiver ativo + janela contratual.
- Thumbnails: regeneraveis, retencao mais curta.
- Assets removidos: soft delete por 30 dias.

## Configuracoes

Itens:

- `site.config.json`
- `vercel.json`
- feature flags
- planos
- contratos
- dominios
- env vars
- settings por restaurante

Plano:

- Config versionada no Git quando nao for segredo.
- Secrets em cofre/ambiente, nunca no Git.
- Export criptografado de feature flags/planos/contratos.
- Auditoria de toda mudanca.

## Logs e Auditoria

Logs tecnicos:

- Retencao hot: 7 a 30 dias.
- Retencao cold: 90 dias ou conforme contrato.

Auditoria:

- Retencao minima: 12 meses.
- Para Enterprise: 24 a 60 meses, conforme contrato e LGPD.
- Auditoria deve ser imutavel ou append-only.

## Contratos e Billing

Criticidade: maxima.

Backup:

- Diario.
- Snapshot antes de alteracoes em massa.
- Export mensal assinado/checksum.

Restore:

- Restaurar contrato sem afetar dados operacionais.
- Preservar historico de plano e billing.

## Restaurantes/Tenants Futuros

Cada restaurante deve ter capacidade futura de:

- Exportar dados.
- Restaurar configuracao.
- Restaurar catalogo.
- Restaurar pedidos por periodo.
- Restaurar usuarios/memberships.
- Restaurar assets.

Antes de multi-restaurante real:

- Nao habilitar restore parcial sem teste anti-vazamento.

## Procedimento de Restore

1. Declarar incidente ou manutencao.
2. Congelar writes se necessario.
3. Identificar ponto de restauracao.
4. Validar backup e checksum.
5. Restaurar em ambiente isolado primeiro.
6. Rodar smoke tests.
7. Comparar dados criticos.
8. Fazer cutover controlado.
9. Monitorar erros e latencia.
10. Registrar pos-mortem.

## Testes de Restore

Frequencia:

- V1: trimestral.
- 100 restaurantes: mensal.
- 1000 restaurantes: quinzenal ou mensal com automacao.

Cenarios:

- Restore completo.
- Restore de pedido especifico.
- Restore de configuracao.
- Restore de assets.
- Restore apos migration falha.
- Restore de tenant futuro isolado.

## Ferramentas Futuras

- Backup nativo do provedor Postgres/Neon.
- Storage com versionamento para uploads.
- GitHub para codigo e docs.
- Logs em plataforma com retencao configuravel.
- Cofre de secrets para env vars.

## Checklist Antes de Producao

- Backup automatico configurado.
- Restore testado.
- Dono do backup definido.
- RPO/RTO aprovados.
- Runbook de restore aprovado.
- Acesso restrito.
- Logs de restore/auditoria.
- Politica de retencao documentada.
