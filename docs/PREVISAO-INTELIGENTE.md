# Previsão inteligente de vendas e compras — proposta

Pedido do Paulo (19/11/2026): prever vendas e compras de mercadoria,
comparando com a semana passada, o mês passado e o ano passado, para o
restaurante comprar certo, não ficar com estoque parado (prejuízo) e focar no
que tem saída.

Status: **proposta**. Nada foi implementado ainda.

## O que o sistema já tem e o que falta

| Já tem | Falta para a previsão |
|---|---|
| Histórico de pedidos com itens, dia e hora | — (é a base da previsão de vendas) |
| Estoque: quantidade, unidade, mínimo e validade | Histórico de entradas e saídas, com custo |
| Curva ABC dos pratos, horários de pico | Ligação prato → ingredientes (**ficha técnica**) |
| Clientes: recorrentes, em risco, sumidos | Fornecedor e dia de entrega de cada item |

Sem a ficha técnica, o sistema sabe **quantos pratos** vão sair, mas não
**quantos quilos de salmão** comprar. Por isso a ficha técnica sobe de
prioridade: ela passa a ser a base da previsão.

## Como a previsão funciona (simples e explicável)

Para cada prato, a cada dia, o sistema calcula:

1. **Base:** média do **mesmo dia da semana** nas últimas 4 semanas, com peso
   maior para as semanas mais recentes. Sábado é comparado com sábado.
2. **Tendência:** o mês atual está vendendo mais ou menos que o mês passado? Ajusta.
3. **Ano passado:** quando houver histórico, a mesma época do ano passado
   (ex.: dezembro, férias) corrige a sazonalidade.
4. **Calendário:** feriados, véspera de feriado, dia de pagamento (5º dia útil),
   Dia dos Namorados, Dia das Mães, jogos do Brasil. O restaurante também marca
   eventos próprios ("festival", "chuva forte").
5. **Margem de segurança:** quanto mais o prato varia de um dia para outro,
   maior a folga sugerida, para não faltar no dia de pico.

Toda previsão mostra **por que** chegou no número. Exemplo:
"Sábado: 38 Combinados Kumo. Média dos últimos sábados: 32. Mês 8% acima. Véspera de feriado."

**Aprende sozinha:** toda semana o sistema compara o previsto com o que
realmente vendeu e mostra a **taxa de acerto**. Em cada restaurante, os pesos
se ajustam ao jeito daquele restaurante. Com isso o dono passa a confiar nos números.

## O que o dono vê

1. **Previsão da semana:** vendas por dia (R$ e pratos), comparando com a
   semana passada, o mês passado e o ano passado.
2. **Lista de compras pronta:** para cada ingrediente:
   - previsão de uso até a próxima entrega do fornecedor;
   - menos o que já tem no estoque;
   - mais a folga de segurança.
   - Resultado: "Compre 12 kg de salmão até quinta".
   - Um botão envia o pedido no WhatsApp do fornecedor.
3. **Estoque parado (prejuízo):** itens sem saída há X dias, quanto dinheiro
   está parado e o que vence logo.
4. **Do estoque parado para a venda (diferencial):**
   - o sistema sugere uma promoção com os pratos que usam aquele ingrediente;
   - a promoção vai para os clientes que já pediram esses pratos (tela de Clientes).
   - Estoque parado vira venda em vez de virar lixo.
5. **Giro do estoque:** o que gira rápido (manter sempre) e o que gira devagar
   (comprar menos, com mais frequência).

## Sempre com gráfico (pedido do Paulo, 19/11)

Toda sugestão inteligente aparece com um gráfico no mesmo padrão, para o dono
entender sem ler números. São quatro partes na mesma linha do tempo:

1. **Como era:** o histórico real em linha cheia (vendas, uso do ingrediente
   ou estoque), comparado com a semana passada, o mês passado e o ano passado
   (em linhas mais claras).
