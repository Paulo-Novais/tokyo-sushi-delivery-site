# Especificação — Novo Caixa INOVAS Food (mesas, comandas e PDV)

**Versão:** esboço 1 · 10/11/2026
**Autor do pedido:** Paulo
**Esboço visual:** canvas "Esboço — Novo Caixa INOVAS Food" (6 telas clicáveis). As fontes das telas estão em `esboco/` (arquivos `.dc.html`).

> **Importante:** nomes, itens, códigos, preços e valores dos esboços são **exemplo**. Nada disso deve ir para produção como dado real.

---

## 0. Regras do projeto que valem acima desta especificação

O Caixa é um **fluxo congelado** (regras `inovas-regras`). Portanto:

- Trabalhar em **branch dedicada**, fora da pasta do OneDrive. Nunca direto na `main`.
- **Pedir o GO do Paulo** antes de: deploy em Production, migration ou escrita em banco de produção, push na `main`, apagar arquivos/dados, mudar env/domínio/permissões. **O GO vale para uma ação só.**
- Nunca ler, copiar ou exibir `.env.production.local` nem segredos.
- Toda tabela operacional com escopo por restaurante + RLS; runtime sem `BYPASSRLS`; `tenantContext` explícito (sem contexto, a chamada falha). Não usar o Tokyo como restaurante padrão silencioso.
- Testar isolamento com **dois restaurantes**.
- Validar em **Preview com banco separado** do Production antes de pedir GO.
- **Usar o que já existe.** Pelo levantamento anterior, o sistema já tem mesas, comandas, itens/lotes, pagamentos (misto), movimentos de caixa `OPENING / SALE / SUPPLY / WITHDRAWAL / CLOSING`, fechamento (esperado, contado, diferença), auditoria, migrations 022 e 029, e permissões `tenant.cash_register.*`. **Isso precisa ser confirmado no código.** Se algo desta especificação não existir no modelo atual, **parar e perguntar ao Paulo** antes de criar tabela ou coluna.

---

## 1. Objetivo

1. Caixa **mais ágil**: menos cliques, atalhos de teclado, a tela responde na hora.
2. **Mais fácil de mexer**: uma tarefa principal por tela, botões grandes, status sempre escrito.
3. **Funcionar em qualquer resolução**, inclusive monitor ruim/pequeno (pelo menos 1024×768).
4. Lançar pedidos **à la carte, bebidas e tudo do cardápio** do restaurante, com as opções de cada item.

---

## 2. Fluxo geral

```
1 Abrir caixa ──► 2 Salão (mapa de mesas) ──► 3 Abrir comanda ──► 4 Lançar pedido (PDV)
                         ▲                                              │
                         │                                              ▼
                         └──── mesa volta a "Livre · 0 pessoas" ◄── 5 Pagamento
                                                                        
                     6 Fechar caixa (só quando não houver mesa aberta)

Balcão / Viagem / Delivery: entram direto na tela 4 (sem mesa) ──► 5 Pagamento
```

---

## 3. Conceitos e regras de negócio

### 3.1 Mesas

- A **quantidade de mesas é definida a cada abertura de caixa** (tela 1). O sistema sugere a quantidade do último turno.
- **Mesa não tem lugares fixos.** Toda mesa livre mostra **0 pessoas**.
- O número de pessoas **só existe enquanto a comanda está aberta** e é informado ao abrir a comanda.
- Ao pagar e liberar a mesa, ela volta para **Livre · 0 pessoas**.
- Numeração: 1 até N, exibida com dois dígitos (01, 02…).

**Status da mesa** (sempre com texto + cor, nunca só cor):

| Status | Quando | Clique leva a |
|---|---|---|
| Livre | sem comanda aberta | Abrir comanda (tela 3) |
| Ocupada | comanda aberta | Lançar pedido (tela 4) na mesa |
| Pediu conta | conta solicitada/impressa | Pagamento (tela 5) |
| Reservada | reserva marcada (**sugestão**, confirmar se existe) | Abrir comanda |

