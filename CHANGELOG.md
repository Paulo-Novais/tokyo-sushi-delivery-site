# Changelog

## [1.8.0] - 2026-07-11

Status: Finalizacao controlada V1.8

### Fixed

- Corrigido contrato de erro do Painel Master para manter `master_access_required` em bloqueios de usuarios sem acesso de plataforma.
- Ajustado Kanban administrativo para manter cinco colunas acessiveis no desktop validado sem corte lateral.
- Removido fallback hardcoded de chave Google Maps em `maps-config.js`; a chave passa a depender de configuracao publica restrita por ambiente/host.

### Security

- Sanitizado `.env.example` para conter apenas placeholders, sem login, hash ou credencial operacional.
- Adicionados headers globais de seguranca em `vercel.json`: CSP compativel, Permissions-Policy, X-Frame-Options, COOP e CORP, preservando HSTS, nosniff e Referrer-Policy.
- CSP permanece compativel com inline JSON/scripts existentes; migracao para nonce/hash fica documentada como hardening posterior.

### Changed

- Alinhado versionamento local para `1.8.0` em pacote, lockfile, configuracao de plataforma e snapshot do Painel Master.

### Known Limitations

- Dominio `inovasfood.com.br` ainda depende de DNS/Vercel externos para certificacao publica.
- Producao e Preview so podem receber GO apos novo deployment atrelado ao commit exato e smoke tests autenticados.
- Nao houve alteracao destrutiva de banco.

## [1.3.0] - Em desenvolvimento

Status: Local Validation

### Added

- Dashboard exclusivo da Plataforma com cards globais de restaurantes, usuarios, pedidos, clientes, faturamento, assinaturas, uso, chamados, erros e performance.
- Modulo Restaurantes no Painel Master com filtros, tabela completa, acoes preparadas e pagina do restaurante em abas.
- Gestao visual de Planos oficiais V1.3: Essencial, Profissional e Enterprise, preservando chaves tecnicas legadas.
- Telas de Assinaturas, Vendedores, Comissao, Contratos, Financeiro Plataforma e Dashboard Comercial.
- Configuracoes da Plataforma com campos preparados para dominio, emails, WhatsApp, redes, SMTP, integracoes, API e tokens.
- Logs e Auditoria no contexto da Plataforma.
- Validador `validate:v1-3-platform-local`.

### Changed

- Painel Master passa a operar como base administrativa SaaS da INOVAS Food.
- Dashboard da plataforma deixa de destacar apenas Tokyo/default e usa agregados globais do snapshot master.
- Usuarios de sistema sao contados separadamente de usuarios de restaurante no snapshot da Plataforma.
- RC organiza documentacao V2 em `docs/`, adiciona marcadores de secao no codigo da plataforma e reforca a validacao da logo oficial INOVAS Food no login e no Painel Master.

### Not Included

- Deploy, tag e commit.
- Integracao real de pagamento, contrato externo, SMTP, API tokens ou calculo automatico de comissao.
- Alteracoes no Gestor do Restaurante, APIs publicas, autenticacao ou banco de producao.

## [1.1.0] - 2026-06-29

Status: Production Ready (Controlled Deploy)

### Added

- Gestao V1.1 de usuarios no Painel Master com busca por ID, nome, restaurante, e-mail, telefone e CNPJ/MEI.
- Cadastro completo de restaurante/OWNER com campos legais e comerciais obrigatorios.
- Perfis internos padrao para usuarios de restaurante: Gerente, Subgerente, Caixa, Cozinha, Bar, Estoque, Financeiro, Entregador, Atendente e Personalizado.
- Validador `validate:v1-1-users-local`.

### Changed

- Regras de MASTER de plataforma e OWNER de restaurante ficaram separadas no backend.
- Permissoes avancadas do painel operacional ficam recolhidas atras de personalizacao.
- Payloads locais de validacao V1 passam a atender o contrato cadastral V1.1.

## [1.0.0] - 2026-06-28

Status: Production Ready (Pilot)

### Added

- TenantContext por request com `default_only`, `pilot` e `strict`.
- Isolamento logico e fisico por tenant para stores operacionais.
- Security Guardian para rotas sensiveis, com rate limit, RBAC, plano, assinatura, risco e logs sanitizados.
- Onboarding Master para restaurante piloto real.
- Criacao de admin `OWNER` vinculado ao restaurante.
- Planos V1 `START`, `BUSINESS` e `PRO`, com `PREMIUM` preservado como alias legado completo.
- Assinaturas `TRIAL`, `ACTIVE`, `EXPIRED`, `BLOCKED` e `CANCELED`.
- Exportacao minima por tenant via backend.
- Validadores V1 locais: release, hardening, onboarding, subscription, RBAC, audit, export, pilot journey e final.

### Changed

- Scripts de validacao destrutivos antigos permanecem bloqueados por padrao.
- `validate:stage-3-ui` agora aponta para validacao local isolada, sem depender de servidor externo em `localhost:3000`.
- Contrato de dominios atualizado para aceitar escopo fisico V1 com `tenantId` e `restaurantId`.
- `.gitignore` passa a ignorar o arquivo especial `NUL` gerado em ambiente Windows.

### Fixed

- Validador de dominios ainda refletia contrato antigo que proibia campo fisico de restaurante.
- Validador de Kanban usava mock antigo sem sessao/plano/permissoes V1.
- Suite UI nominal dependia de servidor externo e nao era reproduzivel em preparacao de producao.

### Known Limitations

- Billing real/gateway de pagamento nao faz parte da V1.
- Exportacao V1 e JSON minimo por tenant.
- Perfis operacionais nomeados sao representados por `CUSTOM` + permissoes.
- `pilot` deve ser ativado somente de forma explicita e controlada.
- `strict` fica reservado para cutover futuro, nao para o primeiro piloto.
