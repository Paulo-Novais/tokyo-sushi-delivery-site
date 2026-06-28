# INovas Food - Scalability Audit

Data da auditoria: 2026-06-25

Objetivo: avaliar a capacidade de crescimento de 1 restaurante para 10, 100 e 1000 restaurantes sem reescrita do sistema.

## Estado Atual de Escala

| Escala | Prontidao atual | Risco principal |
| --- | --- | --- |
| 1 restaurante | Alta | Operacao atual esta bem coberta por APIs, stores e validacoes |
| 10 restaurantes | Media | Falta isolamento real por restaurante nas tabelas centrais |
| 100 restaurantes | Media-baixa | Bundles monoliticos, relatorios on demand e dados globais viram gargalos |
| 1000 restaurantes | Baixa | Exige tenant context obrigatorio, normalizacao de dados, observabilidade e jobs |

## Performance e Peso

### Alto Impacto

| Item | Evidencia | Risco |
| --- | --- | --- |
| Imagens muito pesadas | `site-images/teppan-camarao.png` ~19,34 MB, `temaki-hot.png` ~12,27 MB | LCP ruim, consumo de banda, custo CDN e baixa conversao mobile |
| `admin/admin.js` monolitico | ~510 KB, 12.572 linhas | Carregamento e manutencao degradam conforme novos modulos entram |
| `script.js` monolitico | ~429 KB, 11.762 linhas | Cliente publico carrega logica de muitos dominios juntos |
| `admin/admin.css` grande | ~344 KB, 10.489 linhas | CSS cresce com risco de regressao visual e cascata dificil |
| Pedidos sem tenant scope | `orders`, `customers`, `order_items`, `order_status_events` globais | Impede multi-restaurante seguro sem migracao profunda |
| Agregacoes administrativas on demand | dashboard/master fazem varias consultas/listas | Pode ficar caro em 100/1000 restaurantes |
| Catalogo base dentro de `script.js` | `catalog-store` executa/extrai dados do JS publico | Acopla dado operacional a bundle de UI |

### Medio Impacto

| Item | Evidencia | Risco |
| --- | --- | --- |
| `styles.css` grande | ~151 KB | Afeta publico, mas menor que JS/admin |
| Stores repetem persistencia | varios `getStorageMode`, `readFileStore`, `writeFileStore`, `ensure*Schema` | Aumenta custo de manutencao e chance de comportamento divergente |
| Validacoes e normalizadores repetidos | `normalizeText`, `cloneJson` em muitos stores | Inconsistencia silenciosa ao evoluir contratos |
| Estado master em JSON unico | `master_platform_state.state_json` | Bom para MVP, fraco para consultas e concorrencia em escala |
| `finance_closings.period_key` global | sem escopo por restaurante/caixa | Colisao natural em multi-restaurante |
| `admin_users.login UNIQUE` global | tabela de usuarios atual | Limita SaaS com mesmo login em mais de uma organizacao |
| Config gerada em mais de um lugar | `site.config.json`, `site-config.js`, `app-branding`, script Python | Risco de drift entre fonte e runtime |

### Baixo Impacto

| Item | Evidencia | Risco |
| --- | --- | --- |
| Nome interno `tokyo-site` | `package.json` | Baixo impacto tecnico imediato |
| Referencias Tokyo em fixtures | scripts/testes | Intencional para proteger dominio atual |
| HTML estatico com marca atual | paginas publicas/admin | Deve permanecer ate haver projeto real de white-label |

## Banco e Persistencia

O padrao atual e coerente para uma aplicacao serverless:

- Neon quando `DATABASE_URL` existe.
- Arquivo local `.data` em desenvolvimento.
- Modo `disabled` em producao sem banco, evitando falsa persistencia.

Ponto forte:

- Esse padrao evita perder dados reais em producao por gravacao local.

Ponto fraco:

- Cada store implementa o mesmo padrao de forma propria.
- Nao ha camada formal de migracoes/versionamento de schema.
- Tabelas centrais ainda sao globais.

## Escala de Dados

### 10 Restaurantes

Antes de 10 restaurantes reais, o sistema precisa:

- Definir modelo de tenant sem ainda alterar APIs publicas.
- Planejar migracao de PKs unicas globais para PKs compostas ou chaves internas.
- Ter `request context` interno resolvendo dominio/restaurante.
- Manter aliases de cookies/headers legados para compatibilidade.
- Criar estrategia de migracao de dados do restaurante default.

### 100 Restaurantes

Antes de 100 restaurantes, o sistema precisa:

- Tornar `tenant_id`/`restaurant_id` obrigatorio em toda query interna.
- Separar agregacoes operacionais de consultas transacionais.
- Criar indices compostos por escopo e data.
- Reduzir bundles do admin por modulo.
- Otimizar assets e usar formatos modernos.
- Introduzir logs estruturados e metricas por restaurante.

### 1000 Restaurantes

Antes de 1000 restaurantes, o sistema precisa:

- Normalizar master data: restaurantes, dominios, planos, contratos, assinaturas, recursos.
- Criar isolamento forte por tenant, possivelmente com RLS ou camada de autorizacao central.
- Ter filas/jobs para WhatsApp, marketing, relatorios, integracoes e reconciliacao financeira.
- Ter observabilidade por tenant, modulo e endpoint.
- Ter limites/rate limits por restaurante, cliente e integracao.
- Ter rotina de backup, restore e exportacao por tenant.
- Ter estrategia de particionamento/arquivamento para pedidos e eventos antigos.

