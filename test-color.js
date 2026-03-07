const ctx = document.createElement('canvas').getContext('2d');
if (ctx) {
  ctx.fillStyle = 'oklch(0.7 0.1 200)';
  console.log(ctx.fillStyle);
}
