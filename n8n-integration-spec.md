# Al Tariq Hisaab — Technical Spec for n8n Integration

> Prepared from the actual app source code. Read the **"Important reality"** box first —
> it changes how questions 1–5 should be answered.

---

## ⚠️ Important reality (read first)

This app is **NOT** a client + server system. It is a **pure client-side PWA** (vanilla
JavaScript, no build step, no Node/Express server). All data lives in the browser's
`localStorage` and is mirrored to **Firebase Firestore** directly from the browser.

**Consequences for automation:**

- There is **no custom REST API**, no `/api/orders`, no `/api/payments`, no login endpoint of our own.
- Records are **not** stored as one-row-per-document. The **entire dataset** (all customers,
  all their transactions) is serialized to JSON, **gzipped**, base64-encoded, and stored inside a
  **single Firestore document** (split into chunks only if it exceeds ~0.9 MB).
- So "add one record via API" means one of:
  - **(A)** read that big gzipped doc → gunzip → parse → append the new entry → re-gzip → write back
    (read-modify-write), **or**
  - **(B)** write to the small "delta" doc the app already uses for incremental sync, **or**
  - **(C) [recommended — NOW BUILT IN, app v63+]** an **inbox subcollection** the app drains
    automatically. n8n does one dead-simple `POST` of a plain-JSON entry; the app matches it to the
    right customer, adds the transaction, and deletes the inbox doc. **Use this path.**

The rest of this document gives exact values for all three paths.

---

## 1. Backend / Database

| Question | Answer |
|---|---|
| Backend type | **Firebase Firestore** (NoSQL document DB) + Firebase **Anonymous Auth**. No custom server. |
| Base URL (Firestore REST) | `https://firestore.googleapis.com/v1/projects/altariq-hisaab/databases/(default)/documents` |
| Base URL (Auth REST) | `https://identitytoolkit.googleapis.com/v1/` |
| Firebase project id | `altariq-hisaab` |

Public Firebase config (safe to expose — access is controlled by Firestore security rules):

```json
{
  "apiKey": "AIzaSyAknUuqCB3q3DnoD9BILBjHQCrD67WVXLk",
  "authDomain": "altariq-hisaab.firebaseapp.com",
  "projectId": "altariq-hisaab",
  "storageBucket": "altariq-hisaab.firebasestorage.app",
  "messagingSenderId": "189434885975",
  "appId": "1:189434885975:web:a5d398897200514da13012"
}
```

