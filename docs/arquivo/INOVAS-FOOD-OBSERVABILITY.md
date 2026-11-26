# INovas Food - Observability Strategy

Data: 2026-06-25

Escopo: estrategia futura de observabilidade para uma plataforma SaaS profissional. Este documento nao implementa logs, tracing, metricas, alertas, SDKs ou ferramentas externas.

## Objetivo

Dar visibilidade operacional para a INovas Food operar como SaaS com confianca: saber se clientes conseguem comprar, se restaurantes conseguem operar, se integracoes estao saudaveis e se a plataforma esta perto de falhar.

## Principios

- Observabilidade deve comecar pelos fluxos criticos de negocio, nao apenas por infraestrutura.
- Todo evento operacional futuro deve ter contexto: request id, ambiente, modulo, usuario/ator quando aplicavel e, no futuro, tenant/restaurante.
- Logs nao devem expor secrets, tokens, senhas, telefones completos, payloads sensiveis ou dados de pagamento.
- Alertas devem ser acionaveis; alerta sem runbook vira ruido.
- Traces devem atravessar API, store, banco e integracoes externas.
- Auditoria de negocio e logs tecnicos sao coisas diferentes.

## Pilares

| Pilar | Finalidade | Exemplos |
| --- | --- | --- |
| Logs | Entender eventos tecnicos e erros | API 500, falha de WhatsApp, erro Neon, payload invalido |
| Auditoria | Rastrear acoes sensiveis de usuarios | Mudanca de status, alteracao de usuario, plano, contrato |
| Metricas | Medir saude e tendencia | pedidos/min, p95 API, erro/min, conversao checkout |
| Tracing | Seguir uma requisicao ponta a ponta | checkout -> API -> catalogo -> banco -> pedido |
| Monitoramento | Detectar indisponibilidade | site fora, API lenta, banco indisponivel |

## O Que Deve Ser Monitorado

### Fluxos Publicos

- Home carregando.
- Cardapio carregando.
- Checkout disponivel.
- Criacao de pedido.
- Login cliente por WhatsApp.
- Acompanhamento/historico.
- Calculo de entrega.
- Envio de avaliacao.

### Gestor

- Login admin.
- Sessao admin.
- Lista de pedidos.
- Detalhe de pedido.
- Alteracao de status.
- Cardapio/promocoes.
- Delivery settings.
- Financeiro.
- Estoque.
- Usuarios/permissoes.

### Painel Master

- Acesso exclusivo Master.
- Overview da plataforma.
- Planos/contratos.
- Dominios simulados/futuros.
- Logs/auditoria.
- Feature flags.

### Dependencias

- Neon/Postgres.
- Vercel Functions.
- Vercel hosting/static.
- WhatsApp Cloud API.
- Google Maps.
- ViaCEP.
- Gateway de pagamento futuro.
- DNS.
- CDN/storage futuro.

## Eventos Que Devem Gerar Logs

### Info

- Pedido criado.
- Login admin bem-sucedido.
- Login cliente verificado.
- Status de pedido alterado.
- Configuracao salva.
- Feature flag alterada.
- Contrato/plano alterado.

### Warning

- API publica com latencia alta.
- WhatsApp rejeitando template.
- Google Maps indisponivel e fallback manual ativado.
- ViaCEP indisponivel.
- Banco com retry.
- Rate limit acionado.
- Usuario sem permissao tentando acessar modulo.
- Plano bloqueando modulo.

### Error

- API 500.
- Falha ao criar pedido.
- Falha ao salvar status de pedido.
- Falha ao carregar lista de pedidos.
- Falha de banco.
- Falha de parse de configuracao.
- Falha de sessao/admin auth.

### Critical

- Criacao de pedido indisponivel.
- Banco indisponivel.
- Gestor indisponivel.
- Vazamento ou suspeita de acesso cruzado futuro.
- Master acessivel por usuario nao Master.
- Erro em massa em checkout.
- Perda de dados ou divergencia entre pedido e financeiro.

## Auditoria

Eventos auditaveis obrigatorios:

