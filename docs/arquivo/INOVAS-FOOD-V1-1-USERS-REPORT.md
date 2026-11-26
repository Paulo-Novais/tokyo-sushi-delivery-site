# INovas Food V1.1.0 - Gestao de Usuarios

Versao: 1.1.0

Status: apta nos testes locais. Deploy controlado pendente de execucao/confirmacao em producao.

## Funcionalidades implementadas

- Tela `Usuarios` do Gestor com tabela responsiva na ordem obrigatoria: ID, Nome, Restaurante, Plano, Status e Acoes.
- Busca por ID, nome, restaurante, e-mail, telefone e CNPJ/MEI.
- Filtros por perfil e status.
- Ordenacao por colunas e paginacao com tamanho configuravel.
- Cadastro/edicao com Nome, E-mail, Telefone, Restaurante, Perfil e Senha inicial.
- Validacao frontend para campos vazios, e-mail, telefone, senha minima e duplicidade de e-mail.
- Validacao backend para e-mail, telefone, senha minima, duplicidade e escopo de restaurante.
- Perfis visiveis na V1.1: MASTER, OWNER, GERENTE, CAIXA, COZINHA, ESTOQUE e ENTREGADOR.
- OWNER limitado a usuarios do proprio restaurante.
- Perfis diferentes de MASTER/OWNER bloqueados para escrita via API.
- Exclusao de usuario com confirmacao, loading e mensagem de sucesso/erro.
- Permissoes avancadas permanecem ocultas.
- Painel Master ajustado para os perfis V1.1 e edicao com telefone.

## Seguranca

- APIs de usuarios continuam protegidas por sessao, TenantContext, plano e permissoes existentes.
- `/api/admin/users/delete` exige `users_delete`.
- Escrita por GERENTE/CAIXA/COZINHA/ESTOQUE/ENTREGADOR e demais perfis nao administradores retorna 403.
- OWNER nao cria MASTER/OWNER nem usuarios de outro restaurante.
- Usuario logado nao pode bloquear ou excluir o proprio acesso.
- Ao menos um MASTER ativo permanece obrigatorio.

## Testes executados

- `npm.cmd run validate:v1-1-users-local` - OK.
- `npm.cmd run validate:permissions-local` - OK.
- `npm.cmd run validate:platform-integration-local` - OK.
- `npm.cmd run validate:v1-final-local` - OK.

Cobertura V1.1 validada:

- criacao, edicao, exclusao e bloqueio/desbloqueio;
- busca, filtros, ordenacao e paginacao;
- OWNER isolado por restaurante;
- MASTER funcionando;
- validacoes frontend/backend;
- permissao avancada oculta;
- browser desktop/mobile da tela Usuarios;
- preservacao do restaurante Tokyo/default em `default_only`;
- garantia de que os testes nao alteram `.data` real.

## Regressao V1.0

- Validacao final V1 local passou completa.
- Menus, planos, contratos, tenant context, isolamento, persistencia, Security Guardian, permissoes, admin local, layouts publicos, mobile publico e horarios passaram.
- Nao houve alteracao de layout nos modulos Gestor, Cardapio, Pedidos, Clientes, Financeiro ou Estoque fora do modulo Usuarios.

## Pendencias

- Executar commit e tag `v1.1.0`.
- Realizar deploy controlado.
- Executar smoke tests em producao, incluindo Tokyo Sushi no ambiente padrao.

## Conclusao

A V1.1.0 de Gestao de Usuarios esta apta para deploy controlado com base nos testes locais.
