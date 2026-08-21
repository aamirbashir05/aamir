// Side panel toolbar-icon click pe khule
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// Flow ke downloads ko ek folder mein + scene-wise naam do.
// Panel run start pe flow_dl={active,folder,queue,count} set karta hai; har video se pehle
// queue mein 'scene-XX' push hota hai. Yahan har download ka naam rewrite karte hain.
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  chrome.storage.local.get('flow_dl', ({ flow_dl }) => {
    if (!flow_dl || !flow_dl.active) { suggest(); return; }
    const ext = (item.filename && item.filename.match(/\.[^.\\/]+$/) || ['.mp4'])[0];
    const q = Array.isArray(flow_dl.queue) ? flow_dl.queue.slice() : [];
    const count = (flow_dl.count || 0) + 1;
    const base = q.shift() || ('scene-' + String(count).padStart(2, '0'));
    let folder = String(flow_dl.folder || 'DramaStudio').replace(/[^\w \-]+/g, '').trim() || 'DramaStudio';
    chrome.storage.local.set({ flow_dl: { ...flow_dl, queue: q, count } }, () => {
      suggest({ filename: folder + '/' + base + ext, conflictAction: 'uniquify' });
    });
  });
  return true; // async suggest
});
