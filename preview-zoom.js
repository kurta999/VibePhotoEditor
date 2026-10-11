export function viewGeometry(width, height, availableWidth, availableHeight, zoom = 'fit', x = 0, y = 0) {
  const fit = Math.min(availableWidth / width, availableHeight / height);
  const scale = zoom === 'fit' ? fit : zoom;
  const limitX = Math.max(0, (width * scale - availableWidth) / 2);
  const limitY = Math.max(0, (height * scale - availableHeight) / 2);
  return { scale, fit, width: width * scale, height: height * scale, x: Math.max(-limitX, Math.min(limitX, x)) || 0, y: Math.max(-limitY, Math.min(limitY, y)) || 0 };
}

export function attachZoom({ viewport, frame, controls, dimensions, onChange = () => {} }) {
  let zoom = 'fit', x = 0, y = 0, geometry, panMode = false;
  const pointers = new Map();
  const select = controls.querySelector('select');
  const out = controls.querySelector('[data-zoom="out"]'), into = controls.querySelector('[data-zoom="in"]');
  const pan = controls.querySelector('[data-zoom="pan"]');
  function update() {
    const { width, height } = dimensions();
    if (!width || !height || !viewport.clientWidth || !viewport.clientHeight) return;
    const style = getComputedStyle(viewport);
    geometry = viewGeometry(width, height, Math.max(1, viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)), Math.max(1, viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)), zoom, x, y);
    x = geometry.x; y = geometry.y;
    frame.style.width = `${geometry.width}px`; frame.style.height = `${geometry.height}px`;
    frame.style.transform = `translate(${x}px, ${y}px)`;
    viewport.classList.toggle('can-pan', geometry.width > viewport.clientWidth || geometry.height > viewport.clientHeight);
    const custom = select.querySelector('[data-custom]');
    const value = String(zoom === 'fit' ? 'fit' : Math.round(zoom * 100));
    if (![...select.options].some(option => option.value === value && option !== custom)) { custom.value = value; custom.textContent = `${value}%`; custom.hidden = false; }
    else custom.hidden = true;
    select.value = value;
    out.disabled = zoom !== 'fit' && zoom <= .1; into.disabled = zoom !== 'fit' && zoom >= 4;
  }
  function setZoom(value, anchor = { x: 0, y: 0 }) {
    const oldScale = geometry?.scale || 1;
    zoom = value === 'fit' ? 'fit' : Math.max(.1, Math.min(4, value));
    const scale = zoom === 'fit' ? geometry?.fit || 1 : zoom;
    x = zoom === 'fit' ? 0 : anchor.x - (anchor.x - x) * scale / oldScale;
    y = zoom === 'fit' ? 0 : anchor.y - (anchor.y - y) * scale / oldScale;
    update(); onChange(zoom);
  }
  function step(direction, anchor) { setZoom((geometry?.scale || 1) * (direction > 0 ? 1.25 : .8), anchor); }
  out.addEventListener('click', () => step(-1)); into.addEventListener('click', () => step(1));
  select.addEventListener('change', () => setZoom(select.value === 'fit' ? 'fit' : Number(select.value) / 100));
  controls.querySelector('[data-zoom="fit"]').addEventListener('click', () => setZoom('fit'));
  pan?.addEventListener('click', () => { panMode = !panMode; pan.setAttribute('aria-pressed', panMode); viewport.classList.toggle('pan-mode', panMode); });
  viewport.addEventListener('wheel', event => {
    if (!geometry) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    step(event.deltaY < 0 ? 1 : -1, { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 });
  }, { passive: false });
  viewport.addEventListener('dblclick', event => { if (!event.target.closest('input')) setZoom(zoom === 'fit' ? 1 : 'fit'); });
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (event.target.closest('input') && !panMode)) return;
    event.preventDefault(); viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); viewport.classList.add('panning');
  });
  viewport.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId); if (!previous) return;
    const others = [...pointers.entries()].filter(([id]) => id !== event.pointerId);
    if (others.length) {
      const other = others[0][1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 0) {
        const rect = viewport.getBoundingClientRect();
        setZoom((geometry?.scale || 1) * after / before, { x: (event.clientX + other.x) / 2 - rect.left - rect.width / 2, y: (event.clientY + other.y) / 2 - rect.top - rect.height / 2 });
      }
    } else { x += event.clientX - previous.x; y += event.clientY - previous.y; update(); }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  });
  function release(event) { pointers.delete(event.pointerId); if (!pointers.size) viewport.classList.remove('panning'); }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(name, release);
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport) return;
    if (['+', '=', '-', '0', '1', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
    if (event.key === '+' || event.key === '=') step(1);
    else if (event.key === '-') step(-1);
    else if (event.key === '0') setZoom('fit');
    else if (event.key === '1') setZoom(1);
    else { if (event.key === 'ArrowLeft') x += 40; if (event.key === 'ArrowRight') x -= 40; if (event.key === 'ArrowUp') y += 40; if (event.key === 'ArrowDown') y -= 40; update(); }
  });
  new ResizeObserver(update).observe(viewport);
  return { update, reset: () => setZoom('fit'), get zoom() { return zoom; } };
}
