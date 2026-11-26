# Roadmap do Gestor

## Diretriz principal

O foco imediato do produto deixa de ser expansao horizontal de modulos e passa a ser consolidacao operacional.

Prioridade real de execucao:

1. Site publico + gestor web 100% funcionais
2. Operacao diaria de pedidos sem gargalo
3. Modulos administrativos essenciais com uso real
4. Expansoes operacionais e estrategicas
5. App mobile apenas depois da base web estar madura

## Fase inicial do gestor

Objetivo: transformar o painel administrativo em um gestor de pedidos confiavel para uso diario do restaurante.

Escopo prioritario:

- Sidebar funcional
- Topo com indicadores rapidos
- Area central de pedidos
- Painel lateral de detalhes
- Separacao clara entre pedidos ativos e pedidos encerrados

Fluxo operacional obrigatorio:

- Recebido
- Aceito
- Em preparo
- Pronto
- Saiu para entrega
- Entregue
- Retirada concluida
- Cancelado

Regras da fase inicial:

- Ativos ficam no fluxo principal do kanban
- Entregues, retiradas concluidas e cancelados saem do kanban ativo
- Cards precisam mostrar codigo, cliente, tipo, horario, valor, pagamento, observacao rapida, espera e status
- O painel lateral precisa mostrar cliente, endereco, itens, observacoes, pagamento, troco, historico e acoes rapidas
- As acoes rapidas obrigatorias sao: aceitar, iniciar preparo, marcar pronto, despachar, concluir retirada, concluir entrega e cancelar

## Fase 2

Objetivo: ativar corretamente os modulos administrativos essenciais que hoje ainda nao entregam uso real.

Modulos:

- Agendamentos
- Cardapio
- Promocoes
- Avaliacoes
- Configuracoes

Regra: cada modulo deve deixar de ser apenas visual e passar a ter valor pratico no sistema.

## Fase 3

Objetivo: profissionalizar a operacao do gestor depois que o fluxo principal de pedidos estiver estavel.

Expansoes:

- Modulo de entregas
- Controle de producao/cozinha
- Historico de pedidos
- Filtros e busca inteligente
- Dashboard operacional com metricas do dia

## Fase 4

Objetivo: ampliar o valor estrategico do gestor depois da operacao base estar redonda.

Expansoes:

- Chat entre cliente e loja pelo site com resposta pelo gestor
- Relatorios e custo operacional
- Inteligencia de avaliacoes

Regra de publicacao das avaliacoes:

- 1 estrela: publicar por 1 semana
- 2 estrelas: publicar por 2 semanas
- 3 estrelas: publicar por 3 semanas
- 4 estrelas: publicar por 6 semanas
- 5 estrelas: publicar por 8 semanas

Regras de exibicao no site:

- Media geral nunca abaixo de 4.2 visualmente
- Texto exemplo: "4.7 de 5"
- Texto exemplo: "Baseado em 128 avaliacoes recentes"
- Calculo interno com base nos ultimos 60 dias

## Fases futuras

- App mobile fica para depois
- Primeiro consolidar site + gestor web
- Depois avaliar app e novas expansoes
