# Pizza montada (cardápio do tipo Pizzaria)

## Para o dono do restaurante (Gestor)

Cardápio → **Montagem de pizza**:

- **Mostrar “Monte sua pizza”** no topo do cardápio do site.
- **Tamanho** (ex.: “8 pedaços”).
- **Quantos sabores**: 1, 2, 3 e/ou 4.
- **Categorias que são sabores**: cada prato dessas categorias vira um sabor, com o
  preço da pizza inteira daquele sabor (ex.: Pizzas Salgadas, Pizzas Doces).
- **Bordas recheadas**: nome + preço (ex.: Catupiry 9,00, Cheddar 9,00, Muçarela 8,00).
  Sem bordas cadastradas, a parte de borda não aparece no site.

## Regra de preço

Preço da pizza = **sabor mais caro** (nunca a soma) **+ borda**.
Ex.: ½ Calabresa (52,90) + ½ Camarão (79,90) com borda de catupiry (9,00) = 88,90.

O servidor recalcula tudo no pedido (`lib/pizza-builder.cjs`): o preço enviado pelo
navegador é ignorado; sabor pausado, fora das categorias de sabores, repetido,
quantidade de sabores não liberada ou borda inexistente é recusado.

## Como funciona por dentro

- Configuração: `settings.pizzaBuilder` (configurações do restaurante, sem mudança de banco).
- API do Gestor: `GET/POST /api/admin/catalog/pizza-builder` (ver: `catalog_view`; salvar: `catalog_edit`).
- Item do pedido: id `pizza|<n>|<id sabor>,<id sabor>|<id borda>`; nome gravado
  ex.: `Pizza 2 sabores (8 pedaços): ½ Calabresa + ½ Camarão · borda de Catupiry`.
- Site: `pizza-builder.js` + `pizza-builder.css` (carregados pelo `cardapio.html`).
  Com a montagem desligada nada muda no cardápio.

## Testes

- `tests/unit/pizza-montada.test.cjs`
- `tests/e2e/pizza-montada.spec.js` (Gestor → site → sacola → pedido)
