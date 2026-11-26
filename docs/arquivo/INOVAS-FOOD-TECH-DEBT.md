# INovas Food - Technical Debt Audit

Data da auditoria: 2026-06-25

Este documento lista dividas tecnicas encontradas durante a auditoria. Nada foi alterado funcionalmente.

## Divida de Alto Impacto

| Divida | Evidencia | Risco | Quando resolver |
| --- | --- | --- | --- |
| Dados centrais sem escopo de restaurante | `orders`, `customers`, catalogo, delivery, financeiro, estoque e reviews globais | Bloqueia multi-restaurante real | Antes do multi-restaurante |
| Bundles monoliticos | `admin/admin.js` ~510 KB, `script.js` ~429 KB | Crescimento de modulos degrada performance/manutencao | Antes ou durante V2 |
| CSS admin monolitico | `admin/admin.css` ~344 KB | Risco de regressao visual e cascata dificil | V2/V2.5 |
| Imagens muito pesadas | `teppan-camarao.png` ~19,34 MB, `temaki-hot.png` ~12,27 MB | Impacta mobile, SEO e conversao | Antes de trafego maior |
| Catalogo acoplado a `script.js` | `catalog-store` extrai dados do JS publico | Dado operacional depende de bundle de UI | Antes de 10 restaurantes |
| Falta de migracoes formais | schemas criados por `ensure*Schema` em cada store | Dificulta evolucao segura de banco | Antes de alterar schemas centrais |
| Master state em JSON unico | `master_platform_state.state_json` | Fraco para consulta, concorrencia e auditoria em escala | Antes de SaaS |
| Credenciais/config Maps client-side | `maps-config.js` e global `TOKYO_GOOGLE_MAPS_API_KEY` | Exposicao/custo se referrer nao estiver restrito | Antes de escala publica |

## Divida de Medio Impacto

| Divida | Evidencia | Risco | Quando resolver |
| --- | --- | --- | --- |
| Persistencia repetida nos stores | varios `getStorageMode`, `readFileStore`, `writeFileStore` | Divergencia e custo de manutencao | V2 |
| Normalizadores repetidos | `normalizeText`, `cloneJson` em varios arquivos | Regras inconsistentes | V2 |
| `admin-api.cjs` central grande | roteia muitos modulos | Aumento de acoplamento e conflitos | V2.5 |
| `admin_users.login UNIQUE` global | schema atual | Limita SaaS com mesmo login em orgs diferentes | Antes do multi-restaurante |
| `finance_closings.period_key` global | schema atual | Colisao por restaurante/caixa | Antes de Caixa/PDV |
| Relatorios on demand | master/admin agregam listas e queries | Custo crescente por volume | Antes de 100 restaurantes |
| Config em multiplas fontes | JSON, JS gerado, branding lib, script Python | Drift entre fonte e runtime | V2 |
| Acoplamentos Tokyo em contratos | cookies, headers, storage, globals | Troca sem compat quebra clientes/sessoes | Tratar com versionamento |
| Arquivos temporarios rastreados/staged | `.tmp`, `.codex-tools`, `_tmp*` aparecem no status | Ruido de repo e risco de commit acidental | Limpeza controlada pelo responsavel |

## Divida de Baixo Impacto

| Divida | Evidencia | Risco |
| --- | --- | --- |
| Nome interno `tokyo-site` | `package.json` | Baixo, interno |
| Textos Tokyo em fixtures/testes | scripts e specs | Intencional enquanto dominio atual e contrato |
| HTML estatico com marca Tokyo | paginas publicas/admin | Deve permanecer por regra da tarefa |
| Comentarios/documentacao legada | referencias historicas | Limpeza futura sem prioridade |

## O Que Esta Excelente

- Separacao clara entre frontend publico, gestor, master, APIs e stores.
- Guardas de admin no `middleware.js`.
- Permissoes por modulo/acao.
- Controle comercial por plano/contrato/recurso.
- Feature flags ja existem.
- Stores tem modo seguro em producao sem `DATABASE_URL`.
- Testes/validacoes locais cobrem regras sensiveis: dominio, planos, contratos, permissoes, master, layout e WhatsApp.
- Branding centralizado em `app-branding.cjs` e `site.config.json`.

## O Que Esta Bom

- APIs serverless simples e objetivas.
- `api/admin/[...action].js` e `api/customer/[...action].js` delegam para libs.
- Pedido tem normalizacao, idempotencia e validacao de horario.
- Dashboard e auditoria ja existem.
- Painel master ja expressa a visao comercial futura.
- Configuracoes de restaurante e delivery sao administraveis.

## O Que Merece Refatoracao

- Separar `script.js` por dominios.
- Separar `admin/admin.js` por modulos.
- Extrair persistencia comum para novos stores.
- Extrair helpers comuns de normalizacao/erro.
- Separar catalogo base de UI.
- Criar migrations versionadas.
- Normalizar master state quando sair do modo cliente modelo.

## O Que Nao Deve Ser Mexido Agora

- Dominio atual.
- Cookies e headers legados.
- Prefixo `TKY`.
- Layout publico/admin.
- Rotas existentes.
- Regras de negocio de pedido, delivery, horario, financeiro e permissao.
- Dados reais.
- Multi-restaurante real.
- `restaurant_id`.

## Riscos Para 100 Restaurantes

- Queries globais gerando vazamento ou lentidao.
- Login global bloqueando operacoes com grupos/franquias.
- Fechamento financeiro sem escopo.
- Catalogo e imagens grandes aumentando custo de deploy/carregamento.
- Admin monolitico dificultando evolucao de equipes.
- Relatorios concorrendo com escrita de pedidos.

## Riscos Para 1000 Restaurantes

- Master state JSON unico ficar inviavel.
- Falta de tenant context obrigatorio virar risco de seguranca.
- Integracoes externas sem credenciais por tenant gerarem vazamento/cobranca cruzada.
- Jobs sincronos saturarem APIs serverless.
- Logs sem escopo dificultarem suporte.
- Ausencia de particionamento/arquivamento de pedidos antigos degradar relatorios.

## Dividas Que Podem Esperar

- Renomear `tokyo-site`.
- Limpar textos Tokyo em fixtures.
- Trocar nomes de assets.
- Ajustar comentarios/documentacao historica.
- Refatorar HTML estatico de marca.

## Dividas Antes da V2

- Otimizar imagens grandes.
- Criar guia/ADR de tenant futuro.
- Definir migrations.
- Reduzir duplicacao de persistencia nos proximos stores.
- Separar responsabilidades mais criticas do admin/public sem mudar layout.
- Consolidar fonte de configuracao para reduzir drift.

## Dividas Antes do Multi-Restaurante

- Definir modelo tenant/organizacao/restaurante.
- Migrar tabelas centrais com escopo.
- Criar resolver dominio -> tenant/restaurante.
- Criar autorizacao obrigatoria por escopo.
- Versionar cookies/headers/identificadores legados.
- Normalizar master data.
- Criar indices compostos por escopo/data/status.
- Criar plano de migracao do restaurante default.

## Conclusao

A divida tecnica nao e descontrole; e uma divida tipica de produto que cresceu rapidamente mantendo operacao real. A maior decisao agora e impedir que novos modulos aumentem o acoplamento global antes do desenho multi-tenant estar fechado.
