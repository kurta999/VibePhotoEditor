import { COLOR_RANGES, identityCurve, curveLut, frameToSource, sourceToFrame, rasterMask, straightenScale } from './advanced.js';

const $ = selector => document.querySelector(selector);
const signed = value => value > 0 ? `+${value}` : String(value);
const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
export function setupAdvanced({ getState, changed, geometry, onDraw, notify }) {
  let channel = 'rgb', pointIndex = 0, range = 'red', selectedMask = null, drawing = false, pointer = null;
  const host = $('#advanced-tools');
  host.innerHTML = `
    <details class="slider-group pro-group" id="curves-panel"><summary><span>↗ &nbsp; Tone curves</span></summary>
      <p class="tool-help">Shape contrast or adjust individual color channels. Click the curve to add a point, then drag it.</p>
      <label for="curve-channel">Channel</label><select id="curve-channel"><option value="rgb">Master RGB</option><option value="red">Red</option><option value="green">Green</option><option value="blue">Blue</option></select>
      <svg id="curve-graph" viewBox="0 0 256 256" tabindex="0" role="img" aria-label="Tone curve editor. Click to add a point. Arrow keys move the selected point; Delete removes it."></svg>
      <div class="curve-axis"><span>Shadows</span><span>Highlights</span></div>
      <label for="curve-point">Selected point</label><select id="curve-point"></select>
      <div class="point-values"><label>Input <input id="curve-x" type="number" min="0" max="255" step="1"></label><label>Output <input id="curve-y" type="number" min="0" max="255" step="1"></label></div>
      <div class="tool-actions"><button id="curve-add" type="button">Add point</button><button id="curve-delete" type="button">Delete point</button><button id="curve-reset" type="button">Reset channel</button></div>
    </details>
    <details class="slider-group pro-group" id="hsl-panel"><summary><span>◉ &nbsp; HSL color mixer</span></summary>
      <p class="tool-help">Refine one color range. Neighboring ranges blend smoothly; neutral grays stay neutral.</p>
      <label for="hsl-range">Color range</label><select id="hsl-range">${COLOR_RANGES.map(([key, name]) => `<option value="${key}">${name}</option>`).join('')}</select><div id="hsl-swatches" class="hsl-swatches">${COLOR_RANGES.map(([key, name, , color]) => `<button type="button" data-range="${key}" aria-label="Edit ${name.toLowerCase()} range" style="--swatch:${color}"></button>`).join('')}</div>
      <div id="hsl-sliders"></div><div class="tool-actions"><button id="hsl-reset" type="button">Reset range</button><button id="hsl-reset-all" type="button">Reset all colors</button></div>
    </details>
    <details class="slider-group pro-group" id="masks-panel"><summary><span>◌ &nbsp; Selective masks</span></summary>
      <p class="tool-help">Adjust part of your photo with a radial mask, a gradient, or a painted brush. Up to four masks, applied in list order.</p>
      <div class="mask-add"><button type="button" data-add-mask="radial">+ Radial</button><button type="button" data-add-mask="linear">+ Gradient</button><button type="button" data-add-mask="brush">+ Brush</button></div>
      <p id="masks-empty" class="tool-help">Add a mask to begin. Its adjustments start at zero.</p>
      <div id="mask-controls" hidden><label for="mask-select">Selected mask</label><select id="mask-select"></select>
        <div class="mask-toggles"><label><input id="mask-enabled" type="checkbox" checked> Enabled</label><label><input id="mask-invert" type="checkbox"> Invert</label><label><input id="mask-show" type="checkbox" checked> Show overlay</label></div>
        <div class="tool-actions"><button id="mask-draw" type="button" aria-pressed="false">Draw on photo</button><button id="mask-delete" type="button">Delete mask</button></div>
        <p id="mask-draw-help" class="tool-help"></p><label id="brush-erase-wrap" class="checkbox-label" hidden><input id="brush-erase" type="checkbox"> Erase brush strokes</label>
        <div id="mask-geometry"></div><h3 class="local-heading">Local adjustments</h3><div id="mask-adjustments"></div><button id="mask-reset" type="button" class="tool-reset">Reset local adjustments</button>
      </div>
    </details>`;
  function slider(parent, id, label, min, max, step = 1) {
    const row = document.createElement('div'); row.className = 'slider-row';
    row.innerHTML = `<label for="${id}">${label}<output id="${id}-value"></output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="0">`;
    parent.append(row); return row.querySelector('input');
  }
  function displaySlider(input, value, suffix = '') {
    input.value = value; const rounded = Math.round(value * 10) / 10;
    $(`#${input.id}-value`).textContent = `${suffix === '%' ? rounded : signed(rounded)}${suffix}`;
    input.style.setProperty('--fill', `${(input.value - input.min) / (input.max - input.min) * 100}%`);
  }
  const graph = $('#curve-graph');
  function points() { return getState().color.curves[channel]; }
  function drawCurve() {
    const p = points(); pointIndex = Math.min(pointIndex, p.length - 1);
    const lut = curveLut(p), color = channel === 'rgb' ? '#e9704c' : { red: '#d9716a', green: '#709969', blue: '#648eb5' }[channel];
    const grid = [64, 128, 192].map(v => `<path d="M ${v} 0 V 256 M 0 ${v} H 256"/>`).join('');
    graph.innerHTML = `<rect x="0" y="0" width="256" height="256" fill="#f9faf6"/><g stroke="#e1e5d9" stroke-width="1">${grid}</g><path d="M 0 256 L 256 0" stroke="#c6cdbf" stroke-dasharray="4 4"/><path d="${Array.from(lut, (v, i) => `${i ? 'L' : 'M'} ${i} ${255 - v}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>${p.map(([x, y], i) => `<circle data-point="${i}" cx="${x}" cy="${255 - y}" r="${i === pointIndex ? 6 : 4.5}" fill="${i === pointIndex ? color : '#fff'}" stroke="${color}" stroke-width="2"/>`).join('')}`;
    $('#curve-point').innerHTML = p.map(([x, y], i) => `<option value="${i}">${i + 1} · ${Math.round(x)} → ${Math.round(y)}</option>`).join(''); $('#curve-point').value = pointIndex;
    $('#curve-x').value = Math.round(p[pointIndex][0]); $('#curve-y').value = Math.round(p[pointIndex][1]);
    $('#curve-x').disabled = pointIndex === 0 || pointIndex === p.length - 1;
    $('#curve-delete').disabled = pointIndex === 0 || pointIndex === p.length - 1;
    $('#curve-add').disabled = p.length >= 12;
    $('#curve-channel').value = channel;
  }
  function movePoint(x, y, commit = false) {
    const p = points(), index = pointIndex;
    if (index > 0 && index < p.length - 1) p[index][0] = Math.round(clamp(x, p[index - 1][0] + 1, p[index + 1][0] - 1));
    p[index][1] = Math.round(clamp(y, 0, 255)); drawCurve(); changed(commit);
  }
  function addPoint(x, y, commit = true) {
    const p = points(); if (p.length >= 12) return;
    x = Math.round(clamp(x, 1, 254)); if (p.some(point => Math.abs(point[0] - x) < 1)) return;
    p.push([x, Math.round(clamp(y, 0, 255))]); p.sort((a, b) => a[0] - b[0]); pointIndex = p.findIndex(point => point[0] === x); drawCurve(); changed(commit);
  }
  function removePoint() { if (pointIndex === 0 || pointIndex === points().length - 1) return; points().splice(pointIndex, 1); pointIndex = Math.max(0, pointIndex - 1); drawCurve(); changed(true); }
  $('#curve-channel').addEventListener('change', event => { const next = event.target.value; cancelCurve(); channel = next; pointIndex = 0; drawCurve(); });
  $('#curve-point').addEventListener('change', event => { const next = Number(event.target.value); cancelCurve(); pointIndex = next; drawCurve(); });
  for (const axis of ['x', 'y']) for (const eventName of ['input', 'change']) $(`#curve-${axis}`).addEventListener(eventName, () => {
    if ($('#curve-x').value === '' || $('#curve-y').value === '') return;
    const x = Number($('#curve-x').value), y = Number($('#curve-y').value);
    if (Number.isFinite(x) && Number.isFinite(y)) movePoint(x, y, eventName === 'change');
  });
  for (const axis of ['x', 'y']) $(`#curve-${axis}`).addEventListener('blur', () => changed(true));
  $('#curve-add').addEventListener('click', () => { let gap = 0, x = 128; const p = points(); for (let i = 1; i < p.length; i++) if (p[i][0] - p[i - 1][0] > gap) { gap = p[i][0] - p[i - 1][0]; x = Math.round((p[i][0] + p[i - 1][0]) / 2); } addPoint(x, curveLut(p)[x]); });
  $('#curve-delete').addEventListener('click', removePoint);
  $('#curve-reset').addEventListener('click', () => { getState().color.curves[channel] = identityCurve(); pointIndex = 0; drawCurve(); changed(true); });
  let curveDrag = null, curveBefore;
  function cancelCurve() {
    if (curveDrag === null) return false;
    const id = curveDrag; getState().color.curves[channel] = curveBefore; curveDrag = null;
    if (graph.hasPointerCapture(id)) graph.releasePointerCapture(id);
    drawCurve(); changed(false); return true;
  }
  function graphPoint(event) { const rect = graph.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * 255, y: 255 - (event.clientY - rect.top) / rect.height * 255 }; }
  graph.addEventListener('pointerdown', event => {
    if (event.button !== 0 || curveDrag !== null) return; event.preventDefault(); graph.focus();
    curveBefore = structuredClone(points());
    const target = event.target.closest('[data-point]'), position = graphPoint(event);
    if (target) pointIndex = Number(target.dataset.point);
    else { addPoint(position.x, position.y, false); if (points().length === curveBefore.length) return; }
    curveDrag = event.pointerId; graph.setPointerCapture(event.pointerId); drawCurve();
  });
  graph.addEventListener('pointermove', event => { if (event.pointerId !== curveDrag) return; const p = graphPoint(event); movePoint(p.x, p.y); });
  graph.addEventListener('pointerup', event => { if (event.pointerId === curveDrag) { curveDrag = null; changed(true); } });
  graph.addEventListener('pointercancel', cancelCurve); graph.addEventListener('lostpointercapture', cancelCurve);
  graph.addEventListener('keydown', event => {
    const [x, y] = points()[pointIndex], step = event.shiftKey ? 10 : 1;
    if (event.key.startsWith('Arrow')) { event.preventDefault(); movePoint(x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y + (event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0), true); }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removePoint(); }
  });
  for (const [key, label, min, max] of [['hue', 'Hue', -60, 60], ['saturation', 'Saturation', -100, 100], ['luminance', 'Luminance', -100, 100]]) {
    const input = slider($('#hsl-sliders'), `hsl-${key}`, label, min, max);
    input.addEventListener('input', () => { getState().color.hsl[range][key] = Number(input.value); syncHsl(); changed(false); }); input.addEventListener('change', () => changed(true));
  }
  function syncHsl() {
    $('#hsl-range').value = range;
    for (const key of ['hue', 'saturation', 'luminance']) displaySlider($(`#hsl-${key}`), getState().color.hsl[range][key], key === 'hue' ? '°' : '');
    host.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', button.dataset.range === range));
  }
  $('#hsl-range').addEventListener('change', event => { range = event.target.value; syncHsl(); });
  host.querySelectorAll('[data-range]').forEach(button => button.addEventListener('click', () => { range = button.dataset.range; syncHsl(); }));
  $('#hsl-reset').addEventListener('click', () => { getState().color.hsl[range] = { hue: 0, saturation: 0, luminance: 0 }; syncHsl(); changed(true); });
  $('#hsl-reset-all').addEventListener('click', () => { for (const [key] of COLOR_RANGES) getState().color.hsl[key] = { hue: 0, saturation: 0, luminance: 0 }; syncHsl(); changed(true); });

  function mask() { return getState().masks.find(m => m.id === selectedMask); }
  function setDrawing(value) {
    drawing = Boolean(value && mask());
    if (!drawing && pointer) {
      const id = pointer.id, index = getState().masks.findIndex(m => m.id === pointer.before.id);
      if (index >= 0) getState().masks[index] = pointer.before;
      pointer = null;
      if ($('#mask-overlay').hasPointerCapture(id)) $('#mask-overlay').releasePointerCapture(id);
      changed(false);
    }
    $('#mask-draw').setAttribute('aria-pressed', drawing); $('#mask-overlay').classList.toggle('drawing', drawing);
    $('#mask-drawing-bar').hidden = !drawing;
    if (drawing) { $('#mask-drawing-label').textContent = `Drawing ${mask().type === 'linear' ? 'gradient' : mask().type} mask`; $('#mask-drawing-bar').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    onDraw(drawing); drawOverlay();
  }
  function syncMask() {
    const masks = getState().masks;
    if (!masks.some(m => m.id === selectedMask)) selectedMask = masks.at(-1)?.id || null;
    const m = mask(); if (!m) setDrawing(false);
    $('#masks-empty').hidden = !!m; $('#mask-controls').hidden = !m;
    host.querySelectorAll('[data-add-mask]').forEach(button => button.disabled = masks.length >= 4);
    $('#mask-select').innerHTML = masks.map((m, i) => `<option value="${m.id}">${i + 1} · ${m.type === 'linear' ? 'Gradient' : m.type === 'brush' ? 'Brush' : 'Radial'}${m.enabled ? '' : ' (disabled)'}</option>`).join('');
    if (!m) { drawOverlay(); return; }
    $('#mask-select').value = m.id; $('#mask-enabled').checked = m.enabled; $('#mask-invert').checked = m.invert;
    $('#brush-erase-wrap').hidden = m.type !== 'brush';
    $('#mask-draw-help').textContent = m.type === 'brush' ? 'Draw on the photo to paint. Brush size and feather apply to new strokes. Turn drawing off to pan.' : m.type === 'linear' ? 'Drag from the full-effect edge toward the no-effect edge. Turn drawing off to pan.' : 'Drag from the center outward to set the circle. Turn drawing off to pan.';
    const config = m.type === 'linear' ? [['startX', 'Start X', m.start[0] * 100], ['startY', 'Start Y', m.start[1] * 100], ['endX', 'End X', m.end[0] * 100], ['endY', 'End Y', m.end[1] * 100]] : [
      ...(m.type === 'radial' ? [['x', 'Center X', m.x * 100], ['y', 'Center Y', m.y * 100]] : []),
      ['radius', m.type === 'brush' ? 'Brush radius' : 'Radius', m.radius * 100], ['feather', 'Feather', m.feather]
    ];
    const signature = m.type;
    if ($('#mask-geometry').dataset.type !== signature) {
      $('#mask-geometry').replaceChildren(); $('#mask-geometry').dataset.type = signature;
      for (const [key, label] of config) {
        const input = slider($('#mask-geometry'), `mask-${key}`, label, key === 'radius' ? 1 : 0, key === 'radius' ? 100 : 100);
        input.addEventListener('input', () => {
          const current = mask(), value = Number(input.value);
          if (key.startsWith('start') || key.startsWith('end')) current[key.startsWith('start') ? 'start' : 'end'][key.endsWith('X') ? 0 : 1] = value / 100;
          else current[key] = key === 'feather' ? value : value / 100;
          displaySlider(input, value, '%'); drawOverlay(); changed(false);
        }); input.addEventListener('change', () => changed(true));
      }
    }
    for (const [key, , value] of config) displaySlider($(`#mask-${key}`), value, '%');
    for (const key of ['exposure', 'contrast', 'highlights', 'shadows', 'saturation', 'warmth']) displaySlider($(`#local-${key}`), m.adjustments[key]);
    drawOverlay();
  }
  for (const [key, label] of [['exposure', 'Brightness'], ['contrast', 'Contrast'], ['highlights', 'Highlights'], ['shadows', 'Shadows'], ['saturation', 'Saturation'], ['warmth', 'Warmth']]) {
    const input = slider($('#mask-adjustments'), `local-${key}`, `Local ${label.toLowerCase()}`, -100, 100);
    input.addEventListener('input', () => { const m = mask(); if (!m) return; m.adjustments[key] = Number(input.value); displaySlider(input, m.adjustments[key]); changed(false); }); input.addEventListener('change', () => changed(true));
  }
  host.querySelectorAll('[data-add-mask]').forEach(button => button.addEventListener('click', () => {
    if (getState().masks.length >= 4) return;
    setDrawing(false);
    const type = button.dataset.addMask;
    const m = { id: crypto.randomUUID(), type, enabled: true, invert: false, x: .5, y: .5, radius: type === 'brush' ? .05 : .3, feather: 65, start: [.5, .2], end: [.5, .7], strokes: [], adjustments: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, saturation: 0, warmth: 0 } };
    getState().masks.push(m); selectedMask = m.id; $('#mask-show').checked = true; syncMask(); changed(true); setDrawing(true);
  }));
  $('#mask-select').addEventListener('change', event => { selectedMask = event.target.value; setDrawing(false); syncMask(); });
  $('#mask-draw').addEventListener('click', () => setDrawing(!drawing));
  $('#mask-drawing-done').addEventListener('click', () => setDrawing(false));
  $('#mask-adjustments-jump').addEventListener('click', () => { setDrawing(false); $('#masks-panel').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('#mask-select').focus({ preventScroll: true }); });
  $('#mask-delete').addEventListener('click', () => { setDrawing(false); getState().masks = getState().masks.filter(m => m.id !== selectedMask); selectedMask = null; syncMask(); changed(true); });
  $('#mask-reset').addEventListener('click', () => { const m = mask(); for (const key in m.adjustments) m.adjustments[key] = 0; syncMask(); changed(true); });
  for (const [id, key] of [['mask-enabled', 'enabled'], ['mask-invert', 'invert']]) $(`#${id}`).addEventListener('change', event => { mask()[key] = event.target.checked; syncMask(); changed(true); });
  $('#mask-show').addEventListener('change', drawOverlay);

  const overlay = $('#mask-overlay'), handles = $('#mask-handles');
  function drawOverlay() {
    const g = geometry(), m = mask();
    const ctx = overlay.getContext('2d'); ctx.clearRect(0, 0, overlay.width, overlay.height); handles.replaceChildren();
    if (!g || !m || (!$('#masks-panel').open && !drawing)) return;
    const scale = Math.min(1, 700 / Math.max(g.rect.width, g.rect.height));
    overlay.width = Math.max(1, Math.round(g.rect.width * scale)); overlay.height = Math.max(1, Math.round(g.rect.height * scale));
    if ($('#mask-show').checked) {
      const alpha = rasterMask(m, overlay.width, overlay.height, g), image = ctx.createImageData(overlay.width, overlay.height);
      for (let i = 0; i < alpha.length; i++) { image.data[i * 4] = 225; image.data[i * 4 + 1] = 85; image.data[i * 4 + 2] = 129; image.data[i * 4 + 3] = Math.round(alpha[i] * 100); }
      ctx.putImageData(image, 0, 0);
    }
    handles.setAttribute('viewBox', `0 0 ${overlay.width} ${overlay.height}`);
    function dot(point) { return `<circle cx="${point.x * overlay.width}" cy="${point.y * overlay.height}" r="5"/>`; }
    if (m.type === 'radial') {
      const center = sourceToFrame(m.x, m.y, g), radius = m.radius * Math.min(g.sourceWidth, g.sourceHeight) * straightenScale(g.width, g.height, g.straighten);
      handles.innerHTML = `<ellipse cx="${center.x * overlay.width}" cy="${center.y * overlay.height}" rx="${radius * overlay.width / g.rect.width}" ry="${radius * overlay.height / g.rect.height}"/>${dot(center)}`;
    } else if (m.type === 'linear') {
      const start = sourceToFrame(...m.start, g), end = sourceToFrame(...m.end, g);
      handles.innerHTML = `<path d="M ${start.x * overlay.width} ${start.y * overlay.height} L ${end.x * overlay.width} ${end.y * overlay.height}"/>${dot(start)}${dot(end)}`;
    }
    handles.toggleAttribute('hidden', !$('#mask-show').checked && !drawing);
  }
  function photoPoint(event) {
    const rect = overlay.getBoundingClientRect(), g = geometry();
    if (!g) return null;
    const point = frameToSource((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, g);
    return { x: clamp(point.x), y: clamp(point.y) };
  }
  overlay.addEventListener('pointerdown', event => {
    if (!drawing || pointer || event.button !== 0 || !geometry()) return;
    event.preventDefault(); event.stopPropagation();
    const m = mask(), start = photoPoint(event);
    if (m.type === 'brush' && m.strokes.length >= 64) { notify('This mask has 64 strokes. Add another brush mask or undo a stroke.'); return; }
    pointer = { id: event.pointerId, start, before: structuredClone(m) };
    overlay.setPointerCapture(event.pointerId);
    if (m.type === 'brush') m.strokes.push({ points: [[start.x, start.y]], radius: m.radius, feather: m.feather, erase: $('#brush-erase').checked });
    else if (m.type === 'radial') { m.x = start.x; m.y = start.y; }
    else { m.start = [start.x, start.y]; m.end = [start.x, Math.min(1, start.y + .01)]; }
    drawOverlay(); changed(false);
  });
  overlay.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const m = mask(), point = photoPoint(event), g = geometry(), unit = Math.min(g.sourceWidth, g.sourceHeight);
    if (m.type === 'brush') {
      const stroke = m.strokes.at(-1), last = stroke.points.at(-1);
      if (stroke.points.length < 512 && Math.hypot((point.x - last[0]) * g.sourceWidth, (point.y - last[1]) * g.sourceHeight) > stroke.radius * unit * .15) stroke.points.push([point.x, point.y]);
      else if (stroke.points.length >= 512 && !pointer.limitNotified) { pointer.limitNotified = true; notify('Lift the brush and start another stroke to keep painting.'); }
    } else if (m.type === 'radial') m.radius = clamp(Math.hypot((point.x - pointer.start.x) * g.sourceWidth, (point.y - pointer.start.y) * g.sourceHeight) / unit, .01, 1);
    else m.end = [point.x, point.y];
    drawOverlay(); changed(false);
  });
  function finishPointer(event) {
    if (!pointer || pointer.id !== event.pointerId) return; event.stopPropagation();
    const cancelled = event.type !== 'pointerup';
    if (cancelled) { const i = getState().masks.findIndex(m => m.id === selectedMask); if (i >= 0) getState().masks[i] = pointer.before; }
    pointer = null; syncMask(); changed(!cancelled);
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) overlay.addEventListener(event, finishPointer);
  overlay.addEventListener('dblclick', event => event.stopPropagation());
  $('#masks-panel').addEventListener('toggle', drawOverlay);
  return { sync: () => { drawCurve(); syncHsl(); syncMask(); }, drawOverlay, stopDrawing: () => { const interrupted = pointer !== null || curveDrag !== null; cancelCurve(); setDrawing(false); return interrupted; }, get drawing() { return drawing; } };
}
