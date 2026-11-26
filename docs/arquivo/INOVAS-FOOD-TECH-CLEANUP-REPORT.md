# INovas Food - Tech Cleanup Report

Data: 2026-06-25

Escopo: rodada grande de limpeza tecnica segura antes dos modulos V1.5/V2.

Restricoes respeitadas:

- Sem deploy.
- Sem alteracao de dominio.
- Sem multi-restaurante.
- Sem `restaurant_id`.
- Sem mudanca de regra de negocio.
- Sem alteracao de layout visual.
- Sem alteracao de dados reais.
- Sem remocao fisica de arquivos rastreados.
- Sem criacao de funcionalidade nova.

## 1. Arquivos removidos do rastreamento do Git

Foi executado com seguranca:

```bash
git rm --cached -r -- .tmp .codex-tools
```

Resultado:

- `.tmp/` saiu do indice Git.
- `.codex-tools/` saiu do indice Git.
- Os arquivos continuam no disco local.
- Nenhum arquivo foi apagado fisicamente.

Motivo:

- `.tmp/` contem evidencias visuais, logs, comparacoes temporarias, env temporario e outputs de validacao.
- `.codex-tools/` contem runtime/tooling local, incluindo binarios.
- Ambos ja estavam ou passaram a estar cobertos por `.gitignore`.

Confirmacao apos limpeza:

- `git ls-files --stage -- .tmp .codex-tools __pycache__ '*.pyc' '*.log' '*.dump' '*.bak' '*.backup' '*.tmp' '*.temp' '_tmp*'` retornou 0 entradas.

## 2. Arquivos mantidos

Foram mantidos:

- Todos os arquivos de codigo-fonte.
- Todos os assets reais.
- Todos os documentos criados nas auditorias anteriores.
- Todos os arquivos locais ignorados no disco.
- `.env.production.local` no disco local, sem exibir conteudo.
- Arquivos `_tmp*` e `_tmp_chunks/` no disco local, por estarem ignorados e potencialmente uteis como evidencias locais.

Nao foram removidos:

- Imagens pesadas.
- Arquivos JS/CSS grandes.
- Placeholders de UI.
- Mocks de validacao.
- Codigo legacy de compatibilidade.
- Arquivos rastreados de produto/arquitetura.

## 3. Riscos de secrets encontrados

Nenhum valor sensivel foi exibido nesta auditoria.

### `.env.example`

Status:

- Rastreado.
- Contem variaveis sensiveis apenas como placeholders/valores vazios.
- Nao foi detectado valor real no exemplo durante a varredura.

Variaveis sensiveis presentes como exemplo:

- `WHATSAPP_ACCESS_TOKEN`
- `DATABASE_URL`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `CUSTOMER_SESSION_SECRET`

### `.env.production.local`

Status:

- Existe localmente.
- Esta protegido por `.gitignore`.
- Nao esta rastreado pelo Git.
- Contem nomes de variaveis sensiveis, como esperado para arquivo local.
- Valores nao foram exibidos.

### Arquivos temporarios

Risco encontrado e tratado:

- `.tmp/prod-current.env` estava no indice Git antes da limpeza.
- Foi removido do rastreamento junto com `.tmp/`.
- O arquivo permanece no disco local, mas agora fica ignorado.

Risco local documentado:

- `_tmp_chunks/` contem arquivo local ignorado com padrao textual sensivel detectado.
- Nao esta rastreado.
- Nao foi exibido valor.
- Recomenda-se limpar evidencias locais antigas manualmente quando nao forem mais necessarias.

### `.gitignore`

Foi reforcado com:

- `.tmp/`
- `.codex-tools/`
- `__pycache__/`
- `*.pyc`
- `*.log`
- `*.dump`
- `*.bak`
- `*.backup`
- `*.tmp`
- `*.temp`
- `.env`
- `.env.*`
- `!.env.example`

Observacao: `.env*.local` ja continua protegido.

## 4. Situacao da chave Google Maps

Arquivo auditado:

- `maps-config.js`

Situacao:

- Existe uma chave publica literal do Google Maps no arquivo.
- O funcionamento atual foi preservado.
- A chave nao foi trocada.
- Nenhuma configuracao externa foi alterada.

Risco:

- Chave client-side pode ser aceitavel quando restrita corretamente.
- Sem restricao por dominio/referrer/API no Google Cloud, pode gerar abuso e custo.

Obrigatorio antes de producao:

- Restringir por HTTP referrer no Google Cloud.
- Restringir por APIs necessarias.
- Monitorar uso/cota.

Dominios que devem ser permitidos:

- `tokyosushidelivery.com.br`
- `www.tokyosushidelivery.com.br`, se continuar como alias.
- `inovasfood.com.br`
- `www.inovasfood.com.br`, se for usado.
- Dominios dos clientes futuramente, somente quando houver onboarding/dominio real.

Nao fazer agora:

- Nao trocar a chave.
- Nao remover Maps.
- Nao alterar dominio.

## 5. Imagens pesadas encontradas

Top imagens por tamanho:

| Arquivo | Tamanho | Possivel uso | Recomendacao |
| --- | ---: | --- | --- |
| `site-images/teppan-camarao.png` | 19.34 MB | Site publico/cardapio/assets runtime | Converter para WebP/AVIF e gerar tamanhos responsivos. |
| `menu_pdf_images/catalog/teppan-camarao.png` | 19.34 MB | Catalogo importado/evidencia de cardapio | Manter por enquanto; otimizar se for servido em producao. |
| `site-images/temaki-hot.png` | 12.27 MB | Site publico/cardapio/assets runtime | Converter para WebP/AVIF e thumbnail. |
| `menu_pdf_images/catalog/temaki-hot.png` | 12.27 MB | Catalogo importado/evidencia de cardapio | Manter por enquanto; revisar duplicacao futura. |
| `assets/login-cover.png` | 3.17 MB | Branding/login/admin | Comprimir e gerar versao web otimizada. |
| `assets/tokyo-poster-reference.png` | 3.17 MB | Referencia/branding | Avaliar se precisa ir para producao. |
| `site-images/login-cover-floating.png` | 2.57 MB | Site/login/publico | Comprimir. |
| `assets/login-cover-floating.png` | 2.57 MB | Branding/login/admin | Comprimir. |
| `assets/login-cover-v2.png` | 2.51 MB | Branding/login/admin | Comprimir. |
| `assets/login-window-reference.png` | 2.38 MB | Referencia visual | Avaliar se deve permanecer em assets de producao. |
| `menu_pdf_crops/page_12_binary.jpg` | 2.29 MB | Evidencia/corte local do menu PDF | Considerar mover para evidencias ignoradas no futuro. |
| `site-images/support-avatar-duo.png` | 2.27 MB | Site publico/suporte | Usar WebP ja existente quando possivel. |

Resumo:

- 169 imagens auditadas em `site-images/`, `menu_pdf_images/`, `assets/` e `menu_pdf_crops/`.
- Tamanho total aproximado: 143.71 MB.

Plano futuro:

- Criar pipeline de compressao.
- Gerar WebP/AVIF.
- Criar thumbnails.
- Usar `srcset`/tamanhos responsivos.
- Manter lazy loading.
- Separar evidencias locais de assets de producao.
- Avaliar CDN/storage para midia de catalogo.

Nada foi apagado ou substituido nesta etapa.

## 6. Arquivos grandes encontrados

Principais arquivos JS/CSS:

| Arquivo | Tamanho | Responsabilidades principais | Sugestao | Risco de refatoracao |
| --- | ---: | --- | --- | --- |
| `admin/admin.js` | 509.6 KB | Gestor, modulos admin, estado, renderizacao, eventos, login | Separar por modulos admin | Alto |
| `script.js` | 429.2 KB | Site publico, catalogo, carrinho, login cliente, entrega, reviews, historico, Maps | Separar por dominios publicos | Alto |
| `admin/admin.css` | 344.0 KB | Estilos do gestor e modulos administrativos | Dividir por modulos/tokens | Alto |
| `styles.css` | 151.4 KB | Estilos publicos | Dividir depois da V1 ou por paginas | Medio |
| `admin/orders-production-restore.css` | 103.9 KB | Restauracao/historico visual de pedidos | Manter ate decisao formal | Medio |
| `lib/order-store.cjs` | 100.1 KB | Pedidos, dashboard, auditoria, detalhes, Neon/file | Separar queries e agregacoes | Alto |
| `lib/catalog-store.cjs` | 68.1 KB | Catalogo, promocoes, extracao de dados, persistencia | Separar catalogo base da UI | Alto |
| `lib/admin-api.cjs` | 48.0 KB | Roteador admin central | Reduzir por grupos futuramente | Medio-alto |

Nao foi feita modularizacao nesta etapa para evitar regressao visual/funcional.

## 7. Codigo morto/placeholders encontrados

Busca executada por:

- `TODO`
- `FIXME`
- `HACK`
- `XXX`
- `placeholder`
- `mock`
- `legacy`
- `deprecated`
- `debugger`

Classificacao:

### Seguro remover agora

- Nenhum item foi classificado como 100% seguro para remocao imediata.

