# INovas Food - Deploy Checklist

Versao: 1.0.0
Status: Production Ready (Pilot)
Data: 2026-06-28

## Variaveis obrigatorias

- `DATABASE_URL`: banco persistente em producao.
- `ADMIN_SESSION_SECRET`: segredo forte para sessao administrativa.
- `ADMIN_USERS`: preferencial em producao, com login e `passwordHash`.
- `ALLOWED_PUBLIC_ORIGINS`: dominio publico autorizado para checkout.
- `INOVAS_TENANT_MODE`: manter `default_only` ate a janela controlada de piloto.

## Variaveis recomendadas

- `CUSTOMER_SESSION_SECRET`
- `ORDER_RATE_LIMIT_WINDOW_MS`
- `ORDER_RATE_LIMIT_MAX_REQUESTS`
- `ORDER_MAX_BODY_BYTES`
- `CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS`
- `CUSTOMER_AUTH_START_MAX_REQUESTS`
- `CUSTOMER_AUTH_VERIFY_MAX_REQUESTS`

## Variaveis opcionais

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TEMPLATE_NAME`
- `WHATSAPP_VERIFY_TEMPLATE_LANGUAGE`
- `WHATSAPP_GRAPH_API_VERSION`
- `SECURITY_GUARDIAN_CONSOLE_LOGS`

## Backups necessarios

- Backup completo do banco apontado por `DATABASE_URL`.
- Backup/export dos dados operacionais atuais do Tokyo Sushi/default.
- Copia das variaveis de ambiente atuais.
- Registro do commit/tag que sera publicado.

## Validacoes pre-deploy

Executar:

```bash
npm.cmd run validate:v1-final-local
npm.cmd run validate:stage-3-ui
npm.cmd run validate:admin-kanban-volume:local
npm.cmd run validate:master-panel-local
npm.cmd run validate:domains-local
npm.cmd run validate:whatsapp
node -e "for (const f of ['package.json','package-lock.json','site.config.json','vercel.json','site.webmanifest']) JSON.parse(require('node:fs').readFileSync(f,'utf8')); console.log('JSON OK')"
git diff --check
```

Os scripts `validate:stage-1-1`, `validate:stage-2` e `validate:stage-3` sao bloqueados por padrao porque apagam `.data` real. Usar apenas as variantes `:destructive` em ambiente descartavel com backup.

## Ordem do deploy

1. Confirmar backup.
2. Confirmar `INOVAS_TENANT_MODE=default_only`.
3. Confirmar variaveis obrigatorias.
4. Publicar a V1.0.0.
5. Validar homepage, cardapio, checkout, acompanhamento e admin.
6. Validar login MASTER e painel Master.
7. Criar um pedido teste no Tokyo/default.
8. Confirmar logs sem senha, token, cookie ou segredo.

## Modo default_only

Esse e o modo de producao padrao. Todos os hosts continuam resolvendo para Tokyo Sushi/default. Use este modo para deploy inicial, rollback e operacao normal antes do primeiro piloto.

## Quando ativar pilot

Ativar `INOVAS_TENANT_MODE=pilot` somente apos:

- Deploy em `default_only` validado.
- Restaurante piloto cadastrado por MASTER.
- Dominio/subdominio do piloto revisado.
- Admin OWNER criado e testado.
- Plano e assinatura revisados.
- Pedido teste isolado validado.
- Plano de rollback confirmado.

## Validacoes pos-deploy

- Site publico carrega.
- Catalogo carrega.
- Checkout cria pedido no default.
- Acompanhamento de pedido funciona.
- Admin login funciona.
- Pedidos/listagem/dashboard funcionam.
- Financeiro e estoque respeitam permissao/plano.
- `/api/admin/exports` exige permissao e isola tenant.
- Security Guardian nega acesso sem sessao.
- Logs seguem sanitizados.

## Rollback

1. Voltar `INOVAS_TENANT_MODE=default_only`.
2. Se necessario, restaurar variaveis anteriores.
3. Reverter para commit/tag anterior.
4. Restaurar backup do banco se houver corrupcao operacional.
5. Rodar validacoes de Tokyo/default.

## Riscos conhecidos

- `pilot` usa fallback para default em host nao cadastrado; revisar DNS e dominios antes da ativacao.
- `strict` nega host desconhecido, mas deve ficar fora do primeiro piloto.
- Billing real nao existe na V1.
- Exportacao V1 e JSON minimo.
- Perfis nomeados ainda sao permissoes customizadas, nao entidade separada.

## Go/No-Go

Go somente se:

- Todas as validacoes pre-deploy passarem.
- Backup estiver confirmado.
- `default_only` estiver ativo no deploy inicial.
- MASTER conseguir acessar o painel.
- Tokyo Sushi/default permanecer intacto.
