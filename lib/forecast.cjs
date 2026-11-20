// Previsão inteligente (só leitura): calcula previsão de vendas, clientes com
// frequência caindo, fechamento do mês e alerta do dia a partir dos pedidos.
// Função pura: recebe os pedidos já filtrados pelo restaurante (tenantContext
// aplicado na consulta) e não acessa banco.
const { STORE_TIMEZONE_OFFSET_MINUTES, DAY_MS } = require("./operational-day.cjs");

const PAST_DAYS = 28;
const FUTURE_DAYS = 14;
const WEEKS_FOR_WEEKDAY = 6;
const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const OFFSET_MS = STORE_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
// Dia operacional: pedidos até 1h30 contam no dia anterior (igual ao Caixa).
const CUTOFF_MS = 90 * 60 * 1000;

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toStoreMs = (value) => {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts + OFFSET_MS : NaN;
};
// Número do dia operacional (dias desde 1970 no horário da loja).
const dayNumberOf = (value) => {
  const ms = toStoreMs(value);
  return Number.isFinite(ms) ? Math.floor((ms - CUTOFF_MS) / DAY_MS) : NaN;
};
const dayToDate = (dayNumber) => new Date(dayNumber * DAY_MS);
const dayKey = (dayNumber) => dayToDate(dayNumber).toISOString().slice(0, 10);
const weekdayOf = (dayNumber) => dayToDate(dayNumber).getUTCDay();
const dayLabel = (dayNumber) => {
  const date = dayToDate(dayNumber);
  return `${WEEKDAY_LABELS[date.getUTCDay()]} ${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const storeHourOf = (value) => {
  const ms = toStoreMs(value);
  return Number.isFinite(ms) ? new Date(ms).getUTCHours() : NaN;
};

const isValidOrder = (order) => String(order?.status || "") !== "Cancelado";

const pctChange = (current, previous) =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const stdev = (values) => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
};

const normalizePhoneForWhatsapp = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return "";
};

// --- previsão diária ---------------------------------------------------------
// Média ponderada do mesmo dia da semana nas últimas semanas (as mais recentes
// pesam mais) vezes a tendência das últimas 4 semanas contra as 4 anteriores.
const buildDayPredictor = (revenueByDay, firstDay) => {
  const valueAt = (day) => (day >= firstDay ? revenueByDay.get(day) || 0 : null);
  return (targetDay, lastKnownDay) => {
    const samples = [];
    for (let week = 1; samples.length < WEEKS_FOR_WEEKDAY; week += 1) {
      const day = targetDay - week * 7;
      if (day < firstDay) break;
      if (day > lastKnownDay) continue;
      samples.push(valueAt(day));
    }
    if (!samples.length) return { value: 0, low: 0, high: 0, samples: 0 };
    let weighted = 0;
    let weights = 0;
    samples.forEach((value, index) => {
      const weight = samples.length - index;
      weighted += value * weight;
      weights += weight;
    });
    const base = weighted / weights;
    let recent = 0;
    let older = 0;
    for (let i = 0; i < 28; i += 1) {
      recent += valueAt(lastKnownDay - i) || 0;
      older += valueAt(lastKnownDay - 28 - i) || 0;
    }
    const trend = older > 0 && lastKnownDay - 56 >= firstDay ? clamp(recent / older, 0.85, 1.15) : 1;
    const value = base * Math.sqrt(trend);
    const spread = Math.max(stdev(samples), value * 0.08);
    return {
      value: round2(value),
      low: round2(Math.max(0, value - spread)),
      high: round2(value + spread),
      samples: samples.length,
    };
  };
};

const buildSales = ({ revenueByDay, qtyByDayDish, todayDay, firstDay }) => {
  const predict = buildDayPredictor(revenueByDay, firstDay);
  const lastKnown = todayDay - 1;
  const days = [];
  for (let day = todayDay - PAST_DAYS; day < todayDay + FUTURE_DAYS; day += 1) {
    const isPast = day < todayDay;
    const prediction = isPast ? null : predict(day, lastKnown);
    const lastYearDay = day - 364;
    days.push({
      date: dayKey(day),
      label: dayLabel(day),
      weekday: weekdayOf(day),
      isPast,
      isToday: day === todayDay,
      revenue: day >= firstDay && day <= todayDay ? round2(revenueByDay.get(day) || 0) : null,
      lastWeek: day - 7 >= firstDay && day - 7 < todayDay ? round2(revenueByDay.get(day - 7) || 0) : null,
      lastYear: lastYearDay >= firstDay ? round2(revenueByDay.get(lastYearDay) || 0) : null,
      forecast: prediction ? prediction.value : null,
      low: prediction ? prediction.low : null,
      high: prediction ? prediction.high : null,
    });
  }

  const future = days.filter((d) => !d.isPast);
  const next7 = future.slice(0, 7);
  const sum = (list, key) => round2(list.reduce((acc, d) => acc + Number(d[key] || 0), 0));
  const next7Total = sum(next7, "forecast");
  const sumRange = (from, to) => {
    let total = 0;
    for (let day = from; day <= to; day += 1) total += revenueByDay.get(day) || 0;
    return round2(total);
  };
  const lastWeekTotal = sumRange(todayDay - 7, todayDay - 1);
  const lastMonthSame = sumRange(todayDay + 0 - 28, todayDay + 6 - 28);
  const lastYearSame = todayDay - 364 >= firstDay ? sumRange(todayDay - 364, todayDay - 358) : 0;

  // Acerto: refaz a previsão das últimas 8 semanas só com o que se sabia antes.
  const accuracy = [];
  for (let week = 8; week >= 1; week -= 1) {
    const start = todayDay - week * 7;
    if (start - 7 < firstDay) continue;
    let predicted = 0;
    let actual = 0;
    for (let i = 0; i < 7; i += 1) {
      predicted += predict(start + i, start - 1).value;
      actual += revenueByDay.get(start + i) || 0;
    }
    const pct = actual > 0 ? clamp(Math.round((1 - Math.abs(predicted - actual) / actual) * 100), 0, 100) : null;
    accuracy.push({ label: `${dayLabel(start).slice(4)}`, predicted: round2(predicted), actual: round2(actual), pct });
  }
  const validAcc = accuracy.filter((entry) => entry.pct !== null);
  const accuracyPct = validAcc.length ? Math.round(mean(validAcc.map((entry) => entry.pct))) : null;

  // Dia mais forte e mais fraco dos próximos 7.
  const avgNext = next7Total / Math.max(1, next7.length);
  const ranked = [...next7].filter((d) => d.forecast > 0).sort((a, b) => b.forecast - a.forecast);
  const peak = ranked[0] || null;
  const weak = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  // Pratos previstos para o dia mais forte.
  const dishes = [];
  if (peak) {
    const peakDay = todayDay + future.indexOf(peak);
    const totals = new Map();
    for (let week = 1; week <= WEEKS_FOR_WEEKDAY; week += 1) {
      const day = peakDay - week * 7;
      if (day < firstDay || day >= todayDay) continue;
      const dayMap = qtyByDayDish.get(day);
      if (!dayMap) continue;
      dayMap.forEach((qty, name) => {
        const entry = totals.get(name) || { recent: 0, older: 0, all: 0 };
        entry.all += qty;
        if (week <= 3) entry.recent += qty;
        else entry.older += qty;
        totals.set(name, entry);
      });
    }
    Array.from(totals.entries())
      .map(([name, entry]) => {
        const trend = entry.older > 0 ? entry.recent / entry.older : 1;
        let reason = "estável nas últimas semanas";
        if (trend >= 1.2) reason = `subindo: ${Math.round((trend - 1) * 100)}% a mais nas últimas 3 semanas`;
        else if (trend <= 0.8) reason = `caindo: ${Math.round((1 - trend) * 100)}% a menos nas últimas 3 semanas`;
        return { name, forecastQty: Math.max(1, Math.round(entry.all / WEEKS_FOR_WEEKDAY)), reason };
      })
      .sort((a, b) => b.forecastQty - a.forecastQty)
      .slice(0, 6)
      .forEach((entry) => dishes.push(entry));
  }

  const tips = [];
  if (peak && avgNext > 0) {
    const pct = Math.round((peak.forecast / avgNext - 1) * 100);
    if (pct >= 15) tips.push(`${WEEKDAY_NAMES[peak.weekday]} (${peak.label.slice(4)}) deve vender ${pct}% acima da média da semana. Reforce estoque e equipe.`);
  }
  if (weak && avgNext > 0) {
    const pct = Math.round((1 - weak.forecast / avgNext) * 100);
    if (pct >= 20) tips.push(`${WEEKDAY_NAMES[weak.weekday]} (${weak.label.slice(4)}) deve ser fraca (${pct}% abaixo da média). Vale uma promoção para os clientes.`);
  }
  if (dishes[0]) tips.push(`Prato mais pedido previsto para ${WEEKDAY_NAMES[peak.weekday]}: ${dishes[0].name} (${dishes[0].forecastQty}).`);

  const capitalized = tips.map((tip) => tip.charAt(0).toUpperCase() + tip.slice(1));
  return {
    days,
    kpis: {
      next7: next7Total,
      next7Low: sum(next7, "low"),
      next7High: sum(next7, "high"),
      lastWeek: lastWeekTotal,
      vsLastWeekPct: pctChange(next7Total, lastWeekTotal),
      lastMonthSame,
      vsLastMonthPct: pctChange(next7Total, lastMonthSame),
      lastYearSame,
      vsLastYearPct: pctChange(next7Total, lastYearSame),
      accuracyPct,
    },
    accuracy,
    peak: peak ? { label: peak.label, weekdayName: WEEKDAY_NAMES[peak.weekday], forecast: peak.forecast } : null,
    weak: weak ? { label: weak.label, weekdayName: WEEKDAY_NAMES[weak.weekday], forecast: weak.forecast } : null,
    dishes,
    tips: capitalized,
    predict,
  };
};

// --- clientes com frequência caindo -------------------------------------------
const buildFallingCustomers = ({ orders, todayDay }) => {
  const nowStart = todayDay - 30;
  const beforeStart = todayDay - 120;
  const map = new Map();
  orders.forEach((order) => {
    const key = String(order.customerKey || "").trim();
    if (!key) return;
    const day = dayNumberOf(order.createdAt);
    if (!Number.isFinite(day) || day < todayDay - 210) return;
    const entry = map.get(key) || {
      key,
      name: "",
      phone: "",
      before: 0,
      now: 0,
      beforeRevenue: 0,
      lastDay: -Infinity,
      dishes: new Map(),
      buckets: [0, 0, 0, 0, 0, 0, 0],
    };
    if (order.customerName) entry.name = order.customerName;
    if (order.customerPhone) entry.phone = order.customerPhone;
    if (day >= nowStart) entry.now += 1;
    else if (day >= beforeStart) {
      entry.before += 1;
      entry.beforeRevenue += Number(order.total || 0);
    }
    entry.lastDay = Math.max(entry.lastDay, day);
    const bucket = Math.floor((todayDay - 1 - day) / 30);
    if (bucket >= 0 && bucket < 7) entry.buckets[bucket] += 1;
    (order.items || []).forEach((item) => entry.dishes.set(item.name, (entry.dishes.get(item.name) || 0) + item.quantity));
    map.set(key, entry);
  });

  const falling = Array.from(map.values())
    .map((entry) => {
      const beforeMonthly = entry.before / 3;
      const avgTicket = entry.before > 0 ? entry.beforeRevenue / entry.before : 0;
      const favorite = Array.from(entry.dishes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      return {
        ...entry,
        beforeMonthly: round2(beforeMonthly),
        nowMonthly: entry.now,
        drop: beforeMonthly - entry.now,
        lostRevenueMonth: round2(Math.max(0, beforeMonthly - entry.now) * avgTicket),
        favorite,
      };
    })
    // Pedia pelo menos 1 vez por mês (3+ pedidos em 90 dias) e caiu pela metade ou mais.
    .filter((entry) => entry.before >= 3 && entry.nowMonthly <= entry.beforeMonthly * 0.5)
    .sort((a, b) => b.lostRevenueMonth - a.lostRevenueMonth || b.drop - a.drop);

  // Pedidos por mês (janelas de 30 dias) do grupo, do mais antigo ao atual.
  const monthly = [];
  for (let bucket = 6; bucket >= 0; bucket -= 1) {
    const endDay = todayDay - 1 - bucket * 30;
    const date = dayToDate(endDay);
    monthly.push({
      label: `${String(date.getUTCDate()).padStart(2, "0")}/${MONTH_LABELS[date.getUTCMonth()]}`,
      orders: falling.reduce((sum, entry) => sum + entry.buckets[bucket], 0),
    });
  }
  const last = monthly[monthly.length - 1]?.orders || 0;
  const prev = monthly[monthly.length - 2]?.orders || 0;
  const beforeAvg = falling.reduce((sum, entry) => sum + entry.beforeMonthly, 0);
  const ratio = prev > 0 ? clamp(last / prev, 0.3, 1) : 1;
  const projection = {
    withoutAction: [Math.round(last * ratio), Math.round(last * ratio * ratio)],
    // Suposição: a mensagem traz de volta metade da diferença (estimativa, não garantia).
    withAction: [Math.round(last + (beforeAvg - last) * 0.35), Math.round(last + (beforeAvg - last) * 0.5)],
  };

  return {
    count: falling.length,
    lostRevenueMonth: round2(falling.reduce((sum, entry) => sum + entry.lostRevenueMonth, 0)),
    customers: falling.slice(0, 30).map((entry) => ({
      name: entry.name || "Cliente",
      whatsapp: normalizePhoneForWhatsapp(entry.phone),
      beforeMonthly: entry.beforeMonthly,
      nowMonthly: entry.nowMonthly,
      lastOrderDays: Math.max(0, todayDay - entry.lastDay),
      favorite: entry.favorite,
      lostRevenueMonth: entry.lostRevenueMonth,
    })),
    monthly,
    projection,
  };
};

// --- fechamento do mês -------------------------------------------------------
const buildMonth = ({ revenueByDay, todayDay, predict, firstDay }) => {
  const today = dayToDate(todayDay);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const firstOfMonth = Math.floor(Date.UTC(year, month, 1) / DAY_MS);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const prevFirst = Math.floor(Date.UTC(year, month - 1, 1) / DAY_MS);
  const prevDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const actual = [];
  const projected = [];
  const lastMonth = [];
  let acc = 0;
  let accLast = 0;
  for (let i = 0; i < daysInMonth; i += 1) {
    const day = firstOfMonth + i;
    if (i < prevDays) accLast += prevFirst + i >= firstDay ? revenueByDay.get(prevFirst + i) || 0 : 0;
    lastMonth.push(round2(accLast));
    if (day < todayDay) {
      acc += revenueByDay.get(day) || 0;
      actual.push(round2(acc));
      projected.push(null);
    } else {
      if (day === todayDay) actual.push(null);
      else actual.push(null);
      acc += predict(day, todayDay - 1).value;
      projected.push(round2(acc));
    }
  }
  const actualToDate = round2(actual.filter((v) => v !== null).pop() || 0);
  const elapsed = todayDay - firstOfMonth;
  return {
    label: `${MONTH_LABELS[month]}/${year}`,
    daysInMonth,
    elapsedDays: elapsed,
    actualToDate,
    projectedClose: round2(projected[projected.length - 1] ?? actualToDate),
    lastMonthTotal: round2(accLast),
    lastMonthSamePoint: round2(lastMonth[Math.max(0, elapsed - 1)] || 0),
    vsLastMonthPct: pctChange(projected[projected.length - 1] ?? actualToDate, accLast),
    actual,
    projected,
    lastMonth,
  };
};

// --- alerta de hoje ----------------------------------------------------------
const buildToday = ({ orders, todayDay, now }) => {
  const nowHour = storeHourOf(now);
  const weekday = weekdayOf(todayDay);
  const perHour = new Map();
  const channelPerHour = new Map();
  const todayPerHour = new Map();
  const todayChannelLast = new Map();
  orders.forEach((order) => {
    const day = dayNumberOf(order.createdAt);
    const hour = storeHourOf(order.createdAt);
    if (!Number.isFinite(day) || !Number.isFinite(hour)) return;
    const channel = String(order.channel || "").toLowerCase() || "site";
    if (day === todayDay) {
      todayPerHour.set(hour, (todayPerHour.get(hour) || 0) + 1);
      const ts = new Date(order.createdAt).getTime();
      if (ts > (todayChannelLast.get(channel) || 0)) todayChannelLast.set(channel, ts);
      return;
    }
    const weeksBack = (todayDay - day) / 7;
    if (day < todayDay && weekdayOf(day) === weekday && weeksBack <= WEEKS_FOR_WEEKDAY) {
      const key = `${weeksBack}:${hour}`;
      perHour.set(key, (perHour.get(key) || 0) + 1);
      const ckey = `${channel}:${hour}`;
      channelPerHour.set(ckey, (channelPerHour.get(ckey) || 0) + 1);
    }
  });
  const hoursSet = new Set();
  perHour.forEach((_, key) => hoursSet.add(Number(key.split(":")[1])));
  todayPerHour.forEach((_, hour) => hoursSet.add(hour));
  const hours = Array.from(hoursSet).sort((a, b) => a - b);
  const series = hours.map((hour) => {
    const samples = [];
    for (let w = 1; w <= WEEKS_FOR_WEEKDAY; w += 1) samples.push(perHour.get(`${w}:${hour}`) || 0);
    const m = mean(samples);
    const s = Math.max(stdev(samples), 1);
    return {
      hour,
      expected: round2(m),
      low: round2(Math.max(0, m - s)),
      high: round2(m + s),
      actual: hour <= nowHour ? todayPerHour.get(hour) || 0 : null,
    };
  });

  let alert = null;
  const lastFull = series.filter((entry) => entry.hour < nowHour && entry.hour >= nowHour - 2);
  const expectedRecent = lastFull.reduce((sum, entry) => sum + entry.expected, 0);
  const actualRecent = lastFull.reduce((sum, entry) => sum + (entry.actual || 0), 0);
  if (lastFull.length && expectedRecent >= 4 && actualRecent < expectedRecent * 0.5) {
    const pct = Math.round((1 - actualRecent / expectedRecent) * 100);
    alert = {
      level: "danger",
      title: `Últimas ${lastFull.length} hora(s): ${pct}% abaixo do normal`,
      text: `Vieram ${actualRecent} pedido(s); o normal para ${WEEKDAY_NAMES[weekday]} nesse horário é cerca de ${Math.round(expectedRecent)}.`,
    };
    // Algum canal que costuma vender nesse horário e não vendeu nada hoje?
    const channels = new Set(Array.from(channelPerHour.keys()).map((key) => key.split(":")[0]));
    channels.forEach((channel) => {
      const usual = lastFull.reduce((sum, entry) => sum + (channelPerHour.get(`${channel}:${entry.hour}`) || 0), 0) / WEEKS_FOR_WEEKDAY;
      if (usual >= 2 && !todayChannelLast.has(channel)) {
        alert.text += ` Nenhum pedido de "${channel}" hoje: confira se a loja não está pausada nesse canal.`;
      }
    });
  }
  return { weekdayName: WEEKDAY_NAMES[weekday], nowHour, series, alert };
};

// --- estoque (orientação de compra com o que o sistema já sabe hoje) ---------
const buildInventoryGuidance = (items = []) => {
  const buyMore = [];
  const buyLess = [];
  items.forEach((item) => {
    const status = item?.status?.key;
    const expiration = item?.expiration || {};
    const name = String(item?.name || "").trim();
    if (!name) return;
    if (status === "critical" || status === "low") {
      buyMore.push({
        name,
        quantity: Number(item.quantity || 0),
        minimum: Number(item.minimumQuantity || 0),
        unit: item.unit || "",
        level: status,
        text: status === "critical" ? "Abaixo do mínimo: risco de faltar" : "Perto do mínimo",
      });
    } else if (expiration.isExpired || expiration.isExpiringSoon) {
      buyLess.push({
        name,
        quantity: Number(item.quantity || 0),
        unit: item.unit || "",
        level: expiration.isExpired ? "expired" : "soon",
        text: expiration.label || "",
      });
    }
  });
  return {
    tracked: items.filter((item) => Number(item?.minimumQuantity || 0) > 0).length,
    total: items.length,
    buyMore: buyMore.sort((a, b) => (a.level === b.level ? a.quantity / (a.minimum || 1) - b.quantity / (b.minimum || 1) : a.level === "critical" ? -1 : 1)),
    buyLess,
  };
};

const buildForecast = ({ orders = [], inventoryItems = [], now = new Date() } = {}) => {
  const validOrders = (Array.isArray(orders) ? orders : []).filter(isValidOrder);
  const todayDay = dayNumberOf(now);
  const revenueByDay = new Map();
  const qtyByDayDish = new Map();
  let firstDay = Infinity;
  validOrders.forEach((order) => {
    const day = dayNumberOf(order.createdAt);
    if (!Number.isFinite(day) || day > todayDay) return;
    firstDay = Math.min(firstDay, day);
    revenueByDay.set(day, (revenueByDay.get(day) || 0) + Number(order.total || 0));
    const dishMap = qtyByDayDish.get(day) || new Map();
    (order.items || []).forEach((item) => dishMap.set(item.name, (dishMap.get(item.name) || 0) + item.quantity));
    qtyByDayDish.set(day, dishMap);
  });
  if (!Number.isFinite(firstDay)) firstDay = todayDay;
  const historyDays = Math.max(0, todayDay - firstDay);
  const salesDays = Array.from(revenueByDay.keys()).filter((day) => day < todayDay).length;

  const sales = buildSales({ revenueByDay, qtyByDayDish, todayDay, firstDay });
  const { predict, ...salesOut } = sales;
  return {
    generatedAt: new Date(now).toISOString(),
    today: dayKey(todayDay),
    historyDays,
    salesDays,
    hasEnoughHistory: salesDays >= 14,
    sales: salesOut,
    customers: buildFallingCustomers({ orders: validOrders, todayDay }),
    month: buildMonth({ revenueByDay, todayDay, predict, firstDay }),
    todayAlert: buildToday({ orders: validOrders, todayDay, now }),
    inventory: buildInventoryGuidance(inventoryItems),
  };
};

module.exports = { buildForecast, normalizePhoneForWhatsapp, dayNumberOf };
