(function initBusinessHours(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.TokyoBusinessHours = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createBusinessHoursApi() {
  const DEFAULT_TIMEZONE = "America/Sao_Paulo";
  const DAY_KEYS = Object.freeze([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]);
  const DAY_LABELS = Object.freeze({
    monday: "segunda-feira",
    tuesday: "terca-feira",
    wednesday: "quarta-feira",
    thursday: "quinta-feira",
    friday: "sexta-feira",
    saturday: "sabado",
    sunday: "domingo",
  });

  const normalizeTimeValue = (value, fallback = "") => {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
      return fallback;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return fallback;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const parseTimeToMinutes = (value) => {
    const normalizedTime = normalizeTimeValue(value, "");

    if (!normalizedTime) {
      return NaN;
    }

    const [hours, minutes] = normalizedTime.split(":").map((part) => Number(part));
    return hours * 60 + minutes;
  };

  const formatMinutesAsTime = (totalMinutes) => {
    const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(Number(totalMinutes) || 0)));
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const buildDateFromDateValue = (dateValue) => {
    const [year, month, day] = String(dateValue || "")
      .split("-")
      .map((part) => Number(part));

    if (!year || !month || !day) {
      return null;
    }

    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  };

  const addDaysToDateValue = (dateValue, daysToAdd) => {
    const baseDate = buildDateFromDateValue(dateValue);

    if (!baseDate) {
      return "";
    }

    const nextDate = new Date(baseDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + Number(daysToAdd || 0));

    return [
      nextDate.getUTCFullYear(),
      String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
      String(nextDate.getUTCDate()).padStart(2, "0"),
    ].join("-");
  };

  const formatDateValue = (dateValue) => {
    const date = buildDateFromDateValue(dateValue);

    if (!date) {
      return dateValue || "";
    }

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "UTC",
        dateStyle: "short",
      }).format(date);
    } catch (error) {
      const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : dateValue || "";
    }
  };

  const getNowParts = (now = new Date(), timeZone = DEFAULT_TIMEZONE) => {
    let formatter;
    const resolvedTimeZone = String(timeZone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;

    try {
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: resolvedTimeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
    } catch (error) {
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: DEFAULT_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
    }

    const parts = formatter.formatToParts(now).reduce((summary, part) => {
      if (part.type !== "literal") {
        summary[part.type] = part.value;
      }

      return summary;
    }, {});
    const hour = parts.hour || "00";
    const minute = parts.minute || "00";
    const second = parts.second || "00";
    const hours = Number(hour);
    const minutes = Number(minute);
    const seconds = Number(second);
    const weekday = String(parts.weekday || "").toLowerCase();
    const dayKey = DAY_KEYS.includes(weekday) ? weekday : "monday";

    return {
      dateValue: `${parts.year || "0000"}-${parts.month || "01"}-${parts.day || "01"}`,
      timeValue: `${hour}:${minute}`,
      hours,
      minutes,
      seconds,
      minuteOfDay: hours * 60 + minutes,
      dateTimeKey: `${parts.year || "0000"}-${parts.month || "01"}-${parts.day || "01"}T${hour}:${minute}`,
      dayKey,
      dayIndex: DAY_KEYS.indexOf(dayKey),
    };
  };

  const getWeekdayKeyForDateValue = (dateValue, timeZone = DEFAULT_TIMEZONE) => {
    const date = buildDateFromDateValue(dateValue);

    if (!date) {
      return "monday";
    }

    try {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: String(timeZone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE,
        weekday: "long",
      })
        .format(date)
        .toLowerCase();

      return DAY_KEYS.includes(weekday) ? weekday : "monday";
    } catch (error) {
      return "monday";
    }
  };

  const formatRelativeDateLabel = (dateValue, nowParts) => {
    if (!dateValue) {
      return "";
    }

    if (dateValue === nowParts.dateValue) {
      return "hoje";
    }

    if (dateValue === addDaysToDateValue(nowParts.dateValue, 1)) {
      return "amanha";
    }

    return formatDateValue(dateValue);
  };

  const getSpecialDateForDate = (businessSchedule = {}, dateValue = "") =>
    (Array.isArray(businessSchedule.specialDates) ? businessSchedule.specialDates : []).find(
      (entry) => entry && entry.date === dateValue
    ) || null;

  const buildBusinessDayHoursLabel = (day = {}) => {
    if (!day || day.isOpen === false) {
      return "Fechado";
    }

    const openTime = normalizeTimeValue(day.openTime);
    const closeTime = normalizeTimeValue(day.closeTime);

    if (!openTime || !closeTime) {
      return "Horario indisponivel";
    }

    const pauseStart = normalizeTimeValue(day.pauseStart);
    const pauseEnd = normalizeTimeValue(day.pauseEnd);
    const pauseLabel = pauseStart && pauseEnd ? `, pausa ${pauseStart}-${pauseEnd}` : "";

    return `${openTime}-${closeTime}${pauseLabel}`;
  };

  const getBusinessDayForDate = (businessSchedule = {}, dateValue = "", timeZone = DEFAULT_TIMEZONE) => {
    const dayKey = getWeekdayKeyForDateValue(dateValue, businessSchedule.timeZone || timeZone);
    const activeSpecialDate = getSpecialDateForDate(businessSchedule, dateValue);

    return {
      dayKey,
      day: activeSpecialDate || businessSchedule.days?.[dayKey] || null,
      activeSpecialDate,
    };
  };

  const getScheduleDayForOffset = (businessSchedule, nowParts, offset) => {
    const dayIndex = (nowParts.dayIndex + offset) % DAY_KEYS.length;
    const dayKey = DAY_KEYS[dayIndex] || "monday";
    const dateValue = addDaysToDateValue(nowParts.dateValue, offset);
    const activeSpecialDate = getSpecialDateForDate(businessSchedule, dateValue);

    return {
      dayKey,
      dateValue,
      activeSpecialDate,
      day: activeSpecialDate || businessSchedule?.days?.[dayKey] || null,
    };
  };

  const getNextOpening = (businessSchedule = {}, now = new Date(), nowParts = null, options = {}) => {
    const timeZone = businessSchedule.timeZone || options.timeZone || DEFAULT_TIMEZONE;
    const effectiveNowParts = nowParts || getNowParts(now, timeZone);
    const includeCurrentOpenUntil = options.includeCurrentOpenUntil === true;

    for (let offset = 0; offset < 14; offset += 1) {
      const { dateValue, day } = getScheduleDayForOffset(businessSchedule, effectiveNowParts, offset);

      if (!day || day.isOpen === false) {
        continue;
      }

      const openMinutes = parseTimeToMinutes(day.openTime);
      const closeMinutes = parseTimeToMinutes(day.closeTime);
      const pauseStartMinutes = parseTimeToMinutes(day.pauseStart);
      const pauseEndMinutes = parseTimeToMinutes(day.pauseEnd);

      if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) {
        continue;
      }

      if (offset === 0) {
        if (effectiveNowParts.minuteOfDay < openMinutes) {
          return { dateValue, timeValue: normalizeTimeValue(day.openTime), reason: "before_open" };
        }

        if (
          Number.isFinite(pauseStartMinutes) &&
          Number.isFinite(pauseEndMinutes) &&
          effectiveNowParts.minuteOfDay >= pauseStartMinutes &&
          effectiveNowParts.minuteOfDay < pauseEndMinutes
        ) {
          return { dateValue, timeValue: normalizeTimeValue(day.pauseEnd), reason: "pause" };
        }

        if (
          effectiveNowParts.minuteOfDay > closeMinutes ||
          (effectiveNowParts.minuteOfDay === closeMinutes && effectiveNowParts.seconds > 0)
        ) {
          continue;
        }

        if (includeCurrentOpenUntil) {
          return { dateValue, timeValue: normalizeTimeValue(day.closeTime), reason: "current_open_until" };
        }

        continue;
      }

      return { dateValue, timeValue: normalizeTimeValue(day.openTime), reason: "next_open_day" };
    }

    return { dateValue: "", timeValue: "", reason: "not_found" };
  };

  const getBusinessHoursStatus = (businessSchedule = {}, now = new Date(), timeZone = DEFAULT_TIMEZONE, options = {}) => {
    const schedule = businessSchedule && typeof businessSchedule === "object" ? businessSchedule : null;
    const resolvedTimeZone = schedule?.timeZone || timeZone || DEFAULT_TIMEZONE;

    if (!schedule || !schedule.days) {
      return {
        validationApplied: false,
        reason: "missing_structured_schedule",
        timeZone: resolvedTimeZone,
        checkedAt: now.toISOString(),
        isOpen: true,
        closedReason: "",
        localDate: "",
        localTime: "",
        nextOpeningLabel: "",
        activeSpecialDate: null,
        message: "",
        acceptsOrdersOutsideHours: true,
        acceptsImmediateOrders: true,
      };
    }

    const nowParts = getNowParts(now, resolvedTimeZone);
    const activeSpecialDate = getSpecialDateForDate(schedule, nowParts.dateValue);
    const day = activeSpecialDate || schedule.days?.[nowParts.dayKey] || null;
    const acceptsOrdersOutsideHours = schedule.acceptOrdersOutsideHours === true;
    let isOpen = false;
    let closedReason = activeSpecialDate ? "special_date_closed" : "closed_day";
    let openTime = "";
    let closeTime = "";
    let pauseStart = "";
    let pauseEnd = "";

    if (day && day.isOpen !== false) {
      openTime = normalizeTimeValue(day.openTime);
      closeTime = normalizeTimeValue(day.closeTime);
      pauseStart = normalizeTimeValue(day.pauseStart);
      pauseEnd = normalizeTimeValue(day.pauseEnd);
      const openMinutes = parseTimeToMinutes(openTime);
      const closeMinutes = parseTimeToMinutes(closeTime);
      const pauseStartMinutes = parseTimeToMinutes(pauseStart);
      const pauseEndMinutes = parseTimeToMinutes(pauseEnd);

      if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) {
        closedReason = "invalid_window";
      } else if (nowParts.minuteOfDay < openMinutes) {
        closedReason = "before_open";
      } else if (
        nowParts.minuteOfDay > closeMinutes ||
        (nowParts.minuteOfDay === closeMinutes && nowParts.seconds > 0)
      ) {
        closedReason = "after_close";
      } else if (
        Number.isFinite(pauseStartMinutes) &&
        Number.isFinite(pauseEndMinutes) &&
        nowParts.minuteOfDay >= pauseStartMinutes &&
        nowParts.minuteOfDay < pauseEndMinutes
      ) {
        closedReason = "pause";
      } else {
        isOpen = true;
        closedReason = "";
      }
    }

    const nextOpening = isOpen && options.includeCurrentOpenUntil !== true
      ? { dateValue: "", timeValue: "", reason: "" }
      : getNextOpening(schedule, now, nowParts, options);
    const nextOpeningLabel =
      nextOpening.dateValue && nextOpening.timeValue
        ? `${formatRelativeDateLabel(nextOpening.dateValue, nowParts)} as ${nextOpening.timeValue}`
        : "";
    const specialDateLabel = activeSpecialDate
      ? activeSpecialDate.name
        ? `Data especial: ${activeSpecialDate.name}.`
        : "Data especial ativa."
      : "";
    const specialDateNotice = [specialDateLabel, activeSpecialDate?.message || ""]
      .filter(Boolean)
      .join(" ");
    const baseClosedMessage =
      String(activeSpecialDate?.message || schedule.closedMessage || "").replace(/\s+/g, " ").trim() ||
      "Estamos fechados agora. Voce pode agendar seu pedido para o proximo horario de atendimento.";
    const message =
      isOpen || acceptsOrdersOutsideHours
        ? ""
        : closedReason === "pause"
          ? `${specialDateLabel ? `${specialDateLabel} ` : ""}Estamos em pausa agora. Retornamos ${nextOpeningLabel || "em breve"}. Voce pode agendar seu pedido para outro horario.`
          : `${specialDateLabel ? `${specialDateLabel} ` : ""}${baseClosedMessage}${nextOpeningLabel ? ` Proxima abertura: ${nextOpeningLabel}.` : ""}`;

    return {
      validationApplied: true,
      timeZone: resolvedTimeZone,
      checkedAt: now.toISOString(),
      localDate: nowParts.dateValue,
      localTime: nowParts.timeValue,
      dayKey: nowParts.dayKey,
      dayLabel: activeSpecialDate?.name || DAY_LABELS[nowParts.dayKey] || nowParts.dayKey,
      day,
      activeSpecialDate: activeSpecialDate
        ? {
            date: activeSpecialDate.date,
            name: activeSpecialDate.name || "",
            message: activeSpecialDate.message || "",
            isOpen: activeSpecialDate.isOpen !== false,
            openTime: activeSpecialDate.openTime || "",
            closeTime: activeSpecialDate.closeTime || "",
            pauseStart: activeSpecialDate.pauseStart || "",
            pauseEnd: activeSpecialDate.pauseEnd || "",
          }
        : null,
      isSpecialDateActive: Boolean(activeSpecialDate),
      specialDateNotice,
      isOpen,
      closedReason,
      openTime,
      closeTime,
      pauseStart,
      pauseEnd,
      todayHoursLabel: buildBusinessDayHoursLabel(day),
      nextOpeningDate: nextOpening.dateValue,
      nextOpeningTime: nextOpening.timeValue,
      nextOpeningLabel,
      message,
      acceptsOrdersOutsideHours,
      acceptsImmediateOrders: isOpen || acceptsOrdersOutsideHours,
    };
  };

  return {
    DEFAULT_TIMEZONE,
    DAY_KEYS,
    DAY_LABELS,
    addDaysToDateValue,
    formatDateValue,
    formatMinutesAsTime,
    buildBusinessDayHoursLabel,
    getBusinessDayForDate,
    getBusinessHoursStatus,
    getNextOpening,
    getNowParts,
    getSpecialDateForDate,
    getWeekdayKeyForDateValue,
    normalizeTimeValue,
    parseTimeToMinutes,
  };
});
