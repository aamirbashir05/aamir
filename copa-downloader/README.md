# COPA Chicago — Case Video Downloader 🎥⬇️

Ek chhota apna tool (public nahi) — sirf **[chicagocopa.org](https://www.chicagocopa.org/)**
ke case pages ke liye. Ek ya **kai** case links do, **ek button** dabao, aur har
case ki **saari videos** (BWC 1, BWC 2, BWC 3 …) uske apne folder me, ek-ek kar ke,
apne aap download hoti chali jaati hain. **Bulk** — ek saath 10-20 case links bhi.

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

## 🪟 Windows (PC / Laptop)

### Tareeqa A — Ready `.exe` (sabse aasaan, Python ki zaroorat NAHI) ⭐

1. GitHub par is repo me jayein → upar **Actions** tab.
2. **"Build Windows EXE"** wala latest (hara ✓) run kholein.
3. Neeche **Artifacts** me se **`COPA-Downloader-Windows`** download karein (ek zip).
4. Zip khol kar **`COPA-Downloader.exe`** nikaalein — bas ispar **double-click**.
   (yt-dlp exe ke andar hi hai, alag se kuch install nahi karna.)

> Behtareen quality (video+audio merge) ke liye `ffmpeg` ho to accha; na ho to
> bhi single-file MP4 aa jati hai. ffmpeg: PowerShell me `winget install ffmpeg`.

### Tareeqa B — Python se (agar exe na chahiye)

**Pehli dafa (ek baar):** Python install karein <https://www.python.org/downloads/>
→ install ke waqt **"Add python.exe to PATH"** par **tick** zaroor.

**Har dafa:** `START-Windows.bat` par **double-click** (pehli dafa yeh yt-dlp khud install kar lega).

### Chalane ke baad (dono tareeqon me same)
1. Ek window khulegi. Upar box me **case ke link(s) paste** karein —
   **har line par ek link** (bulk ke liye kai lines).
2. **⬇ Download All** dabayein.
3. Har case ki videos `Downloads\COPA\<case ka naam>\` folder me, tarteeb se aa jayengi.

> - **Bulk:** ek-ek line par kai case links; sab ek ke baad ek download honge.
> - **📄 Links .txt se lo** button se ek text file (har line par link) bhi load kar sakte hain.
> - **Save folder** ko **Change…** se apni marzi ki jagah rakh sakte hain.

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
python3 copa_downloader.py                       # window (GUI) khulegi
python3 copa_downloader.py "<link1>" "<link2>"   # bulk: kai cases
python3 copa_downloader.py --from-file links.txt # links ek file se (har line par ek)
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
- **Vimeo 429 / "Too Many Requests" / "impersonation … no target"** — Vimeo ki
  bot-protection. Tool `curl_cffi` ke zariye asli-browser jaisa ban kar ise handle
  karta hai (exe me pehle se shaamil; Python wale tareeqe me khud install ho jata hai).
  Agar phir bhi kabhi 429 aaye to kuch minute ruk kar dobara chalayein (Vimeo ne
  IP ko thodi der ke liye roka hota hai) — jo videos aa chuki hain woh skip hongi.
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
