const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Textos do Gestor precisam sair com acento. Varre o texto visível, placeholders,
// rótulos acessíveis e opções de todas as abas e falha se achar palavras comuns
// escritas sem acento. Textos que vêm de dados do restaurante (cardápio, descrição)
// não entram: o restaurante de teste usa o próprio conteúdo.

const SEM_ACENTO = /\b(nao|Nao|voce|Voce|sera|Sera|horario|Horario|horarios|periodo|Periodo|ultim[oa]s?|Ultim[oa]s?|numero|Numero|proxim[oa]s?|Proxim[oa]s?|historico|Historico|usuarios?|Usuarios?|acoes|Acoes|opcoes|Opcoes|endereco|Endereco|precos?|Precos?|descricao|Descricao|observacao|observacoes|Observacao|Observacoes|relatorios?|Relatorios?|distribuicao|Distribuicao|configuracao|configuracoes|Configuracao|Configuracoes|promocao|promocoes|Promocao|Promocoes|avaliacao|avaliacoes|Avaliacao|Avaliacoes|cardapio|Cardapio|metricas?|Metricas?|saida|Saida|codigo|Codigo|minimo|Minimo|maximo|Maximo|servico|Servico|pagina|Pagina|disponivel|Disponivel|indisponivel|Indisponivel|notificacoes|Notificacoes|operacao|Operacao|sincronizacao|atualizacao|Atualizacao|publicacao|Publicacao|Mes|apos|Apos|possivel|valido|validos|automatica|Automatica|visivel|visiveis)\b/;

// Textos que vêm do conteúdo do restaurante de teste, não do Gestor.
const DADOS_DO_RESTAURANTE = [/Opcoes quentes e crocantes/, /com experiencia premium, cardapio sofisticado/];

// Pendência conhecida: mensagens padrão do servidor que também aparecem no site
// público (Delivery e horário de funcionamento são fluxos congelados). Corrigir
// só com GO do Paulo; depois, remover desta lista.
const PENDENTES_COM_GO = [
  /^Entregas pausadas temporariamente\. Retirada no balcao disponivel\.$/,
  /^No momento nao entregamos nessa regiao\.$/,
  /^Retirada disponivel em 25 minutos$/,
  /^Estamos fechados agora\. Voce pode agendar seu pedido para o proximo horario de atendimento\.$/,
];

test("Gestor: textos com acento em todas as abas", async ({ page }) => {
  test.setTimeout(300_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("acentos"),
    name: "Restaurante Acentos",
    ownerPassword: "OwnerAcentos123!",
  });
  const problems = new Map();
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "127.81.91.101" });
    await page.goto("/admin/login.html?next=%2Fadmin%2F");
    await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
    await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
    await page.locator("[data-admin-login-submit]").click();
    await page.waitForLoadState("networkidle");
    const sections = await page.locator(".admin-nav [data-admin-section]").evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => node.getAttribute("data-admin-section")))]
    );
    for (const section of sections) {
      await page.locator(`.admin-nav [data-admin-section="${section}"]`).first().click();
      await page.waitForTimeout(700);
      const lines = await page.evaluate(() => {
        const collect = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const parent = walker.currentNode.parentElement;
          if (!parent || ["SCRIPT", "STYLE"].includes(parent.tagName)) continue;
          collect.push(walker.currentNode.textContent);
        }
        for (const el of document.querySelectorAll("[placeholder],[aria-label],[title]")) {
          collect.push(el.getAttribute("placeholder") || "", el.getAttribute("aria-label") || "", el.getAttribute("title") || "");
        }
        return collect.map((line) => line.trim()).filter(Boolean);
      });
      for (const line of lines) {
        if (line.length > 200 || !SEM_ACENTO.test(line)) continue;
        if (DADOS_DO_RESTAURANTE.some((pattern) => pattern.test(line))) continue;
        if (PENDENTES_COM_GO.some((pattern) => pattern.test(line))) continue;
        if (!problems.has(line)) problems.set(line, new Set());
        problems.get(line).add(section);
      }
    }
  } finally {
    await master.api.dispose();
  }
  const report = [...problems.entries()].map(([line, sections]) => `[${[...sections].join(",")}] ${line}`).sort();
  fs.mkdirSync(path.join(process.cwd(), "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "artifacts", "gestor-acentos.txt"), report.join("\n"));
  expect(report, report.join("\n")).toEqual([]);
});
