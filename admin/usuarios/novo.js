(() => {
  const PROFILE_META = Object.freeze({
    OWNER: {
      icon: "AD",
      label: "Administrador",
      description: "Acesso completo à administração do restaurante.",
    },
    GERENTE: {
      icon: "GE",
      description: "Gerencia operação, pedidos, produtos, equipe e relatórios operacionais.",
    },
    CAIXA: {
      icon: "CX",
      description: "Acessa pedidos, pagamentos e funções do caixa.",
    },
    COZINHA: {
      icon: "CZ",
      description: "Acompanha e atualiza a produção dos pedidos.",
    },
    GARCOM: {
      icon: "GA",
      description: "Registra e acompanha pedidos e atendimento.",
    },
    ESTOQUE: {
      icon: "ES",
      description: "Gerencia produtos, entradas, saídas e inventário.",
    },
    FINANCEIRO: {
      icon: "FI",
      description: "Acessa informações financeiras, relatórios e exportações autorizadas.",
    },
    MARKETING: {
      icon: "MK",
      description: "Gerencia promoções, avaliações e comunicação com clientes.",
    },
    ENTREGADOR: {
      icon: "EN",
      description: "Acompanha pedidos em rota e informações necessárias para entrega.",
    },
    CUSTOM: {
      icon: "PE",
      label: "Personalizado",
      description: "Permite selecionar manualmente as permissões deste usuário.",
    },
  });

  const STATUS_META = Object.freeze({
    ACTIVE: {
      description: "Pode acessar imediatamente com uma credencial válida.",
    },
    PENDING: {
      description: "Aguarda definição de senha ou ativação.",
    },
    BLOCKED: {
      description: "Não pode iniciar novas sessões.",
    },
  });

  const SENSITIVE_MODULES = new Set([
    "financial",
    "users",
    "settings",
    "exports",
  ]);
  const SENSITIVE_PERMISSIONS = new Set([
    "users_create",
    "users_edit",
    "users_delete",
    "settings_edit",
    "settings_delete",
    "financial_view",
    "financial_create",
    "financial_edit",
    "financial_delete",
    "exports_view",
  ]);

  const state = {
    context: null,
    restaurantKey: "",
    userType: "",
    status: "PENDING",
    credentialMode: "INVITE",
    permissions: {},
    submitting: false,
    lastPassword: "",
  };

  const app = document.querySelector("[data-user-create-app]");
  const loadingState = document.querySelector("[data-loading-state]");
  const fatalState = document.querySelector("[data-fatal-state]");
  const form = document.querySelector("[data-user-form]");
  const successState = document.querySelector("[data-success-state]");
  const liveRegion = document.querySelector("[data-live-region]");

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    let payload = {};

    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }

    if (!response.ok) {
      const requestError = new Error(
        payload.error || payload.message || "Não foi possível concluir a solicitação."
      );
      requestError.status = response.status;
      requestError.errorCode = payload.errorCode || "";
      throw requestError;
    }

    return payload;
  };

  const announce = (message) => {
    if (!liveRegion) {
      return;
    }

    liveRegion.textContent = "";
    window.requestAnimationFrame(() => {
      liveRegion.textContent = message;
    });
  };

  const getListUrl = () => {
    const actorType = String(state.context?.actor?.userType || "").toUpperCase();
    const platformScope = state.context?.actor?.platformScope === true;
    return platformScope || ["MASTER", "SOCIO"].includes(actorType)
      ? "/admin/master.html?section=users"
      : "/admin/?section=users";
  };

  const syncListLinks = () => {
    const listUrl = getListUrl();
    document.querySelectorAll("[data-users-list-link], [data-cancel-link]").forEach((link) => {
      link.href = listUrl;
    });
  };

  const getRestaurants = () =>
    Array.isArray(state.context?.restaurants) ? state.context.restaurants : [];

  const getSelectedRestaurant = () =>
    getRestaurants().find((restaurant) => restaurant.key === state.restaurantKey) || null;

  const getProfiles = () =>
    Array.isArray(state.context?.profiles) ? state.context.profiles : [];

  const getSelectedProfile = () =>
    getProfiles().find((profile) => profile.type === state.userType) || null;

  const getPermissionModules = () =>
    Array.isArray(state.context?.permissionModules) ? state.context.permissionModules : [];

  const getEffectivePermissions = () => {
    if (state.userType === "CUSTOM") {
      return state.permissions;
    }

    const profile = getSelectedProfile();
    return profile?.permissions && typeof profile.permissions === "object"
      ? profile.permissions
      : {};
  };

  const getEnabledPermissionEntries = () =>
    Object.entries(getEffectivePermissions()).filter(([, enabled]) => enabled === true);

  const getEnabledModuleLabels = () => {
    const permissions = getEffectivePermissions();
    return getPermissionModules()
      .filter((module) =>
        (Array.isArray(module.permissions) ? module.permissions : []).some(
          (permission) => permissions[permission.permission] === true
        )
      )
      .map((module) => module.label || module.key);
  };

  const normalizeName = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

  const getInitials = (value) => {
    const parts = normalizeName(value).split(" ").filter(Boolean);
    if (!parts.length) return "NU";
    return `${parts[0]?.[0] || ""}${parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : parts[0]?.[1] || ""}`
      .toUpperCase()
      .slice(0, 2);
  };

  const formatPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 13);
    const localDigits = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

    if (localDigits.length <= 2) return localDigits;
    if (localDigits.length <= 6) return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2)}`;
    if (localDigits.length <= 10) {
      return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
    }
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7, 11)}`;
  };

  const isValidBrazilianPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    const localDigits = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
    return localDigits.length === 10 || localDigits.length === 11;
  };

  const renderRestaurantSelector = () => {
    const root = document.querySelector("[data-restaurant-selector]");
    if (!root) return;

    const restaurants = getRestaurants();
    const selectedRestaurant = getSelectedRestaurant();

    if (!restaurants.length) {
      root.innerHTML = `
        <div class="user-create-submit-error">
          Nenhum restaurante disponível para este usuário. Verifique o vínculo e o status do restaurante.
        </div>
      `;
      return;
    }

    if (state.context?.canSelectRestaurant) {
      root.innerHTML = `
        <div class="user-restaurant-select">
          <label class="user-create-field" for="user-restaurant">
            <span>Restaurante <b aria-hidden="true">*</b></span>
            <select id="user-restaurant" class="admin-input" name="restaurantKey" required>
              <option value="">Selecione um restaurante</option>
              ${restaurants
                .map(
                  (restaurant) => `
                    <option
                      value="${escapeHtml(restaurant.key)}"
                      ${restaurant.key === state.restaurantKey ? "selected" : ""}
                      ${restaurant.selectable ? "" : "disabled"}
                    >
                      ${escapeHtml(restaurant.name)} · ${escapeHtml(restaurant.statusLabel || restaurant.status)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </label>
          ${
            selectedRestaurant
              ? `<span class="user-restaurant-status">${escapeHtml(
                  selectedRestaurant.statusLabel || selectedRestaurant.status
                )}</span>`
              : ""
          }
        </div>
      `;
      return;
    }

    const restaurant = selectedRestaurant || restaurants[0];
    root.innerHTML = `
      <input type="hidden" name="restaurantKey" value="${escapeHtml(restaurant.key)}" />
      <div class="user-restaurant-fixed">
        <span aria-hidden="true">${escapeHtml(getInitials(restaurant.name))}</span>
        <div>
          <strong>${escapeHtml(restaurant.name)}</strong>
          <small>ID ${escapeHtml(restaurant.restaurantId || restaurant.key)} · ${
            escapeHtml(restaurant.statusLabel || restaurant.status)
          }</small>
        </div>
        <em class="user-restaurant-status">Restaurante fixo</em>
      </div>
    `;
  };

  const getProfileAreas = (profile) => {
    const permissions =
      profile?.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
    const labels = getPermissionModules()
      .filter((module) =>
        (module.permissions || []).some(
          (permission) => permissions[permission.permission] === true
        )
      )
      .map((module) => module.label || module.key);

    return labels.slice(0, 4);
  };

  const renderProfiles = () => {
    const root = document.querySelector("[data-profile-grid]");
    if (!root) return;

    const profiles = getProfiles();
    root.innerHTML = profiles.length
      ? profiles
          .map((profile) => {
            const meta = PROFILE_META[profile.type] || {
              icon: String(profile.label || profile.type).slice(0, 2).toUpperCase(),
              description: "Permissões definidas pelo perfil atual do sistema.",
            };
            const areas = getProfileAreas(profile);
            return `
              <label class="user-profile-card">
                <input
                  type="radio"
                  name="userType"
                  value="${escapeHtml(profile.type)}"
                  ${profile.type === state.userType ? "checked" : ""}
                />
                <span class="user-profile-icon" aria-hidden="true">${escapeHtml(meta.icon)}</span>
                <span class="user-profile-copy">
                  <strong>${escapeHtml(meta.label || profile.label || profile.type)}</strong>
                  <small>${escapeHtml(meta.description)}</small>
                  <span class="user-profile-areas">${
                    profile.type === "CUSTOM"
                      ? "Configuração avançada"
                      : escapeHtml(areas.length ? areas.join(", ") : "Sem acessos automáticos")
                  }</span>
                </span>
              </label>
            `;
          })
          .join("")
      : `
        <div class="user-create-submit-error">
          Nenhum perfil disponível para este escopo.
        </div>
      `;
  };

  const renderPermissionModules = () => {
    const root = document.querySelector("[data-permission-modules]");
    if (!root) return;

    root.innerHTML = getPermissionModules()
      .map((module) => {
        const permissions = Array.isArray(module.permissions) ? module.permissions : [];
        return `
          <article class="user-permission-module" data-permission-module="${escapeHtml(module.key)}">
            <header>
              <label>
                <input type="checkbox" data-module-toggle="${escapeHtml(module.key)}" />
                <strong>${escapeHtml(module.label || module.key)}</strong>
              </label>
              <small data-module-count="${escapeHtml(module.key)}">0 de ${escapeHtml(
                String(permissions.length)
              )}</small>
            </header>
            <div class="user-permission-module-options">
              ${permissions
                .map((permission) => {
                  const sensitive =
                    SENSITIVE_MODULES.has(module.key) ||
                    SENSITIVE_PERMISSIONS.has(permission.permission) ||
                    (permission.action || permission.key) === "delete";
                  return `
                    <label class="user-permission-option ${sensitive ? "is-sensitive" : ""}">
                      <input
                        type="checkbox"
                        data-permission="${escapeHtml(permission.permission)}"
                        data-permission-module-key="${escapeHtml(module.key)}"
                        data-permission-action="${escapeHtml(permission.action || permission.key || "")}"
                        ${state.permissions[permission.permission] === true ? "checked" : ""}
                      />
                      <span>
                        ${escapeHtml(permission.label || permission.action || permission.key || permission.permission)}
                        ${sensitive ? '<em class="user-sensitive-badge">Sensível</em>' : ""}
                      </span>
                    </label>
                  `;
                })
                .join("")}
            </div>
          </article>
        `;
      })
      .join("");
    refreshPermissionModuleStates();
  };

  const refreshPermissionModuleStates = () => {
    getPermissionModules().forEach((module) => {
      const moduleInputs = Array.from(
        document.querySelectorAll(
          `[data-permission-module-key="${CSS.escape(module.key)}"]`
        )
      );
      const selectedCount = moduleInputs.filter((input) => input.checked).length;
      const toggle = document.querySelector(
        `[data-module-toggle="${CSS.escape(module.key)}"]`
      );
      const count = document.querySelector(
        `[data-module-count="${CSS.escape(module.key)}"]`
      );

      if (toggle) {
        toggle.checked = moduleInputs.length > 0 && selectedCount === moduleInputs.length;
        toggle.indeterminate = selectedCount > 0 && selectedCount < moduleInputs.length;
      }
      if (count) {
        count.textContent = `${selectedCount} de ${moduleInputs.length}`;
      }
    });

    const selectedCount = Object.values(state.permissions).filter(Boolean).length;
    const countNode = document.querySelector("[data-permission-count]");
    if (countNode) {
      countNode.textContent = `${selectedCount} selecionada${selectedCount === 1 ? "" : "s"}`;
    }
  };

  const renderStatusOptions = () => {
    const root = document.querySelector("[data-status-options]");
    if (!root) return;

    const inviteMode = state.credentialMode === "INVITE";
    root.innerHTML = (state.context?.statusOptions || [])
      .map(
        (status) => `
          <label class="user-status-card" data-status="${escapeHtml(status.key)}">
            <input
              type="radio"
              name="status"
              value="${escapeHtml(status.key)}"
              ${status.key === state.status ? "checked" : ""}
              ${inviteMode && status.key !== "PENDING" ? "disabled" : ""}
            />
            <span><i class="user-status-dot" aria-hidden="true"></i><strong>${escapeHtml(
              status.label
            )}</strong></span>
            <small>${escapeHtml(STATUS_META[status.key]?.description || "")}</small>
          </label>
        `
      )
      .join("");
  };

  const renderInviteState = () => {
    const root = document.querySelector("[data-invite-state]");
    if (!root) return;

    const delivery = state.context?.invitationDelivery || {};
    root.hidden = state.credentialMode !== "INVITE";

    if (root.hidden) return;

    root.innerHTML = delivery.emailConfigured
      ? `
          <strong>Convite preparado para envio</strong>
          <span>O usuário será criado como Pendente e receberá um link válido por ${escapeHtml(
            String(delivery.expiresInHours || 48)
          )} horas.</span>
        `
      : `
          <strong>Envio de e-mail ainda não configurado</strong>
          <span>O usuário será criado como Pendente, mas o sistema não marcará o convite como enviado.${
            delivery.linkCopyAllowed
              ? " Neste ambiente, o link seguro poderá ser copiado uma única vez após o cadastro."
              : ""
          }</span>
        `;
  };

  const renderAccessAddress = () => {
    const root = document.querySelector("[data-access-address]");
    if (!root) return;

    const address = getSelectedRestaurant()?.accessAddress;
    if (!address || address.status === "NOT_CONFIGURED") {
      root.innerHTML = `
        <div class="user-access-address">
          <div>
            <strong>Endereço não configurado</strong>
            <small>O usuário pode ser criado, mas não há instrução de acesso disponível.</small>
          </div>
          <span class="user-access-status">Sem dados</span>
        </div>
      `;
      return;
    }

    const pending =
      address.type === "CUSTOM_DOMAIN" && address.status !== "ACTIVE";
    root.innerHTML = `
      <div class="user-access-address ${pending ? "is-pending" : ""}">
        <div>
          <strong>${escapeHtml(address.url || address.displayUrl || "Não configurado")}</strong>
          <small>${escapeHtml(address.typeLabel || "Endereço de acesso")} · ${escapeHtml(
            address.managementLabel || "Gerenciamento não informado"
          )}${
            address.type === "CUSTOM_DOMAIN"
              ? ` · DNS ${escapeHtml(address.dnsStatus || "não informado")} · SSL ${escapeHtml(
                  address.sslStatus || "não informado"
                )}`
              : ""
          }</small>
        </div>
        <span class="user-access-status">${escapeHtml(address.statusLabel || address.status)}</span>
        ${
          pending
            ? `
              <span class="user-access-fallback">
                ${
                  address.fallbackUrl
                    ? `O domínio próprio ainda não está funcional. Enquanto isso, utilize <strong>${escapeHtml(
                        address.fallbackUrl.replace(/^https?:\/\//, "")
                      )}</strong>.`
                    : "O domínio próprio ainda não está funcional e este restaurante não possui endereço alternativo confirmado."
                }
              </span>
            `
            : ""
        }
      </div>
    `;
  };

  const updateSummary = () => {
    const data = new FormData(form);
    const name = normalizeName(data.get("name"));
    const email = normalizeEmail(data.get("email"));
    const phone = String(data.get("phone") || "").trim();
    const restaurant = getSelectedRestaurant();
    const profile = getSelectedProfile();
    const profileMeta = PROFILE_META[state.userType] || {};
    const status = (state.context?.statusOptions || []).find(
      (entry) => entry.key === state.status
    );
    const address = restaurant?.accessAddress;
    const enabledPermissions = getEnabledPermissionEntries();
    const modules = getEnabledModuleLabels();

    document.querySelector("[data-summary-avatar]").textContent = getInitials(name);
    document.querySelector("[data-summary-name]").textContent = name || "Nome não informado";
    document.querySelector("[data-summary-email]").textContent = email || "E-mail não informado";

    const phoneNode = document.querySelector("[data-summary-phone]");
    phoneNode.textContent = phone;
    phoneNode.hidden = !phone;

    document.querySelector("[data-summary-restaurant]").textContent =
      restaurant?.name || "Não selecionado";
    document.querySelector("[data-summary-profile]").textContent =
      profileMeta.label || profile?.label || "Não selecionado";
    document.querySelector("[data-summary-status]").textContent =
      status?.label || "Não selecionado";
    document.querySelector("[data-summary-permissions]").textContent =
      `${enabledPermissions.length} permiss${enabledPermissions.length === 1 ? "ão" : "ões"}`;
    document.querySelector("[data-summary-modules]").textContent = modules.length
      ? `${modules.slice(0, 4).join(", ")}${modules.length > 4 ? ` e mais ${modules.length - 4}` : ""}`
      : "Nenhum acesso selecionado";
    document.querySelector("[data-summary-credential]").textContent =
      state.credentialMode === "INVITE" ? "Convite por e-mail" : "Senha temporária";
    document.querySelector("[data-summary-first-access]").textContent =
      state.credentialMode === "INVITE"
        ? "Definição de senha pelo usuário"
        : data.get("mustChangePassword")
          ? "Troca de senha obrigatória"
          : "Senha temporária mantida";
    document.querySelector("[data-summary-address]").textContent =
      address?.displayUrl || "Não configurado";
    document.querySelector("[data-summary-address-type]").textContent =
      address?.typeLabel || "—";
    document.querySelector("[data-summary-address-status]").textContent =
      address?.statusLabel || "Sem dados";
  };

  const syncCustomPermissionsVisibility = () => {
    const customRoot = document.querySelector("[data-custom-permissions]");
    if (!customRoot) return;
    customRoot.hidden = state.userType !== "CUSTOM";
  };

  const syncCredentialMode = () => {
    const passwordPanel = document.querySelector("[data-password-panel]");
    if (passwordPanel) {
      passwordPanel.hidden = state.credentialMode !== "TEMPORARY_PASSWORD";
    }
    renderInviteState();
    renderStatusOptions();
    updateSummary();
  };

  const clearFieldErrors = () => {
    form.querySelectorAll("[data-field-error]").forEach((node) => {
      node.textContent = "";
    });
    form.querySelectorAll("[aria-invalid='true']").forEach((input) => {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
    const submitError = document.querySelector("[data-submit-error]");
    submitError.hidden = true;
    submitError.textContent = "";
  };

  const setFieldError = (name, message) => {
    const errorNode = form.querySelector(`[data-field-error="${CSS.escape(name)}"]`);
    const input = form.elements.namedItem(name);
    if (errorNode) {
      errorNode.textContent = message;
    }
    if (input instanceof HTMLElement) {
      input.setAttribute("aria-invalid", "true");
      if (errorNode?.id) {
        input.setAttribute("aria-describedby", errorNode.id);
      }
    }
  };

  const validateForm = () => {
    clearFieldErrors();
    const data = new FormData(form);
    const name = normalizeName(data.get("name"));
    const email = normalizeEmail(data.get("email"));
    const phone = String(data.get("phone") || "").trim();
    const password = String(data.get("password") || "");
    const errors = [];

    form.elements.name.value = name;
    form.elements.email.value = email;

    if (!name) {
      errors.push(["name", "Informe o nome completo."]);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(["email", "Digite um endereço de e-mail válido."]);
    }
    if (phone && !isValidBrazilianPhone(phone)) {
      errors.push(["phone", "Digite um telefone brasileiro válido com DDD."]);
    }
    const restaurant = getSelectedRestaurant();
    if (!restaurant || !restaurant.selectable) {
      errors.push(["restaurantKey", "Selecione um restaurante ativo."]);
    }
    if (!getSelectedProfile()) {
      errors.push(["userType", "Selecione um perfil de acesso."]);
    }
    if (
      state.userType === "CUSTOM" &&
      !Object.values(state.permissions).some((value) => value === true)
    ) {
      errors.push(["permissions", "Selecione ao menos uma permissão."]);
    }
    if (
      state.credentialMode === "TEMPORARY_PASSWORD" &&
      (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    ) {
      errors.push([
        "password",
        "Use ao menos 10 caracteres, incluindo letras e números.",
      ]);
    }

    errors.forEach(([field, message]) => setFieldError(field, message));
    if (errors.length) {
      const firstField = form.elements.namedItem(errors[0][0]);
      if (firstField instanceof HTMLElement) {
        firstField.focus();
      } else {
        form.querySelector(`[data-field-error="${CSS.escape(errors[0][0])}"]`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      announce("Revise os campos destacados.");
      return null;
    }

    return {
      creationExperienceVersion: 2,
      name,
      login: email,
      email,
      phone,
      jobTitle: String(data.get("jobTitle") || "").replace(/\s+/g, " ").trim(),
      restaurantKey: restaurant.key,
      userScope: "RESTAURANT",
      platformScope: false,
      userType: state.userType,
      status: state.credentialMode === "INVITE" ? "PENDING" : state.status,
      credentialMode: state.credentialMode,
      password: state.credentialMode === "TEMPORARY_PASSWORD" ? password : "",
      mustChangePassword:
        state.credentialMode === "TEMPORARY_PASSWORD" &&
        data.get("mustChangePassword") === "on",
      permissions: state.userType === "CUSTOM" ? state.permissions : {},
    };
  };

  const setSubmitting = (submitting) => {
    state.submitting = submitting;
    const submitButton = document.querySelector("[data-submit-button]");
    const submitLabel = document.querySelector("[data-submit-label]");
    const spinner = document.querySelector("[data-submit-spinner]");
    submitButton.disabled = submitting;
    submitButton.setAttribute("aria-busy", String(submitting));
    submitLabel.textContent = submitting ? "Salvando..." : "Salvar usuário";
    spinner.hidden = !submitting;
    form.querySelectorAll("input, select, button").forEach((control) => {
      if (control !== submitButton) {
        control.disabled = submitting;
      }
    });
    if (!submitting) {
      syncCredentialMode();
    }
  };

  const showSubmitError = (message) => {
    const root = document.querySelector("[data-submit-error]");
    root.textContent = message;
    root.hidden = false;
    root.scrollIntoView({ behavior: "smooth", block: "center" });
    announce(message);
  };

  const renderSuccess = (response, submittedUser) => {
    const restaurant = getSelectedRestaurant();
    const profile = getSelectedProfile();
    const profileMeta = PROFILE_META[state.userType] || {};
    const address = restaurant?.accessAddress || {};
    const enabledPermissions = getEnabledPermissionEntries();
    const successTitle = document.querySelector("[data-success-title]");
    const successMessage = document.querySelector("[data-success-message]");
    const details = document.querySelector("[data-success-details]");
    const createdUser = response.user || {};
    const accessValue =
      address.type === "CUSTOM_DOMAIN" && address.status !== "ACTIVE"
        ? address.fallbackUrl || address.displayUrl || "Não configurado"
        : address.finalUrl || address.url || address.displayUrl || "Não configurado";

    successTitle.textContent = `${submittedUser.name} foi cadastrado`;
    successMessage.textContent =
      address.type === "CUSTOM_DOMAIN" && address.status !== "ACTIVE"
        ? address.fallbackUrl
          ? `O domínio próprio ainda está pendente. Enquanto isso, o acesso deve usar ${address.fallbackUrl.replace(
              /^https?:\/\//,
              ""
            )}.`
          : "O domínio próprio ainda está pendente e não há endereço alternativo confirmado."
        : `${submittedUser.name} poderá acessar o restaurante pelo endereço ${accessValue}.`;
    details.innerHTML = [
      ["Restaurante", restaurant?.name || "Não informado"],
      ["Perfil", profileMeta.label || profile?.label || state.userType],
      ["Status", createdUser.statusLabel || createdUser.status || submittedUser.status],
      [
        "Permissões",
        `${enabledPermissions.length} permiss${enabledPermissions.length === 1 ? "ão" : "ões"}`,
      ],
      ["Endereço", String(accessValue).replace(/^https?:\/\//, "")],
      ["Tipo", address.typeLabel || "Não configurado"],
      ["Gerenciamento", address.managementLabel || "Não informado"],
    ]
      .map(
        ([label, value]) => `
          <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
        `
      )
      .join("");

    const secretRoot = document.querySelector("[data-success-secret]");
    secretRoot.hidden = state.credentialMode !== "TEMPORARY_PASSWORD";
    if (!secretRoot.hidden) {
      state.lastPassword = submittedUser.password;
      document.querySelector("[data-success-password]").textContent = state.lastPassword;
    }

    const inviteRoot = document.querySelector("[data-success-invite]");
    inviteRoot.hidden = state.credentialMode !== "INVITE";
    if (!inviteRoot.hidden) {
      const invitation = response.invitation || {};
      inviteRoot.innerHTML = invitation.emailSent
        ? `<strong>Convite enviado</strong><small>O link expira automaticamente e só pode ser usado uma vez.</small>`
        : invitation.invitationUrl
          ? `
              <strong>E-mail não configurado — copie o link seguro somente neste ambiente</strong>
              <small>Endereço do restaurante: ${escapeHtml(
                invitation.restaurantAccessUrl ||
                  address.finalUrl ||
                  address.url ||
                  "não configurado"
              )}</small>
              <div>
                <code data-invitation-url>${escapeHtml(invitation.invitationUrl)}</code>
                <button class="admin-button admin-button-secondary" type="button" data-copy-invitation>Copiar</button>
              </div>
              <small>O token não foi registrado em logs e ficará inválido depois do uso ou da expiração.</small>
            `
          : `
              <strong>Convite criado, mas não enviado</strong>
              <small>O serviço de e-mail e a cópia do link não estão habilitados neste ambiente. Reenvie após configurar a entrega.</small>
            `;
    }

    form.hidden = true;
    successState.hidden = false;
    successState.scrollIntoView({ behavior: "smooth", block: "start" });
    announce("Usuário criado com sucesso.");
  };

  const submitUser = async () => {
    if (state.submitting) return;
    const user = validateForm();
    if (!user) return;

    setSubmitting(true);
    try {
      const response = await fetchJson("/api/admin/users/create", {
        method: "POST",
        body: JSON.stringify({
          creationExperienceVersion: 2,
          user,
        }),
      });
      renderSuccess(response, user);
    } catch (error) {
      setSubmitting(false);
      if (error.status === 401) {
        window.location.href = `/admin/login.html?next=${encodeURIComponent(
          window.location.pathname
        )}`;
        return;
      }
      if (error.status === 409 || error.errorCode === "duplicate_user_email") {
        setFieldError("email", "Já existe um usuário com este e-mail.");
        form.elements.email.focus();
        announce("Já existe um usuário com este e-mail.");
        return;
      }
      if (error.errorCode === "permission_dependency_missing") {
        setFieldError(
          "permissions",
          "Uma permissão de alteração exige a visualização do mesmo módulo."
        );
        return;
      }
      showSubmitError(error.message || "Não foi possível criar o usuário. Os dados foram mantidos.");
    }
  };

  const generateStrongPassword = () => {
    const random = new Uint32Array(4);
    crypto.getRandomValues(random);
    const password = `Inovas!${Array.from(random)
      .map((value) => value.toString(36))
      .join("")
      .slice(0, 14)}9`;
    form.elements.password.value = password;
    form.elements.password.type = "text";
    const toggle = document.querySelector("[data-toggle-password]");
    toggle.textContent = "Ocultar";
    toggle.setAttribute("aria-label", "Ocultar senha");
    updateSummary();
    announce("Senha forte gerada.");
  };

  const handlePermissionChange = (input) => {
    const permission = String(input.dataset.permission || "");
    const moduleKey = String(input.dataset.permissionModuleKey || "");
    const action = String(input.dataset.permissionAction || "");

    state.permissions[permission] = input.checked;
    if (input.checked && action !== "view") {
      const viewPermission = `${moduleKey}_view`;
      state.permissions[viewPermission] = true;
      const viewInput = document.querySelector(
        `[data-permission="${CSS.escape(viewPermission)}"]`
      );
      if (viewInput) viewInput.checked = true;
    }
    if (!input.checked && action === "view") {
      document
        .querySelectorAll(`[data-permission-module-key="${CSS.escape(moduleKey)}"]`)
        .forEach((moduleInput) => {
          state.permissions[moduleInput.dataset.permission] = false;
          moduleInput.checked = false;
        });
    }
    refreshPermissionModuleStates();
    updateSummary();
  };

  const handleModuleToggle = (input) => {
    const moduleKey = String(input.dataset.moduleToggle || "");
    document
      .querySelectorAll(`[data-permission-module-key="${CSS.escape(moduleKey)}"]`)
      .forEach((permissionInput) => {
        permissionInput.checked = input.checked;
        state.permissions[permissionInput.dataset.permission] = input.checked;
      });
    refreshPermissionModuleStates();
    updateSummary();
  };

  const filterPermissionModules = (query) => {
    const normalizedQuery = String(query || "").trim().toLocaleLowerCase("pt-BR");
    document.querySelectorAll("[data-permission-module]").forEach((module) => {
      module.hidden =
        Boolean(normalizedQuery) &&
        !module.textContent.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    });
  };

  const bindEvents = () => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitUser();
    });

    form.addEventListener("input", (event) => {
      const input = event.target;
      if (input.name === "phone") {
        input.value = formatPhone(input.value);
      }
      if (input.name === "email") {
        input.value = input.value.replace(/\s+/g, "");
      }
      if (input.name && input.getAttribute("aria-invalid") === "true") {
        input.removeAttribute("aria-invalid");
        const errorNode = form.querySelector(
          `[data-field-error="${CSS.escape(input.name)}"]`
        );
        if (errorNode) errorNode.textContent = "";
      }
      updateSummary();
    });

    form.addEventListener("change", (event) => {
      const input = event.target;
      if (input.name === "restaurantKey") {
        state.restaurantKey = String(input.value || "");
        renderRestaurantSelector();
        renderAccessAddress();
        updateSummary();
        return;
      }
      if (input.name === "userType") {
        state.userType = String(input.value || "");
        if (state.userType === "CUSTOM" && !Object.keys(state.permissions).length) {
          state.permissions = {};
        }
        renderProfiles();
        syncCustomPermissionsVisibility();
        updateSummary();
        return;
      }
      if (input.name === "credentialMode") {
        state.credentialMode = String(input.value || "INVITE");
        state.status = state.credentialMode === "INVITE" ? "PENDING" : "ACTIVE";
        syncCredentialMode();
        return;
      }
      if (input.name === "status") {
        state.status = String(input.value || "ACTIVE");
        updateSummary();
        return;
      }
      if (input.matches("[data-permission]")) {
        handlePermissionChange(input);
        return;
      }
      if (input.matches("[data-module-toggle]")) {
        handleModuleToggle(input);
      }
      updateSummary();
    });

    form.addEventListener("click", (event) => {
      const togglePassword = event.target.closest("[data-toggle-password]");
      if (togglePassword) {
        const input = form.elements.password;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        togglePassword.textContent = show ? "Ocultar" : "Mostrar";
        togglePassword.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
        return;
      }
      if (event.target.closest("[data-generate-password]")) {
        generateStrongPassword();
        return;
      }
      if (event.target.closest("[data-clear-permissions]")) {
        state.permissions = {};
        renderPermissionModules();
        updateSummary();
      }
    });

    document.querySelector("[data-permission-search]")?.addEventListener("input", (event) => {
      filterPermissionModules(event.target.value);
    });

    successState.addEventListener("click", async (event) => {
      if (event.target.closest("[data-copy-password]") && state.lastPassword) {
        await navigator.clipboard.writeText(state.lastPassword);
        announce("Senha temporária copiada.");
        return;
      }
      const invitationButton = event.target.closest("[data-copy-invitation]");
      if (invitationButton) {
        const invitationUrl = document.querySelector("[data-invitation-url]")?.textContent || "";
        if (invitationUrl) {
          await navigator.clipboard.writeText(invitationUrl);
          announce("Link de convite copiado.");
        }
        return;
      }
      if (event.target.closest("[data-create-another]")) {
        state.lastPassword = "";
        window.location.reload();
      }
    });

    document.querySelector("[data-retry-load]")?.addEventListener("click", () => {
      void loadContext();
    });
  };

  const showFatal = (title, message) => {
    loadingState.hidden = true;
    form.hidden = true;
    successState.hidden = true;
    fatalState.hidden = false;
    document.querySelector("[data-fatal-title]").textContent = title;
    document.querySelector("[data-fatal-message]").textContent = message;
  };

  const initializeForm = () => {
    const restaurants = getRestaurants();
    if (state.context.canSelectRestaurant) {
      state.restaurantKey = "";
    } else {
      state.restaurantKey =
        state.context.fixedRestaurantKey ||
        restaurants.find((restaurant) => restaurant.selectable)?.key ||
        "";
    }
    const profiles = getProfiles();
    state.userType =
      profiles.find((profile) => profile.type === "GERENTE")?.type ||
      profiles.find((profile) => profile.type !== "OWNER")?.type ||
      profiles[0]?.type ||
      "";
    state.credentialMode = "INVITE";
    state.status = "PENDING";
    state.permissions = {};

    syncListLinks();
    renderRestaurantSelector();
    renderProfiles();
    renderPermissionModules();
    renderStatusOptions();
    renderInviteState();
    renderAccessAddress();
    syncCustomPermissionsVisibility();
    syncCredentialMode();
    updateSummary();

    loadingState.hidden = true;
    fatalState.hidden = true;
    successState.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  };

  const loadContext = async () => {
    loadingState.hidden = false;
    fatalState.hidden = true;
    form.hidden = true;

    try {
      const context = await fetchJson("/api/admin/users/create-context");
      state.context = context;
      if (!Array.isArray(context.restaurants) || !context.restaurants.length) {
        showFatal(
          "Nenhum restaurante disponível",
          "Não existe um restaurante acessível e elegível para receber este usuário."
        );
        return;
      }
      if (!Array.isArray(context.profiles) || !context.profiles.length) {
        showFatal(
          "Nenhum perfil disponível",
          "Os perfis de acesso não puderam ser carregados para o seu escopo."
        );
        return;
      }
      initializeForm();
    } catch (error) {
      if (error.status === 401) {
        window.location.href = `/admin/login.html?next=${encodeURIComponent(
          window.location.pathname
        )}`;
        return;
      }
      if (error.status === 403) {
        showFatal(
          "Você não tem autorização",
          "Somente usuários com permissão para criar usuários podem acessar esta página."
        );
        return;
      }
      showFatal(
        "Não foi possível carregar o cadastro",
        "O restaurante, os perfis ou as permissões não responderam. Tente novamente."
      );
    }
  };

  if (!app || !form) {
    return;
  }

  bindEvents();
  void loadContext();
})();
