# INOVAS Garçom (Android)

App do garçom: abre a tela `/garcom` do sistema (login do Gestor, mesas,
cardápio, observação e envio para a cozinha). Fechar conta, pagamento e
caixa ficam no Gestor do PC — o servidor recusa essas ações vindas do app.

- Sem bibliotecas extras: só `WebView` do Android.
- O servidor reconhece o app por `InovasGarcom/<versão>` no User-Agent.
- APK gerado no GitHub Actions (`.github/workflows/build-android-garcom.yml`).
- Assinatura oficial via segredos `GARCOM_*` (nunca no repositório).

Gerar localmente (precisa do Android SDK):

    gradle -p apps/garcom-android assembleRelease -PgarcomUrl=https://inovasfood.com.br/garcom
