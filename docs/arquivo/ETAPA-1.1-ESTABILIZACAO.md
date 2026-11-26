# ETAPA 1.1 - Estabilizacao tecnica da base

## O que foi estabilizado

- Middleware do admin com allowlist explicita para a tela de login e seus assets publicos.
- Cookie administrativo com `Secure` apenas em contexto HTTPS real, preservando `HttpOnly` e `SameSite=Lax`.
- Endpoint publico `POST /api/orders/create` com validacao mais rigida, checagem de origem e rate limit basico por IP.
- Script local de validacao do fluxo minimo: `npm run validate:stage-1-1`.

## Estrategia correta de publicacao

- Esta arquitetura nao deve continuar no hosting estatico atual da Netlify.
- O projeto agora depende de:
  - `POST /api/*`
  - middleware ativo em `/admin/*` e `/api/admin/*`
  - persistencia de pedidos com `DATABASE_URL`
- A publicacao correta para esta base e Vercel, que ja esta vinculada neste repositorio pelo arquivo `.vercel/project.json`.

## Rotas minimas que precisam funcionar publicadas

- `GET /admin/login.html`
  - deve abrir deslogado
  - deve carregar `/admin/admin.css`
  - deve carregar `/admin/admin.js`
- `GET /admin/`
  - deve redirecionar para `/admin/login.html` quando nao houver sessao
  - deve abrir somente com cookie administrativo valido
- `POST /api/orders/create`
  - deve aceitar apenas `application/json`
  - deve validar origem publica autorizada
  - deve salvar pedido com status inicial `Novo`

## Variaveis de ambiente de producao

### Obrigatorias

- `DATABASE_URL`
  - conexao persistente do Neon Postgres
- `ADMIN_LOGIN`
  - login do gestor
- `ADMIN_PASSWORD_HASH`
  - hash da senha do gestor
- `ADMIN_SESSION_SECRET`
  - segredo da assinatura do cookie admin
- `ALLOWED_PUBLIC_ORIGINS`
  - origem publica autorizada para o checkout
  - valor minimo recomendado: `https://tokyosushidelivery.com.br`

### Recomendadas

- `ADMIN_DISPLAY_NAME`
  - nome exibido no painel admin
- `ORDER_RATE_LIMIT_WINDOW_MS`
  - janela do rate limit do endpoint publico
- `ORDER_RATE_LIMIT_MAX_REQUESTS`
  - maximo de tentativas por IP dentro da janela
- `ORDER_MAX_BODY_BYTES`
  - tamanho maximo aceito para o JSON do pedido

### Opcionais da autenticacao atual do cliente

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TEMPLATE_NAME`
- `WHATSAPP_VERIFY_TEMPLATE_LANGUAGE`
- `WHATSAPP_GRAPH_API_VERSION`

## Checklist de publicacao

1. Migrar o dominio principal para o projeto da Vercel vinculado neste repositorio.
2. Configurar todas as variaveis obrigatorias em Production.
3. Configurar `ALLOWED_PUBLIC_ORIGINS` com o dominio final publico.
4. Confirmar que o banco Neon esta acessivel pela `DATABASE_URL`.
5. Publicar e validar:
   - `GET /admin/login.html`
   - `GET /admin/`
   - `POST /api/orders/create`
6. Remover a dependencia operacional da Netlify para o dominio principal.

## Validacao local desta etapa

- Executar `npm run validate:stage-1-1`.
- O script confirma:
  - login page publica
  - assets publicos do login
  - bloqueio do `/admin/` sem sessao
  - cookie local sem `Secure`
  - cookie HTTPS com `Secure`
  - criacao de pedido valida
  - pedido visivel no painel admin
  - bloqueio por origem invalida
  - bloqueio por rate limit
