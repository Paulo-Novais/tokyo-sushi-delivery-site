# INovas Food - Business Review

Data: 2026-06-25

Escopo: revisao comercial, planos, recursos, contratos, feature flags, modulos, upsell, cross-sell, concorrentes e visao de mercado.

## Sumario

A INovas Food tem potencial comercial alto porque ataca uma dor real: restaurantes querem vender direto, controlar pedidos, reduzir dependencia de marketplaces e profissionalizar operacao. A plataforma tem uma base tecnica que permite criar planos comerciais fortes.

O desafio e posicionamento. Concorrentes ja vendem muitos modulos prontos. A INovas Food deve entrar com uma proposta clara: canal proprio + gestor forte + modularidade + suporte de plataforma + evolucao para entrega inteligente.

## Planos

Modelo atual documentado:

- START.
- PRO.
- PREMIUM.

Leitura comercial:

- START deve ser entrada simples e barata.
- PRO deve ser o plano mais vendido.
- PREMIUM deve concentrar automacao, relatorios, IA e modulos avancados.

## Recursos por Plano

Sugestao de empacotamento:

### START

Para restaurante pequeno que quer vender online.

Recursos:

- Cardapio digital.
- Pedido online.
- Gestor de pedidos.
- Delivery simples.
- Configuracoes basicas.
- WhatsApp/link.
- Relatorios basicos.

### PRO

Para restaurante com operacao recorrente.

Recursos:

- Tudo do START.
- Usuarios e permissoes.
- Promocoes.
- CRM basico.
- Avaliacoes.
- Financeiro basico.
- Estoque simples.
- Relatorios por periodo.
- Dominio proprio como add-on ou incluso.

### PREMIUM

Para restaurante que quer crescimento e automacao.

Recursos:

- Tudo do PRO.
- CRM avancado.
- Fidelidade/cupons.
- Campanhas.
- Relatorios avancados.
- KDS.
- QR mesa/comanda.
- IA WhatsApp.
- Entrega por rota.
- App entregador.
- Auditoria avancada.

## Contratos

Estado atual:

- Estrutura de contratos/assinaturas existe de forma simulada no Master.
- Billing real ainda nao existe.

Recomendacoes:

- Contrato deve ser por organizacao, com possibilidade de restaurante opcional.
- Plano deve controlar recursos.
- Billing deve controlar status financeiro.
- Bloqueio por inadimplencia deve ser gradual e auditavel.
- Mudancas de plano devem gerar evento.

## Feature Flags

Pontos fortes:

- Ja existem e conectam produto/comercial.

Uso comercial recomendado:

- Liberar modulo por plano.
- Permitir piloto por restaurante.
- Fazer rollout gradual.
- Criar add-ons.
- Desativar modulo com seguranca.

Cuidados:

- Feature flag nao substitui permissao.
- Feature flag precisa escopo por tenant.
- Mudanca de flag deve ser auditada.

## Upsell

Melhores oportunidades:

1. Dominio proprio.
2. CRM e campanhas.
3. Fidelidade/cupons.
4. Relatorios avancados.
5. KDS/cozinha.
6. QR mesa/comanda.
7. IA WhatsApp.
8. Entrega por rota.
9. App entregador.
10. Multiusuario/permissoes avancadas.

## Cross-sell

Possibilidades:

- Setup premium de cardapio/fotos.
- Configuracao de dominio.
- Consultoria de delivery proprio.
- Campanhas mensais.
- Treinamento de equipe.
- Pacote de relatorios.
- Implantacao presencial/remota.

## Modulos Que Mais Vendem

Alta chance comercial:

- Cardapio + pedido online.
- WhatsApp/automacao.
- Dominio proprio.
- Promocoes/cupons.
- CRM/recuperacao de clientes.
- Relatorios.
- QR mesa.
- KDS.

Media chance:

- Estoque simples.
- Financeiro basico.
- App entregador.
- Fidelidade.

Mais dificil:

- PDV completo.
- Fiscal/NFC-e.
- Marketplace.
- BI Enterprise.

## Analise de Concorrentes

Fontes publicas consultadas em 2026-06-25:

- Anota AI: https://anota.ai/ e pagina de gestao avancada.
- Saipos: https://saipos.com/ e pagina de delivery.
- Consumer/MenuDino: paginas de planos e comparacao MenuDino.
- Goomer: home, cardapio digital delivery e planos.
- OlaClick: home, cardapio digital e dominio proprio.

