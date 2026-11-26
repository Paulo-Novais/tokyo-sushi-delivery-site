# Relatorio de preparacao estrutural para INovas Food

Data: 2026-06-21

Escopo executado: mapeamento de acoplamentos Tokyo Sushi e criacao de uma camada central de branding, identidade de plataforma/restaurante e feature flags. Nao houve alteracao de layout, URL, login, dominio, regra de negocio, dados reais ou multi-restaurante.

## Resumo executivo

- Ocorrencias brutas atuais, excluindo este relatorio: 679 referencias relacionadas a Tokyo Sushi, dominio, prefixos, WhatsApp, endereco, logos, banners, cores e chaves legadas.
- Ocorrencias fora da camada central criada: 348 referencias em arquivos estaticos, scripts de validacao, docs, assets, CSS e contratos legados mantidos por compatibilidade.
- Ocorrencias agora centralizadas/canonicas: 331 referencias em `site.config.json`, `site-config.js`, `lib/app-branding.cjs`, `scripts/apply-site-config.py` e defaults que leem esses valores.
- Grau de preparacao atual estimado: 48/100.

## Camada central criada

Arquivo principal:

- `site.config.json`: fonte canonicamente editavel para branding inicial, dominio atual, marcas, endereco, WhatsApp, prefixos e feature flags.

Runtime/browser:

- `site-config.js`: passou a expor `appBranding`, `platformBrand`, `restaurantBrand`, `features` e `orderPrefixes` em `window.TOKYO_SITE_CONFIG`.
- `scripts/apply-site-config.py`: gerador preparado para preservar esses blocos quando `site-config.js`, `robots.txt`, `sitemap.xml` e `vercel.json` forem regenerados.

Server-side:

- `lib/app-branding.cjs`: novo modulo central com `APP_BRANDING`, `PLATFORM_BRAND`, `RESTAURANT_BRAND`, `FEATURE_FLAGS` e `ORDER_PREFIXES`.
- `lib/restaurant-settings-store.cjs`: defaults do restaurante agora leem `APP_BRANDING` e `RESTAURANT_BRAND`.
- `lib/order-store.cjs`: prefixo publico de pedido agora le `ORDER_PREFIXES.publicOrder`, mantendo `TKY`.

Front public:

- `script.js`: defaults de WhatsApp, endereco, marca/restaurante, cores, logo/banner e `footerPoweredBy` agora leem `window.TOKYO_SITE_CONFIG`, mantendo os mesmos fallbacks.

## Valores centralizados agora

| Chave | Valor atual | Uso futuro |
| --- | --- | --- |
| `appName` | `Tokyo Sushi Delivery` | Nome visivel atual do app/restaurante |
| `appShortName` | `Tokyo Sushi` | Nome curto/PWA/header |
| `supportEmail` | `admin@tokyosushidelivery.com.br` | Email de suporte/admin |
| `supportPhone` | `5516990507398` | Telefone base |
| `companyName` | `Tokyo Sushi Delivery` | Empresa atual |
| `companyWebsite` | `https://tokyosushidelivery.com.br` | Site atual |
| `footerPoweredBy` | `Tokyo Sushi Delivery Premium` | Texto de rodape atual |
| `platformName` | `Tokyo Sushi Delivery` | Nome da plataforma por enquanto |
| `platformVersion` | `1.0.0` | Versao logica da plataforma |
| `publicOrderPrefix` | `TKY` | Prefixo publico de pedidos |
| `customerPrefix` | `tokyo_customer` | Prefixo conceitual para cliente, ainda nao aplicado nos headers/cookies |
| `promotionPrefix` | `tokyo_promotion` | Prefixo conceitual para promocoes, ainda nao aplicado |
| `couponPrefix` | `TKY` | Prefixo reservado para cupons, caso a entidade seja criada |

## Atualizacao de baixo risco

Esta etapa adicionou parametrizacao sem renomear contratos nem alterar resultado visual.

Novas estruturas centralizadas:

