# INovas Food - Full Homologation

Data: 2026-06-26

Papel: QA Senior, Test Engineer, Pentester e Usuario Final.

Escopo respeitado:

- Sem deploy.
- Sem alteracao de dominio.
- Sem multi-restaurante.
- Sem alteracao de regra de negocio.
- Sem alteracao de banco real.
- Sem uso de dados reais.
- Apenas correcoes pequenas e seguras.

## Resumo Executivo

A plataforma passou na bateria local segura e esta em bom estado para uma V1 controlada em preview. A homologacao encontrou dois bugs pequenos de frontend/API e ambos foram corrigidos:

1. O site publico chamava `/api/reviews`, mas esse endpoint nao existia.
2. O cardapio renderizava imagens auxiliares de transicao sem `src`, gerando falso positivo de imagem quebrada em auditoria de DOM.

Depois das correcoes, as paginas publicas reavaliadas nao apresentaram 404, erros de console, page errors, imagens quebradas, botoes vazios ou overflow horizontal nos cenarios auditados.

Conclusao de QA: a base local esta estavel, mas eu ainda nao entregaria a um restaurante pagante amanha sem uma rodada de preview/producao controlada, restricao confirmada da chave Google Maps, validacao de variaveis reais, backup/restore e observabilidade minima.

## Ambiente de Homologacao

- Ambiente: local.
- Banco real: nao usado.
- Dados reais: nao usados.
- Deploy: nao realizado.
- Dominio: nao alterado.
- `.data`: uma pasta local foi gerada por uma navegacao de teste em modo desenvolvimento e removida em seguida. Ao final da homologacao, `.data` estava ausente.
- APIs: testadas por scripts locais, mocks seguros e chamadas diretas.
- Browser: Playwright/Chromium headless em mobile, tablet e desktop.

## Fase 1 - Site Publico

Areas avaliadas:

- Home.
- Cardapio.
- Categorias.
- Produtos.
- Complementos.
- Carrinho, dentro das validacoes locais existentes.
- Entrega.
- Calculo de entrega, dentro das validacoes locais existentes.
- Pedido e pedido agendado, dentro das validacoes locais existentes.
- Login de cliente, historico e tracking, dentro de `validate:stage-3-ui-local`.
- Avaliacoes.
- Trabalhe Conosco.
- WhatsApp, via validacao isolada.
- Rodape.
- SEO basico.
- Layouts/temas.
- Responsividade em mobile, tablet e desktop.

Resultado:

- 8 paginas publicas navegadas em 3 viewports: 24 combinacoes.
- Sem page error apos correcoes.
- Sem 404 apos correcao de `/api/reviews`.
- Sem imagens quebradas apos ajuste do placeholder de midia do cardapio.
- Sem overflow horizontal detectado.
- Sem botoes vazios detectados.
- SEO basico presente: title, description e canonical.

Observacoes:

- A auditoria foi local. URLs canonicas continuam apontando para o dominio real, como esperado.
- Integracoes externas reais, como Google Maps e WhatsApp Cloud real, precisam de validacao em preview/producao com credenciais controladas.

## Fase 2 - Gestor

Validado por:

- `validate:admin-local`
- `validate:permissions-local`
- `validate:plans-contracts-local`
- `validate:stage-3-ui-local`
- auditorias anteriores da base.

Areas cobertas:

- Dashboard.
- Pedidos.
- Agendados.
- Clientes.
- Cardapio.
- Promocoes.
- Avaliacoes.
- Relatorios.
- Financeiro.
- Estoque.
- Configuracoes.
- Usuarios.
- Permissoes.
- Planos e recursos.

Resultado:

- Validacao admin local passou.
- Validacao de usuarios e permissoes passou.
- Validacao de planos, recursos e contratos passou.
- Validacao de UI etapa 3 local passou.

Risco residual:

- Nao houve teste manual humano prolongado com operador real.
- Modulos grandes ainda estao concentrados em `admin/admin.js` e `admin/admin.css`, o que aumenta risco futuro de regressao.

## Fase 3 - Painel Master

Validado por:

- `validate:master-panel-local`
- `validate:platform-integration-local`
- `validate:domains-local`
- `validate:plans-contracts-local`

Areas cobertas:

- Dashboard Master.
- Restaurantes em modo preparado/default.
- Planos.
- Contratos.
- Recursos.
- Logs/auditoria simulados.
- Configuracoes.
- Feature flags.
- Bloqueios por plano/permissao.
- 401/403 nos cenarios cobertos pelos scripts.

Resultado:

- Painel Master local passou.
- Integracao de plataforma passou.
- Dominios simulados passaram.
- Planos e contratos passaram.

Risco residual:

- Master ainda e preparacao SaaS, nao multi-restaurante real.
- DNS/SSL, cobranca real e onboarding automatico nao foram testados porque ainda nao sao escopo implementado.

## Fase 4 - Seguranca

Testes executados:

- API admin sem login retornou `401 admin_session_required`.
- Login admin invalido retornou `401 invalid_credentials`.
- Login admin valido retornou `200`.
- Sessao admin com cookie valido retornou `200`.
- Permissoes locais passaram.
- Bloqueios por plano/contrato passaram.
- Master local passou com regras de acesso dos scripts.
- Sintaxe e JSON sem falhas.
- `.env` real nao foi exibido.

Resultado:

- Controles principais locais estao funcionando.
- Nao foi identificado bypass simples de admin nos testes locais.

Riscos de seguranca que ainda impedem entrega cega:

- Chave Google Maps client-side precisa de confirmacao externa de restricao por referrer/API/cotas.
- Secrets reais de preview/producao nao foram validados nesta rodada.
- Ainda falta observabilidade formal de eventos criticos, auditoria estruturada e alerta.
- Falta pentest em ambiente preview com headers, cookies, HTTPS e regras reais de plataforma.

## Fase 5 - Performance

Arquivos grandes identificados:

| Arquivo | Tamanho aproximado |
| --- | ---: |
| `admin/admin.js` | 509.6 KB |
| `script.js` | 429.2 KB |
| `admin/admin.css` | 344.0 KB |
| `styles.css` | 151.4 KB |
| `admin/orders-production-restore.css` | 103.9 KB |
| `lib/order-store.cjs` | 100.1 KB |
| `lib/catalog-store.cjs` | 68.1 KB |
| `lib/admin-api.cjs` | 48.0 KB |

Assets:

- 169 arquivos de assets auditados.
- Total aproximado: 143.71 MB.
- Maiores imagens:
  - `site-images/teppan-camarao.png`: 19.34 MB.
  - `menu_pdf_images/catalog/teppan-camarao.png`: 19.34 MB.
  - `site-images/temaki-hot.png`: 12.27 MB.
  - `menu_pdf_images/catalog/temaki-hot.png`: 12.27 MB.

Resultado:

- Performance funcional local esta aceitavel para homologacao.
- Performance de producao ainda exige compressao de imagens, WebP/AVIF, thumbnails e estrategia de CDN/storage.

## Fase 6 - UX

Pontos positivos:

- Fluxo publico esta coerente: Home -> Cardapio -> Entrega/Pedido -> Acompanhamento/Historico/Avaliacao.
- Rodape e navegacao aparecem consistentes.
- Estados de login/historico/tracking foram cobertos por validacao local.
- Gestor e Master possuem separacao conceitual clara.

Pontos de atencao:

- Gestor tem muitos modulos e pode exigir treinamento para primeiro uso.
- Alguns fluxos administrativos dependem de muitos controles em uma unica superficie.
- Performance de imagem pode afetar percepcao no primeiro acesso.
- Ainda falta teste com usuario real de restaurante em operacao simulada por algumas horas.

## Fase 7 - Integracao

Fluxo validado localmente:

