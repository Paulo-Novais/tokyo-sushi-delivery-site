# INovas Food - Status da Plataforma

Data da auditoria: 2026-06-25
Ambiente: local isolado, sem deploy, sem alteracao de dominio, sem multi-restaurante real, sem `restaurant_id` e sem dados reais.

## Status atual

A plataforma esta em boa condicao para seguir rumo a uma V1.0 profissional em ambiente de preview controlado. A base atual preserva Tokyo Sushi como Cliente Modelo e mantem a arquitetura futura preparada por `restaurant_key = "default"`, sem ativar multi-restaurante real.

As tres superficies principais estao funcionais em ambiente local:

- Site publico.
- Gestor do Restaurante.
- Painel Master INovas Food.

Nao foram encontrados bugs bloqueantes no codigo-fonte durante a auditoria local. Os principais riscos atuais sao de pre-deploy, higiene de repositorio, configuracao externa e validacao em preview/producao.

## Bugs encontrados

| Severidade | Item | Status |
| --- | --- | --- |
| Critica | Muitos artefatos locais aparecem rastreados/staged, incluindo `.tmp`, `.codex-tools` e caches. | Pendente; nao removido para evitar mexer em trabalho existente. |
| Critica | `.tmp/prod-file-compare/admin_admin.js` e um arquivo temporario com HTML salvo como `.js`, fazendo `node --check` falhar se `.tmp` entrar na varredura/commit. | Documentado; nao removido. |
| Alta | `maps-config.js` contem chave Google Maps client-side. Pode ser aceitavel se a chave estiver restrita por referrer/API, mas precisa confirmacao externa. | Pendente. |
| Media | Imagens muito grandes em `site-images` podem prejudicar performance em producao. | Pendente. |
| Media | Ainda nao houve validacao em preview/producao apos a base SaaS/Master. | Pendente. |
| Baixa | Docs e scripts legados ainda citam Tokyo/TKY por compatibilidade. | Documentado. |

## Bugs corrigidos

| Item | Arquivo | Resultado |
| --- | --- | --- |
| Prevenir novos artefatos locais no Git | `.gitignore` | Adicionadas regras para `.tmp/`, `.codex-tools/`, `__pycache__/` e `*.pyc`. |

Observacao: a correcao no `.gitignore` nao remove arquivos que ja estao rastreados/staged. Isso deve ser feito em uma etapa deliberada de limpeza de indice.

## Validacoes executadas

Todos os scripts solicitados passaram:

- `npm.cmd run validate:business-hours`
- `npm.cmd run validate:admin-local`
- `npm.cmd run validate:permissions-local`
- `npm.cmd run validate:master-panel-local`
- `npm.cmd run validate:platform-integration-local`
- `npm.cmd run validate:site-layouts-local`
- `npm.cmd run validate:domains-local`
- `npm.cmd run validate:plans-contracts-local`
- `npm.cmd run validate:stage-3-ui-local`
- `npm.cmd run validate:whatsapp`

Checagens estaticas:

- `node --check` nos JS/CJS/MJS de fonte real alterados: OK.
- `JSON.parse` em `package.json`, `site.config.json`, `vercel.json`: OK.
- `python -m py_compile scripts/apply-site-config.py`: OK.

Auditoria complementar:

- 7 paginas publicas em 3 viewports: 21 combinacoes OK.
- Sem erro de console/pageerror na auditoria publica mockada.
- Sem imagem local quebrada na auditoria publica mockada.
- Sem overflow horizontal detectado na auditoria publica mockada.
- SEO/OpenGraph/Twitter card presentes nas paginas publicas.

## Pendencias criticas

- Remover do indice Git os artefatos locais que nao devem ir para producao (`.tmp`, `.codex-tools`, caches e comparacoes temporarias), preservando o que for evidencia desejada em docs.
- Confirmar restricoes da chave Google Maps no Google Cloud ou mover a estrategia para configuracao segura apropriada.
- Rodar preview controlado antes de qualquer deploy real.
- Revisar diff completo antes de commit, porque o worktree esta amplo e contem muitas alteracoes anteriores.

## Pendencias medias

- Comprimir imagens grandes em `site-images`.
- Confirmar variaveis reais de admin, WhatsApp, banco e mapas sem expor valores.
- Validar fluxo de pedido completo em preview com dados sinteticos.
- Revisar limites comerciais dos planos e limites de usuarios por plano.
- Formalizar persistencia de contratos, auditoria e billing antes de producao.

## Pendencias baixas

- Parametrizar textos legados Tokyo/TKY em docs e validacoes antigas quando a plataforma deixar de ser apenas Cliente Modelo.
- Melhorar relatorios de performance com metricas reais de Lighthouse/Web Vitals em preview.
- Criar rotina padrao de smoke test pre-merge.

## Riscos antes de deploy

- Artefatos locais podem entrar no pacote/commit se o indice nao for limpo.
- A chave Google Maps client-side exige restricao externa; sem isso, ha risco de abuso/custo.
- Ambiente preview ainda nao foi validado apos a fundacao SaaS.
- Variaveis reais e integrações externas nao foram testadas nesta auditoria.

## Riscos antes de producao

- Persistencia real precisa estar definida para pedidos, usuarios, contratos, auditoria, estoque, financeiro e configuracoes.
- Backup/restauracao e observabilidade ainda precisam de processo.
- Cobranca real, DNS/SSL automatico e multi-restaurante real estao fora do escopo atual.
- Politicas de privacidade precisam cobrir WhatsApp, localizacao futura e dados de clientes.

## Proximos passos recomendados

1. Limpar o indice Git dos artefatos locais ja rastreados, sem apagar evidencias importantes.
2. Confirmar/restringir a chave Google Maps.
3. Otimizar imagens pesadas.
4. Rodar preview controlado sem alterar dominio.
5. Repetir a bateria de validacoes no preview.
6. Revisar diff e separar commit de codigo, docs e evidencias.

## Percentual atualizado por modulo

| Modulo | Percentual | Status |
| --- | ---: | --- |
| Site publico | 90% | Estavel localmente; falta preview. |
| Gestor | 87% | Funcional localmente; falta preview com env real. |
| Painel Master | 84% | Base forte; CRUD comercial real ainda futuro. |
| Usuarios | 86% | Fluxos principais validados. |
| Permissoes | 88% | Matriz validada. |
| Planos | 86% | Bloqueios e recursos validados. |
| Dominios | 78% | Simulacao pronta; DNS/SSL real pendente. |
| Contratos | 78% | Estrutura pronta; operacao comercial real pendente. |
| Seguranca | 82% | Matriz OK; atencao em Google Maps e preview. |
| Testes | 92% | Bateria local passou. |
| SaaS | 74% | Fundacao pronta, sem multi-tenant real. |
| Multi-restaurante | 58% | Preparado conceitualmente, nao implementado. |
| V1.0 | 84% | Caminhando para preview controlado. |
| V1.5 | 35% | Planejada, ainda nao implementada. |
| V2.0 | 25% | IA planejada, ainda nao implementada. |
| V2.5 | 20% | Entrega por rota real planejada. |

## Conclusao

A INovas Food esta tecnicamente bem encaminhada para uma entrega V1.0 profissional, desde que o pre-deploy seja tratado com rigor. O codigo-fonte validado passou nos testes locais seguros, mas ainda nao deve ir para deploy sem limpeza de artefatos, revisao de chave Google Maps, preview controlado e revisao final de diff.
