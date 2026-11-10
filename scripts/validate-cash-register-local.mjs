import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

const fingerprintDirectory = async (directoryPath) => {
  const rootStats = await fs.stat(directoryPath).catch(() => null);
  if (!rootStats) return [];
  const entries = [];
  const visit = async (currentPath, relativeBase = "") => {
    const children = await fs.readdir(currentPath, { withFileTypes: true });
    for (const child of children) {
      const childPath = path.join(currentPath, child.name);
      const relativePath = path.join(relativeBase, child.name).replace(/\\/g, "/");
      const stats = await fs.stat(childPath);
      entries.push({
        path: relativePath,
        type: child.isDirectory() ? "directory" : "file",
        size: stats.size,
        mtimeMs: Math.round(stats.mtimeMs),
      });
      if (child.isDirectory()) await visit(childPath, relativePath);
    }
  };
  await visit(directoryPath);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
};

const expectErrorCode = async (operation, errorCode, label) => {
  await assert.rejects(
    operation,
    (error) => error?.errorCode === errorCode,
    `${label}: deveria falhar com ${errorCode}`
  );
};

const buildTenant = (buildTenantContext, restaurantKey, restaurantName) =>
  buildTenantContext(
    {
      host: `${restaurantKey}.cash-register.local`,
      restaurantKey,
      restaurantName,
      matched: true,
      resolutionMode: "local-validation",
      multiRestaurantActive: true,
    },
    { source: "validate:cash-register-local" }
  );

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const actor = {
  identityId: "identity_cash_validator",
  login: "caixa.validator@inovas.local",
  displayName: "Validador do Caixa",
};

