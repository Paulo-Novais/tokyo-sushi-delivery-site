# INOVAS FOOD - V1.3 RC Technical Review

Data da revisao: 2026-06-30

Escopo: revisao completa, hardening, refatoracao segura e preparacao comercial da V1.3 RC, sem criar funcionalidade nova e sem alterar comportamento aprovado.

## Resumo executivo

A base V1.3 RC esta funcional, validada localmente e preparada para seguir para commit apos revisao humana. A auditoria confirmou que a arquitetura SaaS inicial, a separacao entre Usuario do Sistema e Usuario de Restaurante, o painel da plataforma, a identidade visual INOVAS Food e os validadores V1.1/V1.2/V1.3 permanecem coerentes.

Nao foram feitas alteracoes de regra de negocio, APIs, autenticacao, permissoes, menus, fluxos, design system ou marca. A unica alteracao desta sprint tecnica foi a criacao deste relatorio.

O projeto ainda possui divida tecnica relevante em monolitos grandes, CSS legado, artefatos locais ignorados, uso amplo de `innerHTML`, compatibilidades Tokyo/default e duplicacoes historicas de validadores. Nenhum desses pontos foi removido nesta etapa porque pode afetar comportamento publicado ou validacoes aprovadas.

Resultado tecnico: APTO PARA COMMIT, desde que este relatorio seja aceito como documentacao da RC e que a limpeza de risco medio fique para sprint propria.

## Arquivos revisados

- `admin/admin.js`
- `admin/admin.css`
- `admin/design-system.css`
- `admin/index.html`
- `admin/login.html`
- `admin/master.html`
- `admin/master.js`
- `admin/orders-production-restore.css`
- `assets/inovas-food-logo-oficial.png`
- `lib/admin-api.cjs`
- `lib/app-branding.cjs`
- `lib/master-platform-store.cjs`
- `lib/user-permissions.cjs`
- `lib/security-guardian.cjs`
- `lib/tenant-context.cjs`
- `lib/order-store.cjs`
- `lib/catalog-store.cjs`
- `lib/restaurant-settings-store.cjs`
- `scripts/validate-v1-3-platform-local.mjs`
- `scripts/validate-v1-1-users-local.mjs`
- `scripts/validate-v1-2-saas-local.mjs`
- `scripts/validate-permissions-local.mjs`
- `scripts/validate-platform-integration-local.mjs`
- `scripts/validate-v1-final-local.mjs`
- `docs/README.md`
- `docs/architecture/*`
- `docs/design/*`
- `docs/roadmap/*`
- `package.json`

## Arquivos alterados

- `V1-3-RC-TECHNICAL-REVIEW.md`

Nenhum arquivo de codigo foi alterado nesta revisao.

## Arquivos nao alterados por seguranca

- `admin/admin.js`: monolito grande, mas concentra fluxos validados de restaurante, usuarios, pedidos e configuracoes.
- `admin/admin.css`: contem CSS legado e blocos antigos, mas remove-los agora poderia gerar regressao visual.
- `admin/orders-production-restore.css`: arquivo de restauracao/compatibilidade visual. Deve ser removido apenas com screenshot diff dedicado.
- `lib/admin-api.cjs`: regras SaaS, sessao e autorizacao aprovadas por validadores.
- `lib/master-platform-store.cjs`: contem seed Tokyo/default, onboarding, seller_id e compatibilidade V1.2/V1.3.
- `lib/user-permissions.cjs`: contem permissoes legadas e SaaS; renomear campos quebraria contrato.
- `scripts/validate-*.mjs`: duplicacoes conhecidas, mas sao a rede de seguranca da release.
- `assets/*`, `site-images/*`, `menu_pdf_images/*`: imagens grandes e duplicadas precisam de estrategia de asset/CDN antes de remocao.
- Arquivos locais `_tmp*`, logs e `NUL`: parecem artefatos de trabalho ignorados, mas nao foram removidos sem autorizacao explicita.

## Duplicacoes encontradas

