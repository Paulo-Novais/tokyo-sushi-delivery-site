# INovas Food - Coding Standards

Data: 2026-06-26

Escopo: padroes oficiais de desenvolvimento. Este documento nao altera codigo, APIs, banco, layout, deploy ou regras de negocio.

## 1. Principios

- Compatibilidade primeiro.
- Mudancas pequenas e revisaveis.
- APIs finas, dominio em `lib/`.
- Stores responsaveis por persistencia.
- Erros estaveis com `errorCode`.
- Permissoes e plano sempre considerados em admin.
- Nenhum segredo em codigo, log, doc ou teste.
- Nenhum multi-restaurante real sem plano aprovado.

## 2. JavaScript

### Modulos

Padrao atual:

- CommonJS em `lib/*.cjs`.
- JavaScript serverless em `api/*.js`.
- ES modules em scripts `.mjs`.

Regras:

- Manter o formato do arquivo existente.
- Nao misturar `import` e `require` sem necessidade.
- Preferir exports explicitos no final de arquivos `lib/*.cjs`.

### Nomes

Use:

- `camelCase` para variaveis e funcoes.
- `PascalCase` apenas para classes/construtores, se existirem.
- `UPPER_SNAKE_CASE` para constantes.
- Nomes completos e legiveis.

Padroes recomendados:

- `get...` para leitura.
- `list...` para listas.
- `create...` para criacao.
- `update...` para atualizacao.
- `delete...` para remocao.
- `save...` para upsert/persistencia.
- `normalize...` para normalizacao.
- `assert...` para validacao que lanca erro.
- `build...` para montar payload/objeto.
- `serialize...` para serializacao.
- `parse...` para parsing.

### Erros

Use `buildHttpError` para erros controlados:

```js
throw buildHttpError(400, "Mensagem segura.", "codigo_estavel");
```

Nao retornar:

- Stack trace.
- Valor de secret.
- SQL completo.
- Token.
- Dados pessoais desnecessarios.

### JSON HTTP

Usar helper:

```js
json(res, statusCode, payload, extraHeaders);
```

Sucesso:

```json
{
  "ok": true
}
```

Erro:

```json
{
  "error": "Mensagem segura.",
  "errorCode": "codigo_estavel"
}
```

### Metodos HTTP

Toda API deve:

- Validar metodo.
- Retornar `405` quando nao permitido.
- Definir header `Allow`.

### Parse de Body

Para payload obrigatorio:

```js
parseJsonBody(req.body, { strict: true });
```

Para payload opcional:

```js
parseJsonBody(req.body, { fallback: {} });
```

### Validacao de Request

Endpoints publicos devem considerar:

- Content-Type.
- Tamanho de payload.
- Origem.
- Rate limit.

Usar `request-guard.cjs` quando aplicavel.

## 3. APIs

### Estrutura

`api/` deve conter wrappers finos.

Bom padrao:

```text
api/recurso.js
  -> valida metodo
  -> valida body/sessao/origem
  -> chama lib
  -> retorna JSON
```

Evitar:

- SQL direto no arquivo `api`.
- Regras extensas no endpoint.
- Repetir helpers de erro.
- Criar novo padrao de resposta.

### Admin

APIs admin devem passar por:

- Sessao admin.
- Permissao de usuario.
- Acesso comercial por plano/feature flag, quando aplicavel.

Arquivos principais:

- `lib/admin-api.cjs`
- `lib/admin-request.cjs`
- `lib/user-permissions.cjs`
- `lib/master-platform-store.cjs`

### Publico

APIs publicas devem ser conservadoras:

- Validar origem quando configurada.
- Limitar payload.
- Aplicar rate limit quando houver escrita.
- Evitar dados internos.

## 4. Stores

### Responsabilidade

Stores em `lib/` controlam:

- Persistencia.
- Normalizacao.
- Leitura/escrita do dominio.
- Fallback local.
- Integracao com Neon quando `DATABASE_URL` existe.

