import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const businessHours = require("../lib/business-hours.cjs");
const { buildTenantContext } = require("../lib/tenant-context.cjs");

const defaultTenantContext = buildTenantContext(
  {
    host: "localhost",
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi",
    matched: true,
    resolutionMode: "local-validation",
    multiRestaurantActive: false,
  },
  {
    source: "validate:business-hours",
  }
);
const defaultTenantOptions = { tenantContext: defaultTenantContext };

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const createBusinessDay = ({
  isOpen = true,
  openTime = "18:00",
  closeTime = "23:00",
  pauseStart = "",
  pauseEnd = "",
} = {}) => ({
  isOpen,
  openTime,
  closeTime,
  pauseStart,
  pauseEnd,
});

const createWeeklyDays = (overrides = {}) =>
  DAY_KEYS.reduce((days, dayKey) => {
    days[dayKey] = {
      ...createBusinessDay(),
      ...(overrides[dayKey] || {}),
    };

    return days;
  }, {});

const createSchedule = ({ days = createWeeklyDays(), specialDates = [], acceptOrdersOutsideHours = false } = {}) => ({
  timeZone: "America/Sao_Paulo",
  acceptOrdersOutsideHours,
  closedMessage:
    "Estamos fechados agora. Voce pode agendar seu pedido para o proximo horario de atendimento.",
  days,
  specialDates,
});

const atSaoPaulo = (dateValue, timeValue) => new Date(`${dateValue}T${timeValue}:00-03:00`);

const assertStatus = (status, expected, label) => {
  Object.entries(expected).forEach(([key, value]) => {
    assert.equal(status[key], value, `${label}: ${key}`);
  });
};

const runHelperTests = () => {
  const scheduleWithPause = createSchedule({
    days: createWeeklyDays({
      monday: createBusinessDay({ pauseStart: "20:00", pauseEnd: "20:30" }),
    }),
  });

  assertStatus(
    businessHours.getBusinessHoursStatus(scheduleWithPause, atSaoPaulo("2026-06-22", "19:00")),
    {
      isOpen: true,
      closedReason: "",
      localDate: "2026-06-22",
      localTime: "19:00",
      acceptsOrdersOutsideHours: false,
    },
    "restaurante aberto no horario semanal"
  );

  assertStatus(
    businessHours.getBusinessHoursStatus(
      createSchedule({
        days: createWeeklyDays({
          tuesday: createBusinessDay({ isOpen: false }),
        }),
      }),
      atSaoPaulo("2026-06-23", "19:00")
    ),
    {
      isOpen: false,
      closedReason: "closed_day",
      localDate: "2026-06-23",
      localTime: "19:00",
    },
    "restaurante fechado por dia fechado"
  );

  assertStatus(
    businessHours.getBusinessHoursStatus(scheduleWithPause, atSaoPaulo("2026-06-22", "17:30")),
    {
      isOpen: false,
      closedReason: "before_open",
      localDate: "2026-06-22",
      localTime: "17:30",
      nextOpeningLabel: "hoje as 18:00",
    },
    "restaurante fechado antes da abertura"
  );

  assertStatus(
    businessHours.getBusinessHoursStatus(scheduleWithPause, atSaoPaulo("2026-06-22", "23:30")),
    {
      isOpen: false,
      closedReason: "after_close",
      localDate: "2026-06-22",
      localTime: "23:30",
      nextOpeningLabel: "amanha as 18:00",
    },
    "restaurante fechado apos fechamento"
  );

  assertStatus(
    businessHours.getBusinessHoursStatus(scheduleWithPause, atSaoPaulo("2026-06-22", "20:10")),
    {
      isOpen: false,
      closedReason: "pause",
      localDate: "2026-06-22",
      localTime: "20:10",
      nextOpeningLabel: "hoje as 20:30",
    },
    "restaurante fechado durante pausa"
  );

  const closedSpecialDateStatus = businessHours.getBusinessHoursStatus(
    createSchedule({
      specialDates: [
        {
          id: "feriado-teste",
          date: "2026-06-22",
          name: "Feriado teste",
          isOpen: false,
          openTime: "18:00",
          closeTime: "23:00",
          pauseStart: "",
          pauseEnd: "",
          message: "Hoje nao abriremos por feriado.",
        },
      ],
    }),
    atSaoPaulo("2026-06-22", "19:00")
  );

  assertStatus(
    closedSpecialDateStatus,
    {
      isOpen: false,
      closedReason: "special_date_closed",
      localDate: "2026-06-22",
      localTime: "19:00",
    },
    "data especial fechada sobrescreve dia semanal aberto"
  );
  assert.equal(closedSpecialDateStatus.activeSpecialDate?.name, "Feriado teste");

  const openSpecialDateStatus = businessHours.getBusinessHoursStatus(
    createSchedule({
      days: createWeeklyDays({
        tuesday: createBusinessDay({ isOpen: false }),
      }),
      specialDates: [
        {
          id: "evento-especial",
          date: "2026-06-23",
          name: "Evento especial",
          isOpen: true,
          openTime: "18:00",
          closeTime: "23:00",
          pauseStart: "",
          pauseEnd: "",
          message: "Atendimento especial hoje.",
        },
      ],
    }),
    atSaoPaulo("2026-06-23", "19:00")
  );

  assertStatus(
    openSpecialDateStatus,
    {
      isOpen: true,
      closedReason: "",
      localDate: "2026-06-23",
      localTime: "19:00",
    },
    "data especial aberta sobrescreve dia semanal fechado"
  );
  assert.equal(openSpecialDateStatus.activeSpecialDate?.name, "Evento especial");
};

