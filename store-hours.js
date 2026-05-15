(() => {
  const config = Object.freeze({
    timeZone: "America/Sao_Paulo",
    openTime: "18:00",
    closeTime: "23:00",
    scheduleStepMinutes: 5,
  });

  const pad2 = (value) => String(value).padStart(2, "0");

  const parseTimeToMinutes = (value = "") => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
      return NaN;
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
      return NaN;
    }

    return hours * 60 + minutes;
  };

  const OPEN_MINUTES = parseTimeToMinutes(config.openTime);
  const CLOSE_MINUTES = parseTimeToMinutes(config.closeTime);

  const buildDateFromDateValue = (dateValue) => {
    const [year, month, day] = String(dateValue || "")
      .split("-")
      .map((part) => Number(part));

    if (!year || !month || !day) {
      return null;
    }

    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  };

  const addDaysToDateValue = (dateValue, days) => {
    const baseDate = buildDateFromDateValue(dateValue);

    if (!baseDate) {
      return "";
    }

    const nextDate = new Date(baseDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + Number(days || 0));

    return [
      nextDate.getUTCFullYear(),
      pad2(nextDate.getUTCMonth() + 1),
      pad2(nextDate.getUTCDate()),
    ].join("-");
  };

  const formatDateValue = (dateValue) => {
    const date = buildDateFromDateValue(dateValue);

    if (!date) {
      return dateValue;
    }

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "UTC",
        dateStyle: "short",
      }).format(date);
    } catch (error) {
      return dateValue;
    }
  };

  const formatMinutesAsTime = (totalMinutes) => {
    const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Number(totalMinutes) || 0));
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;

    return `${pad2(hours)}:${pad2(minutes)}`;
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

  const buildDateTimeKey = (dateValue, timeValue) => `${dateValue}T${timeValue}`;

  const getNowParts = (now = new Date()) => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now).reduce((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }

      return accumulator;
    }, {});

    const year = parts.year || "0000";
    const month = parts.month || "01";
    const day = parts.day || "01";
    const hour = parts.hour || "00";
    const minute = parts.minute || "00";
    const second = parts.second || "00";
    const hoursNumber = Number(hour);
    const minutesNumber = Number(minute);
    const secondsNumber = Number(second);

    return {
      dateValue: `${year}-${month}-${day}`,
      timeValue: `${hour}:${minute}`,
      hours: hoursNumber,
      minutes: minutesNumber,
      seconds: secondsNumber,
      minuteOfDay: hoursNumber * 60 + minutesNumber,
      dateTimeKey: `${year}-${month}-${day}T${hour}:${minute}`,
    };
  };

  const isStoreOpen = (now = new Date()) => {
    const nowParts = getNowParts(now);

    if (nowParts.minuteOfDay < OPEN_MINUTES) {
      return false;
    }

    if (nowParts.minuteOfDay > CLOSE_MINUTES) {
      return false;
    }

    if (nowParts.minuteOfDay === CLOSE_MINUTES && nowParts.seconds > 0) {
      return false;
    }

    return true;
  };

  const getNextFutureStepMinutes = (minuteOfDay) => {
    const step = Math.max(1, Number(config.scheduleStepMinutes) || 1);
    return Math.ceil((Number(minuteOfDay || 0) + 1) / step) * step;
  };

  const getDefaultSchedule = (now = new Date()) => {
    const nowParts = getNowParts(now);

    if (nowParts.minuteOfDay < OPEN_MINUTES) {
      return {
        dateValue: nowParts.dateValue,
        timeValue: config.openTime,
      };
    }

    if (isStoreOpen(now)) {
      const nextMinutes = Math.max(OPEN_MINUTES, getNextFutureStepMinutes(nowParts.minuteOfDay));

      if (nextMinutes <= CLOSE_MINUTES) {
        return {
          dateValue: nowParts.dateValue,
          timeValue: formatMinutesAsTime(nextMinutes),
        };
      }
    }

    return {
      dateValue: addDaysToDateValue(nowParts.dateValue, 1),
      timeValue: config.openTime,
    };
  };

  const getNextOpening = (now = new Date()) => {
    const nowParts = getNowParts(now);

    if (nowParts.minuteOfDay < OPEN_MINUTES) {
      return {
        dateValue: nowParts.dateValue,
        timeValue: config.openTime,
      };
    }

    if (isStoreOpen(now)) {
      return {
        dateValue: nowParts.dateValue,
        timeValue: config.closeTime,
      };
    }

    return {
      dateValue: addDaysToDateValue(nowParts.dateValue, 1),
      timeValue: config.openTime,
    };
  };

  const getScheduleConstraints = (selectedDate = "", now = new Date()) => {
    const nowParts = getNowParts(now);
    const defaultSchedule = getDefaultSchedule(now);
    const effectiveDate = selectedDate || defaultSchedule.dateValue;
    let timeMin = config.openTime;
    let selectedDateAvailable = true;

    if (effectiveDate === nowParts.dateValue) {
      const nextTodayMinutes = Math.max(OPEN_MINUTES, getNextFutureStepMinutes(nowParts.minuteOfDay));

      if (nextTodayMinutes > CLOSE_MINUTES) {
        selectedDateAvailable = false;
      } else {
        timeMin = formatMinutesAsTime(nextTodayMinutes);
      }
    }

    return {
      minDate: nowParts.dateValue,
      timeMin,
      timeMax: config.closeTime,
      stepSeconds: Math.max(60, (Number(config.scheduleStepMinutes) || 1) * 60),
      defaultDate: defaultSchedule.dateValue,
      defaultTime: defaultSchedule.timeValue,
      selectedDateAvailable,
    };
  };

  const formatScheduleLabel = (dateValue, timeValue, now = new Date()) => {
    if (!dateValue || !timeValue) {
      return "";
    }

    const nowParts = getNowParts(now);
    const relativeDateLabel = formatRelativeDateLabel(dateValue, nowParts);

    return `${relativeDateLabel} as ${timeValue}`;
  };

  const validateSchedule = ({ dateValue = "", timeValue = "" } = {}, now = new Date()) => {
    if (!dateValue) {
      return {
        isValid: false,
        reason: "missing_date",
      };
    }

    if (!timeValue) {
      return {
        isValid: false,
        reason: "missing_time",
      };
    }

    const minutes = parseTimeToMinutes(timeValue);

    if (!Number.isFinite(minutes)) {
      return {
        isValid: false,
        reason: "invalid_time",
      };
    }

    if (minutes < OPEN_MINUTES || minutes > CLOSE_MINUTES) {
      return {
        isValid: false,
        reason: "outside_window",
      };
    }

    const nowParts = getNowParts(now);
    const candidateKey = buildDateTimeKey(dateValue, timeValue);

    if (candidateKey <= nowParts.dateTimeKey) {
      return {
        isValid: false,
        reason: "past",
      };
    }

    return {
      isValid: true,
      reason: "",
    };
  };

  const getCurrentContext = (now = new Date()) => {
    const nowParts = getNowParts(now);
    const open = isStoreOpen(now);
    const nextOpening = getNextOpening(now);
    const nextOpeningLabel = `${formatRelativeDateLabel(
      nextOpening.dateValue,
      nowParts
    )} as ${nextOpening.timeValue}`;

    return {
      isOpen: open,
      acceptsImmediateOrders: open,
      statusTone: open ? "open" : "closed",
      statusLabel: open ? "Loja aberta" : "Loja fechada",
      shortStatusLabel: open ? "Aberta agora" : "Fechada agora",
      businessWindowLabel: `${config.openTime} as ${config.closeTime}`,
      nowDateValue: nowParts.dateValue,
      nowTimeValue: nowParts.timeValue,
      nextOpeningDateValue: nextOpening.dateValue,
      nextOpeningTimeValue: nextOpening.timeValue,
      nextOpeningLabel,
      detail: open
        ? `Pedidos imediatos liberados ate ${config.closeTime}.`
        : `Agende seu pedido dentro do horario diario. Proxima abertura: ${nextOpeningLabel}.`,
    };
  };

  window.TokyoStoreHours = Object.freeze({
    config,
    parseTimeToMinutes,
    formatDateValue,
    formatScheduleLabel,
    getNowParts,
    isStoreOpen,
    getCurrentContext,
    getDefaultSchedule,
    getScheduleConstraints,
    validateSchedule,
  });
})();