- `assets`: icone, logo publica, banner publico, imagem social, avatar de suporte, capa de login e logo lateral do admin.
- `identifiers`: storage keys, cookies, headers, globals browser e dominio interno de email social.
- `prefixes`: pedidos, clientes, promocoes e cupom reservado.
- `adminBranding`: titles, sidebar, headline do login, placeholder e fallback `Gestor Tokyo`.
- `whatsappTemplates`: mensagens institucionais de suporte e texto de template de verificacao.
- `publicText`: textos institucionais pequenos usados pelo JS publico.
- `pages`: titles, descriptions, OG/Twitter descriptions, image alt, eyebrows e template de WhatsApp por pagina.

Arquivos que passaram a consumir a camada:

- `script.js`: storage keys, headers `x-tokyo-*`, globals, WhatsApp padrao, assets de login, textos institucionais e rodape dinamico.
- `admin/admin.js`: storage key do tema, defaults do restaurante, placeholders, fallback do gestor e sincronizacao leve de marca no admin browser.
- `lib/customer-auth.cjs`: cookies e headers do cliente via `IDENTIFIERS`.
- `lib/admin-auth.cjs`: cookie de admin e fallback de display via `IDENTIFIERS`/`ADMIN_BRANDING`.
- `maps-config.js`: nome global de Google Maps via config, mantendo `TOKYO_GOOGLE_MAPS_API_KEY`.
- `scripts/apply-site-config.py`: preparado para sincronizar HTML publico, HTML admin, metas, brand header, WhatsApp, sitemap, robots e Vercel a partir de `site.config.json`.

Observacao: os valores materiais continuam Tokyo Sushi. Isso e intencional para preservar comportamento.

## Platform brand e restaurant brand

`platformBrand` e `restaurantBrand` foram criados como estruturas separadas, mas ambas continuam apontando para Tokyo Sushi.

| Estrutura | Campos | Valor atual |
| --- | --- | --- |
| `platformBrand` | `name`, `logo`, `primaryColor`, `secondaryColor` | Tokyo Sushi Delivery, logo Tokyo, vermelho/rosa atuais |
| `restaurantBrand` | `name`, `logo`, `banner`, `primaryColor`, `secondaryColor` | Tokyo Sushi Delivery, logo/banner Tokyo, vermelho/rosa atuais |

## Feature flags

Todas permanecem habilitadas:

- `deliveryCalculation`
- `advancedReports`
- `crm`
- `inventory`
- `finance`
- `reviews`
- `promotions`
- `scheduledOrders`

Nenhum fluxo foi condicionado a elas nesta etapa, para nao alterar comportamento. Elas existem como contrato de configuracao para modularizacao futura.

## Inventario de acoplamentos

