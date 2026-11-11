# Migração 029 em Produção: roteiro, backup e rollback

Para: Paulo, executando no console do Neon.
Preparado em 2026-11-11 a partir do commit `d4b064e` da branch `feat/novo-caixa`.

## Por que o Paulo executa, e não o Claude

As regras do projeto proíbem ler `.env.production.local` e usar a credencial de
Produção fora de Produção. Sem essa credencial não há como conectar no banco.
O console do Neon já está autenticado com a sua conta, então é o caminho mais
seguro.

## O que a 029 faz

- Cria a tabela `cash_register_table_assignments`, que guarda quais mesas
  foram abertas em cada turno do Caixa.
- Liga RLS forçado nela, com a mesma política por restaurante das outras
  tabelas do Caixa.
- Cria o índice único `dining_tables_scope_number_uidx`: duas mesas do mesmo
  restaurante não podem ter o mesmo número.
- Não altera nem apaga nenhum dado existente.

Arquivo: `migrations/029_cash_register_shift_tables_and_occupancy.sql`

SHA-256: `51be3de1d1082b932cdd008f8979697721dc972eef267978274ebbb55e4fca9f`

## O que pode dar errado

- **Mesas com número repetido:** o índice único falha e a transação inteira
  é desfeita. Nada fica pela metade. O Passo 1 detecta isso antes.
- **Caixa aberto durante a aplicação:** a 029 espera no máximo 10 s por
  trava. Se não conseguir, ela cancela sozinha. Aplique fora do horário de
  atendimento.
- **Usuário de runtime limitado sem permissão na tabela nova:** o Caixa novo
  daria erro de permissão. O Passo 3 cobre isso.

## Atenção: a 028 também falta

Em 2026-11-05 a Produção tinha as migrações até a 027. A 028 e a 029 não
estavam aplicadas. A 028 cria as permissões de menu dos restaurantes. O código
novo usa essas permissões para decidir o que aparece no menu.

O GO recebido cobre só a 029. A consulta 2 do Passo 1 mostra se a 028 está no
banco. Se não estiver, a 029 pode ser aplicada mesmo assim, mas o deploy do
código novo em Produção precisa esperar uma decisão sobre a 028.

## Passo 0: backup

1. Abra o projeto no console do Neon e vá em **Branches**.
2. Clique em **Create branch**.
3. Escolha como origem o branch de Produção, no ponto **Current data**.
4. Dê o nome `backup-antes-029-2026-11-11`.
5. Confirme que o branch novo aparece na lista antes de seguir.

Esse branch é uma cópia completa do banco neste momento. Ele é o rollback de
último recurso.

## Passo 1: checagem somente leitura

Cole no SQL Editor, no branch de Produção, o arquivo
`docs/novo-caixa/producao-029-1-checagem-somente-leitura.sql`.

| Consulta | Resultado para seguir |
|---|---|
| 1. Tabelas | Tabelas do Caixa presentes, `cash_register_table_assignments` ausente |
| 2. Permissões de menu | Anote o número: 25 ou mais indica que a 028 está aplicada |
| 3. Mesas repetidas | Nenhuma linha |
| 4. Índice da 029 | Nenhuma linha |
| 5. Usuário de runtime | Anote se existe algum `inovas_app_*` |
| 6. Caixas abertos | Nenhum com status aberto |

Se uma consulta der erro, a transação para nas seguintes. Isso também é motivo
para parar e me mandar o erro.

## Passo 2: aplicar

Cole o conteúdo inteiro de
`migrations/029_cash_register_shift_tables_and_occupancy.sql` e execute. O
arquivo já tem `BEGIN` e `COMMIT`: ou tudo é aplicado, ou nada é.

## Passo 3: permissão do usuário de runtime

Pule este passo se a consulta 5 do Passo 1 não mostrou nenhum `inovas_app_*`.
Se mostrou, troque o nome abaixo pelo nome exato e execute:

```sql
GRANT SELECT, INSERT ON cash_register_table_assignments TO inovas_app_prod;
```

## Passo 4: conferência

Cole `docs/novo-caixa/producao-029-4-conferencia.sql`. Os resultados
esperados estão escritos acima de cada consulta.

## Passo 5: registrar

Se existir uma tabela `schema_migrations`, registre a 029 no mesmo formato das
linhas anteriores, com o nome do arquivo e o SHA-256 acima. Anote também
data, hora e quem aplicou.

## Rollback

Se algo der errado depois de aplicada, e antes de o código novo ir para
Produção:

```sql
BEGIN;
DROP TABLE IF EXISTS cash_register_table_assignments;
DROP INDEX IF EXISTS dining_tables_scope_number_uidx;
COMMIT;
```

É o arquivo `migrations/029_cash_register_shift_tables_and_occupancy.rollback.sql`.
Ele apaga as mesas registradas por turno. Depois que o Caixa novo estiver em
uso, prefira restaurar pelo branch de backup em vez de rodar o rollback.

## Depois da migração

O deploy do código novo em Produção ainda depende de:

1. A decisão sobre a 028, se o Passo 1 mostrar que ela falta.
2. O merge da `feat/novo-caixa` na `main`.
3. Um GO de deploy em Production.
