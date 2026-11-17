package br.com.inovasfood.garcom;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * INOVAS Garçom: abre a tela /garcom do sistema (login, mesas, cardápio e
 * envio para a cozinha). O servidor reconhece o app pelo "InovasGarcom/x.y.z"
 * no User-Agent e só libera as ações de garçom.
 */
public class MainActivity extends Activity {

    private static final String OFFLINE_PAGE =
            "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;"
            + "justify-content:center;background:#0f1216;color:#f3f5f7;font:16px system-ui,sans-serif;"
            + "text-align:center;padding:24px;box-sizing:border-box}p{color:#9aa5b1}"
            + "a{display:inline-block;margin-top:16px;padding:14px 28px;border-radius:12px;background:#e0403a;"
            + "color:#fff;text-decoration:none;font-weight:600}</style></head><body>"
            + "<h2>Sem conexão</h2><p>Confira o Wi-Fi do restaurante e tente de novo.</p>"
            + "<a href='%s'>Tentar de novo</a></body></html>";

    private WebView webView;
    private String homeUrl;
    private String allowedHost;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        homeUrl = BuildConfig.GARCOM_URL;
        allowedHost = Uri.parse(homeUrl).getHost();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0F1216"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " InovasGarcom/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && allowedHost != null && allowedHost.equals(uri.getHost())) {
                    return false;
                }
                // Links de fora (WhatsApp, mapas...) abrem no app do celular.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    // Nada para abrir: ignora.
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(homeUrl, String.format(OFFLINE_PAGE, homeUrl), "text/html", "utf-8", null);
                }
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(homeUrl);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Guarda o login no celular (não precisa entrar de novo ao reabrir).
        CookieManager.getInstance().flush();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // A tela decide: fecha a janela aberta ou volta para as mesas.
        webView.evaluateJavascript(
                "(window.InovasGarcom && window.InovasGarcom.back) ? window.InovasGarcom.back() : false",
                value -> {
                    if (!"true".equals(value)) {
                        moveTaskToBack(true);
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
