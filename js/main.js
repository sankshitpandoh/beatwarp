import { Renderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { Recorder, download, stamp } from './recorder.js';
import { MODES, PARAM_GROUPS, DEFAULTS, PRESETS } from './config.js';
import { PRESET_PALETTES, presetPalette, extractPalette, hueRotate, toCss } from './palette.js';
import { makeSampleImage } from './sample.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const press = (el, on) => el.setAttribute('aria-pressed', String(!!on));
const isPhone = () => matchMedia('(max-width: 760px)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = $('#view');
const stage = $('#stage');
let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  $('#intro .intro-card').innerHTML = `<h1>Sorry</h1><p>${e.message}</p>`;
  throw e;
}
const audio = new AudioEngine();
const recorder = new Recorder();

const state = {
  mode: 1,
  params: { ...DEFAULTS },
  paletteName: 'Photo',
  photoPalette: presetPalette('Neon'),
  aspect: isPhone() ? '9:16' : 'fill',
  time: 0,
  hue: 0,
  preset: -1,
  calm: reducedMotion,
  keys: true,
};

// ---------- toast -------------------------------------------------------------
let toastTimer;
function announce(msg, urgent = false) {
  const el = $(urgent ? '#srAlert' : '#srStatus');
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = msg));
}

function toast(msg, { error = false, action = null } = {}) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', error);
  announce(msg, error);
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { action.fn(); t.classList.remove('show'); t.replaceChildren(); };
    t.appendChild(b);
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); t.replaceChildren(); }, error || action ? 6000 : 2600);
}

// ---------- picture -----------------------------------------------------------
let camStream = null;
let videoUrl = null;

function stopVideoSource() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = null; }
  press($('[data-action=camera]'), false);
}

function usePicture(source, isVideo = false) {
  renderer.setSource(source, isVideo);
  try {
    state.photoPalette = extractPalette(source);
  } catch (_) { /* tainted or not ready: keep previous */ }
  renderPalettes();
}

async function loadImageFile(file) {
  stopVideoSource();
  if (file.type.startsWith('video/')) {
    const v = document.createElement('video');
    videoUrl = URL.createObjectURL(file);
    Object.assign(v, { src: videoUrl, loop: true, muted: true, playsInline: true });
    await v.play();
    usePicture(v, true);
    toast(`Video loaded: ${file.name}`);
  } else {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (_) {
      toast('Could not read that image. Try a JPG, PNG or WebP.', { error: true });
      return;
    }
    usePicture(img);
    URL.revokeObjectURL(url);
    toast(`Image loaded: ${file.name}`);
  }
  hideIntro();
}

