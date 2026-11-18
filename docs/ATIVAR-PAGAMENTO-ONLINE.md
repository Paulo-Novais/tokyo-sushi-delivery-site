# Ativar o pagamento online (Stone/Pagar.me) — passo a passo

Tudo já está publicado no site, mas **desligado**. Ele liga sozinho quando os
itens abaixo estiverem prontos. Nenhuma senha/chave deve ser colada no chat,
no código ou em documentos: só na Vercel e no painel da Pagar.me.

## 1. Banco de dados (Neon) — uma vez só

1. Neon → projeto do INOVAS → **Branches** → crie um backup da branch de
   produção (ex.: `backup-antes-pagamentos`).
2. Neon → **SQL Editor** (branch de produção). Abra cada arquivo abaixo no
   GitHub, copie **todo** o conteúdo, cole e clique **Run**, nesta ordem:
   1. `migrations/030_cash_register_operations.sql`
   2. `migrations/031_restaurant_presence.sql`
   3. `migrations/032_restaurant_payouts.sql`
   4. `migrations/033_online_payments.sql`
   5. `migrations/034_payments_runtime_grants.sql`
   (Avisos "does not exist, skipping" são normais. A 034 deve mostrar
   "Permissoes concedidas para ...".)
3. Se algo der errado: rode os arquivos `.rollback.sql` na ordem inversa
   (034 → 030) ou volte para a branch de backup.

⚠️ A 031 liga a regra "Gestor aberto": sem o Gestor (app) aberto no
restaurante, o site para de aceitar pedidos. Rode com o app aberto no Tokyo.

Testado em um banco PostgreSQL 16 de teste: as 5 aplicam, podem ser rodadas
de novo sem erro, as voltas apagam tudo e as regras de segurança funcionam
(restaurante não grava no extrato; só lê o próprio).

## 2. Conta na Pagar.me (Stone)

Peça ao comercial: **"split de pagamento para marketplace"**, com Pix,
crédito, débito e voucher (VR/VA) online, saque/transferência por API e
ambiente de testes (sandbox). Anote as taxas de cada forma.

## 3. Variáveis na Vercel (Settings → Environment Variables → Production)

| Nome | Valor |
|---|---|
| `PAGARME_SECRET_KEY` | chave secreta (teste: `sk_test_...`; real: `sk_...`) |
| `PAGARME_API_URL` | só no teste: `https://sdx-api.pagar.me/core/v5` (no real, apague) |
| `PAGARME_WEBHOOK_TOKEN` | uma senha longa inventada (20+ letras e números) |
| `CRON_SECRET` | outra senha longa inventada (repasse de quarta-feira) |
| `PAGARME_CHECKOUT_METHODS` | `credit_card,debit_card,pix,voucher` (tire o que a Pagar.me não liberar) |
| `PAGARME_PLATFORM_RECIPIENT_ID` | código do recebedor da própria INOVAS na Pagar.me (`re_...`): a taxa INOVAS de 1,5% cai direto nele em cada venda |
| `INOVAS_PLATFORM_FEE_BPS` | opcional: taxa INOVAS em centésimos de % (padrão `150` = 1,5%) |
| `INOVAS_PAYMENT_FEE_ESTIMATES` | taxas do contrato, ex.: `{"pix":{"percentBps":99},"credit_card":{"percentBps":349},"debit_card":{"percentBps":149},"meal_voucher":{"percentBps":600}}` (99 = 0,99%) |

Depois de salvar: Deployments → último → **Redeploy**.

## 4. Painel da Pagar.me → Webhooks

URL: `https://inovasfood.com.br/api/payments/webhook?token=` + o mesmo valor
de `PAGARME_WEBHOOK_TOKEN`. Eventos: `order.paid`, `order.payment_failed`,
`order.canceled`, `charge.paid`, `charge.refunded`.

## 4.1 Taxas e mensalidade (como o restaurante é cobrado)

- Em cada venda online saem: a taxa da operadora (Pix, crédito, débito,
  VR/VA) e a **taxa INOVAS de 1,5%**. Tudo aparece separado no extrato e
  é descontado no repasse de quarta-feira. Pedido devolvido: a taxa INOVAS
  volta para o restaurante (a da operadora, não).
- Mensalidade: cobrada pela rotina no início de cada ciclo do contrato —
  Mensal; Trimestral (R$ 15 de desconto no total); Semestral (R$ 30);
  Anual (8%). O ciclo é escolhido no painel INOVAS > Mensalidades e repasses.
- Quem não usa pagamento online paga a mensalidade por fora; a INOVAS
  registra o pagamento no mesmo painel (botão "Registrar pagamento").
- Contador: com a taxa de 1,5%, a INOVAS passa a ter receita de comissão
  (intermediação) além da mensalidade. Confirme CNAE e tributação.

## 5. Cada restaurante (atuais e novos)

Gestor → **Configurações → Pagamentos e repasses** (só o dono):
1. Cadastra a conta bancária (CPF/CNPJ, banco, agência, conta).
2. Liga as formas que quer aceitar (Pix, Crédito, Débito, VR/VA).
Enquanto não cadastrar a conta, o Gestor mostra o aviso "Obrigatório".
Se o recebedor ficar "Em análise", a INOVAS completa o cadastro no painel
da Pagar.me e vincula o código (`/api/system/restaurants/<chave>/payment-account`).

## 6. Primeiro teste (sandbox)

No site do Tokyo: carrinho → "Pix (pagar agora)" → pagar no checkout de
teste → o pedido aparece no Gestor como **PAGO ONLINE** → Financeiro mostra a
venda e a taxa → cancelar o pedido devolve o valor. Conferido isso, troque
para a chave real (`sk_...`) e apague `PAGARME_API_URL`.
