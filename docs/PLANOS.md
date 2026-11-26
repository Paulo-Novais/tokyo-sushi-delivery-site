# Planos INOVAS (tabela de 25/11/2026)

Fonte da verdade no código: `lib/master-platform-store.cjs` (planos, recursos e
mensalidade) e `lib/plan-limits.cjs` (vagas de usuário).

| Plano | Mensalidade | Usuários | Libera |
|---|---|---|---|
| **Essencial** (`START`) | R$ 99,90 | 2 | Cardápio digital, Gestor de pedidos, cálculo de entrega, pagamento online, pedidos agendados, repasse semanal |
| **Profissional** (`BUSINESS`) | R$ 179,90 | 5 | Tudo do Essencial + estoque, financeiro, relatórios e métricas (e exportações), nota fiscal (NFC-e) |
| **Completo** (`PRO`) | R$ 299,90 | ilimitados | Tudo do Profissional + caixa, comandas, mesas e app do garçom, clientes e campanhas, avaliações, previsão de vendas e de compras |
| Completo legado (`PREMIUM`) | R$ 219,90 | ilimitados | Igual ao Completo. Ninguém usa mais (Tokyo e Kasulo passaram para o Completo em 25/11/2026) |
| Grátis (`FREE`, legado) | R$ 0 | 1 | Básico, até 50 pedidos/mês. Fora do site e do cadastro novo |

## Adicionais

- **Domínio próprio**: + R$ 49/mês em qualquer plano pago. Entra sozinho na
  mensalidade quando o domínio é vinculado no Painel INOVAS e sai quando é removido.
  O Completo legado (`PREMIUM`) não paga (já era incluso).

## Clientes atuais (25/11/2026)

- **Tokyo Sushi** e **Kasulo Rocha Pizzaria**: Completo (`PRO`), mensalidade combinada
  de R$ 349 mantida.
- **Nota fiscal (NFC-e)**: inclusa no Profissional e no Completo. Pronta no sistema,
  esperando os dados do serviço emissor (ver `docs/NOTA-FISCAL.md`).

## Como o sistema aplica

- **Servidor**: cada rota do Gestor é ligada a um recurso
  (`MODULE_FEATURE_MAP` e `DASHBOARD_ACTION_FEATURE_MAP`). Fora do plano, responde
  403 `plan_feature_forbidden`. Caixa, comandas, mesas e garçom = recurso `salon`;
  Previsão = `forecast`.
- **Gestor**: a seção fora do plano aparece no menu com cadeado e o nome do plano
  necessário. Ao abrir, mostra "faz parte do plano X" e o botão Ver planos, sem
  buscar dados.
- **Contratos antigos**: recursos criados depois (`salon`, `forecast`, `customDomain`)
  entram sozinhos para quem tem um plano que os inclui (`AUTO_RELEASED_FEATURES`).
- **Usuários**: ativos, pendentes e bloqueados ocupam vaga; desativados liberam.
  Vale para o Gestor, a API de equipe (`/api/tenant/users`) e a reativação.
- **Mensalidade**: plano + adicionais (`contractMonthlyTotals`), lançada no extrato
  pela rotina semanal (`lib/payout-runner.cjs`), com desconto por ciclo
  (`lib/billing-cycles.cjs`). O Painel INOVAS > Mensalidades mostra os adicionais.
- **Mudar de plano**: Painel INOVAS > Restaurantes > Editar dados de plataforma > Plano.
  Os recursos mudam na hora, sem perder dados.