- CSS administrativo duplicado entre `admin/admin.css`, `admin/design-system.css` e `admin/orders-production-restore.css`.
- Seletores de compatibilidade `legacy-dark-disabled` ainda existem apesar do tema oficial ser claro/laranja.
- Renderizacao por template string e `innerHTML` aparece em `admin/admin.js` e `admin/master.js`.
- Validadores possuem helpers repetidos para login, servidor local, fixtures, cookies e Playwright.
- Nomenclaturas convivem por compatibilidade: `seller_id`/`sellerId`, `role`/`profile`, `userType`/`tipo_usuario`, `restaurantKey`/`restaurant_id`.
- Imagens de catalogo aparecem em mais de uma pasta (`site-images` e `menu_pdf_images`).
- Campos Tokyo/default aparecem em stores, seeds e docs como compatibilidade do cliente modelo.

## Problemas encontrados

- `admin/admin.js` possui mais de 13 mil linhas e concentra muita responsabilidade.
- `admin/admin.css` possui mais de 11 mil linhas e inclui temas/blocos historicos.
- `lib/order-store.cjs`, `lib/catalog-store.cjs`, `lib/admin-api.cjs` e `lib/master-platform-store.cjs` sao arquivos extensos com responsabilidades acumuladas.
- Ha cerca de 300 artefatos locais `_tmp*`/logs/relatorios no workspace raiz, ignorados pelo Git, mas poluem auditorias manuais.
- O uso de `innerHTML` e `insertAdjacentHTML` e amplo; ha `escapeHtml` em pontos importantes, mas a disciplina precisa continuar obrigatoria.
- Nao ha script de lint geral em `package.json`; a seguranca atual vem dos validadores especificos.
- Ha referencias Tokyo/default numerosas. Elas sao esperadas para o restaurante cliente/modelo, mas precisam ficar isoladas em camada de tenant/seed.
- Alguns validadores legados ainda carregam termos de tema dark/legacy por compatibilidade historica.
- Alguns assets PNG sao grandes e duplicados, o que pode impactar repositorio, build e deploy.

## Melhorias realizadas

- Foi criada esta revisao tecnica consolidada da V1.3 RC.
- Foi documentada a classificacao dos pontos que devem ficar congelados nesta RC.
- Foi registrada a separacao entre riscos reais e compatibilidades intencionais.
- Foi confirmado que a logo oficial `assets/inovas-food-logo-oficial.png` esta referenciada nos pontos administrativos principais.
- Foi confirmado que Tokyo Sushi Delivery permanece como restaurante cliente, nao como identidade da plataforma.
- Foi confirmado que a estrutura de validadores cobre V1.1, V1.2, V1.3, permissoes, integracao e release final.

## Melhorias sugeridas

- Separar `admin/admin.js` em modulos por dominio: usuarios, pedidos, cardapio, financeiro, configuracoes e shell.
- Separar `admin/master.js` em modulos de restaurantes, clientes, usuarios, comercial, financeiro e auditoria.
- Consolidar Design System em componentes/tokens reutilizaveis e reduzir CSS legado gradualmente.
- Criar uma sprint propria para remover `legacy-dark-disabled` com screenshots desktop/mobile antes e depois.
- Criar helpers compartilhados para validadores: start server, login, cookies, reset de seguranca e smoke browser.
- Introduzir lint/format check gradual, inicialmente apenas para arquivos novos ou alterados.
- Criar inventario de assets e estrategia de compressao/CDN para imagens grandes.
- Centralizar compatibilidades Tokyo/default em factories/seeds explicitamente nomeados.
- Criar matriz de campos publicos para evitar renomear contratos (`restaurantKey`, `seller_id`, `userType`, etc.).
- Criar checklist de XSS para qualquer novo uso de HTML dinamico.

## Riscos