```text
Site
  -> API
  -> Store
  -> armazenamento local isolado ou fallback
  -> Gestor
  -> Master
```

Scripts que cobrem integracao:

- `validate:platform-integration-local`
- `validate:admin-local`
- `validate:master-panel-local`
- `validate:stage-3-ui-local`
- `validate:business-hours`
- `validate:whatsapp`

Resultado:

- Integracao local aprovada.
- Pedido/tracking/admin foram cobertos em validacao local.
- WhatsApp foi validado com cenarios simulados de sucesso, rejeicao de provedor e falha de rede.

Limite:

- Banco Neon real, WhatsApp real, Google Maps real e dominio real nao foram exercitados nesta rodada.

## Fase 8 - Regressao

Todas as validacoes seguras executadas passaram:

| Validacao | Resultado |
| --- | --- |
| `npm.cmd run validate:business-hours` | OK |
| `npm.cmd run validate:admin-local` | OK |
| `npm.cmd run validate:permissions-local` | OK |
| `npm.cmd run validate:master-panel-local` | OK |
| `npm.cmd run validate:platform-integration-local` | OK |
| `npm.cmd run validate:site-layouts-local` | OK |
| `npm.cmd run validate:domains-local` | OK |
| `npm.cmd run validate:plans-contracts-local` | OK |
| `npm.cmd run validate:stage-3-ui-local` | OK |
| `npm.cmd run validate:whatsapp` | OK |

Checks estaticos:

| Check | Resultado |
| --- | --- |
| `node --check` em 55 arquivos JS/CJS/MJS | OK |
| `JSON.parse` em `package.json` | OK |
| `JSON.parse` em `package-lock.json` | OK |
| `JSON.parse` em `site.config.json` | OK |
| `JSON.parse` em `vercel.json` | OK |
| `JSON.parse` em `site.webmanifest` | OK |
| `python -m py_compile scripts/apply-site-config.py` | OK |
| `git diff --check` | OK |

Observacao:

- `validate:stage-3-ui` depende de um servidor persistente externo/local em `VALIDATION_BASE_URL`. A variante segura local `validate:stage-3-ui-local` foi executada e aprovada. O teste live deve ser repetido em preview controlado antes de producao.

## Fase 9 - Correcoes Realizadas

### BUG-MED-001 - Endpoint publico de avaliacoes inexistente

Sintoma:

- Home, Cardapio e Avaliar geravam 404 em `/api/reviews`.

Causa:

- O frontend usava `PUBLIC_REVIEWS_ENDPOINT = "/api/reviews"`, mas a API de avaliacoes publicas estava implementada dentro de `/api/catalog?publicView=reviews`.

Correcao:

- Criado `api/reviews.js` como wrapper fino para o fluxo ja existente de avaliacoes publicas.

Resultado:

- `/api/reviews` retorna `200` em `GET`.
- Metodo invalido retorna `405 method_not_allowed`.
- Paginas publicas reavaliadas sem 404/console error de reviews.

### BUG-LEV-001 - Imagem auxiliar de cardapio sem `src`

Sintoma:

- Auditoria DOM apontava imagens quebradas no cardapio desktop.

Causa:

- Imagens auxiliares invisiveis de transicao nasciam como `<img>` sem `src`.

Correcao:

- Adicionado placeholder transparente em `script.js`.
- Reset da imagem auxiliar agora volta para o placeholder transparente.
- Adicionado `aria-hidden="true"` no elemento auxiliar.

Resultado:

- Cardapio reavaliado sem imagens quebradas.
- Sem alteracao visual esperada.

## Bugs Encontrados

| ID | Severidade | Status | Descricao |
| --- | --- | --- | --- |
| BUG-MED-001 | Medio | Corrigido | `/api/reviews` inexistente gerava 404 no site publico. |
| BUG-LEV-001 | Leve | Corrigido | Placeholder de midia do cardapio sem `src` aparecia como imagem quebrada em auditoria. |