| Arquivo | Linha aproximada | Tipo de dependencia | Impacto futuro |
| --- | ---: | --- | --- |
| `site.config.json` | 2-56 | Fonte canonica de nome, dominio, telefone, endereco, marcas, cores, prefixos e flags | Centralizado; troca futura deve comecar aqui |
| `site-config.js` | 3-70 | Runtime gerado com dominio, marcas, telefone, endereco e prefixos | Centralizado para browser; deve ser regenerado via script |
| `lib/app-branding.cjs` | 19-96 | Fallbacks canonicos server-side | Centralizado; deve ser adaptado quando houver config por ambiente/tenant |
| `scripts/apply-site-config.py` | 107-198 | Fallbacks do gerador de runtime | Centralizado; ainda usa Tokyo como default de seguranca |
| `index.html` | 6-62 | Title/meta/application-name/header/logo/alt | Troca manual ou futura geracao por template |
| `index.html` | 183-224 | Hero/banner institucional e WhatsApp fixo | Troca manual; impacta primeira dobra e CTA |
| `cardapio.html` | 6-62 | Title/meta/header/logo | Troca manual ou template |
| `cardapio.html` | 120,164 | Texto "Cardapio digital Tokyo" e WhatsApp fixo | Troca manual; impacta copy e CTA |
| `entrega.html` | 6-62 | Title/meta/header/logo | Troca manual ou template |
| `entrega.html` | 120-339 | Texto "Entrega Tokyo", endereco e WhatsApp fixos | Alta dependencia operacional de endereco/base de entrega |
| `acompanhar.html` | 6-61 | Title/meta/header/logo | Troca manual ou template |
| `acompanhar.html` | 121,178 | Texto "Acompanhamento Tokyo" e WhatsApp fixo | Troca manual de copy/CTA |
| `avaliar.html` | 6-62 | Title/meta/header/logo | Troca manual ou template |
| `avaliar.html` | 128,236 | Texto institucional Tokyo e WhatsApp fixo | Troca manual de copy/CTA |
| `historico.html` | 6-62 | Title/meta/header/logo | Troca manual ou template |
| `historico.html` | 120,177 | Texto "Historico Tokyo" e WhatsApp fixo | Troca manual de copy/CTA |
| `trabalhe-conosco.html` | 6-62 | Title/meta/header/logo | Troca manual ou template |
| `trabalhe-conosco.html` | 120,291 | Texto "Time Tokyo" e WhatsApp fixo | Troca manual de RH/copy/CTA |
| `404.html` | 6-13 | Title/meta/canonical Tokyo | Troca manual ou template |
| `admin/index.html` | 6,18-24 | Title, logo sidebar e nome Tokyo | Precisa parametrizacao do admin antes de white-label |
| `admin/login.html` | 6,15,52 | Title, headline e placeholder de email Tokyo | Precisa parametrizacao sem alterar login atual |
| `admin/admin.js` | 4 | Storage key `tokyo_admin_theme` | Renomear quebraria preferencias atuais; precisa migracao compat |
| `admin/admin.js` | 405-415 | Defaults de restaurante, logo, banner, cores, WhatsApp, endereco | Ainda manual no admin browser; deve ler runtime/config no futuro |
| `admin/admin.js` | 8046-8170 | Placeholders de configuracao Tokyo/endereco/cores | Troca manual ou config de UI |
| `admin/admin.js` | 10968 | Fallback `Gestor Tokyo` | Dependencia de identidade do gestor |
| `script.js` | 1-302 | Runtime/fallbacks de branding, storage keys, endereco, cores | Parcialmente centralizado; storage keys continuam legadas por compatibilidade |
| `script.js` | 334-335,1850-1877 | Globals `TokyoBusinessHours`, `TokyoStoreHours`, `TOKYO_SITE_CONFIG` | API global legada; renomear exige bridge compat |
| `script.js` | 463,1166-1172 | Imagens e id `combinado-imperial` | Acoplamento de catalogo/cardapio |
| `script.js` | 5657,5832,5838,8021,8107,8422 | Textos/email fake/alt de login com Tokyo | Troca manual de copy e dominio interno |
| `script.js` | 7900,8773,8821-8822,10900-10901 | Headers `x-tokyo-customer-*` | Contrato API atual; exige versao/migracao compativel |
| `script.js` | 9493,9513-9514 | Endereco/footer | Parcialmente centralizado no `footerPoweredBy`, endereco ainda manual |
| `styles.css` | 8,10,2695 | Cores Tokyo em variaveis e gradiente | Precisa tema por marca antes de white-label visual |
| `site.webmanifest` | 2-9 | Nome curto/nome/descricao PWA | Troca manual ou geracao via config |
| `vercel.json` | 145-148 | Dominio fixo de redirect | Dominio por restaurante exige geracao por tenant/projeto |
| `robots.txt` | 4 | Sitemap com dominio Tokyo | Gerado por config; trocar quando dominio mudar |
| `sitemap.xml` | 4-19 | URLs com dominio Tokyo | Gerado por config; trocar quando dominio mudar |
| `package.json` | 2 | Nome do pacote `tokyo-site` | Baixo impacto runtime, mas acoplado ao projeto |
| `package-lock.json` | 2,8 | Nome do pacote `tokyo-site` | Baixo impacto runtime; acompanha package |
| `lib/order-store.cjs` | 34-36 | Fallback `TKY` para prefixo de pedido | Centralizado; fallback mantido por compatibilidade |
| `lib/customer-auth.cjs` | 5-10 | Cookies/headers `tokyo_customer_*` e `x-tokyo-customer-*` | Alto impacto API/auth; precisa bridge/migracao |
| `lib/admin-auth.cjs` | 4,17 | Cookie `tokyo_admin_session` e `Gestor Tokyo` | Alto impacto login/sessao; precisa compatibilidade |
| `lib/business-hours.cjs` | 7 | Global `TokyoBusinessHours` | Baixo/medio impacto; precisa alias compat |
| `store-hours.js` | 337 | Global `TokyoStoreHours` | Baixo/medio impacto; precisa alias compat |
| `maps-config.js` | 3-5 | Global `TOKYO_GOOGLE_MAPS_API_KEY` | Config de mapa com nome Tokyo; precisa alias compat |
| `lib/customer-crm-store.cjs` | 308 | Link WhatsApp dinamico `wa.me` | Nao e Tokyo por si, mas dependencia de canal |
| `scripts/validate-admin-local.mjs` | 199,478,507,635-651,1109 | Fixtures TKY/Tokyo em validacao segura local | Pode ser parametrizado depois; sem impacto producao |
| `scripts/validate-admin-kanban-volume.mjs` | 153,403,414,459,494,555,705,970 | Fixtures TKY/logo/storage admin | Pode ser parametrizado depois; sem impacto producao |
| `scripts/validate-stage-3-ui-local.mjs` | 28-29,132-143,192,439-492 | Fixtures Tokyo/TKY/headers | Pode ser parametrizado depois; sem impacto producao |
| `scripts/validate-stage-1-1.mjs` | 130-277 | Login/dominio/host Tokyo em validacao antiga | Risco de expectativa antiga; parametrizar antes de SaaS |
| `scripts/validate-stage-2.mjs` | 129-169 | Login/dominio Tokyo em validacao antiga | Parametrizar antes de SaaS |
| `scripts/validate-stage-3.mjs` | 164-579 | Headers, dominio, login Tokyo em validacao antiga | Parametrizar antes de SaaS |
| `scripts/validate-whatsapp-integration.mjs` | 94,120,137 | Template `tokyo_verify_code` e cliente Tokyo | Parametrizar quando templates forem por marca |
| `scripts/validate-business-hours.mjs` | 280 | Prefixo de pasta temporaria `tokyo-business-hours-tests-` | Baixo impacto; apenas identificador local temporario |
| `tests/validate-stage-3-ui.spec.js` | 106-167 | Headers/storage/login Tokyo | Parametrizar testes antes de white-label |
| `WHATSAPP-LOGIN-SETUP.md` | 25 | Texto de template WhatsApp com Tokyo | Atualizar docs/templates na migracao |
| `ETAPA-1.1-ESTABILIZACAO.md` | 47 | Dominio Tokyo em doc | Baixo impacto; documentacao |
| `assets/tokyo-logo-*.png` | n/a | Logos fixas Tokyo | Substituir/adicionar assets INovas e/ou por restaurante |
| `assets/tokyo-torii-*.png` | n/a | Marca/icone Tokyo | Substituir/adicionar assets por plataforma/restaurante |
| `assets/login-cover*.png` | n/a | Imagem institucional/login | Substituir/adicionar imagem INovas ou tenant |
| `site-images/tokyo-logo-premium-transparent.png` | n/a | Logo publica fixa | Centralizada como caminho, asset ainda Tokyo |
| `site-images/combinado-imperial.png` | n/a | Banner/social image/cardapio | Centralizada como caminho, asset ainda Tokyo |
| `site-images/login-cover-floating.png` | n/a | Imagem institucional fixa | Troca manual/asset por marca |
| `menu_pdf_images/combinado-imperial.png` | n/a | Imagem de produto/banner | Dependencia de catalogo Tokyo |
| `menu_pdf_images/support-avatar-*.png` | n/a | Imagens de atendimento | Avaliar se ficam plataforma ou restaurante |