- Remover CSS legado sem cobertura visual pode quebrar telas antigas.
- Renomear campos camelCase/snake_case pode quebrar APIs, validadores e dados persistidos.
- Limpar referencias Tokyo/default de forma agressiva pode quebrar o restaurante padrao publicado.
- Reduzir validadores legados pode mascarar regressao V1.0/V1.1/V1.2.
- Alterar `seller_id`/`sellerId` sem migracao pode impactar futura comissao.
- Modificar o fluxo de sessao pode reabrir regressao do OWNER/default sem `restaurantName`.
- Consolidar arquivos grandes sem testes incrementais pode criar regressao silenciosa.

## Divida tecnica

- Monolitos frontend administrativos.
- CSS historico e Design System ainda parcialmente sobreposto.
- Validadores com duplicacao operacional.
- Ausencia de lint padrao.
- Assets grandes dentro do repositorio.
- Compatibilidade multi-tenant ainda em fase de preparacao.
- Uso extensivo de HTML string rendering.
- Mistura controlada de campos legados e novos para manter compatibilidade.

## Prioridades futuras

1. Criar sprint de modularizacao segura do admin, sem mudar comportamento.
2. Criar sprint de limpeza CSS com screenshot diff obrigatorio.
3. Criar pacote interno de helpers para validadores.
4. Criar lint incremental e checks de arquivo novo.
5. Centralizar seed Tokyo/default e documentar contratos multi-tenant.
6. Otimizar assets grandes e revisar duplicacoes de imagens.
7. Evoluir RBAC completo por modulo a partir da estrutura SaaS ja criada.
8. Preparar migracao de dados para multi-restaurante real.
9. Criar smoke visual padrao para login, MASTER, OWNER e publico.
10. Criar observabilidade de producao para erros de admin e APIs principais.

## Checklist geral

- [x] Nao criou funcionalidade nova.
- [x] Nao alterou APIs publicas.
- [x] Nao alterou autenticacao.
- [x] Nao alterou permissoes.
- [x] Nao alterou menus.
- [x] Nao alterou regras SaaS.
- [x] Nao alterou Design System.
- [x] Nao alterou logo oficial.
- [x] Nao alterou comportamento Tokyo/default.
- [x] Nao removeu validacoes.
- [x] Identificou duplicacoes.
- [x] Identificou riscos.
- [x] Identificou divida tecnica.
- [x] Separou pontos seguros de pontos que exigem sprint propria.
- [x] Preparou recomendacoes comerciais e tecnicas.

## Scores

| Area | Score | Justificativa |
| --- | ---: | --- |
| Arquitetura | 8.0 | SaaS inicial coerente, mas ainda com monolitos e compatibilidade default. |
| Organizacao | 8.0 | Docs organizados e validadores claros; workspace local ainda poluido por artefatos ignorados. |
| Seguranca | 8.2 | Backend valida hierarquia, escopo e sessao; XSS e lint ainda pedem hardening continuo. |
| Escalabilidade | 7.4 | Base multi-restaurante preparada, mas stores e seeds ainda centralizam compatibilidade. |
| Design System | 8.6 | Tema claro/laranja e logo oficial aplicados no admin; CSS legado precisa limpeza posterior. |
| Legibilidade | 7.4 | Fluxos documentados, mas arquivos grandes dificultam manutencao. |
| Documentacao | 8.8 | Arquitetura, design, roadmap e revisoes estao registrados. |
| Performance | 7.2 | Validacoes passam; assets grandes e JS/CSS volumosos sao pontos futuros. |
| Preparacao Comercial | 8.0 | Painel plataforma e cadastros comerciais existem como base; automacoes comerciais ficam futuras. |
| SaaS | 8.1 | Separacao sistema/restaurante, menus, header e seller_id estao cobertos por validadores. |

## Status final

APTO PARA COMMIT.

Justificativa: a revisao nao alterou comportamento aprovado, consolidou riscos e divida tecnica, manteve a logo oficial e o Design System INOVAS Food como referencia, e preservou as validacoes existentes como criterio de aceite. As limpezas de maior impacto devem ser tratadas em sprints dedicadas, com screenshots e validadores especificos.
