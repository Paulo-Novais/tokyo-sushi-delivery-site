# ADR-002 - Manter restaurant_key Durante V1

Status: proposto

Data: 2026-06-25

## Contexto

O sistema atual ja usa `restaurant_key = "default"` em pontos preparatorios como usuarios, configuracoes e master. A operacao real do Tokyo Sushi depende de compatibilidade com contratos atuais, dominio, cookies, headers, prefixos e testes existentes.

## Decisao

Manter `restaurant_key = "default"` durante V1/V2 e durante a fase de preparacao default-only.

Quando `restaurants` existir no futuro, o restaurante Tokyo Sushi devera receber `legacy_restaurant_key = "default"` para preservar compatibilidade.

Nenhuma API publica ou admin devera exigir `restaurant_id` externo enquanto a plataforma estiver em modo compatibilidade.

## Consequencias Positivas

- Reduz risco operacional.
- Mantem Tokyo Sushi funcionando exatamente como hoje.
- Permite migracao interna sem quebrar clientes, cookies ou historico.
- Mantem testes atuais validos.

## Consequencias Negativas

- Durante transicao havera duas formas conceituais de identificar restaurante.
- Stores precisarao aceitar contexto novo sem remover fallback legado.
- Pode haver confusao se a documentacao nao deixar o modo default-only explicito.

## Criterio de Remocao Futura

`restaurant_key` so podera ser removido como dependencia principal depois que:

- Todas as tabelas operacionais estiverem escopadas.
- Todas as APIs usarem contexto interno.
- Testes anti-vazamento estiverem maduros.
- Nao houver dependencias externas em `restaurant_key`.
