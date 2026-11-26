# INovas Food - Monitoring Strategy

Data: 2026-06-25

Escopo: desenho futuro de dashboards e monitoramento. Este documento nao implementa painel, integra ferramenta ou altera o Painel Master.

## Objetivo

Criar uma visao operacional para saber, em tempo quase real, se a INovas Food esta disponivel, performatica e operacionalmente saudavel.

## Dashboard Operacional Global

Blocos futuros:

| Bloco | Indicadores |
| --- | --- |
| Disponibilidade | site publico, APIs, admin, Master |
| Restaurantes | online, offline, degradados, bloqueados |
| Pedidos | pedidos/minuto, falhas, travados, cancelados |
| APIs | latencia p50/p95/p99, erro/minuto, status 4xx/5xx |
| Integracoes | WhatsApp, Maps, ViaCEP, gateway futuro |
| Banco | conexoes, erros, latencia, tamanho, backups |
| Infra | CPU, memoria, saturacao, cold starts quando aplicavel |
| Assets | peso medio, erros 404, tempo de carregamento |
| Alertas | P1, P2, P3 abertos |

## Indicadores Solicitados

### Restaurantes Online

Estado futuro:

- Online: site e admin respondem, ultimo heartbeat recente.
- Degradado: APIs lentas ou integracao critica falhando.
- Offline: site/API/admin indisponivel.
- Suspenso: bloqueio comercial intencional.

### Pedidos por Minuto

Metricas:

- Total por minuto.
- Por restaurante futuro.
- Por canal: delivery, retirada, mesa, balcao futuro.
- Criados vs falhados.
- Picos por horario.

### Erros por Minuto

Metricas:

- 5xx por rota.
- 4xx por rota.
- Erros de validacao.
- Rate limit.
- Erros externos.

### APIs

Rotas criticas:

- `/api/orders/create`
- `/api/catalog`
- `/api/delivery-settings`
- `/api/restaurant-settings`
- `/api/customer/*`
- `/api/admin/*`
- `/api/admin/master/*`

### Tempo de Resposta

Medir:

- p50
- p95
- p99
- max
- timeout

Alvos iniciais:

- APIs publicas p95 abaixo de 1s em operacao normal.
- Criacao de pedido p95 abaixo de 2s.
- Admin dashboard p95 abaixo de 2s.

### CPU e Memoria

Em Vercel/serverless, CPU/memoria podem vir de observabilidade do provedor. Em arquitetura futura com workers/containers, monitorar:

- CPU media/p95.
- Memoria media/p95.
- OOM/restarts.
- Duracao de function.
- Cold starts.

### Disponibilidade

Monitores externos:

- Home.
- Cardapio.
- API catalog.
- API delivery.
- Admin login.
- Endpoint de health futuro.

## Monitoramento dos Clientes no Painel Master

Sem implementar agora, o Master futuro deve exibir:

| Sinal | Como detectar futuramente | Acao |
| --- | --- | --- |
| Restaurante offline | health/heartbeat falhou | Acionar suporte |
| Pedidos travados | status sem mudanca acima do limite | Alertar operador |
| Integracao falhando | taxa de erro acima do limiar | Mostrar alerta |
| WhatsApp desconectado | falhas de envio/token/template | Recomendar reconexao |
| Estoque inconsistente | saldo negativo/divergencia | Alertar gerente |
| Filas | jobs pendentes/retries | Monitorar atraso |
| Uso de disco/storage | crescimento acima do limite | Planejar limpeza/upgrade |
| Consumo de API | rate limit/cota | Alertar plano/uso |

## Alertas Recomendados

### P1

- Site publico indisponivel.
- API de pedido indisponivel.
- Banco indisponivel.
- Admin indisponivel.
- Erro 5xx acima de 5% em pedido.

### P2

- WhatsApp falhando acima de 20%.
- Maps falhando acima de 30%.
- p95 de pedido acima de 2s por 10 minutos.
- Restaurantes com pedidos travados.
- Backups falhando.

### P3

- Aumento de 404.
- Imagens lentas.
- Rate limit frequente.
- Estoque inconsistente.
- Falhas intermitentes de relatorios.

## Ferramentas Futuras

- UptimeRobot para uptime/status externo: https://uptimerobot.com/
- Grafana para dashboards: https://grafana.com/docs/grafana/latest/
- Prometheus ou backend compativel para metricas: https://prometheus.io/docs/introduction/overview/
- Sentry para erro e performance: https://docs.sentry.io/
- Cloudflare para DNS, WAF, CDN e observabilidade de borda: https://developers.cloudflare.com/fundamentals/
- Vercel Observability/Logs: https://vercel.com/docs

## Fases

1. Monitor externo de home/cardapio/API.
2. Dashboard manual simples com status de rotas.
3. Alertas P1 por email/WhatsApp interno.
4. Sentry para erros.
5. Grafana para metricas.
6. Master com saude por restaurante.
7. SLOs por plano/cliente.
