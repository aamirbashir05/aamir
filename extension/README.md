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
- **Ya paste / .txt:** Claude ke saare prompts copy karke panel ke **“Load prompts”** box
  mein paste karo, ya ek **.txt file** chuno — app khud har scene ka image + video prompt
  tod kar queue bana deti hai. Format: har scene mein `IMAGE PROMPT:` aur `VIDEO PROMPT:`
  labels (aur ho sake to `Scene 1/2…`) hon.

### B2) Export → "VEO Automation" jaisi Flow bulk-extension ke liye (recommended)
Best combo: **prompts mera brain banaye, Flow pe bulk-clicking wo mature extension kare.**
- Panel ke **📤 Export** card se: **image prompts** ka blank-line list (Text-to-Image /
  Nano Banana mode ke liye) aur **video prompts** ka list (Frame-to-Video mode ke liye) —
  Copy ya `.txt`, ya dono ka `.csv`.
- Phir [VEO Automation](https://chromewebstore.google.com/detail/veo-automation-auto-veo-n/fnmijgmnjpealnnadjpjilaanhhambeb)
  kholo → Text-to-Image mode → image list paste/import → run → images ban-ne ke baad
  Frame-to-Video mode → wahi images + video list → run → auto-download.

### B0) 🎯 Flow Auto — full (Nano Banana → Frame video) — meri apni

Ye poora recipe Google Flow pe khud click karta hai (aap ke exact steps):
- **IMAGE:** Image tab → 9:16 → x1 → prompt → Generate
- **VIDEO:** Video tab → Frames → 9:16 → us image ko start-frame → video prompt → Generate → Download 1080p

**Kaise:**
1. Ek tab mein apna Flow project kholo (`labs.google/fx/tools/flow/project/...`), login rakho.
2. Panel ke **🚀 Veo** section mein wo tab chuno (**↻** refresh).
3. **🎯 Flow Auto** card mein **2 buttons ek dafa sikhao** (Flow tab pe click karke):
   **“→ Generate”** (prompt bar ka arrow) aur **“Download”**. Baaki (Image/Video/Frames/
   9:16/x1/Start/prompt-box) **text se khud** mil jaate hain — “aur buttons” tabhi map karo
   jab auto na chale.
4. **▶ Full auto** dabao — har scene ka image banega, phir usi se video, phir 1080p download.
   Log live status deta hai; **⏹ Stop** kabhi bhi.

> Note: kabhi image ka data cross-origin (CORS) hone se start-frame auto-attach fail ho sakta —
> log warning dega, us ek scene ka image haath se laga dena, baaki chalta rahega.

### B) Veo pe chalao (basic best-effort — koi bhi Veo/Gemini page)
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
