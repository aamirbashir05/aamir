# COPA Chicago — Case Video Downloader 🎥⬇️

Ek chhota apna tool (public nahi) — sirf **[chicagocopa.org](https://www.chicagocopa.org/)**
ke case pages ke liye. Ek case ka link do, **ek button** dabao, aur us case ki
**saari videos** (BWC 1, BWC 2, BWC 3 …) **ek hi folder** me, ek-ek kar ke,
apne aap download ho jaati hain.

> Yeh COPA ki videos **Vimeo** par hoti hain aur COPA ne un par download allow
> kiya hua hai. IDM inko grab nahi karta, isliye yeh tool andar-hi-andar
> **yt-dlp** use karta hai (jo Vimeo ko sahi tarah download karta hai).

---

## 🔗 Link kahan se lena hai (bahut zaroori)

Tool ko us **case ka page ka link** chahiye — wohi page jis par saari video
tiles (BWC 1, BWC 2 …) ek saath dikhti hain.

1. chicagocopa.org par case kholein jahan videos ki list dikhe.
2. Browser ki address bar se us page ka link **copy** karein.
3. Wohi link tool me paste karein → **Download All**.

Agar kabhi kisi case ka poora page link na mile, to aap **ek video** ka Vimeo
link (jaise `https://vimeo.com/1189886906`) bhi paste kar sakte hain — woh akeli
video download ho jayegi. (Wohi "V" wale button se jo Vimeo site khulti hai,
uska address bar wala link.)

---

## 🪟 Windows (PC / Laptop) — sabse aasaan

**Pehli dafa (ek baar):**
1. Python install karein: <https://www.python.org/downloads/>
   → install karte waqt neeche **"Add python.exe to PATH"** par **tick** zaroor lagayein.
2. (Optional, behtareen quality ke liye) ffmpeg install: PowerShell me
   `winget install ffmpeg` — na bhi karein to tool phir bhi chalega.

**Har dafa video download karne ke liye:**
1. `START-Windows.bat` par **double-click** karein.
   (Pehli dafa yeh yt-dlp khud install/update kar lega — thoda intezaar.)
2. Ek window khulegi. Upar **case ka link paste** karein.
3. **⬇ Download All** dabayein.
4. Bas — saari videos `Downloads\COPA\<case ka naam>\` folder me aa jayengi.

> "Save folder" ko **Change…** se apni marzi ki jagah bhi rakh sakte hain.

---

## 🤖 Android (Mobile)

Android par **Termux** app chahiye (Play Store wala purana hota hai — behtar hai
[F-Droid](https://f-droid.org/packages/com.termux/) se install karein).

**Pehli dafa (ek baar):**
1. Termux kholein.
2. Yeh folder phone me rakhein (ya `git clone` karein), phir us folder me jayein.
3. Chalao:
   ```bash
   bash android-termux.sh
   ```
   (Pehli dafa yeh python, ffmpeg, yt-dlp install karega + storage permission
   maangega — **Allow** dabayein.)

**Har dafa:**
```bash
bash android-termux.sh
```
Phir case ka link paste karein. Videos phone ke **Download/COPA/** folder me
case ke naam se save hongi.

> Ek line me bhi ho jata hai:
> `bash android-termux.sh "https://www.chicagocopa.org/....."`

---

## 🍏 Mac / Linux

```bash
python3 copa_downloader.py          # window (GUI) khulegi
# ya
python3 copa_downloader.py "https://www.chicagocopa.org/....."   # seedha download
```
Pehle ek dafa: `pip3 install yt-dlp`  (behtar quality ke liye `ffmpeg` bhi).

---

## ⚙️ Kaam kaise karta hai (chhoti si tafseel)

1. Case page ka link kholta hai (browser jaise headers ke saath).
2. Us page me se **saari Vimeo videos** dhoondta hai (page ki tarteeb me).
3. Case ke naam se ek **folder** banata hai.
4. Har video ko `yt-dlp` se, ek-ek kar ke, us folder me download karta hai.
   File ka naam number + video ke apne title jaisa hota hai
   (jaise `01 - Log #2026-0001206 BWC 1.mp4`) — isliye clips tarteeb me, ek jagah.

---

## ❓ Masle / Notes

- **"Koi video nahi mili"** — link case-page ka nahi tha, ya videos JavaScript se
  baad me load hoti hain. Ek video ka seedha Vimeo link paste karke dekhein, ya
  mujhe bata dein — tool aasani se update ho jayega.
- **Slow / ruk gaya?** Dobara chalayein — jo videos aa chuki hain won skip ho
  jayengi (yt-dlp file dobara nahi banata agar mukammal ho).
- **Quality** — agar `ffmpeg` install ho to tool best video+audio mil ke sabse
  achhi quality deta hai; warna single-file best MP4.
- Yeh tool sirf apne/dost ke istemaal ke liye hai, public nahi.

---

## 📂 Files

| File | Kaam |
|------|------|
| `copa_downloader.py` | Asal tool (GUI + command line + download logic) |
| `START-Windows.bat`  | Windows par double-click launcher |
| `android-termux.sh`  | Android (Termux) setup + launcher |
| `README.md`          | Yeh hidayaat |
