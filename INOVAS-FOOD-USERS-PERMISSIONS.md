# Usuarios e Permissoes - Preparacao INovas Food

## Escopo atual

- O sistema continua monorestaurante.
- Nao existe `restaurant_id`.
- A associacao preparada usa `restaurantKey` com valor fixo `default`.
- O login administrativo legado continua valido e e convertido automaticamente para `MASTER`.

## Estrutura de usuario

Cada usuario administrativo possui:

- `name` / `nome`
- `login`
- `email`
- `passwordHash` interno
- `status`
- `userType` / `tipo_usuario`
- `createdAt` / `data_criacao`
- `lastAccessAt` / `ultimo_acesso`
- `restaurantKey: "default"`

## Tipos

- `MASTER`: acesso total, incluindo permissao de logs/suporte/diagnostico.
- `DESENVOLVEDOR`: acesso total ao restaurante e permissoes tecnicas de logs/suporte/diagnostico.
- `OWNER`: acesso total ao restaurante.
- `CUSTOM`: permissoes individuais por modulo e acao.

## Permissoes

Os modulos usam chaves granulares no formato:

`<modulo>_<acao>`

Exemplos:

- `orders_view`
- `orders_create`
- `orders_edit`
- `orders_delete`
- `financial_view`
- `financial_edit`
- `settings_view`
- `settings_edit`
- `users_view`
- `users_edit`

Modulos preparados:

- Dashboard
- Pedidos
- Clientes
- Cardapio
- Promocoes
- Avaliacoes
- Relatorios
- Estoque
- Financeiro
- Configuracoes
- Usuarios
- Entrega
- Horarios
- Datas especiais

## Preparacao futura user -> restaurant

A store e a API ja retornam `restaurantKey: "default"` em usuarios e payloads administrativos.
Quando a plataforma evoluir para multi-restaurante, o ponto de expansao previsto e trocar o valor fixo por associacoes por restaurante, sem introduzir `restaurant_id` nesta etapa.
