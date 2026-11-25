"use strict";

// Entrega: busca de CEP e localização do endereço feitas no SERVIDOR.
// - O navegador não fala com ViaCEP nem com o Google (a CSP do site bloqueia e
//   a chave do Google nunca vai para o site).
// - CEP: ViaCEP, com BrasilAPI de reserva.
// - Localização: Google Geocoding com GOOGLE_MAPS_API_KEY (chave só de servidor).
// - Cache em memória e limite por IP para não gastar a cota à toa.
// - INOVAS_DELIVERY_GEO_PROVIDER=fake (só fora de produção) responde sem internet, para testes.
const { buildHttpError } = require("./http.cjs");

const LOOKUP_TIMEOUT_MS = 6000;
const CACHE_LIMIT = 800;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 60;

const cepCache = new Map();
const geoCache = new Map();
const rateBuckets = new Map();

const remember = (cache, key, value) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
};

const isFakeProvider = () =>
  String(process.env.INOVAS_DELIVERY_GEO_PROVIDER || "").trim().toLowerCase() === "fake" &&
  process.env.NODE_ENV !== "production";

const assertRateLimit = (ip) => {
  const key = String(ip || "unknown");
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    if (rateBuckets.size > 5000) rateBuckets.clear();
    rateBuckets.set(key, { start: now, count: 1 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT) {
    throw buildHttpError(429, "Muitas consultas de endereço. Espere alguns minutos e tente de novo.", "delivery_geo_rate_limited");
  }
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const normalizeCep = (value) => String(value || "").replace(/\D/g, "").slice(0, 8);

const FAKE_CEPS = Object.freeze({
  "14400520": { street: "Rua General Osório", neighborhood: "Centro", city: "Franca", state: "SP" },
  "14401000": { street: "Avenida Teste", neighborhood: "Cidade Nova", city: "Franca", state: "SP" },
});

const lookupCep = async (rawCep) => {
  const cep = normalizeCep(rawCep);
  if (cep.length !== 8) throw buildHttpError(400, "Informe um CEP com 8 números.", "delivery_cep_invalid");
  if (cepCache.has(cep)) return cepCache.get(cep);

  if (isFakeProvider()) {
    const fake = FAKE_CEPS[cep];
    if (!fake) throw buildHttpError(404, "Não achamos esse CEP. Confira os números.", "delivery_cep_not_found");
    return remember(cepCache, cep, { cep, ...fake });
  }

  try {
    const data = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
    if (data && !data.erro) {
      return remember(cepCache, cep, {
        cep,
        street: String(data.logradouro || ""),
        neighborhood: String(data.bairro || ""),
        city: String(data.localidade || ""),
        state: String(data.uf || ""),
      });
    }
    if (data && data.erro) throw buildHttpError(404, "Não achamos esse CEP. Confira os números.", "delivery_cep_not_found");
  } catch (error) {
    if (error.statusCode === 404) throw error;
  }

  // Reserva: BrasilAPI.
  try {
    const data = await fetchJson(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    return remember(cepCache, cep, {
      cep,
      street: String(data.street || ""),
      neighborhood: String(data.neighborhood || ""),
      city: String(data.city || ""),
      state: String(data.state || ""),
    });
  } catch (error) {
    if (error.status === 404) throw buildHttpError(404, "Não achamos esse CEP. Confira os números.", "delivery_cep_not_found");
    throw buildHttpError(503, "A busca de CEP está fora do ar agora. Digite a rua e o bairro.", "delivery_cep_unavailable");
  }
};

const getMapsKey = () => String(process.env.GOOGLE_MAPS_API_KEY || "").trim();

const geocodeAddress = async (rawAddress) => {
  const address = String(rawAddress || "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (address.length < 8) throw buildHttpError(400, "Informe o endereço completo.", "delivery_address_invalid");
  const key = address.toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key);

  if (isFakeProvider()) {
    // Determinístico: o número da casa afasta o ponto do centro de Franca.
    const number = Number((address.match(/,\s*(\d+)/) || [])[1] || 100);
    return remember(geoCache, key, {
      lat: -20.5386 + number / 100000,
      lng: -47.4009 + number / 100000,
      formattedAddress: address,
      partialMatch: false,
    });
  }

  const apiKey = getMapsKey();
  if (!apiKey) {
    throw buildHttpError(503, "O cálculo automático da entrega ainda não está configurado.", "delivery_geocode_not_configured");
  }
  const params = new URLSearchParams({ address, region: "br", language: "pt-BR", components: "country:BR", key: apiKey });
  let data;
  try {
    data = await fetchJson(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  } catch (error) {
    throw buildHttpError(503, "Não foi possível localizar o endereço agora. Tente de novo.", "delivery_geocode_unavailable");
  }
  if (data.status === "ZERO_RESULTS") {
    throw buildHttpError(404, "Não encontramos esse endereço no mapa. Confira o número e a rua.", "delivery_geocode_not_found");
  }
  if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) {
    throw buildHttpError(503, "Não foi possível localizar o endereço agora. Tente de novo.", "delivery_geocode_unavailable");
  }
  const result = data.results[0];
  return remember(geoCache, key, {
    lat: Number(result.geometry.location.lat),
    lng: Number(result.geometry.location.lng),
    formattedAddress: String(result.formatted_address || address),
    partialMatch: Boolean(result.partial_match),
  });
};

const resetDeliveryGeoForTests = () => {
  cepCache.clear();
  geoCache.clear();
  rateBuckets.clear();
};

module.exports = { assertRateLimit, geocodeAddress, lookupCep, normalizeCep, resetDeliveryGeoForTests };