async function useCamera() {
  if (camStream) { stopVideoSource(); usePicture(makeSampleImage()); toast('Camera off'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    stopVideoSource();
    camStream = stream;
    const v = document.createElement('video');
    Object.assign(v, { srcObject: stream, muted: true, playsInline: true });
    await v.play();
    usePicture(v, true);
    press($('[data-action=camera]'), true);
    setMode(MODES.findIndex(m => m.name === 'breathe'));
    hideIntro();
  } catch (e) {
    toast('Camera unavailable. Allow camera access in the address bar, then try again.', { error: true });
  }
}

// ---------- audio -------------------------------------------------------------
function refreshAudioUi() {
  $$('#audioSrc button').forEach(b => press(b, b.dataset.src === audio.kind));
  const play = $('#playBtn');
  play.querySelector('.ico').className = `ico ${audio.playing ? 'pause' : 'play'}`;
  play.classList.toggle('playing', audio.playing);
  play.setAttribute('aria-label', audio.playing ? 'Pause' : 'Play');
  play.title = audio.playing ? 'Pause (Space)' : 'Play (Space)';
  play.disabled = audio.kind === 'mic';
  const paused = audio.kind !== 'mic' && audio.kind !== 'none' && !audio.playing;
  $('#audioStatus').textContent = paused ? 'Paused — press play' : {
    none: 'No music yet — pick a source above',
    demo: 'Demo beat · 122 bpm',
    file: `Playing ${audio.fileName || 'your song'}`,
    mic: 'Listening to the microphone',
  }[audio.kind];
}

async function setAudio(kind) {
  try {
    if (kind === 'demo') audio.useDemo();
    else if (kind === 'mic') await audio.useMic();
    else if (kind === 'file') { $('#audioInput').click(); return; }
    audio.setVolume(+$('#volume').value);
    audio.setGain(state.params.gain);
  } catch (e) {
    toast(kind === 'mic'
      ? 'Microphone unavailable. Allow mic access in the address bar, then try again.'
      : `Audio unavailable: ${e.message}`, { error: true });
  }
  refreshAudioUi();
}

async function loadAudioFile(file) {
  try {
    await audio.useFile(file);
    audio.setVolume(+$('#volume').value);
    audio.setGain(state.params.gain);
    toast(`Song loaded: ${file.name}`);
  } catch (e) {
    toast('Could not play that file. Try an MP3, M4A or WAV.', { error: true });
  }
  refreshAudioUi();
  hideIntro();
}

// ---------- modes & params -----------------------------------------------------
const pad = n => String(n).padStart(2, '0');
let booted = false;

function setMode(i) {
  state.mode = (i + MODES.length) % MODES.length;
  const m = MODES[state.mode];
  const btns = $$('#modes button');
  btns.forEach((b, j) => { press(b, j === state.mode); b.style.removeProperty('--kick'); });
  const strip = $('#modes'), cur = btns[state.mode];
  if (cur) strip.scrollTo({ left: cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2 });
  $('#modeIndex').textContent = `${pad(state.mode + 1)}/${MODES.length}`;
  $('#modeHint').textContent = m.hint;
  canvas.setAttribute('aria-label', `Visualizer output, mode ${m.label}`);
  if (booted) announce(`Mode ${state.mode + 1} of ${MODES.length}: ${m.label}`);
  const n = $('#modeName');
  n.querySelector('small').textContent = `Mode ${pad(state.mode + 1)}/${MODES.length}`;
  n.querySelector('span').textContent = m.label;
  n.classList.add('show');
  clearTimeout(n._t);
  n._t = setTimeout(() => n.classList.remove('show'), 1100);
}

function buildModes() {
  const box = $('#modes');
  MODES.forEach((m, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<b>${pad(i + 1)}</b>${m.label}`;
    b.title = m.hint;
    b.onclick = () => setMode(i);
    box.appendChild(b);
  });
}

const fmt = (p, v) => (p.names ? p.names[v] : p.step >= 1 ? String(v) : (+v).toFixed(2));
const fill = input => input.style.setProperty('--p', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);

function buildParams() {
  for (const g of PARAM_GROUPS) {
    const root = g.primary ? $('#feel') : $('#fine');
    if (!g.primary) {
      const h = document.createElement('h4');
      h.className = 'sub';
      h.textContent = g.title;
      root.appendChild(h);
    }
    for (const p of g.params) {
      const row = document.createElement('div');
      row.className = 'param';
      const id = 'p-' + p.key;
      row.innerHTML = `<label for="${id}">${p.label}</label>
        <input type="range" id="${id}" min="${p.min}" max="${p.max}" step="${p.step}" title="Double-click to reset">
        <output for="${id}" aria-hidden="true"></output>`;
      const input = row.querySelector('input'), out = row.querySelector('output');
      const show = v => {
        const text = fmt(p, v);
        out.textContent = text;
        input.setAttribute('aria-valuetext', text);
        fill(input);
      };
      input.oninput = () => {
        state.params[p.key] = +input.value;
        show(+input.value);
        if (p.key === 'gain') audio.setGain(+input.value);
        markPreset(-1);
      };
      input.ondblclick = () => setParam(p.key, p.def);
      row._sync = () => { input.value = state.params[p.key]; show(state.params[p.key]); };
      row.dataset.key = p.key;
      root.appendChild(row);
    }
  }
  syncParams();
}

function setParam(k, v) {
  state.params[k] = v;
  if (k === 'gain') audio.setGain(v);
  syncParams();
}

function syncParams() {
  $$('.param').forEach(r => r._sync && r._sync());
}

// ---------- palettes -----------------------------------------------------------
const PALETTE_NAMES = Object.keys(PRESET_PALETTES);

function renderPalettes() {
  const box = $('#palettes');
  box.innerHTML = '';
  for (const name of PALETTE_NAMES) {
    const pal = name === 'Photo' ? state.photoPalette : presetPalette(name);
    const b = document.createElement('button');
    press(b, name === state.paletteName);
    b.innerHTML = `<span class="sw">${pal.map(c => `<i style="background:${toCss(c)}"></i>`).join('')}</span>${name}`;
    b.onclick = () => { state.paletteName = name; markPreset(-1); renderPalettes(); };
    box.appendChild(b);
  }
}

function stepPalette(d) {
  const i = PALETTE_NAMES.indexOf(state.paletteName);
  state.paletteName = PALETTE_NAMES[(i + d + PALETTE_NAMES.length) % PALETTE_NAMES.length];
  renderPalettes();
  toast(`Palette: ${state.paletteName}`);
}

const currentPalette = () =>
  hueRotate(state.paletteName === 'Photo' ? state.photoPalette : presetPalette(state.paletteName), state.hue);

// ---------- looks: presets, mutate, undo -----------------------------------------
const history = [];

function pushHistory() {
  history.push({ mode: state.mode, params: { ...state.params }, paletteName: state.paletteName, preset: state.preset });
  if (history.length > 30) history.shift();
  $('#undoBtn').disabled = false;
}

function undo() {
  const h = history.pop();
  $('#undoBtn').disabled = !history.length;
  if (!h) return;
  state.params = h.params;
  state.paletteName = h.paletteName;
  audio.setGain(state.params.gain);
  setMode(h.mode);
  syncParams();
  renderPalettes();
  markPreset(h.preset);
  toast('Undone');
}

function markPreset(i) {
  state.preset = i;
  $$('#presets button').forEach((b, j) => press(b, j === i));
}

function buildPresets() {
  const box = $('#presets');
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<b>${pad(i + 1)}</b>${p.name}`;
    press(b, false);
    b.onclick = () => { pushHistory(); applyPreset(p); markPreset(i); };
    box.appendChild(b);
  });
}

function applyPreset(p) {
  const keep = { react: state.params.react, decay: state.params.decay, gain: state.params.gain };
  state.params = { ...DEFAULTS, ...p.params, ...keep };
  state.paletteName = p.palette;
  setMode(MODES.findIndex(m => m.name === p.mode));
  syncParams();
  renderPalettes();
}

function randomize() {
  pushHistory();
  const r = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const P = state.params;
  setMode(Math.floor(Math.random() * MODES.length));
  P.symmetry = Math.random() < .45 ? pick([1, 2, 3, 4, 6, 8]) : 0;
  P.spin = r(-.5, .5);
  P.tiles = Math.random() < .15 ? pick([1, 2]) : 0;
  P.twist = Math.random() < .4 ? r(-.6, .6) : 0;
  P.slice = Math.random() < .2 ? r(.1, .6) : 0;
  P.lens = Math.random() < .4 ? r(.2, .7) : 0;
  P.lensStyle = 1 + Math.floor(Math.random() * 7);
  P.chaos = r(.1, .7);
  P.trails = r(0, .5);
  P.heat = r(.4, 1.1);
  P.vignette = r(.1, .6);
  P.hueDrift = Math.random() < .3 ? r(.1, .5) : 0;
  P.wet = 1;
  state.paletteName = pick(PALETTE_NAMES);
  syncParams();
  renderPalettes();
  markPreset(-1);
  toast('Mutated', { action: { label: 'Undo', fn: undo } });
}

function snapshot() {
  canvas.toBlob(b => {
    if (!b) return;
    download(b, `beatwarp-${stamp()}.png`);
    toast('PNG saved to your downloads');
  }, 'image/png');
}

// ---------- layout -------------------------------------------------------------
function layout() {
  const sw = stage.clientWidth, sh = stage.clientHeight;
  let w = sw, h = sh;
  if (state.aspect !== 'fill') {
    const [a, b] = state.aspect.split(':').map(Number);
    const ratio = a / b;
    if (sw / sh > ratio) { h = sh; w = sh * ratio; } else { w = sw; h = sw / ratio; }
  }
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
  // cap internal resolution so heavy modes stay smooth
  let scale = Math.min(window.devicePixelRatio || 1, 2);
  const maxPx = 2.4e6;
  if (w * h * scale * scale > maxPx) scale = Math.sqrt(maxPx / (w * h));
  if (!recorder.active) renderer.resize(w * scale, h * scale);
}

// ---------- UI wiring -----------------------------------------------------------
function setIntro(open) {
  $('#intro').hidden = !open;
  for (const el of $$('.hud, #panel')) el.inert = open;
}

function hideIntro() {
  if ($('#intro').hidden) return;
  setIntro(false);
  $('#playBtn').focus({ preventScroll: true });
}

function startDemoIfSilent() {
  if (audio.kind === 'none') setAudio('demo');
}

async function toggleRecord() {
  const b = $('#recBtn');
  if (recorder.active) {
    const clip = await recorder.stop();
    b.classList.remove('on');
    b.querySelector('.ico').className = 'ico rec';
    b.querySelector('.lbl').textContent = 'Record';
    $('#recBadge').hidden = true;
    $('#app').classList.remove('recording');
    layout();
    announce('Recording stopped');
    if (document.fullscreenElement) { download(clip.blob, clip.name); toast('Clip saved to your downloads'); }
    else showClip(clip);
    return;
  }
  audio.ensure();
  if (audio.kind === 'none') { setAudio('demo'); toast('Recording with the demo beat'); }
  try {
    recorder.start(canvas, audio.recDest && audio.recDest.stream);
  } catch (e) {
    toast('Recording is not supported in this browser.', { error: true });
    return;
  }
  b.classList.add('on');
  announce('Recording started');
  b.querySelector('.ico').className = 'ico rec stop';
  b.querySelector('.lbl').textContent = 'Stop';
  $('#recTime').textContent = '0:00';
  $('#recBadge').hidden = false;
  $('#app').classList.add('recording');
}

// after recording: preview the clip, then share (phones) or save it
function showClip({ blob, name }) {
  const dlg = $('#clip'), video = $('#clipVideo');
  const url = URL.createObjectURL(blob);
  video.src = url;
  const file = new File([blob], name, { type: blob.type });
  const canShare = !!navigator.canShare?.({ files: [file] });
  $('#clipShare').hidden = !canShare;
  $('#clipSave').classList.toggle('primary', !canShare);
  $('#clipHint').hidden = !(canShare && /iPhone|iPad/.test(navigator.userAgent));
  $('#clipShare').onclick = async () => {
    try { await navigator.share({ files: [file], title: 'Beatwarp clip' }); dlg.close(); } catch (_) { /* cancelled */ }
  };
  $('#clipSave').onclick = () => { download(blob, name); toast('Clip saved to your downloads'); dlg.close(); };
  $('#clipClose').onclick = () => dlg.close();
  dlg.oncancel = e => e.preventDefault();
  dlg.onclose = () => { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); };
  dlg.showModal();
}

