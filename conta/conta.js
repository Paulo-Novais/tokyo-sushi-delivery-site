// Login central do cliente (INOVAS Food).
// Recebe ?r=<restaurante>&volta=<endereço do site do restaurante>.
// Depois do login, pede ao servidor um código de uso único e volta ao site do
// restaurante, que troca o código pela sessão dele.
(() => {
  "use strict";

  const API = "/api/customer/identity";
  const ACCOUNT = "/api/customer/account";
  const params = new URLSearchParams(window.location.search);
  const restaurantKey = (params.get("r") || "").trim();
  const returnUrl = (params.get("volta") || "").trim();
  const resetToken = (params.get("token") || "").trim();

  const $ = (selector) => document.querySelector(selector);
  const views = Array.from(document.querySelectorAll("[data-conta-view]"));
  const alertBox = $("[data-conta-alert]");
  const state = { providers: [], busy: false };

  const TITLES = {
    entrar: ["Conta para pedidos", "Entrar", "Use sua conta Google ou seu e-mail e senha."],
    criar: ["Conta para pedidos", "Criar conta", "Uma conta só para pedir em todos os restaurantes INOVAS."],
    esqueci: ["Recuperar acesso", "Esqueci minha senha", "Enviamos um link para você criar uma nova senha."],
    "nova-senha": ["Recuperar acesso", "Criar nova senha", "Escolha uma senha com pelo menos 8 caracteres."],
    telefone: ["Quase pronto", "Seu telefone", "Só uma vez: o restaurante usa para falar com você sobre o pedido."],
    conectado: ["Conta para pedidos", "Você está conectado", "Volte ao site do restaurante para fazer seu pedido."],
    carregando: ["Conta para pedidos", "Um instante…", ""],
  };

  const MESSAGES = {
    INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
    too_many_attempts: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    TOO_MANY_REQUESTS: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
    PASSWORD_TOO_LONG: "A senha está longa demais.",
    INVALID_EMAIL: "Confira o e-mail.",
    invalid_phone: "Informe um telefone com DDD.",
    invalid_name: "Informe seu nome.",
    INVALID_TOKEN: "O link expirou ou já foi usado. Peça um novo.",
    customer_return_url_forbidden: "Não foi possível voltar ao restaurante. Abra o site do restaurante e entre de novo.",
    customer_phone_required: "Informe seu telefone para continuar.",
  };

  const showAlert = (message, ok = false) => {
    alertBox.textContent = message || "";
    alertBox.hidden = !message;
    alertBox.classList.toggle("is-ok", Boolean(ok));
  };

  const show = (name) => {
    views.forEach((view) => { view.hidden = view.dataset.contaView !== name; });
    const [tag, title, sub] = TITLES[name] || TITLES.entrar;
    $("[data-conta-tag]").textContent = tag;
    $("[data-conta-title]").textContent = title;
    $("[data-conta-sub]").textContent = sub;
    document.title = `${title} · INOVAS Food`;
    const first = document.querySelector(`[data-conta-view="${name}"] input`);
    if (first) first.focus();
  };

  const request = async (url, { method = "GET", body } = {}) => {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const code = data.code || data.errorCode || (response.status === 429 ? "TOO_MANY_REQUESTS" : "");
      const error = new Error(MESSAGES[code] || data.error || "Não foi possível concluir agora. Tente de novo.");
      error.code = code;
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const withBusy = async (form, task) => {
    if (state.busy) return;
    state.busy = true;
    const button = form && form.querySelector("button[type=submit]");
    if (button) button.disabled = true;
    showAlert("");
    try {
      await task();
    } catch (error) {
      showAlert(error.message);
    } finally {
      state.busy = false;
      if (button) button.disabled = false;
    }
  };

  const selfUrl = (extra = {}) => {
    const url = new URL("/conta/entrar", window.location.origin);
    if (restaurantKey) url.searchParams.set("r", restaurantKey);
    if (returnUrl) url.searchParams.set("volta", returnUrl);
    Object.entries(extra).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  };

  // Logado: pede o telefone se faltar; depois volta ao restaurante.
  const continueToRestaurant = async () => {
    const me = await request(`${ACCOUNT}/me`);
    if (!me.authenticated) { show("entrar"); return; }
    if (me.user && me.user.needsPhone) { show("telefone"); return; }
    if (!restaurantKey || !returnUrl) { show("conectado"); return; }
    show("carregando");
    const data = await request(`${ACCOUNT}/handoff`, { method: "POST", body: { restaurantKey, returnUrl } });
    window.location.replace(data.redirectUrl);
  };

  const bindForms = () => {
    document.querySelectorAll("[data-conta-go]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showAlert("");
        show(link.dataset.contaGo);
      });
    });

    $("[data-conta-google]").addEventListener("click", (event) =>
      withBusy(null, async () => {
        event.currentTarget && (event.currentTarget.disabled = true);
        const data = await request(`${API}/sign-in/social`, {
          method: "POST",
          body: {
            provider: "google",
            callbackURL: selfUrl({ continuar: "1" }).toString(),
            errorCallbackURL: selfUrl({ erro: "google" }).toString(),
          },
        });
        if (data.url) window.location.assign(data.url);
      })
    );

    $('[data-conta-form="entrar"]').addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withBusy(form, async () => {
        await request(`${API}/sign-in/email`, {
          method: "POST",
          body: { email: form.email.value.trim(), password: form.password.value, rememberMe: true },
        });
        form.password.value = "";
        await continueToRestaurant();
      });
    });

    $('[data-conta-form="criar"]').addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withBusy(form, async () => {
        const email = form.email.value.trim();
        const password = form.password.value;
        if (password.length < 8) throw new Error(MESSAGES.PASSWORD_TOO_SHORT);
        await request(`${API}/sign-up/email`, {
          method: "POST",
          body: { name: form.name.value.trim(), phone: form.phone.value, email, password },
        });
        try {
          await request(`${API}/sign-in/email`, { method: "POST", body: { email, password, rememberMe: true } });
        } catch (error) {
          if (error.code === "TOO_MANY_REQUESTS" || error.code === "too_many_attempts") throw error;
          // Mesma mensagem para qualquer caso: não revela se o e-mail já tinha conta.
          throw new Error("Não foi possível criar a conta com esses dados. Se você já tem conta, entre ou use “Esqueci minha senha”.");
        }
        form.password.value = "";
        await continueToRestaurant();
      });
    });

    $('[data-conta-form="esqueci"]').addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withBusy(form, async () => {
        await request(`${API}/request-password-reset`, {
          method: "POST",
          body: { email: form.email.value.trim(), redirectTo: selfUrl({ modo: "nova-senha" }).toString() },
        }).catch((error) => {
          if (error.status === 429) throw error;
        });
        showAlert("Se esse e-mail tiver conta, enviamos um link para criar uma nova senha. Ele vale por 30 minutos.", true);
      });
    });

    $('[data-conta-form="nova-senha"]').addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withBusy(form, async () => {
        if (form.password.value.length < 8) throw new Error(MESSAGES.PASSWORD_TOO_SHORT);
        if (form.password.value !== form.password2.value) throw new Error("As duas senhas não são iguais.");
        await request(`${API}/reset-password`, { method: "POST", body: { newPassword: form.password.value, token: resetToken } });
        form.reset();
        show("entrar");
        showAlert("Senha criada. Entre com o seu e-mail e a nova senha.", true);
      });
    });

    $('[data-conta-form="telefone"]').addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withBusy(form, async () => {
        await request(`${ACCOUNT}/phone`, { method: "POST", body: { phone: form.phone.value } });
        await continueToRestaurant();
      });
    });

    $("[data-conta-sair]").addEventListener("click", () =>
      withBusy(null, async () => {
        await request(`${API}/sign-out`, { method: "POST", body: {} });
        show("entrar");
        showAlert("Você saiu da conta neste aparelho.", true);
      })
    );
  };

  const start = async () => {
    bindForms();
    const mode = params.get("modo") || "";
    try {
      const me = await request(`${ACCOUNT}/me`);
      state.providers = me.providers || [];
      const hasGoogle = state.providers.includes("google");
      $("[data-conta-google]").hidden = !hasGoogle;
      $("[data-conta-divider]").hidden = !hasGoogle;

      if (mode === "sair") {
        if (me.authenticated) await request(`${API}/sign-out`, { method: "POST", body: {} }).catch(() => {});
        const back = await request(`${ACCOUNT}/return-url?${new URLSearchParams({ r: restaurantKey, volta: returnUrl })}`).catch(() => null);
        if (back && back.url) { window.location.replace(back.url); return; }
        show("entrar");
        showAlert("Você saiu da conta neste aparelho.", true);
        return;
      }
      if (mode === "nova-senha") {
        if (!resetToken || params.get("error")) { show("esqueci"); showAlert(MESSAGES.INVALID_TOKEN); return; }
        show("nova-senha");
        return;
      }
      if (params.get("erro") === "google") {
        show("entrar");
        showAlert("Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.");
        return;
      }
      if (me.authenticated) { await continueToRestaurant(); return; }
      show(mode === "criar" ? "criar" : "entrar");
    } catch (error) {
      show("entrar");
      showAlert(error.message);
    }
  };

  start();
})();
