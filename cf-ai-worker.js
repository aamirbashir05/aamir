/**
 * AlTariq — Free AI Enhance Worker (Cloudflare Workers AI)
 * -------------------------------------------------------
 * Ye worker Cloudflare ke apne FREE AI se image enhance karta hai.
 * Koi API key / card nahi chahiye — bas ek "AI" binding chahiye.
 *
 * SETUP (aapka worker already bana hua hai):
 *   1. Worker -> "Bindings" tab -> Add -> "Workers AI" -> Variable name: AI -> Deploy
 *   2. Worker -> "Edit code" -> purana code hata ke ye poora code paste -> Deploy
 *   (Worker ka URL wahi rahega, tool me kuch badalne ki zaroorat nahi.)
 */

// Image-to-image model (input photo ko enhance karta hai, structure rakhta hai).
const MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";

const DEFAULT_PROMPT =
  "sharp high resolution professional studio product photograph, clean even lighting, " +
  "crisp fine detail, ultra sharp, realistic, e-commerce catalogue quality";

const NEGATIVE_PROMPT =
  "blurry, low quality, low resolution, noisy, grainy, distorted, deformed, " +
  "extra objects, extra text, watermark, jpeg artifacts";

// Kitna change kare (0 = bilkul same, 1 = poori nayi). Product same rakhne ke liye kam.
const STRENGTH = 0.4;

const ALLOW_ORIGIN = "*";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOW_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return jsonRes({ error: "POST only" }, 405, cors);

    try {
      if (!env.AI)
        return jsonRes(
          { error: "AI binding missing", detail: "Bindings tab -> Add -> Workers AI -> naam 'AI' -> Deploy" },
          500,
          cors
        );

      const { image, prompt, strength } = await request.json();
      if (!image) return jsonRes({ error: "no image" }, 400, cors);

      // base64 -> bytes
      const b64 = image.includes(",") ? image.split(",")[1] : image;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      const out = await env.AI.run(MODEL, {
        prompt: prompt || DEFAULT_PROMPT,
        negative_prompt: NEGATIVE_PROMPT,
        image: [...bytes],
        strength: typeof strength === "number" ? strength : STRENGTH,
        guidance: 7.5,
        num_steps: 20,
      });

      // Model binary PNG deta hai -> base64 data URL me badlo
      const buf = await new Response(out).arrayBuffer();
      return jsonRes({ image: "data:image/png;base64," + abToB64(buf) }, 200, cors);
    } catch (e) {
      return jsonRes({ error: "cf_ai_error", detail: String((e && e.message) || e) }, 500, cors);
    }
  },
};

function abToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function jsonRes(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
