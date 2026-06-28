import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { buildWhatsappMessagesUrl } = require("../lib/whatsapp-cloud.cjs");
const { sendWhatsappVerificationCode } = require("../lib/customer-verification.cjs");
const sendWhatsappCodeHandler = require("../api/auth/send-whatsapp-code.js");

const originalFetch = global.fetch;
const trackedEnvKeys = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TEMPLATE_NAME",
  "WHATSAPP_VERIFY_TEMPLATE_LANGUAGE",
  "WHATSAPP_GRAPH_API_VERSION",
];

const withEnv = async (overrides, callback) => {
  const previousValues = Object.fromEntries(
    trackedEnvKeys.map((key) => [key, process.env[key]])
  );

  trackedEnvKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const value = overrides[key];

      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  try {
    return await callback();
  } finally {
    trackedEnvKeys.forEach((key) => {
      const previousValue = previousValues[key];

      if (typeof previousValue === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    });
  }
};

const createMockResponse = ({ status = 200, body = {} } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  async text() {
    return typeof body === "string" ? body : JSON.stringify(body);
  },
});

const createMockApiResponse = () => {
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

const run = async () => {
  assert.equal(
    buildWhatsappMessagesUrl({
      graphApiVersion: " /v23.0/ ",
      phoneNumberId: " 1234567890/ ",
    }),
    "https://graph.facebook.com/v23.0/1234567890/messages",
    "A URL do endpoint do WhatsApp deve seguir o formato oficial /{version}/{phoneNumberId}/messages."
  );

  await withEnv(
    {
      WHATSAPP_ACCESS_TOKEN: " token-com-espacos \n",
      WHATSAPP_PHONE_NUMBER_ID: " 9876543210 \n",
      WHATSAPP_VERIFY_TEMPLATE_NAME: " tokyo_verify_code \n",
      WHATSAPP_VERIFY_TEMPLATE_LANGUAGE: " pt_BR \n",
      WHATSAPP_GRAPH_API_VERSION: " v23.0 \n",
    },
    async () => {
      let capturedRequest = null;

      global.fetch = async (url, options) => {
        capturedRequest = {
          url,
          options,
        };

        return createMockResponse({
          status: 200,
          body: {
            messages: [
              {
                id: "wamid.success",
              },
            ],
          },
        });
      };

      const result = await sendWhatsappVerificationCode({
        name: "Cliente Tokyo",
        phone: "(11) 98888-1101",
        code: "123456",
      });

      assert.equal(result.ok, true, "O envio do codigo deve responder com sucesso.");
      assert.equal(result.messageId, "wamid.success", "O ID retornado pelo provider deve ser preservado.");
      assert.equal(
        capturedRequest.url,
        "https://graph.facebook.com/v23.0/9876543210/messages",
        "O endpoint do provider deve usar a versao e o phoneNumberId normalizados."
      );

      const requestBody = JSON.parse(capturedRequest.options.body);
      assert.equal(requestBody.messaging_product, "whatsapp");
      assert.equal(requestBody.type, "template");
      assert.equal(requestBody.to, "5511988881101");
      assert.equal(requestBody.template.name, "tokyo_verify_code");
      assert.equal(requestBody.template.language.code, "pt_BR");
      assert.equal(requestBody.template.components[0].parameters[0].text, "123456");
      assert.equal(
        capturedRequest.options.headers.Authorization,
        "Bearer token-com-espacos",
        "O access token deve ser usado sem espacos residuais."
      );
    }
  );

  await withEnv(
    {
      WHATSAPP_ACCESS_TOKEN: "token-provider-error",
      WHATSAPP_PHONE_NUMBER_ID: "222333444",
      WHATSAPP_VERIFY_TEMPLATE_NAME: "template-provider-error",
    },
    async () => {
      global.fetch = async () =>
        createMockResponse({
          status: 400,
          body: {
            error: {
              message: "Template name does not exist in the translation",
              code: 132001,
              type: "OAuthException",
            },
          },
        });

      await assert.rejects(
        () =>
          sendWhatsappVerificationCode({
            name: "Cliente Erro",
            phone: "(11) 97777-2202",
            code: "654321",
          }),
        (error) =>
          error?.statusCode === 502 &&
          error?.errorCode === "whatsapp_provider_error" &&
          /Template name does not exist/i.test(String(error?.message || "")),
        "Erros do provider precisam voltar como whatsapp_provider_error com a mensagem original."
      );
    }
  );

  await withEnv(
    {
      WHATSAPP_ACCESS_TOKEN: "token-network-error",
      WHATSAPP_PHONE_NUMBER_ID: "555666777",
      WHATSAPP_VERIFY_TEMPLATE_NAME: "template-network-error",
    },
    async () => {
      global.fetch = async () => {
        throw new TypeError("fetch failed");
      };

      await assert.rejects(
        () =>
          sendWhatsappVerificationCode({
            name: "Cliente Rede",
            phone: "(11) 96666-3311",
            code: "111222",
          }),
        (error) =>
          error?.statusCode === 502 &&
          error?.errorCode === "whatsapp_request_failed" &&
          /API do WhatsApp|conectar/i.test(String(error?.message || "")),
        "Falhas de rede precisam retornar whatsapp_request_failed."
      );
    }
  );

  await withEnv(
    {
      WHATSAPP_ACCESS_TOKEN: " token-handler \n",
      WHATSAPP_PHONE_NUMBER_ID: " 123123123 ",
      WHATSAPP_VERIFY_TEMPLATE_NAME: " verify_handler ",
      WHATSAPP_VERIFY_TEMPLATE_LANGUAGE: " pt_BR ",
      WHATSAPP_GRAPH_API_VERSION: " v23.0 ",
    },
    async () => {
      global.fetch = async () =>
        createMockResponse({
          status: 200,
          body: {
            messages: [
              {
                id: "wamid.handler",
              },
            ],
          },
        });

      const req = {
        method: "POST",
        body: JSON.stringify({
          name: "Cliente Handler",
          phone: "(11) 95555-4400",
          code: "098765",
        }),
        headers: {
          "content-type": "application/json",
        },
      };
      const res = createMockApiResponse();

      await sendWhatsappCodeHandler(req, res);

      assert.equal(res.statusCode, 200, "O endpoint legado de envio deve continuar funcionando.");
      assert.equal(res.payload?.ok, true);
      assert.equal(res.payload?.messageId, "wamid.handler");
    }
  );

  global.fetch = originalFetch;
  console.log("Integracao do WhatsApp validada com sucesso.");
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
  });
