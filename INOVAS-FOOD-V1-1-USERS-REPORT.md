# INovas Food V1.1 Users Report

Versao: 1.1.0

Status: Production Ready (controlled deploy pending).

## Escopo entregue

- Painel Master ganhou a tela principal `Usuarios` com busca por ID, nome, restaurante, e-mail, telefone e CNPJ/MEI.
- A tabela do Painel Master segue a ordem: ID / Nome / Restaurante / Plano / Status / Acoes.
- O MASTER pode visualizar, editar, bloquear/desbloquear usuarios e iniciar o cadastro de restaurante/OWNER.
- Cadastro de restaurante agora exige CNPJ/MEI, proprietario, nome fantasia, cidade, CEP, numero, e-mail, telefone, plano e data de adesao.
- OWNER segue limitado ao proprio restaurante e pode criar somente usuarios internos.
- Perfis internos adicionados: Gerente, Subgerente, Caixa, Cozinha, Bar, Estoque, Financeiro, Entregador, Atendente e Personalizado.
- Permissoes avancadas no painel operacional ficam recolhidas atras de `Personalizar permissoes`.

## Backend e seguranca

- `ADMIN_USERS` continua suportado para MASTER de plataforma.
- MASTER nao depende de restaurante especifico quando configurado com `platformScope`.
- OWNER nao pode criar MASTER, OWNER ou usuario para outro restaurante.
- Usuarios internos recebem permissoes padrao por perfil.
- Perfil Personalizado preserva permissoes individuais.
- APIs de usuarios continuam passando por TenantContext, sessao, plano/assinatura e permissao.
- Senhas iniciais sao enviadas somente para API e persistidas pelo mecanismo de hash existente.

## Compatibilidade

- Nenhum comportamento visual publico foi alterado.
- Tokyo Sushi/default continua preservado em `INOVAS_TENANT_MODE=default_only`.
- V1.0 nao foi redeployada nem republicada nesta etapa.

## Validacao local

- Criado `npm run validate:v1-1-users-local`.
- O validador cobre:
  - MASTER de plataforma autenticando sem restaurante proprio;
  - falha segura quando cadastro V1.1 esta incompleto;
  - cadastro completo de restaurante e OWNER;
  - diretorio Master com ID, plano, restaurante e CNPJ/MEI;
  - login OWNER por tenant;
  - criacao de usuario interno pelo OWNER;
  - negativa para OWNER criar MASTER;
  - negativa para OWNER criar usuario em outro restaurante;
  - bloqueio/desbloqueio de usuario interno;
  - preservacao de Tokyo/default em `default_only`;
  - garantia de que `.data` real nao e alterada pelo teste.

## Arquivos principais

- `admin/master.js`
- `admin/admin.js`
- `admin/admin.css`
- `lib/admin-api.cjs`
- `lib/master-platform-store.cjs`
- `lib/user-permissions.cjs`
- `scripts/validate-v1-1-users-local.mjs`
- `scripts/v1-validation-suite.mjs`
- `scripts/validate-v1-release-local.mjs`
- `package.json`
