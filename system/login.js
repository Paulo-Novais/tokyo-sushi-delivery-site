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
    submitButton.disabled = true;
    submitButton.textContent = "Entrando...";

    const formData = new FormData(form);

    try {
      const response = await fetch("/api/auth/system/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: String(formData.get("identifier") || "").trim(),
          password: String(formData.get("password") || ""),
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.success !== true) {
        throw new Error(
          payload.error?.message ||
            payload.error ||
            "Não foi possível autenticar esta conta System."
        );
      }

      showFeedback("Acesso autorizado. Abrindo a plataforma...", "success");
      window.location.assign(resolveNextPath());
    } catch (error) {
      showFeedback(
        error?.message || "Não foi possível entrar. Tente novamente."
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Entrar no System";
    }
  });
})();