### 3.2 Comanda

- Abrir comanda exige: **mesa** + **número de pessoas (obrigatório, mínimo 1)**.
- O botão "Abrir mesa" fica **desabilitado enquanto as pessoas forem 0**, com aviso: "Informe quantas sentaram para abrir a comanda".
- Campos opcionais: nome/apelido do cliente e garçom.
- O número de pessoas **pode ser alterado** com a comanda aberta (alguém chegou ou saiu). Mínimo 1. Isso recalcula o "por pessoa".
- Ações da comanda: juntar mesa, transferir mesa (**confirmar se existem hoje**).

### 3.3 Pedido / itens

- Itens vêm do **Cardápio do Gestor**: categorias, preços, códigos, opções e itens pausados. **Não existe cadastro separado para o caixa.**
- Itens **pausados/indisponíveis não aparecem** (ou aparecem bloqueados).
- Cada item lançado tem: produto, quantidade, opções escolhidas, observação, preço unitário (base + adicionais) e situação.
- **Situação do item:**
  - **Para enviar**: lançado e ainda não mandado para a cozinha. Pode editar/remover livremente.
  - **Já na cozinha**: enviado. Remover/cancelar depois disso precisa de permissão e **gera auditoria** (quem, quando, motivo). Isso é **sugestão**: confirmar a regra com o Paulo.
- Itens iguais com as mesmas opções e observação **se somam na mesma linha**.

### 3.4 Opções do item (modificadores)

Grupos configurados no Cardápio. Dois tipos:

- **Escolha 1 (obrigatório)**: ex.: recheio do temaki, sabor do refrigerante, tamanho (lata/600 ml). Já vem com a primeira opção marcada.
- **Opcional, vários**: ex.: adicionais (cream cheese +R$ 3), sem cebolinha.

Cada opção pode ter **preço adicional** (soma no unitário). Também há **observações rápidas** para a cozinha (Sem cebolinha, Pouco arroz, Sem gelo, Prioridade…). A lista deve ser configurável.

> Confirmar no código se o Cardápio atual já tem grupos de opções. Se não tiver, **parar e perguntar** antes de modelar.

### 3.5 Destinos do pedido (tela 4)

| Destino | Precisa de | Botão principal | Botão secundário |
|---|---|---|---|
| Mesa | comanda aberta | Enviar para a cozinha (F2) | Fechar conta (F4) |
| Balcão | nada | Cobrar agora (F4) | Só enviar p/ cozinha (F2) |
| Viagem / Retirada | nome de quem retira | Cobrar agora (F4) | Só enviar p/ cozinha (F2) |
| Delivery | nome/cliente (integrar com o fluxo de Delivery existente, que também é **congelado**) | Cobrar agora (F4) | Só enviar p/ cozinha (F2) |

### 3.6 Totais

- Subtotal = soma dos itens.
- **Taxa de serviço** de 10%, só para Mesa, **removível** por comanda. O padrão deve ser configurável. Isso é **sugestão**: confirmar.
- **Desconto** em valor ou %, com permissão e auditoria (**sugestão**).
- Total e **valor por pessoa** (total ÷ pessoas).

### 3.7 Pagamento (tela 5)

- **Formas de divisão:** dividir igual · por pessoa (o que cada um consumiu; itens "mesa toda" divididos entre todos) · por item · valor livre.
- Na divisão igual, o **centavo que sobra vai para a última pessoa** (ex.: R$ 295,35 ÷ 4 = 73,84 + 73,84 + 73,84 + 73,83).
- **Formas de pagamento:** Dinheiro, Pix, Crédito, Débito, Vale-refeição (confirmar a lista real; o levantamento anterior falava em 6 meios).
- **Pagamento misto** permitido: vários pagamentos parciais até zerar.
- **Dinheiro:** teclado numérico + atalhos de nota (Exato, 80, 100, 200), cálculo de **troco** e aviso de "Falta" se o valor for menor.
- Cada pagamento confirmado gera um movimento `SALE` (confirmar o nome no código).
- "Finalizar e liberar mesa" só fica ativo quando **falta = R$ 0,00**. Ao finalizar, a mesa volta a Livre · 0 pessoas.
- Impressão da conta = comprovante **não fiscal** (confirmar o que o sistema emite hoje).

