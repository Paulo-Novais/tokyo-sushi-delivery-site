# INOVAS FOOD - Revisao de Performance V2.0

Status: preparacao documental.
Escopo: revisao estatica, sem alterar codigo, banco, deploy, commit ou tag.

## 1. Situacao Atual

A aplicacao funciona com validadores locais e deploy Vercel, mas tem pontos que devem ser preparados antes de escala multi-restaurante.

Arquivos grandes:

- `admin/admin.js`: 13541 linhas.
- `script.js`: 11781 linhas.
- `admin/admin.css`: 11232 linhas.
- `styles.css`: 6961 linhas.
- `lib/order-store.cjs`: 3178 linhas.
- `lib/catalog-store.cjs`: 2144 linhas.
- `lib/admin-api.cjs`: 2110 linhas.

Impacto: carregamento inicial maior, mais parse de JS/CSS, maior risco de invalidar cache com qualquer ajuste pequeno.

## 2. Frontend Admin

Riscos observados:

- `admin/admin.js` carrega todos os modulos juntos.
- Renderizacao por `innerHTML` reconstrui grandes blocos.
- Navegacao, estado, filtros, tabelas, modais e chamadas API estao no mesmo arquivo.
- Tabelas e listas podem crescer sem virtualizacao.
- Modulos menos usados como financeiro, metricas, estoque e configuracoes entram no mesmo bundle.

Recomendacoes:

- Dividir por modulos carregados sob demanda.
- Criar camada de componentes comuns para tabela, filtro, modal, drawer, toast e paginacao.
- Cachear dados por secao com invalidacao controlada.
- Evitar re-render total de secao em pequenas mudancas.
- Preparar virtualizacao para tabelas grandes.

## 3. Frontend Publico

Riscos observados:

- `script.js` concentra catalogo, carrinho, login, historico, avaliacao, entrega, SEO e checkout.
- Configuracao publica e estado local usam muitos fallbacks globais.
- Catalogo e imagens podem ficar pesados quando houver muitos restaurantes/cardapios.

Recomendacoes:

- Separar carrinho, catalogo, cliente e checkout.
- Carregar avaliacoes, historico e entrega sob demanda.
- Cachear catalogo por `tenantId/restaurantId` com ETag ou versao.
- Lazy load de imagens e secoes fora da primeira dobra.

## 4. Backend e Stores

Riscos observados:

- `buildMasterMetricsSnapshot` consulta pedidos, clientes, reviews e financeiro para compor metricas.
- Stores misturam local file e Neon, com normalizacao extensa em memoria.
- Listas administrativas usam limites genericos, alguns ate 500.
- Em modo local, leitura/escrita JSON pode se tornar gargalo com muitos registros.
- Em Neon, consultas precisam de indices compostos por tenant/restaurante.

Recomendacoes:

- Criar endpoints agregados por modulo com SQL otimizado.
- Evitar carregar lista completa para calcular contadores.
- Usar indices `(tenant_id, restaurant_id, status, created_at)`.
- Criar paginacao cursor-based para pedidos, clientes, reviews e auditoria.
- Separar snapshots master de leituras operacionais.
- Cache curto para dashboard e metricas globais.

## 5. CSS

Riscos observados:

- `admin/admin.css` e `admin/design-system.css` convivem.
- Seletores legados `legacy-dark-disabled` permanecem.
- `styles.css` publico e extenso.
- CSS especifico por tela dificulta tree-shaking em site estatico.

Recomendacoes:

- Mover tokens para arquivo unico.
- Separar CSS por superficie: `admin-core`, `admin-modules`, `public-core`, `public-checkout`.
- Remover CSS legado em fase propria com screenshot diff.
- Criar lint visual para cores fora da paleta INOVAS.

## 6. Escala por Numero de Restaurantes

100 restaurantes:

- Estrutura atual suporta se os dados continuarem pequenos.
- Principal risco: configuracao por dominio e cache publico.

500 restaurantes:

- Listagens master ficam mais lentas sem paginacao real.
- Onboarding e busca por restaurante exigem indices.
- Arquivos globais de configuracao deixam de ser suficientes.

2000 restaurantes:

- Dashboard master nao pode calcular metricas consultando todos os modulos em tempo real.
- Auditoria e pedidos exigem particionamento logico por tenant.
- Necessario cache, agregados e jobs.

10000 restaurantes:

- Arquitetura precisa de dados fisicamente indexados e event-driven.
- Busca global deve usar indice/search dedicado.
- Relatorios e metricas devem ser precomputados.
- Logs/auditoria precisam retencao e arquivamento.

## 7. Lazy Loading Candidatos

Admin:

- Usuarios
- Financeiro
- Metricas
- Relatorios
- Estoque
- Configuracoes
- Painel master
- Exportacoes

Publico:

- Historico de pedidos
- Avaliacoes
- Entrega/mapa
- Trabalhe conosco
- Login do cliente
- Complementos pesados do catalogo

## 8. Problemas, Prioridade e Risco

| Problema | Prioridade | Impacto | Risco |
| --- | --- | --- | --- |
| Bundles JS grandes | Alta | Parse/carregamento lento | Alto em mobile |
| Consultas agregadas sem camada dedicada | Alta | Dashboard master lento | Alto em escala |
| CSS grande e legado | Media | Render inicial e manutencao | Medio |
| Local JSON como fallback operacional | Media | Gargalo local/teste | Baixo em prod, medio em testes |
| Tabelas sem virtualizacao | Media | UI lenta com muitos dados | Medio |

## 9. Recomendacao Final

Antes de adicionar modulos grandes de V2.0, a plataforma deve criar divisao de bundles, paginacao real e agregados por tenant. O ganho maior nao vira de micro-otimizacao, mas de impedir que dashboard e paineis globais leiam dados operacionais completos em tempo real.