const run = async () => {
  const originalCwd = process.cwd();
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
    INOVAS_CASH_REGISTER_DATA_FILE: process.env.INOVAS_CASH_REGISTER_DATA_FILE,
  };
  const beforeFingerprint = await fingerprintDirectory(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "inovas-cash-register-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    await fs.copyFile(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "default_only";
    process.env.INOVAS_CASH_REGISTER_DATA_FILE = path.join(
      tempRoot,
      ".data",
      "cash-register.json"
    );
    delete process.env.DATABASE_URL;

    const { buildTenantContext } = require(path.join(workspaceRoot, "lib/tenant-context.cjs"));
    const cash = require(path.join(workspaceRoot, "lib/cash-register-store.cjs"));
    const catalog = require(path.join(workspaceRoot, "lib/catalog-store.cjs"));
    const permissions = require(path.join(workspaceRoot, "lib/user-permissions.cjs"));

    const tenantA = buildTenant(buildTenantContext, "cash-a", "Restaurante Caixa A");
    const tenantB = buildTenant(buildTenantContext, "cash-b", "Restaurante Caixa B");
    const optionsA = { tenantContext: tenantA };
    const optionsB = { tenantContext: tenantB };

    await expectErrorCode(
      () => cash.getCashRegisterSnapshot(),
      "tenant_context_required",
      "isolamento sem tenant"
    );

    let snapshotA = await cash.getCashRegisterSnapshot(optionsA);
    assert.equal(snapshotA.storageMode, "file", "validador deve usar persistencia local isolada");
    assert.equal(snapshotA.register, null, "caixa deve iniciar fechado");
    assert.equal(snapshotA.tables.length, 0, "salao deve iniciar sem configuracao artificial");

    await cash.configureDiningTables({ count: 4, capacity: 4 }, actor, optionsA);
    await cash.configureDiningTables({ count: 2, capacity: 6 }, actor, optionsB);
    snapshotA = await cash.getCashRegisterSnapshot(optionsA);
    const snapshotBInitial = await cash.getCashRegisterSnapshot(optionsB);
    assert.equal(snapshotA.tables.length, 4, "tenant A deve ter quatro mesas");
    assert.equal(snapshotBInitial.tables.length, 2, "tenant B deve ter duas mesas");
    assert.ok(
      snapshotA.tables.every((table) => table.tenantId === tenantA.tenantId),
      "mesas devem carregar tenant_id"
    );

    await cash.openCashRegister(
      { openingAmount: 150, serviceChargeRate: 10, notes: "Turno de validacao" },
      actor,
      optionsA
    );
    await expectErrorCode(
      () => cash.openCashRegister({ openingAmount: 0 }, actor, optionsA),
      "cash_register_already_open",
      "abertura duplicada"
    );

    snapshotA = await cash.getCashRegisterSnapshot(optionsA);
    assert.equal(snapshotA.register.status, "OPEN", "caixa deve ficar aberto");
    assert.equal(snapshotA.register.openingAmount, 150, "fundo inicial deve persistir");
    assert.equal(snapshotA.register.openingUserLogin, actor.login, "operador deve persistir");
    assert.equal((await cash.getCashRegisterSnapshot(optionsB)).register, null, "caixa nao pode vazar");

    const tableOne = snapshotA.tables[0];
    const tabResult = await cash.openDiningTab(
      {
        tableId: tableOne.id,
        waiterName: "Joao Garcom",
        waiterLogin: "joao.garcom",
        guestCount: 2,
        customerName: "Cliente Salao",
      },
      actor,
      optionsA
    );
    await expectErrorCode(
      () =>
        cash.openDiningTab(
          { tableId: tableOne.id, waiterName: "Outro", guestCount: 1 },
          actor,
          optionsA
        ),
      "dining_table_already_has_tab",
      "dupla ocupacao da mesa"
    );

    const catalogContext = await catalog.getCatalogValidationContext(optionsA);
    const products = [...catalogContext.itemMap.values()].filter(
      (item) =>
        item.isOrderable === true &&
        item.isAvailable !== false &&
        item.isPaused !== true &&
        Number(item.price) > 0
    );
    assert.ok(products.length >= 2, "catalogo real precisa expor ao menos dois produtos vendaveis");
    const [productOne, productTwo] = products;

    const addedOne = await cash.addDiningTabItem(
      {
        tabId: tabResult.tab.id,
        productId: productOne.id,
        quantity: 2,
        notes: "Sem cebolinha",
      },
      actor,
      optionsA
    );
    assert.equal(addedOne.item.unitPrice, roundMoney(productOne.price), "preco deve vir do backend");
    await expectErrorCode(
      () =>
        cash.addDiningTabItem(
          { tabId: tabResult.tab.id, productId: "produto-inexistente", quantity: 1 },
          actor,
          optionsA
        ),
      "cash_register_product_not_found",
      "produto inexistente"
    );

    await cash.updateDiningTabItem(
      { itemId: addedOne.item.id, quantity: 3, notes: "Sem cebolinha e sem molho" },
      actor,
      optionsA
    );
    const removable = await cash.addDiningTabItem(
      { tabId: tabResult.tab.id, productId: productTwo.id, quantity: 1 },
      actor,
      optionsA
    );
    await cash.removeDiningTabItem({ itemId: removable.item.id }, actor, optionsA);

    const firstBatch = await cash.sendDiningOrder({ tabId: tabResult.tab.id }, actor, optionsA);
    assert.equal(firstBatch.batch.batchNumber, 1, "primeiro envio deve criar lote 1");
    assert.ok(firstBatch.order?.id, "envio deve criar pedido real de producao");
    await expectErrorCode(
      () => cash.sendDiningOrder({ tabId: tabResult.tab.id }, actor, optionsA),
      "dining_no_pending_items",
      "reenvio de item antigo"
    );
    await expectErrorCode(
      () =>
        cash.updateDiningTabItem(
          { itemId: addedOne.item.id, quantity: 4 },
          actor,
          optionsA
        ),
      "dining_item_not_editable",
      "edicao de item ja enviado"
    );

    const addedSecond = await cash.addDiningTabItem(
      { tabId: tabResult.tab.id, productId: productTwo.id, quantity: 1 },
      actor,
      optionsA
    );
    assert.ok(addedSecond.item.id, "novo item deve permanecer separado do lote anterior");
    const secondBatch = await cash.sendDiningOrder({ tabId: tabResult.tab.id }, actor, optionsA);
    assert.equal(secondBatch.batch.batchNumber, 2, "novo envio deve criar lote incremental");

    await expectErrorCode(
      () => cash.closeCashRegister({ countedCash: 150 }, actor, optionsA),
      "cash_register_has_open_tabs",
      "fechamento com comanda aberta"
    );

    const firstClosing = await cash.beginDiningTabClosing(
      {
        tabId: tabResult.tab.id,
        discountAmount: 0,
        serviceChargeEnabled: true,
        additionAmount: 0,
      },
      actor,
      optionsA
    );
    assert.equal(firstClosing.tab.status, "AWAITING_PAYMENT", "conta deve aguardar pagamento");
    assert.equal(
      firstClosing.tab.serviceChargeAmount,
      roundMoney(firstClosing.tab.subtotal * 0.1),
      "taxa de servico deve ser calculada no backend"
    );
    await cash.reopenDiningTab({ tabId: tabResult.tab.id }, actor, optionsA);
    snapshotA = await cash.getCashRegisterSnapshot(optionsA);
    assert.equal(snapshotA.activeTabs[0].status, "OPEN", "reabertura deve persistir");

    const closing = await cash.beginDiningTabClosing(
      {
        tabId: tabResult.tab.id,
        discountAmount: 1,
        serviceChargeEnabled: false,
        additionAmount: 2,
      },
      actor,
      optionsA
    );
    assert.equal(closing.tab.discountAmount, 1, "desconto deve persistir");
    assert.equal(closing.tab.serviceChargeAmount, 0, "taxa removida deve zerar");
    assert.equal(
      closing.tab.totalAmount,
      roundMoney(closing.tab.subtotal - 1 + 2),
      "backend deve recalcular o total"
    );

    await expectErrorCode(
      () =>
        cash.confirmDiningPayment(
          {
            tabId: tabResult.tab.id,
            idempotencyKey: "payment-mismatch-validation",
            payments: [{ method: "PIX", amount: closing.tab.totalAmount - 0.01 }],
          },
          actor,
          optionsA
        ),
      "cash_register_payment_total_mismatch",
      "pagamento insuficiente"
    );

    const pixAmount = roundMoney(closing.tab.totalAmount / 2);
    const cashAmount = roundMoney(closing.tab.totalAmount - pixAmount);
    const idempotencyKey = "payment-split-validation-0001";
    const paymentPayload = {
      tabId: tabResult.tab.id,
      idempotencyKey,
      payments: [
        { method: "PIX", amount: pixAmount },
        { method: "CASH", amount: cashAmount, receivedAmount: cashAmount + 10 },
      ],
    };
    const payment = await cash.confirmDiningPayment(paymentPayload, actor, optionsA);
    assert.equal(payment.payments.length, 2, "pagamento dividido deve persistir duas parcelas");
    assert.equal(payment.payments[1].changeAmount, 10, "troco deve ser calculado no backend");
    const duplicatePayment = await cash.confirmDiningPayment(paymentPayload, actor, optionsA);
    assert.equal(duplicatePayment.alreadyProcessed, true, "duplo clique deve ser idempotente");

    snapshotA = await cash.getCashRegisterSnapshot(optionsA);
    assert.equal(snapshotA.activeTabs.length, 0, "comanda paga deve sair das comandas ativas");
    assert.equal(snapshotA.tables[0].status, "FREE", "mesa deve ser liberada apenas apos pagamento");
    assert.equal(snapshotA.recentTabs[0].status, "CLOSED", "historico deve manter a comanda");
    assert.equal(snapshotA.recentTabs[0].payments.length, 2, "historico deve manter pagamentos");
    assert.equal(snapshotA.registerSummary.closedTabs, 1, "resumo deve contabilizar a conta");
    assert.equal(
      snapshotA.registerSummary.totalSold,
      closing.tab.totalAmount,
      "resumo do caixa deve refletir venda confirmada"
    );

    const secondTab = await cash.openDiningTab(
      {
        tableId: snapshotA.tables[1].id,
        waiterName: "Maria Garcom",
        waiterLogin: "maria.garcom",
        guestCount: 1,
      },
      actor,
      optionsA
    );
    await cash.addDiningTabItem(
      { tabId: secondTab.tab.id, productId: productOne.id, quantity: 1 },
      actor,
      optionsA
    );
    await cash.sendDiningOrder({ tabId: secondTab.tab.id }, actor, optionsA);
    const secondClosing = await cash.beginDiningTabClosing(
      {
        tabId: secondTab.tab.id,
        discountAmount: 0,
        serviceChargeEnabled: true,
      },
      actor,
      optionsA
    );
    const singlePayment = await cash.confirmDiningPayment(
      {
        tabId: secondTab.tab.id,
        idempotencyKey: "payment-single-validation-0002",
        payments: [{ method: "PIX", amount: secondClosing.tab.totalAmount }],
      },
      actor,
      optionsA
    );
    assert.equal(singlePayment.payments.length, 1, "pagamento com uma forma deve funcionar");
    assert.equal(singlePayment.payments[0].method, "PIX", "forma unica deve persistir");

    snapshotA = await cash.getCashRegisterSnapshot(optionsA);
    assert.equal(snapshotA.registerSummary.closedTabs, 2, "dois fechamentos devem ser contabilizados");
    const expectedCash = snapshotA.registerSummary.expectedCash;
    const closeResult = await cash.closeCashRegister(
      { countedCash: expectedCash, notes: "Conferencia sem diferenca" },
      actor,
      optionsA
    );
    assert.equal(closeResult.register.status, "CLOSED", "caixa deve fechar");
    assert.equal(closeResult.register.differenceAmount, 0, "conferencia deve ficar sem diferenca");
    await expectErrorCode(
      () => cash.closeCashRegister({ countedCash: expectedCash }, actor, optionsA),
      "cash_register_not_open",
      "fechamento duplicado"
    );
    await expectErrorCode(
      () =>
        cash.openDiningTab(
          { tableId: snapshotA.tables[1].id, waiterName: "Sem caixa", guestCount: 1 },
          actor,
          optionsA
        ),
      "cash_register_not_open",
      "operacao sem caixa aberto"
    );

    const finalA = await cash.getCashRegisterSnapshot(optionsA);
    const finalB = await cash.getCashRegisterSnapshot(optionsB);
    assert.equal(finalA.register, null, "snapshot final nao deve expor caixa aberto");
    assert.equal(finalA.lastClosedRegister.status, "CLOSED", "fechamento deve ir ao historico");
    assert.equal(finalB.register, null, "tenant B deve continuar sem caixa");
    assert.ok(finalB.tables.every((table) => table.status === "FREE"), "tenant B deve permanecer intacto");
    const eventTypes = new Set(finalA.auditEvents.map((event) => event.eventType));
    [
      "REGISTER_OPENED",
      "TAB_OPENED",
      "ITEM_ADDED",
      "ORDER_SENT",
      "TAB_AWAITING_PAYMENT",
      "PAYMENT_CONFIRMED",
      "TABLE_RELEASED",
      "REGISTER_CLOSED",
    ].forEach((eventType) =>
      assert.ok(eventTypes.has(eventType), `auditoria deve conter ${eventType}`)
    );
    assert.ok(
      finalA.auditEvents.some(
        (event) =>
          event.eventType === "PAYMENT_CONFIRMED" &&
          event.metadata?.inventoryStrategy ===
            "existing_manual_inventory_without_recipe_mapping"
      ),
      "auditoria deve declarar a regra existente de estoque sem ficha tecnica"
    );

    const cashierPermissions = permissions.getDefaultPermissionsForType("CAIXA");
    const waiterPermissions = permissions.getDefaultPermissionsForType("GARCOM");
    assert.equal(cashierPermissions.cash_register_confirm_payment, true, "Caixa deve receber");
    assert.equal(cashierPermissions.cash_register_discount, false, "Caixa nao deve descontar por padrao");
    assert.equal(waiterPermissions.cash_register_send_order, true, "Garcom deve enviar pedido");
    assert.equal(waiterPermissions.cash_register_confirm_payment, false, "Garcom nao deve receber");

    const migration = await fs.readFile(
      path.join(workspaceRoot, "migrations", "022_cash_register_dining_room.sql"),
      "utf8"
    );
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/, "migration deve habilitar RLS");
    assert.match(migration, /tenant_id[\s\S]+restaurant_id/, "migration deve escopar tenant/restaurante");
    assert.match(migration, /cash_register_sessions_one_open_uidx/, "migration deve impedir dois caixas");
    assert.match(migration, /dining_tabs_one_active_per_table_uidx/, "migration deve impedir dupla mesa");
    assert.match(migration, /cash_payment_sets_idempotency_uidx|idempotency_key/, "migration deve ser idempotente");
    assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE TABLE/, "migration de subida deve ser aditiva");

    const persisted = JSON.parse(
      await fs.readFile(process.env.INOVAS_CASH_REGISTER_DATA_FILE, "utf8")
    );
    assert.ok(persisted.scopes, "estado local deve ser realmente persistido em disco");
    assert.equal(Object.keys(persisted.scopes).length, 2, "arquivo deve separar os dois tenants");

    const afterFingerprint = await fingerprintDirectory(realDataDirectory);
    assert.deepEqual(afterFingerprint, beforeFingerprint, "validacao nao pode tocar na .data real");

    console.log("Caixa/Salao local: suite funcional critica concluida com sucesso.");
    console.log(`Artefatos temporarios: ${tempRoot}`);
  } finally {
    process.chdir(originalCwd);
    if (originalEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv.NODE_ENV;
    if (originalEnv.INOVAS_TENANT_MODE === undefined) delete process.env.INOVAS_TENANT_MODE;
    else process.env.INOVAS_TENANT_MODE = originalEnv.INOVAS_TENANT_MODE;
    if (originalEnv.INOVAS_CASH_REGISTER_DATA_FILE === undefined) {
      delete process.env.INOVAS_CASH_REGISTER_DATA_FILE;
    } else {
      process.env.INOVAS_CASH_REGISTER_DATA_FILE = originalEnv.INOVAS_CASH_REGISTER_DATA_FILE;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
