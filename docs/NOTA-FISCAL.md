# Nota fiscal (NFC-e)

Pronta no sistema, **esperando só os dados do serviço emissor**. Inclusa nos
planos **Profissional** e **Completo**.

## Como funciona

- **Gestor > Resultados > NFC-e** (aba nova): pedidos do período (hoje, ontem,
  7 dias, mês) com a situação da nota de cada um; chave **Automático / Eu
  escolho**; **Emitir**, **Não emitir** (pode desfazer), **Tentar de novo**,
  **Ver nota** e **Cancelar**; selecionar vários e emitir ou marcar de uma vez.
  No plano Essencial o item aparece com cadeado (Profissional).

- **Gestor > Configurações > Nota fiscal**: razão social, CNPJ, inscrição
  estadual, regime de impostos, série, ID do CSC, NCM/CFOP padrão e "emitir
  sozinho". O **certificado A1 (.pfx + senha)** e o **CSC** vão direto para o
  serviço emissor e **não ficam guardados na INOVAS**.
- **Automático**: pedido **entregue** ou **retirado** → a nota sai sozinha.
  Pedido **cancelado** → a nota é cancelada junto.
- **No pedido** (app PDV/Gestor): bloco "Nota fiscal" com situação, **Ver nota**
  (DANFE), **Emitir nota fiscal** (ex.: salão) e **Cancelar nota**.
- Uma nota por pedido (emitir de novo não duplica). Cada restaurante só vê as
  próprias notas.
- Bebidas são reconhecidas pelo nome/categoria (NCM de bebidas); o resto usa o
  NCM de comidas. Cada item do cardápio pode ter NCM/CFOP próprios (campos
  `ncm`/`cfop`).

## Para ativar (INOVAS)

1. **Contratar o emissor**: recomendado **Focus NFe**, plano multiempresa
   (ver `docs/COMPARATIVO-NFCE.md`).
2. **Vercel > Environment Variables** (produção), cadastradas pelo Paulo:
   - `FISCAL_PROVIDER` = `focusnfe`
   - `FOCUSNFE_TOKEN` = token principal da conta (segredo)
   - `FOCUSNFE_ENV` = `homologacao` (teste) → depois `producao`
3. **Banco**: rodar a ação **"Aplicar atualização 037 (nota fiscal)"**
   (Actions, digitando `APLICAR-037`), com GO e backup do Neon antes.
4. **Restaurante**: preencher Configurações > Nota fiscal e enviar certificado
   + CSC de **homologação**. Fazer pedidos de teste e conferir as notas.
5. **Produção**: trocar `FOCUSNFE_ENV` para `producao` e o restaurante reenviar
   o **CSC de produção** na mesma tela.

## A conferir na homologação (Focus NFe)

- Nomes dos campos da API v2 (`/v2/nfce`, `/v2/empresas`) seguem a documentação
  pública; validar com a primeira nota de teste.
- Se a conta exigir o **token de cada empresa** para emitir (e não o token
  principal + `cnpj_emitente`), ajustar `lib/fiscal-provider.cjs`.
- NCM, CFOP, CSOSN/CST e CST de PIS/COFINS padrão: **o contador de cada
  restaurante confere** (padrões: 21069090, 22021000, 5102, 102, 49).

## Código

- `lib/fiscal-provider.cjs` (Focus NFe + simulador), `lib/fiscal-invoices.cjs`
  (montar/emitir/cancelar), `lib/fiscal-invoice-store.cjs`, `lib/fiscal-settings.cjs`.
- API: `GET/POST /api/admin/settings/fiscal|fiscal-save`,
  `GET /api/admin/orders/invoice|fiscal-list`,
  `POST /api/admin/orders/invoice-emit|invoice-cancel|invoice-skip|invoice-unskip`
  (`invoice-emit` e `invoice-skip` aceitam `orderIds` para vários, até 30).
- Banco: `migrations/037_fiscal_invoices.sql` (testada com
  `node scripts/validate-fiscal-migration.mjs`).
- Testes: `tests/unit/nota-fiscal.test.cjs`, `tests/e2e/nota-fiscal.spec.js`.
