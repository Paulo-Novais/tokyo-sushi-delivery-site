# Lista de tarefas — INOVAS Food

Atualizada em 19/11/2026. Marque `[x]` quando terminar.

## Estudo e planejamento (próximas)

- [ ] **Revisar toda a estrutura do sistema**: código, banco, segurança,
      isolamento entre restaurantes, testes instáveis, desempenho e pontos
      frágeis. Resultado: relatório com o que corrigir, em ordem.
- [ ] **MenuDino e Consumer**: levantar serviços, planos, preços e taxas atuais.
- [ ] **Saipos**: levantar serviços, planos, preços e taxas atuais.
- [ ] **iFood (para o restaurante)**: Gestor de Pedidos, cardápio próprio,
      entregas, taxas e o que oferecem.
- [ ] **Comparação de todos com o INOVAS**: tabela lado a lado (funções,
      preço, taxas), onde ganhamos e onde perdemos.
- [ ] **Lista de prioridade do que acrescentar**: ordenada por importância
      (ganho para o restaurante x esforço).

## Ativação (depende de terceiros)

- [ ] **Pagar.me (Stone)** — aguardando a Stone liberar a conta.
  1. Paulo: chave `sk_test_...` e recebedor `re_...` na Vercel
     (`PAGARME_SECRET_KEY`, `PAGARME_API_URL`, `PAGARME_PLATFORM_RECIPIENT_ID`).
  2. Publicar de novo o site.
  3. Webhook na Pagar.me: `https://inovasfood.com.br/api/payments/webhook?token=`
     + valor de `PAGARME_WEBHOOK_TOKEN` (já criado na Vercel).
  4. Pix de teste no Tokyo → pedido "PAGO ONLINE" no Gestor.
  5. Trocar para a chave real.
- [ ] **CNPJ**: confirmar com o contador se o CNPJ atual (MEI) serve para a
      taxa de intermediação de 1,5%.
- [ ] **iFood**: cadastro da INOVAS como empresa de software e homologação.
- [ ] **99Food e Keeta**: pedir credenciais Open Delivery.
- [ ] Apagar na Vercel as linhas `MIGRATION_DATABASE_URL` (produção já sem
      senha; a de preview ainda tem valor — confirmar se é usada).

## Pendências antigas

- [ ] Permissão do garçom no banco (`tenant.navigation.cash_register` para WAITER).
- [ ] App do Caixa offline (próximas etapas).
- [ ] Identidade na Microsoft Store.
- [ ] Segredos `GARCOM_*` (assinatura oficial do APK do garçom).
- [ ] Testes de integração às vezes falham no servidor de teste local
      ("Usuario administrativo nao encontrado") — investigar.

## Feito em 19/11/2026

- [x] Tela de Pedidos: abas Delivery/Salão, origem (INOVAS, iFood, Uber,
      99Food, Keeta), filtro, "Aceite em X min", alerta de cancelamento.
- [x] Banco de produção atualizado (030 a 035). Sem backup prévio (volta: arquivos .rollback.sql ou restauração do Neon até ~15h de 19/11). Próximas: backup ANTES.
- [x] Senhas internas na Vercel (`PAGARME_WEBHOOK_TOKEN`, `CRON_SECRET`).
- [x] Senha do banco retirada da Vercel (produção); fica só no GitHub.
