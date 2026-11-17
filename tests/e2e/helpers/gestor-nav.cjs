// Abre uma seção do Gestor pelo menu lateral.
// Caixa e Pedidos ficam escondidos no menu do site (são usados pelo app INOVAS
// PDV), mas o botão continua na página: os atalhos internos do Gestor clicam
// nele. Para essas seções o teste faz o mesmo clique programático.
const HIDDEN_IN_SITE_MENU = new Set(["cash-register", "orders"]);

const openGestorSection = async (page, section) => {
  const button = page.locator(`.admin-nav [data-admin-section="${section}"]`);
  if (HIDDEN_IN_SITE_MENU.has(section)) {
    await button.waitFor({ state: "attached" });
    await button.evaluate((node) => node.click());
    return;
  }
  await button.click();
};

module.exports = { HIDDEN_IN_SITE_MENU, openGestorSection };