## API e Runtime

Pontos fortes:

- Rotas serverless simples.
- Handlers publicos separados de admin.
- `middleware.js` protege admin e painel master.
- `lib/admin-api.cjs` centraliza controle de permissao/plano.

Riscos:

- `lib/admin-api.cjs` e um roteador central grande; novas acoes podem aumentar acoplamento.
- Endpoints nao recebem escopo de tenant hoje, entao a futura migracao precisa ser interna e retrocompativel.
- Master metrics busca listas/dados de varios stores sem escopo real; em escala deve consultar tabelas agregadas.

## Frontend

Pontos fortes:

- Frontend publico funciona como site estatico com APIs pontuais.
- Gestor tem uma experiencia rica e operacionalmente completa.
- `site-config.js` permite runtime config sem rebuild profundo.

Riscos:

- Publico e admin carregam bundles grandes.
- Catalogo, carrinho, auth, entrega, mapas, historico e reviews estao concentrados em `script.js`.
- O admin concentra muitos modulos em `admin/admin.js`.

Direcao futura:

- Separar por dominios: cart, catalog, delivery, customer auth, orders, reviews.
- Separar admin por modulos: orders, catalog, finance, inventory, users, settings.
- Preservar layout atual durante refatoracoes.

## Seguranca e Isolamento

Pontos fortes:

- Admin protegido por cookie HttpOnly.
- Master HTML bloqueado por `middleware.js`.
- Permissoes por modulo/acao.
- Protecao comercial por plano/contrato/recurso.
- Criacao de pedido usa guarda publica, validacao de payload e regra de horario.

Riscos:

- Futuro multi-tenant precisa garantir que nenhum endpoint admin consiga ler dados de outro restaurante.
- Headers/cookies legados precisam de compatibilidade controlada.
- Credenciais externas por restaurante precisam ser criptografadas/isoladas.
- Google Maps client-side deve ter restricao por referrer e governanca de chave.

## Duplicacao

Duplicacoes relevantes:

- Persistencia file/Neon/disabled repetida em stores.
- `normalizeText` e `cloneJson` repetidos.
- Padrao de schema bootstrap repetido.
- Tratamento de erro API repetido.
- Validacoes de payload distribuidas por store/API.
- Estados de loading/saving repetidos no admin.

Classificacao:

- Baixo impacto: duplicacao de helpers pequenos.
- Medio impacto: duplicacao de persistencia e schemas.
- Alto impacto: duplicacao de logica de dominio entre frontend, store e API quando afetar pedidos/catalogo/delivery.

## Recomendacoes de Escala Sem Implementar Agora

1. Criar ADRs antes de qualquer multi-restaurante real.
2. Definir `TenantContext` interno, mas nao habilitar em producao ate migracao estar pronta.
3. Introduzir migracoes versionadas antes de alterar tabelas centrais.
4. Reduzir bundles por modulo em etapas sem mudar layout.
5. Otimizar imagens grandes antes de campanhas/aumento de trafego.
6. Separar catalogo de `script.js` em fonte propria quando for seguro.
7. Criar camada compartilhada de persistencia para novos stores.
8. Criar observabilidade basica por rota, modulo, storage mode e tempo de resposta.

## Pontuacao da Auditoria

| Area | Nota | Leitura |
| --- | ---: | --- |
| Arquitetura | 82 | Boa separacao de camadas, com gargalos claros em bundles e dados globais |
| Escalabilidade | 72 | Forte para V2 single-restaurant; limitada para multi-restaurante sem migracao |
| Organizacao | 76 | Dominios bem nomeados, mas arquivos centrais cresceram demais |
| Seguranca | 80 | Admin, master, permissoes e plano estao bem protegidos; falta isolamento tenant |
| Modularizacao | 68 | Stores por dominio ajudam, mas frontend/admin/API ainda concentram muita coisa |
| Testabilidade | 88 | Validacoes locais cobrem regras criticas e protegem contratos atuais |
| Preparacao SaaS | 70 | Master e feature flags apontam o caminho; dados operacionais ainda globais |
| Preparacao Enterprise | 58 | Falta organizacao multi-unidade, auditoria avancada, SSO, BI e isolamento forte |
| Potencial de crescimento | 86 | Produto tem base solida se o roadmap for seguido antes de novos modulos pesados |

## Prioridades Executivas

Pode esperar:

- Renomear arquivos/pacote com Tokyo.
- Limpar fixtures e textos de teste.
- Trocar marca/dominio.
- Criar modulos futuros como QR Mesa, PDV, IA e marketplaces.

Antes da V2:

- Otimizar imagens grandes.
- Criar migracoes versionadas.
- Reduzir crescimento dos bundles.
- Documentar contratos internos e ADR de tenant futuro.
- Consolidar configuracao para reduzir drift.

Antes do multi-restaurante:

- Definir tenant/organizacao/restaurante.
- Migrar tabelas centrais com escopo.
- Criar resolver dominio -> contexto.
- Garantir autorizacao por escopo em todos os stores.
- Normalizar master data.
- Criar testes de isolamento entre restaurantes.

## Conclusao

A escalabilidade atual e boa para consolidar a V2 de um restaurante e preparar uma expansao controlada. O salto para 100 ou 1000 restaurantes depende menos de novas funcionalidades e mais de fundamentos: isolamento de tenant, indices compostos, migracoes, normalizacao do master data, bundles menores, assets otimizados e relatorios assinc/aggregados.
