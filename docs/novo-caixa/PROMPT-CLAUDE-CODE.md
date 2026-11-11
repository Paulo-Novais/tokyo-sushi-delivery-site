# Como colocar o Claude Code (VS Code) para construir o Novo Caixa

## Passo a passo (5 minutos)

1. Abra no VS Code o **clone do repositório que está FORA do OneDrive** (não use a pasta `C:\Users\Logito\OneDrive\Documentos\Inovas` como repositório).
2. Crie a pasta `docs/novo-caixa/` no repositório e coloque dentro dela o conteúdo do zip:
   ```
   docs/novo-caixa/ESPEC-CAIXA.md
   docs/novo-caixa/PROMPT-CLAUDE-CODE.md
   docs/novo-caixa/esboco/*.dc.html
   docs/novo-caixa/esboco/canvas.json
   ```
3. Abra o terminal do VS Code (Ctrl + ') e rode `claude`.
4. Cole o **Prompt da Fase 1** abaixo. Quando ele terminar e te mostrar o relatório, leia, responda as perguntas e cole o **Prompt da Fase 2**, e assim por diante.
5. Ele vai parar sozinho nos pontos de GO. Só responda "GO" para a ação que ele pedir, uma de cada vez.

> Dica: a pasta `docs/` não pode ser baixada pelo site depois do deploy. A Fase 6 confere isso.

---

## Prompt da Fase 1 — Entender antes de mexer (não altera nada)

```
Leia docs/novo-caixa/ESPEC-CAIXA.md inteiro e os esboços em docs/novo-caixa/esboco/ (são telas em HTML com a lógica no <script>; use como referência visual e de comportamento, não copie o formato .dc.html).

Siga a skill/regras inovas-regras. O Caixa é fluxo congelado.

NESTA FASE NÃO ALTERE NENHUM ARQUIVO E NÃO RODE NADA QUE ESCREVA EM BANCO.

Faça:
1. Mostre o estado real: branch atual, último commit, arquivos alterados/não commitados, e se está fora do OneDrive.
2. Mapeie como o Caixa funciona hoje no código: rotas/páginas, componentes, APIs, tabelas e migrations (procure 022 e 029), permissões tenant.cash_register.*, e como o Cardápio guarda categorias, itens, preços, códigos e opções/adicionais.
3. Monte uma tabela "Especificação × Código atual" para cada item das seções 3, 4 e 7 da ESPEC: já existe / existe parecido / não existe.
4. Liste tudo que exigiria tabela/coluna/migration nova. NÃO crie nada.
5. Liste as perguntas da seção 9 ("a confirmar") e qualquer outra dúvida.
6. Proponha o plano de implementação em etapas pequenas, cada uma com os testes que vai rodar.

Termine com o relatório e as perguntas, e PARE. Espere minha resposta.
```

---

## Prompt da Fase 2 — Branch e base compartilhada

```
Respostas às perguntas: [COLE AQUI SUAS RESPOSTAS]

Agora:
1. Crie a branch feat/novo-caixa a partir da main atualizada (sem push na main).
2. Crie os componentes base responsivos descritos na seção 5 da ESPEC: grade auto-fill, stepper −/+, botões ≥44px, cartão de status (texto + cor), modal, barra de topo com flex-wrap. Use as cores e tamanhos da ESPEC.
3. Não mexa ainda em nenhuma tela existente do Caixa.
4. Rode os testes unitários e os validate-* relacionados. Mostre o resultado.
5. Revise o que vai entrar antes de commitar (nada de git add .; nada de arquivos -Paulo, _tmp_*, .tmp/, .env*). Faça commit local na branch.

Mostre o diff resumido e PARE.
```

---

## Prompt da Fase 3 — Abertura, Salão e Abrir comanda (telas 1, 2 e 3)

```
Implemente as telas 1 (Abertura), 2 (Salão) e 3 (Abrir comanda) conforme a ESPEC e os esboços Abertura.dc.html, Main.dc.html e NovaComanda.dc.html.

Regras que não podem falhar:
- Quantidade de mesas definida na abertura; toda mesa livre = 0 pessoas; mesa sem lugares fixos.
- Abrir comanda exige pessoas >= 1 (botão desabilitado com 0).
- Ao liberar a mesa ela volta a Livre · 0 pessoas.
- tenantContext explícito em toda chamada; sem contexto, falha.

Antes de codar cada regra de negócio, escreva o teste que falha. Inclua o teste de isolamento com dois restaurantes.
Se precisar de migration: escreva com rollback e ordem de aplicação, aplique SÓ em banco local/teste, e me avise. Não toque em banco de Preview compartilhado nem de Production.

Rode testes + validate-*, commit local na branch, mostre o resultado e PARE.
```

---

## Prompt da Fase 4 — PDV (tela 4)

```
Implemente a tela 4 (Lançar pedido / PDV) conforme a ESPEC (3.3 a 3.6 e 4) e o esboço PDV.dc.html:
- Destinos Mesa / Balcão / Viagem / Delivery (no Delivery, só integre com o fluxo existente; não mude o fluxo de Delivery sem me perguntar).
- Cardápio lido do Cardápio do Gestor (categorias, itens pausados ocultos, opções obrigatórias e adicionais com preço).
- Busca por código ou nome com foco automático; "3*12 + Enter" lança 3 do item 12.
- Multiplicador ×1–×6; itens iguais somam na mesma linha.
- "Para enviar" × "Já na cozinha"; F2 envia; F4 fecha conta/cobra.
- UI otimista com desfazer se o servidor falhar.

Testes primeiro para preço com adicionais, soma de linhas iguais e envio para a cozinha.
Rode testes + validate-*, commit local, e PARE.
```

---

## Prompt da Fase 5 — Pagamento e Fechamento (telas 5 e 6)

```
Implemente as telas 5 (Pagamento) e 6 (Fechamento) conforme a ESPEC (3.7, 3.9, 3.10) e os esboços Pagamento.dc.html e Fechamento.dc.html:
- Divisão igual com centavo sobrando na última pessoa (295,35 / 4 = 73,84 ×3 + 73,83), por pessoa, por item, valor livre.
- Pagamento misto, troco em dinheiro, "Finalizar e liberar mesa" só com falta = 0.
- Sangria/suprimento, esperado × contado × diferença, regras confirmadas na Fase 1.

Rode todos os testes da seção 8 da ESPEC. Mostre a lista com passou/falhou.
Commit local e PARE.
```

---

## Prompt da Fase 6 — Validar em Preview e preparar o GO

```
1. Confirme que o Preview usa banco SEPARADO do Production. Se usar o mesmo banco, NÃO faça testes com escrita e me avise.
2. Faça push da branch feat/novo-caixa (não da main) e gere o Preview.
3. Teste no Preview nas resoluções 1024x768, 1366x768 e 1920x1080 (e zoom 125%). Liste problemas.
4. Confira por HTTP, sem login, que docs/, scripts, testes, migrations e configs não são baixáveis.
5. Meça o tempo até a tela útil do Caixa (antes × depois) e anote os números.
6. Escreva o checklist de deploy: backup, migrations na ordem com status por ambiente, rollback.

Me entregue o relatório e PEÇA O GO para Production. Não faça deploy em Production sem meu GO.
```