## Ja centralizado

- Nome do app, nome curto, email, telefone, empresa, site, rodape, plataforma e versao.
- `platformBrand` separado de `restaurantBrand`.
- Logo, banner e cores default de marca/restaurante.
- Endereco default estruturado.
- WhatsApp default.
- Prefixo publico de pedido via `ORDER_PREFIXES.publicOrder`.
- Feature flags dos modulos principais.
- Defaults publicos/server-side de restaurante passaram a vir da camada central.

## Ainda depende de alteracao manual

- HTML estatico de paginas publicas ainda contem os valores gerados atuais; a fonte parametrizada ficou em `site.config.json` + `scripts/apply-site-config.py`.
- Admin estatico ainda contem os valores atuais, mas o browser sincroniza a marca via `admin/admin.js` e o gerador sabe reaplicar a config.
- Chaves de storage, cookies e headers com `tokyo_*` ou `x-tokyo-*` foram centralizadas, mas nao renomeadas por compatibilidade.
- Globals browser com `Tokyo*` e `TOKYO_*`.
- Assets fisicos com logo/banner/imagens Tokyo.
- Cores hardcoded em `styles.css` e placeholders do admin.
- Validacoes antigas e fixtures de teste com TKY/Tokyo.
- Docs e templates WhatsApp.
- `site.webmanifest`, `sitemap.xml`, `robots.txt`, `vercel.json` e package metadata.

