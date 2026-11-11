const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Auditoria de legibilidade: em cada aba do Gestor, nos temas claro e escuro,
// todo texto visível precisa de contraste mínimo com o fundo real
// (WCAG: 4.5:1 para texto normal, 3:1 para texto grande). Também mede o
// tamanho dos títulos, para evitar telas com "informação muito grande".

const SECTIONS = ["dashboard", "cash-register", "orders", "menu", "inventory", "customers", "metrics", "finance", "reports", "settings"];
const outDir = path.join(process.cwd(), "artifacts", "novo-gestor", "contraste");
fs.mkdirSync(outDir, { recursive: true });

const auditPage = () => {
  const parse = (value) => {
    const match = String(value).match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const blend = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const backgroundOf = (element) => {
    const layers = [];
    let node = element;
    while (node && node.nodeType === 1) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none" && !style.backgroundImage.startsWith("url")) {
        // Gradiente: usa a primeira cor como aproximação.
        const first = parse(style.backgroundImage);
        if (first) layers.push(first);
      }
      const color = parse(style.backgroundColor);
      if (color && color.a > 0) layers.push(color);
      if (color && color.a >= 1) break;
      node = node.parentElement;
    }
    let result = { r: 255, g: 255, b: 255, a: 1 };
    for (let index = layers.length - 1; index >= 0; index -= 1) result = blend(layers[index], result);
    return result;
  };
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.2;
  };
  const failures = [];
  const bigHeadings = [];
  const seen = new Set();
  const scope = document.querySelector(".admin-shell, .admin-layout") || document.body;
  for (const element of scope.querySelectorAll("*")) {
    const ownText = [...element.childNodes]
      .filter((child) => child.nodeType === 3)
      .map((child) => child.textContent.trim())
      .join(" ")
      .trim();
    if (!ownText || !isVisible(element)) continue;
    if (element.closest("svg, [aria-hidden='true'], option")) continue;
    const style = getComputedStyle(element);
    const fg = parse(style.color);
    if (!fg) continue;
    const bg = backgroundOf(element);
    const color = blend(fg, bg);
    const size = parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const minimum = large ? 3 : 4.5;
    const value = ratio(color, bg);
    const disabled = element.closest("[disabled], [aria-disabled='true']");
    if (value < minimum && !disabled) {
      const key = `${element.className}|${ownText.slice(0, 30)}`;
      if (!seen.has(key)) {
        seen.add(key);
        failures.push({
          text: ownText.slice(0, 60),
          tag: element.tagName.toLowerCase(),
          className: String(element.className).slice(0, 80),
          where: [element.parentElement, element.parentElement?.parentElement, element.parentElement?.parentElement?.parentElement]
            .filter(Boolean)
            .map((node) => (node.classList[0] ? "." + node.classList[0] : node.tagName.toLowerCase()))
            .join(" < "),
          ratio: Number(value.toFixed(2)),
          minimum,
          color: style.color,
          size,
        });
      }
    }
    if (/^H[1-3]$/.test(element.tagName) && size > 26) {
      bigHeadings.push({ text: ownText.slice(0, 50), size, className: String(element.className).slice(0, 60), where: element.parentElement?.classList[0] || "" });
    }
  }
  return { failures, bigHeadings };
};

test("Gestor: texto legível e títulos contidos em todas as abas, nos dois temas", async ({ page }) => {
  test.setTimeout(300_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("contraste"),
    name: "Restaurante Contraste",
    ownerPassword: "OwnerContraste123!",
  });
  const report = [];
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "127.61.71.81" });
    await page.goto("/admin/login.html?next=%2Fadmin%2F");
    await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
    await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
    await page.locator("[data-admin-login-submit]").click();
    await page.waitForLoadState("networkidle");

    for (const theme of ["light", "dark"]) {
      const current = await page.evaluate(() => document.body.dataset.adminTheme);
      if (current !== theme) await page.locator("[data-admin-theme-toggle]").click();
      await expect(page.locator("body")).toHaveAttribute("data-admin-theme", theme);
      for (const section of SECTIONS) {
        await page.locator(`.admin-nav [data-admin-section="${section}"]`).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
        const result = await page.evaluate(auditPage);
        report.push({ theme, section, ...result });
        await page.screenshot({ path: path.join(outDir, `${theme}-${section}.png`) });
      }
    }
  } finally {
    await master.api.dispose();
  }
  fs.writeFileSync(path.join(outDir, "relatorio.json"), JSON.stringify(report, null, 2));
  const failures = report.flatMap((entry) => entry.failures.map((failure) => `${entry.theme}/${entry.section}: "${failure.text}" ${failure.ratio}:1 (${failure.className})`));
  const headings = report.flatMap((entry) => entry.bigHeadings.map((heading) => `${entry.theme}/${entry.section}: "${heading.text}" ${heading.size}px`));
  expect(failures, failures.join("\n")).toEqual([]);
  expect(headings, headings.join("\n")).toEqual([]);
});
