# INovas Food - Tenant Migration Plan

Data: 2026-06-25

Escopo: roadmap futuro para migracao multi-restaurante. Este plano nao executa migrations, nao altera banco, nao muda APIs e nao ativa multi-restaurante.

## Principios

- Primeiro preparar, depois migrar, depois ativar.
- `restaurant_key = "default"` continua funcionando durante toda a transicao.
- Nenhuma API externa deve receber `restaurant_id` como requisito na fase de compatibilidade.
- Toda migration real deve ter rollback e backup.
- Multi-restaurante real so entra depois de testes anti-vazamento.

## Fase 1 - Preparacao

Objetivo: transformar decisao arquitetural em contratos claros.

Entregas:

- Aprovar ADR-001 a ADR-005.
- Congelar contratos atuais de API/cookies/headers/dominio.
- Definir nomenclatura final: `organization_id`, `restaurant_id`, `legacy_restaurant_key`.
- Definir `TenantContext` interno.
- Definir estrategia de IDs publicos e internos.
- Criar plano de testes anti-vazamento.
- Definir rollback por fase.

Nao fazer:

- Nao criar tabelas reais.
- Nao alterar stores.
- Nao criar restaurante extra.

Criterio de saida:

- Equipe sabe exatamente como default sera mapeado para organizacao/restaurante futuro.

## Fase 2 - Banco

Objetivo: criar estrutura futura sem mudar comportamento.

Entregas futuras:

- Criar `organizations`.
- Criar `restaurants`.
- Criar `restaurant_domains`.
- Criar estruturas de planos/contratos.
- Criar `users` e `restaurant_users`.
- Criar estruturas de settings/branding/delivery/integrations.
- Preparar colunas/indices de escopo em tabelas operacionais.
- Fazer backfill default de forma idempotente.

Nao fazer no inicio:

- Nao ativar multi-restaurante.
- Nao remover estruturas legadas.
- Nao exigir contexto nas APIs antes dos testes.

Criterio de saida:

- Banco consegue representar Tokyo/default como organization + restaurant sem mudar comportamento.

## Fase 3 - Backend

Objetivo: tornar stores e APIs tenant-aware internamente.

Entregas futuras:

- Criar resolver de contexto.
- Passar contexto para `admin-api`.
- Passar contexto para APIs publicas por dominio.
- Refatorar stores para aceitar contexto.
- Negar acesso sem contexto em tenant mode.
- Manter fallback default-only por flag.
- Instrumentar logs por restaurante/organizacao.

Stores prioritarios:

- `order-store`.
- `user-permissions`.
- `customer-crm-store`.
- `catalog-store`.
- `delivery-settings-store`.
- `restaurant-settings-store`.
- `finance-store`.
- `inventory-store`.
- `review-store`.
- `master-platform-store`.

Criterio de saida:

- Todas as leituras/escritas operacionais passam por contexto no modo futuro.

## Fase 4 - Frontend

Objetivo: consumir dados do restaurante correto sem mudar a experiencia atual.

Entregas futuras:

- Site publico resolve branding/catalogo/delivery pelo dominio.
- Cliente auth/historico fica isolado por restaurante.
- Gestor recebe contexto de membership.
- Admin UI nao mostra dados fora do restaurante.
- Namespacing futuro de storage local com compatibilidade legada.

Nao fazer:

- Nao alterar layout durante a migracao de escopo.
- Nao trocar dominio Tokyo.

Criterio de saida:

- Frontend default continua visualmente identico e dados A/B ficam isolados em testes.

## Fase 5 - Master

Objetivo: transformar master de conceitual/default para plataforma multi-restaurante controlada.

Entregas futuras:

- Listar organizacoes e restaurantes normalizados.
- Gerenciar dominios por restaurante.
- Gerenciar contratos e planos normalizados.
- Gerenciar feature flags por organizacao/restaurante.
- Mostrar relatorios agregados com permissao master.
- Auditar mudancas comerciais e operacionais.

Criterio de saida:

- Master opera varios restaurantes sem afetar o gestor de cada unidade.

## Fase 6 - Dominios

Objetivo: permitir roteamento seguro por dominio/subdominio.

Entregas futuras:

- Resolver host -> restaurante.
- Validar dominio atual do Tokyo como default.
- Criar comportamento para host desconhecido.
- Separar redirects da regra de tenant.
- Validar SSL/status por dominio.
- Testar cache por dominio.

Criterio de saida:

- Dominio A carrega apenas dados A, dominio B carrega apenas dados B.

## Fase 7 - Producao

Objetivo: ativar gradualmente com seguranca.

Entregas futuras:

- Backup completo antes do cutover.
- Ativar default-only em producao.
- Monitorar logs/erros/latencia.
- Comparar leituras legadas vs escopadas.
- Liberar restaurante piloto nao-Tokyo somente depois dos testes.
- Manter rollback pronto.
- Documentar operacao de suporte.

Criterio de saida:

- Multi-restaurante real ativado sem regressao no Tokyo Sushi/default.

## APIs Impactadas Futuramente

| API | Impacto |
| --- | --- |
| `/api/orders/create` | Resolver restaurante pelo dominio e salvar pedido escopado |
| `/api/customer/*` | Isolar sessao, historico e pedido ativo por restaurante |
| `/api/catalog` | Retornar catalogo/reviews por restaurante |
| `/api/delivery-settings` | Retornar entrega por restaurante |
| `/api/restaurant-settings` | Retornar settings/branding por restaurante |
| `/api/admin/*` | Validar membership e escopo em todas as acoes |
| `/api/admin/master/*` | Separar visao master de visao gestor |
| `/api/auth/send-whatsapp-code` | Usar integracao/template por restaurante no futuro |

## Modulos Reaproveitaveis

- Estrutura de stores por dominio.
- Regras de pedido e payload.
- Validacao de horario.
- Permissoes por modulo/acao.
- Planos/contratos conceituais.
- Branding/config central.
- Middleware admin/master.
- Validacoes locais existentes.

## Modulos Com Refatoracao Alta

- Pedidos.
- Usuarios/membership.
- Clientes/CRM.
- Financeiro.
- Estoque.
- Relatorios.

## Modulos Com Refatoracao Media

- Catalogo.
- Delivery.
- Avaliacoes.
- Branding.
- Feature flags.
- WhatsApp/integracoes.

## Estimativa de Mudanca

| Area | Mudanca necessaria |
| --- | --- |
| Banco | Alta |
| Backend | Alta |
| Frontend publico | Media |
| Gestor | Media-alta |
| Master | Media-alta |
| Testes | Alta |
| Deploy/operacao | Media |

## Sinais de Pronto Para Multi-Restaurante

- Tabelas operacionais escopadas.
- Stores recusam acesso sem contexto.
- APIs passam contexto automaticamente.
- Testes A/B verdes.
- Master normalizado.
- Rollback ensaiado.
- Tokyo/default validado em producao.

## Conclusao

A migracao deve acontecer em sete fases, com default-only como ponte obrigatoria. Esse caminho preserva Tokyo Sushi, reduz risco de vazamento e permite transformar a plataforma em SaaS sem reescrever as regras de negocio existentes.