function togglePanel(force) {
  const app = $('#app');
  const hidden = force ?? !app.classList.contains('panel-hidden');
  const panel = $('#panel');
  const hadFocus = panel.contains(document.activeElement);
  app.classList.toggle('panel-hidden', hidden);
  for (const b of [$('#panelToggle'), $('#sheetBtn')]) b.setAttribute('aria-expanded', String(!hidden));
  if (!hidden && booted) $('#hidePanel').focus({ preventScroll: true });
  if (hidden && hadFocus) $(isPhone() ? '#sheetBtn' : '#panelToggle').focus({ preventScroll: true });
  requestAnimationFrame(layout);
}

function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else stage.requestFullscreen?.().catch(() => {});
}

const actions = {
  'upload-image': () => { $('#imageInput').click(); },
  'start-demo': () => { setAudio('demo'); hideIntro(); },
  camera: () => { useCamera(); startDemoIfSilent(); },
  sample: () => { stopVideoSource(); usePicture(makeSampleImage()); toast('Sample picture loaded'); },
  snapshot,
  play: () => { if (audio.kind === 'none') setAudio('demo'); else { audio.toggle(); refreshAudioUi(); } },
  random: randomize,
  undo,
  record: toggleRecord,
  fullscreen,
  help: () => $('#keys').showModal(),
  'prev-mode': () => setMode(state.mode - 1),
  'next-mode': () => setMode(state.mode + 1),
  reset: () => {
    pushHistory();
    state.params = { ...DEFAULTS }; state.hue = 0; syncParams(); audio.setGain(1); markPreset(-1);
    toast('Sliders reset', { action: { label: 'Undo', fn: undo } });
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action]();
});
$$('#audioSrc button').forEach(b => (b.onclick = () => setAudio(b.dataset.src)));
const vol = $('#volume');
vol.oninput = () => {
  audio.setVolume(+vol.value);
  $('#volOut').textContent = `${Math.round(vol.value * 100)}%`;
  vol.setAttribute('aria-valuetext', `${Math.round(vol.value * 100)}%`);
  fill(vol);
};
fill(vol);
$('#aspect').value = state.aspect;
$('#aspect').onchange = e => { state.aspect = e.target.value; layout(); e.target.blur(); };
$('#keysOn').onchange = e => { state.keys = e.target.checked; };
$('#calm').checked = state.calm;
$('#calm').onchange = e => { state.calm = e.target.checked; toast(state.calm ? 'Flashing reduced' : 'Full flashing'); };
$('#hidePanel').onclick = () => togglePanel(true);
$('#panelToggle').onclick = () => togglePanel();
$('#sheetBtn').onclick = () => togglePanel();

