"use strict";

// Limites do plano do restaurante (uma regra só para todos os caminhos de cadastro).
// Usuários que ocupam vaga: ativos, pendentes de convite e bloqueados
// temporariamente. Desativados (INACTIVE) liberam a vaga.
const { buildHttpError } = require("./http.cjs");
const { getRestaurantCommercialAccess } = require("./master-platform-store.cjs");

const SEAT_STATUSES = new Set(["ACTIVE", "PENDING", "BLOCKED"]);

const countSeatUsers = (users = [], restaurantKey = "", ignoreUserId = "") =>
  (Array.isArray(users) ? users : []).filter(
    (user) =>
      String(user.restaurantKey || "") === String(restaurantKey || "") &&
      user.userScope !== "SYSTEM" &&
      user.platformScope !== true &&
      String(user.id || "") !== String(ignoreUserId || "") &&
      SEAT_STATUSES.has(String(user.status || "ACTIVE").toUpperCase())
  ).length;

const assertRestaurantUserSeat = async ({ restaurantKey, users = [], ignoreUserId = "" }) => {
  const commercialAccess = await getRestaurantCommercialAccess(restaurantKey);
  const userLimit = Number(commercialAccess.userLimit || commercialAccess.limite_usuarios || 0);
  if (!(userLimit > 0)) return;
  if (countSeatUsers(users, restaurantKey, ignoreUserId) >= userLimit) {
    throw buildHttpError(
      403,
      `Seu plano ${commercialAccess.planName || ""} permite até ${userLimit} usuários. Desative alguém ou mude de plano para cadastrar mais.`.replace(/\s+/g, " "),
      "plan_user_limit_exceeded",
      { planKey: commercialAccess.planKey, limit: userLimit }
    );
  }
};

module.exports = { assertRestaurantUserSeat, countSeatUsers, SEAT_STATUSES };
