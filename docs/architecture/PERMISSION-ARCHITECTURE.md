# INOVAS FOOD - Arquitetura de Permissoes V2.0

Status: preparacao documental.
Escopo: revisao e proposta, sem alterar regra de backend, frontend, autenticacao, deploy, commit ou tag.

## 1. Situacao Atual

A V1.2 adicionou a separacao oficial:

- Usuario do Sistema.
- Usuario de Restaurante.

Tipos de usuario do sistema:

- `MASTER`
- `SOCIO`
- `DESENVOLVEDOR`
- `SUPORTE`
- `VENDEDOR`

Tipos de usuario de restaurante:

- `OWNER`
- `GERENTE`
- `CAIXA`
- `COZINHA`
- `ESTOQUE`
- `ENTREGADOR`

O arquivo central e `lib/user-permissions.cjs`.

## 2. Fundacoes Existentes

Pontos positivos:

- `SYSTEM_USER_TYPES` e `RESTAURANT_USER_TYPES` existem.
- `SYSTEM_USER_HIERARCHY` existe.
- `SYSTEM_USER_MANAGEABLE_TYPES` restringe quem cria/altera quem.
- `SAAS_MODULE_PERMISSIONS` existe no formato `module.action`.
- OWNER e usuarios de restaurante exigem restaurante.
- MASTER nao deve possuir `restaurantKey`.
- Escritas passam por validacao backend.
- Validador V1.2 cobre hierarquia, menus, header, API, isolamento e regressao V1.1.

Permissoes SaaS atuais:

- `users.read`
- `users.write`
- `orders.read`
- `orders.write`
- `scheduled.read`
- `scheduled.write`
- `catalog.read`
- `catalog.write`
- `deliveries.read`
- `deliveries.write`
- `customers.read`
- `customers.write`
- `promotions.read`
- `promotions.write`
- `metrics.read`
- `reports.read`
- `finance.read`
- `finance.write`
- `reviews.read`
- `reviews.write`
- `settings.read`
- `settings.write`

## 3. Limitacoes Atuais

Ha convivencia entre dois modelos:

- Legado: `orders_view`, `settings_edit`, `users_delete`.
- SaaS: `orders.read`, `settings.write`, `users.write`.

Isso e aceitavel em transicao, mas nao deve permanecer como fonte dupla de verdade.

Outras limitacoes:

- Rotas admin ainda calculam permissao em funcoes do controller em vez de manifesto declarativo.
- Menus frontend ja separam sistema/restaurante, mas devem continuar sendo apenas reflexo da permissao backend.
- Permissoes avancadas continuam ocultas, correto para V1.2, mas V2.0 precisara expor configuracao com cuidado.
- Algumas regras ainda dependem de tipo de usuario, nao de permissao granular.
- `SUPORTE` e `VENDEDOR` tem regras comerciais diferentes, mas podem precisar de escopos alem de permissao simples.

## 4. Escopos Recomendados

Escopos devem complementar permissoes:

- `masterScope`: MASTER, acesso total e unico.
- `platformScope`: SOCIO, DESENVOLVEDOR, SUPORTE e areas autorizadas de plataforma.
- `sellerScope`: VENDEDOR, limitado a restaurantes/clientes vinculados por `seller_id`.
- `restaurantScope`: usuario de restaurante, limitado a `tenantId/restaurantId`.
- `ownerScope`: OWNER, administra usuarios e configuracoes do proprio restaurante.
- `supportScope`: SUPORTE, administra restaurantes sem alterar usuarios do sistema acima dele.

## 5. Matriz Recomendada

| Perfil | Escopo | Pode gerenciar |
| --- | --- | --- |
| MASTER | `masterScope` | Todos abaixo, plataforma inteira |
| SOCIO | `platformScope` | DESENVOLVEDOR, SUPORTE, VENDEDOR, restaurantes |
| DESENVOLVEDOR | `platformScope` tecnico | SUPORTE, VENDEDOR, diagnosticos |
| SUPORTE | `supportScope` | VENDEDOR, usuarios de restaurante |
| VENDEDOR | `sellerScope` | Restaurantes/clientes vinculados e usuario inicial |
| OWNER | `ownerScope` | Usuarios do proprio restaurante |
| GERENTE | `restaurantScope` | Operacao conforme modulos permitidos |
| CAIXA | `restaurantScope` | Operacao de caixa/pedidos conforme modulo |
| COZINHA | `restaurantScope` | Cozinha/pedidos conforme modulo |
| ESTOQUE | `restaurantScope` | Estoque conforme modulo |
| ENTREGADOR | `restaurantScope` | Entregas conforme modulo |

## 6. Manifesto de Rotas

Recomendacao para V2.0:

Cada rota deve declarar:

- `group`
- `action`
- `method`
- `requiredScope`
- `requiredPermissions`
- `requiresTenant`
- `requiresRestaurant`
- `allowedUserTypes`
- `planFeature`
- `auditEvent`

Exemplo conceitual:

```js
{
  route: "admin/platform/users",
  method: "POST",
  requiredScope: "platformScope",
  requiredPermissions: ["users.write"],
  requiresTenant: false,
  auditEvent: "platform_user_created"
}
```

```js
{
  route: "admin/restaurant/orders",
  method: "GET",
  requiredScope: "restaurantScope",
  requiredPermissions: ["orders.read"],
  requiresTenant: true,
  planFeature: "orders"
}
```

## 7. Backend vs Frontend

Regra recomendada:

- Backend decide sempre.
- Frontend apenas esconde ou mostra.
- Validadores devem testar chamada direta por API.
- Toda escrita deve registrar actor, escopo e tenant.
- Toda leitura global deve exigir usuario de sistema autorizado.

## 8. Problemas, Prioridade e Risco

| Problema | Prioridade | Impacto | Risco |
| --- | --- | --- | --- |
| Dois formatos de permissao | Alta | Divergencia entre UI e API | Alto no RBAC completo |
| Permissao misturada com tipo de usuario | Media | Crescimento rigido | Medio |
| Rotas sem manifesto unico | Alta | Dificulta auditoria | Alto |
| Escopo vendedor ainda inicial | Media | Comissao e carteira futuras | Medio |
| Permissoes avancadas ocultas | Baixa agora | Correto para V1.2 | Baixo |

## 9. Recomendacoes

Alta prioridade:

- Adotar `module.action` como formato canonico.
- Criar adaptador temporario de permissoes legadas.
- Declarar manifesto de rotas e gerar testes a partir dele.
- Adicionar auditoria obrigatoria em toda escrita sensivel.

Media prioridade:

- Criar tabela futura `role_permissions`.
- Criar tabela futura `user_permission_overrides`.
- Criar `permission_groups` por modulo.
- Preparar UI de permissao, mas manter oculta ate escopo aprovado.

Baixa prioridade:

- Remover aliases de perfis antigos como `SUBGERENTE`, `BAR`, `ATENDENTE`, `CUSTOM` apenas se nao houver dado legado.

## 10. Recomendacao Final

A regra atual esta correta para V1.2: separa usuarios do sistema e restaurante e bloqueia acesso indevido. Para V2.0, o proximo passo nao e liberar tela de permissoes, e sim criar um manifesto declarativo de escopo/permissao por rota e consolidar `module.action` como contrato unico.
