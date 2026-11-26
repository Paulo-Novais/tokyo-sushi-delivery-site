# INovas Food - Checklist de Qualidade

Data da auditoria: 2026-06-25
Ambiente: local isolado, sem deploy, sem alteracao de dominio e sem dados reais.

Status usados: `OK`, `Atenção`, `Pendente`, `Não aplicável`.

## 1. Site publico

| Item | Status | Observacao |
| --- | --- | --- |
| `index.html` carrega sem erro | OK | Validado localmente em mobile, tablet e desktop. |
| `cardapio.html` carrega sem erro | OK | Validado com catalogo mockado e imagens locais reais. |
| `entrega.html` carrega sem erro | OK | Validado com API de entrega mockada. |
| `acompanhar.html` carrega sem erro | OK | Validado com pedido ativo ausente. |
| `historico.html` carrega sem erro | OK | Validado com sessao de cliente ausente. |
| `avaliar.html` carrega sem erro | OK | Validado com estrutura de formulario. |
| `trabalhe-conosco.html` carrega sem erro | OK | Validado com estrutura de formulario. |
| Rodape INovas Food | OK | Presente nas paginas publicas auditadas. |
| Links e hashes locais | OK | Sem links locais quebrados na auditoria complementar. |
| Imagens locais | OK | Sem imagem quebrada na auditoria complementar. |
| Console browser | OK | Sem erros nas 21 combinacoes pagina/viewport. |
| Validacao em preview/producao | Pendente | Nao executada por regra de nao deploy. |

## 2. Gestor

| Item | Status | Observacao |
| --- | --- | --- |
| Login | OK | `validate:admin-local` e fluxos integrados passaram. |
| Logout | OK | Coberto por validacoes locais. |
| Sessao | OK | Cookie atual preservado e validado. |
| Menu dinamico | OK | Validado por permissao e por plano. |
| Dashboard | OK | Renderizacao local e indicadores validados. |
| Pedidos | OK | Kanban, detalhe e acoes validados localmente. |
| Agendados | OK | Coberto por validacao Stage 3 UI. |
| Cardapio | OK | Lista, categorias e edicao renderizam em validacao local. |
| Categorias | OK | Criacao/edicao coberta por UI local. |
| Complementos | Atenção | Fluxo depende da estrutura do cardapio atual; revisar em preview com dados reais anonimizados. |
| Clientes | OK | CRM sintetico validado. |
| Relatorios | OK | Indicadores e distribuicao validados. |
| Estoque | OK | Itens sinteticos validados. |
| Financeiro | OK | Fechamento e indicadores validados. |
| Avaliacoes | OK | Lista e acoes basicas validadas. |
| Promocoes | OK | Smoke local e botoes principais validados pelos scripts. |
| Configuracoes | OK | Personalizacao e horarios validados. |
| Usuarios | OK | Criacao, bloqueio e reset cobertos por validacoes. |
| Permissoes | OK | Matriz MASTER/OWNER/DESENVOLVEDOR/CUSTOM validada. |
| Planos bloqueando modulos | OK | `403 plan_feature_forbidden` validado. |

## 3. Painel Master

| Item | Status | Observacao |
| --- | --- | --- |
| Acesso exclusivo MASTER | OK | API e HTML protegidos localmente. |
| Bloqueio server-side de `/admin/master.html` | OK | Sem sessao redireciona; nao-MASTER recebe 403. |
| Dashboard geral | OK | Validado no browser local. |
| Restaurantes | OK | Tokyo Sushi como Cliente Modelo. |
| Usuarios | OK | Menu e dados expostos ao MASTER. |
| Planos | OK | START, PRO e PREMIUM expostos. |
| Recursos | OK | Recursos atuais e futuros expostos. |
| Dominios | OK | Simulacao preparada sem alterar dominio real. |
| Assinaturas/contratos | OK | Contrato PREMIUM do cliente modelo validado. |
| Relatorios gerais | OK | Estrutura presente no Master. |
| Logs | OK | Separado do gestor comum. |
| Auditoria | OK | Estrutura presente e protegida. |
| Desenvolvedor | OK | Area tecnica lista flags e validacoes. |
| Configuracoes da plataforma | OK | Estrutura preparada. |

## 4. Seguranca

| Item | Status | Observacao |
| --- | --- | --- |
| APIs sem sessao retornam 401 | OK | Validado. |
| APIs sem permissao retornam 403 | OK | Validado. |
| APIs bloqueadas por plano retornam 403 | OK | Validado com `plan_feature_forbidden`. |
| OWNER nao acessa Master | OK | Validado. |
| DESENVOLVEDOR nao acessa Master | OK | Validado. |
| CUSTOM respeita permissoes | OK | Validado. |
| MASTER acessa tudo | OK | Validado dentro do escopo atual. |
| Cookies atuais preservados | OK | `tokyo_admin_session`, `tokyo_customer_session` e challenge preservados. |
| Headers atuais preservados | OK | Headers de cliente preservados. |
| Storage keys preservadas | OK | Carrinho, tema admin e Google Maps key preservados. |
| Secrets expostos | Atenção | `maps-config.js` contem chave Google Maps client-side; confirmar restricoes de referrer/API no Google Cloud. |
| `.env` real alterado | OK | Nenhum `.env*.local` foi editado. |

## 5. Permissoes