const buildMockResponse = () => {
  const headers = {};

  return {
    statusCode: 200,
    payload: null,
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
};

const runHandler = async (handler, body, remoteAddress) => {
  const req = {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      "x-forwarded-for": remoteAddress,
      origin: "http://localhost:3000",
      "content-type": "application/json; charset=utf-8",
      accept: "application/json",
    },
    socket: {
      remoteAddress,
    },
    body: JSON.stringify(body),
  };
  const res = buildMockResponse();
  await handler(req, res);
  return res;
};

const buildOrderPayload = (suffix, timingMode = "immediate") => ({
  profile: {
    id: `profile-${suffix}`,
    name: `Cliente ${suffix}`,
    phone: "(11) 99888-7766",
    email: `cliente-${suffix}@teste.com`,
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "pickup",
    timingMode,
    scheduledDate: timingMode === "scheduled" ? "2099-04-12" : "",
    scheduledTime: timingMode === "scheduled" ? "19:30" : "",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: "",
  },
  items: [
    {
      id: "carpaccio-salmao",
      name: "Carpaccio de Salmao",
      category: "Carpaccio",
      quantity: 1,
      price: 58.5,
    },
  ],
  addons: [],
  deliveryQuote: null,
});

const createClosedEveryDaySchedule = (acceptOrdersOutsideHours = false) =>
  createSchedule({
    acceptOrdersOutsideHours,
    days: createWeeklyDays(
      DAY_KEYS.reduce((overrides, dayKey) => {
        overrides[dayKey] = createBusinessDay({ isOpen: false });
        return overrides;
      }, {})
    ),
  });

const runOrderApiTests = async () => {
  const originalCwd = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-business-hours-tests-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    await fs.copyFile(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
    process.chdir(tempRoot);

    process.env.NODE_ENV = "development";
    process.env.ALLOWED_PUBLIC_ORIGINS = "http://localhost:3000";
    process.env.ORDER_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.ORDER_RATE_LIMIT_MAX_REQUESTS = "50";
    process.env.ORDER_MAX_BODY_BYTES = "65536";
    delete process.env.DATABASE_URL;

    const createOrderHandler = require(path.join(workspaceRoot, "api/orders/create.js"));
    const { updateRestaurantSettings } = require(path.join(
      workspaceRoot,
      "lib/restaurant-settings-store.cjs"
    ));

    await updateRestaurantSettings(
      {
        businessSchedule: createClosedEveryDaySchedule(false),
        hasStructuredBusinessSchedule: true,
      },
      { login: "test", displayName: "Test" },
      defaultTenantOptions
    );
    const blockedImmediate = await runHandler(
      createOrderHandler,
      buildOrderPayload("imediato-bloqueado"),
      "203.0.113.81"
    );

    assert.equal(blockedImmediate.statusCode, 409, "pedido imediato fechado deve ser bloqueado");
    assert.equal(blockedImmediate.payload?.errorCode, "store_closed");
    assert.equal(blockedImmediate.payload?.operationalStatus?.acceptsOrdersOutsideHours, false);

    await updateRestaurantSettings(
      {
        businessSchedule: createClosedEveryDaySchedule(true),
        hasStructuredBusinessSchedule: true,
      },
      { login: "test", displayName: "Test" },
      defaultTenantOptions
    );
    const allowedImmediate = await runHandler(
      createOrderHandler,
      buildOrderPayload("imediato-permitido"),
      "203.0.113.82"
    );

    assert.equal(allowedImmediate.statusCode, 200, "pedido imediato fechado deve passar com aceite fora do horario");
    assert.equal(allowedImmediate.payload?.ok, true);
    assert.equal(allowedImmediate.payload?.order?.timingMode, "immediate");

    await updateRestaurantSettings(
      {
        businessSchedule: createClosedEveryDaySchedule(false),
        hasStructuredBusinessSchedule: true,
      },
      { login: "test", displayName: "Test" },
      defaultTenantOptions
    );
    const allowedScheduled = await runHandler(
      createOrderHandler,
      buildOrderPayload("agendado-permitido", "scheduled"),
      "203.0.113.83"
    );

    assert.equal(allowedScheduled.statusCode, 200, "pedido agendado fechado deve continuar permitido");
    assert.equal(allowedScheduled.payload?.ok, true);
    assert.equal(allowedScheduled.payload?.order?.timingMode, "scheduled");

    const store = JSON.parse(await fs.readFile(path.join(tempRoot, ".data", "orders.json"), "utf8"));
    const scheduledOrder = store.orders.find((order) => order.timingMode === "scheduled");
    assert.equal(
      scheduledOrder?.rawPayload?.operationalStatus?.immediateValidationApplied,
      false,
      "pedido agendado deve manter validacao imediata desativada no snapshot"
    );
  } finally {
    process.chdir(originalCwd);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

const run = async () => {
  runHelperTests();
  await runOrderApiTests();
  console.log("Validacao de funcionamento do restaurante concluida com sucesso.");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
