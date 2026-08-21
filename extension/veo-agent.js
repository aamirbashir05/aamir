/* veo-agent.js — Veo/Flow page ke andar inject hota hai (best-effort automation).
   Yeh koi hidden/stealth cheez nahi karta — bas wahi kaam jo aap manually karte:
   prompt box mein text daalo, Generate dabao, ban jaye to Download dabao.
   Google apni UI badle to selectors panel ki Settings se override kiye ja sakte hain. */
(() => {
  if (window.__dramaVeoAgent) return;            // double-inject guard
  window.__dramaVeoAgent = true;

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const txt = (el) => ((el.innerText || el.textContent || el.value || el.getAttribute?.('aria-label') || '') + '').trim();

  // ---- prompt box: sabse bada visible textarea / contenteditable ----
  function findPromptBox(sel) {
    if (sel) { const e = document.querySelector(sel); if (e) return e; }
    const cands = [
      ...document.querySelectorAll('textarea'),
      ...document.querySelectorAll('[contenteditable="true"]'),
      ...document.querySelectorAll('input[type="text"]')
    ].filter(isVisible);
    if (!cands.length) return null;
    cands.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    });
    return cands[0];
  }

  function setPromptText(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else { // contenteditable
      el.innerHTML = '';
      document.execCommand('insertText', false, text);
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
    return true;
  }

  // ---- button dhoondho text/aria se ----
  function findButtonByWords(words, sel) {
    if (sel) { const e = document.querySelector(sel); if (e) return e; }
    const re = new RegExp(words.join('|'), 'i');
    const btns = [...document.querySelectorAll('button,[role="button"],a')].filter(isVisible);
    // prefer enabled buttons whose label matches
    const match = btns.filter(b => re.test(txt(b)) && !(b.disabled) && b.getAttribute('aria-disabled') !== 'true');
    return match[0] || null;
  }

  const GEN_WORDS = ['generate', 'create', 'animate', 'run', 'submit', 'إنشاء', 'أنشئ', 'توليد', 'انشاء'];
  const DL_WORDS  = ['download', 'save', 'export', 'تنزيل', 'تحميل', 'حفظ'];

  function newestMedia() {
    const vids = [...document.querySelectorAll('video')].filter(isVisible);
    const v = vids[vids.length - 1];
    if (v && (v.currentSrc || v.src)) return { type: 'video', src: v.currentSrc || v.src };
    const imgs = [...document.querySelectorAll('img')].filter(i => isVisible(i) && i.naturalWidth > 200);
    const im = imgs[imgs.length - 1];
    if (im && im.src) return { type: 'image', src: im.src };
    return null;
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // wait until page "settles" after generate: naya video/image aa jaye ya download button enable ho
  async function waitForResult(maxMs, sel) {
    const start = Date.now();
    let baselineVideos = document.querySelectorAll('video').length;
    while (Date.now() - start < maxMs) {
      const dl = findButtonByWords(DL_WORDS, sel?.download);
      const vids = document.querySelectorAll('video').length;
      const media = newestMedia();
      if ((vids > baselineVideos && media && media.type === 'video') || (dl && isVisible(dl))) {
        return { ok: true, elapsed: Date.now() - start, media };
      }
      await sleep(2500);
    }
    return { ok: false, elapsed: maxMs, media: newestMedia() };
  }

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.__drama !== true) return;
    if (!['ping','fill','generate','download','fillAndGenerate'].includes(msg.cmd)) return; // let flow-agent handle its own
    (async () => {
      try {
        const sel = msg.selectors || {};
        if (msg.cmd === 'ping') {
          const box = findPromptBox(sel.prompt);
          return reply({ ok: true, hasBox: !!box, url: location.href });
        }
        if (msg.cmd === 'fill') {
          const box = findPromptBox(sel.prompt);
          if (!box) return reply({ ok: false, error: 'Prompt box nahi mila (Settings se selector do).' });
          setPromptText(box, msg.text || '');
          return reply({ ok: true });
        }
        if (msg.cmd === 'generate') {
          const btn = findButtonByWords(GEN_WORDS, sel.generate);
          if (!btn) return reply({ ok: false, error: 'Generate button nahi mila (Settings se selector do).' });
          btn.click();
          return reply({ ok: true });
        }
        if (msg.cmd === 'download') {
          const btn = findButtonByWords(DL_WORDS, sel.download);
          if (btn) { btn.click(); return reply({ ok: true, clicked: true }); }
          const media = newestMedia();
          return reply({ ok: !!media, clicked: false, media, error: media ? '' : 'Download button/media nahi mila.' });
        }
        if (msg.cmd === 'fillAndGenerate') {
          const box = findPromptBox(sel.prompt);
          if (!box) return reply({ ok: false, error: 'Prompt box nahi mila.' });
          setPromptText(box, msg.text || '');
          await sleep(400);
          const btn = findButtonByWords(GEN_WORDS, sel.generate);
          if (!btn) return reply({ ok: false, error: 'Generate button nahi mila.' });
          btn.click();
          const res = await waitForResult(msg.maxWaitMs || 240000, sel);
          return reply(res);
        }
        return reply({ ok: false, error: 'Unknown cmd' });
      } catch (e) {
        return reply({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true; // async reply
  });
})();
