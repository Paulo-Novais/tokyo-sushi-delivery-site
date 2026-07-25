(() => {
  const form = document.querySelector("[data-invite-form]");
  const success = document.querySelector("[data-invite-success]");
  const token = new URLSearchParams(window.location.search).get("token") || "";

  if (!form) return;

  const setError = (field, message) => {
    const node = document.querySelector(`[data-invite-error="${field}"]`);
    const input = form.elements.namedItem(field);
    if (node) node.textContent = message;
    if (input instanceof HTMLElement) input.setAttribute("aria-invalid", "true");
  };

  const clearErrors = () => {
    document.querySelectorAll("[data-invite-error]").forEach((node) => {
      node.textContent = "";
    });
    form.querySelectorAll("[aria-invalid='true']").forEach((input) => {
      input.removeAttribute("aria-invalid");
    });
    const root = document.querySelector("[data-invite-submit-error]");
    root.hidden = true;
    root.textContent = "";
  };

  const showSubmitError = (message) => {
    const root = document.querySelector("[data-invite-submit-error]");
    root.textContent = message;
    root.hidden = false;
  };

  document.querySelector("[data-toggle-invite-password]")?.addEventListener("click", (event) => {
    const show = form.elements.password.type === "password";
    form.elements.password.type = show ? "text" : "password";
    event.currentTarget.textContent = show ? "Ocultar" : "Mostrar";
    event.currentTarget.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    const password = String(form.elements.password.value || "");
    const passwordConfirm = String(form.elements.passwordConfirm.value || "");

    if (!token) {
      showSubmitError("Este link de convite está incompleto. Solicite um novo convite.");
      return;
    }
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("password", "Use ao menos 10 caracteres, incluindo letras e números.");
      form.elements.password.focus();
      return;
    }
    if (password !== passwordConfirm) {
      setError("passwordConfirm", "As senhas não coincidem.");
      form.elements.passwordConfirm.focus();
      return;
    }

    const button = document.querySelector("[data-invite-submit]");
    button.disabled = true;
    button.textContent = "Ativando...";

    try {
      const response = await fetch("/api/admin/auth/accept-invite", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível ativar este convite.");
      }
      history.replaceState(null, "", "/admin/convite.html");
      form.hidden = true;
      success.hidden = false;
      success.focus?.();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Ativar meu acesso";
      showSubmitError(error.message || "Não foi possível ativar este convite.");
    }
  });
})();
