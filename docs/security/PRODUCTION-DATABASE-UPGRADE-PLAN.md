# Planejamento da atualizacao do banco Production

Data da auditoria: 2026-07-31 (America/Sao_Paulo)  
Commit de referencia: `a0005bb6830911154187a497c715c288f262096a`  
Escopo: inventario, diff e diagnosticos somente leitura. Nenhuma migration,
role, variavel, deploy, clone, DDL ou DML foi executado em Production.

## Decisao executiva

**GO para criar um clone descartavel e executar o dry run fora de Production.**

**NO GO para executar a cadeia em Production no estado atual.** O NO GO nao e
uma solicitacao de autorizacao. Ele permanece ate o dry run reproduzivel,
rollback por restauracao de branch, ledger/hashes e role limitada passarem nos
gates definidos neste documento.

Os diagnosticos somente leitura nao encontraram colisao nos backfills de
identidade, membership ou rota. A base e pequena e as 15 tabelas legadas de
Production sao estruturalmente iguais as mesmas 15 tabelas no Preview. A
lacuna real comeca em 014 e termina em 022.

Bloqueadores atuais para Production:

1. `014_extend_admin_users_creation_experience.md` contem SQL, mas nao e um
   artefato `.sql` executavel e imutavel.
2. Nao existe ledger de migrations em Production nem no Preview. As migrations
   015 e 016 sao repetiveis apenas no proprio estagio; reaplica-las fora de
   ordem regride policies instaladas por 018-021.
3. O rollback 015 desabilita RLS, mas deixa as policies legadas e `pgcrypto` no
   catalogo; o rollback 016 e explicitamente parcial. O rollback SQL atual nao
   restaura o catalogo original.
4. `DATABASE_URL` de Production ainda conecta como `neondb_owner`, com
   `BYPASSRLS`, `CREATEROLE`, `CREATEDB` e `REPLICATION`. A role
   `inovas_app_prod` nao existe.
5. A cadeia 014-022 ainda nao foi executada do zero em clone atual de
   Production e validada com a role `inovas_app_prod_test`.
6. O Preview tem seis indices unicos adicionais nas tabelas do Caixa que nao
   sao criados pelo arquivo 022 atual. Eles duplicam seis constraints `UNIQUE`
   e sao drift historico; o dry run deve comprovar o catalogo esperado de uma
   instalacao limpa (27 indices no Caixa), ou uma migration de reconciliacao
   deve ser aprovada.

## Evidencia e limites da auditoria

As consultas foram executadas numa transacao
`REPEATABLE READ READ ONLY`. Nenhum valor de login, e-mail, identificador de
tenant/restaurante, payload JSON ou credencial foi retornado. O arquivo
reutilizavel e [audit-production-upgrade-readonly.sql](../../scripts/audit-production-upgrade-readonly.sql).

Foram lidos os catalogos `pg_class`, `pg_constraint`, `pg_indexes`,
`pg_policies`, `pg_roles`, `pg_extension`, `pg_proc` e
`information_schema`. O diff entre bancos comparou nomes, tipos, nulabilidade,
defaults, constraints, indices, RLS, policies, ownership, grants, extensoes,
funcoes e triggers.

## Estado estrutural confirmado

| Item | Preview | Production | Resultado |
| --- | ---: | ---: | --- |
| Tabelas publicas | 44 | 15 | 29 ausentes em Production |
| Colunas publicas | 579 | 213 | 366 pertencem as 29 tabelas novas; 16 faltam em `admin_users` |
| Constraints | 134 | 11 | As 11 das tabelas comuns sao iguais; 123 pertencem as tabelas novas |
| Indices | 138 | 63 | Nas tabelas comuns faltam apenas 2 indices de `admin_users` |
| Tabelas com RLS + FORCE | 44 | 0 | Divergencia critica |
| Policies | 97 | 0 | Divergencia critica |
| Sequences | 0 | 0 | Igual |
| Views/materialized views | 0/0 | 0/0 | Igual |
| Triggers | 0 | 0 | Igual |
| Funcoes publicas | 36 | 0 | As 36 do Preview pertencem a `pgcrypto`; nenhuma e `SECURITY DEFINER` |
| Extensoes | `plpgsql`, `pgcrypto` | `plpgsql` | 015 instala `pgcrypto` |
| Ownership | 44 objetos por `neondb_owner` | 15 objetos por `neondb_owner` | Runtime nao deve ser owner |
| Role limitada | `inovas_app_preview`, `NOBYPASSRLS` | ausente | Criar somente no clone durante o dry run |
| Ledger de migrations | ausente | ausente | Deve ser resolvido antes de Production |

