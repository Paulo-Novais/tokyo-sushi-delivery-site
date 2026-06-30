# INOVAS Food Design System V1.2

Este documento define a aparencia oficial da plataforma INOVAS Food a partir da V1.2.

## Tema

- O sistema usa somente tema claro.
- Nao existe alternancia light/dark.
- Interfaces administrativas devem carregar `admin/design-system.css` depois dos estilos legados.

## Logo Oficial

- Arquivo esperado: `assets/inovas-food-logo-oficial.png`.
- A logo deve ser usada exatamente como fornecida, sem recorte, redesenho, mudanca de cor, sombra, distorcao ou troca de tipografia.
- Tokyo Sushi permanece apenas como restaurante cliente e nao deve ser usado como identidade visual do painel administrativo da plataforma.

## Tokens Oficiais

- Primaria: `#ff6a00`
- Primaria hover: `#f04f0c`
- Preto: `#111827`
- Fundo: `#f3f4f6`
- Superficie: `#ffffff`
- Borda: `#e5e7eb`
- Cinza medio: `#6b7280`
- Sucesso: `#22c55e`
- Atencao: `#f59e0b`
- Erro: `#ef4444`
- Raio padrao: `8px`
- Sombra media: `0 4px 12px rgba(0, 0, 0, 0.06)`
- Fonte: `Inter, "Segoe UI", Arial, sans-serif`

## Componentes

Todos os modulos devem reutilizar os tokens e classes do Design System para:

- Sidebar
- Header
- Cards
- Tabelas
- Filtros
- Formularios
- Modais e drawers
- Toasts e mensagens
- Badges, chips e status
- Botoes primarios, secundarios e de texto

## Regras de Evolucao

- Nao criar estilos visuais especificos para um modulo quando existir padrao reutilizavel.
- Nao introduzir fundo escuro, gradientes decorativos ou tema paralelo.
- Novas telas devem seguir a mesma estrutura clara, com bastante espaco em branco, bordas discretas e destaque laranja.
- Regras de negocio, APIs, autenticacao e permissoes nao pertencem a este documento visual.
