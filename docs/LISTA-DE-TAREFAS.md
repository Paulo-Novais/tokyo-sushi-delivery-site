# Lista de tarefas — INOVAS Food

Atualizada em 19/11/2026. Marque `[x]` quando terminar.

## Estudo e planejamento (próximas)

- [ ] **Revisar toda a estrutura do sistema**: código, banco, segurança,
      isolamento entre restaurantes, testes instáveis, desempenho e pontos
      frágeis. Resultado: relatório com o que corrigir, em ordem.
- [x] **MenuDino e Consumer**: levantar serviços, planos, preços e taxas atuais.
- [x] **Saipos**: levantar serviços, planos, preços e taxas atuais.
- [x] **iFood (para o restaurante)**: Gestor de Pedidos, cardápio próprio,
      entregas, taxas e o que oferecem.
- [x] **Comparação de todos com o INOVAS**: tabela lado a lado (funções,
      preço, taxas), onde ganhamos e onde perdemos.
- [x] **Lista de prioridade do que acrescentar**: ordenada por importância
      (ganho para o restaurante x esforço).

Resultado: `docs/COMPARATIVO-CONCORRENCIA.md` (19/11/2026).

## Próximos recursos (decisão do Paulo, 19/11/2026)

**Agora**
1. [ ] **Emissão de NFC-e automática** (por serviço pronto de notas).
2. [ ] **KDS (tela da cozinha)** — replicar o projeto parecido que já existe.

**Mais à frente**
3. [ ] **Ficha técnica** (custo de cada prato) — complexo, mas útil para o restaurante.
4. [ ] **QR code na mesa** caindo na comanda do Caixa — não descartado.
5. [ ] **Central de entrega INOVAS** (estilo Uber): app do entregador ligado
       ao site, acompanhamento em tempo real do entregador que pega o pedido
       no restaurante parceiro, e entregador sob demanda para quem pedir.
6. [ ] **Fidelidade/cashback por conta da INOVAS** (hoje o restaurante já
       faz pela tela de clientes/cupons).
7. [ ] **App na loja** — para o garçom entrar no restaurante.
8. [ ] Totem de autoatendimento — a avaliar.

**Fora do escopo**
- Robô de WhatsApp: o site já mostra o andamento do pedido.
- Maquininha integrada no salão: é do restaurante; online já temos.
- Várias lojas na mesma conta: cada restaurante tem contrato próprio.

## Revisão dos planos e preços (a fazer depois — decisões do Paulo, 19/11/2026)

- [ ] **Essencial: R$ 109,90/mês** (hoje R$ 49,90), com **primeiro mês por R$ 49,90**.
- [x] **Domínio próprio é adicional à parte** em todos os planos (feito 19/11: site, calculadora e cadastro) (hoje aparece
      "incluso" no Completo: site de vendas, cadastro do Painel INOVAS e
      cobrança).
- [ ] **Nota fiscal automática é adicional à parte** (já é + R$ 49,90; confirmar
      valor e em quais planos).
- [ ] Revisar o que cada plano oferece e os valores (Grátis, Essencial,
      Profissional, Completo), e depois atualizar juntos: página de planos
      (inovas.html/index.html), cadastro do Painel INOVAS, tabela de planos do
      servidor e textos de economia/comparação.

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

- [x] Cadastro novo de restaurante no Painel INOVAS (8 etapas): CNPJ/CEP automáticos, categoria (Delivery/Restaurante/Super), plano + ciclo + adicional de nota fiscal (R$ 49,90, mensalidade soma sozinha), site, domínio, pagamento online (Pix e crédito). Falta: tela de nota fiscal no Gestor (certificado, CSC, códigos) e a emissão.

- [x] Tela de Pedidos: abas Delivery/Salão, origem (INOVAS, iFood, Uber,
      99Food, Keeta), filtro, "Aceite em X min", alerta de cancelamento.
- [x] Banco de produção atualizado (030 a 035). Sem backup prévio (volta: arquivos .rollback.sql ou restauração do Neon até ~15h de 19/11). Próximas: backup ANTES.
- [x] Senhas internas na Vercel (`PAGARME_WEBHOOK_TOKEN`, `CRON_SECRET`).
- [x] Senha do banco retirada da Vercel (produção); fica só no GitHub.
