/* ===========================================================
   THE HEALTHY DOME — interactions, 3D hero & cart
   =========================================================== */
(function () {
  'use strict';

  /* -----------------------------------------------------------
     PRODUCT DATA  (from the current THD store)
  ----------------------------------------------------------- */
  const WHATSAPP = '17743037734';           // 1-774-303-7734
  const EMAIL = 'thehealthydome@gmail.com';
  const FREE_SHIP = 50;

  const PRODUCTS = [
    { id:'lemony-green-tea', cat:'soap', name:'Lemony Green Tea Soap',
      desc:'Lemongrass & green tea. Smooths skin and clears blackheads.',
      price:5, tag:'', kind:'bar', c1:'#cfe3a6', c2:'#7fae5a', c3:'#3f7a3a' },
    { id:'sleepy-babe', cat:'soap', name:'Sleepy Babe Soap',
      desc:'Calming lavender blend for a restful, gentle cleanse.',
      price:5, tag:'', kind:'bar', c1:'#efe9f6', c2:'#b6a6d8', c3:'#7c6bb0' },
    { id:'cinnamon-oats', cat:'soap', name:'Cinnamon & Oats Soap',
      desc:'Gently exfoliating oats with warming cinnamon spice.',
      price:5, tag:'', kind:'bar', c1:'#f0dcb8', c2:'#c89a5e', c3:'#8a5a2b' },
    { id:'relax-box', cat:'box', name:'The Relax Box',
      desc:'A curated self-care set of soaps, oils & a wellness rub.',
      price:30, was:40, tag:'Best Seller', kind:'box', c1:'#f3d999', c2:'#e0b352', c3:'#1c4d3b' },
    { id:'rose-perfume', cat:'perfume', name:'Rose Perfume Oil',
      desc:'All-natural rose in a nourishing oil base. No alcohol.',
      price:6, tag:'', kind:'bottle', c1:'#f7d6de', c2:'#e59aae', c3:'#c76b86' },
    { id:'jasmine-perfume', cat:'perfume', name:'Jasmine Perfume Oil',
      desc:'Soft, natural jasmine essential-oil perfume.',
      price:6, tag:'', kind:'bottle', c1:'#fbf6e9', c2:'#efe0b8', c3:'#c9a24d' },
    { id:'sea-breeze-perfume', cat:'perfume', name:'Sea Breeze Perfume Oil',
      desc:'Clean, fresh marine scent from pure natural oils.',
      price:8, tag:'', kind:'bottle', c1:'#d5eef2', c2:'#8fcdd8', c3:'#3f92a3' },
    { id:'cooling-rub', cat:'wellness', name:'Cooling Rub',
      desc:'100% natural, handmade rub to soothe tired muscles.',
      price:6, tag:'', kind:'jar', c1:'#d9f0e2', c2:'#8ecdaa', c3:'#2a6b52' },
  ];

  /* -----------------------------------------------------------
     PRODUCT ARTWORK (inline SVG — swappable for real photos)
  ----------------------------------------------------------- */
  function productSVG(p) {
    const bg = `<defs>
      <linearGradient id="bg-${p.id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${p.c1}"/><stop offset="1" stop-color="${shade(p.c1,-12)}"/>
      </linearGradient>
      <linearGradient id="ob-${p.id}" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="${p.c1}"/><stop offset=".5" stop-color="${p.c2}"/><stop offset="1" stop-color="${p.c3}"/>
      </linearGradient>
      <radialGradient id="gl-${p.id}" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="url(#bg-${p.id})"/>
    <circle cx="200" cy="205" r="150" fill="#ffffff" opacity=".14"/>`;

    let shape = '';
    if (p.kind === 'bar') {
      shape = `<g transform="rotate(-12 200 205)" class="float">
        <rect x="118" y="150" width="164" height="112" rx="20" fill="${p.c3}" opacity=".28" transform="translate(10 14)"/>
        <rect x="118" y="150" width="164" height="112" rx="20" fill="url(#ob-${p.id})"/>
        <rect x="118" y="150" width="164" height="112" rx="20" fill="url(#gl-${p.id})"/>
        <text x="200" y="214" text-anchor="middle" font-family="Fraunces,serif" font-size="30" font-weight="600" fill="#ffffff" opacity=".9">THD</text>
      </g>`;
    } else if (p.kind === 'bottle') {
      shape = `<g class="float">
        <rect x="176" y="120" width="48" height="26" rx="5" fill="${p.c3}"/>
        <rect x="184" y="104" width="32" height="24" rx="4" fill="${shade(p.c3,-16)}"/>
        <path d="M168 150h64a14 14 0 0 1 14 14v96a20 20 0 0 1-20 20h-52a20 20 0 0 1-20-20v-96a14 14 0 0 1 14-14z" fill="url(#ob-${p.id})"/>
        <path d="M168 150h64a14 14 0 0 1 14 14v96a20 20 0 0 1-20 20h-52a20 20 0 0 1-20-20v-96a14 14 0 0 1 14-14z" fill="url(#gl-${p.id})"/>
        <rect x="176" y="196" width="48" height="54" rx="8" fill="#ffffff" opacity=".78"/>
        <text x="200" y="228" text-anchor="middle" font-family="Fraunces,serif" font-size="15" font-weight="600" fill="${p.c3}">THD</text>
      </g>`;
    } else if (p.kind === 'jar') {
      shape = `<g class="float">
        <rect x="150" y="150" width="100" height="30" rx="8" fill="${shade(p.c3,-10)}"/>
        <rect x="146" y="176" width="108" height="92" rx="18" fill="url(#ob-${p.id})"/>
        <rect x="146" y="176" width="108" height="92" rx="18" fill="url(#gl-${p.id})"/>
        <ellipse cx="200" cy="176" rx="54" ry="12" fill="#ffffff" opacity=".35"/>
        <text x="200" y="230" text-anchor="middle" font-family="Fraunces,serif" font-size="16" font-weight="600" fill="#ffffff" opacity=".9">THD</text>
      </g>`;
    } else { // box / gift set
      shape = `<g class="float">
        <rect x="132" y="176" width="136" height="96" rx="12" fill="${p.c3}"/>
        <rect x="132" y="150" width="136" height="34" rx="10" fill="${shade(p.c3,10)}"/>
        <rect x="188" y="150" width="24" height="122" fill="${p.c2}" opacity=".85"/>
        <rect x="132" y="196" width="136" height="16" fill="${p.c2}" opacity=".85"/>
        <path d="M200 150c-16-26 22-42 10-8 30-22 26 20-2 12" fill="${p.c1}"/>
        <text x="200" y="252" text-anchor="middle" font-family="Fraunces,serif" font-size="17" font-weight="600" fill="#ffffff" opacity=".92">THD</text>
      </g>`;
    }
    return `<svg class="prod-svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${bg}${shape}</svg>`;
  }

  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = pct < 0 ? 0 : 255, a = Math.abs(pct) / 100;
    r = Math.round((t - r) * a + r); g = Math.round((t - g) * a + g); b = Math.round((t - b) * a + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  const money = n => '$' + n.toFixed(2);

  /* -----------------------------------------------------------
     RENDER PRODUCTS
  ----------------------------------------------------------- */
  const grid = document.getElementById('productGrid');
  function renderProducts(filter) {
    grid.innerHTML = '';
    PRODUCTS.filter(p => filter === 'all' || p.cat === filter).forEach((p, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.dataset.id = p.id;
      const tagHTML = p.tag ? `<span class="badge-tag ${p.was ? 'sale' : ''}">${p.tag}</span>` : (p.was ? `<span class="badge-tag sale">Sale</span>` : '');
      const priceHTML = p.was
        ? `<span class="now">${money(p.price)}</span><span class="was">${money(p.was)}</span>`
        : `<span class="now">${money(p.price)}</span>`;
      card.innerHTML = `
        <div class="card-media">
          ${tagHTML}
          <button class="wishlist" aria-label="Save">♡</button>
          ${productSVG(p)}
        </div>
        <div class="card-body">
          <span class="card-cat">${catLabel(p.cat)}</span>
          <h3 class="card-title">${p.name}</h3>
          <p class="card-desc">${p.desc}</p>
          <div class="card-foot">
            <div class="price">${priceHTML}</div>
            <button class="add-btn" data-add="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add
            </button>
          </div>
        </div>`;
      grid.appendChild(card);
    });
    // stagger-reveal + tilt
    const cards = grid.querySelectorAll('.card');
    cards.forEach((c, i) => {
      setTimeout(() => c.classList.add('in'), 60 * i);
      attachTilt(c);
    });
  }
  const catLabel = c => ({ soap:'Handmade Soap', perfume:'Natural Perfume', wellness:'Wellness', box:'Gift Set' }[c] || c);

  renderProducts('all');

  /* filters */
  document.getElementById('filters').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderProducts(btn.dataset.filter);
  });

  /* wishlist toggle (visual) */
  grid.addEventListener('click', e => {
    const w = e.target.closest('.wishlist');
    if (w) { w.textContent = w.textContent === '♡' ? '♥' : '♡'; w.style.color = w.textContent === '♥' ? 'var(--coral)' : ''; }
  });

  /* -----------------------------------------------------------
     3D TILT on cards / about visual
  ----------------------------------------------------------- */
  function attachTilt(el) {
    if (matchMedia('(hover:none)').matches) return;
    const media = el.querySelector('.card-media');
    let raf;
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateY(${px * 9}deg) rotateX(${-py * 9}deg) translateY(-6px)`;
        if (media) media.style.transform = `translateX(${px * 10}px) translateY(${py * 10}px)`;
      });
    });
    el.addEventListener('mouseleave', () => {
      cancelAnimationFrame(raf);
      el.style.transform = '';
      if (media) media.style.transform = '';
    });
  }

  /* -----------------------------------------------------------
     CART
  ----------------------------------------------------------- */
  const cart = {};
  const els = {
    drawer: document.getElementById('cartDrawer'),
    overlay: document.getElementById('cartOverlay'),
    items: document.getElementById('cartItems'),
    total: document.getElementById('cartTotal'),
    count: document.getElementById('cartCount'),
    ship: document.getElementById('cartShip'),
  };
  const find = id => PRODUCTS.find(p => p.id === id);

  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    updateCart();
    toast('Added to cart 🌿');
    bump();
  }
  function setQty(id, q) { if (q <= 0) delete cart[id]; else cart[id] = q; updateCart(); }

  function updateCart() {
    const ids = Object.keys(cart);
    let total = 0, count = 0;
    els.items.innerHTML = '';
    if (!ids.length) {
      els.items.innerHTML = `<div class="cart-empty"><span>🧺</span>Your cart is empty.<br>Add a little natural goodness!</div>`;
    }
    ids.forEach(id => {
      const p = find(id), q = cart[id];
      total += p.price * q; count += q;
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="ci-media">${productSVG(p)}</div>
        <div class="ci-info">
          <div class="ci-title">${p.name}</div>
          <div class="ci-price">${money(p.price)} each</div>
          <div class="qty">
            <button data-dec="${id}">−</button><span>${q}</span><button data-inc="${id}">+</button>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;color:var(--green-800)">${money(p.price * q)}</div>
          <button class="ci-remove" data-rm="${id}">remove</button>
        </div>`;
      els.items.appendChild(row);
    });
    els.total.textContent = money(total);
    els.count.textContent = count;
    els.count.style.display = count ? 'grid' : 'none';
    // free shipping progress
    if (total >= FREE_SHIP || total === 0) {
      els.ship.innerHTML = total >= FREE_SHIP
        ? `🎉 You've unlocked <b>free shipping!</b>`
        : `Add items and spend $${FREE_SHIP}+ for free shipping`;
    } else {
      const pctv = Math.min(100, (total / FREE_SHIP) * 100);
      els.ship.innerHTML = `You're ${money(FREE_SHIP - total)} away from <b>free shipping</b><div class="bar"><i style="width:${pctv}%"></i></div>`;
    }
  }

  function bump() {
    els.count.animate([{ transform:'scale(1)' }, { transform:'scale(1.4)' }, { transform:'scale(1)' }], { duration:340, easing:'ease' });
  }

  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]'); if (add) return addToCart(add.dataset.add);
    const inc = e.target.closest('[data-inc]'); if (inc) return setQty(inc.dataset.inc, cart[inc.dataset.inc] + 1);
    const dec = e.target.closest('[data-dec]'); if (dec) return setQty(dec.dataset.dec, cart[dec.dataset.dec] - 1);
    const rm  = e.target.closest('[data-rm]');  if (rm)  return setQty(rm.dataset.rm, 0);
  });

  /* drawer open/close */
  const openCart = () => { els.drawer.classList.add('open'); els.overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const closeCart = () => { els.drawer.classList.remove('open'); els.overlay.classList.remove('open'); document.body.style.overflow = ''; };
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  els.overlay.addEventListener('click', closeCart);

  /* checkout */
  function orderText() {
    const ids = Object.keys(cart);
    if (!ids.length) return null;
    let lines = ['Hi The Healthy Dome! 🌿 I would like to order:', ''];
    let total = 0;
    ids.forEach(id => { const p = find(id), q = cart[id]; total += p.price * q; lines.push(`• ${q} × ${p.name} — ${money(p.price * q)}`); });
    lines.push('', `Subtotal: ${money(total)}`);
    return lines.join('\n');
  }
  document.getElementById('checkoutBtn').addEventListener('click', () => {
    const t = orderText();
    if (!t) return toast('Your cart is empty');
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(t)}`, '_blank');
  });
  document.getElementById('checkoutEmail').addEventListener('click', e => {
    e.preventDefault();
    const t = orderText();
    if (!t) return toast('Your cart is empty');
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('New Order — The Healthy Dome')}&body=${encodeURIComponent(t)}`;
  });
  updateCart();

  /* -----------------------------------------------------------
     TOAST
  ----------------------------------------------------------- */
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* -----------------------------------------------------------
     NAV — scroll state + mobile menu
  ----------------------------------------------------------- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive:true }); onScroll();

  const burger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  const toggleMenu = () => { burger.classList.toggle('open'); navLinks.classList.toggle('open'); };
  burger.addEventListener('click', toggleMenu);
  navLinks.addEventListener('click', e => { if (e.target.tagName === 'A') { burger.classList.remove('open'); navLinks.classList.remove('open'); } });

  /* -----------------------------------------------------------
     FORMS
  ----------------------------------------------------------- */
  document.getElementById('newsForm').addEventListener('submit', e => {
    e.preventDefault(); e.target.reset(); toast('Welcome to the Dome! Check your inbox 🌿');
  });
  const contactForm = document.getElementById('contactForm');
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(contactForm);
    const body = `Name: ${f.get('name')}\nEmail: ${f.get('email')}\n\n${f.get('message')}`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(f.get('subject') || 'Website enquiry')}&body=${encodeURIComponent(body)}`;
    document.getElementById('contactNote').textContent = 'Opening your email app…';
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  /* -----------------------------------------------------------
     REVEAL on scroll
  ----------------------------------------------------------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold:.12, rootMargin:'0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* -----------------------------------------------------------
     3D HERO  (Three.js) — glassy dome + floating soap bars
  ----------------------------------------------------------- */
  function initHero() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas || typeof THREE === 'undefined' || matchMedia('(prefers-reduced-motion:reduce)').matches) return;

    let W = canvas.clientWidth, H = canvas.clientHeight;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a2019, 0.055);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 12);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H, false);

    // lights
    scene.add(new THREE.AmbientLight(0xbfe0cc, 0.55));
    const key = new THREE.DirectionalLight(0xffe6b0, 0.95); key.position.set(6, 8, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0x3fae86, 0.9); rim.position.set(-8, -3, 4); scene.add(rim);
    const gold = new THREE.PointLight(0xe0b352, 1.3, 40); gold.position.set(4, 3, 6); scene.add(gold);

    const group = new THREE.Group();
    // bias the scene toward the right half on wide screens so it sits beside the copy
    group.position.x = W > 900 ? 3.4 : 0;
    scene.add(group);

    // central "dome" — glassy hemisphere-ish sphere
    const domeMat = new THREE.MeshStandardMaterial({
      color:0x2a6b52, roughness:0.15, metalness:0.2, transparent:true, opacity:0.55,
      emissive:0x0d3626, emissiveIntensity:0.5,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.1, 48, 48), domeMat);
    group.add(dome);
    const domeCore = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32),
      new THREE.MeshStandardMaterial({ color:0xf3d999, roughness:0.3, metalness:0.4, emissive:0xe0b352, emissiveIntensity:0.35 }));
    group.add(domeCore);
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.55, 1),
      new THREE.MeshBasicMaterial({ color:0xe0b352, wireframe:true, transparent:true, opacity:0.14 }));
    group.add(wire);

    // rounded-box "soap bar" geometry
    function roundedBox(w, h, d, r) {
      const shape = new THREE.Shape();
      shape.moveTo(-w/2 + r, -h/2);
      shape.lineTo(w/2 - r, -h/2);
      shape.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
      shape.lineTo(w/2, h/2 - r);
      shape.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
      shape.lineTo(-w/2 + r, h/2);
      shape.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
      shape.lineTo(-w/2, -h/2 + r);
      shape.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
      const geo = new THREE.ExtrudeGeometry(shape, { depth:d, bevelEnabled:true, bevelThickness:0.12, bevelSize:0.12, bevelSegments:3, steps:1 });
      geo.center();
      return geo;
    }
    const barGeo = roundedBox(1.7, 1.15, 0.55, 0.28);
    const barColors = [0xcfe3a6, 0xefe9f6, 0xf0dcb8, 0xf7d6de, 0xd5eef2, 0xd9f0e2];
    const bars = [];
    const N = window.innerWidth < 640 ? 6 : 9;
    for (let i = 0; i < N; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: barColors[i % barColors.length], roughness:0.62, metalness:0.1,
        emissive:0x1c4d3b, emissiveIntensity:0.06,
      });
      const bar = new THREE.Mesh(barGeo, mat);
      const ang = (i / N) * Math.PI * 2;
      const rad = 4.4 + Math.random() * 2.2;
      bar.userData = {
        ang, rad, y:(Math.random() - 0.5) * 5, spin:(Math.random() - 0.5) * 0.01,
        speed:0.0016 + Math.random() * 0.0022, bob:Math.random() * Math.PI * 2,
      };
      bar.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      group.add(bar); bars.push(bar);
    }

    // botanical dust particles
    const pc = 220;
    const pg = new THREE.BufferGeometry();
    const pos = new Float32Array(pc * 3);
    for (let i = 0; i < pc; i++) {
      pos[i*3] = (Math.random() - 0.5) * 26;
      pos[i*3+1] = (Math.random() - 0.5) * 18;
      pos[i*3+2] = (Math.random() - 0.5) * 16;
    }
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const particles = new THREE.Points(pg, new THREE.PointsMaterial({ color:0xe9c37e, size:0.06, transparent:true, opacity:0.55 }));
    scene.add(particles);

    // interaction
    const target = { x:0, y:0 };
    window.addEventListener('mousemove', e => {
      target.x = (e.clientX / innerWidth - 0.5);
      target.y = (e.clientY / innerHeight - 0.5);
    }, { passive:true });
    window.addEventListener('deviceorientation', e => {
      if (e.gamma != null) { target.x = Math.max(-0.5, Math.min(0.5, e.gamma / 45)); target.y = Math.max(-0.5, Math.min(0.5, e.beta / 90)); }
    }, { passive:true });

    let t = 0, running = true;
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
      group.position.x = W > 900 ? 3.4 : 0;
    }
    window.addEventListener('resize', resize);
    // pause when off-screen
    new IntersectionObserver(es => { running = es[0].isIntersecting; if (running) loop(); }, { threshold:0 })
      .observe(document.querySelector('.hero'));

    function loop() {
      if (!running) return;
      t += 1;
      requestAnimationFrame(loop);
      group.rotation.y += 0.0016;
      dome.rotation.y -= 0.0026; dome.rotation.x = Math.sin(t * 0.004) * 0.12;
      domeCore.rotation.y += 0.004;
      wire.rotation.y += 0.0012; wire.rotation.x += 0.0008;
      bars.forEach(b => {
        const u = b.userData; u.ang += u.speed;
        b.position.set(Math.cos(u.ang) * u.rad, u.y + Math.sin(t * 0.01 + u.bob) * 0.5, Math.sin(u.ang) * u.rad * 0.6);
        b.rotation.x += u.spin; b.rotation.y += u.spin * 0.7;
      });
      particles.rotation.y += 0.0004;
      // parallax camera
      camera.position.x += (target.x * 3 - camera.position.x) * 0.04;
      camera.position.y += (-target.y * 2 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    resize(); loop();
  }

  // Three.js is loaded with defer; run after load event to be safe.
  if (document.readyState === 'complete') initHero();
  else window.addEventListener('load', initHero);

})();