| Item | Status | Observacao |
| --- | --- | --- |
| MASTER | OK | Acesso completo validado. |
| OWNER | OK | Gestor liberado e Master bloqueado. |
| DESENVOLVEDOR | OK | Diagnostico permitido e Master bloqueado. |
| CUSTOM | OK | Permissoes granulares validadas. |
| Usuario bloqueado | OK | Login retorna 403. |
| Usuario antigo Master legado | OK | Login legado negado nos testes. |

## 6. Planos/contratos

| Item | Status | Observacao |
| --- | --- | --- |
| START | OK | Recursos base mapeados. |
| PRO | OK | Recursos intermediarios mapeados. |
| PREMIUM | OK | Tokyo Sushi como Cliente Modelo. |
| Bloqueio de modulo por plano | OK | Validado. |
| Contrato ativo | OK | Simulado no Master. |
| Cobranca real | Não aplicável | Fora do escopo desta etapa. |

## 7. Dominios

| Item | Status | Observacao |
| --- | --- | --- |
| Dominio atual preservado | OK | `tokyosushidelivery.com.br` mantido. |
| Dominios simulados | OK | Validacao local passou. |
| Host -> restaurante real | Pendente | Depende de multi-restaurante futuro. |
| DNS/SSL automatico | Pendente | Planejado para fase posterior. |

## 8. Pedidos

| Item | Status | Observacao |
| --- | --- | --- |
| Criacao de pedido | OK | Coberta por validacoes locais. |
| Carrinho | OK | Fluxos publicos carregam sem erro. |
| Historico/acompanhamento | OK | Estados sem sessao e sem pedido ativo validados. |
| Kanban do gestor | OK | Validado com dados sinteticos. |
| Alteracao de status | OK | Validada nas APIs protegidas. |
| Dados reais | Não aplicável | Nao usados por regra da auditoria. |

## 9. Entrega

| Item | Status | Observacao |
| --- | --- | --- |
| Configuracoes de entrega | OK | Validacao local passou. |
| Calculo por faixa/raio atual | OK | Coberto por scripts e mock browser. |
| Frete gratis | OK | Validado em scripts anteriores e docs locais. |
| Google Maps | Atenção | Chave client-side precisa estar restrita fora do codigo. |
| Rota real com entregador | Pendente | Planejada para V2.5. |

## 10. WhatsApp

| Item | Status | Observacao |
| --- | --- | --- |
| Integracao simulada com sucesso | OK | `validate:whatsapp` passou. |
| Erro de provedor tratado | OK | Script validou rejeicao do provedor. |
| Erro de rede tratado | OK | Script validou falha de rede. |
| Credenciais reais | Pendente | Validar apenas em preview/producao controlada. |
| IA WhatsApp | Pendente | Planejada para V2.0. |

## 11. SEO

| Item | Status | Observacao |
| --- | --- | --- |
| Title | OK | Presente nas paginas publicas. |
| Description | OK | Presente nas paginas publicas. |
| Canonical | OK | Presente nas paginas publicas. |
| OpenGraph | OK | Titulo, descricao e imagem presentes. |
| Twitter card | OK | `summary_large_image` presente. |
| Sitemap/robots | OK | Arquivos presentes. |

## 12. Responsividade

| Item | Status | Observacao |
| --- | --- | --- |
| Mobile 390x844 | OK | 7 paginas publicas validadas. |
| Tablet 768x1024 | OK | 7 paginas publicas validadas. |
| Desktop 1440x960 | OK | 7 paginas publicas validadas. |
| Overflow horizontal | OK | Nao detectado na auditoria complementar. |
| Gestor responsivo | OK | Validacoes existentes cobrem desktop e fluxos principais. |

## 13. Performance

| Item | Status | Observacao |
| --- | --- | --- |
| Carregamento local | OK | Sem telas em branco. |
| Assets grandes | Atenção | Existem imagens muito grandes em `site-images`; comprimir antes de producao. |
| Cache de admin | OK | `vercel.json` define `no-store` para `/admin`. |
| Bundle unico grande | Atenção | `script.js`, `styles.css` e `admin/admin.js` sao grandes; avaliar split/minificacao antes de escala. |

## 14. Pre-deploy

| Item | Status | Observacao |
| --- | --- | --- |
| Rodar validacoes locais | OK | Bateria solicitada passou. |
| Checar sintaxe fonte | OK | JS/CJS/MJS de fonte real passaram em `node --check`. |
| Parse JSON | OK | `package.json`, `site.config.json`, `vercel.json` OK. |
| Python compile | OK | `scripts/apply-site-config.py` OK. |
| Limpar artefatos locais do indice | Pendente | `.tmp` e `.codex-tools` ja aparecem rastreados/staged. |
| Conferir diff final | Pendente | Worktree esta amplo e precisa revisao humana antes de commit/deploy. |

## 15. Producao

| Item | Status | Observacao |
| --- | --- | --- |
| Preview controlado | Pendente | Necessario antes de producao. |
| Variaveis reais | Pendente | Confirmar WhatsApp, admin e banco sem expor valores. |
| Banco persistente | Pendente | Confirmar estrategia e backup. |
| Logs e alertas | Pendente | Formalizar antes de operacao. |
| DNS/SSL real | Não aplicável | Fora do escopo atual. |
| Multi-restaurante real | Não aplicável | Fora do escopo atual. |
