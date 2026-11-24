// Offline registration QA. No application, HTTP server, or Sigma HTML maps.
// Run from the repo root: node scripts/validate/verify-stage2-plans.mjs
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { plans } from './stage2-plan-witnesses.mjs';

const raw = 'assets/source/mocire-zadar-h/raw';
const svgDir = 'assets/geometry/stage2/private/overlays';
const output = 'reports/qa/stage2/private';
const inventory = JSON.parse(await readFile(path.join(raw, '../inventory.json')));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage();
  await page.route(/^https?:/, (route) => route.abort()); // proofs stay offline
  for (const plan of plans) {
    const level = plan.id.split('-')[0];
    const expected = inventory.floors.find((f) => f.level === level).units.map((u) => u.label);
    const img = await readFile(path.join(raw, plan.file));
    if (digest(img) !== plan.sha256) throw Error(`Witness image changed: ${plan.file}`);
    const svg = await readFile(path.join(svgDir, `${plan.id}.svg`), 'utf8');
    for (const [width, height] of [[1440,900],[390,844]]) {
      await page.setViewportSize({ width, height });
      await page.setContent(`<!doctype html><meta charset="utf-8">
        <style>
          *{box-sizing:border-box}body{margin:0;padding:16px;background:#f6f6f1;color:#17261e;font:15px system-ui}
          h1{font-size:20px;margin:0 0 4px}p{margin:0 0 8px}h2{font-size:14px;margin:10px 0 4px}
          img{display:block;width:100%;height:auto;background:white}#registered{position:relative}
          #registered>svg{position:absolute;inset:0;width:100%;height:100%}
          #registered [data-unit-id]{stroke:#075e47!important;stroke-width:2!important}
          footer{margin-top:8px;font-size:12px} @media(min-width:850px){body{max-width:min(1290px,calc((100vh - 170px) * ${plan.width/(2*plan.height)} + 32px));margin:auto}}
        </style>
        <h1>Močire H · ${plan.id}</h1><p>Private drawing registration review · native ${plan.width} × ${plan.height} px</p>
        <h2>1 · Original drawing</h2><img id="original" alt="Original">
        <h2>2 · Registered outlines and identity checks</h2>
        <div id="registered"><img alt="Same drawing, same crop"></div>
        <footer>Green dots: matched interior witnesses. Open circles: shared space. Red: discrepancy. ID labels mark the first room witness.</footer>`);
      const proof = await page.evaluate(async ({ plan, expected, svg, base64 }) => {
        const errors = [];
        const imgs = Array.from(document.images);
        await Promise.all(imgs.map(async (im) => {
          im.src = `data:image/png;base64,${base64}`; await im.decode();
        }));
        if (imgs.some(im => im.naturalWidth !== plan.width || im.naturalHeight !== plan.height)) errors.push('Wrong image size');
        const overlay = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
        const box = overlay.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
        if (JSON.stringify(box) !== JSON.stringify([0,0,plan.width,plan.height])) throw Error(`Wrong viewBox ${box}`);
        document.querySelector('#registered').appendChild(overlay);
        const shapes = Array.from(overlay.querySelectorAll('polygon,path,rect,polyline'))
          .filter(e => e.closest('[data-unit-id]') && !e.closest('defs'));
        const id = e => e.closest('[data-unit-id]').getAttribute('data-unit-id');
        const ids = new Set(shapes.map(id));
        const witnessed = new Set(plan.points.map(([target]) => target).filter(Boolean));
        for (const target of expected) {
          if (!ids.has(target)) errors.push(`Missing geometry: ${target}`);
          if (!witnessed.has(target)) errors.push(`Missing independent check: ${target}`);
        }
        for (const target of ids) if (!expected.includes(target)) errors.push(`Wrong floor/unknown: ${target}`);
        const transform = overlay.getScreenCTM();
        const bounds = imgs[1].getBoundingClientRect();
        for (const [x,y,cssX,cssY] of [[0,0,bounds.left,bounds.top],[plan.width,plan.height,bounds.right,bounds.bottom]]) {
          const pt = new DOMPoint(x,y).matrixTransform(transform);
          if (Math.abs(pt.x-cssX)>0.1 || Math.abs(pt.y-cssY)>0.1) errors.push('SVG and PNG crops differ');
        }
        const hits = plan.points.map(([target,x,y]) => {
          const screen = new DOMPoint(x,y).matrixTransform(transform);
          const actual = [...new Set(shapes.filter(shape => {
            const local = screen.matrixTransform(shape.getScreenCTM().inverse());
            return shape.isPointInFill(local);
          }).map(id))];
          const ok = target === null ? actual.length === 0 : actual.length === 1 && actual[0] === target;
          if (!ok) errors.push(`(${x}, ${y}) wanted ${target ?? 'shared'}, got ${actual.join('+') || 'shared'}`);
          return { target, x, y, actual, ok };
        });
        // Colouring is for the proof only, after hit testing the supplied SVG.
        for (const s of shapes) {
          const n = Number(id(s).split('.')[1]);
          s.style.setProperty('fill', `hsl(${(n*137)%360}deg 65% 45%)`, 'important');
          s.style.setProperty('fill-opacity', '.18', 'important');
          s.style.setProperty('stroke', '#0b5948', 'important');
          s.style.setProperty('stroke-width', '2', 'important');
        }
        const ns = 'http://www.w3.org/2000/svg';
        const mark = (tag, attrs, text) => {
          const e = document.createElementNS(ns,tag);
          for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
          if(text) e.textContent = text;
          overlay.appendChild(e);
        };
        const seen = new Set();
        for (const {target,x,y,ok} of hits) {
          mark('circle',{cx:x,cy:y,r:5,stroke:ok?'#123629':'#b21d15','stroke-width':2,fill:ok?(target?'#3de392':'white'):'#ff3c24'});
          if (!target || seen.has(target)) continue;
          seen.add(target);
          mark('text',{x,y:y-11,'text-anchor':'middle','font-family':'system-ui','font-weight':700,'font-size':18,
            fill:'#17261e',stroke:'white','stroke-width':4,'paint-order':'stroke'},target);
        }
        return {ids:ids.size, expected:expected.length, hits, errors};
      }, { plan, expected, svg, base64:img.toString('base64') });
      await page.screenshot({path:path.join(output, `${plan.id}-${width}x${height}.png`)});
      if (width === 1440) {
        await page.setViewportSize({width:plan.width+32, height:1100});
        await page.addStyleTag({content:`body{max-width:none;width:${plan.width+32}px}`});
        await page.locator('#registered').screenshot({path:path.join(output, `${plan.id}-native.png`)});
      }
      console.log(`${plan.id} ${width}x${height}: ${proof.ids}/${proof.expected} unit IDs, ${proof.hits.filter(p=>p.ok).length}/${proof.hits.length} witnesses, ${proof.errors.length} errors`);
      for (const err of proof.errors) console.error(`  ${err}`);
      results.push({ image:plan.file, image_sha256:plan.sha256, svg_sha256:digest(svg), viewport:[width,height], ...proof });
    }
  }
} finally {
  await browser.close();
}
await writeFile(path.join(output, 'witness-results.json'), JSON.stringify(results,null,2)+'\n');
if (results.some(r => r.errors.length)) process.exitCode = 1;
