"use strict";

// E-mails do login do cliente (hoje só "esqueci minha senha").
//
// Produção/Preview: Resend (API HTTPS, plano gratuito). Chaves em variáveis de
// ambiente cadastradas pelo Paulo: RESEND_API_KEY e CUSTOMER_AUTH_EMAIL_FROM.
// Testes locais (fora de produção, sem chave): grava numa "caixa de saída" em
// arquivo para o teste ler o link. Nunca escreve o link ou o token em log.

const fs = require("node:fs/promises");
const path = require("node:path");

const RESEND_URL = "https://api.resend.com/emails";

const outboxFile = () =>
  String(process.env.INOVAS_CUSTOMER_OUTBOX_FILE || "").trim() ||
  path.join(process.cwd(), ".data", "customer-outbox.json");

const isProduction = () => String(process.env.NODE_ENV || "").trim() === "production";

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const writeOutbox = async (message) => {
  let messages = [];
  try {
    messages = JSON.parse(await fs.readFile(outboxFile(), "utf8")).messages || [];
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  messages.push({ ...message, sentAt: new Date().toISOString() });
  await fs.mkdir(path.dirname(outboxFile()), { recursive: true });
  await fs.writeFile(outboxFile(), `${JSON.stringify({ messages: messages.slice(-200) }, null, 2)}\n`, "utf8");
};

const sendEmail = async ({ to, subject, html, text, kind }) => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.CUSTOMER_AUTH_EMAIL_FROM || "").trim();
  if (!apiKey || !from) {
    if (isProduction()) {
      // Falha silenciosa para quem pediu (não revela nada); o servidor registra só o tipo.
      console.error("[customer-mailer] e-mail nao configurado", { kind });
      return { sent: false };
    }
    await writeOutbox({ to, subject, text, kind });
    return { sent: true, mode: "outbox" };
  }
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!response.ok) {
    console.error("[customer-mailer] falha no envio", { kind, status: response.status });
    return { sent: false };
  }
  return { sent: true, mode: "resend" };
};

const sendPasswordResetEmail = ({ to, name, url, minutes }) => {
  const firstName = String(name || "").trim().split(/\s+/)[0] || "";
  const text = [
    `Olá${firstName ? `, ${firstName}` : ""}!`,
    "",
    "Recebemos um pedido para criar uma nova senha na sua conta de pedidos.",
    `Use o link abaixo (vale por ${minutes} minutos e só funciona uma vez):`,
    url,
    "",
    "Se não foi você, ignore este e-mail: sua senha continua a mesma.",
    "",
    "INOVAS Food",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1b1b1f">
<p>Olá${firstName ? `, ${escapeHtml(firstName)}` : ""}!</p>
<p>Recebemos um pedido para criar uma nova senha na sua conta de pedidos.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#e4560f;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
<p style="color:#555">O link vale por ${minutes} minutos e só funciona uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
<p style="color:#888">INOVAS Food</p></div>`;
  return sendEmail({ to, subject: "Crie uma nova senha", html, text, kind: "password_reset" });
};

module.exports = { outboxFile, sendPasswordResetEmail };
