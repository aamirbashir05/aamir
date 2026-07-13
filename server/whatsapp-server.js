/*
 * whatsapp-server.js — OPTIONAL backend for FULL-AUTO WhatsApp sending.
 *
 * Sirf tab chahiye jab aap chahein ke message BINA tap ke khud chala jaye.
 * Ye WhatsApp Business Cloud API (Meta) use karta hai.
 *
 * Zaruriyat:
 *   1. Meta Business account + WhatsApp Business API number
 *      (https://developers.facebook.com -> WhatsApp)
 *   2. WHATSAPP_TOKEN         = permanent/temporary access token
 *   3. WHATSAPP_PHONE_ID      = "Phone number ID" (Meta dashboard se)
 *
 * Chalayein (Node 18+):
 *   WHATSAPP_TOKEN=xxx WHATSAPP_PHONE_ID=123456 node server/whatsapp-server.js
 *
 * Phir app ki Settings -> "Full-Auto Backend URL" me is server ka pata dalein,
 * misaal:  https://aap-ka-server.com/send
 *
 * NOTE (Meta ka usool): agar customer ne aap ko pehle message nahi kiya (24-ghante
 * ke andar), to free-form text allowed nahi — us surat me Meta se APPROVED
 * "utility template" bhejna parta hai. Neeche sendText session-window ke liye
 * hai; template ke liye sendTemplate() ko adapt karein.
 */

const http = require('http');

const TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const PORT = process.env.PORT || 8787;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function sendText(to, body) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: true, body }
    })
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && req.url === '/send') {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', async () => {
      try {
        const { to, message } = JSON.parse(raw || '{}');
        if (!to || !message) { res.writeHead(400); return res.end(JSON.stringify({ error: 'to+message chahiye' })); }
        if (!TOKEN || !PHONE_ID) { res.writeHead(500); return res.end(JSON.stringify({ error: 'WHATSAPP_TOKEN / WHATSAPP_PHONE_ID set nahi' })); }
        const result = await sendText(to, message);
        res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`WhatsApp server ready on :${PORT}  (POST /send)`));
