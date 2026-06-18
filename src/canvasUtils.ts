/** Create a new blank canvas element at the given pixel size */
export function makeCanvas(w: number, h: number, fillWhite = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  if (fillWhite) {
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

/** Serialize a canvas to a PNG data URL */
export function canvasToUrl(c: HTMLCanvasElement): string {
  return c.toDataURL('image/png');
}

/** Load a data URL into an Image element */
export function urlToImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Draw a data URL onto a canvas (loading first) */
export async function drawUrlOnCanvas(c: HTMLCanvasElement, url: string): Promise<void> {
  const img = await urlToImage(url);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0);
}

/** Composite all layers onto a target canvas respecting visibility and opacity */
export function compositeLayers(
  target: HTMLCanvasElement,
  layers: { canvas: HTMLCanvasElement; visible: boolean; opacity: number; offsetX: number; offsetY: number }[],
  canvasW: number,
  canvasH: number,
) {
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, canvasW, canvasH);

  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer.canvas, layer.offsetX, layer.offsetY);
  }
  ctx.globalAlpha = 1;
}

/** Bresenham's line algorithm – returns array of pixel coordinates */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const pts: [number, number][] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
  return pts;
}

/** Flood-fill from (startX, startY) with `fillColor` on a canvas */
export function floodFill(canvas: HTMLCanvasElement, startX: number, startY: number, fillColor: string) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  const idx = (x: number, y: number) => (y * w + x) * 4;
  const startIdx = idx(startX, startY);
  const sr = data[startIdx], sg = data[startIdx + 1], sb = data[startIdx + 2], sa = data[startIdx + 3];

  // Parse fill color
  const tmp = document.createElement('canvas').getContext('2d')!;
  tmp.fillStyle = fillColor;
  tmp.fillRect(0, 0, 1, 1);
  const fd = tmp.getImageData(0, 0, 1, 1).data;
  const fr = fd[0], fg = fd[1], fb = fd[2], fa = fd[3];

  if (sr === fr && sg === fg && sb === fb && sa === fa) return;

  const match = (i: number) =>
    data[i] === sr && data[i + 1] === sg && data[i + 2] === sb && data[i + 3] === sa;

  const visited = new Uint8Array(w * h);
  const stack: [number, number][] = [[startX, startY]];

  while (stack.length) {
    const [x, y] = stack.pop()!;
    const vi = y * w + x;
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    if (visited[vi]) continue;
    const i = vi * 4;
    if (!match(i)) continue;
    visited[vi] = 1;
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = fa;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(img, 0, 0);
}

/** Export all visible layers composited to a PNG blob */
export async function exportPng(
  layers: { canvas: HTMLCanvasElement; visible: boolean; opacity: number; offsetX: number; offsetY: number }[],
  w: number,
  h: number,
): Promise<Blob> {
  const tmp = makeCanvas(w, h);
  compositeLayers(tmp, layers, w, h);
  return new Promise((resolve, reject) => {
    tmp.toBlob(b => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png');
  });
}

/** Save a blob via download link */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
