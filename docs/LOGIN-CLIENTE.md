# Login do cliente: Google ou e-mail e senha

Atualizado em 19/11/2026. Branch: `claude/login-cliente`.

Vale só para o **cliente que faz pedido** nos sites dos restaurantes (Tokyo,
Kasulo e os próximos). O login da equipe ("Acesso à plataforma" do Gestor e do
Sistema) **não mudou**.

## O que mudou

- **Saiu:** o código de verificação pelo WhatsApp. O código ficou desativado, não apagado.
- **Entrou:** "Entrar com Google", "Entrar com e-mail e senha", "Criar conta" e "Esqueci minha senha".
- O **pedido só sai com o cliente logado** naquele restaurante. Nome, telefone e
  e-mail do pedido vêm da conta, não do que o navegador manda.
- O cliente **continua conectado até clicar em Sair** (180 dias, renovados com o uso).

## Como funciona

1. O cliente toca em "Entrar" no site do restaurante. Vai para o login central
   `https://login.inovasfood.com.br/conta/entrar`, levando o restaurante e o
   endereço de volta.
2. Ele entra com Google ou com e-mail e senha.
   - Pelo Google, no primeiro acesso, o telefone é pedido **uma vez** e fica salvo.
   - O endereço é pedido no primeiro pedido, como já era.
3. O login central confere o endereço de volta. Ele precisa ser do próprio
   restaurante: domínio próprio cadastrado e ativo, ou
   `inovasfood.com.br/<slug>` do restaurante. Se não bater, é recusado (sem
   open redirect e sem cair no Tokyo como padrão).
4. O cliente volta ao site com um **código de uso único** (vale 60 segundos,
   só para aquele restaurante e aquele endereço).
5. O site troca o código pela **sessão daquele restaurante**: cookie httpOnly,
   Secure e SameSite=Lax. A sessão fica guardada no servidor, então "Sair"
   derruba de verdade.

**Mesma pessoa em vários restaurantes:**
- A conta de login é única na plataforma: o mesmo e-mail é a mesma conta.
- Cada restaurante tem a própria sessão e os próprios dados (pedidos,
  endereços, histórico). A sessão do restaurante A não vale no B.

**Google e senha com o mesmo e-mail viram a mesma conta.** O vínculo é
automático só quando o Google diz que o e-mail é verificado. Se a senha tinha
sido criada sem confirmar o e-mail, ela é desativada nesse momento: protege
contra quem cadastra o e-mail de outra pessoa. Depois disso, a pessoa pode
criar uma senha nova em "Esqueci minha senha".

## Biblioteca: Better Auth 1.7.18

Escolhida no lugar do Auth.js porque já traz pronto o que foi pedido:
- e-mail e senha;
- "esqueci minha senha" com link de validade curta e uso único;
- vínculo de contas só com e-mail verificado;
- limite de tentativas;
- Google agora e Facebook depois, só com configuração.

Ela roda em Node puro com Neon (Postgres), sem serviço pago.

O Auth.js é feito para Next.js e desencoraja login por senha. Não tem "esqueci
minha senha" nem vínculo de contas prontos.

- **Senha:** hash **argon2id** (`@node-rs/argon2`). Nunca é guardada nem escrita em log em texto.
- **Limites:**
  - por IP: 5 logins por minuto e 3 pedidos de nova senha a cada 5 minutos;
  - por e-mail: 10 logins em 15 minutos e 3 pedidos de nova senha por hora.
- **Mensagens:**
  - senha errada e e-mail inexistente recebem a mesma mensagem;
  - "esqueci minha senha" responde igual para qualquer e-mail;
  - criar conta com e-mail já usado responde igual a uma conta nova.
- **Facebook depois:** acrescentar em `lib/customer-identity.cjs` →
  `addSocialProviders()` (`FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`) e o
  botão em `conta/entrar.html`. Vínculo, sessão e volta ao restaurante já funcionam igual.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `lib/customer-identity.cjs` | Better Auth, vínculo de contas, código de uso único, endereço de volta |
