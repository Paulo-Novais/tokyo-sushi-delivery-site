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
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const alertBox = $("[data-conta-alert]");
  const state = { providers: [], busy: false, tab: "entrar", safeReturn: "" };

  const TITLES = {
    entrar: ["Que bom te ver!", "Entre para pedir e acompanhar seus pedidos."],
    criar: ["Crie sua conta", "Leva menos de 1 minuto. Seus endereços e pedidos ficam salvos."],
    esqueci: ["Recuperar senha", "Informe o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova."],
    "nova-senha": ["Criar nova senha", "Escolha uma senha com pelo menos 8 caracteres."],
    telefone: ["Seu WhatsApp", "Só uma vez: o restaurante usa para avisar sobre o seu pedido."],
    conectado: ["Você está conectado", "Volte ao site do restaurante para fazer seu pedido."],
    perfil: ["Sua conta", "Você continua conectado neste aparelho até clicar em Sair."],
    carregando: ["Um instante…", "Levando você de volta ao restaurante."],
  };

  const MESSAGES = {
    INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
    too_many_attempts: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    TOO_MANY_REQUESTS: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
    PASSWORD_TOO_LONG: "A senha está longa demais.",
    INVALID_EMAIL: "Confira o e-mail.",
    invalid_phone: "Informe o WhatsApp com DDD.",
    invalid_name: "Informe seu nome.",
    INVALID_TOKEN: "O link expirou ou já foi usado. Peça um novo.",
    customer_return_url_forbidden: "Não foi possível voltar ao restaurante. Abra o site do restaurante e entre de novo.",
    customer_phone_required: "Informe seu WhatsApp para continuar.",
  };

  const showAlert = (message, ok = false) => {
    alertBox.textContent = message || "";
    alertBox.hidden = !message;
    alertBox.classList.toggle("is-ok", Boolean(ok));
  };

  const setTitles = (key) => {
    const [title, sub] = TITLES[key] || TITLES.entrar;
    $("[data-conta-title]").textContent = title;
    $("[data-conta-sub]").textContent = sub;
    document.title = `${title} · INOVAS Food`;
  };

  const replayAnimation = () => {
    const body = $("[data-conta-body]");
    body.classList.remove("tk-swap");
    void body.offsetWidth;
    body.classList.add("tk-swap");
  };

  // name: acesso (com aba entrar/criar), esqueci, nova-senha, telefone, conectado, carregando
  const show = (name, { focus = true } = {}) => {
    const view = name === "entrar" || name === "criar" ? "acesso" : name;
    if (name === "entrar" || name === "criar") state.tab = name;
    $$("[data-conta-view]").forEach((node) => { node.hidden = node.dataset.contaView !== view; });
    $$("[data-conta-tab]").forEach((tab) => {
      const on = tab.dataset.contaTab === state.tab;
      tab.classList.toggle("is-on", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    $('[data-conta-form="entrar"]').hidden = state.tab !== "entrar";
    $('[data-conta-form="criar"]').hidden = state.tab !== "criar";
    $(".tk-terms").hidden = view !== "acesso";
    setTitles(view === "acesso" ? state.tab : view);
    replayAnimation();
    if (focus) {
      const target = document.querySelector(`[data-conta-view="${view}"] form:not([hidden]) input`);
      if (target && window.matchMedia("(min-width: 881px)").matches) target.focus();
    }
  };

  const shake = (node) => {
    if (!node) return;
    node.classList.remove("tk-shake");
    void node.offsetWidth;
    node.classList.add("tk-shake");
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
      shake(form);
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

  // Endereço de volta conferido pelo servidor (só do próprio restaurante).
  const loadSafeReturn = async () => {
    if (!restaurantKey || !returnUrl) return "";
    const data = await request(`${ACCOUNT}/return-url?${new URLSearchParams({ r: restaurantKey, volta: returnUrl })}`).catch(() => null);
    state.safeReturn = (data && data.url) || "";
    return state.safeReturn;
  };

  // Logado: pede o WhatsApp se faltar; depois volta ao restaurante.
  const continueToRestaurant = async () => {
    const me = await request(`${ACCOUNT}/me`);
    if (!me.authenticated) { show("entrar"); return; }
    if (me.user && me.user.needsPhone) { show("telefone"); return; }
    if (!restaurantKey || !returnUrl) { show("conectado"); return; }
    show("carregando", { focus: false });
    const data = await request(`${ACCOUNT}/handoff`, { method: "POST", body: { restaurantKey, returnUrl } });
    window.location.replace(data.redirectUrl);
  };

  const bind = () => {
    $$("[data-conta-tab]").forEach((tab) => tab.addEventListener("click", () => { showAlert(""); show(tab.dataset.contaTab); }));
    $$("[data-conta-go]").forEach((link) => link.addEventListener("click", () => { showAlert(""); show(link.dataset.contaGo); }));

    $$("[data-conta-eye]").forEach((eye) =>
      eye.addEventListener("click", () => {
        const input = eye.parentElement.querySelector("input");
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        eye.classList.toggle("is-on", !visible);
        eye.setAttribute("aria-label", visible ? "Mostrar senha" : "Esconder senha");
      })
    );

    $$("[data-conta-voltar]").forEach((button) =>
      button.addEventListener("click", async () => {
        const back = state.safeReturn || (await loadSafeReturn());
        if (back) window.location.assign(back);
        else if (window.history.length > 1) window.history.back();
      })
    );

    $("[data-conta-google]").addEventListener("click", (event) => {
      const button = event.currentTarget;
      withBusy(null, async () => {
        button.disabled = true;
        try {
          const data = await request(`${API}/sign-in/social`, {
            method: "POST",
            body: {
              provider: "google",
              callbackURL: selfUrl({ continuar: "1" }).toString(),
              errorCallbackURL: selfUrl({ erro: "google" }).toString(),
            },
          });
          if (data.url) window.location.assign(data.url);
        } finally {
          button.disabled = false;
        }
      });
    });

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
        if (!form.name.value.trim()) throw new Error(MESSAGES.invalid_name);
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

    $("[data-conta-voltar-restaurante]").addEventListener("click", () => withBusy(null, continueToRestaurant));

    // Sair: o restaurante encerra a sessão dele e depois passa aqui para sair do login central.
    $("[data-conta-perfil-sair]").addEventListener("click", () =>
      withBusy(null, async () => {
        const back = await loadSafeReturn();
        if (back) {
          const url = new URL(back);
          url.searchParams.set("sair_conta", "1");
          window.location.replace(url.toString());
          return;
        }
        await request(`${API}/sign-out`, { method: "POST", body: {} });
        show("entrar");
        showAlert("Você saiu da conta neste aparelho.", true);
      })
    );

    $("[data-conta-sair]").addEventListener("click", () =>
      withBusy(null, async () => {
        await request(`${API}/sign-out`, { method: "POST", body: {} });
        show("entrar");
        showAlert("Você saiu da conta neste aparelho.", true);
      })
    );
  };

  const start = async () => {
    bind();
    const mode = params.get("modo") || "";
    show("carregando", { focus: false });
    try {
      const me = await request(`${ACCOUNT}/me`);
      state.providers = me.providers || [];
      const hasGoogle = state.providers.includes("google");
      $("[data-conta-google]").hidden = !hasGoogle;
      $("[data-conta-divider]").hidden = !hasGoogle;

      if (mode === "sair") {
        if (me.authenticated) await request(`${API}/sign-out`, { method: "POST", body: {} }).catch(() => {});
        const back = await loadSafeReturn();
        if (back) { window.location.replace(back); return; }
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
      if (mode === "conta" && me.authenticated && !(me.user && me.user.needsPhone)) {
        const user = me.user || {};
        const name = String(user.name || "Cliente");
        const digits = String(user.phone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
        $("[data-conta-perfil-nome]").textContent = name;
        $("[data-conta-perfil-iniciais]").textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
        $("[data-conta-perfil-email]").textContent = user.email || "—";
        $("[data-conta-perfil-telefone]").textContent = digits.length === 11
          ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
          : digits.length === 10 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}` : digits || "—";
        show("perfil");
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