## Riscos encontrados

- Renomear storage/cookies/headers agora quebraria sessoes, historico local e validacoes; por isso os nomes foram apenas centralizados.
- `scripts/apply-site-config.py` tambem reescreve `vercel.json`, `robots.txt` e `sitemap.xml`; deve ser executado com revisao de diff quando houver troca real de dominio/marca.
- `maps-config.js` ainda contem a chave atual de Google Maps hardcoded; esta etapa centralizou o nome global, mas nao alterou segredo/config operacional.
- Prefixos de cliente/promocao/cupom foram configurados, mas IDs reais de cliente/promocao nao foram renomeados porque isso mudaria contratos e dados.
- Assets fisicos continuam Tokyo; a referencia esta centralizada onde era seguro, mas os arquivos ainda precisam de estrategia de substituicao.

## Necessario para INovas Food

- Definir se INovas Food sera `platformBrand` e Tokyo sera apenas `restaurantBrand`.
- Criar assets de plataforma: logo, icone, social image, login cover e manifest.
- Parametrizar HTML estatico ou converter para geracao por config.
- Introduzir aliases compativeis para globals/headers/cookies antes de renomear contratos.
- Trocar docs/templates WhatsApp e fixtures de validacao.

## Necessario para dominio proprio por restaurante

- Separar config de dominio por ambiente/restaurante sem alterar as URLs atuais agora.
- Gerar `vercel.json`, `robots.txt`, `sitemap.xml`, canonical e OG por dominio.
- Definir politica de redirects entre dominio principal, `www` e dominios Vercel.
- Validar Google Maps referrers por dominio.

## Necessario para painel master

- Criar conceito de usuario/operador de plataforma separado do gestor atual.
- Manter login atual intacto enquanto nasce uma rota/escopo master separado.
- Definir permissoes por modulo e feature flag.
- Centralizar auditoria, metricas e billing/assinatura por restaurante no futuro.

## Necessario para multiplos restaurantes

- Planejar modelo de dados de tenant/restaurante antes de criar `restaurant_id`.
- Criar estrategia de migracao dos stores locais/Neon e compatibilidade de sessoes.
- Versionar APIs que hoje usam headers/cookies `x-tokyo-*`.
- Separar catalogo, pedidos, clientes, estoque, financas, avaliacoes e configuracoes por tenant.
- Criar testes que validem isolamento entre tenants antes de habilitar multi-restaurante.

## Observacoes de seguranca

- Nenhum script destrutivo foi executado.
- Nenhum deploy foi feito.
- Nenhum dado real foi alterado.
- A nova estrutura conserva todos os valores atuais de Tokyo Sushi.

## Validacoes da etapa de baixo risco

- `node -c script.js`: passou.
- `node -c admin/admin.js`: passou.
- `node -c lib/app-branding.cjs`: passou.
- `node -c lib/customer-auth.cjs`: passou.
- `node -c lib/admin-auth.cjs`: passou.
- `node -c maps-config.js`: passou.
- `node -c site-config.js`: passou.
- Validacao JSON de `site.config.json`, `vercel.json`, `package.json`, `package-lock.json`: passou.
- `python -m py_compile scripts/apply-site-config.py`: passou.
- `npm.cmd run validate:business-hours`: passou.
- `npm.cmd run validate:admin-local`: passou.
- `npm.cmd run validate:stage-3-ui-local`: passou.

## Proximos passos recomendados

