import { FRAME, previewCamera } from './camera.js';

const id = name => document.getElementById(name);
const html = document.documentElement;
const scene = id('scene');
const canvas = id('canvasContainer');
const overlay = id('overlaySvg');
const facade = id('imgFacade');
const arrival = id('imgArrival');
const facadePicture = facade.closest('picture');
const panel = id('floorPanel');
const floorList = id('floorListRail');
const isPlanReview = location.pathname === '/plan-review';
html.toggleAttribute('data-plan-review', isPlanReview);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const floorLinks = new Map();
const bands = new Map();
const assets = { arrival: 'loading', facade: 'idle' };
let shownImage = 'arrival';
let floors = new Map();
let registration = null;
let ready = false;
let hovered = null;
let route = { view: 'arrival', floorId: null, invalid: false };
let facadeChange = 0;
let facadeRevealed = false;
let drag;
let suppressClick = false;
let initialFrame = true;

const camera = previewCamera(id('transformStage'), motion, publishSettlement);

function currentGeometry() {
  return registration?.floors.find(row => row.floor_id === route.floorId) ?? null;
}

function getSelection() {
  const floor = floors.get(route.floorId);
  if (!floor) return null;
  const geometry = currentGeometry();
  const viewport = camera.snapshot();
  return structuredClone({
    floorId: floor.floor_id, label: floor.label, planRefs: floor.plans,
    viewId: registration?.image_id ?? 'Mocire_H-Zadar_000',
    status: geometry?.status ?? 'map-unavailable',
    sourceSha256: registration?.source_sha256 ?? null,
    polygons: geometry?.polygons ?? [], focus: geometry?.focus ?? null,
    endpoint: geometry?.focus && assets.facade === 'ready' ? camera.target('facade', geometry.focus) : null,
    viewport: assets.facade === 'ready' ? viewport : null,
    url: location.pathname + location.search + location.hash,
  });
}

function publishSettlement() {
  if (!facadeRevealed || !currentGeometry()?.focus) return;
  const detail = getSelection();
  const { viewport, endpoint } = detail;
  if (!viewport || !endpoint || viewport.moving || Math.abs(viewport.scale - endpoint.scale) > .0001 ||
      Math.hypot(viewport.x - endpoint.x, viewport.y - endpoint.y) > .15) return;
  scene.dispatchEvent(new CustomEvent('mocire:exterior-focus', { detail, bubbles: true }));
}

function fromUrl() {
  const params = new URLSearchParams(location.search);
  const ids = params.getAll('floor');
  if (ids.length) {
    if (!ready) return { view: 'facade', floorId: null, invalid: false };
    const valid = ids.length === 1 && floors.has(ids[0]);
    return { view: 'facade', floorId: valid ? ids[0] : null, invalid: !valid && floors.size > 0 };
  }
  return { view: params.get('view') === 'facade' ? 'facade' : 'arrival', floorId: null, invalid: false };
}

function href(view, floorId) {
  const url = new URL(location.href);
  url.searchParams.delete('floor');
  url.searchParams.delete('view');
  if (floorId) url.searchParams.set('floor', floorId);
  else if (view === 'facade') url.searchParams.set('view', 'facade');
  return url.pathname + url.search + url.hash;
}

function move(view, floorId = null) {
  const url = href(view, floorId);
  if (url !== location.pathname + location.search + location.hash) history.pushState(null, '', url);
  showRoute(fromUrl(), 1.14);
}

function selectFloor(floorId) {
  if (!floors.has(floorId)) return false;
  move('facade', floorId);
  return true;
}

function floorPlanHref(floorId) {
  const url = new URL('http://127.0.0.1:3103/exterior-preview/plans');
  url.searchParams.set('floor', floorId);
  return url.href;
}

function activateBand(floorId) {
  if (!isPlanReview) {
    selectFloor(floorId);
  } else if (floors.has(floorId)) {
    // This is a navigation from a separate local review, not an approval of the
    // estimated registration. The interactive floor route validates the ID again.
    location.assign(floorPlanHref(floorId));
  }
}

function setState() {
  html.dataset.state = route.floorId ? 'FLOOR_SELECTED' : bands.has(hovered) && !overlay.hasAttribute('hidden') ? 'FLOOR_HOVER' :
    route.view === 'facade' ? 'BUILDING_FOCUS' : 'OVERVIEW';
  if (route.floorId) html.dataset.floor = route.floorId;
  else delete html.dataset.floor;
}

function setHover(next) {
  for (const [floorId, node] of bands) node.dataset.hovered = String(floorId === next);
  for (const [floorId, node] of floorLinks) node.dataset.hovered = String(floorId === next);
  hovered = next;
  setState();
}

