const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey, createPublicOrder, hostForKey } = require("./helpers/v1.9-fixtures.cjs");

// Clientes (esboço "Nova tela de Clientes"): segmentos, próxima ação com mensagem pronta,
// exportar, campanha "Em risco" e mesas do salão fora da base.
const outDir = path.join(process.cwd(), "artifacts", "clientes");
const daysAgo = (days, hour = 19) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 26, 0, 0);
  return date.toISOString();
};

const customer = (key, name, phone, segment, orders, spent, days, extra = {}) => ({
  key,
  customerKey: key,
  customerName: name,
  customerPhone: phone,
  customerEmail: "",
  whatsappUrl: phone ? `https://wa.me/55${phone.replace(/\D/g, "")}` : "",
  ordersCount: orders,
  revenueOrderCount: orders,
  totalSpent: spent,
  averageTicket: Number((spent / orders).toFixed(2)),
  lastPurchaseAt: daysAgo(days),
  lastOrderAt: daysAgo(days),
  daysSinceLastPurchase: days,
  mostUsedAddress: "Rua das Flores, 100 — Centro",
  topItems: [{ name: "Combinado da casa", quantity: 5, ordersCount: 4 }],
  orders: [
    { id: `${key}-1`, publicId: "#0413", status: "Entregue", fulfillmentMode: "delivery", totalAmount: 214.9, createdAt: daysAgo(days) },
    { id: `${key}-2`, publicId: "#0390", status: "Entregue", fulfillmentMode: "pickup", totalAmount: 120, createdAt: daysAgo(days + 8) },
  ],
  tags: [],
  notes: "",
  segment,
  ...extra,
});

const buildSnapshot = (vipTags = ["vip"]) => ({
  ok: true,
  storageMode: "file",
  summary: {
    totalCustomers: 6,
    totalSpent: 2650.53,
    averageTicket: 147.25,
    returnRate: 67,
    segments: { novo: 1, recorrente: 1, vip: 1, "em-risco": 2, sumido: 1 },
    unidentifiedDining: { orders: 3, total: 189 },
  },
  customers: [
    customer("phone:1", "Paula Teste Vip", "(16) 99000-0001", "vip", 7, 1442.93, 0, { tags: vipTags }),
    customer("phone:2", "Bruno Recorrente", "(16) 99000-0002", "recorrente", 4, 612.4, 3),
    customer("phone:3", "Carla Nova", "(16) 99000-0003", "novo", 1, 98, 6),
    customer("phone:4", "Diego Em Risco", "(16) 99000-0004", "em-risco", 3, 402.7, 38),
    customer("phone:5", "Elisa Em Risco", "", "em-risco", 2, 18.3, 44),
    customer("phone:6", "Fabio Sumido", "(16) 99000-0006", "sumido", 1, 76.2, 95),
  ],
});