### Manter por compatibilidade

- Referencias `legacy` em auth/admin/users/order status.
- Cookies, headers, storage e prefixos Tokyo.
- `restaurant_key = "default"`.
- Mocks de validacao local.
- Placeholders visuais de inputs.
- Placeholders CSS de linhas reservadas em cards de pedidos.

### Revisar depois

- `admin/orders-production-restore.css`.
- Referencias legadas Tokyo em validacoes antigas.
- `_tmp_chunks/` e evidencias locais ignoradas.
- `menu_pdf_crops/` se nao for necessario versionar evidencias.
- `lib/whatsapp-cloud.cjs` possui fallback de logger com `console.log`; manter por enquanto, mas futuramente pode ir para logger estruturado.

Nenhum codigo foi removido.

## 8. O que foi corrigido

Correcoes seguras executadas:

1. Remocao de `.tmp/` do rastreamento do Git, preservando arquivos no disco.
2. Remocao de `.codex-tools/` do rastreamento do Git, preservando arquivos no disco.
3. Reforco do `.gitignore` para temporarios, logs, dumps, backups e arquivos `.env`.
4. Confirmacao de que `.env.example` permanece permitido como exemplo rastreavel.
5. Confirmacao de que nao restaram arquivos temporarios rastreados nos padroes auditados.

Nao houve:

- Deploy.
- Mudanca de dominio.
- Mudanca de layout.
- Mudanca de regra de negocio.
- Mudanca de API.
- Remocao fisica de arquivos.
- Alteracao de dados reais.

## 9. O que ficou para depois

Pendencias recomendadas:

- Otimizar imagens pesadas.
- Confirmar restricoes reais da chave Google Maps no Google Cloud.
- Criar pipeline de compressao de assets.
- Separar `script.js` por dominios.
- Separar `admin/admin.js` por modulos.
- Separar CSS admin gradualmente.
- Criar logger estruturado.
- Criar secret scanning automatizado pre-push.
- Avaliar limpeza manual de evidencias locais antigas ignoradas.
- Criar politica formal de evidencias visuais.
- Implementar migrations versionadas antes de mudar schema.
- Criar `TenantContext` somente no momento planejado, ainda sem multi-restaurante real.

## 10. Validacoes executadas

Todas as validacoes seguras solicitadas passaram:

| Validacao | Resultado |
| --- | --- |
| `npm.cmd run validate:business-hours` | OK |
| `npm.cmd run validate:admin-local` | OK |
| `npm.cmd run validate:permissions-local` | OK |
| `npm.cmd run validate:master-panel-local` | OK |
| `npm.cmd run validate:platform-integration-local` | OK |
| `npm.cmd run validate:site-layouts-local` | OK |
| `npm.cmd run validate:domains-local` | OK |
| `npm.cmd run validate:plans-contracts-local` | OK |
| `npm.cmd run validate:stage-3-ui-local` | OK |
| `npm.cmd run validate:whatsapp` | OK |

Observacao sobre WhatsApp:

- A validacao registrou eventos simulados/esperados de sucesso, rejeicao de provedor e falha de rede.
- Telefones apareceram mascarados nos logs.
- Nenhum valor secreto foi exposto no relatorio.

Checks estaticos:

| Check | Resultado |
| --- | --- |
| `node --check` em 50 arquivos JS/CJS/MJS alterados | OK |
| `JSON.parse` em `package.json` | OK |
| `JSON.parse` em `package-lock.json` | OK |
| `JSON.parse` em `site.config.json` | OK |
| `JSON.parse` em `vercel.json` | OK |
| `JSON.parse` em `site.webmanifest` | OK |
| `python -m py_compile scripts/apply-site-config.py` | OK |
| `git diff --check` | OK, com avisos LF -> CRLF |
| `git diff --cached --check` | OK |

## 11. Resultado final

Resultado: limpeza tecnica segura concluida.

Estado final:

- Temporarios `.tmp/` e `.codex-tools/` foram removidos do rastreamento.
- `.gitignore` foi reforcado.
- Nenhum arquivo util foi apagado do disco.
- Nenhum codigo de produto foi alterado.
- Nenhuma funcionalidade foi criada.
- Nenhuma regra de negocio foi alterada.
- Todas as validacoes solicitadas passaram.

Conclusao:

A plataforma esta mais limpa para continuar a evolucao V1.5/V2. O maior ganho imediato foi reduzir risco de commit acidental de artefatos locais e arquivos sensiveis temporarios. As maiores dividas restantes sao performance de imagens, monolitos JS/CSS, governanca da chave Google Maps e futura modularizacao com testes.
