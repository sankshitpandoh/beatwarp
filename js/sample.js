// Procedural starter picture so the visualizer has something to warp before an upload.
export function makeSampleImage() {
  const W = 1200, H = 900;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, H * .62);
  sky.addColorStop(0, '#12052e');
  sky.addColorStop(.45, '#6a1b6b');
  sky.addColorStop(.8, '#f2546b');
  sky.addColorStop(1, '#ffb36b');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // stars
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * .8})`;
    g.fillRect(Math.random() * W, Math.random() * H * .4, 2, 2);
  }

  // striped sun
  const cx = W / 2, cy = H * .5, r = 230;
  const sun = g.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, '#fff3a8');
  sun.addColorStop(.6, '#ff7b54');
  sun.addColorStop(1, '#ff2e7e');
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = sun;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.fillStyle = '#6a1b6b';
  for (let i = 0; i < 8; i++) {
    const y = cy + 20 + i * 26;
    g.fillRect(cx - r, y, r * 2, 4 + i * 2.2);
  }
  g.restore();

  // mountains
  const ridge = (base, amp, col, seed) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const y = base - amp * Math.abs(Math.sin(x * .004 + seed) + .5 * Math.sin(x * .011 + seed * 2));
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.fill();
  };
  ridge(H * .63, 120, '#3b0f4f', 1);
  ridge(H * .66, 70, '#21083a', 4);

  // neon grid floor
  g.fillStyle = '#0b0220';
  g.fillRect(0, H * .66, W, H);
  g.strokeStyle = '#ff3ec9';
  g.lineWidth = 2;
  g.shadowColor = '#ff3ec9';
  g.shadowBlur = 12;
  for (let i = 0; i < 14; i++) {
    const y = H * .66 + Math.pow(i / 13, 2.2) * H * .34;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  for (let i = -16; i <= 16; i++) {
    g.beginPath();
    g.moveTo(cx + i * 18, H * .66);
    g.lineTo(cx + i * 150, H);
    g.stroke();
  }
  return c;
}
