# ☁️ Cloud Sync Setup (Firebase) — 5–10 minute

Cloud sync se aap ka poora hisaab **online (Firebase)** par bhi mehfooz rehta hai —
phone toot/gum/badal jaye tab bhi data safe, aur ek se zyada device (phone + laptop)
par khud sync. **Bilkul free** (Firebase Spark plan).

> Text hisaab (customers, lein-dein, rates) sync hota hai. Tasveerein har device par
> local rehti hain (link me bhi nahi jaatin).

## Qadam ba qadam

### 1) Firebase project banayein
1. https://console.firebase.google.com par apne Google account se login.
2. **Add project** → naam dein (misaal `altariq-hisaab`) → create.

### 2) Web app add karein
1. Project me **</>** (Web) icon par click.
2. App nickname dein → **Register app**.
3. Jo **firebaseConfig** dikhega, uska sirf object copy karein, misaal:
   ```json
   {
     "apiKey": "AIzaSy........",
     "authDomain": "altariq-hisaab.firebaseapp.com",
     "projectId": "altariq-hisaab",
     "storageBucket": "altariq-hisaab.appspot.com",
     "messagingSenderId": "1234567890",
     "appId": "1:1234567890:web:abcdef123456"
   }
   ```

### 3) Anonymous sign-in on karein
1. Left menu → **Build → Authentication → Get started**.
2. **Sign-in method** → **Anonymous** → Enable → Save.

### 4) Firestore database banayein
1. Left menu → **Build → Firestore Database → Create database**.
2. Location chunein → **Start in production mode** → Enable.
3. **Rules** tab me ye paste karke **Publish** karein:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /khatas/{docId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   (Sirf signed-in — anonymous — users ko access. Aap ka **Sync ID** secret rakhein.)

### 5) App me daalein
1. App → **Settings → Cloud Sync**.
2. **Cloud sync on** karein.
3. **Sync ID**: koi mushkil, secret naam (misaal `altariq-9x7k2m`). **Har device par bilkul yehi likhein.**
4. **Firebase Config**: qadam 2 wala JSON paste karein.
5. **Connection Test** → ✅ aaye to **Save** karein.

Bas! Ab jis bhi device par same **Sync ID** + config dalenge, hisaab khud sync hoga.

## Aksar poochhe jaane wale

- **Do device par ek sath badla to?** Jo save aakhir me hua wahi rehta hai
  (updatedAt se). 1–2 device ke liye bilkul theek.
- **Kya customer mera data dekh sakta hai?** Nahi. Sirf aap ke Sync ID + Firebase
  project se. Sync ID kisi ko na dein.
- **Kharcha?** Free plan (Spark) chhote business ke liye kaafi hai.
