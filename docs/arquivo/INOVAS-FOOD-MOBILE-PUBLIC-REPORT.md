# INovas Food - Relatorio de Mobile Publico

Data: 2026-06-26

## 1. Escopo

Esta rodada atuou exclusivamente na experiencia mobile da area publica do cliente.

Paginas consideradas:

- `index.html`
- `cardapio.html`
- `entrega.html`
- `acompanhar.html`
- `historico.html`
- `avaliar.html`
- `trabalhe-conosco.html`

Nao foram alterados Gestor/Admin, Painel Master, APIs, banco de dados, regras de negocio, dominio, deploy ou dados reais.

## 2. Problemas Encontrados

1. Navegacao mobile dependia de menu recolhido, deixando links principais menos diretos em telas pequenas.
2. Botao da sacola herdava `data-auth-required` e podia ficar invisivel no mobile para visitante nao autenticado.
3. Links do rodape tinham alvo de toque inferior ao recomendado, especialmente em 768px.
4. Link do rodape da plataforma INovas tambem tinha alvo de toque pequeno no mobile/tablet.
5. Navegacao de categorias do cardapio precisava de tratamento mobile mais estavel para layouts `MODERN`, `CATALOGO` e `PREMIUM`.
6. Carrinho lateral precisava de limites mais explicitos para viewport mobile, incluindo `dvh` e area segura.
7. Nao existia uma validacao automatizada dedicada para a area publica mobile.

## 3. Ajustes Realizados

Arquivo: `styles.css`

- Navegacao principal ate 860px agora fica visivel como faixa horizontal rolavel.
- Botao da sacola fica visivel e tocavel no mobile, sem mudar o fluxo de pedido.
- Sacola recebeu dimensoes minimas mais estaveis em telas pequenas.
- Links do rodape e link da plataforma receberam alvo minimo de toque no mobile/tablet.
- Navegacao de categorias do cardapio fica sticky e rolavel ate 720px.
- Drawer do carrinho recebeu limites com `100vw`, `88dvh` e `safe-area-inset-bottom`.
- Home recebeu pequenos ajustes de espacamento e escala visual ate 560px.
- Gaps de grids publicos foram reduzidos em telas muito pequenas para melhorar leitura e evitar apertos.

Arquivo: `scripts/validate-mobile-public-local.mjs`

- Criado validador local com Playwright.
- Usa servidor estatico local com mocks apenas para endpoints publicos carregados automaticamente.
- Nao usa dados reais.
- Nao cria nem modifica `.data`.
- Bloqueia dependencia de internet para Google Maps/ViaCEP durante a validacao.
- Verifica overflow horizontal, console errors, respostas >=400, cabecalho visivel, sacola tocavel, rodape presente e cardapio navegavel.

Arquivo: `package.json`

- Adicionado script:

```bash
npm run validate:mobile-public-local
```

No PowerShell local, usar:

```bash
npm.cmd run validate:mobile-public-local
```

## 4. Paginas e Larguras Validadas

Larguras:

- 320px
- 360px
- 375px
- 390px
- 414px
- 430px
- 768px

Paginas validadas em `MODERN` + `DARK`:

- Inicio
- Cardapio
- Entrega
- Acompanhar pedido
- Historico
- Avaliar
- Trabalhe Conosco

Matriz adicional no cardapio:

- Layouts: `MODERN`, `CATALOGO`, `PREMIUM`
- Temas: `LIGHT`, `DARK`, `AUTO`
- Larguras: 390px e 768px

Total: 67 cenarios mobile validados.

## 5. Bugs Corrigidos

1. Sacola mobile invisivel para visitante.
2. Rodape com links abaixo do alvo minimo de toque.
3. Rodape INovas com link pequeno demais em mobile/tablet.
4. Navegacao mobile excessivamente escondida para uso recorrente.
5. Navegacao de categorias do cardapio menos ergonomica em tela estreita.

## 6. Antes e Depois

Antes:

- O usuario mobile dependia de abrir o menu para navegar entre paginas principais.
- A sacola podia nao aparecer quando o usuario ainda nao estava autenticado.
- Links do rodape eram visualmente corretos, mas tinham area de toque pequena.
- Nao havia teste automatizado especifico para mobile publico.

Depois:

- Links principais ficam visiveis em uma faixa horizontal compacta.
- Sacola fica sempre disponivel no cabecalho mobile.
- Rodape e link INovas possuem area de toque confortavel.
- Cardapio tem navegacao de categorias mais acessivel no mobile.
- Regressao mobile publica passa a ser validada por script dedicado.

## 7. Validacoes Executadas

Comandos executados:

```bash
npm.cmd run validate:mobile-public-local
npm.cmd run validate:site-layouts-local
npm.cmd run validate:stage-3-ui-local
npm.cmd run validate:business-hours
npm.cmd run validate:whatsapp
node --check scripts\validate-mobile-public-local.mjs
node --check script.js
node --check api\reviews.js
node -e "const fs=require('fs'); for (const file of ['package.json','site.config.json']) JSON.parse(fs.readFileSync(file,'utf8')); console.log('JSON parse OK');"
git diff --check
```

Resultados:

- `validate:mobile-public-local`: OK, 67 cenarios validados.
- `validate:site-layouts-local`: OK.
- `validate:stage-3-ui-local`: OK.
- `validate:business-hours`: OK.
- `validate:whatsapp`: OK.
- `node --check`: OK.
- `JSON.parse`: OK.
- `git diff --check`: OK, apenas avisos de LF/CRLF do Windows.

## 8. Itens Mantidos Sem Alteracao

- Fluxo de pedido.
- Regras de autenticacao.
- Checkout.
- Calculo de entrega.
- Google Maps.
- WhatsApp.
- APIs.
- Banco de dados.
- Admin/Gestor.
- Painel Master.
- Layout desktop.
- Dados reais.

## 9. Pontos Que Ficaram Para Depois

1. Revisao visual manual em dispositivos reais iOS/Android.
2. Screenshots comparativos antes/depois para aprovacao de produto.
3. Otimizacao de imagens pesadas com WebP, thumbnails e CDN/storage.
4. Validacao end-to-end real do Google Maps em dominio de producao com chave restrita.
5. Teste manual do fluxo completo de adicionar item, abrir sacola e iniciar checkout em aparelho fisico.

## 10. Resultado Final

A area publica mobile ficou mais direta, tocavel e validavel, sem alterar dominio, regras de negocio, banco, APIs, Admin/Gestor ou deploy.

O principal ganho tecnico foi transformar problemas comuns de mobile em contrato automatizado: overflow horizontal, sacola visivel, navegacao publica, rodape tocavel e variacoes de layout/tema agora possuem validacao local dedicada.
