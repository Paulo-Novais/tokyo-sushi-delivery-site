# Análise do sistema — desempenho, código e novidades (26/11/2026)

Branch: `claude/otimizacao`. Nada disso foi publicado ainda.

## 1. Desempenho — o que já foi melhorado

| O quê | Antes | Depois | Como foi medido |
|---|---|---|---|
| Lista de pedidos do Gestor (atualiza a cada 10–20 s) | 9 consultas ao banco, uma depois da outra | as mesmas consultas, todas ao mesmo tempo | simulação com 50 ms por consulta: **455 ms → 103 ms** |
| Leitura das regras dos planos (master state) | 2 leituras do banco em cada pedido do Gestor | guardada por 3 s na memória do servidor | contagem de consultas na simulação: **2 → 0** em pedidos seguidos |
| Banner do Tokyo (início e cardápio) | foto PNG de **342 KB** | versão WEBP de **33 KB** | navegador de teste: o PNG não é mais baixado |

Detalhe do cache dos planos: quando o Painel INOVAS muda um plano, o servidor
que gravou já usa o valor novo na hora; os outros servidores levam no máximo
3 segundos para ver a mudança.

### Pesos das páginas (medidos no servidor local)

- Site do Tokyo, início: ~1,3 MB · cardápio: ~1,66 MB (script.js 476 KB, styles.css 184 KB).
- Gestor: admin.js 839 KB (175 KB comprimido) + ~850 KB de CSS.
- Site INOVAS: 267 KB.
- Os arquivos já ficam guardados no navegador com o código da versão
  (`?v=...`), então só o primeiro acesso depois de cada publicação paga esse peso.

### Próximas melhorias de desempenho (sugestões, não feitas)

1. **Dividir o admin.js (20.900 linhas)** em partes que carregam só quando a
   tela abre (NFC-e, Estoque, Financeiro, Previsão…). Ganho grande no primeiro
   acesso do Gestor. Esforço: alto — mexe no Gestor inteiro.
2. **Juntar e limpar os CSS do Gestor** (~850 KB, muita regra repetida de
   versões antigas). Esforço: médio, com risco visual → testar tela por tela.
3. **Logo do Tokyo** ainda em PNG (`tokyo-logo-premium-transparent.png`):
   gerar WEBP. Esforço: baixo.
4. **script.js do site (14.500 linhas)**: o mesmo arquivo serve Tokyo,
   Kasulo e o login do cliente; separar o login e o acompanhamento de pedido.

## 2. Código morto — limpo

Removidos (todos sem nenhum uso; testes passando depois):

- 12 importações que sobraram em `lib/` (admin-api, admin-metrics,
  customer-api, payments-api, tenant-api, order-store).
- Funções que ninguém chamava: `getPromotionRecordById`, `cloneJson`,
  `isRealTenantMode`, `getRestaurantResponsible/Phone/LastLogin`,
  `scopeCustomersByTenant`, `getStatusHistory`, `buildFallbackStatusHistory`,
  `normalizeStatusEvent`, `PUBLIC_ORDER_PREFIX`.
- No Gestor: `getModuleHeadlineStats` era **calculada a cada redesenho da tela
  e jogada fora** (lia clientes, financeiro e entregas à toa). Removida.
- Variáveis soltas no site, Gestor e System.

**Arquivos mortos — apagados com o GO do Paulo (26/11):**

| Arquivo | Tamanho | Por que está morto |
|---|---|---|
| `admin/orders-production-restore.css` | 117 KB | nenhuma página usa |
| `admin/master.html` + `admin/master.js` | 2,7 KB + 149 KB | o endereço redireciona para `/system`; o painel antigo nunca abre |
| 64 relatórios `.md` da raiz | — | relatórios de versões antigas: **movidos** para `docs/arquivo/` |

O link de `admin/usuarios/novo.js` agora aponta direto para `/system/users/`.
O endereço antigo `/admin/master.html` continua redirecionando para `/system`.

## 3. Qualidade do código

- O código novo (mensalidade, pizza, NFC-e) já está comentado em português.
- Os arquivos grandes (`admin.js`, `script.js`, `admin-api.cjs` com 4.100
  linhas) são o maior problema de manutenção: difícil achar as coisas e alto
  risco de uma mudança quebrar outra tela.
- Sugestão de ordem: primeiro separar `admin-api.cjs` por assunto (pedidos,
  cardápio, configurações, fiscal) — é só servidor, fácil de testar; depois o
  admin.js por tela.
- Testes: 192 testes rápidos e ~150 de tela. Os testes de tela falhavam ao
  acaso quando rodavam juntos. **Causa achada:** no servidor de teste local
  (modo arquivo) duas ações ao mesmo tempo — um login e um cadastro — faziam a
  segunda gravação apagar o usuário recém-criado ("Usuário administrativo não
  encontrado"). Corrigido: no modo arquivo essas gravações agora vão uma de
  cada vez. Produção (Neon) não tinha esse problema. Ainda sobram falhas raras
  por lentidão do servidor de teste com muitos testes juntos (o código antigo
  também tem); rodando um teste por vez, passam.
- `validate-stage-3-ui` está desatualizado.
- **Ponto de atenção (produção):** salvar um usuário da equipe regrava *todos*
  os usuários no banco, um por um. Hoje é rápido (poucos usuários), mas cresce
  com o número de restaurantes e, se duas pessoas salvarem ao mesmo tempo, uma
  pode desfazer a mudança da outra. Sugestão: gravar só o usuário alterado.
  Mexe no login — fazer com calma e com testes.

## 4. O que podemos acrescentar (comparando com Consumer, Saipos e iFood)

Já fizemos desde a última comparação: **NFC-e** (pronta, falta o contrato
com a Focus NFe) e **pizza montada** (meio a meio).

Ordem sugerida (importância × esforço):

1. **Avisos automáticos no WhatsApp** — "pedido aceito", "saiu para entrega".
   Consumer e Saipos têm. Precisa da API oficial do WhatsApp. Esforço: médio.
2. **Fidelidade / cashback** — "a cada 10 pedidos, 1 grátis". Já temos cupons
   e cadastro de clientes para apoiar. Esforço: baixo/médio.
3. **Tela da cozinha (KDS)** — pedidos em preparo numa TV, toca para marcar
   pronto. Reaproveita o Gestor. Esforço: baixo.
4. **QR code na mesa** — cliente pede pelo celular e cai na comanda do Caixa.
   Esforço: médio.
5. **Rastreio do entregador** — link para o cliente ver o motoboy no mapa.
   Depende da chave do Google Maps. Esforço: médio.
6. **Ficha técnica** — custo e lucro de cada prato, ligado ao estoque.
   Esforço: médio.
7. **Instalar no celular (PWA)** — site do restaurante vira "app" na tela do
   cliente, sem loja. Esforço: baixo.
8. **Maquininha integrada (TEF Stone)** e **totem** — para depois da parceria
   com a Stone. Esforço: alto.
9. **Várias lojas na mesma conta (franquias)**. Esforço: alto.

Sugestão de pacote: 2, 3 e 7 no **Profissional**; 1, 4 e 5 no **Completo**;
8 como adicional.