Grants do Preview para a role limitada: `SELECT` em 31 tabelas, `INSERT` em
32, `UPDATE` em 23 e `DELETE` em 6. Ela nao tem ownership, membership,
`CREATE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` ou atributos administrativos.
Production concede todos os privilegios das 15 tabelas somente ao owner e o
usa no runtime.

### Objetos ausentes em Production

- Seguranca/identidade (015): `identities`, `system_principals`,
  `system_role_bindings`, `restaurant_memberships`,
  `restaurant_role_bindings`, `permission_definitions`, `role_definitions`,
  `role_permission_bindings`, `permission_overrides`, `auth_sessions`,
  `invitations`, `password_reset_tokens`, `system_support_sessions`,
  `user_audit_events`, `platform_health_snapshots`, `platform_usage_daily`,
  `integration_health`, `tenant_health_scores`, `system_alerts`.
- Roteamento (016): `public_restaurant_routes`.
- Caixa/Salao (022): `dining_tables`, `cash_register_sessions`, `dining_tabs`,
  `dining_tab_items`, `dining_order_batches`, `cash_payment_sets`,
  `cash_payments`, `cash_register_movements`,
  `cash_register_audit_events`.

### Colunas ausentes em `admin_users`

Migration 014: `job_title`, `credential_mode`, `must_change_password`,
`created_by`, `invitation_token_hash`, `invitation_expires_at`,
`invitation_created_at`, `invitation_sent_at`, `invitation_used_at` e
`audit_json`.

Migration 015: `base_role`, `grant_overrides_json`, `deny_overrides_json` e
`profile_version`.

Migration 017: `department` e `internal_note`.

Nao ha tabela, coluna ou constraint exclusiva de Production. Nao ha divergencia
de tipo, default ou nulabilidade nas tabelas comuns.

## Inventario completo das migrations

### Ordem, dependencias e objetos