$('#imageInput').onchange = e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) { loadImageFile(f); startDemoIfSilent(); }
};
$('#audioInput').onchange = e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) loadAudioFile(f);
};

// drag & drop anywhere: images/videos become the picture, audio becomes the music
let dragDepth = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('#drop').hidden = false; });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop').hidden = true;
  for (const f of e.dataTransfer.files) {
    if (f.type.startsWith('audio/')) loadAudioFile(f);
    else if (f.type.startsWith('image/') || f.type.startsWith('video/')) { loadImageFile(f); startDemoIfSilent(); }
  }
});

// paste an image from the clipboard
window.addEventListener('paste', e => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (item) { loadImageFile(item.getAsFile()); startDemoIfSilent(); }
});

window.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || !$('#intro').hidden) return;
  if (e.key === 'Escape') { if (isPhone()) togglePanel(true); return; }
  if (e.target.matches('select, textarea, input:not([type=range]):not([type=checkbox])')) return;
  // sliders and switches keep their own arrow / space keys
  if (e.target.matches('input') && [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    return;
  }
  if (!state.keys) return;
  const k = e.key.toLowerCase();
  // space and enter keep their normal meaning on a focused button
  if ((k === ' ' || k === 'enter') && e.target.closest('button, summary')) return;
  if (e.code.startsWith('Digit')) {
    const d = (+e.code.slice(5) + 9) % 10; // 1..9,0 -> 0..9
    setMode(d + (e.shiftKey ? 10 : 0));
    return;
  }
  if (e.repeat && 'rhfcz?'.includes(k)) return;
  if (k === ' ') { e.preventDefault(); actions.play(); }
  else if (k === 'arrowright') setMode(state.mode + 1);
  else if (k === 'arrowleft') setMode(state.mode - 1);
  else if (k === ']') stepPalette(1);
  else if (k === '[') stepPalette(-1);
  else if (k === 'r') randomize();
  else if (k === 'z') undo();
  else if (k === 'c') toggleRecord();
  else if (k === 'h') {
    if (document.fullscreenElement) $('#app').classList.toggle('idle');
    else togglePanel();
  }
  else if (k === 'f') fullscreen();
  else if (k === '?' || k === '/') actions.help();
});

