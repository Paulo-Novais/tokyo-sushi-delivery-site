# INovas Food - Product Review

Data: 2026-06-25

Escopo: revisao de produto, roadmap, ordem de desenvolvimento, proposta de valor e maturidade. Nao houve criacao de funcionalidades.

## Sumario

A INovas Food esta construindo um produto com base correta: primeiro site e pedido, depois gestor, depois permissoes, planos e Master, depois SaaS. A ordem historica foi boa. O risco agora esta na proxima etapa: tentar colocar muitos modulos V1.5 antes de consolidar a base SaaS.

## O Que a Plataforma E Hoje

Classificacao: produto operacional vertical com fundacao de plataforma SaaS.

Ja existe:

- Site publico.
- Cardapio digital.
- Checkout/pedido.
- Login cliente por WhatsApp.
- Historico/acompanhamento.
- Avaliacoes.
- Gestor do restaurante.
- Pedidos e kanban.
- Agendados.
- Cardapio e promocoes.
- Delivery settings.
- CRM/clientes.
- Estoque.
- Financeiro.
- Relatorios/metricas.
- Usuarios e permissoes.
- Painel Master.
- Planos, contratos simulados e feature flags.

Ainda nao existe como produto maduro:

- Multi-restaurante real.
- Billing real.
- Onboarding automatico.
- DNS/SSL automatico.
- PDV/caixa completo.
- KDS real.
- App garcom.
- App entregador.
- IA WhatsApp.
- Entrega realtime por rota.
- Integracao iFood/Rappi.
- Fiscal/NFC-e.

## Estamos Construindo na Ordem Correta?

Sim, ate aqui.

Ordem correta ja seguida:

1. Site publico.
2. Pedido online.
3. Gestor privado.
4. Estabilizacao tecnica.
5. Usuarios/permissoes.
6. Planos/contratos.
7. Master.
8. Documentacao de tenancy e escalabilidade.

O ajuste recomendado:

- Inserir V1.1 de hardening antes de V1.5.
- Reduzir escopo da V1.5.
- Tratar V3/SaaS como trilha paralela de plataforma, nao como "depois de todos os modulos".

## O Que Falta de Importante

Falta de produto/plataforma:

- Onboarding de restaurante.
- Billing real.
- Dominio/subdominio operacional.
- Backup/exportacao.
- Logs por restaurante.
- Suporte/admin por tenant.
- Centro de integracoes.
- Politica LGPD/consentimento.
- Relatorio de saude operacional.

Falta de UX/produto:

- Onboarding dentro do gestor.
- Ajuda contextual para financeiro, estoque e delivery.
- Diferenca clara entre recurso bloqueado por plano e erro.
- Guia de primeiros passos para restaurante novo.

## O Que Nao Vale a Pena Desenvolver Agora

Nao desenvolver agora:

- Marketplace de modulos.
- App cliente completo.
- App restaurante completo.
- Integracoes iFood/Rappi.
- PDV fiscal completo.
- Caixa completo com conciliacao profunda.
- Cashback financeiro real.
- IA automatica alterando estoque/financeiro.
- Entrega realtime completa.

Esses itens podem ser valiosos, mas antes deles a plataforma precisa de confiabilidade e tenant.

## O Que Pode Esperar

Pode esperar:

- Renomear arquivos/pacote Tokyo.
- Trocar cookies/headers.
- Trocar prefixo `TKY`.
- Limpar textos de fixtures antigas.
- White-label completo.
- SSO/OIDC.
- BI/data warehouse.
- Marketplace.

## O Que Virou Overengineering

Ainda nao ha overengineering grave. Ha preparacao forte, que e positiva.

Possiveis sinais a observar:

- Master muito completo antes de billing/onboarding real.
- Muitos modulos planejados antes de operacao SaaS.
- IA planejada antes de dados historicos confiaveis.
- Enterprise antes de PMF em restaurantes independentes.

Overengineering a evitar:

- Criar arquitetura Enterprise antes de V1 vender.
- Criar multi-restaurante completo sem piloto controlado.
- Criar app mobile antes de web provar recorrencia.

