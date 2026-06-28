# INovas Food - SRE Guide

Data: 2026-06-25

Escopo: guia operacional futuro para SRE/DevOps/Cloud. Este documento nao implementa monitoramento, nao altera arquitetura e nao faz deploy.

## Missao SRE

Garantir que restaurantes consigam vender e operar com confianca. Para a INovas Food, confiabilidade significa:

- Cliente consegue abrir cardapio.
- Cliente consegue finalizar pedido.
- Restaurante consegue ver e atualizar pedido.
- Integracoes criticas falham com fallback claro.
- Dados nao se perdem.
- Incidentes sao detectados antes do cliente reclamar.

## SLIs

Indicadores de nivel de servico:

- Disponibilidade do site publico.
- Disponibilidade da API de pedido.
- Taxa de sucesso de criacao de pedido.
- Latencia p95 de criacao de pedido.
- Disponibilidade do gestor.
- Taxa de erro 5xx.
- Taxa de sucesso WhatsApp.
- Taxa de sucesso Maps/fallback.
- Tempo de restore.
- Sucesso de backups.

## SLOs Iniciais

| Area | SLO inicial |
| --- | --- |
| Site publico | 99.5% mensal |
| API de pedido | 99.5% mensal |
| Gestor | 99.0% mensal |
| Criacao de pedido | 99.0% de sucesso sem erro 5xx |
| Backup diario | 99.0% de execucao com sucesso |

SLOs devem ser revistos ao atingir 100 restaurantes.

## Error Budget

Se o error budget for consumido:

- Congelar releases nao urgentes.
- Priorizar confiabilidade.
- Revisar incidentes.
- Adiar modulos novos.

## Plantao Futuro

Necessario quando houver producao real com clientes pagantes:

- Escala de plantao.
- Canal de alerta.
- Runbooks P1/P2.
- Dono de comunicacao.
- Dono tecnico.
- Pos-mortem sem culpa.

## Runbooks Criticos

Criar runbooks para:

- Checkout fora.
- Banco fora.
- Admin fora.
- WhatsApp falhando.
- Maps falhando.
- DNS falhando.
- Deploy ruim.
- Erro 5xx em massa.
- Pedido travado.
- Suspeita de vazamento tenant futuro.

## Relatorio Final SRE

### A plataforma esta preparada para operar 24 horas por dia?

Ainda nao para SLA 24x7 formal.

Ela esta bem encaminhada para V1 controlada, mas antes de operar 24h precisa:

- Monitoramento externo.
- Alertas acionaveis.
- Logs estruturados.
- Backup automatico.
- Restore testado.
- Runbooks.
- On-call.
- Observabilidade de rotas criticas.
- Preview/producao validados.

### Riscos operacionais hoje

- Falta de observabilidade formal.
- Falta de backup/restore formal.
- Falta de status page.
- Falta de alertas P1/P2.
- Imagens pesadas.
- Chave Maps precisa restricao confirmada.
- Dependencia de Vercel/Neon/WhatsApp/Maps sem runbooks ativos.
- Multi-restaurante ainda nao pode ser ativado.
- Worktree amplo exige revisao antes de commit/deploy.

### O que falta antes de 100 restaurantes

- TenantContext planejado e testado.
- Escopo de dados por restaurante.
- Testes anti-vazamento.
- Observabilidade por tenant.
- Backups por tenant.
- Master data normalizado.
- Rate limits por tenant.
- Dashboard operacional.
- Onboarding repetivel.
- Logs e suporte por restaurante.

### O que falta antes de 1000 restaurantes

- Filas/jobs para integracoes e relatorios.
- Particionamento/arquivamento de pedidos.
- Relatorios materializados.
- Data warehouse/BI.
- SLOs por plano.
- Suporte/plantao estruturado.
- Auditoria forte.
- Export/restore por tenant.
- Automacao de billing e dominios.
- DR testado.

### Ferramentas recomendadas futuramente

- Grafana.
- Prometheus ou backend de metricas compativel.
- Sentry.
- OpenTelemetry.
- UptimeRobot.
- Cloudflare.
- GitHub Actions.
- Vercel Observability/Logs.

Nenhuma ferramenta foi instalada nesta etapa.

## Notas

| Area | Nota | Leitura |
| --- | ---: | --- |
| Operacao | 58 | Validacoes locais fortes, mas sem operacao 24x7 formal. |
| Monitoramento | 45 | Ainda principalmente manual/documental. |
| Backup | 40 | Estrategia agora documentada, implementacao pendente. |
| Observabilidade | 48 | Necessita logs estruturados, metricas e tracing. |
| Deploy | 62 | Vercel e validacoes ajudam; pipeline formal pendente. |
| Recuperacao | 42 | Runbooks agora planejados; restore ainda nao testado. |
| Escalabilidade Operacional | 55 | Base conceitual boa; precisa tenant/ops por cliente. |
| Maturidade DevOps | 52 | Boa consciencia tecnica, execucao operacional ainda inicial. |

## Prioridades SRE

1. Monitor externo do site/API.
2. Logs estruturados.
3. Backup automatico.
4. Restore testado.
5. Alertas P1/P2.
6. CI com validacoes seguras.
7. Status page.
8. Observabilidade de pedido.
9. Runbooks.
10. Tenant observability antes de multi-restaurante.
