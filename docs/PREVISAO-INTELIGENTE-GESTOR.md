# Previsão inteligente no Gestor (fases 1 e 2)

Tela nova no Gestor: **Resultados › Previsão**. A fase 1 só lê os pedidos do restaurante logado. A fase 2 grava a ficha técnica, as taxas e o histórico do estoque, na tabela que o estoque já usa. Nenhuma das duas tem migration nem muda Caixa, Pedidos ou Delivery.

## O que a tela mostra

| Bloco | De onde vem | Como calcula |
|---|---|---|
| O que o sistema orienta | pedidos | Mostra o dia mais forte e o mais fraco dos próximos 7 dias e o prato mais pedido no dia forte. |
| Indicadores | pedidos | Previsão dos próximos 7 dias com faixa provável. Compara com os últimos 7 dias, com a mesma semana do mês passado e com a do ano passado. Também mostra o acerto. |
| Vendas por dia | pedidos | 28 dias de histórico e 14 dias de previsão. Linhas da semana passada e do ano passado. Faixa mínimo–máximo. |
| O que vai sair no dia forte | itens dos pedidos | Média de cada prato no mesmo dia da semana nas últimas 6 semanas. Diz se o prato está subindo ou caindo. |
| Acerto da previsão | pedidos | Refaz a previsão das últimas 8 semanas usando só o que se sabia antes e compara com o que foi vendido. |
| Matéria-prima: comprar mais ou menos | estoque atual | Abaixo ou perto do mínimo = comprar. Vencido ou vencendo = não comprar e usar primeiro. |
| Clientes com frequência caindo | pedidos | Antes = pedidos por mês nos 3 meses anteriores. Agora = pedidos nos últimos 30 dias. Entra quem fazia 3 ou mais pedidos e caiu pela metade. Botão de WhatsApp com mensagem pronta e o prato favorito. |
| Fechamento do mês | pedidos | Soma acumulada do mês, mais a previsão dos dias que faltam, comparada com o mês passado. |
| Hoje x o normal | pedidos | Pedidos por hora de hoje contra a faixa normal do mesmo dia da semana. Avisa quando as últimas horas vêm 50% ou mais abaixo do normal. Também avisa quando um canal que costuma vender não teve nenhum pedido hoje. |
| Lucro e prejuízo por prato | — | Aparece como **em breve**. Depende da ficha técnica. |

**Como a previsão é feita:**
- Usa a média do mesmo dia da semana nas últimas 6 semanas. As semanas mais recentes pesam mais.
- Esse valor é corrigido pela tendência: as últimas 4 semanas comparadas com as 4 anteriores, limitada a ±15%.
- O dia conta igual ao Caixa: pedidos até 1h30 entram no dia anterior, no horário de Brasília.
- Pedidos cancelados não entram.

## Segurança e isolamento

- Rota: `GET /api/admin/forecast`. Exige sessão do Gestor e a permissão `reports_view`, a mesma de Relatórios.
- A consulta usa o `tenantContext` da sessão (`getOperationalTenant(..., "orders:forecast")`) e filtra por `tenant_id`, `restaurant_id` e `restaurant_key`. Sem contexto, falha.
- Lê no máximo 400 dias e 20.000 pedidos.
- O teste `tests/e2e/gestor-previsao.spec.js` cria dois restaurantes, faz um pedido só no A e confere que o B não vê esse pedido. Também confere que, sem login, a rota responde 401.

## O que foi testado e o que é suposição

**Testado:**
- `tests/unit/forecast.test.cjs`: padrão do dia da semana, acerto, cancelados, cliente caindo, mês, alerta, estoque e telefone.
- E2E da tela e do isolamento.
- Suítes do Gestor.
- `validate:public-build`: o arquivo novo `lib/forecast.cjs` não vai para o site público.

**Suposição:**
- Na linha "mandando mensagem", a volta dos clientes é uma estimativa: recupera de 35% a 50% da queda. Na tela está escrito "estimativa".
- A precisão real depende do volume de pedidos de cada restaurante. Com menos de 2 semanas de pedidos, a tela avisa.

## Fase 2: ficha técnica, lucro por prato e matéria-prima

**Sem migration.** Tudo fica na tabela que o estoque já usa (`inventory_runtime_state`), com outras chaves:
- `<restaurante>:default:recipes`: ficha técnica e taxas dos canais;
- `<restaurante>:default:movements`: histórico de movimentos.

Toda leitura e escrita filtra por `tenant_id`, `restaurant_id` e `restaurant_key` do restaurante da sessão. Em desenvolvimento, esses dados ficam em `.data/inventory-aux.json`.

| O que | Onde o dono preenche | Para que serve |
|---|---|---|
| Custo por unidade do item | Cardápio › Estoque › editar item | Custo da ficha técnica |
| Perda / descarte | Cardápio › Estoque › movimentar › aba **Perda** | Histórico de sobras (excesso) |
| Ficha técnica do prato | Resultados › Previsão › botão "ficha" ou nome do prato sem ficha | Custo do prato e consumo previsto |
| Taxa de cada canal (%) | Resultados › Previsão › "Taxas dos canais" | Lucro real no iFood/99Food/Keeta |

**O que a tela calcula:**
- **Lucro e prejuízo por prato**, nos últimos 30 dias e nos 30 anteriores ("como era"). A conta é preço − custo da ficha − taxa do canal do pedido − embalagem. A orientação de cada prato é uma destas:
  - prejuízo: mostra o preço para 30% de margem;
  - margem baixa;
  - lucra bem e vende pouco: divulgar;
  - manter;
  - falta custo de algum ingrediente.
- **Matéria-prima: comprar mais ou menos.**
  - Faltas: vezes que o item zerou, contando no máximo 1 por dia.
  - Perdas: em R$, nos últimos 60 dias.
  - Consumo dos próximos 7 dias: previsão por prato × ficha técnica.
  - Compra sugerida: consumo + mínimo − estoque atual.
  - Gráfico de faltas e perdas por mês.
  - Cada entrada, baixa, perda e ajuste de quantidade vira histórico. O histórico guarda 400 dias e no máximo 6.000 movimentos por restaurante.

**Permissões:**
- Ver: `reports_view` / `inventory_view`.
- Salvar ficha e taxas: `inventory_edit`.

**Testes:**
- `tests/unit/forecast.test.cjs`: custo, taxa, prejuízo, consumo, faltas, perdas e chave do prato.
- `tests/e2e/gestor-previsao.spec.js`: custo, ficha e perda salvos. O restaurante B não vê ficha, custo nem perdas do A, e não salva ficha com item que não é dele.

## Ainda falta

- Avisar o fornecedor pelo WhatsApp com a lista de compras pronta.
- Perdas antigas não existem: o histórico começa a contar quando o restaurante passa a registrar.