function updateOverlay() {
  const hidden = !(facadeRevealed && registration && route.view === 'facade');
  overlay.toggleAttribute('hidden', hidden);
  if (hidden) overlay.setAttribute('aria-hidden', 'true');
  else overlay.removeAttribute('aria-hidden');
}

function updatePanel() {
  const floor = floors.get(route.floorId);
  const isFacade = route.view === 'facade';
  const note = panel.querySelector('.rail-note');
  note.textContent = floors.size === 0 ? (ready ? 'Popis etaža nije dostupan.' : 'Učitavanje popisa etaža…') :
    isPlanReview && !isFacade ? 'Odaberite etažu za otvaranje tlocrta.' :
      registration ? (isPlanReview ? 'Položaji su procjene prema slici, a ne potvrđene oznake.' : 'Položaji na pročelju nisu potvrđeni.') :
        'Oznake na pročelju nisu dostupne.';
  id('panelIndex').textContent = floor ? floor.floor_id.slice(1) : 'H';
  id('panelKicker').textContent = floor ? 'Močire Zadar H' : isFacade ? 'Močire / Zgrada H' : 'Stambena zgrada u Zadru';
  id('panelTitle').textContent = floor?.label ?? (isFacade ? 'Pročelje' : 'Močire Zadar H');
  id('inspectorContent').textContent = route.invalid ? 'Tražena etaža nije pronađena. Odaberite etažu s popisa.' :
    floor ? (currentGeometry()?.status === 'unmapped' ? 'Prizemlje je zaklonjeno i nije označeno na pročelju.' :
      currentGeometry() ? 'Položaj etaže na pročelju nije potvrđen.' : 'Oznaka ove etaže na pročelju nije dostupna.') :
      isFacade ? (isPlanReview ? 'Kliknite etažu na pročelju ili na popisu da otvorite tlocrt i odaberete stan.' :
        'Odaberite etažu na pročelju ili s popisa. Povucite prikaz za pomak.') :
        isPlanReview ? 'Odaberite etažu s popisa ili otvorite pogled na pročelje.' : 'Pogled s prilaza i pročelje zgrade H.';
  id('panelAction').href = href(isFacade ? 'arrival' : 'facade', null);
  const action = isFacade ? 'Povratak na prilaz' : 'Istraži etaže';
  id('panelAction').firstElementChild.textContent = action;
  id('panelAction').setAttribute('aria-label', action);
  for (const [view, node] of [['arrival', id('arrivalLink')], ['facade', id('facadeLink')]]) {
    if (route.view === view) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  }
  for (const [floorId, node] of floorLinks) {
    if (floorId === route.floorId) node.setAttribute('aria-current', 'true');
    else node.removeAttribute('aria-current');
  }
  for (const [floorId, node] of bands) {
    node.dataset.selected = String(floorId === route.floorId);
    node.setAttribute('aria-pressed', node.dataset.selected);
  }
}

function showMessage() {
  const message = id('imageMessage');
  let text = '';
  if (route.view === 'facade' && assets.facade !== 'ready') {
    text = assets.facade === 'error' ? 'Pročelje nije dostupno. Etaže i dalje možete odabrati s popisa.' : 'Učitavanje pročelja…';
  } else if (route.view === 'arrival' && assets.arrival !== 'ready') {
    text = assets.arrival === 'error' ? 'Pogled s prilaza nije dostupan. Odaberite pročelje.' : 'Učitavanje prikaza…';
  }
  message.textContent = text;
  message.hidden = !text;
}

function sizeCamera() {
  camera.resize(canvas.clientWidth, canvas.clientHeight);
}

function frameCamera(duration) {
  const focus = shownImage === 'facade' ? currentGeometry()?.focus : null;
  camera.frame(shownImage, focus, duration);
}

