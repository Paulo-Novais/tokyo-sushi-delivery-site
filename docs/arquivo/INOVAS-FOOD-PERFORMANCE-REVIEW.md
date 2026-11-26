# INovas Food - Performance Review

Data: 2026-06-25

Escopo: revisao estatica de performance em JS, CSS, HTML, imagens, APIs, JSON, stores e banco. Nao houve deploy, Lighthouse em producao ou alteracao de assets.

## Sumario

O principal gargalo de performance da INovas Food hoje esta no peso e na concentracao de frontend/assets. O backend esta aceitavel para V1, mas deve evoluir antes de 100+ restaurantes por causa de agregacoes on demand e dados sem escopo.

Prioridade imediata: imagens grandes e bundles monoliticos.

## JS

Arquivos principais:

| Arquivo | Tamanho | Linhas | Avaliacao |
| --- | ---: | ---: | --- |
| `admin/admin.js` | 509,6 KB | 12.572 | Muito grande para manutencao e carregamento do gestor. |
| `script.js` | 429,2 KB | 11.762 | Muito grande para site publico/mobile. |
| `admin/master.js` | 26,5 KB | 777 | Aceitavel. |

Riscos:

- Site publico carrega muitos dominios juntos.
- Admin cresce com cada modulo novo.
- Event delegation global em arquivos longos aumenta complexidade.
- Catalogo base acoplado ao `script.js`.

Recomendacoes:

- Separar `script.js` por dominios: catalogo, carrinho, entrega, auth, reviews, historico.
- Separar admin por modulos: pedidos, cardapio, promocoes, delivery, settings, usuarios, financeiro, estoque, reviews, CRM, metricas.
- Usar carregamento sob demanda para areas admin que nao sao pedidos.
- Separar catalogo base da UI antes de 10 restaurantes.

## CSS

Arquivos principais:

| Arquivo | Tamanho | Linhas | Avaliacao |
| --- | ---: | ---: | --- |
| `admin/admin.css` | 344 KB | 10.489 | Alto risco de cascata e regressao. |
| `styles.css` | 151,4 KB | 6.407 | Grande, mas aceitavel para V1 se cacheado. |
| `admin/orders-production-restore.css` | 103,9 KB | 2.356 | Arquivo de restauracao/historico; precisa decisao futura. |

Riscos:

- CSS admin concentra muitos modulos.
- Seletores especificos e longos dificultam manutencao.
- Mudancas pequenas podem afetar modulos distantes.

Recomendacoes:

- Criar CSS por modulo admin gradualmente.
- Manter tokens/variaveis compartilhados.
- Evitar remover restore CSS ate haver decisao documentada.

## HTML

Pontos bons:

- Paginas publicas estaticas simples.
- SEO/OpenGraph/Twitter card documentados como presentes.
- Admin e Master possuem estrutura clara.

Riscos:

- Header/nav/footer repetidos em varias paginas.
- HTML estatico ainda possui marca Tokyo, por contrato atual.
- Mudancas futuras de marca/dominio dependem de gerador e revisao de diff.

Recomendacoes:

- Nao converter tudo agora.
- Quando houver white-label real, usar geracao por config com testes visuais.

## Imagens

Maiores imagens encontradas:

| Arquivo | Tamanho |
| --- | ---: |
| `site-images/teppan-camarao.png` | 19,34 MB |
| `menu_pdf_images/catalog/teppan-camarao.png` | 19,34 MB |
| `site-images/temaki-hot.png` | 12,27 MB |
| `menu_pdf_images/catalog/temaki-hot.png` | 12,27 MB |
| `assets/login-cover.png` | 3,17 MB |
| `assets/tokyo-poster-reference.png` | 3,17 MB |
| `site-images/login-cover-floating.png` | 2,57 MB |

Impacto:

- LCP ruim em mobile.
- Maior consumo de banda.
- Pior SEO.
- Maior custo CDN.
- Pior conversao em cardapio.

Prioridade:

