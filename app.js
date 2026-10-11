import { DEFAULTS, PRESETS, GROUPS, effectiveParams, cropRect, outputSize, processPixels } from './engine.js';
import { CAMERAS } from './cameras.js';
import { attachZoom } from './preview-zoom.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const freshState = () => ({ preset: 'alpine', strength: 80, camera: null, cameraStrength: 75, adjustments: { ...DEFAULTS }, ratio: 'original', cropX: 50, cropY: 50, rotation: 0 });
let state = freshState();
let source = null, rotated = null, sourceName = 'Alpine afternoon.png';
let history = [], historyIndex = -1;
let previewVersion = 0, previewTimer, rendering = false, renderAgain = false;
let loading = false, loadVersion = 0, toastTimer, exportVersion = 0, exportURL;
let exportBlob = null, exportFilename = '', jobId = 0;
let heifTask = null;
const pendingJobs = new Map();
let worker;
try {
  worker = new Worker('./worker.js', { type: 'module' });
  worker.onmessage = ({ data }) => {
    const job = pendingJobs.get(data.id);
    if (!job) return;
    pendingJobs.delete(data.id);
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(new ImageData(new Uint8ClampedArray(data.pixels), data.width, data.height));
  };
  worker.onerror = () => {
    for (const job of pendingJobs.values()) job.reject(new Error('The editing worker stopped. Please try again.'));
    pendingJobs.clear(); worker.terminate(); worker = null;
  };
} catch { worker = null; }
function pixelsInWorker(imageData, params) {
  if (!worker) return Promise.resolve(new ImageData(processPixels(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height));
  return new Promise((resolve, reject) => {
    const id = ++jobId;
    pendingJobs.set(id, { resolve, reject });
    worker.postMessage({ id, pixels: imageData.data.buffer, width: imageData.width, height: imageData.height, params }, [imageData.data.buffer]);
  });
}
function canvas(width, height) {
  const element = document.createElement('canvas'); element.width = width; element.height = height; return element;
}
function toast(message) {
  $('#toast').textContent = message; $('#toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 6000);
}
function fillRange(element) { element.style.setProperty('--fill', `${(element.value - element.min) / (element.max - element.min) * 100}%`); }
function checkpoint() {
  const snapshot = JSON.stringify(state);
  if (history[historyIndex] === snapshot) return;
  history = history.slice(0, historyIndex + 1); history.push(snapshot);
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1; updateHistory();
}
function updateHistory() { $('#undo').disabled = historyIndex <= 0; $('#redo').disabled = historyIndex >= history.length - 1; }
function syncControls() {
  const params = effectiveParams(state);
  for (const [key] of GROUPS.flatMap(g => g.sliders)) {
    const element = $(`#slider-${key}`); element.value = Math.round(params[key]);
    $(`#value-${key}`).textContent = element.value > 0 ? `+${element.value}` : element.value;
    fillRange(element);
  }
  $('#strength').value = state.strength; $('#strength-value').value = `${state.strength}%`; fillRange($('#strength'));
  $$('.look-card').forEach(button => { const active = button.dataset.preset === state.preset; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  $$('.crop-options button').forEach(button => { const active = button.dataset.ratio === state.ratio; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  $('#crop-position').hidden = state.ratio === 'original';
  $('#crop-x').value = state.cropX; $('#crop-y').value = state.cropY;
  fillRange($('#crop-x')); fillRange($('#crop-y'));
  const preset = PRESETS.find(p => p.id === state.preset);
  $('#active-look-name').textContent = preset ? `Selected: ${preset.name}` : 'No creative look applied';
  const camera = CAMERAS.find(c => c.id === state.camera);
  const cameraName = camera ? `${camera.brand} ${camera.model}` : 'Original camera';
  $('#camera-name').textContent = cameraName; $('#camera-name').title = cameraName;
  $('#camera-controls').hidden = !camera;
  $('#camera-strength').value = state.cameraStrength; $('#camera-strength-value').value = `${state.cameraStrength}%`; fillRange($('#camera-strength'));
  $('#camera-selection-label').textContent = camera ? `${cameraName} · ${state.cameraStrength}% strength` : 'Original camera · no simulation';
  $$('.camera-card').forEach(card => { const active = card.dataset.camera === state.camera; card.classList.toggle('active', active); card.setAttribute('aria-pressed', active); });
  const styleNames = [camera ? cameraName : null, preset?.name].filter(Boolean);
  $('#preview-status').textContent = styleNames.length ? `${styleNames.join(' + ')} · Live preview` : 'Original + your adjustments';
  $('#preview-status').title = $('#preview-status').textContent;
  updateHistory();
}
for (const group of GROUPS) {
  const details = document.createElement('details'); details.className = 'slider-group'; details.open = group.name === 'Light';
  details.addEventListener('toggle', () => {
    if (details.open) $$('.slider-group').forEach(other => { if (other !== details) other.open = false; });
  });
  const summary = document.createElement('summary'); summary.innerHTML = `<span>${group.icon} &nbsp; ${group.name}</span>`; details.append(summary);
  for (const [key, label, min, max, description] of group.sliders) {
    const row = document.createElement('div'); row.className = 'slider-row';
    row.innerHTML = `<label for="slider-${key}">${label}<button type="button" aria-label="Reset ${label} to selected style" title="Reset to selected style">↺</button><output id="value-${key}" for="slider-${key}">0</output></label><input id="slider-${key}" type="range" min="${min}" max="${max}" value="0" aria-label="${label}" aria-describedby="hint-${key}"><p class="slider-description" id="hint-${key}">${description}</p>`;
    const slider = row.querySelector('input');
    slider.addEventListener('input', () => {
      const preset = PRESETS.find(p => p.id === state.preset);
      const camera = CAMERAS.find(c => c.id === state.camera);
      state.adjustments[key] = Number(slider.value) - (preset?.params[key] || 0) * state.strength / 100 - (camera?.params[key] || 0) * state.cameraStrength / 100;
      syncControls(); requestPreview();
    });
    slider.addEventListener('change', checkpoint);
    row.querySelector('button').addEventListener('click', () => { state.adjustments[key] = 0; syncControls(); checkpoint(); requestPreview(); });
    details.append(row);
  }
  $('#slider-groups').append(details);
}
for (const preset of PRESETS) {
  const button = document.createElement('button'); button.className = 'look-card'; button.dataset.preset = preset.id; button.dataset.category = preset.category;
  button.innerHTML = `<img src="./assets/alpine-original.png" alt="" width="58" height="48"><span><strong>${preset.name}</strong><small>${preset.subtitle}</small></span><span class="selected-dot" aria-hidden="true">✓</span>`;
  button.addEventListener('click', () => { if (!state.preset) state.strength = 80; state.preset = preset.id; state.adjustments = { ...DEFAULTS }; syncControls(); checkpoint(); requestPreview(); });
  $('#looks').append(button);
}
let lookCategory = 'all';
function filterLooks() {
  const query = $('#look-search').value.trim().toLocaleLowerCase();
  let count = 0;
  $$('.look-tabs button').forEach(button => { const active = button.dataset.category === lookCategory; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  $$('.look-card').forEach(card => {
    const matchesCategory = lookCategory === 'all' || card.dataset.category === lookCategory;
    const matchesQuery = card.textContent.toLocaleLowerCase().includes(query);
    card.hidden = !(matchesCategory && matchesQuery);
    if (!card.hidden) count++;
  });
  $('#look-count').textContent = `${count} ${count === 1 ? 'look' : 'looks'}`;
  $('#looks-empty').hidden = count !== 0;
  $('#looks').scrollTop = 0;
}
$$('.look-tabs button').forEach(button => button.addEventListener('click', () => { lookCategory = button.dataset.category; filterLooks(); }));
$('#look-search').addEventListener('input', filterLooks);
filterLooks();
$('#strength').addEventListener('input', () => { state.strength = Number($('#strength').value); syncControls(); requestPreview(); });
$('#strength').addEventListener('change', checkpoint);
for (const profile of CAMERAS) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'camera-card'; button.dataset.camera = profile.id; button.dataset.brand = profile.brand;
  button.innerHTML = `<div class="camera-card-image"><img src="./assets/alpine-original.png" alt="" width="160" height="112"><span class="camera-selected" aria-hidden="true">✓</span></div><div class="camera-card-copy"><small>${profile.brand.toUpperCase()} · ${profile.type}</small><strong>${profile.model}</strong><span>${profile.feel}</span><p>${profile.description}</p></div>`;
  button.addEventListener('click', () => { state.camera = profile.id; syncControls(); checkpoint(); requestPreview(); });
  $('#camera-gallery').append(button);
}
function cameraThumbnails() {
  if (!rotated) return;
  const thumbnail = canvas(180, 126); const ctx = thumbnail.getContext('2d', { willReadFrequently: true });
  const rect = cropRect(rotated.width, rotated.height, '10:7'); ctx.drawImage(rotated, rect.x, rect.y, rect.width, rect.height, 0, 0, 180, 126);
  const pixels = ctx.getImageData(0, 0, 180, 126).data;
  for (const profile of CAMERAS) {
    const params = effectiveParams({ ...state, camera: profile.id });
    ctx.putImageData(new ImageData(processPixels(pixels, 180, 126, params), 180, 126), 0, 0);
    $(`[data-camera="${profile.id}"] img`).src = thumbnail.toDataURL('image/jpeg', .86);
  }
}
$('#camera-open').addEventListener('click', () => { if (!source || loading) return; cameraThumbnails(); $('#camera-dialog').showModal(); });
$('#camera-done').addEventListener('click', () => $('#camera-dialog').close());
$('#camera-brand').addEventListener('change', () => {
  const brand = $('#camera-brand').value;
  $$('.camera-card').forEach(card => card.hidden = brand !== 'all' && card.dataset.brand !== brand);
});
function removeCamera() { state.camera = null; syncControls(); checkpoint(); requestPreview(); }
$('#camera-clear').addEventListener('click', removeCamera); $('#camera-neutral').addEventListener('click', removeCamera);
$('#camera-strength').addEventListener('input', () => { state.cameraStrength = Number($('#camera-strength').value); syncControls(); requestPreview(); });
$('#camera-strength').addEventListener('change', checkpoint);
function rebuildRotation() {
  if (!source) return;
  const swap = state.rotation % 180 !== 0;
  rotated = canvas(swap ? source.height : source.width, swap ? source.width : source.height);
  const ctx = rotated.getContext('2d'); ctx.translate(rotated.width / 2, rotated.height / 2); ctx.rotate(state.rotation * Math.PI / 180); ctx.drawImage(source, -source.width / 2, -source.height / 2);
}
function makeFrame(snapshot, size) {
  const rect = cropRect(rotated.width, rotated.height, snapshot.ratio, snapshot.cropX, snapshot.cropY);
  const output = outputSize(rect.width, rect.height, size === 'preview' ? 'full' : size);
  if (size === 'preview' && mainZoom.zoom === 'fit') { const scale = Math.min(1, 1400 / Math.max(output.width, output.height)); output.width = Math.max(1, Math.round(output.width * scale)); output.height = Math.max(1, Math.round(output.height * scale)); }
  const result = canvas(output.width, output.height);
  const ctx = result.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(rotated, rect.x, rect.y, rect.width, rect.height, 0, 0, output.width, output.height);
  return result;
}
function requestPreview() {
  previewVersion++; clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 65);
}
async function renderPreview() {
  if (!source || loading) return;
  if (rendering) { renderAgain = true; return; }
  rendering = true; renderAgain = false;
  const version = previewVersion;
  $('#processing').hidden = false;
  try {
    const frame = makeFrame(state, 'preview');
    const data = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height);
    const edited = await pixelsInWorker(data, effectiveParams(state));
    if (version !== previewVersion) return;
    const preview = $('#preview'), original = $('#original');
    preview.width = original.width = frame.width; preview.height = original.height = frame.height;
    original.getContext('2d').drawImage(frame, 0, 0);
    preview.getContext('2d').putImageData(edited, 0, 0);
    fitPhoto();
  } catch (error) { toast(error.message || 'The preview could not be rendered. Try a smaller photo.'); }
  finally { rendering = false; $('#processing').hidden = true; if (renderAgain || version !== previewVersion) renderPreview(); }
}
function fitPhoto() {
  mainZoom.update();
}
let detailedPreview = false;
const mainZoom = attachZoom({ viewport: $('#drop-zone'), frame: $('#photo-frame'), controls: $('#preview-zoom'), dimensions: () => {
  if (!rotated) return { width: 0, height: 0 };
  const rect = cropRect(rotated.width, rotated.height, state.ratio, state.cropX, state.cropY);
  return outputSize(rect.width, rect.height, 'full');
}, onChange: zoom => {
  const detailed = zoom !== 'fit';
  if (detailed !== detailedPreview) { detailedPreview = detailed; requestPreview(); }
} });
const exportZoom = attachZoom({ viewport: $('#export-viewport'), frame: $('#export-preview'), controls: $('#export-zoom'), dimensions: () => ({ width: $('#export-preview').naturalWidth, height: $('#export-preview').naturalHeight }) });
$('#export-preview').addEventListener('load', () => exportZoom.update());
let compareOn = false;
function updateComparison() {
  const position = Number($('#comparison').value);
  $('#original-overlay').hidden = !compareOn; $('#split-line').hidden = !compareOn; $('#comparison').hidden = !compareOn; $('#before-tag').hidden = !compareOn;
  $('#after-tag').textContent = compareOn ? 'AFTER' : 'YOUR EDIT';
  $('#original-overlay').style.clipPath = `inset(0 ${100 - position}% 0 0)`; $('#split-line').style.left = `${position}%`;
  $('#compare').setAttribute('aria-pressed', compareOn);
}
$('#compare').addEventListener('click', () => { compareOn = !compareOn; updateComparison(); });
$('#comparison').addEventListener('input', updateComparison);
$$('.crop-options button').forEach(button => button.addEventListener('click', () => { state.ratio = button.dataset.ratio; state.cropX = state.cropY = 50; syncControls(); checkpoint(); requestPreview(); }));
for (const axis of ['x', 'y']) {
  $(`#crop-${axis}`).addEventListener('input', () => { state[axis === 'x' ? 'cropX' : 'cropY'] = Number($(`#crop-${axis}`).value); fillRange($(`#crop-${axis}`)); requestPreview(); });
  $(`#crop-${axis}`).addEventListener('change', checkpoint);
}
$('#rotate').addEventListener('click', () => { state.rotation = (state.rotation + 90) % 360; state.cropX = state.cropY = 50; rebuildRotation(); syncControls(); checkpoint(); requestPreview(); });
function restoreHistory(offset) {
  const next = historyIndex + offset; if (next < 0 || next >= history.length) return;
  const oldRotation = state.rotation; historyIndex = next; state = JSON.parse(history[historyIndex]);
  if (oldRotation !== state.rotation) rebuildRotation(); syncControls(); requestPreview();
}
$('#undo').addEventListener('click', () => restoreHistory(-1)); $('#redo').addEventListener('click', () => restoreHistory(1));
document.addEventListener('keydown', event => {
  if ($('#export-dialog').open || $('#camera-dialog').open || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 1 : -1); }
});
$('#reset').addEventListener('click', () => { state = { ...freshState(), preset: null, strength: 0 }; rebuildRotation(); syncControls(); checkpoint(); requestPreview(); toast('Back to your original. You can undo this anytime.'); });
$('#auto').addEventListener('click', () => {
  if (!source) return;
  const sample = canvas(100, 100); const ctx = sample.getContext('2d'); ctx.drawImage(source, 0, 0, 100, 100);
  const pixels = ctx.getImageData(0, 0, 100, 100).data; let luminance = 0;
  for (let i = 0; i < pixels.length; i += 4) luminance += .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
  const mean = luminance / 10000;
  state.preset = 'natural'; state.strength = 100; state.adjustments = { ...DEFAULTS, exposure: Math.round(Math.max(-25, Math.min(35, (118 - mean) * .4))), highlights: -18, shadows: 10, vibrance: 7, clarity: 10, sharpen: 8 };
  syncControls(); checkpoint(); requestPreview(); toast('Light and color balanced. Fine-tune it to your taste.');
});
async function decodePhoto(blob, name) {
  const header = new TextDecoder().decode(await blob.slice(8, 12).arrayBuffer());
  const heif = /heic|heix|hevc|hevx|mif1|msf1/.test(header) || /\.hei[cf]$/i.test(name) || /image\/hei[cf]/.test(blob.type);
  if (heif) {
    $('#processing').textContent = 'Opening your HEIF photo locally…';
    const { heicTo } = await import('./vendor/heic-to.js');
    return heicTo({ blob, type: 'bitmap' });
  }
  if (!['image/jpeg', 'image/png'].includes(blob.type) && !/\.(png|jpe?g)$/i.test(name)) throw new Error('Choose a JPG, PNG, HEIC, or HEIF photo.');
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}
async function loadPhoto(blob, name, sample = false) {
  const version = ++loadVersion; loading = true; previewVersion++;
  $('.editor').classList.add('busy'); $('#export-open').disabled = true; $('#processing').hidden = false; $('#processing').textContent = 'Opening your photo…';
  try {
    if (blob.size > 120 * 1024 * 1024) throw new Error('This file is very large. Please choose a photo under 120 MB.');
    const bitmap = await decodePhoto(blob, name);
    if (version !== loadVersion) { bitmap.close(); return; }
    const nativeW = bitmap.width, nativeH = bitmap.height;
    const scale = Math.min(1, Math.sqrt(16000000 / (nativeW * nativeH)), 8192 / Math.max(nativeW, nativeH));
    const nextSource = canvas(Math.max(1, Math.floor(nativeW * scale)), Math.max(1, Math.floor(nativeH * scale)));
    const ctx = nextSource.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, 0, 0, nextSource.width, nextSource.height); bitmap.close();
    source = nextSource; sourceName = name; state = freshState(); history = []; historyIndex = -1; mainZoom.reset();
    rebuildRotation(); checkpoint(); syncControls();
    $('#filename').textContent = name;
    $('#dimensions').textContent = `${source.width.toLocaleString()} × ${source.height.toLocaleString()} px · ${sample ? 'Sample photo' : 'On your device'}${scale < 1 ? ' · Working copy resized' : ''}`;
    $('.sample-note').hidden = !sample;
    buildThumbnails();
    if (scale < 1) toast('Large photo resized to a safe working copy (up to 16 MP / 8192 px). Your original is untouched.');
    else if (!sample) toast('Photo opened. Pick a look to get started.');
  } catch (error) {
    console.error(error);
    toast(error.message && error.message !== 'The source image could not be decoded.' ? error.message : 'This photo could not be opened. Try another JPG, PNG, HEIC, or HEIF file.');
  } finally {
    if (version === loadVersion) { loading = false; $('.editor').classList.remove('busy'); $('#export-open').disabled = !source; $('#processing').textContent = 'Developing your photo…'; $('#processing').hidden = true; requestPreview(); }
  }
}
function buildThumbnails() {
  const thumbnail = canvas(150, 112); const ctx = thumbnail.getContext('2d', { willReadFrequently: true });
  const rect = cropRect(source.width, source.height, '4:3'); ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, 150, 112);
  const pixels = ctx.getImageData(0, 0, 150, 112).data;
  for (const preset of PRESETS) {
    const params = effectiveParams({ preset: preset.id, strength: 80, adjustments: DEFAULTS });
    ctx.putImageData(new ImageData(processPixels(pixels, 150, 112, params), 150, 112), 0, 0);
    $(`[data-preset="${preset.id}"] img`).src = thumbnail.toDataURL('image/jpeg', .85);
  }
}
for (const id of ['open', 'open-inline']) $(`#${id}`).addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', () => { const file = $('#file').files[0]; if (file) loadPhoto(file, file.name); $('#file').value = ''; });
let dragDepth = 0;
document.addEventListener('dragenter', event => { if (!event.dataTransfer.types.includes('Files')) return; event.preventDefault(); dragDepth++; $('#stage-message').hidden = false; });
document.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#stage-message').hidden = true; } });
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('#stage-message').hidden = true; const file = event.dataTransfer.files[0]; if (file) loadPhoto(file, file.name); });
function toBlob(element, type, quality) {
  return new Promise((resolve, reject) => element.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the export. Try a smaller size.')), type, quality));
}
function exportFormat() { return $('input[name=format]:checked').value; }
function cancelHeif() { heifTask?.cancel(); heifTask = null; }
function encodeHeifInWorker(frame) {
  return new Promise((resolve, reject) => {
    const encoder = new Worker('./heif-worker.js', { type: 'module' });
    const timer = setTimeout(() => finish(new Error('HEIF encoding took too long. Try a smaller image size.')), 120000);
    function finish(error, bytes) { clearTimeout(timer); encoder.terminate(); if (heifTask?.encoder === encoder) heifTask = null; error ? reject(error) : resolve(new Blob([bytes], { type: 'image/heif' })); }
    heifTask = { encoder, cancel: () => finish(new Error('HEIF export cancelled.')) };
    encoder.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.bytes);
    encoder.onerror = () => finish(new Error('The HEIF encoder could not run. Try again or choose JPG.'));
    const pixels = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
    encoder.postMessage({ pixels: pixels.buffer, width: frame.width, height: frame.height }, [pixels.buffer]);
  });
}
async function prepareExport() {
  if (!source) return;
  const version = ++exportVersion; exportBlob = null;
  cancelHeif();
  $('#download').disabled = true; $('#share').hidden = true; $('#export-meta').textContent = 'Preparing your photo…';
  $('#quality-wrap').hidden = exportFormat() !== 'image/jpeg';
  $('#heif-hint').hidden = exportFormat() !== 'image/heif';
  $('#quality-value').textContent = `${$('#quality').value}%`; fillRange($('#quality'));
  try {
    const snapshot = structuredClone(state);
    const type = exportFormat(), quality = Number($('#quality').value) / 100;
    const frame = makeFrame(snapshot, $('#export-size').value);
    const ctx = frame.getContext('2d');
    const result = await pixelsInWorker(ctx.getImageData(0, 0, frame.width, frame.height), effectiveParams(snapshot));
    if (version !== exportVersion || !$('#export-dialog').open) return;
    ctx.putImageData(result, 0, 0);
    if (type !== 'image/png') { ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, frame.width, frame.height); }
    if (type === 'image/heif') $('#export-meta').textContent = 'Encoding HEIF on your device…';
    const blob = type === 'image/heif' ? await encodeHeifInWorker(frame) : await toBlob(frame, type, quality);
    if (version !== exportVersion || !$('#export-dialog').open) return;
    let previewBlob = blob;
    if (type === 'image/heif') {
      const { heicTo } = await import('./vendor/heic-to.js');
      previewBlob = await heicTo({ blob, type: 'image/png' });
    }
    if (version !== exportVersion || !$('#export-dialog').open) return;
    exportBlob = blob;
    exportFilename = `${sourceName.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').slice(0, 100)}${snapshot.camera ? `-${snapshot.camera}` : ''}-vibe.${type === 'image/png' ? 'png' : type === 'image/heif' ? 'heif' : 'jpg'}`;
    if (exportURL) URL.revokeObjectURL(exportURL); exportURL = URL.createObjectURL(previewBlob); $('#export-preview').src = exportURL;
    const sizeLabel = blob.size < 1048576 ? `${Math.round(blob.size / 1024)} KB` : `${(blob.size / 1048576).toFixed(1)} MB`;
    $('#export-meta').textContent = `${frame.width.toLocaleString()} × ${frame.height.toLocaleString()} px · ${sizeLabel}`;
    $('#download').disabled = false;
    const file = new File([blob], exportFilename, { type });
    $('#share').hidden = !navigator.canShare?.({ files: [file] });
  } catch (error) { if (version === exportVersion) { $('#export-meta').textContent = 'Export failed. Try a smaller image size.'; toast(error.message); } }
}
$('#export-open').addEventListener('click', () => {
  if (!source || loading) return;
  $('#export-dialog').showModal(); exportZoom.reset(); $('#export-preview').src = $('#preview').toDataURL('image/jpeg', .85); prepareExport();
});
$('#export-dialog').addEventListener('close', () => { exportVersion++; exportBlob = null; cancelHeif(); if (exportURL) { URL.revokeObjectURL(exportURL); exportURL = null; } });
$('#export-dialog').addEventListener('click', event => { if (event.target === $('#export-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
$$('input[name=format]').forEach(input => input.addEventListener('change', prepareExport)); $('#export-size').addEventListener('change', prepareExport);
let qualityTimer;
$('#quality').addEventListener('input', () => { exportVersion++; exportBlob = null; $('#download').disabled = true; $('#share').hidden = true; $('#quality-value').textContent = `${$('#quality').value}%`; fillRange($('#quality')); clearTimeout(qualityTimer); qualityTimer = setTimeout(prepareExport, 180); });
$('#download').addEventListener('click', () => {
  if (!exportBlob) return;
  const link = document.createElement('a'); const url = URL.createObjectURL(exportBlob); link.href = url; link.download = exportFilename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); toast('Saved a fresh copy. Ready for your Instagram upload.');
});
$('#share').addEventListener('click', async () => {
  if (!exportBlob) return;
  try { await navigator.share({ files: [new File([exportBlob], exportFilename, { type: exportBlob.type })], title: 'My Vibe photo' }); }
  catch (error) { if (error.name !== 'AbortError') toast('Sharing is unavailable here. Save the photo instead.'); }
});
syncControls(); updateComparison(); $('#export-open').disabled = true;
try {
  const response = await fetch('./assets/alpine-original.png'); if (!response.ok) throw new Error('Sample not found');
  await loadPhoto(await response.blob(), sourceName, true);
} catch { toast('Open a JPG, PNG, HEIC, or HEIF photo to get started.'); }