### Storage Mode

Padrao visto em varias stores:

```text
DATABASE_URL existe -> neon
NODE_ENV production sem DATABASE_URL -> disabled para dominios criticos
desenvolvimento sem DATABASE_URL -> file
```

Nao alterar esse comportamento sem revisao arquitetural.

### Banco

Regras:

- Nao alterar schema real sem migration documentada.
- Nao criar migration destrutiva sem backup e rollback.
- Nao remover coluna/tabela legada na mesma fase que cria substituta critica.
- Backfills devem ser idempotentes.

### Tenant

Estado atual:

- Monorestaurante.
- `restaurant_key = "default"`.
- Sem `restaurant_id`.
- Sem multi-restaurante real.

Regra:

- Nao criar `restaurant_id` fora do plano de tenant.
- Nao abrir dados por restaurante sem testes anti-vazamento.
- Toda preparacao futura deve seguir ADRs e migrations planejadas.

## 5. Permissoes, Planos e Flags

### Permissoes

Formato:

```text
<modulo>_<acao>
```

Acoes:

- `view`
- `create`
- `edit`
- `delete`

Tipos:

- `MASTER`
- `DESENVOLVEDOR`
- `OWNER`
- `CUSTOM`

### Planos

Planos comerciais atuais:

- START
- PRO
- PREMIUM

Permissao de usuario nao substitui permissao comercial. As duas precisam permitir a acao.

### Feature Flags

Flags indicam liberacao/preparacao de recurso. Nao devem ser usadas como atalho para ativar modulo incompleto.

## 6. Frontend Publico

Arquivos:

- `script.js`
- `styles.css`
- paginas HTML da raiz.

Regras:

- Preservar fluxo de carrinho, pedido, login de cliente e historico.
- Nao quebrar chaves de `localStorage` sem migracao.
- Nao renomear globais legados sem compatibilidade.
- Testar mobile, tablet e desktop.
- Evitar aumentar acoplamento de `script.js`; modularizacao futura deve ser planejada.

## 7. Admin UI

Arquivos:

- `admin/admin.js`
- `admin/admin.css`
- `admin/index.html`
- `admin/login.html`

Regras:

- Respeitar permissoes e plano.
- Manter estados de carregamento, vazio, erro e sucesso.
- Nao alterar layout visual sem tarefa de UI.
- Preservar seletores usados por validacoes.
- Evitar inserir regras de negocio apenas no frontend.

## 8. Master UI

Arquivos:

- `admin/master.js`
- `admin/master.html`
- `lib/master-platform-store.cjs`

Regras:

- Master e ferramenta de plataforma, nao bypass operacional.
- Dados comerciais e operacionais devem permanecer conceitualmente separados.
- Nao ativar billing, DNS real ou multi-restaurante sem projeto aprovado.

## 9. CSS

### Organizacao atual

- Publico: `styles.css`.
- Admin/Master: `admin/admin.css`.
- Restauracao especifica: `admin/orders-production-restore.css`.

### Regras

- Nao duplicar classe se ja existe padrao.
- Evitar estilos globais amplos.
- Preservar responsividade.
- Nao usar CSS para esconder bug de dados.
- Nao alterar visual em tarefa sem escopo de UI.
- Validar overflow horizontal quando mexer em layout.

## 10. HTML

Regras:

- Preservar metatags importantes.
- Preservar IDs/classes consumidos por JS.
- Nao remover atributos usados por scripts.
- Manter acessibilidade basica: labels, botoes reais, textos alternativos quando aplicavel.

## 11. Configuracao

Arquivos:

- `site.config.json`
- `site-config.js`
- `lib/app-branding.cjs`
- `maps-config.js`
- `vercel.json`
- `.env.example`

Regras:

- Validar JSON apos editar.
- Nao commitar valores reais em `.env.example`.
- Nao alterar `vercel.json` sem smoke test.
- Nao trocar chave Maps sem plano.
- Manter compatibilidade de identificadores legados.

