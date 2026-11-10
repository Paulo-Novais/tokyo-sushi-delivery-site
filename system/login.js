(() => {
  "use strict";

  const form = document.querySelector("[data-system-login-form]");
  const submitButton = document.querySelector("[data-system-login-submit]");
  const feedback = document.querySelector("[data-system-login-feedback]");

  if (!form || !submitButton || !feedback) {
    return;
  }

  const resolveNextPath = () => {
    const candidate = new URLSearchParams(window.location.search).get("next");
    return candidate && /^\/system(?:\/|$)/.test(candidate)
      ? candidate
      : "/system";
  };

  const showFeedback = (message, kind = "error") => {
    feedback.textContent = message;
    feedback.dataset.kind = kind;
    feedback.hidden = false;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.hidden = true;

    const formData = new FormData(form);
    const identifier = String(formData.get("identifier") || "").trim();
    const password = String(formData.get("password") || "");
    if (!identifier || !password) {
      showFeedback("Informe o e-mail e a senha para entrar.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Entrando…";

    try {
      const response = await fetch("/api/auth/system/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.success !== true) {
        // Mensagem genérica: não revela se o e-mail existe.
        throw new Error(
          response.status === 401 || response.status === 403
            ? "E-mail ou senha incorretos. Confira os dados e tente novamente."
            : payload.error?.message ||
              payload.error ||
              "Não foi possível entrar agora. Tente novamente em instantes."
        );
      }

      showFeedback("Acesso autorizado. Abrindo a plataforma…", "success");
      window.location.assign(resolveNextPath());
    } catch (error) {
      showFeedback(
        error?.message || "Não foi possível entrar. Tente novamente."
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Entrar";
    }
  });
})();