**Where the data lives:** collection **`khatas`**, document id = **your Sync ID** (the code you set in
the app's Settings → Sync). All sibling docs share that Sync ID as a prefix:

| Firestore path | Purpose |
|---|---|
| `khatas/{syncId}` | Main snapshot. Fields: `gz` (gzip+base64 of full JSON) **or** `payload` (plain JSON), `chunks` (int), `updatedAt` (ISO string), optional `fullReset` marker. |
| `khatas/{syncId}_c0`, `_c1`, … | Chunk docs, each `{ part: "<base64 slice>" }`, used only when `chunks > 0`. |
| `khatas/{syncId}_d` | **Delta doc** (incremental sync). Field `d` = JSON string (see §3B), `updatedAt`. |
| `share/{token}` | Public read-only PDF share docs for customers (not needed for adding records). |

> **You must know the Sync ID** to target the right document. Get it from the app: Settings → Sync ID.

---

## 2. Authentication

The app signs in with **Firebase Anonymous Authentication** — no email/password, no personal API key.
Write access is governed by **Firestore security rules** (the app owner controls these in the Firebase
console; if writes are rejected with `PERMISSION_DENIED`, the rules must be adjusted to allow it).

**To authenticate an external tool (n8n) without the app UI**, mint an anonymous ID token:

```http
POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyAknUuqCB3q3DnoD9BILBjHQCrD67WVXLk
Content-Type: application/json

{ "returnSecureToken": true }
```

Response contains **`idToken`** (a Bearer token, valid ~1 hour). Use it on every Firestore REST call:

```
Authorization: Bearer <idToken>
```

Refresh when expired using the returned `refreshToken`:

```http
POST https://securetoken.googleapis.com/v1/token?key=AIzaSyAknUuqCB3q3DnoD9BILBjHQCrD67WVXLk
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=<refreshToken>
```

> **More robust option for server-to-server:** create a **Firebase service account** (Firebase console →
> Project settings → Service accounts → generate private key) and mint an OAuth2 access token from it.
> A service account bypasses client security rules and is the cleanest way for n8n to write. This is the
> recommended production auth for automation.

---

## 3. Adding a record via API

There is **no single-record insert endpoint** by design (see reality box). Pick a path:

### Path A — Read-modify-write the main snapshot (reliable, heavier)

1. `GET  https://firestore.googleapis.com/v1/projects/altariq-hisaab/databases/(default)/documents/khatas/{syncId}`
2. In an n8n **Code** node: base64-decode the `gz` field → `zlib.gunzipSync` → `JSON.parse`. (If the doc
   has `chunks > 0`, first concatenate `part` from `khatas/{syncId}_c0.._c{n-1}`. If it has `payload`
   instead of `gz`, it's already plain JSON.)
3. Find the customer object by `name` (or `id`), push a new transaction into its `txns` array (schema in §4).
4. `zlib.gzipSync` the updated JSON → base64 → `PATCH` it back to `khatas/{syncId}` with `updatedAt` set to
   a fresh ISO timestamp. (If the gzip base64 length > 900000, you must re-implement the chunking the app
   uses. Below that, just set `gz` and `chunks: 0`.)

The app union-merges on its next read, so your appended txn (with a fresh `id`) survives.

### Path B — Write the delta doc (lighter, but can race)

Overwrite `khatas/{syncId}_d`. The app listens to this doc and merges new entries into local + next full push.

```http
PATCH https://firestore.googleapis.com/v1/projects/altariq-hisaab/databases/(default)/documents/khatas/{syncId}_d
Authorization: Bearer <idToken>
Content-Type: application/json

{
  "fields": {
    "d": { "stringValue": "{\"v\":1,\"c\":[{\"id\":\"<CUSTOMER_ID>\",\"name\":\"Hamza Kohistan Press\",\"phone\":\"03001234567\",\"txns\":[{\"id\":\"auto1\",\"amount\":5000,\"type\":\"debit\",\"note\":\"1000 flyers printing\",\"date\":\"2026-08-14T10:00:00.000Z\",\"img\":\"\",\"m\":1755168000000}],\"quotes\":[]}],\"s\":[],\"del\":{}}" },
    "updatedAt": { "stringValue": "2026-08-14T10:00:00.000Z" }
  }
}
```

⚠️ **Caveat:** the app also overwrites `_d` on its own pushes. If the shop's app is open and pushing at the
same instant, your delta can be clobbered before it's read. Fine for low-frequency automation while the app
is closed; not guaranteed under concurrent use. Firestore REST `PATCH` on a non-existent doc creates it.

### Path C — ✅ RECOMMENDED — inbox subcollection (built in, app v63+)

n8n creates **one plain-JSON doc per entry** — no gzip, no read-modify-write, no race. The app (when open
on the shop's phone) drains the inbox automatically.

**Endpoint** (Firestore REST "create document"; `documentId` optional):

```http
POST https://firestore.googleapis.com/v1/projects/altariq-hisaab/databases/(default)/documents/khatas/{syncId}/inbox
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "fields": {
    "customerName": { "stringValue": "Hamza Kohistan Press" },
    "amount":       { "doubleValue": 5000 },
    "type":         { "stringValue": "debit" },
    "note":         { "stringValue": "1000 flyers printing" },
    "date":         { "stringValue": "2026-08-14T10:00:00.000Z" }
} }
```

**Fields n8n sends** (all in one flat doc):

| Field | Required | Value |
|---|---|---|
| `customerName` | ✅ | Customer's name. Fuzzy-matched (partial name OK, e.g. `"Kohistan Press"` finds `"Hamza Kohistan Press"`). |
| `amount` | ✅ | Positive number (rupees). |
| `type` | ✅ | `"debit"` = printing order / customer owes · `"credit"` = payment received. Defaults to `debit` if omitted. |
| `note` | optional | Job/item description, e.g. `"1000 flyers printing"`. |
| `date` | optional | ISO 8601. Defaults to now if omitted/invalid. |

**What the app does with it (automatic):**
- Matches `customerName` to a customer. **Clear match →** adds the transaction and **deletes** the inbox doc.
- **No confident match →** the app does **not** guess. It flags the doc (`pending: true`) and shows the shop
  owner a warning (`⚠️ "<name>" match nahi hua`) so they can add it manually. So **the customer must already
  exist in the app** for auto-add; unknown names are held for review, never auto-created.
- Duplicate-safe: the transaction id is derived from the inbox doc id, so even if two phones drain the same
  inbox doc, it can't double-post.

> **Note:** the app drains the inbox only while it is **open** on the shop's phone (it listens live).
> Entries queue safely in Firestore and are picked up the next time the app is opened/foregrounded.

### (a) Printing order / expense vs (b) Payment

Both are the **same kind of record** — a transaction inside a customer's `txns[]` array. Only the **`type`**
field differs:

| Entry kind | `type` value | Effect on balance |
|---|---|---|
| **(a) Printing order / goods given (customer owes you)** | `"debit"` | increases what the customer owes |
| **(b) Payment received from customer** | `"credit"` | decreases what the customer owes |

(For **suppliers** the labels flip: `debit` = "Maal Liya" / you took goods, `credit` = "Paisa Diya" / you
paid. But your automation is for customers, so use the table above.)

---

## 4. Data schema (exact field names)

Top-level dataset object (this is what gets gzipped into `khatas/{syncId}`):

```jsonc
{
  "shop":      { "name": "...", /* shop profile */ },
  "customers": [ /* Party objects — people who owe you / you serve */ ],
  "suppliers": [ /* Party objects — vendors you buy from */ ],
  "deletedIds": { "<txnId>": <deleteTimestampMs> }   // tombstones so deletes don't resurrect on merge
}
```

**Party (customer/supplier) object:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique. Generated as `Date.now().toString(36) + Math.random().toString(36).slice(2,7)`. |
| `name` | string | e.g. `"Hamza Kohistan Press"`. Matching is by name in bulk features. |
| `phone` | string | e.g. `"03001234567"` (local) — app converts to intl (92…) when messaging. |
| `txns` | array | Transactions (orders + payments together). See below. |
| `quotes` | array | Rate/quote entries (optional; separate from txns). See below. |
| `shareId` | string | Public share token (present only if a share link was made). |
| `m` | number | Last-modified epoch ms. Used for last-write-wins on merge. |

**Transaction object (inside `txns[]`) — this is an order OR a payment:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | Unique id (same generator as above). Must be unique per txn. |
| `amount` | number | ✅ | Rupees. App rounds to 2 decimals (`Math.round(amount*100)/100`). Always positive; direction comes from `type`. |
| `type` | string | ✅ | **`"debit"`** (order/goods given → customer owes) or **`"credit"`** (payment received). Only these two values. |
| `note` | string | ✅ (may be empty) | Free text — the job/item description, e.g. `"1000 flyers printing"`. Empty string allowed. |
| `date` | string | ✅ | **ISO 8601** string, e.g. `new Date().toISOString()` → `"2026-08-14T10:00:00.000Z"`. |
| `img` | string | optional | Base64/URL of an attached photo, or `""`. |
| `m` | number | ✅ | Last-modified epoch ms (`Date.now()`). Drives last-write-wins merge. |

**Quote object (inside `quotes[]`) — only if you also automate rate quotes:**

`{ id, job (string), rate (number), note (string), date (ISO), status (string, default "Rate Diya"), img, m }`

**Balance math:** for a customer, `balance = Σ(type==='debit' ? +amount : -amount)`. Positive = customer owes you.

**Orders vs payments are in the SAME array** (`txns`), distinguished only by the `type` field. There is no
separate "orders" vs "payments" collection.

---

## 5. The text-paste import feature (`import=altariq-final`)

**What it is:** a **one-time full-database seed**, not a per-record importer. Opening
`app.html?import=altariq-final` makes the app fetch a bundled file `data/altariq-final.txt`.

**Exact format of that file:** it is **gzip-compressed, base64-encoded JSON** of the *entire* dataset object
from §4 (`{ customers:[…], suppliers:[…], … }`). It is **not** CSV and **not** plain JSON — it's the same
gzip+base64 blob format as the `gz` field in Firestore. On import the app **replaces** the whole ledger
(after taking a safety snapshot) and marks it done so it won't run twice.

Conceptually, before gzipping, the JSON looks like:

```json
{
  "customers": [
    {
      "id": "l2k3j4a1b",
      "name": "Hamza Kohistan Press",
      "phone": "03001234567",
      "txns": [
        { "id": "l2k3j5c2d", "amount": 5000, "type": "debit",  "note": "1000 flyers printing", "date": "2026-08-14T10:00:00.000Z", "img": "", "m": 1755168000000 },
        { "id": "l2k3j6e3f", "amount": 3000, "type": "credit", "note": "cash payment",          "date": "2026-08-15T09:00:00.000Z", "img": "", "m": 1755254400000 }
      ],
      "quotes": []
    },
    {
      "id": "l2k3j7g4h",
      "name": "Bilal Offset",
      "phone": "03119876543",
      "txns": [
        { "id": "l2k3j8i5j", "amount": 12000, "type": "debit", "note": "book binding 200 copies", "date": "2026-08-13T14:00:00.000Z", "img": "", "m": 1755094800000 }
      ],
      "quotes": []
    }
  ],
  "suppliers": [],
  "deletedIds": {}
}
```

**Is import the best way to bulk-add from automation?** ❌ No. `import=altariq-final` **overwrites the whole
ledger** and is meant to run once — it's destructive, not additive. For ongoing automation use:

- **Best:** Path C (inbox collection) — trivial for n8n, no gzip, no race.
- **Reliable without app changes:** Path A (read-modify-write the gzipped main doc).
- **Light but racy:** Path B (delta doc).

---

## TL;DR for the n8n builder

- Backend = **Firebase Firestore**, project `altariq-hisaab`, collection `khatas`, doc id = **Sync ID**.
- No custom API. **Auth = a Firebase service account** (recommended for n8n server-to-server): Firebase
  console → Project settings → Service accounts → Generate private key → mint an OAuth2 access token, use as
  `Authorization: Bearer <accessToken>`. (Anonymous ID token also works but needs open Firestore rules.)
- **Use Path C (inbox)** — built in as of app **v63**. n8n does one `POST` to
  `khatas/{syncId}/inbox` with `{ customerName, amount, type, note, date }`. `type: "debit"` = printing
  order (customer owes), `type: "credit"` = payment received.
- The app auto-adds matched entries and deletes the inbox doc; **unknown customer names are held for the shop
  owner to review** (not auto-created). Customer should already exist in the app for hands-free add.