document.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse') e.target.closest('button, summary')?.blur();
});

// phones: swipe sideways on the picture to change mode, tap it to close the sheet
let touch = null;
stage.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' && e.target === canvas) touch = { x: e.clientX, y: e.clientY };
});
stage.addEventListener('pointerup', e => {
  if (!touch) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) setMode(state.mode + (dx < 0 ? 1 : -1));
  else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && isPhone()) togglePanel(true);
});
stage.addEventListener('pointercancel', () => (touch = null));

// desktop: the heads-up layer fades away when the mouse rests, so the picture has the screen
let idleTimer;
function wake(e) {
  $('#app').classList.remove('idle');
  clearTimeout(idleTimer);
  if (e?.target?.closest?.('.hud, #panel')) return;
  idleTimer = setTimeout(() => {
    if (document.activeElement?.closest('.hud')) return;
    if ($('#intro').hidden && !document.querySelector('dialog[open]')) $('#app').classList.add('idle');
  }, 3000);
}
if (matchMedia('(pointer: fine)').matches) {
  window.addEventListener('pointermove', wake);
}

new ResizeObserver(layout).observe(stage);

// ---------- loop -------------------------------------------------------------------
const meters = Object.fromEntries($$('#meters span').map(s => [s.dataset.band, s.querySelector('i')]));
// only these few small elements breathe with the beat; setting --kick on them alone keeps restyles cheap
const pulsers = () => [$('.nucleus'), $('.transport'), $('#modeName'), $('#dock'), $('#modes button[aria-pressed="true"]')];
let last = performance.now();
let recShown = -1;
let uiKick = 0;
let lastKick = '';

