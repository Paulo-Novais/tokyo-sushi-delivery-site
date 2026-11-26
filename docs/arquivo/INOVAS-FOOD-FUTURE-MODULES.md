# INovas Food - Future Modules Integration Map

Data da auditoria: 2026-06-25

Este documento mostra onde os modulos futuros devem se integrar. Nao implementa funcionalidades novas e nao cria multi-restaurante real.

## Principios

- Nenhum modulo futuro deve acessar dados sem escopo interno de restaurante/tenant quando o multi-restaurante existir.
- Todo modulo comercial deve passar por plano, contrato, permissao e feature flag.
- APIs existentes devem ser preservadas; novas capacidades devem nascer em rotas novas ou contratos versionados.
- Integracoes externas precisam de credenciais por dono, ambiente, status, auditoria e logs.
- Modulos operacionais devem emitir eventos para relatorios, financeiro e auditoria.

## Camadas de Integracao

```text
Modulo futuro
  -> Feature flag / plano / contrato
  -> Permissao administrativa
  -> API propria ou extensao versionada
  -> Store de dominio
  -> Eventos/auditoria
  -> Relatorios/master
  -> Observabilidade
```

## Modulos Operacionais

| Modulo | Integrar em | Dados futuros | Cuidados |
| --- | --- | --- | --- |
| QR Code Mesa | frontend publico, pedidos, catalogo, delivery/retirada | mesa, comanda, sessao de mesa, pedido por mesa | Nao misturar com delivery; precisa fluxo de consumo local |
| PDV | gestor, pedidos, financeiro, estoque | venda balcão, operador, terminal, forma de pagamento | Exige modo offline/contingencia e conciliacao |
| Caixa | financeiro, usuarios, auditoria, pedidos | abertura, sangria, suprimento, fechamento, terminal | Deve ser separado de fechamento financeiro mensal |
| KDS | pedidos, status events, cozinha | fila de preparo, estacao, tempos, prioridade | Precisa tempo real ou polling eficiente |
| App Garcom | pedidos, mesas, usuarios | garcom, mesa, comanda, itens lancados | Permissao por dispositivo/usuario |
| App Entregador | delivery, pedidos, status events | entregador, rota, aceite, comprovante | Precisa tracking e privacidade |
| Entrega por rota | delivery, mapas, pedidos | rota, paradas, sequencia, distancia, SLA | Depende de geocoding confiavel |

## Modulos de IA

| Modulo | Integrar em | Dados futuros | Cuidados |
| --- | --- | --- | --- |
| IA WhatsApp | WhatsApp Cloud, pedidos, cliente, catalogo | conversa, intencao, carrinho assistido, handoff | Nunca operar sem auditoria e limites por plano |
| IA Marketing | CRM, clientes, pedidos, promocoes | segmentos, campanhas, consentimento, mensagens | LGPD, opt-in e limite de disparo |
| IA Financeiro | financeiro, pedidos, caixa | insights, anomalias, previsoes, conciliacao | Deve ser explicavel e nao alterar dados sozinho |
| IA Relatorios | relatorios, master, pedidos | perguntas, metricas, snapshots | Consultas precisam respeitar escopo |
| IA Estoque | estoque, catalogo, pedidos | previsao consumo, ruptura, sugestao compra | Sugestoes nao devem movimentar estoque automaticamente |

## Marketplaces e Aplicativos

| Modulo | Integrar em | Dados futuros | Cuidados |
| --- | --- | --- | --- |
| Marketplace | master, catalogo, pedidos, pagamentos | loja, vitrine, comissao, ranking | Separar marketplace da loja propria do restaurante |
| Aplicativo Cliente | auth cliente, catalogo, pedidos, push | dispositivo, push token, preferencias | Compatibilidade com conta web atual |
| Aplicativo Restaurante | gestor, usuarios, permissoes | dispositivo admin, sessoes, notificacoes | Nao duplicar regras do gestor web |
| Aplicativo Entregador | entrega, rotas, status | localizacao, disponibilidade, comprovante | Permissao e privacidade por entregador |

## Integracoes Externas