### 3.8 Abertura do caixa (tela 1)

- Campos: operador (usuário logado), fundo de troco (R$), **quantidade de mesas**.
- Atalho "Usar mesma quantidade do último turno".
- Gera o movimento `OPENING` com o fundo de troco.
- Só um caixa aberto por restaurante ao mesmo tempo (**confirmar regra**).

### 3.9 Sangria e suprimento

- Botão no topo do Salão.
- Sangria = retirada de dinheiro (`WITHDRAWAL`). Suprimento = entrada (`SUPPLY`).
- Pede valor + motivo. Registra quem e quando.

### 3.10 Fechamento do caixa (tela 6)

- Mostra o **recebido por forma de pagamento** e o total do turno.
- **Dinheiro na gaveta:** fundo + vendas em dinheiro + suprimentos − sangrias = **esperado**.
- Operador digita o **contado**; o sistema mostra a **diferença**.
- **Observação obrigatória se houver diferença** (sugestão).
- **Bloquear o fechamento enquanto houver mesas abertas** (sugestão), com botão "Ver mesas abertas".
- Gera o movimento `CLOSING` e o relatório do turno (imprimível).

---

## 4. Telas (o que cada uma tem)

### Tela 1 · Abertura do caixa
Operador, fundo de troco, **quantidade de mesas** (− / + e atalhos 10/15/20/25/30), prévia do salão com todas **Livres · 0 pessoas**, botão "Abrir caixa com N mesas".

### Tela 2 · Salão (mapa de mesas)
- Topo: situação do caixa (quem abriu, horário, fundo), busca (**digitar nº da mesa + Enter abre a mesa**), "+ Nova comanda (F1)", "Lançar pedido / PDV (F3)", "Sangria / Suprimento", "Fechar caixa".
- 4 números: mesas ocupadas (X de N), pessoas no salão, total em aberto nas mesas, recebido no turno.
- Filtros com contagem: Todas · Livres · Ocupadas · Pediu conta · Reservadas.
- Grade de mesas: número grande, status escrito, "N pessoas · tempo aberta", valor em aberto. Mesa livre: borda tracejada, "0 pessoas", "Abrir comanda →".
- Rodapé com os atalhos.

### Tela 3 · Abrir comanda
Modal: tipo (Mesa / Balcão / Viagem), mesas livres para escolher, **pessoas (obrigatório, começa em 0)** com − / + e atalhos 1–8, nome opcional, garçom, "Cancelar (Esc)" e "Abrir mesa XX · N pessoas (Enter)".

### Tela 4 · Lançar pedido (PDV)
- **Lançar em:** Mesa / Balcão / Viagem / Delivery.
- **Busca por código ou nome**, sempre com foco. `3*12` + Enter = 3 unidades do item 12.
- Categorias (do Cardápio) + "Mais vendidos".
- **Multiplicador** "Próximo item ×1…×6": escolhe antes, clica no item e ele volta para ×1.
- Grade de produtos: código, nome, preço ("a partir de" se tiver opções), selo "Opções".
- **Janela de opções** para itens com grupos: escolhas, adicionais com preço, observações rápidas, quantidade, "Adicionar · R$ total".
- **Painel do pedido:** "Já na cozinha" (mesa), "Para enviar" com − / +, itens novos, já na mesa, desconto, total, Limpar, botão secundário e principal (ver 3.5).

