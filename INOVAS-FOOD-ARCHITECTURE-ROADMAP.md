# INovas Food - Architecture Roadmap

Data da auditoria: 2026-06-25

Objetivo: evoluir a plataforma de cliente modelo para arquitetura SaaS/Enterprise sem reescrita.

## Arquitetura Atual

Caracteristicas:

- Um restaurante real/default.
- Frontend publico estatico com `script.js` e `styles.css`.
- Gestor administrativo rico em `admin/admin.js` e `admin/admin.css`.
- Painel master conceitual em `admin/master.js`.
- APIs serverless em `/api`.
- Stores por dominio em `lib`.
- Neon quando `DATABASE_URL` existe; arquivo local em desenvolvimento; `disabled` em producao sem banco.
- `restaurant_key default` em master, usuarios e configuracoes.
- Sem `restaurant_id` real.
- Sem multi-restaurante real.

Objetivo desta fase:

- Manter estabilidade.
- Preservar dominio, layout, APIs e regras.
- Documentar acoplamentos e limites.
- Corrigir apenas bugs pequenos e seguros.

## Arquitetura V2

Foco: consolidar a plataforma single-restaurant com base forte para crescer.

Entregas recomendadas:

- ADR de tenant futuro, sem implementar multi-restaurante.
- Migracoes versionadas para schemas existentes.
- Otimizacao de imagens grandes.
- Separacao gradual de responsabilidades em `script.js`.
- Separacao gradual de modulos em `admin/admin.js`.
- Camada compartilhada para storage mode, erros e helpers novos.
- Observabilidade basica por rota e storage mode.
- Consolidacao da fonte de configuracao para reduzir drift.

Criterios de saida:

- Build/testes continuam protegendo dominio e regras atuais.
- Nenhum endpoint atual quebra.
- Bundle publico/admin com tendencia de reducao.
- Migrations conseguem recriar schema em ambiente limpo.

## Arquitetura V2.5

Foco: preparar a virada para multiplos clientes sem abrir multi-restaurante real.

Entregas recomendadas:

- `TenantContext` interno desenhado e testado em modo default-only.
- Resolver dominio -> contexto em modo compatibilidade, sempre retornando default.
- Plano de migracao de dados default para futuro escopo.
- Separacao do catalogo base de `script.js`.
- Normalizacao parcial do master data: restaurantes, planos, recursos, dominios e contratos.
- Indices planejados por escopo/data/status.
- Contratos de API documentados.
- Auditoria de permissao por modulo e escopo.

Criterios de saida:

- Toda nova query interna nasce preparada para receber contexto.
- O sistema ainda opera como um restaurante.
- O painel master deixa claro o que e real e o que e preparatorio.

## Arquitetura V3

Foco: primeiro multi-restaurante controlado.

Entregas recomendadas:

- Introduzir chave interna de escopo em banco via migracoes controladas.
- Migrar pedidos, clientes, catalogo, delivery, financeiro, estoque e reviews.
- Aplicar filtros obrigatorios por escopo em todos os stores.
- Criar testes contra vazamento entre restaurantes.
- Criar dominio/subdominio por restaurante com resolver real.
- Normalizar usuarios em identidade + membership + permissoes.
- Preparar billing/contratos por organizacao/restaurante.

Criterios de saida:

- 2 a 10 restaurantes reais podem operar sem dados cruzados.
- Restaurantes compartilham plataforma, mas nao dados operacionais.
- Compatibilidade com restaurante default preservada.

## Arquitetura SaaS

Foco: operar dezenas/centenas de restaurantes com onboarding repetivel.

Entregas recomendadas:

- Provisionamento de restaurante/organizacao.
- Dominios, DNS e SSL gerenciaveis.
- Planos/assinaturas normalizados.
- Feature flags por plano e override.
- Relatorios por tenant e master agregados.
- Jobs para integracoes, WhatsApp, marketing e relatorios.
- Rate limits por tenant/rota/integracao.
- Backups e exportacao por tenant.
- Logs, metricas e suporte por restaurante.

Criterios de saida:

- Onboarding sem intervencao tecnica manual pesada.
- Equipe consegue identificar problemas por restaurante.
- Modulos pagos podem ser ativados/desativados com seguranca.

## Arquitetura Enterprise

Foco: redes, franquias, grupos e operacoes de alto volume.

Entregas recomendadas:

- `organization_id` acima de varios restaurantes.
- Permissoes hierarquicas por grupo, unidade e papel.
- Multi-unidade, estoque por local, relatorios consolidados.
- SSO/OIDC para clientes enterprise.
- Auditoria imutavel e exportavel.
- SLA, alertas e observabilidade avancada.
- Data warehouse/BI para relatorios pesados.
- Estrategia de particionamento/arquivamento de pedidos e eventos.
- Governanca de integracoes por ambiente e credencial.

Criterios de saida:

- 1000 restaurantes podem operar sem reescrita de dominio.
- Relatorios pesados nao afetam pedidos.
- Suporte e auditoria conseguem rastrear qualquer acao por tenant/usuario/modulo.

## Sequencia Recomendada

1. Nao criar `restaurant_id` agora.
2. Documentar e congelar contratos atuais.
3. Otimizar assets e bundles.
4. Criar migrations.
5. Separar catalogo de UI.
6. Criar contexto default-only.
7. Normalizar master data.
8. Migrar tabelas centrais com escopo.
9. Ativar multi-restaurante controlado.
10. Evoluir para SaaS e Enterprise.

## Decisoes Que Evitam Reescrita

- Nao adicionar novos modulos operacionais antes do tenant design.
- Nao renomear cookies/headers sem compatibilidade.
- Nao espalhar regras de plano/permissao fora da camada atual.
- Nao criar tabelas novas globais para modulos futuros.
- Nao deixar integracoes externas sem dono/escopo.
- Nao fazer relatorios pesados em tempo real quando houver escala.

## Conclusao

O caminho mais seguro e evolutivo: fortalecer a base single-restaurant, preparar contexto interno em modo default-only, migrar dados com escopo e so entao abrir multi-restaurante. Isso reduz a chance de reescrita quando a INovas Food crescer para SaaS e Enterprise.
