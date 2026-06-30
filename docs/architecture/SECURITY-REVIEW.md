# INOVAS FOOD - Revisao de Seguranca V2.0

Status: preparacao documental.
Escopo: revisao estatica, sem alterar regras, APIs, autenticacao, deploy, commit ou tag.

## 1. Situacao Atual

Controles ja existentes:

- `security-guardian.cjs` com rate limit, registro de eventos e bloqueios.
- `request-guard.cjs` para limites publicos.
- Cookies de sessao com `HttpOnly`.
- Separacao entre admin, cliente e publico.
- Regras backend para usuario do sistema e usuario de restaurante.
- OWNER isolado por restaurante.
- MASTER sem `restaurantKey`.
- Headers Vercel com `no-store` em admin, HSTS, `nosniff` e `referrer-policy`.
- Validadores testam chamadas diretas por API.

Nao foi confirmado exploit critico nesta revisao estatica. Os pontos abaixo sao riscos arquiteturais para V2.0.

## 2. Autenticacao e Sessao

Pontos fortes:

- Login admin centralizado.
- Sessao admin lida pelo backend.
- Usuario bloqueado deve ser impedido.
- Rate limit existe para login e rotas sensiveis.

Pontos de atencao:

- Existe suporte legado a credenciais por ambiente em `admin-auth.cjs`.
- Validadores precisam resetar rate limit em ambiente local, o que e correto para teste, mas deve permanecer bloqueado em producao.
- Sessao deve carregar `userType`, `tenantContext` e `restaurantName` sem fallback indevido.

Recomendacao:

- Documentar contrato de sessao para cada tipo de usuario.
- Garantir que usuario do sistema nunca receba restaurante obrigatorio.
- Garantir que usuario de restaurante nunca fique sem `tenantId/restaurantId/restaurantKey`.

## 3. Autorizacao e Escopo

Pontos fortes:

- Backend valida hierarquia.
- VENDEDOR, SUPORTE, SOCIO e MASTER ja possuem regras iniciais.
- OWNER nao gerencia usuarios de plataforma.
- Rotas master exigem acesso de plataforma.

Pontos de atencao:

- Rotas admin ainda passam por controller grande.
- Scopes nao estao declarados em manifesto unico.
- Alguns bloqueios retornam codigos novos e legados, o que validadores ja precisaram aceitar.
- Risco futuro de liberar menu no frontend sem backend correspondente.

Recomendacao:

- Criar manifesto de rotas com escopo obrigatorio.
- Gerar testes negativos automaticamente a partir do manifesto.
- Registrar `actor`, `scope`, `tenantId`, `restaurantId` e `route` em toda escrita.

## 4. CSRF

Situacao:

- Cookies de sessao ajudam, mas a revisao nao identificou uma camada explicita de token CSRF para escritas admin.

Risco:

- Se cookies forem enviados automaticamente em contexto indevido, escritas podem depender apenas de SameSite/origem.

Recomendacao:

- Adicionar estrategia futura de CSRF para rotas admin/customer com escrita.
- Validar `Origin` e `Referer` em producao para metodos mutaveis.
- Manter excecoes apenas para APIs publicas documentadas.

Prioridade: alta antes de multi-restaurante amplo.

## 5. XSS

Situacao:

- `admin/admin.js`, `admin/master.js` e `script.js` usam muitos `innerHTML` e `insertAdjacentHTML`.
- Existem funcoes de escape em varios fluxos, mas o volume de templates aumenta risco de um ponto esquecer escape.

Risco:

- Entrada de cliente, cardapio, review, nome de restaurante ou usuario pode virar HTML se algum template nao escapar corretamente.

Recomendacao:

- Padronizar render seguro de texto.
- Criar helper unico para templates ou componentes DOM.
- Criar teste automatizado com payloads XSS em campos publicos e admin.
- Evitar `innerHTML` para dados vindos de usuario quando possivel.

Prioridade: alta.

## 6. SQL Injection

Situacao:

- Uso de Neon tagged templates reduz risco em queries parametrizadas.
- Ainda e necessario auditar trechos dinamicos, ordenacao e filtros.

Recomendacao:

- Proibir interpolacao manual de SQL.
- Whitelist para colunas de ordenacao.
- Testes com payloads de busca/filtro.

Prioridade: media/alta.

## 7. Exposicao de Dados

Riscos:

- Usuario do sistema acessa dados globais; filtros por restaurante precisam ser claros.
- Usuario vendedor deve ver apenas carteira vinculada por `seller_id`.
- Fallback `default` em modo multi-restaurante pode expor dados do Tokyo por engano.
- Arquivos temporarios, prints e relatorios no workspace nao devem ir para deploy.
- Configuracao publica global nao pode conter segredo.

Recomendacao:

- Separar payloads publicos, admin restaurante e plataforma.
- Nunca retornar campos sensiveis de usuario.
- Criar auditoria automatica para arquivos temporarios antes de release.
- Revisar variaveis `.env*` e garantir que nao estejam publicadas.

## 8. Uploads e Assets

Situacao:

- A revisao nao encontrou fluxo amplo de upload binario no escopo principal.
- Assets sao servidos por arquivos estaticos.

Recomendacao futura:

- Se upload for adicionado, validar tipo real, tamanho, nome, antivirus/scan, storage isolado por tenant e URLs assinadas quando necessario.

## 9. Headers e CSP

Headers atuais incluem:

- HSTS.
- `X-Content-Type-Options: nosniff`.
- Referrer policy.
- Cache control para admin.

Recomendacao:

- Adicionar Content Security Policy progressiva.
- Avaliar `frame-ancestors 'none'` para admin.
- Definir politica de imagens/scripts compatibilizada com Vercel e assets.

## 10. Problemas, Prioridade e Risco

| Problema | Prioridade | Impacto | Risco |
| --- | --- | --- | --- |
| Sem manifesto unico de autorizacao | Alta | Auditoria dificil | Alto |
| Muitos `innerHTML` | Alta | XSS por escape ausente | Alto |
| CSRF explicito nao evidenciado | Alta | Escrita indevida | Medio/Alto |
| Fallback default em multi-tenant | Alta | Dados cruzados | Alto |
| Artefatos temporarios no workspace | Media | Vazamento acidental | Medio |
| CSP ainda nao documentada | Media | Mitigacao incompleta | Medio |

## 11. Recomendacao Final

Seguranca da V2.0 deve focar em tres contratos: escopo por rota, tenant obrigatorio e renderizacao segura. O backend ja bloqueia varias chamadas indevidas, mas a escala SaaS exige que as regras deixem de ficar espalhadas e passem a ser declarativas, auditaveis e testadas por matriz negativa.