- Parametrizar `site.webmanifest` por `site.config.json`.
- Criar aliases compativeis para globals `TokyoBusinessHours`, `TokyoStoreHours` e `TOKYO_SITE_CONFIG` antes de qualquer renomeacao.
- Separar tema visual em tokens configuraveis antes de trocar cores de plataforma/restaurante.
- Parametrizar fixtures antigas de validacao sem tocar nos scripts seguros locais.
- Planejar migracao de cookies/storage/headers com leitura dupla antes de trocar nomes.
- Criar pacote de assets INovas Food sem substituir os arquivos Tokyo usados em producao.

## Auditoria final de regressao

Data: 2026-06-21

Status geral: aprovado apos repeticao de uma validacao flutuante.

Escopo verificado:

- Site publico: home, cardapio, entrega, acompanhar pedido, historico, avaliacao, trabalhe conosco, marca, textos principais, WhatsApp, rodape, carrinho, criacao/acompanhamento de pedido, funcionamento aberto/fechado e datas especiais.
- Admin/Gestor: login, dashboard, pedidos, cardapio, clientes, relatorios, estoque, financas, avaliacoes, configuracoes, navegacao, tema fixo, storage de tema e APIs protegidas.
- Configuracao central: `site.config.json`, `site-config.js`, `lib/app-branding.cjs`, exports de branding, identifiers, prefixos e templates.
- Compatibilidade: cookies, storage, headers, rotas e dominio mantidos com os nomes atuais.

Contratos antigos confirmados:

- Storage local continua usando `tokyo_sushi_delivery_cart`, `tokyo_sushi_profile`, `tokyo_customer_client_token`, `tokyo_admin_theme` e demais chaves legadas.
- Cookies continuam `tokyo_admin_session`, `tokyo_customer_session` e `tokyo_customer_login_challenge`.
- Headers continuam `x-tokyo-customer-client-token` e `x-tokyo-customer-key`.
- Runtime global continua `window.TOKYO_SITE_CONFIG` e `window.getTokyoSiteUrl`.
- Prefixo publico de pedido continua `TKY`.
- Dominio principal continua `tokyosushidelivery.com.br` e alternativo `www.tokyosushidelivery.com.br`.
- Rotas publicas e admin atuais foram preservadas.

Resultados da auditoria:

- `node -c` em JS/CJS alterados: passou.
- Validacao JSON de `site.config.json`, `vercel.json`, `package.json`, `package-lock.json`: passou.
- `python -m py_compile scripts/apply-site-config.py`: passou.
- Auditoria Node de contratos legados: passou.
- Auditoria estatica de paginas/metas/admin runtime: passou.
- `npm.cmd run validate:business-hours`: passou.
- `npm.cmd run validate:admin-local`: passou.
- `npm.cmd run validate:stage-3-ui-local`: primeira execucao falhou ao aguardar o codigo provisorio; repeticao passou sem alteracao de codigo.
- `npm.cmd run validate:whatsapp`: passou.

Riscos encontrados nesta auditoria:

- `validate:stage-3-ui-local` apresentou uma falha flutuante nao reproduzida na repeticao. Recomenda-se repetir esse teste em futuras etapas que mexam em login, storage, headers ou scripts carregados na pagina publica.
- `maps-config.js` ainda possui chave de Google Maps hardcoded ja existente. A auditoria nao alterou esse comportamento.
- `scripts/apply-site-config.py` esta preparado para reescrever HTML/admin/sitemap/robots/Vercel; quando for usado para troca real de marca/dominio, o diff deve ser revisado antes de commit/deploy.

Pendencias restantes:

- `site.webmanifest` ainda precisa ser gerado/parametrizado por config.
- CSS e assets fisicos continuam com identidade Tokyo.
- Globals `TokyoBusinessHours`, `TokyoStoreHours` e `TOKYO_GOOGLE_MAPS_API_KEY` seguem como contratos legados.
- Fixtures antigas de validacao e docs ainda citam Tokyo/TKY.

Nova recomendacao de proxima etapa:

- Fazer uma etapa pequena apenas para parametrizar `site.webmanifest`, documentacao e fixtures seguras, mantendo os contratos runtime intactos.
- Depois disso, criar aliases compativeis para globals antes de qualquer renomeacao publica.
