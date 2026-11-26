# INovas Food - Next 100 Steps

Data: 2026-06-25

Escopo: lista priorizada de proximos passos. Nao e ordem de implementacao obrigatoria linha a linha; e uma referencia estrategica para planejar releases. Nenhum item foi executado neste documento.

## Principios

- Nao criar multi-restaurante antes de isolamento.
- Nao criar `restaurant_id` sem migration, rollback e testes.
- Nao trocar contratos legados sem compatibilidade.
- Nao adicionar modulos pesados antes da V1 estabilizada.
- Toda nova capacidade futura deve passar por plano, contrato, permissao, feature flag, auditoria e contexto.

## Proximos 100 Passos

1. Congelar novas funcionalidades ate concluir pre-deploy da V1.
2. Revisar `git status` e separar trabalho por grupos: codigo, docs, evidencias, artefatos.
3. Remover do indice Git artefatos `.tmp`, `.codex-tools`, caches e outputs, sem apagar evidencias importantes.
4. Confirmar que `.gitignore` cobre temporarios e envs locais.
5. Rodar secret scanning antes de qualquer push.
6. Confirmar restricoes da chave Google Maps por referrer/API.
7. Revisar `.env.production.local` localmente sem expor valores.
8. Revisar variaveis de Vercel para admin, banco, WhatsApp e Maps.
9. Otimizar `site-images/teppan-camarao.png`.
10. Otimizar `site-images/temaki-hot.png`.
11. Otimizar imagens duplicadas em `menu_pdf_images/catalog` quando usadas em producao.
12. Criar politica de tamanho maximo para imagens.
13. Validar todas as paginas publicas em preview.
14. Validar login admin em preview.
15. Validar checkout em preview com dados sinteticos.
16. Validar WhatsApp em ambiente controlado.
17. Validar rewrites de `/api/reviews` e rotas admin em preview.
18. Repetir bateria local segura antes de deploy.
19. Criar checklist de release V1.
20. Criar checklist de rollback V1.
21. Definir rotina de backup antes de dados reais.
22. Definir rotina de restore testado.
23. Criar smoke test pre-merge.
24. Criar smoke test pre-deploy.
25. Registrar tempos de resposta das APIs principais.
26. Registrar erros por rota em logs estruturados.
27. Criar padrao de correlation id por request.
28. Criar dashboard simples de saude tecnica.
29. Medir Web Vitals em preview.
30. Medir tamanho final de assets no deploy.
31. Planejar split de `script.js`.
32. Planejar split de `admin/admin.js`.
33. Planejar split de `admin/admin.css`.
34. Separar catalogo base de `script.js`.
35. Criar helper comum de storage para novos stores.
36. Criar helper comum de erro/API.
37. Criar helper comum de normalizacao de texto.
38. Criar camada formal de migrations.
39. Transformar migrations Markdown em plano aprovavel, ainda sem executar.
40. Aprovar ADR-001.
41. Aprovar ADR-002.
42. Aprovar ADR-003.
43. Aprovar ADR-004.
44. Aprovar ADR-005.
45. Definir contrato final de `TenantContext`.
46. Definir estrategia de IDs internos e publicos.
47. Definir politica de `legacy_restaurant_key`.
48. Definir resolver host -> contexto em modo default-only.
49. Criar testes unitarios do resolver default-only.
50. Criar massa de teste A/B tenant.
51. Criar testes anti-vazamento para pedidos.
52. Criar testes anti-vazamento para clientes/CRM.
53. Criar testes anti-vazamento para catalogo.
54. Criar testes anti-vazamento para delivery.
55. Criar testes anti-vazamento para financeiro.
56. Criar testes anti-vazamento para estoque.
57. Criar testes anti-vazamento para reviews.
58. Criar testes anti-vazamento para usuarios/membership.
59. Criar testes anti-vazamento para relatorios.
60. Criar testes anti-vazamento para Master.
61. Normalizar Master data conceitualmente em entidades.
62. Planejar tabela `organizations`.
63. Planejar tabela `restaurants`.
64. Planejar tabela `restaurant_domains`.
65. Planejar tabelas de planos e contratos.
66. Planejar `users` e `restaurant_users`.
67. Planejar settings/branding/delivery/integrations por restaurante.
68. Planejar escopo de pedidos.
69. Planejar escopo de itens e eventos de pedido.
70. Planejar escopo de clientes e reviews.
71. Planejar escopo de catalogo e promocoes.
72. Planejar escopo de financeiro e estoque.
73. Planejar indices por escopo/status/data.
74. Planejar auditoria por ator/tenant/modulo.
75. Planejar rate limits por tenant/rota/integracao.
76. Criar CSP em modo report-only.
77. Criar teste XSS para reviews.
78. Criar teste XSS para catalogo.
79. Criar teste XSS para settings.
80. Criar validacao CSRF/origem para mutacoes admin.
81. Criar politica LGPD para WhatsApp.
82. Criar politica LGPD para marketing.
83. Criar politica LGPD para localizacao de entregador.
84. Definir empacotamento final START.
85. Definir empacotamento final PRO.
86. Definir empacotamento final PREMIUM.
87. Definir add-ons comerciais.
88. Definir criterios de upsell.
89. Definir billing real.
90. Definir onboarding manual assistido.
91. Definir onboarding automatico futuro.
92. Criar guia de suporte para V1.
93. Criar guia de operacao do restaurante.
94. Criar guia de incidentes.
95. Escolher um unico foco V1.5.
96. Se foco for QR/comanda, modelar canal presencial sem PDV completo.
97. Se foco for KDS, modelar fila de cozinha sem realtime complexo inicial.
98. Se foco for relatorios, separar transacional de analitico.
99. Revisar roadmap a cada 30 dias com base em risco tecnico.
100. So abrir multi-restaurante real depois de testes anti-vazamento verdes e rollback ensaiado.

## Ordem Executiva Recomendada

- Passos 1 a 20: V1 pre-deploy.
- Passos 21 a 38: hardening V1.1.
- Passos 39 a 60: tenancy default-only e testes.
- Passos 61 a 83: arquitetura SaaS.
- Passos 84 a 94: comercial/operacao.
- Passos 95 a 100: expansao controlada.