### Tela 5 · Pagamento
Total da mesa, modos de divisão, cartões por pessoa (Pago / Agora / Pendente), pagamentos lançados e "Falta receber", formas de pagamento, teclado e troco (dinheiro) ou instrução (maquininha/Pix), "Confirmar pagamento (Enter)", "Finalizar e liberar mesa".

### Tela 6 · Fechamento
Aviso de mesas abertas, recebido por forma, dinheiro na gaveta (esperado × contado × diferença), observação, imprimir relatório, "Fechar caixa".

---

## 5. Funcionar em qualquer resolução (requisito principal)

**Alvo mínimo: 1024×768** (monitor ruim do cliente). Também precisa ficar bom em 1366×768, 1920×1080 e tablet.

Regras de layout:

- **Nada de largura fixa** na tela. Grades com `repeat(auto-fill, minmax(Xpx, 1fr))`:
  - mesas: `minmax(132px, 1fr)`
  - produtos: `minmax(148px, 1fr)`
- Duas colunas (cardápio + pedido; divisão + recebimento) com `flex-wrap`: cardápio `flex: 999 1 520px`, pedido `flex: 1 1 340px`, ambos `min-width: 0`. Em 1024 px ficam lado a lado; abaixo disso, **o pedido desce** para baixo do cardápio.
- Topo com `flex-wrap`: em tela estreita os botões quebram linha, sem cortar nada.
- Categorias em **uma linha com rolagem horizontal**, nunca espremidas.
- Listas longas (itens do pedido) com rolagem **dentro do painel**, não da página inteira.
- `max-width: 1600px` centralizado em telas muito grandes.
- Padding com `clamp(12px, 2vw, 24px)`.

Legibilidade em monitor ruim:

- Texto base **15–16 px**, números importantes 26–36 px, `font-variant-numeric: tabular-nums` em valores.
- **Contraste de texto ≥ 4.5:1.** Cores do esboço: texto `#12151A`, apoio `#5A6270`, borda `#DDE1E6`, fundo `#F4F5F7`, destaque `#C2410C` (só na ação principal).
- Status **sempre escrito**, e as cores de status também diferem em claridade (não só no tom).
- **Alvos de clique/toque ≥ 44 px** (botões principais 52–56 px).
- Fonte Inter, com fallback `system-ui`.

**Critério de aceite:** testar de verdade em 1024×768, 1366×768 e 1920×1080 (e com zoom do navegador em 125%). Nenhum botão cortado, nenhuma rolagem horizontal da página, painel do pedido sempre acessível. Registrar prints.

---

## 6. Agilidade

### Atalhos de teclado

| Tecla | Ação |
|---|---|
| Nº da mesa + Enter (no Salão) | Abre a mesa |
| F1 | Nova comanda |
| F2 | Enviar para a cozinha |
| F3 | Ir para Lançar pedido (PDV) |
| F4 | Cobrar / fechar conta |
| `qtd*código` + Enter (no PDV) | Lança o item com a quantidade |
| Enter | Confirma a janela aberta |
| Esc | Fecha a janela / volta |

> F1 e F3 têm função própria no navegador (ajuda / buscar na página). Testar se dá para interceptar no navegador do cliente. Se não der, trocar e documentar.

### Desempenho

- **UI otimista** ao lançar item, alterar quantidade e confirmar pagamento: mostra na hora e reconcilia com o servidor. Se falhar, desfaz com aviso claro.
- Cardápio e mesas carregados uma vez e **filtrados no cliente**. Atualizar em segundo plano.
- **Esqueletos** no carregamento, nada de tela travada com spinner.
- Medir o tempo até a tela útil **antes e depois** e anotar os números. Não dizer "ficou mais rápido" sem medir.

---

## 7. Dados e permissões (confirmar no código antes de construir)

