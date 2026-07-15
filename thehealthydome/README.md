# The Healthy Dome — 3D Website Redesign

A modern, professional redesign of the THD (The Healthy Dome) natural-products
store. Replaces the old basic Wix layout with an animated **WebGL 3D hero**,
3D tilt product cards, scroll animations, and a working cart that checks out
via **WhatsApp or email**.

Everything is self-contained (HTML + CSS + JS, no build step, no external
services). It works offline and hosts anywhere.

## Files

| File | What it is |
|------|-----------|
| `index.html` | The whole page (all sections) |
| `style.css` | Design / theme / responsive layout |
| `main.js` | 3D hero, products, cart, forms, animations |
| `vendor/three.min.js` | Three.js (bundled locally so the 3D always works) |

## Run / preview locally

```bash
cd thehealthydome
python3 -m http.server 8080
# open http://localhost:8080
```

## How to customize (no coding needed for most of it)

Open **`main.js`** and edit the list at the top:

- **Products** — the `PRODUCTS` array. Change `name`, `desc`, `price`, `was`
  (sale price), `tag` (e.g. `"Best Seller"`), `cat` (`soap` / `perfume` /
  `wellness` / `box`), and the colors `c1/c2/c3` used for the artwork.
- **WhatsApp number** — `WHATSAPP` (digits only, with country code).
- **Order email** — `EMAIL`.
- **Free-shipping threshold** — `FREE_SHIP`.

### Using real product photos

Product images are drawn as clean SVG placeholders so the site looks finished
today. To use real photos instead, drop them in an `images/` folder and, in
`main.js`, replace the `productSVG(p)` output in `renderProducts()` with:

```html
<img class="prod-svg" src="images/your-photo.jpg" alt="product name">
```

(Add an `img` field to each product and read `p.img`.)

### Text / contact details

All headings, About story, reviews and contact info (Worcester MA, email,
phone, Instagram) are plain text in **`index.html`** — edit directly.

## Deploy (free)

- **GitHub Pages** — push, then Settings → Pages → deploy from branch. The site
  will be at `https://<user>.github.io/<repo>/thehealthydome/`.
- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop the `thehealthydome`
  folder, or connect the repo. No settings needed.

To make it the site's homepage, host this folder at the domain root (or move
these files up a level).

## Notes

- Fonts load from Google Fonts; if offline they fall back to system serif/sans.
- The 3D hero auto-disables for users who prefer reduced motion, and falls back
  to a rich gradient hero if WebGL is unavailable.
