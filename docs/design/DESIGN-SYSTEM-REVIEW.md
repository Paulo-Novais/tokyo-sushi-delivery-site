# INOVAS FOOD - Revisao do Design System V2.0

Status: preparacao documental.
Escopo: revisao visual/arquitetural, sem alterar CSS, HTML, JS, assets, deploy, commit ou tag.

## 1. Situacao Atual

A V1.2 aplicou a identidade visual oficial INOVAS Food no admin:

- Tema claro.
- Laranja como cor primaria.
- Preto, branco e cinzas como base.
- `admin/design-system.css` com tokens `--if-*`.
- Logo oficial em `assets/inovas-food-logo-oficial.png`.
- Login admin usando INovas Food.
- Sidebar e header admin usando a marca da plataforma.
- MASTER sem restaurante no header.
- OWNER com restaurante correto.

## 2. Tokens Existentes

`admin/design-system.css` centraliza:

- Cores: primaria, hover, soft, preto, branco, fundo, borda, cinzas, sucesso, atencao, erro.
- Sombras: sm, md, lg.
- Radius: 8px.
- Fonte: Inter/Segoe UI/Arial.
- Mapeamento para variaveis admin antigas.

Ponto positivo: o arquivo permite padronizacao sem reescrever todo o CSS legado de uma vez.

## 3. Pontos de Inconsistencia

Ainda existem:

- `admin/admin.css` muito grande e historico.
- Seletores `legacy-dark-disabled`.
- `admin/orders-production-restore.css`.
- `admin/_tmp_orders_revert.css`.
- Componentes desenhados diretamente em templates JS.
- Botoes, cards, tabelas e filtros com muitas classes especificas por tela.
- Publico ainda possui identidade do restaurante Tokyo, correto para cliente atual, mas precisa separar claramente plataforma vs restaurante.

Impacto: novas telas podem copiar estilos locais em vez de usar tokens.
Risco: produto parecer fragmentado depois de V2.0.
Prioridade: media/alta.

## 4. Componentes a Padronizar

Componentes obrigatorios do Design System:

- Button: primary, secondary, ghost/text, danger, icon.
- Input.
- Textarea.
- Select.
- Checkbox.
- Radio.
- Switch.
- Card.
- Table.
- Badge.
- Chip/tag.
- Dropdown.
- Sidebar item.
- Header user menu.
- Modal.
- Drawer.
- Toast.
- Tooltip.
- Empty state.
- Loading state.
- Pagination.
- Filter bar.

Cada componente deve ter:

- Classe base.
- Variantes oficiais.
- Estado disabled/loading/error/success.
- Responsividade.
- Regras de acessibilidade.

## 5. Layout

Padrao recomendado:

- Fundo geral `#F3F4F6`.
- Superficies brancas.
- Borda `#E5E7EB`.
- Radius 8px.
- Sombra suave.
- Texto principal `#111827`.
- Texto auxiliar `#6B7280`.
- Acao principal `#FF6A00`.

Evitar:

- Tema escuro.
- Gradientes nao oficiais.
- Cards aninhados.
- Variacoes de laranja fora do token.
- CSS especifico quando houver componente reutilizavel.

## 6. Sidebar e Header

Sidebar:

- Logo INOVAS no topo para admin/plataforma.
- Menu ativo em laranja.
- Itens de sistema e restaurante separados conforme perfil.
- Sem fundo escuro.

Header:

- Branco.
- MASTER: `INovas Food / Administrador do Sistema`.
- Restaurante: nome do restaurante e perfil.
- Notificacoes e avatar consistentes.

## 7. Tabelas e Formularios

Tabelas:

- Cabecalho uniforme.
- Espacamento padrao.
- Acoes por icone.
- Badges oficiais.
- Loading e empty state.
- Paginacao consistente.
- Filtros em barra reutilizavel.

Formularios:

- Labels acima do campo.
- Validacao visual padrao.
- Mensagens amigaveis.
- Drawer/modal com os mesmos botoes.
- Radio/checkbox oficiais.

## 8. Publico vs Plataforma

Regra de marca:

- Admin, plataforma, sistema, login e areas internas: INOVAS Food.
- Site publico do restaurante: marca do restaurante cliente.
- Tokyo Sushi Delivery continua como restaurante cliente, nao como plataforma.

Risco atual: `site-config.js` ainda e Tokyo/global. Para V2.0, a marca publica deve vir do restaurante resolvido por dominio.

## 9. Problemas, Prioridade e Risco

| Problema | Prioridade | Impacto | Risco |
| --- | --- | --- | --- |
| CSS legado junto do Design System | Alta | Inconsistencia visual | Medio/Alto |
| Componentes nao centralizados | Alta | Novas telas duplicam estilo | Alto |
| Publico global Tokyo | Alta para multi-tenant | Branding errado por dominio | Alto |
| Arquivos temporarios de CSS | Media | Confusao/manutencao | Medio |
| Falta de lint visual | Media | Cores fora da paleta | Medio |

## 10. Recomendacoes

Alta prioridade:

- Criar catalogo de componentes admin reutilizaveis.
- Mapear classes existentes para tokens oficiais.
- Separar CSS legado por modulo antes de remover.
- Criar teste visual de logo, tema claro, sidebar, header, tabela, modal e mobile.

Media prioridade:

- Criar pagina interna de referencia do Design System.
- Criar lint simples para cores hex fora da paleta.
- Remover `legacy-dark-disabled` em etapa propria com screenshot diff.

Baixa prioridade:

- Padronizar nomes de classes novos com prefixo unico.

## 11. Recomendacao Final

O Design System INOVAS ja esta aplicado no admin, mas ainda funciona como camada de padronizacao sobre uma base historica grande. A V2.0 deve transformar essa camada em fonte oficial de componentes, evitando que cada modulo mantenha estilos proprios.
