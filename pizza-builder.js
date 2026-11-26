// Monte sua pizza (cardápio do tipo Pizzaria).
// Liga quando o restaurante ativa a montagem no Gestor (Cardápio > Montagem
// de pizza). Usa o cardápio e a sacola do script.js. O preço mostrado aqui é
// só para o cliente ver: o servidor recalcula (sabor mais caro + borda).
(() => {
  "use strict";

  const PREFIX = "pizza|";
  const state = { count: 2, picks: [], border: "", withBorder: false, qty: 1, query: "" };
  let overlay = null;
  let uid = 0;

  const getConfig = () => {
    const config = typeof restaurantSettingsState !== "undefined" ? restaurantSettingsState.settings?.pizzaBuilder : null;
    return config && config.enabled === true ? config : null;
  };
  const money = (value) => (typeof formatPrice === "function" ? formatPrice(value) : `R$ ${value.toFixed(2).replace(".", ",")}`);
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const fraction = (count) => (count === 2 ? "½" : count === 3 ? "⅓" : count === 4 ? "¼" : "");
  const isOrderable = (item) => (typeof isMenuItemOrderable === "function" ? isMenuItemOrderable(item) : true);

  // Sabores = itens das seções marcadas como sabores.
  const getFlavorGroups = (config) => {
    const ids = new Set(config.flavorSectionIds || []);
    return (typeof MENU_SECTIONS !== "undefined" ? MENU_SECTIONS : [])
      .filter((section) => ids.has(section.id))
      .map((section) => ({
        id: section.id,
        title: section.title || section.kicker || "Sabores",
        items: (section.items || []).filter((item) => typeof item.price === "number" && isOrderable(item)),
      }))
      .filter((group) => group.items.length);
  };
  const flavorById = (config, id) => {
    for (const group of getFlavorGroups(config)) {
      const found = group.items.find((item) => item.id === id);
      if (found) return found;
    }
    return null;
  };

  const resolve = (config, flavorIds, borderId) => {
    const flavors = flavorIds.map((id) => flavorById(config, id));
    if (!flavors.length || flavors.some((flavor) => !flavor)) return null;
    if (!config.flavorCounts.includes(flavors.length)) return null;
    const border = borderId ? (config.borders || []).find((entry) => entry.id === borderId) : null;
    if (borderId && !border) return null;
    const top = flavors.reduce((best, flavor) => (flavor.price > best.price ? flavor : best), flavors[0]);
    const count = flavors.length;
    const flavorText = flavors.map((flavor) => `${fraction(count) ? `${fraction(count)} ` : ""}${flavor.name}`).join(" + ");
    const title = count === 1 ? `Pizza ${flavors[0].name}` : `Pizza ${count} sabores`;
    return {
      id: `${PREFIX}${count}|${flavors.map((flavor) => flavor.id).join(",")}|${border ? border.id : ""}`,
      name: `${title} (${config.sizeLabel})${count > 1 ? `: ${flavorText}` : ""}${border ? ` · borda de ${border.name}` : " · sem borda"}`,
      category: "Pizza montada",
      price: Number((top.price + (border ? border.price : 0)).toFixed(2)),
      flavors,
      top,
      border,
    };
  };

  // Sacola: refaz nome e preço da pizza com o cardápio atual.
  const resolveCartItem = (item) => {
    // Configurações ainda carregando: mantém a pizza como está (o servidor
    // confere tudo no pedido).
    if (typeof restaurantSettingsState !== "undefined" && !restaurantSettingsState.loaded) {
      return typeof item?.price === "number" ? item : null;
    }
    const config = getConfig();
    if (!config) return null;
    const parts = String(item?.id || "").split("|");
    if (parts.length !== 4) return null;
    const pizza = resolve(config, parts[2].split(",").filter(Boolean), parts[3]);
    if (!pizza) return null;
    return { ...item, id: pizza.id, name: pizza.name, category: pizza.category, price: pizza.price };
  };

  // ---------- desenho da pizza (fotos dos sabores recortadas em fatias) ----------
  const pizzaSvg = (slots, { crust = "", photos = true } = {}) => {
    const id = `pzb${++uid}`;
    const n = slots.length || 1;
    const cx = 50;
    const cy = 50;
    const r = 41;
    let defs = `<radialGradient id="${id}c" cx="50%" cy="45%" r="55%"><stop offset="70%" stop-color="#e7a457"/><stop offset="100%" stop-color="#9c5524"/></radialGradient>`;
    let body = `<circle cx="50" cy="50" r="47" fill="url(#${id}c)"/>`;
    slots.forEach((flavor, index) => {
      const a0 = -Math.PI / 2 + (index * 2 * Math.PI) / n;
      const a1 = a0 + (2 * Math.PI) / n;
      const path =
        n === 1
          ? `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`
          : `M${cx},${cy} L${(cx + r * Math.cos(a0)).toFixed(2)},${(cy + r * Math.sin(a0)).toFixed(2)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${(cx + r * Math.cos(a1)).toFixed(2)},${(cy + r * Math.sin(a1)).toFixed(2)} Z`;
      if (!flavor) {
        const mid = (a0 + a1) / 2;
        const rr = n === 1 ? 0 : r * 0.55;
        body += `<path d="${path}" fill="rgba(255,255,255,.06)" stroke="currentColor" stroke-opacity=".45" stroke-dasharray="2 2" stroke-width=".7"/><text x="${(cx + rr * Math.cos(mid)).toFixed(2)}" y="${(cy + rr * Math.sin(mid) + 4).toFixed(2)}" text-anchor="middle" font-size="${n === 1 ? 16 : 11}" font-weight="700" fill="currentColor" opacity=".7">?</text>`;
        return;
      }
      const image = photos && flavor.image ? (typeof optimizeKnownAssetUrl === "function" ? optimizeKnownAssetUrl(flavor.image) : flavor.image) : "";
      if (image) {
        defs += `<clipPath id="${id}s${index}"><path d="${path}"/></clipPath>`;
        body += `<path d="${path}" fill="#f2c766"/><image href="${esc(image)}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}s${index})"/>`;
      } else {
        body += `<path d="${path}" fill="#f2c766"/>`;
      }
    });
    if (n > 1) {
      for (let index = 0; index < n; index += 1) {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
        body += `<line x1="50" y1="50" x2="${(cx + r * Math.cos(angle)).toFixed(2)}" y2="${(cy + r * Math.sin(angle)).toFixed(2)}" stroke="#2a1208" stroke-opacity=".7" stroke-width="1.1"/>`;
      }
    }
    if (crust) body += `<circle cx="50" cy="50" r="44" fill="none" stroke="${esc(crust)}" stroke-width="5.5"/>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
  };
  const BORDER_COLORS = { catupiry: "#fbf3e0", cheddar: "#f5a524", mucarela: "#f3d36e", chocolate: "#5a2d16" };
  const borderColor = (border) => (border ? BORDER_COLORS[border.id] || "#f6e2b0" : "");

  // ---------- seção "Monte sua pizza" no topo do cardápio ----------
  const mount = () => {
    const root = typeof catalogRoot !== "undefined" ? catalogRoot : document.querySelector("[data-catalog-root]");
    if (!root) return;
    root.querySelector("[data-pizza-builder]")?.remove();
    const config = getConfig();
    if (!config) return;
    const groups = getFlavorGroups(config);
    const flavors = groups.flatMap((group) => group.items);
    if (!flavors.length) return;
    const minPrice = Math.min(...flavors.map((flavor) => flavor.price));
    const sample = (count) => flavors.slice(0, count);
    const label = (count) => (count === 1 ? "Pizza 1 sabor" : `Pizza ${count} sabores`);
    const desc = (count) =>
      count === 1 ? "A pizza inteira de um sabor só." : count === 2 ? "Metade de cada sabor." : `${count} sabores na mesma pizza.`;
    const section = document.createElement("section");
    section.className = "pzb-block";
    section.id = "monte-sua-pizza";
    section.setAttribute("data-pizza-builder", "");
    section.innerHTML = `
      <div class="pzb-head">
        <span class="pzb-kicker">Pizza · ${esc(config.sizeLabel)}</span>
        <h2>Monte sua pizza</h2>
        <p>Escolha quantos sabores e monte do seu jeito. Você paga pelo sabor mais caro, nunca a soma.</p>
      </div>
      <div class="pzb-cards">
        ${config.flavorCounts
          .map(
            (count) => `
          <button type="button" class="pzb-card" data-pizza-open="${count}">
            ${count === 2 && config.flavorCounts.length > 1 ? '<span class="pzb-tag">Mais pedida</span>' : ""}
            ${pizzaSvg(sample(count).length === count ? sample(count) : Array(count).fill(null))}
            <span class="pzb-card-copy">
              <small>${esc(config.sizeLabel)}${count === 2 ? " · meio a meio" : ""}</small>
              <strong>${label(count)}</strong>
              <span>${desc(count)}</span>
              <span class="pzb-card-foot"><span>a partir de <b>${money(minPrice)}</b></span><span class="pzb-go">Montar</span></span>
            </span>
          </button>`
          )
          .join("")}
      </div>
      <p class="pzb-rule"><b>Como cobramos:</b> numa pizza com mais de um sabor, o valor é o do sabor mais caro.${
        (config.borders || []).length
          ? (config.borders || []).some((border) => border.price > 0)
            ? " Borda recheada soma à parte."
            : " Borda recheada sem custo."
          : ""
      }</p>`;
    root.prepend(section);
  };

  // ---------- janela de montagem ----------
  const ensureOverlay = () => {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "pzb-overlay";
    overlay.setAttribute("data-pizza-overlay", "");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pzb-title");
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="pzb-sheet">
        <div class="pzb-visual"><div data-pizza-visual></div><div class="pzb-slots" data-pizza-slots></div></div>
        <div class="pzb-pane">
          <div class="pzb-pane-head">
            <div><h3 id="pzb-title" data-pizza-title></h3><p data-pizza-sub></p></div>
            <button type="button" class="pzb-close" data-pizza-close aria-label="Fechar">✕</button>
          </div>
          <div class="pzb-counts" data-pizza-counts></div>
          <label class="pzb-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar sabor" aria-label="Buscar sabor" data-pizza-search></label>
          <div class="pzb-list" data-pizza-list></div>
          <div class="pzb-foot">
            <div class="pzb-calc" data-pizza-calc></div>
            <div class="pzb-qty"><button type="button" data-pizza-qty="-1" aria-label="Menos">−</button><span data-pizza-qty-value>1</span><button type="button" data-pizza-qty="1" aria-label="Mais">+</button></div>
            <button type="button" class="pzb-add" data-pizza-add disabled><span data-pizza-add-label></span><span data-pizza-add-total></span></button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-pizza-search]").addEventListener("input", (event) => {
      state.query = event.target.value;
      render();
    });
    return overlay;
  };

  const open = (count) => {
    const config = getConfig();
    if (!config) return;
    ensureOverlay();
    state.count = config.flavorCounts.includes(count) ? count : config.flavorCounts[0];
    state.picks = [];
    state.border = "";
    state.withBorder = false;
    state.qty = 1;
    state.query = "";
    overlay.querySelector("[data-pizza-search]").value = "";
    overlay.hidden = false;
    document.body.classList.add("pzb-open");
    render();
    overlay.querySelector("[data-pizza-close]").focus({ preventScroll: true });
  };
  const close = () => {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("pzb-open");
  };

  const render = () => {
    const config = getConfig();
    if (!config || !overlay) return;
    const count = state.count;
    const flavorsDone = state.picks.length === count;
    const borders = config.borders || [];
    const borderDone = !state.withBorder || Boolean(state.border);
    const done = flavorsDone && borderDone;
    const border = borders.find((entry) => entry.id === state.border) || null;
    const picked = state.picks.map((id) => flavorById(config, id)).filter(Boolean);
    const slots = Array.from({ length: count }, (_, index) => picked[index] || null);
    const q = state.query.trim().toLowerCase();

    overlay.querySelector("[data-pizza-title]").textContent = count === 1 ? "Pizza 1 sabor" : `Pizza ${count} sabores`;
    overlay.querySelector("[data-pizza-sub]").textContent = `${config.sizeLabel} · ${count === 1 ? "escolha 1 sabor" : `escolha ${count} sabores`}`;
    overlay.querySelector("[data-pizza-counts]").innerHTML =
      config.flavorCounts.length > 1
        ? config.flavorCounts
            .map((value) => `<button type="button" class="${value === count ? "is-on" : ""}" data-pizza-count="${value}">${value === 1 ? "1 sabor" : `${value} sabores`}</button>`)
            .join("")
        : "";
    overlay.querySelector("[data-pizza-visual]").innerHTML = pizzaSvg(slots, { crust: borderColor(border) });
    overlay.querySelector("[data-pizza-slots]").innerHTML =
      slots
        .map((flavor, index) =>
          flavor
            ? `<span class="is-filled">${fraction(count) ? `${fraction(count)} ` : ""}${esc(flavor.name)}</span>`
            : `<span>${fraction(count) ? `${fraction(count)} ` : ""}sabor ${index + 1}</span>`
        )
        .join("") +
      (borders.length ? (border ? `<span class="is-filled">Borda de ${esc(border.name.toLowerCase())}</span>` : `<span>${state.withBorder ? "borda: escolha o recheio" : "sem borda"}</span>`) : "");

    let html = "";
    getFlavorGroups(config).forEach((group, index) => {
      const items = group.items.filter((item) => !q || `${item.name} ${item.description || ""}`.toLowerCase().includes(q));
      if (!items.length) return;
      html += `<div class="pzb-group"><b>${esc(group.title)}</b>${
        index === 0 ? `<span class="${flavorsDone ? "is-ok" : ""}">${flavorsDone ? "✓ Pronto" : `Escolha ${count} · ${state.picks.length}/${count}`}</span>` : ""
      }</div>`;
      html += items
        .map((item) => {
          const position = state.picks.indexOf(item.id);
          const on = position >= 0;
          const thumb = item.image
            ? `<img src="${esc(typeof optimizeKnownAssetUrl === "function" ? optimizeKnownAssetUrl(item.image) : item.image)}" alt="" loading="lazy">`
            : pizzaSvg([item], { photos: false });
          return `<button type="button" class="pzb-row${on ? " is-on" : ""}${!on && flavorsDone && count > 1 ? " is-dim" : ""}" data-pizza-flavor="${esc(item.id)}" aria-pressed="${on}">
            <span class="pzb-thumb">${thumb}</span>
            <span class="pzb-row-copy"><b>${esc(item.name)}</b><small>${esc(item.description || "")}</small></span>
            <span class="pzb-price">${money(item.price)}</span>
            <span class="pzb-check">${on ? (count > 1 ? position + 1 : "✓") : ""}</span>
          </button>`;
        })
        .join("");
    });
    if (borders.length && (!q || "borda".includes(q))) {
      const minBorder = Math.min(...borders.map((entry) => entry.price));
      html += `<div class="pzb-group"><b>Borda</b><span class="${borderDone ? "is-ok" : ""}">${borderDone ? "✓ Pronto" : "Escolha o recheio"}</span></div>
        <div class="pzb-border-modes">
          <button type="button" class="${!state.withBorder ? "is-on" : ""}" data-pizza-border-mode="0"><b>Sem borda</b><small>Massa tradicional</small></button>
          <button type="button" class="${state.withBorder ? "is-on" : ""}" data-pizza-border-mode="1"><b>Com borda recheada</b><small>${minBorder > 0 ? `a partir de ${money(minBorder)}` : "sem custo"}</small></button>
        </div>
        ${
          state.withBorder
            ? `<div class="pzb-borders">${borders
                .map(
                  (entry) => `<button type="button" class="${state.border === entry.id ? "is-on" : ""}" data-pizza-border="${esc(entry.id)}"><i style="background:${borderColor(entry)}"></i><span><b>${esc(entry.name)}</b><small>${entry.price > 0 ? `+ ${money(entry.price)}` : "grátis"}</small></span></button>`
                )
                .join("")}</div>`
            : ""
        }`;
    }
    overlay.querySelector("[data-pizza-list]").innerHTML = html || `<p class="pzb-empty">Nenhum sabor com “${esc(state.query)}”.</p>`;

    const pizza = flavorsDone ? resolve(config, state.picks, state.withBorder ? state.border : "") : null;
    let calc;
    if (picked.length) {
      const top = picked.reduce((best, flavor) => (flavor.price > best.price ? flavor : best), picked[0]);
      calc =
        count > 1 && picked.length > 1
          ? `Cobramos o sabor mais caro: <b>${esc(top.name)} ${money(top.price)}</b>`
          : `<b>${esc(top.name)}</b> ${money(top.price)}`;
      if (border) calc += ` · borda de ${esc(border.name.toLowerCase())} <b>${border.price > 0 ? `+ ${money(border.price)}` : "grátis"}</b>`;
    } else {
      calc = count === 1 ? "Escolha o sabor da pizza." : `Escolha ${count} sabores. Você paga pelo mais caro.`;
    }
    overlay.querySelector("[data-pizza-calc]").innerHTML = calc;
    overlay.querySelector("[data-pizza-qty-value]").textContent = String(state.qty);
    const add = overlay.querySelector("[data-pizza-add]");
    add.disabled = !(done && pizza);
    const missing = count - state.picks.length;
    overlay.querySelector("[data-pizza-add-label]").textContent = done
      ? "Adicionar à sacola"
      : !flavorsDone
        ? `Falta${missing > 1 ? "m" : ""} ${missing} sabor${missing > 1 ? "es" : ""}`
        : "Escolha o recheio da borda";
    const unit = picked.length
      ? Math.max(...picked.map((flavor) => flavor.price)) + (border ? border.price : 0)
      : 0;
    overlay.querySelector("[data-pizza-add-total]").textContent = picked.length ? money(unit * state.qty) : "";
  };

  const addToCart = () => {
    const config = getConfig();
    const pizza = config ? resolve(config, state.picks, state.withBorder ? state.border : "") : null;
    if (!pizza || typeof loadCart !== "function") return;
    const cart = loadCart();
    const existing = cart.find((entry) => entry.id === pizza.id);
    if (existing) existing.quantity += state.qty;
    else cart.push({ id: pizza.id, name: pizza.name, category: pizza.category, price: pizza.price, quantity: state.qty });
    saveCart(cart);
    close();
    if (typeof renderCart === "function") renderCart();
    if (typeof openCart === "function") openCart();
  };

  const keepScroll = (fn) => {
    const list = overlay?.querySelector("[data-pizza-list]");
    const top = list ? list.scrollTop : 0;
    fn();
    render();
    if (list) list.scrollTop = top;
  };

  document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-pizza-open]");
    if (opener) {
      open(Number(opener.dataset.pizzaOpen));
      return;
    }
    if (!overlay || overlay.hidden) return;
    if (event.target === overlay || event.target.closest("[data-pizza-close]")) {
      close();
      return;
    }
    const countButton = event.target.closest("[data-pizza-count]");
    if (countButton) {
      keepScroll(() => {
        state.count = Number(countButton.dataset.pizzaCount);
        state.picks = state.picks.slice(0, state.count);
      });
      return;
    }
    const flavorButton = event.target.closest("[data-pizza-flavor]");
    if (flavorButton) {
      keepScroll(() => {
        const id = flavorButton.dataset.pizzaFlavor;
        const index = state.picks.indexOf(id);
        if (index >= 0) state.picks.splice(index, 1);
        else if (state.count === 1) state.picks = [id];
        else if (state.picks.length < state.count) state.picks.push(id);
        else state.picks[state.picks.length - 1] = id;
      });
      return;
    }
    const mode = event.target.closest("[data-pizza-border-mode]");
    if (mode) {
      keepScroll(() => {
        state.withBorder = mode.dataset.pizzaBorderMode === "1";
        if (!state.withBorder) state.border = "";
      });
      return;
    }
    const borderButton = event.target.closest("[data-pizza-border]");
    if (borderButton) {
      keepScroll(() => {
        state.border = borderButton.dataset.pizzaBorder;
      });
      return;
    }
    const qty = event.target.closest("[data-pizza-qty]");
    if (qty) {
      state.qty = Math.min(20, Math.max(1, state.qty + Number(qty.dataset.pizzaQty)));
      render();
      return;
    }
    if (event.target.closest("[data-pizza-add]")) addToCart();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay && !overlay.hidden) close();
  });

  window.InovasPizza = { mount, resolveCartItem, open };
  mount();
})();
