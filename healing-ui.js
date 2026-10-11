import { frameToSource, sourceToFrame, straightenScale } from './advanced.js';
const $ = selector => document.querySelector(selector);
export function setupHealing({ getState, geometry, changed, onDraw, notify }) {
  let drawing = false, selected = -1, pointer = null;
  const panel = document.createElement('details'); panel.className = 'slider-group pro-group'; panel.id = 'healing-panel';
  panel.innerHTML = `<summary><span>✧ &nbsp; Magic Eraser</span></summary>
    <p class="tool-help">Click a small blemish to blend nearby texture into the surrounding tone. Use a brush just larger than the spot. Avoid eyes, hair, and strong edges.</p>
    <button id="healing-draw" class="tool-reset" type="button" aria-pressed="false">Click blemishes on photo</button>
    <p id="healing-count" class="tool-help" role="status">No repairs yet.</p>
    <label for="healing-selected">Selected repair</label><select id="healing-selected"><option value="-1">New repair settings</option></select>
    <div id="healing-sliders"></div>
    <label class="checkbox-label"><input id="healing-show" type="checkbox" checked> Show repair outlines</label>
    <div class="tool-actions"><button id="healing-remove" type="button">Remove selected</button><button id="healing-clear" type="button">Clear repairs</button></div>
    <p class="tool-help">Settings tune the selected repair and new clicks. Up to 80 repairs. Undo restores individual repairs. This uses nearby pixels; it does not generate new image content.</p>`;
  $('#advanced-tools').append(panel);
  const overlay = $('#healing-overlay'), marks = $('#healing-marks');
  const fields = [['size', 'Brush diameter', 2, 256, ' px'], ['strength', 'Healing strength', 0, 100, '%'], ['feather', 'Edge softness', 0, 100, '%'], ['texture', 'Texture retention', 0, 100, '%']];
  const healing = () => getState().healing;
  function sync() {
    const h = healing(); selected = Math.min(selected, h.spots.length - 1);
    $('#healing-selected').replaceChildren();
    const fresh = new Option('New repair settings', '-1'); $('#healing-selected').append(fresh);
    h.spots.forEach((spot, i) => $('#healing-selected').append(new Option(`Repair ${i + 1}`, i)));
    $('#healing-selected').value = selected;
    const spot = h.spots[selected], unit = geometry() ? Math.min(geometry().sourceWidth, geometry().sourceHeight) : 1;
    for (const [key, , , , suffix] of fields) {
      const value = key === 'size' && spot ? Math.round(spot.radius * unit * 2) : spot && key !== 'size' ? spot[key] : h[key];
      const input = $(`#healing-${key}`); input.value = value;
      $(`#healing-${key}-value`).textContent = `${value}${suffix}`; input.style.setProperty('--fill', `${(input.value - input.min) / (input.max - input.min) * 100}%`);
    }
    $('#healing-count').textContent = `${h.spots.length} ${h.spots.length === 1 ? 'repair' : 'repairs'} · click to add`;
    $('#healing-remove').disabled = !spot; $('#healing-clear').disabled = !h.spots.length; drawOverlay();
  }
  for (const [key, label, min, max] of fields) {
    const row = document.createElement('div'); row.className = 'slider-row';
    row.innerHTML = `<label for="healing-${key}">${label}<output id="healing-${key}-value"></output></label><input id="healing-${key}" type="range" min="${min}" max="${max}" value="${healing()[key]}">`;
    $('#healing-sliders').append(row);
    row.querySelector('input').addEventListener('input', event => {
      const h = healing(), value = Number(event.target.value); h[key] = value;
      const spot = h.spots[selected], g = geometry();
      if (spot) { if (key === 'size' && g) spot.radius = Math.min(.2, value / 2 / Math.min(g.sourceWidth, g.sourceHeight)); else if (key !== 'size') spot[key] = value; }
      sync(); changed(false);
    });
    row.querySelector('input').addEventListener('change', () => changed(true));
  }
  function setDrawing(value) {
    drawing = Boolean(value); const id = pointer?.id; pointer = null;
    if (id !== undefined && overlay.hasPointerCapture(id)) overlay.releasePointerCapture(id);
    overlay.classList.toggle('drawing', drawing); $('#healing-draw').setAttribute('aria-pressed', drawing); $('#healing-drawing-bar').hidden = !drawing;
    onDraw(drawing); drawOverlay();
    if (drawing) $('#healing-drawing-bar').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function drawOverlay() {
    const g = geometry(); marks.replaceChildren(); marks.toggleAttribute('hidden', !g || !$('#healing-show').checked || (!panel.open && !drawing));
    if (!g) return;
    marks.setAttribute('viewBox', `0 0 ${g.rect.width} ${g.rect.height}`);
    const scale = straightenScale(g.width, g.height, g.straighten);
    marks.innerHTML = healing().spots.map((spot, i) => {
      const p = sourceToFrame(spot.x, spot.y, g), radius = spot.radius * Math.min(g.sourceWidth, g.sourceHeight) * scale;
      return `<circle cx="${p.x * g.rect.width}" cy="${p.y * g.rect.height}" r="${radius}" class="${i === selected ? 'selected' : ''}"/>`;
    }).join('');
  }
  $('#healing-draw').addEventListener('click', () => setDrawing(!drawing));
  $('#healing-drawing-done').addEventListener('click', () => setDrawing(false));
  $('#healing-adjustments-jump').addEventListener('click', () => { setDrawing(false); panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); $('#healing-selected').focus({ preventScroll: true }); });
  $('#healing-selected').addEventListener('change', event => { selected = Number(event.target.value); sync(); });
  $('#healing-show').addEventListener('change', drawOverlay);
  $('#healing-remove').addEventListener('click', () => { if (selected < 0) return; healing().spots.splice(selected, 1); selected = Math.min(selected, healing().spots.length - 1); sync(); changed(true); });
  $('#healing-clear').addEventListener('click', () => { healing().spots = []; selected = -1; sync(); changed(true); });
  overlay.addEventListener('pointerdown', event => {
    if (!drawing || pointer || event.button !== 0 || !geometry()) return;
    event.preventDefault(); event.stopPropagation(); overlay.setPointerCapture(event.pointerId); pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  overlay.addEventListener('pointerup', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    event.stopPropagation(); const start = pointer; pointer = null;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    if (healing().spots.length >= 80) { notify('This photo has 80 repairs. Remove a repair or undo to make room.'); return; }
    const rect = overlay.getBoundingClientRect(), g = geometry();
    const fx = (event.clientX - rect.left) / rect.width, fy = (event.clientY - rect.top) / rect.height;
    if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return;
    const point = frameToSource(fx, fy, g), h = healing();
    h.spots.push({ x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)), radius: Math.min(.2, h.size / 2 / Math.min(g.sourceWidth, g.sourceHeight)), strength: h.strength, feather: h.feather, texture: h.texture });
    selected = h.spots.length - 1; sync(); changed(true);
  });
  for (const event of ['pointercancel', 'lostpointercapture']) overlay.addEventListener(event, () => { pointer = null; });
  overlay.addEventListener('dblclick', event => event.stopPropagation());
  panel.addEventListener('toggle', () => { if (!panel.open) setDrawing(false); drawOverlay(); });
  sync();
  return { sync, drawOverlay, stopDrawing() { const interrupted = !!pointer; setDrawing(false); return interrupted; } };
}
