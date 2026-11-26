# INovas Food - Security Review

Data: 2026-06-25

Escopo: revisao estatica de seguranca. Nao houve teste invasivo, deploy, alteracao de configuracao externa, alteracao de secrets ou modificacao de codigo.

## Sumario

A seguranca atual e boa para uma V1 single-restaurant com preview controlado. Existem sessoes assinadas, cookies HttpOnly, middleware protegendo admin, bloqueio de Master por tipo de usuario, permissoes por modulo/acao, bloqueio por plano/recurso e rate limit basico em rotas publicas sensiveis.

O maior risco futuro nao e login admin. E isolamento multi-tenant. Enquanto dados operacionais forem globais, qualquer abertura de multi-restaurante seria risco critico.

## Sessoes

### Admin

Pontos fortes:

- Sessao administrativa assinada por HMAC.
- Cookie admin centralizado em `lib/admin-auth.cjs`.
- Cookie `HttpOnly`.
- `Secure` condicionado ao contexto HTTPS.
- `SameSite=Lax`.
- Middleware protege `/admin`, `/admin/*` e `/api/admin/*`.
- `/admin/master.html` exige usuario `MASTER`.

Riscos:

- Sessao atual ainda carrega escopo default, nao membership multi-tenant.
- Login global simplifica V1, mas em SaaS precisa virar identidade + membership.
- Master depende de userType; no futuro precisa contexto de plataforma separado.

Recomendacoes:

- Manter cookie atual por compatibilidade.
- Adicionar sessao com membership quando o tenant model nascer.
- Registrar eventos de login, logout, acesso negado e tentativa Master.
- Criar expiracao/rotacao mais auditavel em producao.

### Cliente

Pontos fortes:

- Fluxo de WhatsApp com challenge temporario.
- Em producao, codigo provisorio nao deve liberar sessao.
- Cookies e headers foram centralizados via branding/config.

Riscos:

- Storage local e headers ainda usam nomes Tokyo por compatibilidade.
- Sessao do cliente ainda nao e escopada por restaurante.
- Historico futuro deve ser isolado por tenant.

Recomendacoes:

- No futuro, cliente auth precisa incluir restaurante resolvido ou contexto derivado do host.
- Namespacing de storage local deve ser feito com aliases, nao com rename brusco.

## Cookies

Contratos atuais:

- `tokyo_admin_session`
- `tokyo_customer_session`
- `tokyo_customer_login_challenge`

Status:

- Devem permanecer na V1.
- Devem ganhar ponte/alias em eventual white-label.
- Nao devem ser renomeados sem periodo de leitura dupla.

Melhorias futuras:

- Revisar max-age e politica de expiracao por perfil.
- Auditar flags em preview/producao real.
- Adicionar cobertura automatizada para cookies em ambiente HTTPS.

## Headers

Pontos fortes:

- `vercel.json` define headers de seguranca globais: HSTS, `X-Content-Type-Options` e `Referrer-Policy`.
- Admin recebe `Cache-Control: no-store` e `X-Robots-Tag`.
- Hosts `.vercel.app` recebem `X-Robots-Tag: noindex`.

Pontos de atencao:

- Nao ha Content-Security-Policy documentada.
- Nao ha Permissions-Policy documentada.
- Google Maps e scripts externos dificultam CSP, mas nao impedem politica gradual.

Recomendacoes:

- Criar CSP em modo `report-only` primeiro.
- Adicionar `Permissions-Policy` minimo.
- Garantir que admin nunca seja cacheado por CDN/browser.

## APIs

Pontos fortes:

- Admin centralizado em `/api/admin/[...action]`.
- Middleware protege rotas admin.
- Admin API valida sessao, permissao e acesso comercial por modulo.
- Rotas publicas validam metodo.
- Pedido publico exige JSON, tamanho maximo, origem autorizada e rate limit.
- Customer auth possui rate limit por fase.

Riscos:

- Rate limit em memoria e suficiente para V1, mas fraco em serverless distribuido.
- APIs ainda nao recebem tenant context obrigatorio.
- Relatorios e stores admin futuros precisam negar acesso sem escopo.
- Rewrites em `vercel.json` sao parte importante do contrato; validar em preview.

Recomendacoes:

- Criar rate limit externo por IP/tenant/rota antes de escala.
- Criar audit log para tentativas negadas.
- Exigir `TenantContext` em modo tenant.
- Criar testes A/B para cada endpoint admin.

## Inputs e Validacao

Pontos fortes:

- `order-payload.cjs` centraliza normalizacao de pedido.
- `request-guard.cjs` valida JSON, tamanho, origem e rate limit.
- Varios stores normalizam texto, numeros e listas.
- APIs retornam `errorCode`.

Riscos:

- Normalizadores repetidos podem divergir.
- Forms admin geram HTML por template string; precisa garantir `escapeHtml` em todo caminho.
- Reviews publicas usam POST via `/api/reviews` rewrite para `/api/catalog?publicView=reviews`; precisa rate limit dedicado antes de exposicao maior.

Recomendacoes:

- Criar validadores compartilhados por dominio.
- Criar testes para payloads maliciosos em reviews, catalogo, settings e delivery.
- Limitar campos textuais no backend mesmo quando UI limita.

## Uploads

Status atual:

