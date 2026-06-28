# INovas Food - Release Strategy

Data: 2026-06-25

Escopo: estrategia futura de versoes. Este documento nao cria tags, nao altera `package.json` e nao publica release.

## Objetivo

Definir como a INovas Food deve evoluir versoes sem quebrar clientes, contratos, APIs, dados, dominio ou operacao.

## Semantic Versioning

Formato:

```text
MAJOR.MINOR.PATCH
```

Exemplos:

- `v1.0.0`
- `v1.0.1`
- `v1.1.0`
- `v2.0.0`

## Regras

### MAJOR

Incrementar quando houver:

- Mudanca incompativel de API.
- Mudanca incompativel de contrato de dados.
- Remocao de compatibilidade legada.
- Alteracao significativa de arquitetura de tenant.

Exemplo:

- `v2.0.0`: IA operacional ou mudanca grande de plataforma.
- `v3.0.0`: SaaS multi-restaurante real, se alterar contratos internos de forma ampla.

### MINOR

Incrementar quando houver:

- Novo modulo compativel.
- Novo recurso sem quebrar fluxo existente.
- Nova tela ou area que nao altera contrato antigo.
- Melhorias operacionais compativeis.

Exemplo:

- `v1.1.0`: hardening de producao, observabilidade, backups.
- `v1.5.0`: QR/comanda ou KDS, se compativel.

### PATCH

Incrementar quando houver:

- Bugfix.
- Ajuste de seguranca compativel.
- Ajuste de performance.
- Correcao de texto/config sem mudanca de regra.

Exemplo:

- `v1.0.1`: corrigir fallback de Maps.
- `v1.0.2`: corrigir validacao de checkout.

## Release Candidate

Formato:

- `v1.0.0-rc.1`
- `v1.0.0-rc.2`

Uso:

- Versao candidata para preview/homologacao.
- Nao deve ser tratada como release final.
- Deve passar smoke test e validacoes completas.

## Hotfix

Uso:

- Incidente em producao.
- Correcao pequena e urgente.

Fluxo:

1. Criar branch `hotfix/vX.Y.Z`.
2. Corrigir menor escopo possivel.
3. Rodar checks essenciais.
4. Deploy controlado.
5. Tag patch.
6. Portar fix para branch principal se necessario.

## Patch

Patch normal nao urgente:

- Entra no fluxo padrao de PR/review/testes.
- Nao pula preview, exceto decisao formal.

## LTS

Quando houver muitos clientes, definir LTS:

- Uma versao estavel suportada por periodo longo.
- Recebe apenas seguranca e bugfix.
- Nao recebe modulos experimentais.

Sugestao:

- `v1.x LTS`: restaurantes single/default e base SaaS.
- `v3.x LTS`: SaaS multi-restaurante real, quando maduro.

## Compatibilidade

Contratos que nao devem quebrar sem versao major e plano de migracao:

- Dominio atual.
- Cookies.
- Headers.
- Prefixo de pedido.
- Rotas de API.
- `restaurant_key = "default"`.
- Estrutura de pedido publico.
- Sessao admin/cliente.

## Release Notes

Toda release deve informar:

- Versao.
- Data.
- Tipo: patch/minor/major/hotfix/rc.
- Mudancas.
- Riscos.
- Migrations, se houver.
- Rollback.
- Testes executados.
- Impacto em clientes.

## Versionamento de Banco

Regra:

- Toda migration real deve ter ID, descricao, backup, rollback e teste.
- Migration destrutiva so em major ou com fase dupla.
- Nunca remover coluna/tabela legada na mesma release que introduz substituta critica.

## Versionamento de API

Regra:

- Preservar APIs existentes.
- Criar versao nova quando contrato mudar.
- Deprecar com aviso, janela e telemetria.

## Canais de Release

- `dev`: local.
- `preview`: homologacao.
- `stable`: producao.
- `lts`: suporte prolongado futuro.

## Checklist de Release

- Versao definida.
- Changelog escrito.
- Testes verdes.
- Security check verde.
- Backup se houver risco de dados.
- Preview validado.
- Rollback documentado.
- Monitoramento pos-release definido.