## Bugs Criticos

Nenhum bug critico de runtime foi encontrado na homologacao local.

## Bugs Medios

- `/api/reviews` inexistente no runtime publico. Corrigido.

## Bugs Leves

- Placeholder de imagem auxiliar sem `src`. Corrigido.

## Melhorias Sugeridas

1. Rodar preview controlado com `VALIDATION_BASE_URL`.
2. Confirmar restricoes da chave Google Maps no Google Cloud.
3. Validar credenciais reais sem expor valores.
4. Comprimir imagens grandes.
5. Criar pipeline de WebP/AVIF/thumbnails.
6. Adicionar smoke externo para `/api/reviews`, `/api/catalog`, `/api/orders/create`, login admin e Master.
7. Formalizar logger estruturado e Sentry/OpenTelemetry no futuro.
8. Adicionar secret scanning automatizado.
9. Separar gradualmente `script.js`, `admin/admin.js` e CSS grandes.
10. Fazer teste com operador real de restaurante usando massa sintetica por 2 a 4 horas.

## Fluxos Aprovados

- Site publico em navegacao local responsiva.
- Catalogo publico.
- Avaliacoes publicas apos correcao.
- Entrega/configuracoes publicas.
- Horario de funcionamento.
- Pedido/tracking em validacao local.
- Login cliente em validacao local.
- Gestor local.
- Permissoes.
- Painel Master local.
- Planos, recursos e contratos.
- Dominios simulados.
- WhatsApp simulado.
- Sintaxe JS/CJS/MJS.
- JSONs principais.
- Python de configuracao.

## Fluxos Reprovados ou Nao Liberados

- Entrega para restaurante pagante amanha sem preview/producao controlada.
- Uso em producao sem confirmar `DATABASE_URL`, backups e restore.
- Uso em producao sem restricao confirmada de Google Maps.
- Uso em producao sem smoke test live.
- Uso em producao sem monitoramento/alertas minimos.
- Performance final sem otimizacao de imagens pesadas.

## Partes 100% Prontas Localmente

- Validacoes seguras locais.
- Regras de horario.
- Permissoes locais.
- Master local.
- Planos/contratos locais.
- Dominios simulados.
- Layouts locais.
- WhatsApp simulado.
- Endpoint de avaliacoes publicas apos correcao.

## Partes Que Ainda Nao Podem Ir Para Producao Sem Nova Etapa

- Preview/producao com variaveis reais.
- Banco real com backup/restore testado.
- Google Maps com restricao externa confirmada.
- Observabilidade e alertas.
- Imagens pesadas sem otimizacao.
- Smoke test live de pedido/admin/master.
- Processo operacional 24x7.

## Notas

| Area | Nota |
| --- | ---: |
| Site Publico | 88 |
| Gestor | 87 |
| Painel Master | 84 |
| Seguranca | 82 |
| UX | 84 |
| Performance | 68 |
| Estabilidade | 88 |
| Confiabilidade | 78 |
| Experiencia do Restaurante | 84 |
| Experiencia do Cliente | 87 |
| Qualidade Geral | 84 |

## Decisao Final

Pergunta:

"Se voce fosse responsavel por entregar esta plataforma para um restaurante amanha, voce entregaria?"

Resposta:

NAO.

Justificativa:

Eu nao entregaria para um restaurante pagante amanha porque a plataforma ainda precisa de uma etapa final fora do ambiente local: preview controlado, validacao com variaveis reais, banco persistente, backup/restore, restricao confirmada da chave Google Maps, smoke test live e monitoramento minimo.

Como base tecnica local, a INovas Food esta forte e passou nas validacoes seguras. Como produto para cliente pagante em producao amanha, ainda falta a camada operacional que separa uma boa homologacao local de uma entrega comercial responsavel.

Recomendacao:

- Liberar para preview/homologacao controlada: SIM.
- Liberar para producao pagante amanha: NAO.
