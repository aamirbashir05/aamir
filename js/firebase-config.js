/*
 * firebase-config.js — permanent LIVE customer links ke liye.
 *
 * Jab tak ye khaali (null) hai, app SNAPSHOT link use karti hai (bhejte waqt ka hisaab).
 * Firebase project banane ke baad (dekhein CLOUD-SETUP.md) apna web config yahan daalein,
 * phir har customer ka ek PAKKA link banega jo hamesha taaza hisaab dikhayega.
 *
 * Misaal:
 * window.FIREBASE_CONFIG = {
 *   apiKey: "AIza........",
 *   authDomain: "altariq-hisaab.firebaseapp.com",
 *   projectId: "altariq-hisaab",
 *   storageBucket: "altariq-hisaab.appspot.com",
 *   messagingSenderId: "1234567890",
 *   appId: "1:1234567890:web:abcdef123456"
 * };
 *
 * (Ye config public hota hai — isay commit karna theek hai; hifazat Firestore rules se hoti hai.)
 */
window.FIREBASE_CONFIG = null;