| # | Artefato | Natureza e dependencia real | Tabelas/colunas/constraints/indices | Roles, permissoes, RLS, funcoes, triggers e seeds | Preview | Production |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | `create_organizations.md` | Conceitual, nao executavel; depende de ADR e seed futuro | Planeja `organizations`; nenhum SQL/objeto atual | Nenhum | Documento | Documento |
| 002 | `create_restaurants.md` | Conceitual; depende de 001 | Planeja `restaurants` | Seed futuro do restaurante default | Documento | Documento |
| 003 | `create_restaurant_domains.md` | Conceitual; depende de 002 | Planeja `restaurant_domains` | Seed futuro de dominio | Documento | Documento |
| 004 | `create_restaurant_plans_contracts.md` | Conceitual; depende de 001/002 | Planeja planos, contratos e assinaturas | Regras comerciais futuras | Documento | Documento |
| 005 | `create_users_and_restaurant_users.md` | Conceitual; depende de 001/002 | Planeja `users` e vinculos | Identidade global futura | Documento | Documento |
| 006 | `split_restaurant_settings_branding_delivery_integrations.md` | Conceitual; depende de 002 | Planeja separar settings, branding, delivery e integracoes | Nenhum SQL atual | Documento | Documento |
| 007 | `prepare_catalog_scope.md` | Conceitual; depende de 002 | Planeja escopo de catalogo | Nenhum SQL atual | Documento | Documento |
| 008 | `prepare_orders_scope.md` | Conceitual; depende de 002 e ADRs | Planeja escopo de pedidos | Backfill default apenas planejado | Documento | Documento |
| 009 | `prepare_customers_reviews_scope.md` | Conceitual; depende de 008 | Planeja clientes, CRM e avaliacoes | Nenhum SQL atual | Documento | Documento |
| 010 | `prepare_finance_inventory_scope.md` | Conceitual; depende de 002 | Planeja financeiro e estoque | Nao define baixa por ingrediente | Documento | Documento |
| 011 | `prepare_reports_feature_flags_audit_scope.md` | Conceitual; depende dos escopos anteriores | Planeja relatorios, flags e auditoria | Nenhum SQL atual | Documento | Documento |
| 012 | `cutover_default_tenant_context.md` | Conceitual; depende de 001-011 e suite anti-vazamento | Planeja cutover do tenant default | Nenhum SQL atual | Documento | Documento |
| 013 | `prepare_physical_tenant_persistence.md` | SQL de referencia dentro de Markdown; nao executavel automaticamente | Altera 13 tabelas operacionais; adiciona escopo, backfill default e 15 indices compostos; troca uniques globais por compostas | Sem role, permissao, RLS, funcao ou trigger | Efeito semantico presente | Efeito semantico presente; **nao executar** |
| 014 | `extend_admin_users_creation_experience.md` | SQL dentro de Markdown; depende de `admin_users` e preflight de e-mail normalizado | 10 colunas e `admin_users_email_lower_uidx` | Sem role/RLS; defaults e metadados de convite; nenhuma linha legada e alterada semanticamente | Presente | Ausente |
| 015 | `system_restaurant_security_boundary.sql` | Executavel; depende de 014 materializada, `admin_users`, 13 tabelas operacionais e `pgcrypto` instalavel | 19 tabelas, 188 colunas nelas, 69 constraints (19 PK, 22 FK, 21 CHECK, 7 UNIQUE), 37 indices; adiciona 4 colunas de permissao em `admin_users` apos 014 | Cria catalogo de 34 permissoes e 20 roles de aplicacao; seeds de identities/principals/memberships/bindings; RLS+FORCE em 34 tabelas e 86 policies ao final do estagio; instala `pgcrypto`; sem trigger/funcao propria | Presente | Ausente |
| 016 | `public_routing_and_provisioning_boundary.sql` | Executavel; depende de 015 e dos JSONs legados validos | 1 tabela, 12 colunas, 2 constraints e 3 indices | Seed/upsert de rotas; 2 policies novas; substitui policies operacionais/admin para `provisioning`; sem role/funcao/trigger | Presente | Ausente |
| 017 | `user_profile_metadata.sql` | Executavel; depende de `admin_users` | 2 colunas e `admin_users_department_idx` | Sem seed/RLS/role/funcao/trigger | Presente | Ausente |
| 018 | `user_session_lifecycle.sql` | Executavel; depende de `auth_sessions` de 015 | Sem tabela/coluna/indice | Substitui 1 policy de sessao para revogacao e suporte | Presente | Ausente |
| 019 | `tenant_identity_administration.sql` | Executavel; depende de identities/memberships de 015 | Sem tabela/coluna/indice | Substitui 4 policies de identities para administracao tenant/provisioning | Presente | Ausente |
| 020 | `support_view_least_privilege.sql` | Executavel; depende de 015, 018 e 019 | Sem tabela/coluna/indice | Substitui 12 policies em users, memberships, bindings, sessions e audit; Support VIEW fica read-only | Presente | Ausente |
| 021 | `authentication_identity_lookup.sql` | Executavel; depende de 020 | Sem tabela/coluna/indice | Substitui 1 policy SELECT de `admin_users` para lookup exato do login normalizado | Presente | Ausente |
| 022 | `cash_register_dining_room.sql` | Executavel; depende de `orders`, `permission_definitions`, `role_definitions`, `role_permission_bindings` e 015-021 | 9 tabelas, 150 colunas, 52 constraints (9 PK, 13 FK, 24 CHECK, 6 UNIQUE); arquivo cria 12 indices explicitos, total limpo esperado de 27 indices | 12 permissoes e 53 bindings para 6 roles; RLS+FORCE e 9 policies; sem funcao/trigger; nao faz backfill de pedidos nem estoque | Presente, com 6 indices historicos extras | Ausente |

