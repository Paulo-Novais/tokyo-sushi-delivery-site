# INovas Food - UX Review

Data: 2026-06-25

Escopo: revisao de experiencia com base em estrutura HTML, scripts, documentacao de validacoes e auditoria estatica. Nao houve alteracao visual, deploy ou criacao de telas.

## Sumario

A UX da INovas Food esta bem encaminhada para V1: site publico tem paginas essenciais, gestor tem operacao rica e painel Master comunica a visao SaaS. O risco principal e complexidade operacional: muitas areas, muitos estados e muitos modulos podem confundir usuarios se a hierarquia de tarefas nao ficar clara.

## Site Publico

Paginas analisadas:

- `index.html`
- `cardapio.html`
- `entrega.html`
- `acompanhar.html`
- `historico.html`
- `avaliar.html`
- `trabalhe-conosco.html`
- `404.html`

Pontos fortes:

- Navegacao principal consistente.
- Carrinho e login presentes nas paginas publicas.
- SEO e metas documentados.
- Estados vazios existem em acompanhamento, historico e entrega.
- WhatsApp visivel como canal de apoio.
- Uso de `aria-label`, `aria-live`, `role` e `alt` em muitos pontos.
- Fallback de entrega quando Google Maps falha.

Riscos UX:

- "Modo provisorio" pode soar tecnico para cliente final.
- Fluxo de login por codigo pode precisar de mensagens mais humanas em falha de WhatsApp.
- Cardapio com muitas categorias e imagens pesadas pode cansar mobile.
- Se Maps falhar, cliente precisa entender claramente se pedido pode seguir ou depende de confirmacao.
- Historico/acompanhamento sem sessao precisam guiar proximo passo sem friccao.

Sugestoes:

- Trocar linguagem operacional por linguagem de cliente, sem mudar regra.
- Exemplo: "Vamos confirmar seu endereco manualmente" em vez de "modo provisorio".
- Reforcar feedback de sucesso no checkout.
- Garantir que erro de CEP/Maps tenha CTA claro.
- Manter cart e checkout o mais curto possivel.

## Gestor