function showRoute(next, duration = 0) {
  const svgHadFocus = overlay.contains(document.activeElement);
  route = next;
  html.dataset.view = route.view;
  setHover(null);
  updatePanel();
  if (route.view === 'facade') startFacade();
  showMessage();

  const previousImage = shownImage;
  shownImage = route.view === 'facade' && assets.facade === 'ready' ? 'facade' : 'arrival';
  scene.dataset.asset = assets[route.view];
  scene.dataset.image = shownImage;
  id('shotLabel').textContent = shownImage === 'facade' ? 'Pogled na pročelje' : 'Pogled s prilaza';
  id('cameraTools').hidden = shownImage !== 'facade';
  canvas.dataset.gestures = String(shownImage === 'facade');
  arrival.setAttribute('aria-hidden', String(shownImage !== 'arrival'));
  facade.setAttribute('aria-hidden', String(shownImage !== 'facade'));
  if (previousImage !== shownImage) {
    facadeRevealed = false;
    const change = ++facadeChange;
    if (shownImage === 'facade') {
      // Never expose or hit-test a map until its own still is opaque.
      void getComputedStyle(facadePicture).opacity;
      Promise.allSettled(facadePicture.getAnimations().map(animation => animation.finished)).then(() => {
        if (change !== facadeChange) return;
        facadeRevealed = true;
        updateOverlay();
        publishSettlement();
      });
    }
  }
  updateOverlay();
  if (svgHadFocus && overlay.hasAttribute('hidden')) id(route.view === 'arrival' ? 'arrivalLink' : 'facadeLink').focus();
  sizeCamera();
  frameCamera(duration);
}

function settleImage(name, img) {
  // Responsive img natural sizes are density-corrected and can round by a pixel.
  const ratioError = Math.abs(img.naturalHeight - img.naturalWidth * FRAME.height / FRAME.width);
  const status = img.naturalWidth && img.naturalHeight && ratioError <= 2 ? 'ready' : 'error';
  const avif = img.closest('picture').querySelector('source[type="image/avif"][srcset]');
  if (status === 'error' && avif && img.currentSrc.endsWith('.avif')) {
    avif.removeAttribute('srcset');
    return;
  }
  if (assets[name] === status) return;
  assets[name] = status;
  if (name === route.view) showRoute(route, name === 'facade' && ready ? 1.14 : 0);
  if (name === 'arrival') {
    if (!motion.matches && route.view === 'arrival' && status === 'ready' && globalThis.gsap && initialFrame) {
      globalThis.gsap.fromTo(scene.querySelector('.arrival'), { opacity: .78 }, { opacity: 1, duration: .77, ease: 'power2.out', clearProps: 'opacity' });
    }
    initialFrame = false;
    if (typeof requestIdleCallback === 'function') requestIdleCallback(startFacade, { timeout: 1600 });
    else startFacade();
  }
}

function startFacade() {
  if (assets.facade !== 'idle') return;
  assets.facade = 'loading';
  const source = facadePicture.querySelector('source');
  source.srcset = source.dataset.srcset;
  facade.srcset = facade.dataset.srcset;
  facade.src = facade.dataset.src;
}

function simpleClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function wireLink(node, action) {
  node.addEventListener('click', event => {
    if (!simpleClick(event)) return;
    event.preventDefault();
    action();
  });
}

function hoverEvents(node, floorId) {
  node.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') setHover(floorId); });
  node.addEventListener('pointerleave', () => { if (hovered === floorId) setHover(null); });
  node.addEventListener('focus', () => setHover(floorId));
  node.addEventListener('blur', () => { if (hovered === floorId) setHover(null); });
}

function drawFloorList() {
  const ordered = [...floors.values()].reverse();
  panel.dataset.available = String(ordered.length > 0);
  for (const floor of ordered) {
    const floorId = floor.floor_id;
    const geometry = registration?.floors.find(row => row.floor_id === floorId);
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'floor-item';
    link.dataset.floorId = floorId;
    link.dataset.state = geometry?.status ?? 'map-unavailable';
    link.href = isPlanReview ? floorPlanHref(floorId) : href('facade', floorId);
    if (geometry?.status === 'unmapped') link.setAttribute('aria-description', 'Dostupno samo na popisu etaža');
    const code = document.createElement('span');
    code.className = 'floor-code';
    code.setAttribute('aria-hidden', 'true');
    code.textContent = floorId.slice(1);
    link.append(code, floor.label);
    floorLinks.set(floorId, link);
    if (!isPlanReview) wireLink(link, () => selectFloor(floorId));
    hoverEvents(link, floorId);
    li.append(link);
    floorList.append(li);
  }
}

function drawBands() {
  const create = name => document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const { floor_id: floorId, status, polygons } of registration?.floors ?? []) {
    if (status !== 'provisional') continue;
    const band = create('g');
    band.setAttribute('class', 'floor-hotspot-group');
    band.setAttribute('role', 'button');
    band.setAttribute('tabindex', '0');
    band.setAttribute('aria-label', `${floors.get(floorId).label} — nepotvrđen položaj na pročelju`);
    band.dataset.bandId = floorId;
    band.dataset.state = status;
    for (const ring of polygons) {
      const polygon = create('polygon');
      polygon.setAttribute('class', 'floor-band-polygon');
      polygon.setAttribute('points', ring.map(pair => pair.join(',')).join(' '));
      band.append(polygon);
    }
    band.addEventListener('click', event => {
      if (event.detail === 0 || (!drag?.moved && !suppressClick)) activateBand(floorId);
    });
    band.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activateBand(floorId);
    });
    hoverEvents(band, floorId);
    bands.set(floorId, band);
    overlay.append(band);
  }
}