const loginOwner = async (page, restaurant, theme = "dark") => {
  await page.addInitScript((value) => { try { localStorage.setItem("tokyo_admin_theme", value); } catch {} }, theme);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.64.${Math.floor(Math.random() * 200)}.9` });
  await page.goto("/login");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForSelector('.admin-nav [data-admin-section="customers"]');
  await page.locator('.admin-nav [data-admin-section="customers"]').click();
  await page.waitForSelector(".gx-crm");
};

test("Clientes: segmentos, próxima ação, campanha e exportar (dados simulados)", async ({ browser }) => {
  test.setTimeout(120_000);
  await fs.mkdir(outDir, { recursive: true });
  const master = await loginMaster();
  const r = await onboardRestaurant(master.api, { key: uniqueKey("crm"), name: "Restaurante CRM", ownerPassword: "OwnerCrm123!" });
  await master.api.dispose();

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let saved = null;
  await page.route("**/api/admin/customers/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      saved = request.postDataJSON();
      const tags = saved.tags || [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...buildSnapshot(tags), message: "Perfil do cliente salvo com sucesso." }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildSnapshot()) });
  });
  await loginOwner(page, r, "dark");

  await expect(page.locator(".gx-crm-head h2")).toHaveText("Clientes");
  await expect(page.locator(".gx-crm-kpis article").nth(0)).toContainText("6");
  await expect(page.locator(".gx-crm-kpis article").nth(1)).toContainText("67%");
  await expect(page.locator(".gx-crm-kpis article").nth(2)).toContainText("2");
  await expect(page.locator("[data-crm-dining]")).toContainText("3 pedidos de mesa");
  await expect(page.locator("[data-crm-dining]")).toContainText("189,00");
  await expect(page.locator(".gx-crm-table tbody tr")).toHaveCount(6);
  // Primeiro da lista (última compra mais recente) já vem selecionado.
  await expect(page.locator(".gx-crm-panel-head h3")).toHaveText("Paula Teste Vip");
  await expect(page.locator(".gx-crm-action > strong")).toContainText("Cliente VIP comprou hoje");
  await page.screenshot({ path: path.join(outDir, "clientes-escuro.png"), fullPage: true });

  // Segmento "Em risco".
  await page.locator('[data-crm-segment="em-risco"]').click();
  await expect(page.locator(".gx-crm-table tbody tr")).toHaveCount(2);
  await expect(page.locator(".gx-crm-foot")).toHaveText("Mostrando 2 de 6");
  await expect(page.locator(".gx-crm-panel-head h3")).toHaveText("Diego Em Risco");
  await expect(page.locator(".gx-crm-action > strong")).toContainText("38 dias sem pedir");

  // Cliente sem telefone: sem botão de WhatsApp.
  await page.locator('tr[data-customer-key="phone:5"]').click();
  await expect(page.locator("[data-crm-send]")).toHaveCount(0);
  await expect(page.locator(".gx-crm-action")).toContainText("Sem telefone para WhatsApp");

  // Busca por telefone sem pontuação.
  await page.locator('[data-crm-segment=""]').click();
  await page.locator("[data-crm-search]").fill("990000002");
  await expect(page.locator(".gx-crm-table tbody tr")).toHaveCount(1);
  await expect(page.locator("[data-crm-search]")).toBeFocused();
  await page.locator('tr[data-customer-key="phone:2"]').click();

  // Editar mensagem e enviar: o link do WhatsApp leva o texto editado.
  await page.locator("[data-crm-edit]").click();
  await page.locator("[data-crm-message]").fill("Oi, Bruno! Mensagem de teste.");
  await page.locator("[data-crm-edit]").click();
  await expect(page.locator(".gx-crm-message")).toContainText("Mensagem de teste");
  const href = await page.locator("[data-crm-send]").getAttribute("href");
  expect(href).toBe(`https://wa.me/5516990000002?text=${encodeURIComponent("Oi, Bruno! Mensagem de teste.")}`);

  // Ficha completa: marcar VIP salva as marcações.
  await page.locator("[data-crm-full]").click();
  await page.locator('[data-crm-tag="vip"]').click();
  await expect.poll(() => saved?.tags).toEqual(["vip"]);
  expect(saved.customerKey).toBe("phone:2");

  // Exportar baixa um CSV com o cliente filtrado.
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-crm-export]").click()]);
  const csv = await fs.readFile(await download.path(), "utf8");
  expect(csv).toContain("Bruno Recorrente");
  expect(csv).not.toContain("Carla Nova");

  // Campanha "Em risco": uma conversa por vez, com o nome no lugar de {nome}.
  await page.locator("[data-crm-search]").fill("");
  await page.locator("[data-crm-campaign]").click();
  const dialog = page.locator("[data-crm-campaign-dialog]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".gx-crm-campaign-list li")).toHaveCount(2);
  await dialog.locator("[data-crm-template]").fill("Oi, {nome}! Volta logo.");
  const sendLink = dialog.locator('[data-crm-campaign-send="phone:4"]');
  await sendLink.dispatchEvent("click");
  expect(await sendLink.getAttribute("href")).toBe(`https://wa.me/5516990000004?text=${encodeURIComponent("Oi, Diego! Volta logo.")}`);
  await dialog.locator("[data-crm-campaign-close]").click();
  await expect(dialog).toBeHidden();

  // Tema claro e celular.
  await page.evaluate(() => document.body.setAttribute("data-admin-theme", "light"));
  await page.screenshot({ path: path.join(outDir, "clientes-claro.png"), fullPage: true });
  for (const width of [320, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outDir, "clientes-celular.png"), fullPage: true });
  expect(errors).toEqual([]);
  await context.close();
});

test("Clientes: cada restaurante vê só os próprios clientes (dados reais)", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const keyA = uniqueKey("crma");
  const keyB = uniqueKey("crmb");
  const a = await onboardRestaurant(master.api, { key: keyA, name: "Restaurante CRM A", ownerPassword: "OwnerCrmA123!" });
  const b = await onboardRestaurant(master.api, { key: keyB, name: "Restaurante CRM B", ownerPassword: "OwnerCrmB123!" });
  await master.api.dispose();
  await createPublicOrder({ host: hostForKey(keyA), label: keyA });

  const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageA = await contextA.newPage();
  await loginOwner(pageA, a, "light");
  await expect(pageA.locator(".gx-crm-table tbody tr[data-customer-key]")).toHaveCount(1);
  await expect(pageA.locator(".gx-crm-table")).toContainText(`Cliente ${keyA}`);
  await expect(pageA.locator(".gx-crm-badge").first()).toHaveText("Novo");
  await contextA.close();

  const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageB = await contextB.newPage();
  await loginOwner(pageB, b, "light");
  await expect(pageB.locator(".gx-crm-table tbody tr[data-customer-key]")).toHaveCount(0);
  await expect(pageB.locator(".gx-crm-empty")).toContainText("Ainda não há clientes identificados");
  await expect(pageB.locator(".gx-crm")).not.toContainText(`Cliente ${keyA}`);
  await contextB.close();
});