### Idempotencia, rollback e risco

| # | Idempotencia | Rollback | Classificacao |
| --- | --- | --- | --- |
| 001-012 | Nao se aplica; documentos | Nao se aplica | **Nao aplicavel** a esta atualizacao |
| 013 | O exemplo usa guards, mas nao e artefato executavel; Production ja possui o efeito | O Markdown descreve reversao destrutiva de escopo | **Nao aplicavel / nao executar**; usar apenas como gate de paridade |
| 014 | `ADD COLUMN IF NOT EXISTS` e `CREATE UNIQUE INDEX IF NOT EXISTS`; exige zero duplicidade | Remove indice e 10 colunas; perde metadados novos | **Requer preparacao** e janela curta |
| 015 | Repetivel no proprio estagio; inserts usam `ON CONFLICT`. Nao e seguro reaplicar depois de 016-021 porque regride policies | Destrutivo; deixa policies legadas e `pgcrypto`; nao restaura o catalogo inicial | **Requer janela e backup restauravel**; maior risco da cadeia |
| 016 | Repetivel no proprio estagio; upserts por chave. Fora de ordem regride policies | Parcial: remove a tabela, mas manda reaplicar 015 para policies | **Requer janela/preparacao** |
| 017 | Repetivel | Remove indice/colunas e respectivos dados | **Seguro online tecnicamente**, executar na janela |
| 018-021 | Repetiveis no proprio estagio por `DROP/CREATE POLICY` | Restauram a versao imediatamente anterior das policies | **Seguro online tecnicamente**, mas ordem estrita e janela coordenada |
| 022 | Repetivel se o schema existente for compativel; `IF NOT EXISTS` pode mascarar drift | Exclui permissions/bindings/overrides e derruba as 9 tabelas, perdendo dados de Caixa | **Aditiva/online apos dependencias**, executar na janela; rollback por restore |

## Cadeia minima real

Nao executar 001-013 por numeracao. A cadeia reproduzivel para o clone e:

1. Gate de paridade 013: confirmar novamente que as 15 tabelas comuns nao tem
   colunas/constraints divergentes e que os 15 indices compostos esperados por
   013 existem semanticamente. Resultado atual: aprovado. Nove usam exatamente
   os nomes do Markdown e seis usam nomes posteriores, mas com as mesmas
   colunas, ordem e unicidade; executar 013 criaria indices redundantes.
2. Materializar, revisar e versionar o bloco forward de 014 como
   `migrations/014_extend_admin_users_creation_experience.sql`, sem alterar o
   conteudo funcional. Registrar SHA-256.
3. Aplicar 014.
4. Aplicar 015.
5. Aplicar 016.
6. Aplicar 017, 018, 019, 020 e 021, nessa ordem.
7. Aplicar 022.
8. Configurar a role PostgreSQL limitada com
   `scripts/configure-runtime-database-role.mjs`.
9. Validar com `scripts/validate-runtime-database-role.mjs`,
   `scripts/manage-cash-register-preview.mjs validate` e `validate-rls`.
10. Implantar o commit de referencia num deploy Preview apontado exclusivamente
    para o clone e executar o E2E.

Para compatibilidade apenas de forward schema, 015 tambem adiciona as dez
colunas de 014. Isso nao torna 014 dispensavel: 015 nao cria
`admin_users_email_lower_uidx`, e seu rollback deliberadamente preserva as
colunas de 014.

O dry run deve registrar cada arquivo e SHA num ledger. Uma migration anterior
ja registrada nunca deve ser reaplicada; a idempotencia deve ser testada
imediatamente apos cada migration, antes de seguir para a proxima.

## Diagnostico de dados legados

### Volumes

