# INovas Food - Disaster Recovery Plan

Data: 2026-06-25

Escopo: plano futuro de recuperacao de desastres. Este documento nao executa failover, nao altera infraestrutura, nao muda DNS e nao toca em dados reais.

## Objetivo

Preparar a INovas Food para responder a falhas graves sem improviso, reduzindo perda de dados, indisponibilidade e impacto nos restaurantes.

## Severidades

| Severidade | Exemplo | Resposta |
| --- | --- | --- |
| P1 | checkout fora, banco fora, admin fora para todos | Acionar incidente imediato |
| P2 | WhatsApp fora, Maps fora, latencia alta | Operar fallback e monitorar |
| P3 | falha parcial em modulo nao critico | Corrigir em horario comercial |
| P4 | bug visual/documental | Planejar backlog |

## Queda do Banco

Impacto:

- Pedidos podem nao ser criados.
- Gestor pode nao listar pedidos.
- Financeiro/estoque/configuracoes ficam indisponiveis.

Procedimento:

1. Confirmar se e falha do banco ou de rede.
2. Pausar qualquer migration/job.
3. Verificar status do provedor.
4. Comunicar time e suporte.
5. Ativar pagina/status interno.
6. Se houver replica/failover futuro, promover replica conforme runbook.
7. Se necessario, restaurar snapshot em ambiente novo.
8. Rodar smoke test de pedido/admin.
9. Registrar janela de indisponibilidade.

Fallback:

- Nao salvar pedidos localmente em producao sem banco persistente.
- Mostrar mensagem clara para cliente se checkout falhar.

## Queda do Servidor/Functions

Contexto atual:

- Plataforma depende de Vercel Functions para APIs.

Procedimento:

1. Validar erro em rota publica e admin.
2. Checar status da Vercel.
3. Checar logs recentes.
4. Identificar se erro e deploy, env ou dependencia.
5. Se causado por release, rollback para deployment anterior.
6. Rodar smoke test.

## Queda da Vercel

Impacto:

- Site, admin e APIs podem ficar indisponiveis.

Procedimento:

1. Confirmar status oficial da Vercel.
2. Comunicar incidente.
3. Pausar deploys.
4. Se houver arquitetura futura multi-provider, acionar plano de contingencia.
5. Se nao houver, aguardar recuperacao e manter canal de comunicacao.

Preparacao futura:

- DNS com Cloudflare.
- Pagina de status externa.
- Backups fora da Vercel.
- Runbook de redeploy em projeto/regiao alternativa.

## Queda do WhatsApp

Impacto:

- Login cliente por codigo pode falhar.
- Notificacoes futuras podem falhar.
- IA WhatsApp futura para.

Procedimento:

1. Verificar taxa de erro da API WhatsApp.
2. Confirmar status Meta/WhatsApp.
3. Ativar mensagem de indisponibilidade.
4. Em ambiente local, fallback provisorio continua apenas para validacao.
5. Em producao, nao expor codigo provisorio.
6. Registrar falhas e reprocessar notificacoes quando seguro.

Fallback futuro:

- Login por email/SMS como opcao, se produto decidir.
- Handoff para atendimento manual.

## Queda do Google Maps

Impacto:

- Calculo automatico de distancia/rota pode falhar.
- Estimativa de entrega pode ficar indisponivel.

Procedimento:

1. Confirmar erro Maps vs chave/referrer.
2. Validar fallback manual atual.
3. Comunicar que endereco sera confirmado pela operacao.
4. Monitorar volume de fallback.

Fallback:

- Usar modo manual/provisorio atual.
- Usar faixas/bairros configurados quando possivel.
- Nao bloquear pedido se regra de negocio permitir confirmacao manual.

## Queda do Gateway de Pagamento Futuro

Impacto:

- Pagamento online indisponivel.
- Confirmacao de pagamento atrasada.
- Webhook pode falhar.

Procedimento futuro:

1. Pausar opcao de pagamento afetada.
2. Manter pagamento na entrega/retirada se permitido.
3. Registrar transacoes pendentes.
4. Reconciliar webhooks atrasados.
5. Nao marcar pedido como pago sem confirmacao.

## Queda de DNS

Impacto:

- Dominio publico pode nao resolver.
- Clientes nao acessam site/admin.

Procedimento:

1. Confirmar DNS via multiplos resolvedores.
2. Checar status do provedor DNS.
3. Validar registros apex/www.
4. Se Cloudflare futuro estiver ativo, revisar regras e proxy.
5. Comunicar URL alternativa somente se segura e aprovada.

Preparacao:

- DNS gerenciado com historico.
- TTL apropriado.
- Export de zona.
- Monitor de DNS.

## Queda de APIs Externas

Inclui:

- ViaCEP.
- WhatsApp.
- Maps.
- Gateway futuro.
- iFood/Rappi futuro.
- Email/SMS futuro.

Procedimento:

1. Identificar dependencia e taxa de falha.
2. Aplicar timeout curto.
3. Usar retry com backoff quando seguro.
4. Acionar fallback.
5. Registrar fila de reprocessamento se houver.
6. Comunicar impacto.

## Incidente de Seguranca

Procedimento:

1. Revogar/rotacionar secrets comprometidos.
2. Bloquear acesso afetado.
3. Preservar logs.
4. Identificar escopo.
5. Notificar stakeholders conforme LGPD/contrato.
6. Fazer postmortem.

## Comunicacao

Canais:

- Interno tecnico.
- Fundador/diretoria.
- Suporte.
- Restaurantes afetados.
- Status page futura.

Mensagem deve conter:

- O que aconteceu.
- Quem foi afetado.
- O que esta sendo feito.
- Proxima atualizacao.
- Impacto conhecido.

## Pos-Mortem

Todo P1/P2 deve gerar:

- Linha do tempo.
- Causa raiz.
- Impacto.
- Dados perdidos, se houver.
- O que funcionou.
- O que falhou.
- Acoes preventivas.
- Donos e prazos.
