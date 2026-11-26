# INovas Food - Contributing Guide

Data: 2026-06-26

Escopo: guia de contribuicao. Este documento nao altera codigo, APIs, banco, layout, deploy ou regras de negocio.

## Principio Central

Toda contribuicao deve preservar a operacao atual do Cliente Modelo e manter a plataforma preparada para SaaS sem ativar funcionalidades futuras fora de hora.

Antes de contribuir, leia:

- `INOVAS-FOOD-DEVELOPER-HANDBOOK.md`
- `INOVAS-FOOD-CODING-STANDARDS.md`
- `INOVAS-FOOD-PLATFORM-STATUS.md`
- `INOVAS-FOOD-ROADMAP.md`
- `docs/adr/`

## Regras de Ouro

- Nao commitar secrets.
- Nao commitar `.tmp/`, `.codex-tools/`, `.data`, logs, dumps, backups ou caches.
- Nao alterar dominio real.
- Nao criar `restaurant_id` nesta fase.
- Nao criar multi-restaurante real.
- Nao alterar regras de negocio sem requisito explicito.
- Nao alterar layout visual em tarefas tecnicas.
- Nao tocar em dados reais.
- Nao rodar scripts destrutivos sem autorizacao formal, backup e rollback.

## Tipos de Contribuicao

### Documentacao

Use quando a mudanca for explicacao, plano, ADR, checklist ou guia operacional.

Padroes:

- Arquivos estrategicos na raiz: `INOVAS-FOOD-<TEMA>.md`.
- ADRs em `docs/adr/ADR-000-titulo.md`.
- Migrations planejadas em `migrations/`.

### Correcao

Use para bugfix pequeno e compatibilidade.

Obrigatorio:

- Explicar bug.
- Manter escopo minimo.
- Rodar validacoes relevantes.
- Informar risco residual.

### Modulo

Use para recurso aprovado no roadmap.

Obrigatorio:

- Definir dominio.
- Definir store.
- Definir API.
- Definir permissao.
- Definir plano/feature flag, se aplicavel.
- Criar validacao segura.
- Atualizar documentacao.

### Refatoracao

Use apenas quando reduzir risco real.

Regras:

- Nao misturar com feature.
- Nao mudar comportamento.
- Manter validacoes verdes.
- Documentar antes/depois.

## Fluxo de Trabalho

### 1. Criar Branch

Sugestoes:

```text
docs/<tema>
feature/<modulo>
fix/<problema>
test/<area>
hotfix/<incidente>
```

### 2. Entender Escopo

Antes de editar:

```powershell
git status --short
```

Verifique se ha mudancas de outras pessoas. Nao reverta trabalho alheio.

### 3. Implementar com Escopo Pequeno

Preferir:

- Uma mudanca por PR.
- Arquivos diretamente relacionados.
- Padroes existentes.
- Validacoes locais.

Evitar:

- Reformatar arquivo inteiro sem necessidade.
- Mover codigo junto com alteracao de comportamento.
- Alterar estilo visual sem requisito.
- Misturar limpeza tecnica com feature.

### 4. Validar

Suite segura recomendada:

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

Checks complementares:

```powershell
git diff --check
python -m py_compile .\scripts\apply-site-config.py
```

Para JS/CJS/MJS alterados:

```powershell
node --check .\caminho\arquivo.js
node --check .\caminho\arquivo.cjs
node --check .\caminho\arquivo.mjs
```

Para JSONs:

```powershell
node -e "for (const f of ['package.json','package-lock.json','site.config.json','vercel.json','site.webmanifest']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('JSON OK')"
```

### 5. Revisar o Diff

```powershell
git diff --stat
git diff --check
git status --short
```

Conferir:

- Arquivos inesperados.
- Secrets.
- Temporarios.
- Mudanca de dominio.
- Mudanca de banco.
- Mudanca de layout.
- Mudanca de regra de negocio.

### 6. Commit

Formato recomendado:

```text
tipo: resumo curto
```

Tipos:

- `docs`
- `fix`
- `feat`
- `test`
- `refactor`
- `chore`
- `security`

Exemplos:

```text
docs: add developer handbook
fix: preserve order status audit payload
test: add permissions validation
```

### 7. Pull Request

O PR deve conter:

- Objetivo.
- Arquivos principais.
- O que mudou.
- O que nao mudou.
- Testes executados.
- Riscos.
- Prints, quando houver UI.
- Observacao de env, banco ou deploy, quando aplicavel.

Modelo:

```markdown
## Objetivo

## Mudancas

## Fora de Escopo

## Testes

## Riscos

## Evidencias
```

## Checklist de PR

- [ ] Escopo esta claro.
- [ ] Nao ha secrets.
- [ ] Nao ha `.tmp/`, `.codex-tools/`, `.data`, logs, dumps ou backups.
- [ ] Nao ha alteracao de dominio.
- [ ] Nao ha multi-restaurante real.
- [ ] Nao ha `restaurant_id` novo.
- [ ] Nao ha alteracao visual acidental.
- [ ] APIs preservam contrato existente.
- [ ] Erros retornam `error` e `errorCode`.
- [ ] Permissoes foram consideradas.
- [ ] Planos/feature flags foram considerados.
- [ ] Validacoes relevantes foram executadas.
- [ ] Documentacao foi atualizada quando necessario.

## Contribuindo em Areas Criticas

### Pedidos

Arquivos comuns:

- `api/orders/create.js`
- `lib/order-store.cjs`
- `lib/order-payload.cjs`
- `lib/business-hours.cjs`
- `script.js`

Cuidados:

- Nao quebrar idempotencia.
- Nao mudar prefixo publico sem plano.
- Nao remover eventos de status.
- Validar horario de funcionamento.

### Admin/Gestor

Arquivos comuns:

- `admin/admin.js`
- `admin/admin.css`
- `lib/admin-api.cjs`
- Stores de dominio.

Cuidados:

- Respeitar sessao admin.
- Respeitar permissoes.
- Respeitar plano/feature flag.
- Testar estados de erro.

### Master

Arquivos comuns:

- `admin/master.js`
- `admin/master.html`
- `lib/master-platform-store.cjs`
- `lib/admin-api.cjs`

Cuidados:

- Nao confundir preparacao de plataforma com multi-restaurante real.
- Nao criar cobranca real sem projeto aprovado.
- Nao alterar contratos sem versionamento.

### Configuracoes e Branding

Arquivos comuns:

- `site.config.json`
- `site-config.js`
- `lib/app-branding.cjs`
- `scripts/apply-site-config.py`
- `lib/restaurant-settings-store.cjs`

Cuidados:

- Preservar fallbacks atuais.
- Nao quebrar marca/dominio do Cliente Modelo.
- Validar JSON.

### Seguranca

Cuidados:

- Nao logar secrets.
- Nao expor stack traces.
- Nao retornar detalhes internos em erro publico.
- Validar origem e payload em endpoints publicos.
- Usar cookies/sessoes existentes.

## Quando Criar ADR

Criar ADR quando houver:

- Nova decisao arquitetural.
- Mudanca de persistencia.
- Mudanca de autenticacao.
- Mudanca de modelo de permissao.
- Mudanca de tenant.
- Mudanca de rollback/migracao.
- Nova dependencia critica.

## Quando Atualizar Roadmap

Atualizar roadmap quando:

- Um modulo muda de fase.
- Uma dependencia vira bloqueio.
- Uma funcionalidade sai do escopo.
- Um risco muda prioridade.

## Quando Nao Contribuir Ainda

Pausar e pedir alinhamento quando a mudanca exigir:

- Multi-restaurante real.
- `restaurant_id`.
- Dados reais.
- Deploy.
- Banco de producao.
- Dominio real.
- Gateway de pagamento.
- Contrato comercial real.
- Alteracao visual ampla.

## Definition of Done

Uma contribuicao esta pronta quando:

- Resolve o objetivo.
- Mantem compatibilidade.
- Tem validacao proporcional ao risco.
- Nao introduz segredo/temporario.
- Nao altera escopo proibido.
- Documenta o que for relevante.
- Pode ser revertida com baixo risco.
