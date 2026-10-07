import type { Landmark } from '@/types';
import { SKELETON_EDGES } from '@/algorithms/landmarks';

export interface OverlayOptions {
  mirrored: boolean;
  highlight?: [number, number, number] | null; // landmark indices A, B(vertex), C
  angle?: number | null;
  angleLabel?: string;
  status?: 'ok' | 'warn' | 'error';
  drawBackdrop?: boolean; // demo mode: no video underneath
}

const COLORS = {
  bone: 'rgba(255,255,255,0.78)',
  joint: 'rgba(255,255,255,0.95)',
  target: '#E8B04B',
  ok: '#2BB39A',
  warn: '#E8B04B',
  error: '#E0605A',
};

/**
 * Draws the skeleton + highlighted target joint + angle arc onto a canvas.
 * Called from the animation loop — it touches the canvas directly, not React state.
 */
export function drawOverlay(ctx: CanvasRenderingContext2D, landmarks: Landmark[] | null, opts: OverlayOptions) {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);
  if (opts.drawBackdrop) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16353A');
    g.addColorStop(1, '#0E2528');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += W / 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += H / 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  if (!landmarks) return;

  const px = (l: Landmark) => ({ x: (opts.mirrored ? 1 - l.x : l.x) * W, y: l.y * H });
  const vis = (i: number) => (landmarks[i]?.visibility ?? 0) > 0.35;
  const scale = Math.max(1, W / 640);

  ctx.lineCap = 'round';
  ctx.lineWidth = 3 * scale;
  ctx.strokeStyle = COLORS.bone;
  for (const [a, b] of SKELETON_EDGES) {
    if (!vis(a) || !vis(b)) continue;
    const p = px(landmarks[a]), q = px(landmarks[b]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  ctx.fillStyle = COLORS.joint;
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32]) {
    if (!vis(i)) continue;
    const p = px(landmarks[i]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 4 * scale, 0, Math.PI * 2); ctx.fill();
  }

  if (opts.highlight) {
    const [ia, ib, ic] = opts.highlight;
    const [a, b, c] = [landmarks[ia], landmarks[ib], landmarks[ic]];
    if (!a || !b || !c) return;
    const pa = px(a), pb = px(b), pc = px(c);
    const color = opts.status === 'error' ? COLORS.error : opts.status === 'warn' ? COLORS.warn : COLORS.target;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5 * scale;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.lineTo(pc.x, pc.y); ctx.stroke();

    // Angle arc at the vertex (shorter way round).
    const a1 = Math.atan2(pa.y - pb.y, pa.x - pb.x);
    const a2 = Math.atan2(pc.y - pb.y, pc.x - pb.x);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const r = 34 * scale;
    ctx.fillStyle = color + '33';
    ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.arc(pb.x, pb.y, r, a1, a1 + d, d < 0); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.arc(pb.x, pb.y, r, a1, a1 + d, d < 0); ctx.stroke();

    for (const p of [pa, pc]) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 6 * scale, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(pb.x, pb.y, 9 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(pb.x, pb.y, 6 * scale, 0, Math.PI * 2); ctx.fill();

    if (opts.angle !== null && opts.angle !== undefined && Number.isFinite(opts.angle)) {
      const text = `${opts.angleLabel ? opts.angleLabel + ' ' : ''}${Math.round(opts.angle)}°`;
      ctx.font = `600 ${16 * scale}px "IBM Plex Sans", system-ui, sans-serif`;
      const tw = ctx.measureText(text).width;
      const bx = Math.min(W - tw - 20 * scale, pb.x + 16 * scale);
      const by = Math.max(24 * scale, pb.y - 24 * scale);
      ctx.fillStyle = 'rgba(12,32,35,0.82)';
      roundRect(ctx, bx - 8 * scale, by - 18 * scale, tw + 16 * scale, 26 * scale, 7 * scale);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, bx, by);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