| Tabela | Linhas |
| --- | ---: |
| `admin_users` | 2 |
| `catalog_item_overrides` | 1 |
| `catalog_promotions` | 0 |
| `catalog_runtime_state` | 1 |
| `customer_crm_profiles` | 0 |
| `customer_reviews` | 1 |
| `customers` | 27 |
| `delivery_settings` | 0 |
| `finance_closings` | 0 |
| `inventory_runtime_state` | 1 |
| `master_platform_state` | 0 |
| `order_items` | 68 |
| `order_status_events` | 166 |
| `orders` | 36 |
| `restaurant_settings` | 0 |

Total: 303 linhas. A maior tabela fisica tem menos de 0,4 MiB. O risco e de
comportamento/RLS e lock de catalogo, nao de duracao de backfill.

### Compatibilidade confirmada

- 13 tabelas operacionais com dados: zero escopo nulo ou vazio e um unico
  escopo de restaurante. O unico escopo vazio esta no usuario System, como
  esperado pelo modelo 015.
- 2 usuarios: zero login/e-mail vazio, zero colisao case-insensitive, zero
  colisao de identity, principal ou membership, zero status rejeitado e zero
  role desconhecida.
- Resultado projetado de 015: 2 identities, 1 system principal e 1 restaurant
  membership.
- 36 pedidos, 68 itens e 166 eventos: zero orfao e zero divergencia de escopo
  entre pai e filho.
- Pedidos/clientes: zero FK orfa e zero divergencia de escopo.
- `master_platform_state` esta vazio. A 016 devera derivar a rota publica do
  usuario de restaurante; nao ha colisao de chave/slug/dominio no estado atual.
- Existe 1 review com `customer_key` sem correspondencia em `customers`. Nao ha
  FK para esse relacionamento, a cadeia nao o altera e ele deve ser preservado.
  Nao criar cliente, mesclar review ou apagar o registro automaticamente.

## Plano de backfill

1. **014 - expandir sem reinterpretar dados:** adicionar colunas com defaults ou
   `NULL`; nao preencher cargo, departamento, convite ou auditoria por
   inferencia.
2. **015 - identidade:** criar IDs deterministicos a partir do login/e-mail
   normalizado, preservando hash de senha, nome, status e timestamps. Abort gate
   se qualquer consulta de duplicidade retornar mais de zero.
3. **015 - dominio:** criar principal System para usuario System e membership
   para usuario de restaurante. Nao usar sessao MASTER/SYSTEM para operar dados
   do restaurante; o seed e uma operacao estrutural da migration.
4. **016 - rotas:** como o master snapshot esta vazio, criar somente a projecao
   minima a partir do principal de restaurante ja escopado. Nenhum dominio deve
   ser inventado.
5. **022 - Caixa:** nao fazer backfill de pedidos antigos. As tabelas do Caixa
   comecam vazias no clone; os testes usam tenant e restaurante sinteticos.
6. **Estoque:** manter o estado agregado atual. Nao criar baixa por ingrediente
   porque nao existe ficha tecnica produto-ingrediente.

## Plano de RLS e role de runtime

1. Aplicar schema/backfills com a conexao administrativa do clone.
2. Validar 44 tabelas com `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL
   SECURITY`, 97 policies e zero tabela de runtime fora do allowlist.