function validMap(map) {
  if (map?.status !== 'PROVISIONAL_NOT_APPROVED' || map.image_id !== 'Mocire_H-Zadar_000' ||
      map.width_px !== FRAME.width || map.height_px !== FRAME.height || map.crop !== 'none' ||
      map.viewBox !== `0 0 ${FRAME.width} ${FRAME.height}` || !Array.isArray(map.floors) ||
      map.floors.length !== floors.size || new Set(map.floors.map(row => row?.floor_id)).size !== floors.size) return false;
  function point(pair) {
    return Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite) &&
      pair[0] >= 0 && pair[0] <= FRAME.width && pair[1] >= 0 && pair[1] <= FRAME.height;
  }
  return map.floors.every(row => row && floors.has(row.floor_id) && Array.isArray(row.polygons) && (
    row.status === 'unmapped' ? row.focus === null && row.polygons.length === 0 :
      row.status === 'provisional' && point(row.focus) && row.polygons.length > 0 &&
      row.polygons.every(ring => Array.isArray(ring) && ring.length >= 3 && ring.every(point))
  ));
}

async function json(url) {
  try {
    const response = await fetch(url);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function loadFloorData() {
  const [inventory, map] = await Promise.all([json('/data/floors.json'), json('/data/registration.json')]);
  if (Array.isArray(inventory?.floors)) {
    floors = new Map(inventory.floors.filter(floor => typeof floor?.floor_id === 'string' &&
      typeof floor.label === 'string' && Array.isArray(floor.plans)).map(floor => [floor.floor_id, floor]));
  }
  registration = validMap(map) ? map : null;
  drawFloorList();
  drawBands();
  ready = true;
  const address = fromUrl();
  // Keep floor bookmarks from the previous read-only review usable.
  if (isPlanReview && address.floorId) location.replace(floorPlanHref(address.floorId));
  else showRoute(address, 0);
}

// Defer to vertical page scrolling and native pinch zoom on touch screens.
canvas.addEventListener('pointerdown', event => {
  if (shownImage !== 'facade' || !event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, pose: null };
});

canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== drag?.id) return;
  const x = event.clientX - drag.x;
  const y = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(x, y) < 8) return;
  if (!drag.moved) {
    if (event.pointerType === 'touch' && Math.abs(x) < Math.abs(y)) return;
    drag.moved = true;
    drag.pose = camera.snapshot();
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = 'true';
    setHover(null);
  }
  camera.pan(drag.pose.x + x, drag.pose.y + y);
});

function releasePointer(event) {
  if (event.pointerId !== drag?.id) return;
  suppressClick = drag.moved;
  drag = null;
  canvas.dataset.dragging = 'false';
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);
overlay.addEventListener('click', event => {
  if (!suppressClick || event.detail === 0) return;
  event.stopPropagation();
  event.preventDefault();
}, true);

wireLink(id('arrivalLink'), () => move('arrival'));
wireLink(id('overviewLink'), () => move('arrival'));
wireLink(id('facadeLink'), () => move('facade'));
wireLink(id('panelAction'), () => move(route.view === 'facade' ? 'arrival' : 'facade'));
if (isPlanReview) {
  id('arrivalLink').textContent = 'Pregled';
  id('arrivalLink').href = id('overviewLink').href = href('arrival', null);
  id('facadeLink').href = href('facade', null);
}
id('btnResetView').addEventListener('click', () => move('facade'));
id('btnZoomIn').addEventListener('click', () => camera.zoom(1.19));
id('btnZoomOut').addEventListener('click', () => camera.zoom(1 / 1.19));
window.addEventListener('popstate', () => showRoute(fromUrl(), 1.14));
motion.addEventListener('change', () => frameCamera(0));

for (const [name, img] of [['arrival', arrival], ['facade', facade]]) {
  img.addEventListener('load', () => settleImage(name, img));
  img.addEventListener('error', () => settleImage(name, img));
}

scene.dataset.ready = 'true';
showRoute(fromUrl(), 0);
if (arrival.complete) settleImage('arrival', arrival);
new ResizeObserver(() => { sizeCamera(); frameCamera(0); }).observe(canvas);
loadFloorData();
// Preview/S4 handoff, not a production plan navigation API.
window.mocireExteriorPreview = Object.freeze({ selectFloor, getSelection });
