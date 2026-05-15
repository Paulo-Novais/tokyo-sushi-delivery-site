# ETAPA 1 - Arquitetura base do sistema de pedidos

## Separacao das areas

### 1. Site publico do cliente

- Continua nas paginas publicas ja existentes (`index.html`, `cardapio.html`, `entrega.html`, `historico.html`).
- Responsavel apenas por vitrine, carrinho, checkout e autenticacao do cliente no aparelho.
- O checkout envia o pedido para a API publica `POST /api/orders/create`.

### 2. Acompanhamento do cliente

- Nao foi implementado nesta etapa.
- A separacao ja fica reservada para a proxima fase, sem compartilhar interface nem logica do admin.

### 3. Gestor web administrativo privado

- Fica isolado em `/admin`.
- Login em `/admin/login.html`.
- Painel em `/admin/index.html`.
- APIs privadas em `/api/admin/*`.
- Protecao no servidor por `middleware.js`, sem expor o painel ao cliente autenticado comum.

## Persistencia dos pedidos

### Producao

- Banco relacional via `DATABASE_URL` com Neon Postgres.
- Tabelas:
  - `customers`
  - `orders`
  - `order_items`

### Desenvolvimento local

- Fallback em arquivo local `.data/orders.json`.
- Esse fallback nao e usado em producao para evitar perda de pedidos.

## Fluxo da ETAPA 1

1. Cliente monta o carrinho no site.
2. Cliente finaliza o checkout no site.
3. O front envia o payload estruturado para `POST /api/orders/create`.
4. O backend normaliza, valida e salva o pedido.
5. O pedido entra com status inicial `Novo`.
6. O painel privado em `/admin` mostra os pedidos recebidos e os contadores basicos.

## Autenticacao admin

- Credenciais controladas por ambiente.
- Sessao administrativa em cookie `HttpOnly`, `Secure` e `SameSite=Lax`.
- Rotas protegidas:
  - `/admin`
  - `/admin/*`
  - `/api/admin/*`

## Variaveis importantes

- `DATABASE_URL`
- `ADMIN_LOGIN`
- `ADMIN_PASSWORD_HASH` ou `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

## Observacoes desta etapa

- O WhatsApp deixa de ser o fluxo principal do pedido.
- O cliente ainda nao acompanha pedido por pagina dedicada nesta fase.
- Alteracao de status, detalhes completos e operacao do gestor ficam para a ETAPA 2.