3. Criar `inovas_app_prod_test` no clone com `LOGIN`, `NOINHERIT`,
   `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, limite 50,
   zero ownership/membership e `search_path=pg_catalog,public`.
4. Conceder somente a matriz de
   [RUNTIME-DATABASE-ROLE.md](./RUNTIME-DATABASE-ROLE.md). Nao conceder
   `CREATE`, `TRUNCATE`, `REFERENCES` ou `TRIGGER`.
5. Provar com a propria role:
   - acesso sem contexto = zero linhas/negado;
   - restaurante A nao le nem escreve B;
   - `WITH CHECK` bloqueia troca de tenant;
   - Support VIEW le e nao escreve;
   - Support ADMIN exige sessao explicita, vigente e vinculada;
   - `public` acessa somente allowlist;
   - `provisioning` so funciona no fluxo explicito;
   - owner nao e usado pelos E2E de restaurante.
6. Somente depois definir `DATABASE_URL` do deploy Preview para a role limitada.
   `MIGRATION_DATABASE_URL` permanece exclusiva do runner administrativo e nao
   e disponibilizada as funcoes da aplicacao.

O catalogo do Preview possui 34 permissoes base, 12 de Caixa e 20 roles. Ha 53
bindings de Caixa e **zero bindings nao-Caixa**. O runtime atual resolve RBAC no
codigo, e as policies RLS nao dependem dessa tabela, portanto isso nao bloqueia
o dry run. E uma limitacao arquitetural que deve ser documentada; nao criar
bindings base por inferencia nesta atualizacao.

## Dry run no clone Neon

Nome exigido:
`staging-production-migration-dry-run-<timestamp>`.

O clone deve ser filho direto da branch Production confirmada, read-write,
expirar em 24 horas e nunca ser conectado a um deployment Production. Os
comandos abaixo sao o roteiro; **nao foram executados**.

```powershell
$inovasTimestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$inovasBranchName = "staging-production-migration-dry-run-$inovasTimestamp"
$inovasExpiresAt = (Get-Date).ToUniversalTime().AddHours(24).ToString('o')
$inovasProjectId = '<confirmed-neon-project-id>'
$inovasProductionBranchId = '<confirmed-production-branch-id>'

npx.cmd neonctl branches create `
  --project-id $inovasProjectId `
  --name $inovasBranchName `
  --parent $inovasProductionBranchId `
  --type read_write `
  --expires-at $inovasExpiresAt `
  --output json `
  --no-analytics
```

Capturar o novo branch ID e as connection strings em variaveis de processo sem
imprimi-las. Antes de qualquer SQL, comparar branch ID, endpoint, database,
role e fingerprints com Production. O clone deve ter branch/endpoint distintos
e a mesma LSN/snapshot de origem registrada.

Aplicacao com os runners do projeto, depois de materializar 014:

```powershell
$env:INOVAS_ENVIRONMENT = 'preview'
$env:INOVAS_TENANT_MODE = 'strict'
$env:NEON_BRANCH_ID = '<dry-run-branch-id>'
$env:INOVAS_PREVIEW_MIGRATION_CONFIRM = $env:NEON_BRANCH_ID
$env:INOVAS_PREVIEW_NEON_ENDPOINT = '<dry-run-endpoint-prefix>'
$env:MIGRATION_DATABASE_URL = '<dry-run-owner-url-from-secret-store>'

node scripts/run-preview-migration.mjs migrations/014_extend_admin_users_creation_experience.sql
node scripts/run-preview-migration.mjs migrations/015_system_restaurant_security_boundary.sql
node scripts/run-preview-migration.mjs migrations/016_public_routing_and_provisioning_boundary.sql
node scripts/run-preview-migration.mjs migrations/017_user_profile_metadata.sql
node scripts/run-preview-migration.mjs migrations/018_user_session_lifecycle.sql
node scripts/run-preview-migration.mjs migrations/019_tenant_identity_administration.sql
node scripts/run-preview-migration.mjs migrations/020_support_view_least_privilege.sql
node scripts/run-preview-migration.mjs migrations/021_authentication_identity_lookup.sql
node scripts/manage-cash-register-preview.mjs migrate
node scripts/manage-cash-register-preview.mjs validate
```

Configurar e validar a role do clone:

```powershell
$env:INOVAS_TARGET_ENVIRONMENT = 'preview'
$env:INOVAS_EXPECTED_BRANCH_ID = $env:NEON_BRANCH_ID
$env:INOVAS_EXPECTED_NEON_ENDPOINT = '<dry-run-endpoint-prefix>'
$env:INOVAS_RUNTIME_DB_ROLE = 'inovas_app_prod_test'
$env:INOVAS_RUNTIME_DB_PASSWORD = '<random-secret-with-48-plus-characters>'
$env:INOVAS_RUNTIME_ROLE_CONFIRM = "preview:$($env:NEON_BRANCH_ID):inovas_app_prod_test"
$env:INOVAS_REQUIRE_ALL_RUNTIME_TABLES = 'true'

node scripts/configure-runtime-database-role.mjs

$env:DATABASE_URL = '<dry-run-inovas_app_prod_test-url-from-secret-store>'
node scripts/validate-runtime-database-role.mjs
node scripts/manage-cash-register-preview.mjs validate-rls
```

