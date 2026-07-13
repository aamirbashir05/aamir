# Al Tariq Printers — Hisaab 📒

Udhaar Book / Rupin jaisi ek **web app (PWA)** — customers ka hisaab rakhein, aur
**hisaab enter karte hi customer ko WhatsApp par message + link** bhejein jise khol
kar wo apna poora hisaab **PDF** me dekh aur download kar sake (PC, laptop, mobile — kahin bhi).

## Branding & Cloud

- **🎨 Al Tariq Printers branding** — asli logo (background hata kar) app header aur customer PDF dono par. Colours **Orange + White + Black**. Settings se apna logo badal bhi sakte hain.
- **☁️ Cloud Sync (Firebase, free)** — data online + har device par sync, phone toot/gum ho to bhi safe. Setup: **CLOUD-SETUP.md**.
- **🔔 Udhaar Reminders** — Overview par ek button se un customers ki list jinse lena hai, har ek ko **1-tap WhatsApp reminder** (baqaya + hisaab link).
- **🧾 Job workflow stages** — har rate/quote ka stage: Rate Diya → Confirmed → Design → File Aayi → Printing → Delivered.

## Naya (printing-press ke liye)

- **🧾 Rate Memory** — customer ko jo rate diya (kaam + rate + status + note + tasveer) wo mehfooz. "Rates" tab me har customer/kaam se search — Abu ko yaad rakhne ke liye.
- **🖼️ Entry me tasveer** — har lein-dein/quote ke sath design ya parchi ki photo laga sakte hain (phone me mehfooz, thumbnail + full view).
- **🛡️ Data Safety** — data ab **IndexedDB + localStorage** dono me, aur **auto version-history** (galti se delete/kharab ho to Settings → "Purani Backups" se restore). Backup reminder + one-tap backup file bhi.
- **🎨 Branding** — Business naam **Al Tariq Printers**, Settings me apna **logo upload** karein — app header aur customer ke PDF dono par lagta hai.

## Features

**📊 Business Overview** — Total Lena / Dena, customers count, aaj ki entries, net baqaya, haaliya lein-dein.

**📒 Accounts (Khata)**
- Customers add/edit/delete (naam + WhatsApp number)
- **Udhaar Diya / Paisay Milay** har lein-dein, running balance
- Search, har customer ka Baqaya

**💬 Auto WhatsApp (aap ki main requirement)**
- Jaise hi aap koi entry karte hain, customer ko WhatsApp par message jata hai:
  *"Aap ke khaate me nayi entry hui: Udhaar Rs 5,000 (Cement 2 bori). Ab aap par baqi: Rs 3,000. Poora hisaab: <link>"*
- **Default (free): 1-tap** — WhatsApp khud khulta hai, message+link tayyar, aap send dabate hain (aap ke apne number se)
- **Optional full-auto** — WhatsApp Business API se bina tap ke (dekhein `server/README.md`)
- Har entry par notification on/off toggle bhi hai

**🏷️ Items / Stock** — cheezein (naam + rate) save karein; entry ke waqt item chunte hi raqam khud aa jaye.

**🔗 Shareable PDF Hisaab** — customer link khole → poora ledger (tareekh, udhaar, jama, running baqaya) + **PDF Download / Print**. Link khud-contained hai (data link ke andar), koi login nahi.

**Aur** — offline chalti hai (data phone me save), **Add to Home Screen** se app ki tarah install, **Backup Save/Load**.

## Local test

```bash
python3 -m http.server 8080
# browser: http://localhost:8080
```

## Online kaise banayein (links kaam karne ke liye) — GitHub Pages (free)

Customer ke link tabhi kaam karenge jab app kisi web address par host ho:

1. Is branch ko `master` me merge karein.
2. GitHub → repo **Settings → Pages → Source = "GitHub Actions"** select karein.
3. Kuch minute me app live: `https://<username>.github.io/aamir/`
4. App usi address se kholein — **Settings → "Link ka Web Address"** khud bhar jayega.

Deploy workflow `.github/workflows/deploy-pages.yml` me pehle se maujood hai.

## WhatsApp ke do tareeqe

| | 1-Tap (default) | Full-Auto (API) |
|---|---|---|
| Kharcha | **Free** | Free tier + per-message paisa |
| Setup | Kuch nahi | WhatsApp Business API number + server |
| Kaam | WhatsApp khulta hai, aap send dabate hain | Bina tap ke khud chala jaye |
| Number | Aap ka zaati WhatsApp | Alag Business API number |

Full-auto chahiye to `server/README.md` follow karein aur us server ka URL app ki
Settings me daal dein.

## APK chahiye?
Ye PWA phone par **"Add to Home Screen"** se app ki tarah install ho jati hai (icon, full-screen, offline). Asli `.apk` chahiye to isi hosted app ko baad me **Bubblewrap/TWA** se APK me wrap kiya ja sakta hai.

## Files

| File | Kaam |
|------|------|
| `index.html` | Owner app (Overview / Accounts / Items / Settings) |
| `view.html` | Customer ka hisaab viewer (link par khulta hai) |
| `js/store.js` | Data + hisaab ka logic |
| `js/app.js` | App functionality + WhatsApp bhejna |
| `css/styles.css` | Design (Rupin-jaisa) |
| `server/` | Optional full-auto WhatsApp backend |
| `sw.js`, `manifest.json`, `icon.svg` | PWA (offline + install) |

## Hisaab ka usool
- **Udhaar Diya** = customer par baqi barhta hai (aap ka *Lena*)
- **Paisay Milay** = customer par baqi kam hota hai
- **Baqaya = kul Udhaar − kul Jama** → musbat (+) customer se lena, manfi (−) customer ko dena
