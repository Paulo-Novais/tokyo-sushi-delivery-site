# INovas Food - Tenant Test Plan

Data: 2026-06-25

Escopo: plano futuro de testes para validar isolamento multi-restaurante. Nenhum teste foi implementado nesta etapa.

## Objetivo

Garantir que, quando a plataforma ativar multi-restaurante, dados, permissoes, configuracoes e relatorios de um restaurante nunca vazem para outro.

## Cobertura Obrigatoria

Este plano deve validar explicitamente:

- Restaurante A nunca ve Restaurante B.
- Usuarios isolados por organization/restaurant/membership.
- Pedidos isolados por restaurante.
- Financeiro isolado por restaurante, caixa e periodo.
- Estoque isolado por restaurante/local.
- Clientes isolados por restaurante, com identidade global apenas se modelada.
- Relatorios isolados por restaurante e agregados somente para master/organizacao autorizada.

## Invariantes de Seguranca

1. Restaurante A nunca lista dados do Restaurante B.
2. Restaurante A nunca altera dados do Restaurante B.
3. Usuario sem membership no restaurante nao acessa o gestor daquele restaurante.
4. Cliente autenticado em A nao ve historico de B.
5. Dominio de A nunca resolve branding/cardapio/delivery de B.
6. Relatorio do gestor sempre fica limitado ao restaurante atual.
7. Master so ve dados agregados quando o usuario tem permissao master.
8. Toda query operacional deve ter escopo interno quando tenant mode estiver ativo.

## Massa de Teste Futura

Criar ambiente controlado com:

- Organization Alpha.
- Organization Beta.
- Restaurante A1.
- Restaurante A2.
- Restaurante B1.
- Usuario master global.
- Usuario owner A1.
- Usuario owner A2.
- Usuario owner B1.
- Usuario sem membership.
- Cliente A.
- Cliente B.
- Pedidos, reviews, itens de estoque e fechamentos diferentes por restaurante.

## Matriz de Testes

| Area | Cenario | Resultado esperado | Prioridade |
| --- | --- | --- | --- |
| Resolver dominio | Abrir dominio A1 | Contexto A1 resolvido | Critica |
| Resolver dominio | Abrir dominio B1 | Contexto B1 resolvido | Critica |
| Resolver dominio | Host desconhecido | Nega acesso ou fallback controlado | Alta |
| Login admin | Owner A1 loga | Sessao contem membership A1 | Critica |
| Login admin | Owner A1 tenta acessar B1 | 403/sem dados | Critica |
| Login admin | Master acessa painel master | Acesso permitido | Alta |
| Login admin | Usuario sem membership acessa gestor | 403/redirect | Critica |
| Pedidos | A1 lista pedidos | Apenas pedidos A1 | Critica |
| Pedidos | A1 abre detalhe de pedido B1 por ID | 404/403 | Critica |
| Pedidos | A1 atualiza status de B1 por ID | 404/403 e nenhum dado alterado | Critica |
| Pedidos | Pedido publico em dominio A1 | Pedido salvo com escopo A1 | Critica |
| Pedidos | Pedido publico em dominio B1 | Pedido salvo com escopo B1 | Critica |
| Clientes | Cliente A consulta historico em A1 | Apenas historico A1 | Critica |
| Clientes | Cliente A tenta usar token em B1 | Nao ve historico A1 | Alta |
| CRM | Gestor A1 busca telefone de cliente B1 | Nao retorna perfil B1 | Critica |
| Catalogo | Dominio A1 carrega catalogo | Catalogo A1 | Alta |
| Catalogo | Promocao de B1 existe | Nao aparece em A1 | Alta |
| Delivery | A1 calcula entrega | Usa taxas/raio A1 | Alta |
| Delivery | B1 tem entrega pausada | Nao pausa A1 | Alta |
| Financeiro | A1 consulta periodo | Apenas valores A1 | Critica |
| Financeiro | A1 fecha periodo de B1 por chave | 404/403 | Critica |
| Estoque | A1 lista estoque | Apenas estoque A1 | Critica |
| Estoque | A1 ajusta item B1 por ID | 404/403 | Critica |
| Avaliacoes | Site A1 lista reviews | Apenas reviews A1 | Alta |
| Avaliacoes | Gestor A1 oculta review B1 | 404/403 | Alta |
| Relatorios | Gestor A1 abre dashboard | Apenas metricas A1 | Critica |
| Relatorios | Organization Alpha consolida A1+A2 | Nao inclui B1 | Alta |
| Feature flags | Plano B1 tem modulo bloqueado | Bloqueio nao afeta A1 | Alta |
| Branding | Dominio A1 renderiza logo | Logo A1 | Media |
| Branding | Dominio B1 renderiza logo | Logo B1 | Media |
| Integracoes | WhatsApp A1 envia template | Usa credencial/template A1 | Alta |
| Auditoria | A1 altera pedido A1 | Evento com actor e restaurante A1 | Alta |
| Auditoria | Tentativa negada A1 -> B1 | Evento de seguranca registrado | Media |

## Testes por Camada

### Banco

- Verificar indices compostos por `restaurant_id`.
- Verificar constraints compostas onde chaves antes eram globais.
- Verificar backfill default.
- Verificar que queries sem escopo falham em testes.
- Se RLS for adotado no futuro, validar policy por restaurante.

### Backend

- Testar cada store com contexto A e B.
- Testar ausencia de contexto.
- Testar contexto invalido.
- Testar usuario com multiplos memberships.
- Testar master lendo agregado.
- Testar owner lendo somente restaurante.

### Frontend Publico

- Abrir dominio A e validar branding/catalogo/delivery.
- Abrir dominio B e validar dados diferentes.
- Criar pedido em cada dominio.
- Validar `localStorage`/sessao cliente sem cruzamento.

### Gestor

- Login por papel.
- Navegacao por modulo.
- Listas e detalhes com IDs cruzados.
- Salvamentos com IDs cruzados.
- Feature flags e plano por restaurante.

### Master

- Master lista organizacoes/restaurantes.
- Master troca escopo sem vazar dados para gestor.
- Master ve relatorios agregados corretos.
- Usuario nao-master nao acessa master.

## Testes de Regressao Obrigatorios

Enquanto Tokyo Sushi estiver em modo default:

- Validacoes atuais de dominio continuam passando.
- Login admin atual continua funcionando.
- Pedido publico atual continua funcionando.
- Catalogo atual continua igual.
- Delivery atual continua igual.
- Painel master atual continua mostrando restaurante default.
- `restaurant_key = "default"` continua resolvendo.

## Ordem Recomendada de Implementacao dos Testes

1. Testes unitarios de resolver contexto.
2. Testes unitarios de stores com A/B.
3. Testes API com IDs cruzados.
4. Testes E2E publicos por dominio.
5. Testes E2E do gestor por membership.
6. Testes master agregados.
7. Testes de rollback/default-only.

## Criterios de Aprovacao

Multi-restaurante real so deve ser liberado quando:

- 100% dos cenarios criticos estiverem verdes.
- Nenhum store operacional aceitar acesso sem contexto em tenant mode.
- Nenhum endpoint admin retornar dado de outro restaurante.
- Backfill default for auditado.
- Rollback for testado em ambiente nao-produtivo.

## Criterios de Bloqueio

Bloquear release se ocorrer:

- Qualquer vazamento A -> B.
- Qualquer escrita cruzada.
- Qualquer regressao em pedido Tokyo/default.
- Qualquer regressao em login/admin.
- Qualquer diferenca financeira entre legado e novo escopo.
