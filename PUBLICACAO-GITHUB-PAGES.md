# Publicacao do dominio

Dominio principal configurado no projeto:

- `tokyosushidelivery.com.br`

Arquivos ja adicionados:

- `CNAME`
- `.nojekyll`
- `robots.txt`
- `sitemap.xml`
- `site.webmanifest`
- `404.html`

Checklist no GitHub Pages:

1. Em `Settings > Pages`, confirme o dominio customizado `tokyosushidelivery.com.br`.
2. Ative `Enforce HTTPS` assim que o GitHub liberar a opcao.
3. Se houver opcao de verificar o dominio, faca a verificacao para evitar takeover.

Checklist no DNS:

- Apex `@` com `A` para:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- Apex `@` com `AAAA` para:
  - `2606:50c0:8000::153`
  - `2606:50c0:8001::153`
  - `2606:50c0:8002::153`
  - `2606:50c0:8003::153`
- `www` com `CNAME` apontando para o dominio padrao do seu projeto no GitHub Pages.

Observacoes:

- O `CNAME` do repositorio deve continuar com `tokyosushidelivery.com.br`.
- O site ja esta preparado para funcionar com `tokyosushidelivery.com.br` e `www.tokyosushidelivery.com.br`.
- A chave do Google Maps precisa liberar:
  - `https://tokyosushidelivery.com.br/*`
  - `https://www.tokyosushidelivery.com.br/*`
