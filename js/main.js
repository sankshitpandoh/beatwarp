import { Renderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { Recorder, download, stamp } from './recorder.js';
import { MODES, PARAM_GROUPS, DEFAULTS, PRESETS } from './config.js';
import { PRESET_PALETTES, presetPalette, extractPalette, hueRotate, toCss } from './palette.js';
import { makeSampleImage } from './sample.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

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
  aspect: 'fill',
  time: 0,
  hue: 0,
};

// ---------- toast -------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- picture -----------------------------------------------------------
let camStream = null;
let videoUrl = null;

function stopVideoSource() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = null; }
  $('[data-action=camera]').classList.remove('on');
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
      toast('Could not read that image');
      return;
    }
    usePicture(img);
    URL.revokeObjectURL(url);
    toast(`Image loaded: ${file.name}`);
  }
  hideIntro();
}

async function useCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    stopVideoSource();
    camStream = stream;
    const v = document.createElement('video');
    Object.assign(v, { srcObject: stream, muted: true, playsInline: true });
    await v.play();
    usePicture(v, true);
    $('[data-action=camera]').classList.add('on');
    setMode(MODES.findIndex(m => m.name === 'breathe'));
    hideIntro();
  } catch (e) {
    toast('Camera unavailable: ' + e.message);
  }
}

// ---------- audio -------------------------------------------------------------
function refreshAudioUi() {
  $$('#audioSrc button').forEach(b => b.classList.toggle('on', b.dataset.src === audio.kind));
  $('#playBtn .ico').className = `ico ${audio.playing ? 'pause' : 'play'}`;
  $('#playBtn .lbl').textContent = audio.playing ? 'Pause' : 'Play';
  $('#playBtn').disabled = audio.kind === 'mic' || audio.kind === 'none';
  $('#audioStatus').textContent = {
    none: 'No audio yet — pick a source',
    demo: 'Built-in demo beat (122 bpm)',
    file: `Playing file: ${audio.fileName || ''}`,
    mic: 'Listening to microphone',
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
    toast(`${kind === 'mic' ? 'Microphone' : 'Audio'} unavailable: ${e.message}`);
  }
  refreshAudioUi();
}

async function loadAudioFile(file) {
  try {
    await audio.useFile(file);
    audio.setVolume(+$('#volume').value);
    audio.setGain(state.params.gain);
    toast(`Audio loaded: ${file.name}`);
  } catch (e) {
    toast('Could not play that audio: ' + e.message);
  }
  refreshAudioUi();
  hideIntro();
}

// ---------- modes & params -----------------------------------------------------
function setMode(i) {
  state.mode = (i + MODES.length) % MODES.length;
  $$('#modes button').forEach((b, j) => b.classList.toggle('on', j === state.mode));
  $('#modeHint').textContent = MODES[state.mode].hint;
  const n = $('#modeName');
  n.textContent = MODES[state.mode].name;
  n.classList.add('show');
  clearTimeout(n._t);
  n._t = setTimeout(() => n.classList.remove('show'), 1400);
}

function buildModes() {
  const box = $('#modes');
  MODES.forEach((m, i) => {
    const b = document.createElement('button');
    b.textContent = m.name;
    b.title = m.hint;
    b.onclick = () => setMode(i);
    box.appendChild(b);
  });
}

const fmt = (p, v) => (p.names ? p.names[v] : p.step >= 1 ? String(v) : (+v).toFixed(2));

function buildParams() {
  const root = $('#params');
  for (const g of PARAM_GROUPS) {
    const sec = document.createElement('div');
    sec.className = 'group';
    sec.innerHTML = `<h2>${g.title}</h2>`;
    for (const p of g.params) {
      const row = document.createElement('div');
      row.className = 'param';
      const id = 'p-' + p.key;
      row.innerHTML = `<label for="${id}">${p.label}</label>
        <input type="range" id="${id}" min="${p.min}" max="${p.max}" step="${p.step}">
        <output></output>`;
      const input = row.querySelector('input'), out = row.querySelector('output');
      input.oninput = () => {
        state.params[p.key] = +input.value;
        out.textContent = fmt(p, +input.value);
        if (p.key === 'gain') audio.setGain(+input.value);
      };
      input.ondblclick = () => setParam(p.key, p.def);
      row._sync = () => { input.value = state.params[p.key]; out.textContent = fmt(p, state.params[p.key]); };
      row.dataset.key = p.key;
      sec.appendChild(row);
    }
    root.appendChild(sec);
  }
  syncParams();
}

