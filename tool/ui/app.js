/* AlTariq Photoroom Pro — frontend logic. Talks to Python via window.pywebview.api */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const state = {
    items: {},          // uid -> {name,w,h,thumb,cut:bool}
    order: [],
    active: null,
    bg: { type: "transparent" },
    format: "png",
    preset: "original",
    showOriginal: false,
    ready: false,
  };

  // ---- wait for the pywebview bridge ---------------------------------- //
  function api() { return window.pywebview && window.pywebview.api; }
  function whenReady(fn) {
    if (api()) fn();
    else window.addEventListener("pywebviewready", fn, { once: true });
  }

  // ---- toast ---------------------------------------------------------- //
  let toastTimer;
  function toast(msg, kind) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast show " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "toast"), 2600);
  }

  // ---- model-ready hook (called from Python) -------------------------- //
  window.__modelReady = function () {
    state.ready = true;
    const p = $("#modelPill");
    p.className = "pill pill-ready";
    p.innerHTML = '<span class="dot"></span> AI ready · offline';
  };

  // ---- boot ----------------------------------------------------------- //
  whenReady(async () => {
    const meta = await api().meta();
    // size presets
    const sel = $("#presetSel");
    meta.presets.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id; o.textContent = p.label;
      sel.appendChild(o);
    });
    setExportDir(meta.export_dir);
    bindUI();
  });

  function setExportDir(dir) {
    $("#exportDir").textContent = dir;
    $("#exportDir").title = dir;
  }

  // ---- UI bindings ---------------------------------------------------- //
  function bindUI() {
    $("#addBtn").onclick = addImages;
    $("#dropAddBtn").onclick = addImages;
    $("#cutBtn").onclick = () => cutActive();
    $("#removeAllBtn").onclick = cutAll;
    $("#exportBtn").onclick = () => doExport([state.active]);
    $("#exportAllBtn").onclick = () => doExport(state.order);
    $("#toggleCompare").onclick = toggleCompare;

    // background swatches
    $("#bgSwatches").querySelectorAll(".sw").forEach((sw) => {
      sw.onclick = () => {
        selectSwatch(sw);
        const type = sw.dataset.type;
        if (type === "gradient") state.bg = { type, from: sw.dataset.from, to: sw.dataset.to };
        else if (type === "color") state.bg = { type, value: sw.dataset.value };
        else state.bg = { type: "transparent" };
        clearBgImage(false);
        refreshPreview();
      };
    });
    $("#customColor").oninput = (e) => {
      state.bg = { type: "color", value: e.target.value };
      deselectSwatches(); clearBgImage(false); refreshPreview();
    };
    $("#bgImageBtn").onclick = pickBgImage;
    $("#bgImageClear").onclick = () => { clearBgImage(true); refreshPreview(); };

    // format segment
    $("#formatSeg").querySelectorAll(".seg-btn").forEach((b) => {
      b.onclick = () => {
        $("#formatSeg").querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        state.format = b.dataset.fmt;
      };
    });
    $("#presetSel").onchange = (e) => (state.preset = e.target.value);
    $("#changeDirBtn").onclick = async () => {
      const r = await api().choose_export_dir();
      if (r && r.export_dir) setExportDir(r.export_dir);
    };

    // drag & drop onto the stage
    const dz = $("#dropzone");
    ["dragover", "dragenter"].forEach((ev) =>
      document.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); })
    );
    ["dragleave", "drop"].forEach((ev) =>
      document.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); })
    );
    // Native file paths from drops aren't reliably exposed in the webview, so
    // dropping just opens the picker — keeps behaviour predictable.
    document.addEventListener("drop", () => addImages());
  }

  function selectSwatch(sw) {
    deselectSwatches();
    sw.classList.add("active");
  }
  function deselectSwatches() {
    $("#bgSwatches").querySelectorAll(".sw").forEach((x) => x.classList.remove("active"));
  }

  // ---- images --------------------------------------------------------- //
  async function addImages() {
    const r = await api().add_images();
    if (!r || !r.ok || !r.items.length) return;
    r.items.forEach((it) => {
      state.items[it.uid] = { ...it, cut: false };
      state.order.push(it.uid);
      addThumb(it);
    });
    $("#queueEmpty").classList.add("hidden");
    $("#queueTools").classList.remove("hidden");
    if (!state.active) selectImage(r.items[0].uid);
    toast(r.items.length + " tasveer add hui", "ok");
  }

  function addThumb(it) {
    const el = document.createElement("div");
    el.className = "thumb";
    el.dataset.uid = it.uid;
    el.innerHTML =
      '<img src="' + it.thumb + '" alt="">' +
      '<span class="badge hidden">✓ cut</span>' +
      '<button class="del" title="Hatao">✕</button>' +
      '<div class="name">' + escapeHtml(it.name) + "</div>";
    el.querySelector("img").onclick = () => selectImage(it.uid);
    el.querySelector(".name").onclick = () => selectImage(it.uid);
    el.querySelector(".del").onclick = (e) => { e.stopPropagation(); removeImage(it.uid); };
    $("#thumbs").appendChild(el);
  }

  function thumbEl(uid) { return $('.thumb[data-uid="' + uid + '"]'); }

  async function removeImage(uid) {
    await api().remove_item(uid);
    delete state.items[uid];
    state.order = state.order.filter((x) => x !== uid);
    const el = thumbEl(uid); if (el) el.remove();
    if (state.active === uid) {
      state.active = null;
      if (state.order.length) selectImage(state.order[0]);
      else showEmptyStage();
    }
  }

  function showEmptyStage() {
    $("#workspace").classList.add("hidden");
    $("#dropzone").classList.remove("hidden");
    $("#queueEmpty").classList.remove("hidden");
    $("#queueTools").classList.add("hidden");
    setExportEnabled();
  }

  async function selectImage(uid) {
    state.active = uid;
    state.showOriginal = false;
    $("#toggleCompare").textContent = "👁 Original dekhein";
    document.querySelectorAll(".thumb").forEach((t) =>
      t.classList.toggle("active", t.dataset.uid === uid)
    );
    const it = state.items[uid];
    $("#dropzone").classList.add("hidden");
    $("#workspace").classList.remove("hidden");
    $("#stageTitle").textContent = it.name + "  ·  " + it.w + "×" + it.h;
    $("#canvas").classList.toggle("checker", true);
    $("#cutBtn").disabled = false;
    setExportEnabled();
    await refreshPreview();
  }

  // ---- cutout --------------------------------------------------------- //
  async function cutActive() {
    if (!state.active) return;
    await cutOne(state.active, true);
  }

  async function cutOne(uid, focus) {
    const it = state.items[uid];
    if (!it) return false;
    if (focus && uid === state.active) showSpinner(true);
    const hd = $("#hdEdges").checked;
    const r = await api().remove_background(uid, hd);
    if (focus && uid === state.active) showSpinner(false);
    if (!r || !r.ok) { toast("Cutout fail: " + (r && r.error || "?"), "err"); return false; }
    it.cut = true;
    const badge = thumbEl(uid) && thumbEl(uid).querySelector(".badge");
    if (badge) badge.classList.remove("hidden");
    if (uid === state.active) { await refreshPreview(); }
    setExportEnabled();
    return true;
  }

  async function cutAll() {
    const todo = state.order.filter((u) => !state.items[u].cut);
    if (!todo.length) { toast("Sab already cut ho chuki hain", "ok"); return; }
    toast("Batch shuru — " + todo.length + " tasveer…");
    for (let i = 0; i < todo.length; i++) {
      await cutOne(todo[i], true);
    }
    toast("✓ Sab ka background hat gaya", "ok");
  }

  // ---- preview -------------------------------------------------------- //
  async function refreshPreview() {
    const uid = state.active;
    if (!uid) return;
    const it = state.items[uid];
    if (state.showOriginal) {
      const r = await api().original_preview(uid);
      if (r && r.ok) $("#previewImg").src = r.preview;
      $("#canvas").classList.remove("checker");
      return;
    }
    if (!it.cut) {
      // no cutout yet — show original on checker
      const r = await api().original_preview(uid);
      if (r && r.ok) $("#previewImg").src = r.preview;
      $("#canvas").classList.add("checker");
      return;
    }
    const r = await api().preview(uid, state.bg);
    if (r && r.ok) $("#previewImg").src = r.preview;
    $("#canvas").classList.toggle("checker", state.bg.type === "transparent");
  }

  function toggleCompare() {
    if (!state.active) return;
    state.showOriginal = !state.showOriginal;
    $("#toggleCompare").textContent = state.showOriginal ? "🎨 Result dekhein" : "👁 Original dekhein";
    refreshPreview();
  }

  function showSpinner(on) { $("#spinner").classList.toggle("hidden", !on); }

  // ---- background image ---------------------------------------------- //
  async function pickBgImage() {
    const r = await api().pick_background_image();
    if (!r || !r.ok) return;
    state.bg = { type: "image", value: r.path };
    deselectSwatches();
    $("#bgImageThumb").src = r.thumb;
    $("#bgImageName").textContent = r.path.split(/[\\/]/).pop();
    $("#bgImageInfo").classList.remove("hidden");
    refreshPreview();
  }
  function clearBgImage(reset) {
    $("#bgImageInfo").classList.add("hidden");
    if (reset) {
      state.bg = { type: "transparent" };
      const t = $('.sw-transparent'); if (t) selectSwatch(t);
    }
  }

  // ---- export --------------------------------------------------------- //
  function setExportEnabled() {
    const anyCut = state.order.some((u) => state.items[u].cut);
    const activeCut = state.active && state.items[state.active] && state.items[state.active].cut;
    $("#exportBtn").disabled = !activeCut;
    $("#exportAllBtn").disabled = !anyCut;
  }

  async function doExport(uids) {
    uids = (uids || []).filter((u) => u && state.items[u] && state.items[u].cut);
    if (!uids.length) { toast("Pehle background hatao", "err"); return; }
    const opts = {
      format: state.format,
      bg: state.bg,
      preset: state.preset,
      jpg_bg: state.bg.type === "color" ? state.bg.value : "#ffffff",
    };
    const r = await api().export(uids, opts);
    if (!r || !r.ok) { toast("Export fail: " + (r && r.error || "?"), "err"); return; }
    toast("✓ " + r.count + " file save hui", "ok");
    api().open_export_dir();
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
})();