| Integracao | Integrar em | Dados futuros | Cuidados |
| --- | --- | --- | --- |
| Gateway Pagamento | pedidos, financeiro, caixa | transacao, autorizacao, captura, estorno | Idempotencia, conciliacao e webhooks |
| Pix | pedidos, financeiro | QR Pix, expiracao, confirmacao, devolucao | Webhook confiavel e status antifraude |
| Cartao | PDV, pedido online, financeiro | autorizacao, bandeira, parcelas, chargeback | PCI/terceirizacao via gateway |
| iFood | catalogo, pedidos, status, financeiro | merchant, item mapping, pedido externo | Sincronizacao bidirecional e divergencias |
| Rappi | catalogo, pedidos, status | loja externa, mapping, pedidos | Similar iFood, com controle de SLA |
| Google Maps | delivery, rotas, geocoding | place id, distancia, duracao, coordenadas | Chaves por ambiente/referrer e cache |
| Meta | marketing, pixels, campanhas | pixel, campanha, evento, publico | Consentimento e eventos server-side |
| WhatsApp | auth, IA WhatsApp, notificacoes | template, conversa, opt-in, status | Templates aprovados e rate limits |

## Pontos de Entrada Por Area

### Pedido

Base atual:

- `/api/orders/create`
- `lib/order-store.cjs`
- `lib/order-payload.cjs`
- `lib/admin-api.cjs`
- `admin/admin.js`

Modulos futuros dependentes:

- QR Code Mesa
- PDV
- KDS
- App Garcom
- App Entregador
- Entrega por rota
- Gateway Pagamento
- iFood/Rappi

Mudanca futura necessaria:

- Adicionar canal/origem do pedido, terminal/dispositivo, mesa/comanda quando aplicavel e escopo de restaurante. Nao fazer agora.

### Catalogo

Base atual:

- `/api/catalog`
- `lib/catalog-store.cjs`
- `script.js`
- `admin/admin.js`

Modulos futuros dependentes:

- Marketplace
- iFood/Rappi
- IA WhatsApp
- PDV
- QR Code Mesa

Mudanca futura necessaria:

- Separar fonte de catalogo de `script.js`, criar mapping externo por canal e escopo por restaurante. Nao fazer agora.

### Financeiro

Base atual:

- `lib/finance-store.cjs`
- `lib/order-store.cjs`
- `/api/admin/finance`

Modulos futuros dependentes:

- Caixa
- PDV
- Pix
- Cartao
- Gateway Pagamento
- IA Financeiro

Mudanca futura necessaria:

- Modelar transacao, recebivel, caixa, conciliacao e fechamento por escopo. Nao fazer agora.

### Delivery

Base atual:

- `lib/delivery-settings-store.cjs`
- `lib/restaurant-settings-store.cjs`
- `script.js`
- Google Maps/ViaCEP

Modulos futuros dependentes:

- App Entregador
- Entrega por rota
- Google Maps
- Marketplace

Mudanca futura necessaria:

- Separar area de entrega, base, faixas, entregadores e rotas por unidade/restaurante. Nao fazer agora.

### Usuarios e Permissoes

Base atual:

- `lib/user-permissions.cjs`
- `lib/admin-auth.cjs`
- `middleware.js`
- `admin/admin.js`

Modulos futuros dependentes:

- PDV
- Caixa
- KDS
- App Garcom
- App Restaurante
- App Entregador
- Painel Master Enterprise

Mudanca futura necessaria:

- Separar identidade, membership, papel e escopo. Nao fazer agora.

### Master/Comercial

Base atual:

- `lib/master-platform-store.cjs`
- `admin/master.js`
- `admin/master.html`
- `lib/admin-api.cjs`

Modulos futuros dependentes:

- Planos SaaS
- Feature flags por plano
- Marketplace
- Dominios
- Contratos
- Integracoes externas

Mudanca futura necessaria:

- Normalizar restaurantes, organizacoes, planos, contratos, assinaturas e recursos em tabelas proprias. Nao fazer agora.

## Ordem Recomendada de Preparacao

1. Formalizar contratos e ADRs.
2. Separar catalogo de `script.js`.
3. Criar base de migracoes.
4. Criar camada compartilhada de persistencia e erros.
5. Planejar tenant context interno.
6. Otimizar bundles e assets.
7. Normalizar master data.
8. So depois iniciar modulos operacionais com escopo correto.

## Conclusao

Os modulos futuros cabem na arquitetura atual se entrarem por contratos claros: feature flag, plano, permissao, API, store, evento e relatorio. O risco e adicionar esses modulos antes de resolver isolamento de dados e normalizacao; isso aumentaria a chance de reescrita quando a plataforma virar SaaS.