O segredo da role deve ser descartado com a branch. Ao final, depois de exportar
evidencias sem PII:

```powershell
npx.cmd neonctl branches delete '<dry-run-branch-id>' `
  --project-id $inovasProjectId `
  --no-analytics
```

## Matriz de testes do clone

Os 40 testes aprovados no Preview sao baseline, nao evidencia suficiente para o
clone. O clone deve aprovar novamente no minimo os mesmos 40 checks e os gates
abaixo, usando somente tenant/restaurante sinteticos criados pelo fluxo de
provisioning. Dados clonados de restaurantes reais ficam read-only e nao sao
usados como massa de teste.

| Grupo | Evidencia obrigatoria |
| --- | --- |
| Forward | Cada SHA aplicado uma vez, duracao, locks/timeouts, ledger e catalogo final |
| Idempotencia | Reaplicar cada migration imediatamente no proprio estagio; zero drift/duplicacao |
| Schema 015 | 19 tabelas, 188 colunas, 69 constraints, 37 indices, seeds e RLS esperados |
| Schema 022 | 9 tabelas, 150 colunas, 52 constraints, 13 FKs, 2 uniques parciais, 12 permissoes e 53 bindings |
| Role | `inovas_app_prod_test` sem atributos administrativos, ownership ou grants extras |
| RLS | sem contexto, A x B, public, provisioning, restaurant, Support VIEW e Support ADMIN |
| Caixa | abrir caixa; abrir comanda; incluir/editar/remover item pendente; envio incremental; fechar conta |
| Pagamento | simples, dividido, dinheiro/troco, idempotency key e corrida de pagamento duplicado |
| Concorrencia | uma comanda ativa por mesa e um caixa aberto por restaurante sob requests simultaneos |
| Financeiro/auditoria | movimento imutavel, payment set, audit event, liberar mesa e fechar caixa |
| RBAC | OWNER, ADMIN, MANAGER, CASHIER, SERVICE e READ_ONLY; negativas para acoes criticas |
| Compatibilidade | Pedidos e Painel Operacional com leitura/escrita normal; nenhum 404 ou erro API |
| Dados legados | Contagens e hashes agregados inalterados nas 15 tabelas; review orfa preservada |
| UI | desktop, tablet e celular; screenshots; console sem erro; rede sem 4xx/5xx inesperado |
| Operacao | logs serverless/DB, queries lentas, locks, migrations pendentes e latencia p95 |
| Estoque | nenhuma baixa por ingrediente e nenhum schema de ficha tecnica inventado |

Comandos de aplicacao/teste previstos:

```powershell
npm run test:cash-register:e2e
npm run validate:cash-register-local
npm run validate:runtime-schema-boundary-local
```

Os validadores `local` so contam para a decisao se forem configurados para o
deploy/clone e nao para `.data`. O teste E2E real deve atingir a URL Preview e a
role limitada. `tests/e2e/cash-register.spec.js` possui hoje um teste Playwright
agregado; o relatorio deve contabilizar suas assertions/checks separadamente e
nao inflar o numero de casos.

## Rollback e recuperacao

Rollback primario: restauracao de branch/PITR, nao os arquivos `*.rollback.sql`.

1. Antes da futura janela Production, criar e proteger um restore branch no LSN
   imediatamente anterior a 014 e registrar branch ID, LSN e timestamp.
2. No clone de dry run, medir a restauracao dessa branch e comparar catalogo e
   contagens agregadas com o baseline.
3. Validar o rollback de aplicacao: commit anterior + connection string anterior
   em deployment Preview, sem remover schema aditivo.