| `lib/customer-session-store.cjs` | Sessão do cliente por restaurante (Neon com RLS, ou arquivo nos testes) |
| `lib/customer-order-session.cjs` | Pedido e pagamento online exigem cliente logado; dados vêm da sessão |
| `lib/customer-mailer.cjs` | E-mail de "esqueci minha senha" (Resend) |
| `lib/customer-auth-host.cjs` | Endereço central só serve o login do cliente |
| `lib/customer-api.cjs` | Rotas `/api/customer/identity/*`, `account/*`, `auth/exchange`, `me`, `logout` |
| `conta/entrar.html`, `conta/conta.js`, `conta/conta.css` | Tela do login central |
| `script.js` | Site do restaurante: botão Entrar, volta com o código, Sair |
| `api/orders/create.js`, `lib/payments-api.cjs` | **Pedidos (fluxo congelado, GO do Paulo em 19/11):** exigem login |
| `migrations/036_customer_login.sql` (+ `.rollback.sql`) | Tabelas novas; não altera tabelas existentes |
| `scripts/configure-customer-auth-database-role.mjs` | Dá senha ao usuário de banco novo |
| `.github/workflows/aplicar-migracao-036.yml` | Aplica a 036 em produção (só à mão, com confirmação) |

## Banco: migration 036

**Ordem:** depois da 035. Não altera nenhuma tabela existente.

- **Identidade:** `customer_auth_users`, `customer_auth_sessions`,
  `customer_auth_accounts`, `customer_auth_verifications` e
  `customer_auth_rate_limits`.
  - Só o usuário de banco novo `inovas_customer_auth` acessa (RLS + permissões;
    sem superusuário e sem BYPASSRLS).
  - O usuário de runtime dos restaurantes **não** lê essas tabelas.
- **Sessões por restaurante:** `customer_sessions`.
  - RLS pelo restaurante (`app.tenant_id` / `app.restaurant_id`); sem contexto, não vê nada.
  - O servidor (escopo system) só pode marcar a saída de todas as sessões de
    uma pessoa (troca de senha); ninguém apaga.
- **Volta:** `036_customer_login.rollback.sql`. Apaga as contas de login dos
  clientes; pedidos e clientes não são tocados. Precisa de backup e GO.

**Testado em Postgres real em memória (PGlite)**, sem tocar na Neon. Comando: `npm run validate:customer-login-migration`.
- aplica duas vezes;
- isolamento A/B;
- sem contexto, nada;
- runtime não lê as contas;
- o SQL de produção da loja de sessões;
- a Better Auth gravando e lendo;
- rollback e reaplicação.

## O que o Paulo precisa fazer (cada passo com GO)

### 1. Google Cloud Console

1. https://console.cloud.google.com → crie (ou escolha) o projeto "INOVAS Food".
2. **APIs e serviços → Tela de consentimento OAuth**:
   - tipo **Externo**;
   - nome **INOVAS Food**;
   - e-mail de suporte;
   - logotipo (opcional);
   - domínio autorizado `inovasfood.com.br`;
   - links de política de privacidade e termos (páginas do site);
   - escopos: só `openid`, `email` e `profile`.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**:
   - **Origens JavaScript autorizadas:** `https://login.inovasfood.com.br`
   - **URIs de redirecionamento autorizados:**
     `https://login.inovasfood.com.br/api/customer/identity/callback/google`
   - Para o Preview, crie **outro** cliente com o endereço do Preview, ex.:
     `https://<preview>.vercel.app/api/customer/identity/callback/google`.
4. Copie o **ID do cliente** e a **Chave secreta** direto para a Vercel (passo 4).
   Não mande por mensagem.
5. Tela de consentimento → **Publicar app**. Em "Teste", só os e-mails da lista entram.

### 2. E-mail de "esqueci minha senha": Resend (gratuito)

- Plano grátis: 3.000 e-mails por mês e 100 por dia. É suficiente para recuperação de senha.
- Alternativa: Brevo (300 por dia grátis).
1. Crie a conta em https://resend.com.
2. **Domains → Add domain** `inovasfood.com.br` e cadastre no DNS os registros
   que ele mostrar (SPF/DKIM). **Mexe em DNS: GO.**
3. **API Keys → Create** (permissão só de envio) e cole direto na Vercel.

### 3. Endereço do login central

- Na Vercel: projeto → **Domains → Add** `login.inovasfood.com.br`.
- No DNS: o **CNAME** que a Vercel indicar.
- **Mexe em domínio e DNS: GO.**

### 4. Variáveis de ambiente na Vercel (o Paulo cadastra)