function setParam(k, v) {
  state.params[k] = v;
  if (k === 'gain') audio.setGain(v);
  syncParams();
}

function syncParams() {
  $$('.param').forEach(r => r._sync());
}

// ---------- palettes -----------------------------------------------------------
function renderPalettes() {
  const box = $('#palettes');
  box.innerHTML = '';
  for (const name of Object.keys(PRESET_PALETTES)) {
    const pal = name === 'Photo' ? state.photoPalette : presetPalette(name);
    const b = document.createElement('button');
    b.className = name === state.paletteName ? 'on' : '';
    b.innerHTML = `<span class="sw">${pal.map(c => `<i style="background:${toCss(c)}"></i>`).join('')}</span>${name}`;
    b.onclick = () => { state.paletteName = name; renderPalettes(); };
    box.appendChild(b);
  }
}

const currentPalette = () =>
  hueRotate(state.paletteName === 'Photo' ? state.photoPalette : presetPalette(state.paletteName), state.hue);

// ---------- presets -----------------------------------------------------------
function buildPresets() {
  const sel = $('#presets');
  sel.innerHTML = '<option value="">Choose a look…</option>' +
    PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
  sel.onchange = () => {
    if (sel.value === '') return;
    applyPreset(PRESETS[+sel.value]);
  };
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
  state.paletteName = pick(Object.keys(PRESET_PALETTES));
  syncParams();
  renderPalettes();
  $('#presets').value = '';
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
function hideIntro() {
  $('#intro').hidden = true;
}

function startDemoIfSilent() {
  if (audio.kind === 'none') setAudio('demo');
}

async function toggleRecord() {
  const b = $('#recBtn');
  if (recorder.active) {
    await recorder.stop();
    b.classList.remove('on');
    b.querySelector('.ico').className = 'ico rec';
    b.querySelector('.lbl').textContent = 'Record clip';
    $('#recBadge').hidden = true;
    toast('Clip saved to your downloads');
    layout();
    return;
  }
  audio.ensure();
  if (audio.kind === 'none') setAudio('demo');
  try {
    recorder.start(canvas, audio.recDest && audio.recDest.stream);
  } catch (e) {
    toast('Recording not supported here: ' + e.message);
    return;
  }
  b.classList.add('on');
  b.querySelector('.ico').className = 'ico stop';
  b.querySelector('.lbl').textContent = 'Stop and save';
  $('#recBadge').hidden = false;
}

function snapshot() {
  canvas.toBlob(b => b && download(b, `beatwarp-${stamp()}.png`), 'image/png');
}

function togglePanel(force) {
  const hidden = force ?? !$('#app').classList.contains('panel-hidden');
  $('#app').classList.toggle('panel-hidden', hidden);
  $('#showPanel').hidden = !hidden;
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
  sample: () => { stopVideoSource(); usePicture(makeSampleImage()); },
  snapshot,
  play: () => { audio.toggle(); refreshAudioUi(); },
  random: randomize,
  record: toggleRecord,
  fullscreen,
  reset: () => { state.params = { ...DEFAULTS }; state.hue = 0; syncParams(); audio.setGain(1); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action]();
});
$$('#audioSrc button').forEach(b => (b.onclick = () => setAudio(b.dataset.src)));
$('#volume').oninput = e => audio.setVolume(+e.target.value);
$('#aspect').onchange = e => { state.aspect = e.target.value; layout(); };
$('#hidePanel').onclick = () => togglePanel(true);
$('#showPanel').onclick = () => togglePanel(false);

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
  if (e.target.matches('input, select, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); if (audio.kind === 'none') setAudio('demo'); else actions.play(); }
  else if (k === 'arrowright') setMode(state.mode + 1);
  else if (k === 'arrowleft') setMode(state.mode - 1);
  else if (k === 'r') randomize();
  else if (k === 'h') togglePanel();
  else if (k === 'f') fullscreen();
});

new ResizeObserver(layout).observe(stage);

// ---------- loop -------------------------------------------------------------------
const meters = Object.fromEntries($$('#meters span').map(s => [s.dataset.band, s.querySelector('i')]));
let last = performance.now();
let recShown = -1;

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
    audio: a,
    palette: currentPalette().flat(),
  });

  for (const k in meters) meters[k].style.setProperty('--v', a[k].toFixed(3));
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
layout();
requestAnimationFrame(frame);

// expose for debugging / automated checks
window.__viz = { state, audio, renderer, setMode, applyPreset, randomize };
