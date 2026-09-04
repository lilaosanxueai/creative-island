import { useEffect, useRef } from 'react';
import { STAGE_W, STAGE_H, type StageState } from '../runtime/stageState.ts';

interface Props {
  stage: StageState;
  onSpriteClick?: () => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

/** 小剧场：把 StageState 画到 canvas（中心原点、y 向上） */
export default function Stage({ stage, onSpriteClick, onCanvasReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = STAGE_W * dpr;
    canvas.height = STAGE_H * dpr;
    onCanvasReady?.(canvas);

    let raf = 0;
    const draw = () => {
      const s = stageRef.current;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);

      // 背景：天空 + 草地
      const sky = ctx.createLinearGradient(0, 0, 0, STAGE_H);
      sky.addColorStop(0, '#bae6fd');
      sky.addColorStop(0.75, '#e0f2fe');
      sky.addColorStop(1, '#bbf7d0');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(0, STAGE_H - 26, STAGE_W, 26);

      const toCanvas = (x: number, y: number): [number, number] => [STAGE_W / 2 + x, STAGE_H / 2 - y];

      // 目标点
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of s.targets) {
        const [tx, ty] = toCanvas(t.x, t.y);
        ctx.globalAlpha = t.reached ? 0.55 : 1;
        ctx.fillText(t.emoji, tx, ty);
        if (t.reached) ctx.fillText('✅', tx + 18, ty - 20);
        ctx.globalAlpha = 1;
      }

      // 角色
      if (s.visible) {
        const [cx, cy] = toCanvas(s.x, s.y);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(((s.dir - 90) * Math.PI) / 180);
        ctx.font = `${Math.round(48 * s.size / 100)}px serif`;
        ctx.fillText(s.costume, 0, 6); // emoji 基线补偿
        ctx.restore();

        // 说话气泡
        if (s.bubble && performance.now() < s.bubble.until) {
          drawBubble(ctx, cx, cy - 34 - 24 * s.size / 100, s.bubble.text);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onSpriteClick) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * STAGE_W;
    const py = ((e.clientY - rect.top) / rect.height) * STAGE_H;
    const sx = STAGE_W / 2 + stage.x, sy = STAGE_H / 2 - stage.y;
    if (Math.hypot(px - sx, py - sy) < 45) onSpriteClick();
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full rounded-2xl border-4 border-white shadow-md cursor-pointer"
      style={{ aspectRatio: '4 / 3' }}
    />
  );
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  const charsPerLine = 10;
  const lines: string[] = [];
  for (let i = 0; i < text.length && lines.length < 4; i += charsPerLine) lines.push(text.slice(i, i + charsPerLine));
  const w = Math.min(200, Math.max(60, charsPerLine * 16 + 20));
  const h = lines.length * 22 + 14;
  const bx = Math.max(w / 2 + 4, Math.min(STAGE_W - w / 2 - 4, x));
  const by = Math.max(h / 2 + 4, y);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx - w / 2, by - h / 2, w, h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx - 6, by + h / 2);
  ctx.lineTo(bx + 8, by + h / 2);
  ctx.lineTo(bx + 2, by + h / 2 + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, bx, by - h / 2 + 18 + i * 22));
  ctx.restore();
}