1. Converter imagens grandes para WebP/AVIF quando suportado.
2. Criar dimensoes responsivas.
3. Remover duplicacao de imagem entre `site-images` e `menu_pdf_images` somente com cuidado.
4. Adicionar politica de tamanho maximo por imagem.
5. Validar visual depois de compressao.

## APIs

Pontos fortes:

- APIs serverless simples.
- Admin e customer usam catch-all.
- Pedido possui retry para falhas Neon retryable.
- Rewrites em `vercel.json` preservam rotas antigas.

Riscos:

- `lib/admin-api.cjs` centraliza muitos grupos.
- Relatorios e dashboards agregam on demand.
- Falta observabilidade por endpoint.
- Rate limit em memoria nao escala.

Recomendacoes:

- Instrumentar tempo de resposta por rota.
- Medir p95 de `/api/orders/create`, `/api/admin/dashboard`, `/api/admin/orders/list`, `/api/catalog`.
- Separar relatorios pesados de operacao transacional.
- Adicionar cache control especifico para APIs publicas quando seguro.

## JSON e Payloads

Pontos fortes:

- Payloads sao normalizados.
- `errorCode` ajuda UI e suporte.
- JSON grande em Master permite evolucao rapida.

Riscos:

- Master state em JSON unico nao escala para consulta/auditoria.
- Catalog runtime state em JSON pode crescer.
- Estoque runtime em JSON fica pesado se historico crescer.

Recomendacoes:

- Normalizar Master antes de SaaS real.
- Limitar historicos em JSON runtime.
- Criar agregacoes/materializacoes para relatorios.

## Stores

Pontos fortes:

- Stores por dominio.
- Modo Neon/file/disabled protege producao sem banco.
- Separacao de catalogo, pedidos, delivery, settings, financeiro, estoque, reviews, CRM, usuarios e master.

Riscos:

- Persistencia repetida.
- Bootstrap de schema por store.
- Dados sem `restaurant_id` real.
- Falta camada comum de migrations.

Recomendacoes:

- Criar migracoes versionadas.
- Criar helper comum de storage para proximos stores.
- Evitar novos stores globais.
- Exigir contexto interno quando modo tenant existir.

## Banco

Estado atual:

- Neon via `DATABASE_URL`.
- Arquivo local em desenvolvimento.
- Disabled em producao sem banco.

Pontos fortes:

- Evita falsa persistencia em producao.
- Pedidos tem indices por status/data, cliente/data, assinatura, eventos.
- Pedido tem idempotencia por `customer_key` + `request_signature`.

Riscos:

- Tabelas operacionais sem escopo de restaurante.
- Relatorios on demand.
- Financeiro por `period_key` global.
- Login global.
- Master JSON unico.

Recomendacoes:

- Criar indices compostos por `restaurant_id`, status e data no futuro.
- Denormalizar `restaurant_id` em itens/eventos quando houver escopo.
- Separar relatorios transacionais de analiticos.
- Criar arquivamento de pedidos antigos antes de 1000 restaurantes.

## Escala de Performance

| Escala | Gargalo provavel |
| --- | --- |
| 10 restaurantes | Isolamento de dados e catalogo acoplado a UI. |
| 100 restaurantes | Relatorios on demand, admin monolitico, imagens e falta de indices por escopo. |
| 1000 restaurantes | Jobs, filas, observabilidade, rate limits, agregacoes e particionamento. |
| 5000 restaurantes | Operacao de suporte, billing, logs e relatorios pesados. |
| 10.000 restaurantes | Data warehouse, particionamento/arquivamento, possivel sharding/regioes. |

## Prioridades de Performance

### Criticas

1. Otimizar imagens grandes.
2. Limpar artefatos temporarios do indice.
3. Validar preview com rede real.
4. Medir Web Vitals.

### Altas

5. Separar catalogo de `script.js`.
6. Dividir admin por modulos.
7. Criar observabilidade por rota.
8. Normalizar Master data antes de SaaS.

### Medias

9. Reduzir CSS admin por modulo.
10. Criar cache publico controlado.
11. Materializar relatorios de alto custo.
12. Criar politica de tamanho maximo para assets.

Nota de performance: 74/100.