## 12. Seguranca

Obrigatorio:

- Nao logar secrets.
- Nao exibir token no frontend.
- Nao incluir stack trace em erro publico.
- Validar origem em escrita publica.
- Usar cookies/sessoes existentes.
- Tratar dados pessoais com minimizacao.

Arquivos sensiveis:

- `.env`
- `.env.*`
- `.env*.local`
- `.data/`
- logs/dumps/backups.

## 13. Testes e Validacoes

Suite segura:

```powershell
npm.cmd run validate:business-hours
npm.cmd run validate:admin-local
npm.cmd run validate:permissions-local
npm.cmd run validate:master-panel-local
npm.cmd run validate:platform-integration-local
npm.cmd run validate:site-layouts-local
npm.cmd run validate:domains-local
npm.cmd run validate:plans-contracts-local
npm.cmd run validate:stage-3-ui-local
npm.cmd run validate:whatsapp
```

Sintaxe:

```powershell
node --check .\arquivo.js
node --check .\arquivo.cjs
node --check .\arquivo.mjs
```

JSON:

```powershell
node -e "for (const f of ['package.json','package-lock.json','site.config.json','vercel.json','site.webmanifest']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('JSON OK')"
```

Python:

```powershell
python -m py_compile .\scripts\apply-site-config.py
```

Git:

```powershell
git diff --check
```

## 14. Documentacao

Regras:

- Documentar decisao arquitetural em ADR.
- Documentar plano operacional em `INOVAS-FOOD-<TEMA>.md`.
- Nao dizer que algo existe se esta apenas planejado.
- Separar "atual", "preparado", "futuro" e "fora de escopo".
- Atualizar handbook/contributing/standards quando o processo mudar.

## 15. Commits

Formato:

```text
tipo: resumo curto
```

Tipos aceitos:

- `docs`
- `fix`
- `feat`
- `test`
- `refactor`
- `chore`
- `security`

Regras:

- Um objetivo por commit.
- Sem secrets.
- Sem temporarios.
- Sem diff fora do escopo.
- Mensagem clara.

## 16. Revisao de Codigo

Review deve priorizar:

- Bug ou regressao.
- Quebra de contrato.
- Falha de permissao.
- Falha de plano/feature flag.
- Risco de dado real.
- Risco de segredo.
- Falta de teste.
- Mudanca visual acidental.

## 17. Performance

Pontos de atencao:

- `script.js` e grande.
- `admin/admin.js` e grande.
- `styles.css` e `admin/admin.css` sao grandes.
- Imagens em `site-images/` e `menu_pdf_images/` podem ser pesadas.

Regras:

- Nao adicionar assets pesados sem compressao planejada.
- Preferir lazy loading quando fizer sentido.
- Evitar loops caros em renderizacao.
- Evitar chamadas repetidas sem cache/invalidation clara.

## 18. Compatibilidade Legada

Nao alterar sem plano:

- Dominio `tokyosushidelivery.com.br`.
- Cookies admin/cliente.
- Headers de cliente.
- Prefixo publico `TKY`.
- Globais `TOKYO_*`.
- `restaurant_key = "default"`.
- Rotas atuais de API.
- Layouts publico/admin.

## 19. Definition of Ready

Uma tarefa esta pronta para desenvolvimento quando:

- Objetivo esta claro.
- Escopo proibido esta claro.
- Arquivos provaveis foram identificados.
- Risco de dados/seguranca foi avaliado.
- Testes esperados foram definidos.
- Produto aprovou regra de negocio, se houver.

## 20. Definition of Done

Uma tarefa esta pronta para entrega quando:

- Codigo/documentacao cumpre o objetivo.
- Contratos existentes foram preservados.
- Validacoes relevantes passaram.
- Diff esta limpo.
- Nao ha secrets/temporarios.
- Documentacao foi atualizada.
- Risco residual foi comunicado.