- Auditoria estatica indica uso de leitura de imagem no admin, mas nao ha evidencia de pipeline robusto de upload em storage externo.

Riscos futuros:

- Upload de imagem e vetor comum de abuso: tamanho, tipo, extensao, EXIF, malware e custo.

Recomendacoes:

- Antes de upload real: validar MIME, extensao, tamanho, dimensoes e reprocessar imagem.
- Armazenar em provider controlado, nunca no filesystem serverless.
- Bloquear SVG arbitrario para usuario comum.

## XSS

Pontos fortes:

- Existe uso amplo de `escapeHtml`.
- Muitas renderizacoes escapam nome, descricao, URL e labels.

Riscos:

- `script.js`, `admin/admin.js` e `admin/master.js` usam `innerHTML` e `insertAdjacentHTML` em muitos pontos.
- Quanto maior o arquivo, maior a chance de uma interpolacao sem escape.
- URLs de imagem/link precisam sanitizacao especifica, nao apenas HTML escape.

Recomendacoes:

- Criar helper unico para URL segura.
- Criar teste com payload XSS em catalogo, review, cliente, observacao de pedido e settings.
- No futuro, usar componentes/renderizadores por modulo reduz risco.

## CSRF

Estado atual:

- `SameSite=Lax` ajuda em cookies.
- Rotas publicas verificam origem.
- Admin opera via cookies e APIs POST.

Riscos:

- Nao ha token CSRF dedicado documentado para admin.
- `SameSite=Lax` reduz, mas nao substitui defesa por origem/token em todos os casos.

Recomendacoes:

- Validar Origin/Referer em mutacoes admin.
- Considerar CSRF token para rotas admin mutaveis.
- Manter APIs mutaveis como POST/PUT/PATCH/DELETE, nao GET.

## Rate Limit

Pontos fortes:

- Pedido publico possui rate limit basico por IP.
- Customer auth start/verify possui rate limit.

Limites:

- Rate limit em memoria nao e suficiente para varias instancias/serverless.
- Nao ha rate limit por tenant, usuario, telefone, cliente ou modulo.

Recomendacoes:

- Antes de escala: rate limit persistente ou gateway/WAF.
- Rate limit separado para WhatsApp, reviews, login admin, pedido e checkout.
- Alertas para abuso por telefone/IP.

## Secrets

Pontos fortes:

- Uso de env vars para `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, WhatsApp e outros.
- `.env.example` existe.

Riscos:

- Existe `.env.production.local` na raiz local. Nao foi lido nesta auditoria para evitar exposicao, mas o arquivo deve ser protegido por `.gitignore`.
- `maps-config.js` contem chave Google Maps client-side ou referencia global. Chave client-side pode ser aceitavel, mas precisa restricao externa por referrer/API.
- `.tmp/prod-current.env` aparece staged no status Git, risco critico se contiver valores sensiveis.

Recomendacoes:

- Garantir que `.env*.local`, `.tmp`, `.codex-tools`, caches e outputs nunca entrem no commit.
- Rotacionar qualquer segredo que tenha sido commitado ou exposto em staging.
- Confirmar restricoes da chave Google Maps.
- Criar checklist de secret scanning antes de push.

## Permissoes

Pontos fortes:

- Tipos `MASTER`, `DESENVOLVEDOR`, `OWNER`, `CUSTOM`.
- Permissoes granulares por modulo/acao.
- Usuario bloqueado recebe 403.
- Plano/contrato/recurso tambem bloqueiam modulos.

Riscos:

- `login UNIQUE` global limita SaaS.
- Permissao ainda esta associada a `restaurant_key default`.
- Em multi-restaurante, role precisa pertencer a membership, nao apenas usuario.

Recomendacoes:

- Separar `users` e `restaurant_users`.
- Permissoes futuras por organization/restaurant/membership.
- Testes de usuario A1 tentando acessar B1.

## Master

Pontos fortes:

- HTML Master bloqueado no middleware.
- API Master dentro do grupo admin.
- Usuario nao-MASTER recebe 403.

Riscos:

- Master futuro mistura dados agregados e suporte. Precisa auditoria forte.
- Master deve ter logs de quem acessou/alterou planos, contratos, dominios e flags.

Recomendacoes:

- Separar permissao Master operacional de suporte tecnico.
- Criar trilha de auditoria imutavel para acoes Master.
- Criar MFA/SSO no caminho Enterprise.

## Feature Flags

Pontos fortes:

- Feature flags ja existem.
- Integradas a planos/contratos.

Riscos:

- Flags futuras precisam escopo por organization/restaurant.
- Flag nao deve substituir autorizacao.

Recomendacoes:

- Toda flag comercial deve ter owner, plano, override, auditoria e expiracao opcional.
- Testar flag ligada/desligada por tenant.

## Prioridades de Seguranca

1. Limpar artefatos e envs do indice Git.
2. Confirmar restricoes da chave Google Maps.
3. Validar cookies/headers em preview HTTPS.
4. Adicionar secret scanning pre-commit/pre-push.
5. Criar CSP report-only.
6. Criar testes de XSS para campos textuais.
7. Validar origem/CSRF em mutacoes admin.
8. Planejar rate limit externo.
9. Criar `TenantContext` default-only.
10. Implementar testes anti-vazamento antes de multi-restaurante real.

Nota de seguranca: 79/100.
