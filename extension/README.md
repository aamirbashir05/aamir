# 🎬 Drama Studio — Flow Copilot (Chrome extension)

Aap **Claude** se prompts banao → extension mein **.txt / paste** karo → extension Google Flow pe
khud **images** banaye, phir un images se **videos** (Frame-to-Video) banaye, aur **1080p** mein
ek **folder** ke andar download kar de. Bas.

> Sirf PC/desktop (Chrome/Edge). Yeh aapke apne Flow account ki website ko automate karta hai —
> Google ki terms automated use ko allow nahi karti, thoda account-risk hai. Apni marzi se.

---

## Install (1 baar)
1. `chrome://extensions` → upar dayein **Developer mode** ON.
2. **Load unpacked** → yeh `extension/` folder chuno.
3. Toolbar mein 🎬 → side panel khulega. (Puzzle 🧩 se pin kar lo.)

## Workflow

### 1) Prompts lao
- **Claude** pe apni story + prompts banwao (aapka wahi system-prompt).
- Saare prompts copy karke panel ke **📥 Prompts** box mein paste karo, ya **.txt** file chuno → **Load**.
- Format: har scene mein `IMAGE PROMPT:` aur `VIDEO PROMPT:` (aur ho sake to `Scene 1/2…`).
  App khud scenes bana kar queue mein daal degi.

### 2) Flow tab set karo
- Ek tab mein apna Flow project kholo: `labs.google/fx/tools/flow/project/...` (login rakho).
- Panel ke **🎯 Flow Auto** mein wo tab chuno (**↻**).
- **Pehli baar:** **🔓 Grant access** dabao → Chrome us site ka permission maangega → **Allow**.
  (Bina iske “Cannot access contents of the page” error aata hai — Chrome ka site-access rule.)
- Phir **🔎 Test** — “prompt box mil gaya” aaye to ready.

### 3) 1-time: 3 button sikhao
Icon-only buttons ko ek dafa **pick** karna hota hai (Flow tab pe click karke):
- **→ Generate** (prompt bar ka arrow)
- **Download** (jo menu kholta hai)
- **1080p** (menu ke andar wala option — Flow ise upscale karke 1080p deta hai)

Baaki (**Image / Video / Frames / 9:16 / x1 / Start-frame / prompt**) text/DOM se **khud** mil jaate
hain — “**＋ aur buttons**” tabhi map karo jab kuch auto na chale.

### 4) Chalao
- Folder ka naam do (default `DramaStudio`), waits set karo (video-gen minutes leta hai).
- **▶ Full auto** — har scene: **Image → 9:16 → x1 → prompt → Generate**, phir
  **Video → Frames → 9:16 → us image ko start-frame → video prompt → Generate → Download → 1080p**.
- Files: **Downloads/&lt;folder&gt;/scene-01.mp4, scene-02.mp4 …**
- **Log** live status; **⏹ Stop** kabhi bhi. Per-scene **▶ image / ▶ video** bhi hain.

---

## Reality / limits (honest)
- **Best-effort automation.** Google Flow ki UI badalti rehti hai — extension text/DOM se buttons
  dhoondti hai; kuch tootay to “＋ aur buttons” se dobaara map kar lo.
- **Start-frame attach** kabhi cross-origin (CORS) ki wajah se fail ho sakta — Log warning dega,
  us **ek** scene ka image haath se laga dena, baaki chalta rahega.
- **1080p** = Flow ka download-menu option (720p direct hota hai). Upscale mein thoda waqt lagta —
  “1080p upscale wait” usi ke liye hai.

## Privacy
Prompts, mapping, folder-naam — sab sirf browser ke `chrome.storage.local` mein. Koi server nahi.

## Files
- `manifest.json` — MV3 (side panel + scripting + downloads)
- `panel.html/.css/.js` — side panel UI + logic (import, queue, Flow run, export)
- `flow-agent.js` — Google Flow page pe recipe + point-and-learn picker
- `background.js` — side panel opener + downloads ko folder/scene-naam dena
