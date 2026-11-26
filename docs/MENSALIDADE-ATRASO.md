# Mensalidade atrasada: prazo e bloqueio

Só a equipe INOVAS (usuários do painel System) dá prazo, bloqueia ou libera.
O dono do restaurante e os usuários do restaurante só veem o aviso.

## Onde fica

Painel INOVAS → **Mensalidades e repasses**.

| Situação         | Quando                                                  |
|------------------|---------------------------------------------------------|
| Em dia           | nada devendo                                            |
| A vencer         | devendo, cobrança recente (até 10 dias)                 |
| Em atraso        | devendo há mais de 10 dias, sem prazo                   |
| Com prazo        | devendo, com prazo dado e ainda dentro do prazo         |
| Prazo vencido    | devendo e o prazo já passou                             |
| Bloqueado        | acesso suspenso: site fora do ar e Gestor travado       |

## Botões

- **Dar prazo / Mudar prazo**: data limite ("pagar até"), observação interna e a
  opção **"Bloquear sozinho se não pagar até essa data"**. O prazo vale até o
  fim do dia (horário de Brasília). Data no passado é recusada.
- **Tirar prazo**: apaga o prazo.
- **Bloquear agora**: pede confirmação; o site sai do ar e o Gestor (e o app
  PDV) mostra a tela "Sistema bloqueado por mensalidade em atraso".
- **Liberar acesso**: volta tudo ao normal (também apaga o prazo).
- **Registrar pagamento**: se quitar tudo, apaga o prazo e, se o bloqueio foi
  por mensalidade, **libera o acesso sozinho**.

## O que o restaurante vê

- Com prazo: faixa amarela no topo do Gestor — "Mensalidade em atraso. Prazo
  para pagamento: dd/mm/aaaa". A observação interna não aparece.
- Bloqueado: tela de bloqueio com botão "Sair". A API do Gestor responde 403
  `restaurant_access_suspended`. O suporte INOVAS continua entrando.

## Rotina automática

`/api/payments/cron-billing` roda todo dia às 06:17 (Brasília), com
`CRON_SECRET`. Ela bloqueia quem está com **prazo vencido e "bloquear sozinho"
marcado** e apaga o prazo de quem já pagou. Sem a opção marcada, nada é
bloqueado sozinho: aparece "Prazo vencido" com o botão "Bloquear agora".

## Permissões

- Dar/tirar prazo: `system.billing.manage`.
- Bloquear/liberar: `system.billing.manage` + `system.restaurants.suspend`.
- Tudo vai para a auditoria com o usuário do System (prazo, bloqueio e
  liberação, inclusive a automática).
