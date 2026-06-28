# INovas Food - Roadmap de Versoes

Data de referencia: 2026-06-25

Este roadmap mantem o escopo atual: Tokyo Sushi como Cliente Modelo, sem multi-restaurante real, sem `restaurant_id`, sem alteracao de dominio e sem cobranca real nesta etapa.

## V1.0 - Plataforma profissional estavel

Objetivo: entregar uma base confiavel para operar o Cliente Modelo e demonstrar a plataforma.

- Plataforma estavel.
- Tokyo Sushi como Cliente Modelo.
- Site publico completo.
- Gestor do restaurante.
- Painel Master.
- Usuarios e sessoes administrativas.
- Permissoes granulares.
- Planos START, PRO e PREMIUM.
- Recursos liberados/bloqueados por plano.
- Dominios preparados de forma simulada.
- Contratos/assinaturas estruturados de forma simulada.
- Auditoria local e checklist de pre-deploy.

Critérios de saida:

- Todos os scripts locais seguros passando.
- Preview controlado validado sem dados reais.
- Artefatos locais fora do indice Git.
- Chave Google Maps revisada com restricao de referrer/API.
- Variaveis reais revisadas sem exposicao.

## V1.5 - Operacao presencial e fidelizacao

Objetivo: ampliar a operacao do restaurante para salao, caixa e relacionamento.

- QR Code mesa.
- PDV.
- Caixa.
- KDS.
- App garcom.
- Comanda digital.
- Fidelidade.
- Cashback.
- Cupons.
- Fechamento operacional mais robusto.
- Relatorios por canal: delivery, mesa, retirada e balcao.

Dependencias:

- Modelo final de pedidos presenciais.
- Impressao/cozinha definida.
- Regra comercial dos beneficios de fidelidade.

## V2.0 - IA operacional e marketing

Objetivo: transformar dados e atendimento em assistencia ativa para o restaurante.

- IA WhatsApp.
- IA relatorios.
- IA estoque.
- IA marketing.
- Campanhas automaticas.
- Recuperacao de clientes.
- Sugestao de promocoes.
- Segmentacao de clientes.
- Alertas inteligentes de estoque, margem e recorrencia.

Dependencias:

- Base historica confiavel.
- Consentimento e politica de comunicacao.
- Observabilidade e controle de custos de IA.

## V2.5 - Entrega avancada por rota real

Objetivo: evoluir entrega de estimativa para operacao acompanhavel.

- Entrega por rota real, nao apenas raio.
- App entregador.
- Rastreamento em tempo real.
- Mapa no gestor.
- Cliente acompanhando entrega.
- Historico de entregas.
- Ranking de entregadores.
- Distribuicao/aceite de corrida.
- Calculo de repasse por rota.

Dependencias:

- Politica de privacidade para localizacao.
- App ou PWA do entregador.
- Infra de mapas, geocoding e realtime.

## V3.0 - SaaS multi-restaurante completo

Objetivo: transformar a base em plataforma SaaS escalavel.

- Multi-restaurante completo.
- Onboarding automatico.
- Cobranca real.
- DNS/SSL automatico.
- App mobile.
- Marketplace de modulos.
- Isolamento real de dados por restaurante.
- Administracao de tenants.
- Billing, suspensao e upgrade/downgrade.
- Observabilidade por tenant.

Dependencias:

- Modelo de dados multi-tenant definitivo.
- Estrategia de migracao do `restaurant_key = "default"`.
- Testes de isolamento entre restaurantes.
- Processo comercial e suporte.