| Nome | Production | Preview | Observação |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | sim | sim (cliente de teste) | do passo 1 |
| `GOOGLE_CLIENT_SECRET` | sim | sim (cliente de teste) | segredo |
| `CUSTOMER_AUTH_SECRET` | sim | sim, **valor diferente** | texto aleatório com 32+ caracteres (gerador de senha) |
| `CUSTOMER_AUTH_URL` | `https://login.inovasfood.com.br` | endereço do Preview | sem barra no final |
| `CUSTOMER_AUTH_DATABASE_URL` | sim | sim (branch de teste) | conexão com o usuário `inovas_customer_auth` |
| `RESEND_API_KEY` | sim | sim | segredo |
| `CUSTOMER_AUTH_EMAIL_FROM` | `INOVAS Food <nao-responda@inovasfood.com.br>` | igual | precisa ser do domínio verificado no Resend |

Depois: conferir que `ALLOWED_PUBLIC_ORIGINS` (se existir) continua com os
domínios dos restaurantes.

### 5. Banco (com backup e GO)

1. Neon → **Branches → Create branch** (backup antes da 036).
2. Teste primeiro num branch de teste: SQL Editor do branch → cole
   `migrations/036_customer_login.sql` → Run.
3. Produção: GitHub → Actions → **Aplicar atualização 036** → digite `APLICAR-036`.
4. Dar senha ao usuário novo. Pode ser pelo GitHub Actions ou na máquina do
   Paulo, nunca escrevendo a senha em arquivo:
   `scripts/configure-customer-auth-database-role.mjs`. Variáveis: ver o topo do script.
5. Montar `CUSTOMER_AUTH_DATABASE_URL` com esse usuário e cadastrar na Vercel.

## Checklist de deploy (antes do GO de Production)

- [ ] Backup do Neon criado.
- [ ] 036 aplicada no branch de teste e conferida.
- [ ] Variáveis do Preview cadastradas; Preview com banco **separado** de Production.
- [ ] No Preview:
  - [ ] criar conta;
  - [ ] entrar com senha;
  - [ ] entrar com Google;
  - [ ] esqueci a senha (e-mail chega);
  - [ ] pedido logado;
  - [ ] Sair.
- [ ] 036 aplicada em Production; usuário `inovas_customer_auth` com senha; variáveis de Production cadastradas.
- [ ] `login.inovasfood.com.br` respondendo, com certificado.
- [ ] Deploy de Production (GO).
- [ ] Conferir por HTTP, sem login:
  - [ ] `/conta/entrar` abre;
  - [ ] `/lib/customer-identity.cjs`, `/migrations/036_customer_login.sql` e `/docs/LOGIN-CLIENTE.md` dão 404;
  - [ ] `login.inovasfood.com.br/admin/` dá 404.
- [ ] Pedido real de teste no Tokyo com login, e cancelar no Gestor.

**Volta rápida (rollback):**
- Promover o deploy anterior na Vercel. O site volta ao login antigo.
- As tabelas novas podem ficar: não atrapalham.
- Só rodar o rollback da 036 se for desistir do login novo.

## Tela de login

- Segue o modelo "Tokyo Sushi · Nova tela de login" enviado pelo Paulo:
  - no computador: cartão de duas colunas;
  - no celular: tela cheia com "Voltar".
- Fonte: Plus Jakarta Sans (licença livre OFL, servida pelo próprio site em `assets/fonts/`) e Poppins.
- **Pendente:** as páginas de **Termos de uso** e **Política de privacidade**.
  - Hoje a frase aparece sem link.
  - O Google exige o link da política na tela de consentimento.
  - Precisam de texto aprovado pelo Paulo (ou pelo contador/advogado).

## Testes e validações

| O que | Resultado |
|---|---|
| `tests/e2e/login-cliente.spec.js` (8 testes, navegador + API) | passou |
| `tests/unit/customer-login.test.cjs` (7 testes) + unitários do projeto (151) | passou |
| `npm run validate:customer-login-migration` (Postgres em memória) | passou |
| Suíte de navegador inteira (140) | 138 passaram na rodada completa; as 2 que falharam (Cardápio do Gestor e Painel do Sistema) passaram sozinhas. Instabilidade de carga, telas não alteradas |
| `scripts/validate-stage-3.mjs` (antigo, apaga `.data`) | Adaptado ao login novo. As partes do cliente passam. Ele para depois, no login da **equipe** (401 ao mudar status). O script é anterior ao modelo atual de sessão da equipe, e o login da equipe ficou fora desta tarefa. |

## Atenção na virada

- Quem estava logado pelo WhatsApp vai precisar **entrar de novo uma vez**.
- O pedido passa a exigir login também no servidor: um app ou site antigo em
  cache que mande pedido sem login vai receber "Entre na sua conta".