function frame(now) {
  const dt = Math.min((now - last) / 1000, .1);
  last = now;
  const P = state.params;
  const a = audio.update(dt, P.react, P.decay);
  state.time += dt * P.speed * (.55 + a.energy * .9);
  state.hue = (state.hue + dt * P.hueDrift * .08) % 1;

  renderer.render({
    time: state.time,
    mode: state.mode,
    params: P,
    // reduce flashing: soften the kick that drives the big brightness jumps
    audio: state.calm ? { ...a, kick: a.kick * .3 } : a,
    palette: currentPalette().flat(),
  });

  for (const k in meters) meters[k].style.setProperty('--v', a[k].toFixed(3));
  // the UI's own pulse: rises with the kick and settles smoothly, never strobes
  if (!reducedMotion) {
    uiKick = Math.max(a.kick, uiKick * .85);
    const v = uiKick.toFixed(2);
    if (v !== lastKick) { lastKick = v; for (const el of pulsers()) el?.style.setProperty('--kick', v); }
  }
  if (recorder.active) {
    const s = Math.floor((now - recorder.started) / 1000);
    if (s !== recShown) {
      recShown = s;
      $('#recTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }
  requestAnimationFrame(frame);
}

// ---------- boot -------------------------------------------------------------------
buildModes();
buildParams();
buildPresets();
usePicture(makeSampleImage());
setMode(state.mode);
refreshAudioUi();
if (isPhone()) togglePanel(true);
setIntro(true);
$('#intro .intro-card').focus({ preventScroll: true });
layout();
booted = true;
requestAnimationFrame(frame);

// expose for debugging / automated checks
window.__viz = { state, audio, renderer, setMode, applyPreset, randomize, undo };