- Login e logout admin.
- Tentativa de login falha repetida.
- Criacao, bloqueio e reset de usuario.
- Mudanca de permissao.
- Mudanca de plano, contrato ou feature flag.
- Mudanca de dominio.
- Alteracao de status de pedido.
- Cancelamento de pedido.
- Alteracao de configuracoes de restaurante.
- Alteracao de delivery.
- Ajuste de estoque.
- Fechamento financeiro.
- Exclusao/ocultacao de avaliacao.
- Acesso ao Painel Master.

Campos minimos de auditoria:

- `event_id`
- `event_type`
- `severity`
- `created_at`
- `environment`
- `actor_user_id`
- `actor_login`
- `actor_role`
- `restaurant_key` atual
- `organization_id` futuro
- `restaurant_id` futuro
- `module`
- `action`
- `target_type`
- `target_id`
- `ip_hash`
- `user_agent_hash`
- `metadata_redacted`

## Metricas Principais

### Golden Signals

- Latencia por rota.
- Trafego por rota.
- Erros por rota.
- Saturacao/retries por dependencia.

### Negocio

- Pedidos por minuto.
- Pedidos por canal.
- Taxa de checkout com sucesso.
- Carrinhos iniciados vs pedidos criados.
- Pedidos cancelados.
- Tempo medio em cada status.
- Pedidos travados.
- Avaliacoes por dia.

### Admin

- Logins admin por dia.
- Erros de login.
- Tempo de carregamento do gestor.
- Falhas em alterar status.
- Falhas de permissao.
- Modulos bloqueados por plano.

### Integracoes

- WhatsApp: sucesso, rejeicao, timeout, latencia.
- Google Maps: sucesso, erro, fallback manual.
- ViaCEP: sucesso, erro, timeout.
- Gateway futuro: autorizacao, rejeicao, webhook atrasado.

### Infra

- Disponibilidade site/API.
- Tempo de resposta p50/p95/p99.
- Erros 4xx/5xx.
- Uso de banco/conexoes.
- Tamanho de tabelas.
- Tamanho de assets/uploads.
- Tamanho de logs.

## Tracing Futuro

Traces prioritarios:

- `public.checkout.create_order`
- `public.customer.auth_start`
- `public.customer.auth_verify`
- `admin.login`
- `admin.orders.list`
- `admin.orders.update_status`
- `admin.catalog.save`
- `admin.settings.save`
- `master.overview`

Spans sugeridos:

- `http.request`
- `auth.session.validate`
- `permission.check`
- `plan.check`
- `payload.normalize`
- `catalog.load`
- `database.query`
- `external.whatsapp`
- `external.maps`
- `response.serialize`

## Alertas

### P1

- Checkout indisponivel por 5 minutos.
- API `/api/orders/create` com erro 5xx acima de 5% por 5 minutos.
- Banco indisponivel.
- Admin indisponivel para todos.
- Master acessivel indevidamente.
- Suspeita de vazamento tenant futuro.

### P2

- Latencia p95 acima de 2s em APIs criticas por 10 minutos.
- WhatsApp com falha acima de 20% por 15 minutos.
- Google Maps com falha acima de 30% por 15 minutos.
- Pedidos travados sem mudanca por mais de X minutos.
- Erro em salvar configuracao/delivery/usuarios.

### P3

- Aumento de 4xx.
- Rate limit frequente.
- Imagem/API lenta.
- Queda de conversao.
- Falhas intermitentes de integracoes.

## Ferramentas Recomendadas Futuramente

- OpenTelemetry para padronizar traces, metricas e logs: https://opentelemetry.io/docs/what-is-opentelemetry/
- Sentry para erros frontend/backend e performance: https://docs.sentry.io/
- Grafana para dashboards e alertas: https://grafana.com/docs/grafana/latest/
- Prometheus ou backend compativel para metricas: https://prometheus.io/docs/introduction/overview/
- Vercel Observability/Logs para runtime Vercel: https://vercel.com/docs

## Fases de Implantacao

1. Logs estruturados sem secrets.
2. Request id e correlation id.
3. Metricas basicas por rota.
4. Sentry para erros.
5. Dashboard operacional.
6. Alertas P1/P2.
7. Tracing OpenTelemetry.
8. Auditoria persistente por tenant.
9. SLOs e error budgets.
