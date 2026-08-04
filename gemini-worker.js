/**
 * AlTariq — Gemini Enhance Worker (Cloudflare Worker)
 * ---------------------------------------------------
 * Ye chhota sa "proxy" aapki free Gemini API key ko safe rakhta hai aur
 * studio.html (Background Remover) ke liye image enhance karta hai.
 *
 * DEPLOY (free):
 *   1. https://dash.cloudflare.com  ->  Workers & Pages  ->  Create Worker
 *   2. Is poori file ka code paste karein  ->  Deploy
 *   3. Worker ke Settings -> Variables -> "GEMINI_API_KEY" naam se apni free
 *      key add karein (https://aistudio.google.com/app/apikey se milegi)
 *   4. Worker ka URL copy karke tool ke "AI setup" me paste kar dein
 *
 * Free tier: bina credit card, ~500 images/din tak.
 */

// Gemini image model (Nano Banana). Agar "model not found" error aaye to
// niche wala naam "gemini-2.5-flash-image-preview" kar ke dekhein.
const MODEL = "gemini-2.5-flash-image";

// Default enhance instruction (frontend apna prompt bhej sakta hai).
const DEFAULT_PROMPT =
  "Enhance and restore this product photo into a sharp, high-resolution, " +
  "professional studio product photograph. Keep the product exactly the same — " +
  "identical shape, colours, text, logos and hardware. Clean, evenly lit, on a " +
  "pure white seamless studio background. Ultra sharp, fine detail, no blur, no " +
  "noise, e-commerce catalogue quality.";

// CORS: "*" = kahin se bhi chale (aasaan). Zyada safe ke liye ise apni site kar dein:
//   const ALLOW_ORIGIN = "https://altariqprinters.store";
const ALLOW_ORIGIN = "*";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOW_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return jsonRes({ error: "POST only" }, 405, cors);

    try {
      const { image, mimeType, prompt } = await request.json();
      if (!image) return jsonRes({ error: "no image" }, 400, cors);

      const key = env.GEMINI_API_KEY;
      if (!key)
        return jsonRes({ error: "GEMINI_API_KEY variable set nahi hai" }, 500, cors);

      const base64 = image.includes(",") ? image.split(",")[1] : image;
      const body = {
        contents: [
          {
            parts: [
              { text: prompt || DEFAULT_PROMPT },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } },
            ],
          },
        ],
      };

      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        MODEL +
        ":generateContent?key=" +
        key;

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) return jsonRes({ error: "gemini_error", detail: data }, r.status, cors);

      const parts = (data.candidates && data.candidates[0] &&
        data.candidates[0].content && data.candidates[0].content.parts) || [];
      const imgPart = parts.find((p) => p.inlineData || p.inline_data);
      const inline = imgPart && (imgPart.inlineData || imgPart.inline_data);
      if (!inline)
        return jsonRes({ error: "no_image_in_response", detail: data }, 502, cors);

      const mt = inline.mimeType || inline.mime_type || "image/png";
      return jsonRes({ image: "data:" + mt + ";base64," + inline.data }, 200, cors);
    } catch (e) {
      return jsonRes({ error: String(e) }, 500, cors);
    }
  },
};

function jsonRes(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
