# Mera Khata — Udhaar Book 📒

Udhaar App jaisi ek **web app (PWA)** — customers ka hisaab rakhein, aur har customer ko ek **link** bhejein jise khol kar wo apna poora hisaab **PDF** me dekh aur download kar sake (PC, laptop ya mobile — kahin bhi).

## Features

- **Customers** add/edit/delete karein (naam + mobile number)
- **Udhaar Diya / Paisay Milay** — har lein-dein record karein
- Har customer ka **Baqaya (balance)** khud-ba-khud
- Dashboard par **Total Lena / Total Dena**
- **WhatsApp par bhejein** — customer ko seedha hisaab ka link
- **Link Copy** — kisi ko bhi hisaab ka link bhejein
- Customer link khole → poora hisaab table me + **PDF Download / Print**
- **Offline** chalti hai, data aap ke phone me save (localStorage)
- **Backup Save / Load** — data ki file bana kar mehfooz rakhein
- Phone par **"Add to Home Screen"** karke app ki tarah install karein

## Kaise chalayein (Local test)

```bash
# is folder me:
python3 -m http.server 8080
# phir browser me kholein:  http://localhost:8080
```

## Online kaise banayein (Link kaam karne ke liye) — GitHub Pages

Customer ke link tabhi kaam karenge jab app kisi web address par host ho. Sab se aasan free tareeqa **GitHub Pages** hai:

1. Is branch ko `master` (default branch) me merge karein.
2. GitHub par repo → **Settings → Pages** kholein.
3. **Build and deployment → Source** me **"GitHub Actions"** select karein.
4. Kuch minute baad aap ki app is address par live ho jayegi:
   `https://<username>.github.io/aamir/`
5. Ye address app ki **Settings → "Link ka Web Address"** me khud bhar jayega
   (agar aap app usi address se kholenge). Bas — ab har link customer ke device par khulega.

> Workflow file `.github/workflows/deploy-pages.yml` me pehle se maujood hai —
> Source "GitHub Actions" karte hi deploy khud ho jayegi.

## APK chahiye? (installable app file)

Ye PWA phone par **"Add to Home Screen"** se bilkul app ki tarah install ho jati hai
(icon, full-screen, offline). Agar phir bhi Play-Store jaisi asli **.apk** file chahiye,
to isi web app ko baad me **Bubblewrap / TWA** se APK me wrap kiya ja sakta hai —
yeh usi hosted URL ko app me daal deta hai.

## Files

| File | Kaam |
|------|------|
| `index.html` | Owner ki app (aap istemal karenge) |
| `view.html` | Customer ka hisaab viewer (link par khulta hai) |
| `js/store.js` | Data + hisaab ka logic |
| `js/app.js` | App ki functionality |
| `css/styles.css` | Design |
| `sw.js`, `manifest.json`, `icon.svg` | PWA (offline + install) |

## Hisaab ka usool

- **Udhaar Diya** = customer par baqi barhta hai (aap ka *Lena*)
- **Paisay Milay** = customer par baqi kam hota hai
- **Baqaya = kul Udhaar − kul Jama**
  - Musbat (+) → customer se **lena** hai
  - Manfi (−) → customer ko **dena** hai
