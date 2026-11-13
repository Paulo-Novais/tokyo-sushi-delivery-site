# INOVAS PDV (app desktop)

App da operação do restaurante: **Pedidos, Caixa, Comandas e Cardápio**.
O login é **o mesmo do Gestor**: mesmo e-mail e senha, mesmo usuário, mesmo papel.
Painel, relatórios, financeiro e configurações continuam no Gestor (site).

> Versão 0.1.0. Corresponde à **fase 4** do esboço (`ESBOCO-APP-PDV.md`), feita **sem nenhuma mudança no site**.
> As fases 1, 2, 3 e 5 (servidor) continuam pendentes e precisam de GO do Paulo. Veja "O que ainda depende do site".

## Como funciona

| Parte | O que faz |
|---|---|
| Login (tela do app) | Chama `POST /api/admin/login`, a mesma rota da tela de login do Gestor. Funciona para qualquer usuário de restaurante já cadastrado. Usuário da equipe INOVAS (System) é recusado. Usuário com mais de um restaurante escolhe o restaurante. |
| Pedidos | Abre a tela real do Gestor (`/admin/?section=orders`) dentro do app, com o menu lateral do Gestor escondido. |
| Caixa | Abre as telas reais do Caixa: Salão, Abertura e Fechamento (`/admin/caixa/*`). Sangria e suprimento ficam no Salão, como hoje. |
| Comandas | Abre o Salão do Caixa (mesas e comandas). F1 nova comanda, F2 enviar à cozinha, F4 conferir conta. |
| Cardápio | Tela nova e enxuta: busca, filtro (Todos / No site / Pausados) e **Pausar / Reativar**. Envia só `{ itemId, availabilityState }` para `POST /api/admin/catalog/update`. |
| Sair | Encerra a sessão no servidor (`/api/admin/logout`), apaga o cookie e o login guardado. |

Nenhuma rota nova foi criada no servidor. Quem decide o que cada usuário pode fazer continua sendo o servidor.

### O que o app mostra para cada papel (permissões de hoje)

| Papel | Pedidos | Caixa | Comandas | Cardápio |
|---|---|---|---|---|
| Caixa | sim | sim | sim | aparece, mas **sem poder pausar** (o servidor responde 403) |
| Garçom | sim | não | sim | aparece, sem acesso |
| Cozinha | sim | não | não | só consulta |
| Gerente / Dono | sim | sim | sim | pausa e reativa |

### "Fica conectado até alguém clicar em Sair"

O servidor encerra a sessão em 12 h e o site não foi mudado. Até a fase 3 (token de dispositivo), o app faz assim:

1. o cookie da sessão fica salvo no app e continua valendo depois de fechar o app ou reiniciar o PC;
2. com **"Manter conectado neste computador"** marcado, o login é guardado **criptografado pelo Windows** (DPAPI, ligado ao usuário do Windows). Duas horas antes de a sessão vencer, o app entra de novo sozinho, sem interromper o caixa;
3. se a senha mudar ou o usuário for bloqueado no Gestor, a renovação falha e o app volta para a tela de login;
4. **Sair** apaga tudo do computador.

Quando a fase 3 existir, o item 2 é trocado pelo token de dispositivo e o app deixa de guardar a senha (`src/main/credentials.js`).

## O que ainda depende do site (precisa de GO)

1. **Fase 1, permissões:** hoje CAIXA, GARÇOM e COZINHA ainda têm `tenant.dashboard.view` (e CAIXA tem `tenant.financial.view`) no servidor. O app não mostra essas telas, mas **a API continua respondendo** a quem chamar direto. Isso só se resolve no servidor.
2. **Cardápio para o Caixa:** a permissão `tenant.catalog.pause` não existe ainda. Até lá, só quem tem `tenant.catalog.edit` (dono, gerente) consegue pausar pelo app.
3. **Fase 2, Caixa sem vendas:** o Salão ainda mostra "Recebido no turno" e o Fechamento mostra Esperado e Diferença para quem opera. Falta a decisão do Paulo.
4. **Fase 3, sessão de dispositivo**, e a lista "Aparelhos conectados" no Gestor.
5. **Fase 5:** bloquear o login web para papéis operacionais.

## Rodar no computador de desenvolvimento

```bash
npm ci
npm start
```

Por padrão o app usa `https://inovasfood.com.br`. Para Preview ou servidor local, troque em **Servidor → Alterar** na tela de login, ou rode com `INOVAS_PDV_SERVER=<url>`. Só `https://` é aceito (e `http://127.0.0.1` / `localhost` para teste).

Atalhos: F5 recarrega a tela; Ctrl + / Ctrl − / Ctrl 0 ajustam o zoom das telas do Gestor (útil em monitor pequeno).

## Instalar no computador do restaurante

1. Baixe `INOVAS-PDV-Setup-<versão>.exe`.
2. Dê dois cliques. Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações** e depois em **Executar assim mesmo** (o instalador ainda não é assinado).
3. Pronto: o app instala sozinho, cria o atalho **INOVAS PDV** na Área de Trabalho e no Menu Iniciar e já abre na tela de login.

Não precisa de senha de administrador: instala só para o usuário do Windows que rodou o instalador.
Para remover: Configurações do Windows → Aplicativos → INOVAS PDV → Desinstalar.

## Gerar o instalador

```bash
npm ci
npm run dist:win
```

Sai `dist/INOVAS-PDV-Setup-<versão>.exe`. Funciona no Windows e também no Linux com Wine de 32 bits
(`dpkg --add-architecture i386 && apt-get install wine wine32:i386`).
No GitHub, a ação **Instalador Windows** (`.github/workflows/build-windows.yml`) faz o mesmo sob demanda.
`npm run dist:win:zip` gera a versão portátil (.zip), sem instalador.

## Testes

```bash
npm test             # unitários (regras, cookies, API, cofre do login)
E2E_ADMIN_LOGIN=... E2E_ADMIN_PASSWORD=... xvfb-run -a npm run test:e2e   # ponta a ponta, abre o app de verdade
```

O teste de ponta a ponta usa **só** o servidor local de validação do site, com restaurantes descartáveis. O seed recusa qualquer endereço que não seja local.

```bash
# no repositório do site, em outro terminal:
E2E_ADMIN_LOGIN=master.e2e@local.test E2E_ADMIN_PASSWORD='<senha local qualquer>' node scripts/local-validation-server.cjs
```

## Segurança

- Janelas com `contextIsolation`, `sandbox` e sem Node na página. A tela do Gestor não recebe nenhuma função do app.
- A tela do Gestor só navega para Pedidos e Caixa no mesmo servidor. Login vira renovação de sessão. Qualquer outra seção (painel, financeiro, usuários...) faz o app voltar para Pedidos. **Isto é só interface: o bloqueio de verdade é no servidor (fase 1).**
- Links externos: só WhatsApp e Google Maps abrem no navegador padrão. Janelas novas são bloqueadas.
- Imagens do cardápio passam por um protocolo interno que aceita só caminhos de imagem do cardápio.
- Proteções do executável: sem `ELECTRON_RUN_AS_NODE`, sem `NODE_OPTIONS`, sem `--inspect`, cookies criptografados no disco.

## Estrutura

```
src/main/        processo principal: janela, sessão, login guardado, API
src/preload/     pontes seguras (app e tela do Gestor)
src/renderer/    interface do app: login, topo, menu, Cardápio
src/shared/      regras de módulos e permissões (testadas)
test/unit/       testes unitários (node:test)
test/e2e/        ponta a ponta com Electron + servidor local do site
build/           ícone do instalador
```
