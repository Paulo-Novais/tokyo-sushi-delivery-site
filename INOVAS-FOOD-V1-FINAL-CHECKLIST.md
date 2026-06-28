# INovas Food - V1 Final Checklist

Data: 2026-06-28

Versao: 1.0.0

Status: Production Ready (Pilot)

## 1. Resumo da V1.0

A V1.0 esta fechada como plataforma SaaS pronta para piloto comercial controlado. O modo padrao continua `INOVAS_TENANT_MODE=default_only`, preservando Tokyo Sushi/default. O modo `pilot` habilita restaurantes reais cadastrados por dominio/subdominio, sem ativacao acidental em producao.

## 2. O que esta pronto

- TenantContext por request.
- Isolamento logico e fisico por tenant nos stores operacionais.
- Security Guardian para rotas sensiveis.
- Cadastro real de restaurante/tenant em modo piloto.
- Criacao de admin do restaurante no onboarding.
- Planos `START`, `BUSINESS` e `PRO`, com `PREMIUM` preservado como alias legado completo do Tokyo/default.
- Assinaturas `TRIAL`, `ACTIVE`, `EXPIRED`, `BLOCKED` e `CANCELED`.
- RBAC por permissoes de modulo/acao.
- Exportacao minima por tenant via backend.
- Auditoria de eventos criticos em logs internos e trilhas operacionais.
- Validacao final consolidada em `validate:v1-final-local`.

## 3. Como ativar modo piloto

Definir explicitamente:

```bash
INOVAS_TENANT_MODE=pilot
```

Neste modo, dominios/subdominios cadastrados e ativos resolvem para o tenant real. Hosts nao cadastrados continuam com fallback seguro para default.

## 4. Como manter modo default_only

Nao definir `INOVAS_TENANT_MODE` ou usar:

```bash
INOVAS_TENANT_MODE=default_only
```

Todos os hosts continuam resolvendo para Tokyo Sushi/default.

## 5. Como cadastrar restaurante piloto

Usar a API interna Master:

```http
POST /api/admin/master/onboard-restaurant
```

Requer sessao MASTER e payload com nome, slug/restaurantKey, dominio/subdominio, WhatsApp valido quando informado, endereco, horario, entrega, pagamentos, plano, status de assinatura e admin inicial.

## 6. Como criar admin do restaurante

O onboarding cria um usuario `OWNER` vinculado ao `tenantId`, `restaurantId` e `restaurantKey` do restaurante. O login desse admin so e aceito no dominio/subdominio do proprio tenant.

## 7. Como funcionam planos

- `START`: cardapio, pedidos, WhatsApp e branding.
- `BUSINESS`: START + entrega, relatorios, CRM, reviews, promocoes e cupons.
- `PRO`: BUSINESS + estoque, financeiro, pedidos agendados e dominio proprio.
- `PREMIUM`: alias legado completo, preservado para compatibilidade do Tokyo/default.

## 8. Como funcionam assinaturas

- `TRIAL` e `ACTIVE`: operam conforme plano.
- `EXPIRED`, `BLOCKED` e `CANCELED`: bloqueiam operacoes sensiveis no backend.
- Admin Restaurante nao consegue burlar assinatura.
- Admin Geral/MASTER gerencia plano e status.

## 9. Como funcionam permissoes

Permissoes sao compostas por modulo e acao, como `orders_view`, `orders_edit`, `inventory_view`, `financial_view` e `exports_view`. `MASTER` gerencia a plataforma; `OWNER` gerencia apenas seu restaurante; perfis operacionais usam `CUSTOM` com permissoes explicitas.

## 10. Como funciona Security Guardian

O Security Guardian valida tenant, sessao, compatibilidade sessao/tenant, RBAC, plano, assinatura, rate limit, risco por request e sanitizacao de logs. Erros de seguranca retornam resposta generica; detalhes internos ficam nos eventos sanitizados.

## 11. Como validar isolamento

Executar:

```bash
npm.cmd run validate:tenant-isolation-local
npm.cmd run validate:tenant-persistence-local
npm.cmd run validate:v1-final-local
```

## 12. Como executar validacao final

```bash
npm.cmd run validate:v1-final-local
```

O script executa os cenarios V1 novos e consolida os validadores existentes de tenant, seguranca, permissoes, planos, plataforma, admin, layout, mobile publico e horarios.

## 13. Limitacoes conhecidas

- Cobranca real/gateway de pagamento nao esta implementado.
- Billing status e valores sao contratuais internos, sem integracao financeira externa.
- Modo `strict` existe para preparacao tecnica, mas piloto comercial deve iniciar em `pilot`.
- Exportacao V1 e JSON minimo por tenant; formatos adicionais podem ficar para evolucao.
- Perfis como Gestor, Caixa, Cozinha, Estoque, Financeiro, Entregador e Atendente sao representados por usuarios `CUSTOM` com permissoes coerentes.

## 14. O que NAO esta na V1.0

- IA.
- WhatsApp AI.
- App mobile nativo.
- Gateway real de pagamento.
- Marketplace publico self-service.
- Automacao fiscal/contabil.
- Multi-regiao ou sharding de banco.

## 15. O que fica para V2.0

- Billing real.
- Self-service completo de onboarding.
- Mais formatos de exportacao/backup.
- Auditoria persistente dedicada fora de stores locais.
- Perfis nomeados como entidade propria.
- Integracoes avancadas com mensageria, antifraude e fiscal.

## 16. Checklist antes de colocar restaurante real

- Confirmar `INOVAS_TENANT_MODE=pilot`.
- Cadastrar restaurante por MASTER.
- Validar dominio/subdominio.
- Criar admin OWNER.
- Validar plano e assinatura.
- Criar pedido teste.
- Confirmar isolamento contra default e outro tenant.
- Executar `npm.cmd run validate:v1-final-local`.

## 17. Checklist antes de mexer em producao

- Backup da base atual.
- Confirmar `default_only` em producao ate a janela de piloto.
- Revisar env vars de admin e sessao.
- Revisar dominios cadastrados.
- Rodar validacoes finais.
- Conferir logs sem segredo.
- Conferir que nao ha cobranca real ativa.
- Ter rollback para `INOVAS_TENANT_MODE=default_only`.

## Status final

V1.0 oficialmente encerrada como Release Candidate pronto para producao em piloto controlado.

Status oficial: Production Ready (Pilot).
