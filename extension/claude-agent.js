/* claude-agent.js — claude.ai tab mein inject hota hai. Sirf aapke apne khule hue
   chat ka AAKHRI jawab (text) padhta hai aur panel ko bhej deta hai. Kuch send/click nahi karta. */
(() => {
  if (window.__dramaClaudeAgent) return;
  window.__dramaClaudeAgent = true;

  function latestAssistantText() {
    // Claude UI markers badalte rehte hain — kai selectors best-effort try karte hain.
    const sels = [
      '[data-testid="assistant-message"]',
      '[data-testid="chat-turn"]',
      'div.font-claude-message',
      '.prose'
    ];
    let nodes = [];
    for (const s of sels) {
      const found = [...document.querySelectorAll(s)];
      if (found.length) { nodes = found; break; }
    }
    if (!nodes.length) {
      // fallback: sabse lamba visible text block
      nodes = [...document.querySelectorAll('main div')]
        .filter(d => (d.innerText || '').length > 200)
        .sort((a, b) => (b.innerText.length - a.innerText.length))
        .slice(0, 1);
    }
    const last = nodes[nodes.length - 1];
    return last ? (last.innerText || last.textContent || '').trim() : '';
  }

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.__drama !== true || msg.cmd !== 'grabClaude') return;
    try { reply({ ok: true, text: latestAssistantText(), url: location.href }); }
    catch (e) { reply({ ok: false, error: String(e && e.message || e) }); }
    return true;
  });
})();
