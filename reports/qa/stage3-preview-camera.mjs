export const FRAME = { width: 1920, height: 1080 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function previewCamera(stage, motion, onSettled) {
  const pose = { x: 0, y: 0, scale: 1 };
  let bounds = { width: 1, height: 1 };
  let tween;

  function limits() {
    const cover = Math.max(bounds.width / FRAME.width, bounds.height / FRAME.height);
    return { cover, max: Math.max(cover, Math.min(1.12, cover * 1.65)) };
  }

  function constrained(next) {
    const { cover, max } = limits();
    const scale = clamp(next.scale, cover, max);
    return {
      scale,
      x: clamp(next.x, Math.min(0, bounds.width - FRAME.width * scale), 0),
      y: clamp(next.y, Math.min(0, bounds.height - FRAME.height * scale), 0),
    };
  }

  function paint() {
    const { x, y, scale } = pose;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function stop() {
    tween?.kill();
    tween = undefined;
    stage.dataset.moving = 'false';
  }

  function snapshot() {
    const { x, y, scale } = pose;
    return { x, y, scale, viewportWidth: bounds.width, viewportHeight: bounds.height, moving: Boolean(tween) };
  }

  function transition(next, duration) {
    stop();
    const final = constrained(next);
    if (!globalThis.gsap || motion.matches || !duration || (
      Math.abs(final.scale - pose.scale) < .0001 && Math.hypot(final.x - pose.x, final.y - pose.y) < .1
    )) {
      Object.assign(pose, final);
      paint();
      onSettled();
      return;
    }
    stage.dataset.moving = 'true';
    tween = globalThis.gsap.to(pose, {
      ...final, duration, ease: 'power2.inOut', onUpdate: paint,
      onComplete() { stop(); onSettled(); },
    });
  }

  function target(view, focus) {
    const { cover, max } = limits();
    const portrait = bounds.width < 680 && bounds.width < bounds.height;
    const landscape = bounds.height < 340 && bounds.width > bounds.height;
    const facade = view === 'facade';
    let point = facade ? [984, 424] : [portrait ? 1300 : 1010, landscape ? 322 : 460];
    let anchor = facade ? [portrait ? .5 : .47, portrait ? .41 : .44] : [.5, portrait ? .48 : .5];
    let scale = Math.min(max, cover * (facade && !portrait ? 1.025 : 1));
    if (focus) {
      point = focus;
      anchor = [portrait ? .5 : .46, portrait ? .38 : .48];
      scale = Math.min(max, cover * (portrait ? 1.44 : 1.28));
    }
    return constrained({ x: bounds.width * anchor[0] - point[0] * scale,
      y: bounds.height * anchor[1] - point[1] * scale, scale });
  }

  function zoom(factor) {
    const { cover, max } = limits();
    const scale = clamp(pose.scale * factor, cover, max);
    const x = bounds.width * .5;
    const y = bounds.height * .44;
    const ratio = scale / pose.scale;
    transition({ scale, x: x - (x - pose.x) * ratio, y: y - (y - pose.y) * ratio }, .28);
  }

  return {
    frame(view, focus, duration) { transition(target(view, focus), duration); },
    target,
    resize(width, height) { bounds = { width, height }; },
    pan(x, y) { stop(); Object.assign(pose, constrained({ x, y, scale: pose.scale })); paint(); },
    zoom, stop, snapshot,
  };
}