2. **Rupturas e excesso:**
   - **ruptura** (faltou: prato pausado ou estoque zerado) marcada em vermelho;
     o gráfico mostra quanto deixou de vender ("faltou salmão no sábado: ~R$ 640 perdidos");
   - **excesso** (sobrou: estoque acima do necessário ou item vencido) marcado
     em amarelo, com o dinheiro parado ou perdido.
3. **O que o sistema orienta:** a recomendação em destaque em cima do gráfico.
   Exemplos:
   - "compre 12 kg até quinta";
   - "não compre cream cheese esta semana";
   - "faça promoção do Hot Roll".
4. **Projeção:** linha tracejada para frente, com uma faixa de "mínimo e
   máximo provável" e duas linhas: **seguindo a orientação** e **sem fazer nada**.
   Assim o dono vê o ganho de seguir a sugestão.

Vale para todos os tipos de sugestão:

| Sugestão | O gráfico mostra |
|---|---|
| Previsão de vendas | Vendas por dia: real, semana/mês/ano passado e projeção |
| Compra de mercadoria | Estoque do ingrediente: real, rupturas, excesso, compra sugerida e estoque projetado |
| Estoque parado | Dias sem saída e dinheiro parado; projeção com e sem promoção |
| Margem por prato | Custo e margem ao longo do tempo; projeção com e sem reajuste |
| Clientes prestes a sumir | Intervalo de cada cliente entre pedidos; quem passou do normal |
| Equipe e horários | Pedidos por hora previstos x equipe escalada |
| Meta do mês | Faturamento acumulado x meta, com a projeção de fechamento |
| Acerto da previsão | Previsto x vendido, semana a semana (mostra que o sistema está acertando) |

Antes de programar, fazer um **esboço visual** dessas telas para o Paulo
aprovar, como foi feito com a tela de Pedidos e o cadastro.

## Outras sugestões inteligentes para os donos

- **Margem por prato:**
  - com a ficha técnica e o custo da última compra, o sistema mostra quanto sobra em cada prato;
  - avisa quando o custo de um ingrediente sobe e a margem cai ("o salmão subiu 15%: o Kumo caiu de 52% para 41% de margem");
  - sugere reajuste.
- **Cardápio inteligente:** cruza a Curva ABC com a margem.
  - Pratos que vendem pouco e dão pouca margem: candidatos a sair.
  - Pratos que vendem muito e dão pouca margem: candidatos a reajuste.
- **Equipe por movimento previsto:** "sexta 20h–22h deve ter 45 pedidos: escale mais 1 pessoa na cozinha".
- **Meta e projeção do mês:** "no ritmo atual o mês fecha em R$ 48 mil (+6% vs outubro)".
- **Cliente prestes a sumir:**
  - cada cliente tem um intervalo próprio entre pedidos;
  - quando passa do normal dele, entra numa lista para chamar no WhatsApp,
    antes de completar 30 dias.
- **Alerta de coisa fora do normal:**
  - pedidos muito abaixo do esperado para o horário (site fora? iFood pausado?);
  - cancelamentos acima do normal.
- **Resumo diário no WhatsApp do dono:** fechamento de hoje, previsão de amanhã
  e o que comprar.

## Ordem sugerida

1. **Histórico do estoque:** entradas com custo e fornecedor; saídas e perdas. Base para tudo.
2. **Ficha técnica simplificada:** só os ingredientes principais de cada prato
   (salmão, arroz, cream cheese, nori…); o restaurante não precisa cadastrar tudo.
3. **Previsão de vendas:** semana, mês, ano, calendário e taxa de acerto. Já
   funciona sem a ficha técnica (só com o histórico de pedidos).
4. **Lista de compras** e **estoque parado**, com envio ao fornecedor.
5. **Estoque parado → promoção para clientes** e **margem por prato**.
6. Equipe, metas, alertas e resumo diário.

O passo 3 já dá para fazer com o que existe hoje. Os passos 4 e 5 dependem dos passos 1 e 2.
