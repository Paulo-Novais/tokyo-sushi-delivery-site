# Adicionais do plano

Recursos extras que o restaurante liga e desliga quando quiser (Tela da
cozinha, Balança, QR na mesa…). Cada um tem valor mensal próprio, somado à
mensalidade.

## Onde fica

- **Painel INOVAS › Planos e adicionais**
  - Aba **Restaurantes**: quanto cada um paga por mês e o que está ligado.
    Clique no restaurante para ver detalhes, histórico, **Dar cortesia**,
    ligar/desligar em nome dele e ir para as mensalidades.
  - Aba **Catálogo de adicionais**: **Criar adicional** / Editar.
- **Gestor › Configurações › Plano e adicionais** (dono do restaurante):
  cartões com liga/desliga e o resumo da próxima mensalidade.

## Criar um adicional (Painel INOVAS)

1. Nome, grupo, descrição curta para o dono e ícone.
2. Valor por mês e, para cada plano: **Pago à parte**, **Incluso no plano**
   ou **Não disponível**. "Quem pode ligar": o dono sozinho ou só a INOVAS.
3. **Link da tela** que o adicional libera — só endereços da plataforma
   (`/admin/...` ou `/garcom/...`). Enquanto estiver desligado, quem abrir
   esse link no Gestor é levado para "Plano e adicionais".
4. Situação: **Rascunho** (ninguém vê) ou **Disponível**.

Os 6 adicionais iniciais (Tela da cozinha R$ 9,90, Balança R$ 14,90, QR na
mesa R$ 12,90, Avisos no WhatsApp R$ 29,90, Fidelidade R$ 9,90, Ficha técnica
R$ 9,90) estão em **Rascunho**: as telas deles ainda não existem. Quando cada
tela ficar pronta, é só mudar para "Disponível".

## Regras de cobrança

- **Ligou no meio do mês** → paga o **mês inteiro**. O valor entra no extrato
  na hora ("Novembro/2026 · Adicional X").
- **Desligou** → continua funcionando até o fim do mês já pago; no dia 01
  desliga sozinho e **não é cobrado**.
- **Religou antes do fim do mês** → sem custo extra (a cobrança tem uma chave
  por adicional e mês: `addon:<adicional>:<AAAA-MM>`).
- **Todo mês** a rotina da mensalidade lança o plano (+ domínio − desconto) e,
  separados, os adicionais ligados.
- Contrato em **teste grátis** não paga adicional.
- **Cortesia** (só INOVAS, com motivo obrigatório que vai para a auditoria):
  um adicional sem cobrar ou % de desconto no plano, por 1, 3, 6 meses ou sem
  prazo. Quando acaba, volta ao normal: se o dono tinha ligado, volta a
  cobrar; se não, fica desligado e ele escolhe se quer continuar pagando.

## Arquivos

- `lib/plan-addons.cjs` — regras (catálogo, ligar/desligar, cortesia, totais).
- `lib/plan-addon-billing.cjs` — lançamento no extrato.
- `lib/master-platform-store.cjs` — onde fica guardado (catálogo em
  `addonCatalog`; por restaurante em `planAddons`, `planDiscount`,
  `addonHistory`).
- Rotas: `GET/POST /api/admin/settings/addons(-toggle)` (Gestor) e
  `/api/system/addons…` (Painel INOVAS).
- Testes: `tests/unit/adicionais-plano.test.cjs`, `tests/e2e/adicionais-plano.spec.js`.

Não precisa de migração de banco (fica no mesmo registro da plataforma).