| Conceito | Provável no sistema atual | Observação |
|---|---|---|
| Sessão de caixa | movimentos OPENING/CLOSING | guardar a quantidade de mesas do turno, **se** não houver lugar: perguntar |
| Mesa | mesas | **sem capacidade fixa**: se existir coluna de lugares, não usar como obrigatória |
| Comanda | comandas | precisa de `pessoas` (≥1) |
| Item da comanda | itens/lotes | situação para enviar × enviado; opções e observação |
| Opções do cardápio | ? | **verificar se existe** |
| Pagamento | pagamentos (misto) | forma, valor, troco, pessoa (se dividido) |
| Movimento de caixa | OPENING / SALE / SUPPLY / WITHDRAWAL / CLOSING | |
| Fechamento | esperado, contado, diferença | observação |
| Auditoria | auditoria | cancelamentos, descontos, sangria, diferença |

- Todas com `restaurant_id`/tenant + RLS.
- Permissões por cargo (`OWNER`, `OPERATOR`, `WAITER`, `DELIVERY`) usando `tenant.cash_register.*`. Sugestão (confirmar): garçom abre comanda e lança itens; só operador/dono cobra, dá desconto, faz sangria e fecha caixa.

---

## 8. Testes mínimos

1. Abrir caixa com 12 mesas → Salão mostra 12 mesas, todas Livre · 0 pessoas.
2. Tentar abrir comanda com 0 pessoas → bloqueado.
3. Abrir mesa 05 com 4 pessoas → mesa fica Ocupada · 4 pessoas.
4. Lançar item com opções obrigatórias e adicional pago → preço unitário correto.
5. Mesmo item com as mesmas opções → soma na mesma linha. Com opção diferente → linha nova.
6. Enviar para a cozinha → itens passam para "Já na cozinha".
7. Dividir R$ 295,35 por 4 → 73,84 / 73,84 / 73,84 / 73,83.
8. Pagamento misto (Pix + dinheiro com troco) → falta R$ 0,00 → libera a mesa → volta a 0 pessoas.
9. Sangria e suprimento entram no "esperado" do fechamento.
10. Fechar caixa com mesa aberta → bloqueado (se a regra for confirmada).
11. **Isolamento:** restaurante A não vê nem altera mesas, comandas, pagamentos ou caixa do restaurante B. Chamada sem `tenantContext` falha.
12. **Resolução:** 1024×768, 1366×768 e 1920×1080, sem cortes.

---

## 9. Decidido × a confirmar

**Decidido pelo Paulo:**
- Quantidade de mesas definida a cada abertura de caixa.
- Mesa sem lugares fixos: livre = 0 pessoas.
- Número de pessoas obrigatório ao abrir a comanda.
- Lançamento à la carte, bebidas e tudo do cardápio do restaurante.
- Sistema ágil, fácil de mexer e funcionando em várias resoluções (monitor ruim).

**Sugestões do esboço, a confirmar com o Paulo:**
- Status "Reservada".
- Juntar / transferir mesa.
- Regra de cancelamento de item já enviado (permissão + auditoria).
- Taxa de serviço de 10% como padrão, removível.
- Desconto com permissão.
- Lista exata de formas de pagamento.
- Observação obrigatória quando houver diferença no fechamento.
- Bloquear fechamento com mesas abertas.
- Atalhos F1–F4 (testar conflito com o navegador).
- Permissões por cargo descritas em 7.

---

## 10. Ordem de implementação sugerida

1. Ler o estado real (branch, commit, arquivos alterados). Mapear o modelo de dados do caixa e do cardápio. **Listar as diferenças com esta especificação e levar ao Paulo.**
2. Branch dedicada (ex.: `feat/novo-caixa`).
3. Componentes compartilhados: grade responsiva, botões, stepper −/+, cartões de status, modal.
4. Telas na ordem: Abertura → Salão → Abrir comanda → PDV → Pagamento → Fechamento.
5. Testes (seção 8) + `validate-*` ligados.
6. Preview com banco separado. Testar nas 3 resoluções.
7. Checklist de deploy, backup e rollback. **Pedir GO** ao Paulo.