4. Validar o rollback de banco num segundo clone. Os rollbacks 022-014 podem ser
   exercitados somente sobre dados sinteticos, mas o resultado atual sera
   divergente porque 015 deixa policies e `pgcrypto` e 016 e parcial.
5. Nao aprovar Production enquanto o RTO de restauracao e o procedimento de
   troca de endpoint nao forem ensaiados e evidenciados.

Os arquivos down de 015 e 022 sao destrutivos. Nunca usa-los como primeira
resposta depois que Caixa/identidades tiverem dados reais.

## Fases da futura execucao Production

Este e somente o plano. Nenhuma fase abaixo esta autorizada agora.

| Fase | Conexao | Estimativa | Risco | Gate de avancar | Reversao |
| --- | --- | ---: | --- | --- | --- |
| 0. Congelar artefatos | Nenhuma | 15 min | SHA/ordem incorretos | 014 `.sql`, manifest, hashes, ledger e diff aprovados | Nao se aplica |
| 1. Snapshot/PITR | Neon control plane | 2-5 min | restore nao utilizavel | restore branch conectado em modo read-only e contagens iguais | Manter Production inalterada |
| 2. Expand 014-017 | `MIGRATION_DATABASE_URL` owner | <1 min esperado; reservar 5 | locks de catalogo/indice | zero timeout, schema exato, backfill 2/1/1 | restore branch |
| 3. Policies 018-021 | owner | <30 s; reservar 5 | regressao de audiencia | testes RLS por audiencia aprovados | restore branch ou policies revisadas |
| 4. Caixa 022 | owner | <10 s; reservar 5 | FK/unique/drift | schema 9/150/52, 12/53 seed, RLS 9/9 | restore branch |
| 5. Role limitada | owner para grants; role para teste | 2-5 min | grant excessivo/insuficiente | validador da role 100% | revogar role; app continua no owner legado ate cutover |
| 6. Deploy/cutover | Vercel Preview primeiro; Production so em autorizacao futura | 5-10 min | app sem contexto RLS | E2E real, Pedidos/Painel sem regressao, logs limpos | commit/env anterior |
| 7. Observacao | role limitada | 30 min minimo | erro tardio/latencia | zero erro critico, p95 dentro do baseline | rollback de app ou restore conforme severidade |

Com os volumes atuais, o DDL deve terminar em segundos. Recomenda-se uma janela
de 30 minutos para a futura Production, com freeze de criacao/edicao de usuarios
durante o backfill e cutover. O trafego de pedidos atual usa owner/BYPASSRLS e
nao deveria parar durante o expand; ainda assim, reservar ate 5 minutos de
indisponibilidade para a troca de deploy/env. A decisao final depende da medicao
do clone, nao destas estimativas.

## Evidencias exigidas no relatorio do dry run

- URL do deploy Preview conectado ao clone.
- Commit e SHA-256 de cada migration.
- Fingerprints de project/branch/endpoint/database/role, sem connection string.
- LSN/timestamp do snapshot de origem e do restore rehearsal.
- Resultado por migration, incluindo segunda aplicacao imediata.
- Diff de catalogo limpo versus Preview e explicacao dos seis indices extras.
- Contagem de testes aprovados/falhos, com denominador real.
- Screenshots desktop, tablet e celular.
- Console, rede, API, server logs, slow queries e locks.
- Contagens agregadas antes/depois das 15 tabelas legadas.
- Resultado do rollback/restore e RTO medido.
- Limitacoes e decisao GO/NO GO para uma futura Production.

## Resultado final desta etapa

**GO para criar `staging-production-migration-dry-run-<timestamp>` e executar o
ensaio fora de Production.** Os dados e o volume atual nao apresentam
impedimento conhecido para o clone.

**NO GO para Production agora.** Production nao foi alterada. A promocao so
pode ser reavaliada depois que o clone aprovar forward, idempotencia, RLS,
isolamento, role limitada, E2E real, ausencia de regressao critica e
restauracao/rollback medido.
