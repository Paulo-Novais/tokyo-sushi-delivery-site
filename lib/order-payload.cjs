const crypto = require("node:crypto");

const ORDER_STATUSES = Object.freeze([
  "Recebido",
  "Aceito",
  "Em preparo",
  "Pronto",
  "Saiu para entrega",
  "Entregue",
  "Retirada concluida",
  "Cancelado",
]);

const PAYMENT_METHODS = Object.freeze(["dinheiro", "credito", "debito", "pix"]);
const FULFILLMENT_MODES = Object.freeze(["delivery", "pickup"]);
const TIMING_MODES = Object.freeze(["immediate", "scheduled"]);
const STORE_TIMEZONE_OFFSET = "-03:00";
const MAX_ORDER_ITEMS = 30;
const MAX_ORDER_ADDONS = 40;
const MAX_ITEM_QUANTITY = 50;
const MAX_ITEM_UNIT_PRICE = 2000;
const MAX_ORDER_TOTAL = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-11);

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const normalizeText = (value, maxLength = 300) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeMultilineText = (value, maxLength = 1000) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, maxLength);

const toMoney = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(2)) : null;
};

const assert = (condition, message) => {
  if (!condition) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
};

const assertMoneyRange = (value, message, minimum = 0, maximum = MAX_ORDER_TOTAL) => {
  assert(value !== null, message);
  assert(value >= minimum, message);
  assert(value <= maximum, message);
};

const buildCustomerKey = ({ phone, email, profileId }) => {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);
  const normalizedProfileId = normalizeText(profileId, 120);

  if (normalizedPhone) {
    return `phone:${normalizedPhone}`;
  }

  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  return `profile:${normalizedProfileId}`;
};

const buildRequestSignature = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

const getOrderType = (timingMode, fulfillmentMode) => {
  if (timingMode === "scheduled") {
    return "scheduled";
  }

  return fulfillmentMode === "pickup" ? "pickup" : "delivery";
};