### Anota AI

Forcas observadas:

- Atendimento automatizado.
- IA WhatsApp/Facebook/Instagram.
- Cardapio digital.
- PDV.
- QR mesa.
- App garcom.
- KDS.
- Estoque.
- Financeiro.
- NFC-e.
- Recuperador/cashback/fidelizacao.

Onde a INovas Food pode ser melhor:

- Arquitetura tenant documentada.
- Painel Master e controle comercial.
- Modularidade com permissoes/planos.
- Entrega por rota real futura.

Onde perde:

- Modulos prontos e marketing de IA.

### Saipos

Forcas observadas:

- Gestao completa.
- Pedidos por balcao, mesa e delivery.
- Financeiro, estoque, fiscal e relatorios.
- Integracoes com delivery e pagamentos.
- Roteirizacao/logistica.

Onde a INovas Food pode ser melhor:

- Leveza e foco em canal proprio.
- Customizacao/white-label.
- Master SaaS.

Onde perde:

- Profundidade ERP/fiscal/logistica.

### Consumer/MenuDino

Forcas observadas:

- Cardapio integrado ao PDV Consumer.
- Bot WhatsApp.
- ChatGPT para clientes.
- Cupons.
- Fidelidade.
- Pagamento online.
- App entregador.
- Dominio personalizado.
- Analytics/pixel/SEO.

Onde a INovas Food pode ser melhor:

- Arquitetura de plataforma propria.
- Controle granular e Master.
- Diferencial futuro de rota real.

Onde perde:

- Ecossistema PDV + cardapio mais maduro.

### Goomer

Forcas observadas:

- Cardapio digital.
- Delivery, mesa, balcao.
- QR Code.
- Totem.
- WhatsApp/atendente virtual.
- Planos simples e entrada gratuita/baixo custo.

Onde a INovas Food pode ser melhor:

- Gestor/Master mais ambicioso.
- Permissoes e planos de plataforma.
- Operacao vertical para restaurante modelo.

Onde perde:

- Simplicidade comercial e maturidade de autoatendimento.

### OlaClick

Forcas observadas:

- PDV.
- Cardapio digital.
- IA/marketing.
- QR Code.
- WhatsApp.
- Dominio proprio.
- Fidelidade.
- Pix/pagamentos.
- App entregador.
- Rastreamento.
- Estoque.

Onde a INovas Food pode ser melhor:

- Arquitetura documentada e segura para SaaS.
- Master comercial.
- Possivel diferencial em rota real.

Onde perde:

- Amplitude de funcionalidades prontas.

## Diferenciais a Proteger

- Painel Master.
- Permissoes granulares.
- Plano/contrato/recurso/feature flag.
- Estrategia tenant documentada.
- Entrega por rota real.
- IA como assistente operacional.
- White-label/dominio proprio.
- Qualidade do gestor de pedidos.

## Funcionalidades Que Nunca Devem Sair da Visao

- Cardapio digital.
- Pedido online.
- WhatsApp.
- Gestor de pedidos.
- QR mesa.
- KDS.
- CRM.
- Promocoes/cupons.
- Fidelidade.
- Relatorios.
- Dominio proprio.
- Entrega inteligente.
- IA assistiva.
- Integracoes.

## Quem Compraria Hoje

Compraria:

- Restaurante independente com delivery proprio.
- Restaurante japones, pizzaria, hamburgueria, acai, bar com pedidos recorrentes.
- Dono que quer canal proprio.
- Restaurante que valoriza marca e atendimento direto.

Nao compraria:

- Rede grande.
- Quem exige fiscal/PDV completo no dia 1.
- Quem depende 100% de iFood integrado.
- Quem busca app nativo pronto.

Quem indicaria:

- Consultores de marketing local.
- Clientes satisfeitos com canal proprio.
- Restaurantes que querem reduzir taxas de marketplace.

Quem trocaria de concorrente:

- Cliente de cardapio simples que quer gestor melhor.
- Cliente que acha concorrente caro/engessado.
- Cliente que quer personalizacao.

## Valuation Comercial Tecnico

Classificacao: alto potencial, maturidade comercial media-alta.

Motivo:

- Mercado amplo.
- Dor clara.
- Produto ja existe.
- Arquitetura permite planos.
- Mas ainda falta billing, onboarding, multi-tenant e prova em producao.

Nota comercial: 82/100.
