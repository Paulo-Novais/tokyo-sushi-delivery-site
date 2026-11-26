# INovas Food - Security Guardian Report

Data: 2026-06-28

## Objetivo

Implementar uma camada Defense in Depth para rotas sensiveis, sem alterar UI, sem ativar multi-restaurante real e preservando `INOVAS_TENANT_MODE=default_only`.

## Implementacao

- Criado `lib/security-guardian.cjs`.
- Criado `validate:security-guardian-local`.
- Integrado ao backend em:
  - `lib/admin-api.cjs`
  - `lib/customer-api.cjs`
  - `api/orders/create.js`
  - `api/catalog.js`
  - `api/auth/send-whatsapp-code.js`

## Protecoes

- TenantContext obrigatorio nas rotas sensiveis.
- Sessao administrativa obrigatoria para admin fora de auth.
- Compatibilidade sessao/tenant validada.
- RBAC validado antes do handler especifico.
- Plano/feature flag validado para modulos admin.
- Rate limit para login, auth de cliente, escritas publicas e APIs admin.
- Protecao contra brute force por falhas recentes e bloqueio temporario.
- Score de risco por request.
- Logs e auditoria em memoria com sanitizacao de senha, token, cookie, segredo e authorization.
- Erros de seguranca retornam mensagem generica; detalhes ficam nos eventos internos.

## Rotas Sensiveis Cobertas

- Login/admin auth.
- Admin dashboard, pedidos, financeiro, estoque, usuarios, permissoes/configuracoes, relatorios/auditoria, master.
- Criacao de pedido publico.
- Criacao de review publico.
- Auth de cliente start/verify.
- Envio de codigo WhatsApp.

## Classificacao de Risco

- Baixo: permite.
- Medio: permite e registra evento.
- Alto: nega.
- Critico: nega e pode bloquear temporariamente quando a causa e brute force, rate limit ou tenant invalido.

Permissao negada e plano bloqueado continuam como 403, sem virar bloqueio temporario automatico para preservar ergonomia operacional e compatibilidade dos testes existentes.

## Testes Criados

`validate:security-guardian-local` cobre:

- tentativa sem tenant valido;
- tentativa admin sem sessao;
- tentativa sem permissao;
- tentativa de brute force/rate limit;
- tentativa de acessar tenant diferente;
- tentativa de acessar financeiro sem permissao;
- tentativa de acessar admin com tenant incompativel;
- logs sem senha, token, cookie ou segredo;
- auditoria de acao sensivel permitida;
- Tokyo Sushi/default funcionando.

## Evidencias

Comandos executados durante a etapa:

- `npm.cmd run validate:security-guardian-local`
- `npm.cmd run validate:tenant-context-local`
- `npm.cmd run validate:tenant-isolation-local`
- `npm.cmd run validate:tenant-persistence-local`
- `npm.cmd run validate:permissions-local`
- `npm.cmd run validate:plans-contracts-local`
- `npm.cmd run validate:admin-local`
- `npm.cmd run validate:platform-integration-local`

Resultado: todos passaram apos calibracao de risco e preservacao dos contratos de permissao/plano.

## Status

Security Guardian concluido em nivel local/codigo, com defesa em profundidade nas rotas sensiveis e sem mudanca visual.
