"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const loadGeo = () => {
  delete require.cache[require.resolve("../../lib/delivery-geo.cjs")];
  return require("../../lib/delivery-geo.cjs");
};

test("CEP inválido é recusado sem consultar nada", async () => {
  const geo = loadGeo();
  await assert.rejects(geo.lookupCep("123"), (error) => error.statusCode === 400);
});

test("provedor de teste devolve o endereço do CEP", async () => {
  process.env.INOVAS_DELIVERY_GEO_PROVIDER = "fake";
  const geo = loadGeo();
  const address = await geo.lookupCep("14400-520");
  assert.equal(address.city, "Franca");
  assert.equal(address.street, "Rua General Osório");
  await assert.rejects(geo.lookupCep("99999999"), (error) => error.statusCode === 404);
  delete process.env.INOVAS_DELIVERY_GEO_PROVIDER;
});

test("sem chave do Google a localização responde 503 (o site usa a taxa provisória)", async () => {
  const previous = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  const geo = loadGeo();
  await assert.rejects(
    geo.geocodeAddress("Rua General Osório, 250, Franca - SP"),
    (error) => error.statusCode === 503 && error.errorCode === "delivery_geocode_not_configured"
  );
  if (previous !== undefined) process.env.GOOGLE_MAPS_API_KEY = previous;
});

test("provedor de teste nunca vale em produção", async () => {
  process.env.INOVAS_DELIVERY_GEO_PROVIDER = "fake";
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const geo = loadGeo();
  await assert.rejects(geo.geocodeAddress("Rua General Osório, 250, Franca - SP"), (error) => error.statusCode === 503);
  process.env.NODE_ENV = previousEnv;
  delete process.env.INOVAS_DELIVERY_GEO_PROVIDER;
});

test("limite de consultas por IP", () => {
  const geo = loadGeo();
  for (let index = 0; index < 60; index += 1) geo.assertRateLimit("1.2.3.4");
  assert.throws(() => geo.assertRateLimit("1.2.3.4"), (error) => error.statusCode === 429);
  geo.assertRateLimit("5.6.7.8");
});
