# ADR-001 - Usar Organization -> Restaurant

Status: proposto

Data: 2026-06-25

## Contexto

A INovas Food precisa evoluir de uma operacao single-restaurant para uma plataforma capaz de atender restaurantes independentes, redes, franquias e grupos empresariais.

Um restaurante e a unidade operacional: cardapio, pedidos, delivery, estoque, financeiro e configuracoes. Uma organizacao e o dono comercial/administrativo: contrato, billing, plano, relatorios consolidados e usuarios com acesso a uma ou mais unidades.

## Decisao

Adotar a hierarquia futura:

```text
Organization
  -> Restaurant
       -> Operational Data
```

`organization_id` sera usado para contexto comercial, billing, contratos, relatorios consolidados e permissoes enterprise.

`restaurant_id` sera usado como escopo operacional obrigatorio para pedidos, catalogo, delivery, clientes, avaliacoes, financeiro e estoque.

## Consequencias Positivas

- Permite restaurantes independentes e redes multi-unidade.
- Evita misturar contrato comercial com operacao diaria.
- Prepara SaaS e Enterprise sem reescrever o modelo.
- Permite usuarios com acesso a varias unidades.

## Consequencias Negativas

- Aumenta complexidade de autorizacao.
- Exige cuidado em relatorios agregados.
- Exige migracoes em varias tabelas operacionais.

## Alternativas Consideradas

- Usar apenas `restaurant_id`: simples para delivery, fraco para redes e billing.
- Usar apenas `organization_id`: simples para SaaS, fraco para operacao por unidade.
- Manter apenas `restaurant_key`: compativel hoje, insuficiente para isolamento forte.
