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
       // Permanent customer links: sirf jis ke paas secret link ho wo parh sakta hai
       match /share/{token} {
         allow read: if true;
         allow write: if request.auth != null;
       }
       // Aap ka apna data (multi-device sync)
       match /khatas/{docId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   (`share` link ka token secret + mushkil hota hai, isliye sirf link wala hi hisaab dekhta hai. Baaki sab sirf aap likh/parh sakte hain.)

### 5) Config app me daalein (Live customer links ke liye — zaroori)
Permanent live links customer ke phone par khulte hain, isliye config **`js/firebase-config.js`** file me hona chahiye (sirf Settings kaafi nahi).

**Aasan:** qadam 2 wala config mujhe bhej dein — main `firebase-config.js` me daal kar deploy kar dunga.

**Khud karna ho:** `js/firebase-config.js` kholein:
```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza........",
  authDomain: "altariq-hisaab.firebaseapp.com",
  projectId: "altariq-hisaab",
  appId: "1:1234567890:web:abcdef123456"
};
```
Save + push. Bas! Har customer ka **pakka link** khud banega jo hamesha taaza hisaab dikhayega.

### 6) (Optional) Multi-device sync
Apna data ek se zyada device par sync karna ho:
1. App → **Settings → Cloud Sync** → **on**.
2. **Sync ID**: koi mushkil secret naam (har device par yehi).
3. **Firebase Config** paste → **Connection Test** → **Save**.

## Aksar poochhe jaane wale

- **Do device par ek sath badla to?** Jo save aakhir me hua wahi rehta hai
  (updatedAt se). 1–2 device ke liye bilkul theek.
- **Kya customer mera data dekh sakta hai?** Nahi. Sirf aap ke Sync ID + Firebase
  project se. Sync ID kisi ko na dein.
- **Kharcha?** Free plan (Spark) chhote business ke liye kaafi hai.
