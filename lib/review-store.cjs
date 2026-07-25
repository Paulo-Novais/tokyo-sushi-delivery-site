const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const { buildHttpError } = require("./http.cjs");
const { getOperationalTenant, matchesTenantScope } = require("./tenant-context.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "reviews.json");
const LOCAL_STORE_VERSION = 1;
const RECENT_WINDOW_DAYS = 60;
const REVIEW_VISUAL_MINIMUM_AVERAGE = 4.2;
const MAX_NAME_LENGTH = 120;
const MAX_CONTACT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 720;
const MAX_SOURCE_LENGTH = 40;
const MAX_VISIBILITY_STATE_LENGTH = 24;
const PUBLICATION_WEEKS_BY_RATING = Object.freeze({
  1: 1,
  2: 2,
  3: 3,
  4: 6,
  5: 8,
});

let sqlClient = null;
let schemaReadyPromise = null;

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const getEmptyLocalStore = () => ({
  version: LOCAL_STORE_VERSION,
  reviews: [],
});

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }

  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const assertStorageIsAvailable = () => {
  if (getStorageMode() === "disabled") {
    throw buildHttpError(
      503,
      "DATABASE_URL ainda nao foi configurada. O modulo de avaliacoes precisa de armazenamento persistente.",
      "review_storage_unavailable"
    );
  }
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureReviewSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS customer_reviews (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        customer_name TEXT NOT NULL,
        customer_contact TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL DEFAULT '',
        customer_email TEXT NOT NULL DEFAULT '',
        customer_key TEXT NOT NULL DEFAULT '',
        profile_id TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL,
        message TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'site',
        visibility_state TEXT NOT NULL DEFAULT 'automatic',
        publish_until TIMESTAMPTZ NOT NULL,
        hidden_at TIMESTAMPTZ,
        hidden_by_login TEXT NOT NULL DEFAULT '',
        hidden_by_display_name TEXT NOT NULL DEFAULT '',
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customer_reviews_created_at_idx
      ON customer_reviews (created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customer_reviews_visibility_idx
      ON customer_reviews (visibility_state, publish_until DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customer_reviews_rating_idx
      ON customer_reviews (rating, created_at DESC)
    `;

    await sql`
      ALTER TABLE customer_reviews
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE customer_reviews
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE customer_reviews
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customer_reviews_restaurant_key_created_at_idx
      ON customer_reviews (restaurant_key, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customer_reviews_tenant_restaurant_created_at_idx
      ON customer_reviews (tenant_id, restaurant_id, created_at DESC)
    `;
  })();

  return schemaReadyPromise;
};

const ensureFileStore = async () => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });

  try {
    await fs.access(LOCAL_STORAGE_FILE);
  } catch (error) {
    await fs.writeFile(
      LOCAL_STORAGE_FILE,
      JSON.stringify(getEmptyLocalStore(), null, 2)
    );
  }
};

const readFileStore = async () => {
  await ensureFileStore();
  const contents = await fs.readFile(LOCAL_STORAGE_FILE, "utf8");

  try {
    const parsed = JSON.parse(contents);
    return {
      version: Number(parsed?.version || LOCAL_STORE_VERSION),
      reviews: Array.isArray(parsed?.reviews) ? parsed.reviews : [],
    };
  } catch (error) {
    return getEmptyLocalStore();
  }
};

const writeFileStore = async (store) => {
  await fs.writeFile(
    LOCAL_STORAGE_FILE,
    JSON.stringify(
      {
        ...getEmptyLocalStore(),
        ...(store && typeof store === "object" ? store : {}),
        reviews: Array.isArray(store?.reviews) ? store.reviews : [],
      },
      null,
      2
    )
  );
};

const normalizeText = (value, maxLength = 200) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeMessage = (value, maxLength = MAX_MESSAGE_LENGTH) =>
  String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxLength);

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, MAX_CONTACT_LENGTH);

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(0, 20);

const normalizeRating = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(1, Math.min(5, Math.round(numericValue)));
};

const normalizeVisibilityState = (value) => {
  const normalizedValue = normalizeText(value, MAX_VISIBILITY_STATE_LENGTH).toLowerCase();
  return normalizedValue === "hidden" ? "hidden" : "automatic";
};

const normalizeDateTimeValue = (value) => {
  const normalizedValue = normalizeText(value, 80);

  if (!normalizedValue) {
    return "";
  }

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString();
};

const normalizeMetadata = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return cloneJson(value);
};

const formatPublicationWeeksLabel = (weeks) => `${weeks} semana${weeks === 1 ? "" : "s"}`;

const formatReviewCountLabel = (count) =>
  `Baseado em ${count} avaliac${count === 1 ? "ao" : "oes"} recentes`;

const formatPublicReviewCountLabel = (count) =>
  `${count} avaliac${count === 1 ? "ao publicada" : "oes publicadas"}`;

const formatShortDuration = (valueMs) => {
  const numericValue = Number(valueMs || 0);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "encerrando agora";
  }

  const totalHours = Math.ceil(numericValue / (60 * 60 * 1000));

  if (totalHours < 24) {
    return `${totalHours}h`;
  }

  const totalDays = Math.ceil(totalHours / 24);
  return `${totalDays} dia${totalDays === 1 ? "" : "s"}`;
};

const getReviewPublicationWeeks = (rating) => PUBLICATION_WEEKS_BY_RATING[normalizeRating(rating)] || 1;

const buildPublishUntil = (createdAt, rating) => {
  const publicationWeeks = getReviewPublicationWeeks(rating);
  const startedAt = new Date(createdAt);

  if (Number.isNaN(startedAt.getTime())) {
    return "";
  }

  return new Date(
    startedAt.getTime() + publicationWeeks * 7 * 24 * 60 * 60 * 1000
  ).toISOString();
};

const normalizeReviewRecord = (record) => ({
  id: normalizeText(record?.id, 120),
  tenantId: normalizeText(record?.tenantId || record?.tenant_id, 120) || "tenant_default",
  restaurantId: normalizeText(record?.restaurantId || record?.restaurant_id, 120) || "restaurant_default",
  restaurantKey: normalizeText(record?.restaurantKey || record?.restaurant_key, 120) || "default",
  customerName: normalizeText(record?.customerName || record?.customer_name, MAX_NAME_LENGTH),
  customerContact: normalizeText(
    record?.customerContact || record?.customer_contact,
    MAX_CONTACT_LENGTH
  ),
  customerPhone: normalizePhone(record?.customerPhone || record?.customer_phone),
  customerEmail: normalizeEmail(record?.customerEmail || record?.customer_email),
  customerKey: normalizeText(record?.customerKey || record?.customer_key, 160),
  profileId: normalizeText(record?.profileId || record?.profile_id, 120),
  rating: normalizeRating(record?.rating),
  message: normalizeMessage(record?.message),
  source: normalizeText(record?.source, MAX_SOURCE_LENGTH) || "site",
  visibilityState: normalizeVisibilityState(
    record?.visibilityState || record?.visibility_state
  ),
  publishUntil: normalizeDateTimeValue(record?.publishUntil || record?.publish_until),
  hiddenAt: normalizeDateTimeValue(record?.hiddenAt || record?.hidden_at),
  hiddenByLogin: normalizeText(record?.hiddenByLogin || record?.hidden_by_login, 120),
  hiddenByDisplayName: normalizeText(
    record?.hiddenByDisplayName || record?.hidden_by_display_name,
    160
  ),
  metadata: normalizeMetadata(record?.metadata || record?.metadata_json),
  createdAt: normalizeDateTimeValue(record?.createdAt || record?.created_at),
  updatedAt: normalizeDateTimeValue(record?.updatedAt || record?.updated_at),
});

const getReviewStatus = (review, nowTimestamp = Date.now()) => {
  if (!review || normalizeVisibilityState(review.visibilityState) === "hidden") {
    return "hidden";
  }

  const publishUntilTimestamp = new Date(review.publishUntil || 0).getTime();

  if (Number.isFinite(publishUntilTimestamp) && publishUntilTimestamp < nowTimestamp) {
    return "expired";
  }

  return "published";
};

const isRecentReview = (review, nowTimestamp = Date.now()) => {
  const createdAtTimestamp = new Date(review?.createdAt || 0).getTime();

  if (!Number.isFinite(createdAtTimestamp) || createdAtTimestamp <= 0) {
    return false;
  }

  return createdAtTimestamp >= nowTimestamp - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

const decorateReviewRecord = (review, nowTimestamp = Date.now()) => {
  const normalizedReview = normalizeReviewRecord(review);
  const status = getReviewStatus(normalizedReview, nowTimestamp);
  const publicationWeeks = getReviewPublicationWeeks(normalizedReview.rating);
  const publishUntilTimestamp = new Date(normalizedReview.publishUntil || 0).getTime();
  const remainingMs =
    Number.isFinite(publishUntilTimestamp) && publishUntilTimestamp > nowTimestamp
      ? publishUntilTimestamp - nowTimestamp
      : 0;

  return {
    ...normalizedReview,
    status,
    statusLabel:
      status === "published" ? "Publicada" : status === "hidden" ? "Oculta" : "Encerrada",
    publicationWeeks,
    publicationLabel: formatPublicationWeeksLabel(publicationWeeks),
    isRecent: isRecentReview(normalizedReview, nowTimestamp),
    isVisibleNow: status === "published",
    remainingLabel:
      status === "published"
        ? `Visivel por mais ${formatShortDuration(remainingMs)}`
        : status === "hidden"
          ? "Oculta manualmente no admin"
          : "Janela automatica encerrada",
  };
};

const sortReviewsByCreatedAtDesc = (reviews = []) =>
  reviews
    .slice()
    .sort(
      (left, right) =>
        new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime()
    );

const formatAverageValue = (value) => Number(value || 0).toFixed(1);

const buildPublicSummary = (reviews = [], nowTimestamp = Date.now()) => {
  const decoratedReviews = sortReviewsByCreatedAtDesc(reviews).map((review) =>
    decorateReviewRecord(review, nowTimestamp)
  );
  const publishedReviews = decoratedReviews.filter((review) => review.status === "published");
  const recentReviews = publishedReviews.filter((review) => review.isRecent);
  const averageReviews = recentReviews.length ? recentReviews : publishedReviews;
  const internalAverage = averageReviews.length
    ? averageReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
      averageReviews.length
    : 0;
  const displayAverage = averageReviews.length
    ? Math.max(REVIEW_VISUAL_MINIMUM_AVERAGE, internalAverage)
    : 0;

  return {
    internalAverage: Number(formatAverageValue(internalAverage)),
    displayAverage: Number(formatAverageValue(displayAverage)),
    displayAverageLabel: averageReviews.length
      ? `${formatAverageValue(displayAverage)} \u2605`
      : "Sem avaliacoes",
    recentCount: recentReviews.length,
    recentCountLabel: formatReviewCountLabel(recentReviews.length),
    publicReviewCount: publishedReviews.length,
    publicCountLabel: formatPublicReviewCountLabel(publishedReviews.length),
  };
};

const buildAdminSummary = (reviews = [], nowTimestamp = Date.now()) => {
  const decoratedReviews = reviews.map((review) => decorateReviewRecord(review, nowTimestamp));
  const publicSummary = buildPublicSummary(reviews, nowTimestamp);

  return {
    totalReviews: decoratedReviews.length,
    publishedReviews: decoratedReviews.filter((review) => review.status === "published").length,
    hiddenReviews: decoratedReviews.filter((review) => review.status === "hidden").length,
    expiredReviews: decoratedReviews.filter((review) => review.status === "expired").length,
    recentReviews: decoratedReviews.filter((review) => review.isRecent).length,
    internalAverage: publicSummary.internalAverage,
    displayAverage: publicSummary.displayAverage,
  };
};

const collectPublicReviewTargetIds = (value, targetIds = []) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectPublicReviewTargetIds(entry, targetIds));
    return targetIds;
  }

  if (value && typeof value === "object") {
    [
      value.id,
      value.itemId,
      value.item_id,
      value.menuItemId,
      value.menu_item_id,
      value.productId,
      value.product_id,
    ].forEach((entry) => collectPublicReviewTargetIds(entry, targetIds));
    return targetIds;
  }

  const normalizedId = normalizeText(value, 120);

  if (normalizedId) {
    targetIds.push(normalizedId);
  }

  return targetIds;
};

const normalizePublicReviewTarget = (metadata = {}) => {
  const source = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const itemIds = [
    ...new Set(
      [
        source.itemId,
        source.item_id,
        source.menuItemId,
        source.menu_item_id,
        source.productId,
        source.product_id,
        source.itemIds,
        source.item_ids,
        source.menuItemIds,
        source.menu_item_ids,
        source.items,
        source.products,
      ].flatMap((value) => collectPublicReviewTargetIds(value))
    ),
  ].slice(0, 8);

  return {
    itemId: itemIds[0] || "",
    itemIds,
    itemName: normalizeText(
      source.itemName || source.item_name || source.menuItemName || source.productName,
      160
    ),
    category: normalizeText(source.category || source.categoryName || source.category_name, 160),
  };
};

const serializePublicReview = (review) => ({
  id: review.id,
  name: review.customerName,
  rating: review.rating,
  message: review.message,
  createdAt: review.createdAt,
  target: normalizePublicReviewTarget(review.metadata || {}),
});

const serializeAdminReview = (review) => ({
  ...review,
  metadata: cloneJson(review.metadata || {}),
});

const listReviewsFromFileStore = async (tenant) => {
  const store = await readFileStore();
  return sortReviewsByCreatedAtDesc(
    (Array.isArray(store.reviews) ? store.reviews : [])
      .filter((entry) => matchesTenantScope(entry, tenant))
      .map(normalizeReviewRecord)
  );
};

const listReviewsFromNeon = async (tenant) => {
  await ensureReviewSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      customer_name,
      customer_contact,
      customer_phone,
      customer_email,
      customer_key,
      profile_id,
      rating,
      message,
      source,
      visibility_state,
      publish_until,
      hidden_at,
      hidden_by_login,
      hidden_by_display_name,
      metadata_json,
      created_at,
      updated_at
    FROM customer_reviews
    WHERE restaurant_key = ${tenant.restaurantKey}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
    ORDER BY created_at DESC
  `;

  return rows.map(normalizeReviewRecord);
};

const listStoredReviews = async (tenant) => {
  assertStorageIsAvailable();
  return getStorageMode() === "neon" ? listReviewsFromNeon(tenant) : listReviewsFromFileStore(tenant);
};

const normalizeCreateReviewPayload = (payload = {}) => {
  const name = normalizeText(payload.name || payload.customerName, MAX_NAME_LENGTH);
  const message = normalizeMessage(payload.message);
  const rating = normalizeRating(payload.rating);
  const contact = normalizeText(payload.contact || payload.customerContact, MAX_CONTACT_LENGTH);
  const profile =
    payload.profile && typeof payload.profile === "object" && !Array.isArray(payload.profile)
      ? payload.profile
      : {};
  const phone = normalizePhone(payload.phone || payload.customerPhone || profile.phone);
  const email = normalizeEmail(payload.email || payload.customerEmail || profile.email);
  const customerKey = normalizeText(payload.customerKey || profile.customerKey, 160);
  const profileId = normalizeText(payload.profileId || profile.id, 120);
  const source = normalizeText(payload.source, MAX_SOURCE_LENGTH) || "site";

  if (!name) {
    throw buildHttpError(400, "Informe o nome da avaliacao.", "invalid_review_name");
  }

  if (!message) {
    throw buildHttpError(400, "Escreva um comentario para enviar a avaliacao.", "invalid_review_message");
  }

  if (rating < 1 || rating > 5) {
    throw buildHttpError(400, "Escolha uma nota valida de 1 a 5 estrelas.", "invalid_review_rating");
  }

  return {
    id: crypto.randomUUID(),
    customerName: name,
    customerContact: contact,
    customerPhone: phone,
    customerEmail: email,
    customerKey,
    profileId,
    rating,
    message,
    source,
    visibilityState: "automatic",
    metadata: normalizeMetadata(payload.metadata),
  };
};

const createReviewInFileStore = async (payload = {}, tenant) => {
  const nextReview = normalizeCreateReviewPayload(payload);
  const now = new Date().toISOString();
  const reviewRecord = {
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    ...nextReview,
    publishUntil: buildPublishUntil(now, nextReview.rating),
    hiddenAt: "",
    hiddenByLogin: "",
    hiddenByDisplayName: "",
    createdAt: now,
    updatedAt: now,
  };
  const store = await readFileStore();
  const reviews = Array.isArray(store.reviews) ? store.reviews.slice() : [];
  reviews.unshift(reviewRecord);

  await writeFileStore({
    ...store,
    version: LOCAL_STORE_VERSION,
    reviews,
  });

  return {
    reviewId: reviewRecord.id,
    generatedAt: now,
    storageMode: "file",
  };
};

const createReviewInNeon = async (payload = {}, tenant) => {
  const nextReview = normalizeCreateReviewPayload(payload);
  const now = new Date().toISOString();
  const publishUntil = buildPublishUntil(now, nextReview.rating);
  await ensureReviewSchema();
  const sql = getSql();

  await sql`
    INSERT INTO customer_reviews (
      id,
      tenant_id,
      restaurant_id,
      restaurant_key,
      customer_name,
      customer_contact,
      customer_phone,
      customer_email,
      customer_key,
      profile_id,
      rating,
      message,
      source,
      visibility_state,
      publish_until,
      hidden_at,
      hidden_by_login,
      hidden_by_display_name,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      ${nextReview.id},
      ${tenant.tenantId},
      ${tenant.restaurantId},
      ${tenant.restaurantKey},
      ${nextReview.customerName},
      ${nextReview.customerContact},
      ${nextReview.customerPhone},
      ${nextReview.customerEmail},
      ${nextReview.customerKey},
      ${nextReview.profileId},
      ${nextReview.rating},
      ${nextReview.message},
      ${nextReview.source},
      ${nextReview.visibilityState},
      ${publishUntil},
      ${null},
      ${""},
      ${""},
      ${JSON.stringify(nextReview.metadata || {})}::jsonb,
      ${now},
      ${now}
    )
  `;

  return {
    reviewId: nextReview.id,
    generatedAt: now,
    storageMode: "neon",
  };
};

const createPublicReview = async (payload = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "reviews:public:create");
  assertStorageIsAvailable();
  const mutation =
    getStorageMode() === "neon"
      ? await createReviewInNeon(payload, tenant)
      : await createReviewInFileStore(payload, tenant);
  const snapshot = await getPublicReviewsSnapshot({ tenantContext: tenant.tenantContext });

  return {
    ...mutation,
    message: "Avaliacao registrada com sucesso no painel do gestor.",
    ...snapshot,
  };
};

const normalizeReviewVisibilityPayload = (payload = {}) => {
  const reviewId = normalizeText(payload.id, 120);
  const visibilityState = normalizeVisibilityState(payload.visibilityState || payload.state);

  if (!reviewId) {
    throw buildHttpError(400, "Informe a avaliacao que deseja atualizar.", "missing_review_id");
  }

  return {
    id: reviewId,
    visibilityState,
  };
};

const updateReviewVisibilityInFileStore = async (payload = {}, actor = {}, tenant) => {
  const mutation = normalizeReviewVisibilityPayload(payload);
  const store = await readFileStore();
  const reviews = Array.isArray(store.reviews) ? store.reviews.slice() : [];
  const reviewIndex = reviews.findIndex(
    (entry) =>
      normalizeText(entry?.id, 120) === mutation.id &&
      matchesTenantScope(entry, tenant)
  );

  if (reviewIndex === -1) {
    throw buildHttpError(404, "Nao encontrei a avaliacao solicitada.", "review_not_found");
  }

  const now = new Date().toISOString();
  const currentReview = normalizeReviewRecord(reviews[reviewIndex]);
  reviews[reviewIndex] = {
    ...currentReview,
    visibilityState: mutation.visibilityState,
    hiddenAt: mutation.visibilityState === "hidden" ? now : "",
    hiddenByLogin:
      mutation.visibilityState === "hidden"
        ? normalizeText(actor.login, 120).toLowerCase()
        : "",
    hiddenByDisplayName:
      mutation.visibilityState === "hidden"
        ? normalizeText(actor.displayName, 160)
        : "",
    updatedAt: now,
  };

  await writeFileStore({
    ...store,
    version: LOCAL_STORE_VERSION,
    reviews,
  });

  return {
    reviewId: mutation.id,
    generatedAt: now,
    storageMode: "file",
    message:
      mutation.visibilityState === "hidden"
        ? "Avaliacao ocultada do site com sucesso."
        : "Avaliacao restaurada para a publicacao automatica.",
  };
};

const updateReviewVisibilityInNeon = async (payload = {}, actor = {}, tenant) => {
  const mutation = normalizeReviewVisibilityPayload(payload);
  await ensureReviewSchema();
  const sql = getSql();
  const now = new Date().toISOString();
  const rows = await sql`
    UPDATE customer_reviews
    SET
      visibility_state = ${mutation.visibilityState},
      hidden_at = ${mutation.visibilityState === "hidden" ? now : null},
      hidden_by_login = ${
        mutation.visibilityState === "hidden"
          ? normalizeText(actor.login, 120).toLowerCase()
          : ""
      },
      hidden_by_display_name = ${
        mutation.visibilityState === "hidden"
          ? normalizeText(actor.displayName, 160)
          : ""
      },
      updated_at = ${now}
    WHERE id = ${mutation.id}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    RETURNING id
  `;

  if (rows.length === 0) {
    throw buildHttpError(404, "Nao encontrei a avaliacao solicitada.", "review_not_found");
  }

  return {
    reviewId: mutation.id,
    generatedAt: now,
    storageMode: "neon",
    message:
      mutation.visibilityState === "hidden"
        ? "Avaliacao ocultada do site com sucesso."
        : "Avaliacao restaurada para a publicacao automatica.",
  };
};

const updateReviewVisibility = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "reviews:admin:update-visibility");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? updateReviewVisibilityInNeon(payload, actor, tenant)
    : updateReviewVisibilityInFileStore(payload, actor, tenant);
};

const deleteReviewInFileStore = async (payload = {}, tenant) => {
  const reviewId = normalizeText(payload.id, 120);
  const store = await readFileStore();
  const reviews = Array.isArray(store.reviews) ? store.reviews : [];
  const nextReviews = reviews.filter(
    (entry) =>
      !(normalizeText(entry?.id, 120) === reviewId && matchesTenantScope(entry, tenant))
  );

  if (nextReviews.length === reviews.length) {
    throw buildHttpError(404, "Nao encontrei a avaliacao solicitada.", "review_not_found");
  }

  await writeFileStore({
    ...store,
    version: LOCAL_STORE_VERSION,
    reviews: nextReviews,
  });

  return {
    reviewId,
    generatedAt: new Date().toISOString(),
    storageMode: "file",
    message: "Avaliacao removida com sucesso.",
  };
};

const deleteReviewInNeon = async (payload = {}, tenant) => {
  const reviewId = normalizeText(payload.id, 120);
  await ensureReviewSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM customer_reviews
    WHERE id = ${reviewId}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    RETURNING id
  `;

  if (rows.length === 0) {
    throw buildHttpError(404, "Nao encontrei a avaliacao solicitada.", "review_not_found");
  }

  return {
    reviewId,
    generatedAt: new Date().toISOString(),
    storageMode: "neon",
    message: "Avaliacao removida com sucesso.",
  };
};

const deleteReview = async (payload = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "reviews:admin:delete");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? deleteReviewInNeon(payload, tenant)
    : deleteReviewInFileStore(payload, tenant);
};

const getPublicReviewsSnapshot = async (options = {}) => {
  const tenant = getOperationalTenant(options, "reviews:public:list");
  const reviews = await listStoredReviews(tenant);
  const summary = buildPublicSummary(reviews);
  const publicReviews = reviews
    .map((review) => decorateReviewRecord(review))
    .filter((review) => review.status === "published")
    .slice(0, 12)
    .map(serializePublicReview);

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    summary,
    reviews: publicReviews,
  };
};

const getAdminReviews = async (options = {}) => {
  const tenant = getOperationalTenant(options, "reviews:admin:list");
  const reviews = await listStoredReviews(tenant);
  const decoratedReviews = reviews.map((review) => decorateReviewRecord(review));

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    filters: {
      status: "",
      rating: "",
    },
    summary: buildAdminSummary(reviews),
    reviews: decoratedReviews.map(serializeAdminReview),
  };
};

module.exports = {
  RECENT_WINDOW_DAYS,
  REVIEW_VISUAL_MINIMUM_AVERAGE,
  createPublicReview,
  deleteReview,
  getAdminReviews,
  getPublicReviewsSnapshot,
  updateReviewVisibility,
};
