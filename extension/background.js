// Desktop: side panel bhi (agar browser support kare). Mobile: action popup use hota hai.
chrome.runtime.onInstalled.addListener(() => {
  try { chrome.sidePanel && chrome.sidePanel.setPanelBehavior &&
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(()=>{}); } catch (e) {}
});

// Flow ke downloads ko ek folder mein + scene-wise naam do (jahan downloads API support ho).
try {
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    chrome.storage.local.get('flow_dl', ({ flow_dl }) => {
      if (!flow_dl || !flow_dl.active) { suggest(); return; }
      const ext = (item.filename && item.filename.match(/\.[^.\\/]+$/) || ['.mp4'])[0];
      const dq = Array.isArray(flow_dl.queue) ? flow_dl.queue.slice() : [];
      const count = (flow_dl.count || 0) + 1;
      const base = dq.shift() || ('scene-' + String(count).padStart(2, '0'));
      let folder = String(flow_dl.folder || 'DramaStudio').replace(/[^\w \-]+/g, '').trim() || 'DramaStudio';
      chrome.storage.local.set({ flow_dl: { ...flow_dl, queue: dq, count } }, () => {
        suggest({ filename: folder + '/' + base + ext, conflictAction: 'uniquify' });
      });
    });
    return true;
  });
} catch (e) {}