Arquivos principais:

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`

Pontos fortes:

- Gestor prioriza pedidos.
- Kanban e detalhe lateral sao adequados para operacao de restaurante.
- Estados vazios/loading existem.
- Acoes principais de pedido estao mapeadas.
- Modulos administrativos cobrem pedidos, agendados, cardapio, promocoes, delivery, clientes, relatorios, estoque, financeiro, avaliacoes, configuracoes e usuarios.
- Permissoes e plano afetam menu/modulos.

Riscos UX:

- Excesso de modulos pode dispersar operador.
- Gestor pode estar denso para mobile.
- Busca global e atalhos precisam ser realmente previsiveis.
- Erros de salvamento aparecem como mensagens gerais; algumas acoes podem precisar recuperacao contextual.
- Modulos como financeiro, estoque e settings podem exigir onboarding interno.

Sugestoes:

- Criar modo "Operacao do turno" focado em pedidos, agendados, delivery e cozinha.
- Separar mentalmente "operar agora" de "configurar negocio".
- Para modulos densos, usar progressao: resumo, lista, detalhe.
- Padronizar mensagens de erro por acao: o que aconteceu, se salvou algo, o que fazer agora.
- Melhorar confirmacoes em acoes destrutivas como deletar promocao/review.

## Painel Master

Arquivos principais:

- `admin/master.html`
- `admin/master.js`
- `lib/master-platform-store.cjs`

Pontos fortes:

- Master deixa clara a separacao entre plataforma e restaurante.
- Mostra planos, recursos, contratos, dominios, logs, auditoria e desenvolvedor.
- Acesso exclusivo `MASTER`.
- Bom como instrumento de estrategia e suporte.

Riscos UX:

- Como ainda e default-only, pode parecer mais maduro do que realmente e.
- Termos tecnicos como resolver, default, tenant e flags precisam ser claros para uso comercial.
- Se o Master virar painel comercial real, precisara trilha de auditoria visivel.

Sugestoes:

- Deixar sempre explicito o que e "ativo hoje" vs "preparado".
- Criar badges: Real, Simulado, Futuro, Bloqueado.
- Separar abas de negocio, suporte e tecnico.
- Em dominios/contratos, mostrar status operacional e proximo passo.

## Fluxos Confusos

Possiveis pontos:

- Cliente: entrega com Maps indisponivel.
- Cliente: login WhatsApp em ambiente local/provisorio.
- Gestor: diferenca entre relatorios, metricas e dashboard.
- Gestor: diferenca entre financeiro operacional e futuro caixa/PDV.
- Master: dominios simulados vs dominio real.
- Master: planos/contratos simulados vs billing real.

## Excesso de Cliques

Riscos:

- Configuracoes do restaurante parecem amplas e podem exigir muitos campos.
- Estoque/financeiro podem precisar varios cliques para uso recorrente.
- Promocoes/cardapio podem exigir repeticao manual.

Sugestoes:

- Priorizar atalhos por modulo.
- Oferecer acoes rapidas na lista.
- Manter pedido e cliente com contato direto visivel.
- Para settings, agrupar por objetivo: Marca, Atendimento, Entrega, SEO, Horarios.

## Mensagens

Pontos bons:

- Muitas mensagens de erro ja sao especificas.
- `errorCode` ajuda suporte.
- Estados vazios explicam o que deve acontecer.

Melhorias:

- Reduzir termos tecnicos para cliente final.
- Diferenciar erro recuperavel, erro temporario e bloqueio por permissao/plano.
- Para plano bloqueado, mostrar "recurso nao incluso" em vez de parecer erro tecnico.

## Loading

Pontos bons:

- Existem estados "Carregando", "Conectando" e skeleton/empty states.

Riscos:

- Carregamento inicial do admin pode crescer com o bundle.
- Modulos pesados podem bloquear percepcao de resposta.

Sugestoes:

- Lazy load de modulos admin no futuro.
- Loading local por painel, nao tela inteira.
- Feedback otimista apenas onde houver rollback claro.

## Telas Vazias

Pontos bons:

- Existem empty states no admin e paginas publicas.

Melhorias:

- Empty state deve sempre responder: o que e esta tela, por que esta vazia, qual proxima acao.
- Para restaurante novo futuro, empty states devem virar onboarding.

## Feedback Visual

Pontos fortes:

- Botao disabled em acoes ocupadas.
- Badges e chips de status.
- Estados de pedidos por coluna.

Riscos:

- Muitas cores/status podem competir.
- Feedback de salvamento em modulos administrativos precisa ser consistente.

Sugestoes:

- Padronizar feedback: sucesso, erro, atencao, info.
- Mensagem sempre proxima do local da acao.
- Evitar que toast/global esconda erro de formulario.

## Acessibilidade

Pontos fortes:

- Muitos `aria-label`.
- Modal de pedidos tem `role=dialog` e `aria-modal`.
- Alguns elementos usam `aria-live`.
- Imagens tem `alt`.

Riscos:

- Renderizacao via `innerHTML` pode recriar foco.
- Modal precisa foco inicial, trap e retorno ao botao anterior.
- Atalhos como Ctrl+K precisam nao atrapalhar usuario de leitor de tela.
- Estados de erro em formularios devem estar ligados aos campos.

Sugestoes:

- Criar checklist A11y por fluxo critico.
- Testar teclado puro: cardapio, carrinho, checkout, login, admin login, kanban, modal.
- Garantir foco apos renderizacao de estados.

## Cliente Ideal da UX Atual

A UX atual atende melhor:

- Restaurante independente com delivery proprio.
- Operador que precisa acompanhar pedidos em tempo real.
- Dono/gerente que quer visualizar modulos e controle.
- Cliente final que compra pelo celular e usa WhatsApp.

Ainda atende menos:

- Rede multi-unidade.
- Restaurante com operacao presencial complexa.
- PDV/caixa de alto fluxo.
- Equipe com baixa familiaridade digital, se nao houver onboarding.

## Prioridades UX

1. Validar V1 em preview com usuarios reais/simulados.
2. Reduzir linguagem tecnica no site publico.
3. Melhorar feedback de falha Maps/CEP/WhatsApp.
4. Revisar fluxo mobile do cardapio com imagens otimizadas.
5. Criar hierarquia de operacao vs configuracao no gestor.
6. Padronizar mensagens de erro/sucesso.
7. Melhorar foco/acessibilidade em modais.
8. Sinalizar no Master o que e real, simulado e futuro.

Nota de UX: 81/100.