const buildScheduledTimestamp = (dateValue, timeValue) => {
  const date = normalizeText(dateValue, 20);
  const time = normalizeText(timeValue, 10);

  if (!date || !time) {
    return null;
  }

  const parsedDate = new Date(`${date}T${time}:00${STORE_TIMEZONE_OFFSET}`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
};

const normalizeProductItems = (items, options = {}) => {
  assert(Array.isArray(items) && items.length > 0, "Adicione ao menos um item ao pedido.");
  assert(items.length <= MAX_ORDER_ITEMS, "O pedido excede o limite de itens permitido.");
  const itemMap = options?.itemMap instanceof Map ? options.itemMap : null;

  return items.map((item, index) => {
    const itemId = normalizeText(item?.id, 120) || `product-${index + 1}`;
    const catalogItem = itemMap ? itemMap.get(itemId) || null : null;
    const name = normalizeText(catalogItem?.name || item?.name, 160);
    const category = normalizeText(catalogItem?.category || item?.category, 120);
    const quantity = Number.parseInt(item?.quantity, 10) || 0;
    const unitPrice =
      catalogItem && typeof catalogItem.price === "number"
        ? Number(catalogItem.price.toFixed(2))
        : toMoney(item?.price);

    if (itemMap) {
      assert(itemId, `O item ${index + 1} do pedido esta sem identificador.`);
      assert(catalogItem, `O item ${itemId} nao existe mais no cardapio.`);
      assert(
        Boolean(catalogItem.isOrderable),
        `O item ${catalogItem.name || itemId} nao esta disponivel para pedido agora.`
      );
    }

    assert(name, `O item ${index + 1} do pedido esta sem nome.`);
    assert(quantity >= 1 && quantity <= MAX_ITEM_QUANTITY, `A quantidade do item ${name} e invalida.`);
    assertMoneyRange(unitPrice, `O item ${name} esta sem preco valido.`, 0, MAX_ITEM_UNIT_PRICE);

    const itemMetadata =
      catalogItem?.activePromotion && catalogItem.activePromotion.promotionalPrice === unitPrice
        ? {
            promotion: {
              id: catalogItem.activePromotion.id,
              name: catalogItem.activePromotion.internalName,
              scopeType: catalogItem.activePromotion.scopeType,
              pricingType: catalogItem.activePromotion.pricingType,
              fixedPrice: catalogItem.activePromotion.fixedPrice ?? null,
              discountPercent: catalogItem.activePromotion.discountPercent ?? null,
              regularUnitPrice:
                typeof catalogItem.regularPrice === "number"
                  ? Number(catalogItem.regularPrice.toFixed(2))
                  : null,
              promotionalUnitPrice: unitPrice,
              savingsPerUnit:
                typeof catalogItem.activePromotion.savingsAmount === "number"
                  ? Number(catalogItem.activePromotion.savingsAmount.toFixed(2))
                  : null,
              savingsPercent:
                typeof catalogItem.activePromotion.savingsPercent === "number"
                  ? Number(catalogItem.activePromotion.savingsPercent.toFixed(2))
                  : null,
              startsAt: String(catalogItem.activePromotion.startsAt || ""),
              endsAt: String(catalogItem.activePromotion.endsAt || ""),
            },
          }
        : {};

    return {
      id: itemId,
      type: "product",
      name,
      category,
      quantity,
      unitPrice,
      totalPrice: Number((unitPrice * quantity).toFixed(2)),
      metadata: itemMetadata,
    };
  });
};

const normalizeAddonItems = (addons) => {
  if (!Array.isArray(addons)) {
    return [];
  }

  assert(addons.length <= MAX_ORDER_ADDONS, "O pedido excede o limite de complementos permitido.");

  return addons
    .filter((addon) => Number.parseInt(addon?.quantity, 10) > 0)
    .map((addon, index) => {
      const name = normalizeText(addon?.name, 120);
      const quantity = Number.parseInt(addon?.quantity, 10) || 0;
      const unitPrice = toMoney(addon?.unitPrice);
      const chargedQuantity = Math.max(0, Number.parseInt(addon?.chargedQuantity, 10) || 0);
      const freeUnits = Math.max(0, Number.parseInt(addon?.freeUnits, 10) || 0);
      const totalPrice = toMoney(addon?.totalPrice);

      assert(name, `O adicional ${index + 1} esta sem nome.`);
      assert(quantity >= 1 && quantity <= MAX_ITEM_QUANTITY, `A quantidade do adicional ${name} e invalida.`);
      assertMoneyRange(unitPrice, `O adicional ${name} esta sem preco valido.`, 0, MAX_ITEM_UNIT_PRICE);
      assertMoneyRange(totalPrice, `O adicional ${name} esta sem total valido.`);
      assert(chargedQuantity <= quantity, `O adicional ${name} possui cobranca inconsistente.`);
      assert(freeUnits <= quantity, `O adicional ${name} possui quantidade gratis inconsistente.`);
      assert(
        Number(totalPrice.toFixed(2)) === Number((unitPrice * chargedQuantity).toFixed(2)),
        `O adicional ${name} possui total inconsistente.`
      );

      return {
        id: normalizeText(addon?.id, 120) || `addon-${index + 1}`,
        type: "addon",
        name,
        category: "Complemento do pedido",
        quantity,
        unitPrice,
        totalPrice,
        metadata: {
          chargedQuantity,
          freeUnits,
        },
      };
    });
};

const normalizeDeliveryQuote = (deliveryQuote, fulfillmentMode) => {
  if (fulfillmentMode !== "delivery") {
    return {
      addressLine: "",
      addressNumber: "",
      addressComplement: "",
      addressReference: "",
      addressPostalCode: "",
      addressNeighborhood: "",
      addressCity: "",
      addressState: "",
      addressFull: "",
      deliveryDistanceText: "",
      deliveryRouteBand: "",
      deliveryEstimateText: "",
      deliveryFee: 0,
      raw: {},
    };
  }

  assert(
    deliveryQuote && typeof deliveryQuote === "object",
    "Calcule a entrega antes de finalizar o pedido."
  );

  const addressLine = normalizeText(deliveryQuote.street, 160);
  const addressNumber = normalizeText(deliveryQuote.houseNumber, 40);
  const addressComplement = normalizeText(deliveryQuote.complement, 120);
  const addressReference = normalizeText(deliveryQuote.reference, 160);
  const addressPostalCode = normalizeText(deliveryQuote.cep, 20);
  const addressNeighborhood = normalizeText(deliveryQuote.neighborhood, 120);
  const addressCity = normalizeText(deliveryQuote.city, 120);
  const addressState = normalizeText(deliveryQuote.state, 20);
  const addressFull = normalizeText(
    deliveryQuote.geocodedAddress || deliveryQuote.destinationLabel,
    240
  );
  const deliveryDistanceText = normalizeText(deliveryQuote.distanceText, 60);
  const deliveryRouteBand = normalizeText(deliveryQuote.routeBand, 80);
  const deliveryEstimateText = normalizeText(deliveryQuote.totalEstimateText, 80);
  const deliveryFee = toMoney(deliveryQuote.fee);

  assert(addressLine, "Informe a rua da entrega antes de finalizar.");
  assert(addressNumber, "Informe o numero da entrega antes de finalizar.");
  assert(addressFull, "Nao encontrei o endereco completo da entrega.");
  assertMoneyRange(deliveryFee, "Nao encontrei a taxa de entrega do pedido.", 0, 500);
  assert(!addressPostalCode || normalizePhone(addressPostalCode).length === 8, "CEP da entrega invalido.");

  return {
    addressLine,
    addressNumber,
    addressComplement,
    addressReference,
    addressPostalCode,
    addressNeighborhood,
    addressCity,
    addressState,
    addressFull,
    deliveryDistanceText,
    deliveryRouteBand,
    deliveryEstimateText,
    deliveryFee,
    raw: {
      ...deliveryQuote,
    },
  };
};

const normalizeOrderSubmission = (payload, options = {}) => {
  assert(
    payload && typeof payload === "object" && !Array.isArray(payload),
    "O payload do pedido esta invalido."
  );

  const profile = payload?.profile && typeof payload.profile === "object" ? payload.profile : {};
  const checkout =
    payload?.checkout && typeof payload.checkout === "object" ? payload.checkout : {};
  const customerName = normalizeText(profile.name, 160);
  const customerPhone = normalizePhone(profile.phone);
  const customerEmail = normalizeEmail(profile.email);
  const customerProfileId = normalizeText(profile.id, 120);
  const paymentMethod = normalizeText(checkout.paymentMethod, 20);
  const fulfillmentMode = normalizeText(checkout.fulfillmentMode, 20);
  const timingMode = normalizeText(checkout.timingMode, 20);
  const cashChangeRequired = normalizeText(checkout.cashChangeRequired, 10);
  const cashAmountProvided = toMoney(checkout.cashAmountProvided);
  const customerNotes = normalizeMultilineText(checkout.customerNotes, 600);

  assert(customerName, "Nome do cliente e obrigatorio.");
  assert(customerPhone.length >= 10, "Telefone do cliente invalido.");
  assert(!customerEmail || EMAIL_PATTERN.test(customerEmail), "E-mail do cliente invalido.");
  assert(customerProfileId || customerPhone || customerEmail, "Login do cliente nao identificado.");
  assert(PAYMENT_METHODS.includes(paymentMethod), "Forma de pagamento invalida.");
  assert(FULFILLMENT_MODES.includes(fulfillmentMode), "Tipo de recebimento invalido.");
  assert(TIMING_MODES.includes(timingMode), "Momento do pedido invalido.");

  const productItems = normalizeProductItems(payload?.items, options);
  const addonItems = normalizeAddonItems(payload?.addons);
  const allItems = [...productItems, ...addonItems];
  const productsSubtotal = productItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const addonsSubtotal = addonItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const delivery = normalizeDeliveryQuote(payload?.deliveryQuote, fulfillmentMode);
  const scheduledFor =
    timingMode === "scheduled"
      ? buildScheduledTimestamp(checkout.scheduledDate, checkout.scheduledTime)
      : null;

  if (timingMode === "scheduled") {
    assert(scheduledFor, "Data e horario do agendamento sao obrigatorios.");
  }

  const subtotal = Number((productsSubtotal + addonsSubtotal).toFixed(2));
  const deliveryFee = Number((delivery.deliveryFee || 0).toFixed(2));
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const itemCount = allItems.reduce((sum, item) => sum + item.quantity, 0);
  const needsChange = paymentMethod === "dinheiro" && cashChangeRequired === "yes";
  const changeAmount =
    needsChange && cashAmountProvided !== null
      ? Number((cashAmountProvided - total).toFixed(2))
      : null;

  assert(itemCount > 0 && itemCount <= MAX_ORDER_ITEMS * MAX_ITEM_QUANTITY, "Quantidade total de itens invalida.");
  assertMoneyRange(subtotal, "Subtotal do pedido invalido.");
  assertMoneyRange(total, "Total do pedido invalido.");

  if (needsChange) {
    assert(
      cashAmountProvided !== null,
      "Informe o valor em dinheiro para calcular o troco do pedido."
    );
    assertMoneyRange(
      cashAmountProvided,
      "O valor em dinheiro informado para o troco e invalido.",
      total,
      MAX_ORDER_TOTAL
    );
    assert(changeAmount >= 0, "O valor em dinheiro precisa cobrir o total do pedido.");
  }

  const customerKey = buildCustomerKey({
    phone: customerPhone,
    email: customerEmail,
    profileId: customerProfileId,
  });
  const orderType = getOrderType(timingMode, fulfillmentMode);
  const scheduledDate = timingMode === "scheduled" ? normalizeText(checkout.scheduledDate, 20) : "";
  const scheduledTime = timingMode === "scheduled" ? normalizeText(checkout.scheduledTime, 10) : "";
  const requestSignature = buildRequestSignature({
    customerKey,
    paymentMethod,
    fulfillmentMode,
    timingMode,
    scheduledDate,
    scheduledTime,
    items: allItems.map((item) => ({
      id: item.id,
      type: item.type,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    address: delivery.addressFull,
    total,
    notes: customerNotes,
  });

  return {
    customer: {
      key: customerKey,
      profileId: customerProfileId,
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
    },
    order: {
      status: ORDER_STATUSES[0],
      orderType,
      fulfillmentMode,
      timingMode,
      scheduledFor,
      scheduledDate,
      scheduledTime,
      scheduledLabel:
        timingMode === "scheduled" && scheduledDate && scheduledTime
          ? `${scheduledDate} ${scheduledTime}`
          : "",
      paymentMethod,
      needsChange,
      cashAmountProvided,
      changeAmount: typeof changeAmount === "number" ? changeAmount : null,
      itemCount,
      subtotal,
      addonsTotal: Number(addonsSubtotal.toFixed(2)),
      deliveryFee,
      total,
      customerNotes,
      addressLine: delivery.addressLine,
      addressNumber: delivery.addressNumber,
      addressComplement: delivery.addressComplement,
      addressReference: delivery.addressReference,
      addressPostalCode: delivery.addressPostalCode,
      addressNeighborhood: delivery.addressNeighborhood,
      addressCity: delivery.addressCity,
      addressState: delivery.addressState,
      addressFull: delivery.addressFull,
      deliveryDistanceText: delivery.deliveryDistanceText,
      deliveryRouteBand: delivery.deliveryRouteBand,
      deliveryEstimateText: delivery.deliveryEstimateText,
      rawPayload: {
        profile,
        checkout,
        deliveryQuote: delivery.raw,
      },
    },
    items: allItems,
    requestSignature,
  };
};

module.exports = {
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  TIMING_MODES,
  buildCustomerKey,
  buildRequestSignature,
  normalizeEmail,
  normalizeOrderSubmission,
  normalizePhone,
  normalizeText,
  toMoney,
};
