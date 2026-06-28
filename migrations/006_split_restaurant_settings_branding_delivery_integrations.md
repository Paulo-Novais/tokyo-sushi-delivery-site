# 006 - Split Restaurant Settings, Branding, Delivery And Integrations

Status: futuro, nao executavel.

## Objetivo

Separar configuracoes por dominio funcional.

## Dependencias

- `002_create_restaurants`.
- Contrato atual de `restaurant_settings` documentado.

## Mudancas Futuras Planejadas

- Criar `restaurant_settings` futura por `restaurant_id`.
- Criar `restaurant_branding`.
- Criar `restaurant_delivery`.
- Criar `restaurant_integrations`.
- Manter leitura legada por `restaurant_key = "default"` ate cutover.

## Validacoes Futuras

- Branding Tokyo aparece igual.
- Configuracao de horario/SEO/endereco permanece igual.
- Delivery publico e admin retornam os mesmos valores para default.
- Nenhuma credencial real e migrada sem procedimento separado.

## Rollback Futuro

- Voltar stores para `restaurant-settings-store` e `delivery-settings-store` atuais.