## Roadmap Recomendado

### V1

Objetivo: operacao confiavel do Cliente Modelo.

Entregar:

- Preview controlado.
- Limpeza de repo.
- Maps seguro.
- Imagens otimizadas.
- Variaveis reais conferidas.
- Validacoes verdes em preview.

### V1.1

Objetivo: confiabilidade.

Entregar:

- Migrations versionadas.
- Observabilidade minima.
- Backup/restore.
- Smoke pre-merge/pre-deploy.
- Separacao inicial de catalogo.
- Guia de producao.

### V1.5

Objetivo: expansao operacional pequena.

Escolher no maximo uma linha:

- QR mesa + comanda simples.
- KDS/cozinha.
- Relatorios por canal.

Evitar fazer tudo junto.

### V2

Objetivo: IA com dados confiaveis.

Pre-condicoes:

- Consentimento.
- Dados historicos.
- Observabilidade de custo.
- Logs por acao.
- Handoff humano.

### V2.5

Objetivo: entrega por rota real.

Pre-condicoes:

- Privacidade de localizacao.
- App/PWA entregador.
- Realtime.
- Geocoding confiavel.
- Auditoria.

### V3

Objetivo: SaaS multi-restaurante.

Pre-condicoes:

- TenantContext.
- Dados escopados.
- Testes anti-vazamento.
- Billing.
- Onboarding.
- Dominio/subdominio.
- Master normalizado.

## Cliente Ideal

Cliente ideal atual:

- Restaurante independente.
- Operacao de delivery proprio.
- Ticket suficiente para pagar mensalidade.
- Dono quer reduzir dependencia de marketplace.
- Precisa de site, cardapio, pedidos, gestor e WhatsApp.
- Tem uma unidade ou operacao simples.

Cliente ideal futuro:

- Pequena rede com 2 a 10 unidades.
- Delivery + salao.
- Quer CRM, fidelidade, relatorios e operacao por plano.
- Precisa de dominio proprio e controle de canais.

Cliente nao ideal hoje:

- Grande rede enterprise.
- Operacao fiscal/PDV complexa.
- Restaurante que exige iFood integrado desde o dia 1.
- Restaurante que quer app nativo completo.
- Operacao multi-unidade com controle centralizado imediato.

## Quem Compraria se Lancasse Hoje

Compraria:

- Restaurante que quer canal proprio e gestor.
- Restaurante pequeno/medio cansado de depender de WhatsApp manual.
- Restaurante com equipe disposta a operar web.
- Dono que valoriza marca/dominio.

Nao compraria:

- Quem precisa de fiscal/PDV completo.
- Quem exige integracao marketplace pronta.
- Quem precisa multi-unidade.
- Quem quer IA/chatbot como principal valor.

Indicaria:

- Donos de restaurantes independentes com delivery proprio.
- Agencias/consultores de presenca digital para restaurantes.

Trocaria de concorrente:

- Cliente insatisfeito com cardapio simples e querendo controle maior.
- Cliente que nao precisa ainda de ERP completo.

## Funcionalidades Que Devem Ser Premium

- IA WhatsApp.
- CRM avancado.
- Campanhas automaticas.
- Fidelidade/cashback.
- Relatorios avancados.
- Dominio proprio.
- Multiusuario avancado.
- KDS.
- PDV/caixa.
- App entregador.
- Rota real.
- Integracoes externas.
- Auditoria avancada.

## Funcionalidades Que Devem Ser Base

- Cardapio.
- Pedido online.
- Gestor de pedidos.
- Configuracoes de restaurante.
- Delivery simples.
- WhatsApp manual/link.
- Usuarios basicos.
- Relatorios basicos.

## Veredito de Produto

A direcao esta correta. A plataforma precisa agora de foco. A empresa deve vender uma V1 clara e confiavel antes de tentar ser Anota AI, Saipos, Goomer, Consumer e OlaClick ao mesmo tempo.

Nota de produto: 83/100.
