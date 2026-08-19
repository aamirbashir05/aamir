# 🎬 Drama Studio — Veo Copilot (Chrome extension)

Ek Chrome/Edge extension jo aapke Khaleeji-drama shorts ka kaam ek jagah le aata hai:

1. **Story + 6-scene prompts** — side panel mein hi banao (free Gemini key se), **ya** apne
   **Claude** chat se ek button pe utha lo.
2. **Veo / Flow pe chalao** — har scene ka prompt khud page ke prompt-box mein daal kar
   **Generate** dabata hai, ban-ne ka intezaar karta hai, phir **Download** dabata hai.

> Story wala hissa **solid** hai. Veo wala hissa **best-effort / experimental** hai — neeche
> "Sach-sach" padho.

---

## Install (1 baar, PC pe)

1. Is `extension/` folder ko apne PC pe rakho (download / clone).
2. Chrome mein `chrome://extensions` kholo.
3. Upar dayein **Developer mode** ON karo.
4. **Load unpacked** dabao → yeh `extension/` folder chuno.
5. Toolbar mein 🎬 icon aa jayega → dabao → **side panel** khulega.
   (Icon na dikhe to puzzle-piece 🧩 se pin kar lo.)

Edge mein bhi same: `edge://extensions` → Developer mode → Load unpacked.

---

## Use

### A) Story banao
- **Setup** mein free Gemini key daalo (https://aistudio.google.com/apikey) → **Generate**.
  Poore scenes + image/video prompts panel ki queue mein aa jayenge.
- **Ya Claude se:** `claude.ai` pe apni story banwao (aapka wahi purana system-prompt),
  phir panel mein **“⬇ Claude tab se lao”** — aakhri jawab se prompts nikaal leta hai.
  (Best-effort — agar (A)/(B) label saaf hon to theek pehchaanta hai.)

### B) Veo pe chalao
1. Ek tab mein apna **Veo / Flow** (labs.google / gemini / flow) khol lo, login rakho.
2. Panel ke **🚀 Veo pe chalao** mein wo tab chuno (**↻** refresh).
3. **🔎 Test** dabao — "prompt box mil gaya" aaye to ready.
4. **▶ Sab IMAGE prompts** ya per-scene **▶ image / ▶ video** dabao.

---

## ⚠️ Sach-sach (honest limits)

- Yeh aapke **apne** Veo account ki website ko automate karta hai. Google ki terms
  automated use ko allow nahi karti — **thoda account-risk hai**. Apni marzi se use karo.
- **Sirf PC/desktop** (Chrome/Edge). Phone pe extensions nahi chalti.
- Google apni UI badalta rehta hai. Extension **smart-guess** se prompt-box aur buttons
  dhoondta hai; agar na mile to **🛠 Selectors** card mein CSS selector daal do
  (Veo page pe right-click → Inspect se milta hai).
- Video ban-ne mein **minutes** lagte hain — "Har video wait (sec)" theek set karo.
- **Image → Video** wala step (image ko first-frame bana kar animate karna) Veo ki UI pe
  aksar ek **manual click** maangta hai. Extension prompt fill + Generate + Download to
  kar deta hai, par is beech ki "image attach" cheez UI-specific hai — **Log dekhte raho**
  aur zaroorat pe khud ek click laga do.
- Kuch nahi chhupata / koi detection-evasion nahi — yeh bas wahi clicks karta hai jo aap
  haath se karte.

## Privacy
Aapki API key, story aur settings sirf browser ke local storage mein rehti hain
(`chrome.storage.local`). Koi server, koi account nahi.

## Files
- `manifest.json` — MV3 config (side panel + scripting + downloads)
- `panel.html/.css/.js` — side panel UI + saari logic
- `veo-agent.js` — Veo/Flow page pe inject hone wali best-effort automation
- `claude-agent.js` — claude.ai ke aakhri jawab se prompts uthata hai
- `background.js` — icon click pe side panel kholta hai
