# INOVAS FOOD - Roadmap V2.0+

Status: preparacao documental.
Escopo: roadmap, sem alterar codigo, banco, deploy, commit ou tag.

## 1. Objetivo da V2.0

Transformar a INOVAS Food em uma plataforma SaaS multi-restaurante preparada para escala, sem quebrar:

- Tokyo/default.
- V1.1 Gestao de Usuarios.
- V1.2 Design System e separacao sistema/restaurante.
- OWNER isolado.
- MASTER sem restaurante.
- Menus SaaS separados.

## 2. Principios

- Backend decide permissao.
- Tenant e obrigatorio para dados operacionais.
- Usuario do sistema nao pertence a restaurante.
- Usuario de restaurante nunca acessa outro restaurante.
- Plataforma INOVAS e diferente de marca do restaurante.
- Design System oficial e unico para areas internas.
- Publico usa marca do restaurante resolvido por dominio.
- Toda mudanca precisa de validador.

## 3. V2.0 - Fundacao Multi-Tenant

Escopo recomendado:

- Manifesto de rotas por escopo.
- Tenant context obrigatorio por modulo.
- Separacao de APIs plataforma/restaurante/publico/cliente.
- Configuracao publica por restaurante.
- Backfill de tenant em staging.
- Validadores multi-restaurante.
- Auditoria de hardcoded `default`, `Tokyo`, `tokyo_`.

Nao recomendado nesta fase:

- Permissoes avancadas visiveis.
- Billing real.
- IA.
- Reescrita completa do frontend.

## 4. V2.1 - RBAC Completo

Escopo:

- `module.action` como formato canonico.
- Tabelas `roles`, `role_permissions`, `user_permission_overrides`.
- Manifesto de permissoes por rota.
- UI de permissoes avancadas somente depois de validadores.
- Auditoria completa de alteracao de permissoes.

## 5. V2.2 - Modulos por Plano

Escopo:

- Recursos por plano.
- Bloqueio backend por feature.
- UI de upgrade/locked state.
- Contratos e assinatura mais claros.
- Sem cobranca real ainda se nao houver decisao comercial.

## 6. V2.3 - Financeiro Avancado

Escopo:

- Consolidado plataforma.
- Financeiro por restaurante.
- Fechamentos.
- Comissao de vendedor baseada em `seller_id`.
- Exportacao.
- Auditoria financeira.

## 7. V2.4 - Caixa/POS

Escopo:

- Perfil CAIXA com fluxo proprio.
- Pedidos locais.
- Sangria/suprimento.
- Fechamento de caixa.
- Integracao futura com impressao.

## 8. V2.5 - Mesas e Comandas

Escopo:

- Mapa de mesas.
- Comandas.
- Garcom/atendimento.
- Integracao com cozinha.
- Fechamento por mesa.

## 9. V2.6 - Cozinha/KDS e Tablets

Escopo:

- Tela cozinha otimizada.
- Tempo de preparo.
- Status por item.
- Dispositivos por setor.
- Modo tablet.

## 10. V2.7 - Bar e Setores

Escopo:

- Perfil BAR se aprovado.
- Separacao cozinha/bar.
- Roteamento de itens por setor.
- Impressao/setor futura.

## 11. V2.8 - IA

Escopo:

- IA para atendimento WhatsApp.
- Sugestao de cardapio.
- Analise de vendas.
- Alertas operacionais.
- Somente apos dados, permissoes e auditoria estabilizados.

## 12. V3.0 - Expansao Nacional

Escopo:

- Multi-regiao.
- Observabilidade madura.
- Billing integrado.
- Marketplace de modulos.
- SLA e suporte.
- Relatorios executivos por rede/franquia.

## 13. Refatoracoes Necessarias

Alta prioridade:

- Dividir `admin/admin.js`.
- Dividir `script.js`.
- Criar controllers backend por modulo.
- Criar manifesto de rotas.
- Transformar config publica em tenant-aware.
- Criar testes multi-restaurante reais.

Media prioridade:

- Reduzir CSS legado.
- Criar biblioteca de componentes admin.
- Criar auditoria automatica de arquivos temporarios.
- Criar camada de repositorios por entidade.
- Criar cache/agregados para master dashboard.

Baixa prioridade:

- Padronizar nomenclatura interna.
- Remover aliases legados apos janela de compatibilidade.
- Organizar historico de docs antigas.

## 14. Gates de Qualidade

Nenhuma fase deve avancar sem:

- `git diff --check`.
- Validadores V1.1 e V1.2 passando.
- Validador especifico da fase.
- Teste negativo de permissao.
- Teste de OWNER isolado.
- Teste MASTER sem restaurante.
- Teste de restaurante default Tokyo.
- Smoke admin e publico.
- Revisao visual quando houver frontend.

## 15. Escala Esperada

100 restaurantes:

- V2.0 deve suportar com tenant context e indices.

500 restaurantes:

- Exigir paginacao real, filtros por restaurante e cache de configuracao.

2000 restaurantes:

- Exigir agregados, jobs e dashboards precomputados.

10000 restaurantes:

- Exigir arquitetura de dados mais madura, observabilidade e possivel particionamento.

## 16. Pendencias Tecnicas Registradas

- Consolidar rotas master no deploy/rewrite.
- Eliminar dependencia de `default` fora de legado/teste.
- Transformar `site-config.js` em config resolvida por dominio.
- Consolidar permissao `module.action`.
- Preparar CSRF/CSP.
- Criar auditoria central.
- Limpar arquivos temporarios em tarefa separada.

## 17. Recomendacao Final

A V2.0 deve ser uma versao de fundacao, nao de acumulacao de features. O caminho mais seguro e estabilizar tenant, escopo, permissao, rotas e Design System como contratos reutilizaveis. Depois disso, POS, mesas, KDS, financeiro avancado e IA ficam muito mais baratos e seguros de construir.
