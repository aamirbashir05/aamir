# 🎬 Drama Studio — standalone

Ek self-contained tool (sirf `index.html`) jo Khaleeji/Arab family-drama shorts ke liye
Veo 3 ka poora blueprint banata hai: har scene ka **Image Prompt + Video Prompt**,
fixed **character bible**, **Arabic dialogue** (translit + meaning), aur **caption/hashtags**.

## Alag (standalone) hai
- Kisi bhi cheez pe depend nahi — koi external asset/file nahi.
- Kisi bhi jagah host ho sakta hai: apna GitHub repo + Pages, Netlify, Vercel, ya seedha
  browser mein file khol kar.
- Printing site (Al Tariq) se bilkul alag — us se koi link/branding nahi.

## Chalane ka tareeqa
1. `index.html` browser mein kholo (mobile ya PC).
2. **Auto mode:** Setup mein free Google Gemini key daalo (https://aistudio.google.com/apikey) →
   Story likho → 1 click mein poora blueprint.
3. **Master Prompt mode (bina key):** app ek ready prompt banati hai jo aap apne
   Claude/Gemini chat mein paste kar sakte ho.

Key aur stories sirf aapke browser ke localStorage mein rehti hain — kisi server pe nahi jati.
