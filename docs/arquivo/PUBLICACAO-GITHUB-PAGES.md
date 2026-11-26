# Publicacao do dominio

Ponto unico de configuracao:

- Edite `site.config.json` para trocar o dominio principal, dominios alternativos e a imagem social padrao.
- Rode `py scripts/apply-site-config.py` para atualizar os HTMLs, `robots.txt`, `sitemap.xml`, `site-config.js` e `vercel.json`.

Checklist de deploy na Vercel:

1. Em `Project > Settings > Domains`, adicione o dominio principal e os alternativos.
2. Deixe o dominio principal como canonical no painel e mantenha o redirecionamento dos alternativos ativo.
3. Faça o deploy depois de aplicar a configuracao central.

Checklist de DNS:

- Configure o apex `@` e o `www` conforme os registros mostrados no painel da Vercel.
- Aguarde a emissao do certificado SSL antes de validar o redirecionamento final.

Observacoes:

- O front usa caminhos relativos para assets, scripts e chamadas de API, entao a troca de host nao exige alterar links internos.
- `vercel.json` passa a concentrar o redirecionamento de host para o dominio principal e os headers de seguranca/HTTPS.
- Se o dominio mudar, atualize tambem os referers liberados da chave do Google Maps usando os valores gerados em `site-config.js`.
