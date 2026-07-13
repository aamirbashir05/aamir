# Full-Auto WhatsApp Server (Optional)

Ye server sirf tab chahiye jab aap chahein ke customer ko WhatsApp message
**bina tap ke, bilkul khud** chala jaye. Default app **1-tap** wala tareeqa
use karti hai (WhatsApp khud khulta hai, aap send dabate hain) — us ke liye
ye server ki zarurat **nahi**.

## Kab ye use karein?

- Aap ke paas alag **WhatsApp Business API number** ho (zaati WhatsApp se alag)
- Aap thora technical setup aur (zyada messages par) **per-message kharcha**
  bardasht kar sakein

## Setup (short)

1. **Meta Developer account** banayein → https://developers.facebook.com
2. Ek App banayein → **WhatsApp** product add karein
3. Wahan se le lein:
   - **Access Token** (`WHATSAPP_TOKEN`)
   - **Phone number ID** (`WHATSAPP_PHONE_ID`)
4. Server chalayein (Node 18+):

   ```bash
   WHATSAPP_TOKEN=EAAG... WHATSAPP_PHONE_ID=123456789 node whatsapp-server.js
   ```

5. Server ko internet par host karein (Render, Railway, Fly.io, apna VPS, etc.)
   taake usay ek public URL mile, misaal: `https://myshop-wa.onrender.com`
6. App → **Settings → Full-Auto Backend URL** me dalein:
   `https://myshop-wa.onrender.com/send`

Bas — ab har entry par message khud chala jayega. Agar server na chale ya
error de, to app khud **1-tap** wale tareeqe par wapas aa jayegi.

## Zaroori baat — Meta ka 24-ghante ka usool

WhatsApp business rules ke mutabiq: agar customer ne aap ko pehle
(pichhle 24 ghante me) message **nahi** kiya, to aap free-form text **nahi**
bhej sakte — us surat me Meta se **approved "utility template"** bhejna
zaroori hai. Ye server abhi simple **text** bhejta hai (jo customer-service
window ke andar kaam karta hai). Cold messages ke liye `sendText` ki jagah
template-send add karna hoga (Meta docs: *Message Templates*).

## Test (local)

```bash
# ek terminal me server chalayein, doosre me:
curl -X POST http://localhost:8787/send \
  -H 'Content-Type: application/json' \
  -d '{"to":"923001234567","message":"Test hisaab message"}'
```
