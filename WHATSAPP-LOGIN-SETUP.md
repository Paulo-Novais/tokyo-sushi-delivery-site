# Login Por WhatsApp

O site agora inicia o login publico do cliente pela rota `POST /api/customer/auth/start` e conclui a verificacao pela rota `POST /api/customer/auth/verify`.

Internamente, o envio do codigo continua usando a mesma integracao com o WhatsApp Cloud API.

## Vercel

Cadastre estas variaveis de ambiente no projeto:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TEMPLATE_NAME`
- `WHATSAPP_VERIFY_TEMPLATE_LANGUAGE`
  - opcional
  - padrao: `pt_BR`
- `WHATSAPP_GRAPH_API_VERSION`
  - opcional
  - padrao: `v23.0`

## Template no WhatsApp Cloud API

Use um template aprovado no Meta WhatsApp Business com um parametro no corpo:

`Seu codigo Tokyo Sushi Delivery e {{1}}. Digite no site para concluir o login.`

O backend envia o codigo no parametro `{{1}}`.

## Comportamento atual

- Se a API do WhatsApp estiver configurada no Vercel, o cliente recebe o codigo no proprio WhatsApp.
- Em desenvolvimento local, se a API ainda nao estiver configurada ou falhar, o modal mostra um codigo provisorio apenas no aparelho atual para nao travar a validacao.
- Em producao, o backend nao expoe esse codigo provisorio: a sessao publica do cliente so e liberada depois da validacao real do telefone.
