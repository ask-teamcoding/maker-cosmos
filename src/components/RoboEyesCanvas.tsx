import React, { useEffect, useRef } from 'react';
import { ExpressionCode, CardinalPosition } from '../types';

interface RoboEyesCanvasProps {
  expression: ExpressionCode;
  position?: CardinalPosition;
  width?: number | string;
  height?: number | string;
  showTextOverlay?: boolean;
  overlayText?: string;
  autoBlink?: boolean;
  idleGaze?: boolean;
  curiosity?: boolean;
  className?: string;
}

export const RoboEyesCanvas: React.FC<RoboEyesCanvasProps> = ({
  expression = 'DEFAULT',
  position = 'DEFAULT',
  width = '100%',
  height = '100%',
  showTextOverlay = false,
  overlayText = '',
  autoBlink = true,
  idleGaze = true,
  curiosity = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const tickRef = useRef<number>(0);
  const lastBlinkRef = useRef<number>(performance.now());
  const isBlinkingRef = useRef<boolean>(false);
  const blinkStartRef = useRef<number>(0);

  // Idle gaze shift variables
  const lastGazeShiftRef = useRef<number>(performance.now());
  const currentGazePosRef = useRef<CardinalPosition>(position);

  useEffect(() => {
    currentGazePosRef.current = position;
  }, [position]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      tickRef.current += 1;
      const now = performance.now();
      const tick = tickRef.current;

      const cw = canvas.width;
      const ch = canvas.height;

      // Clear background OLED pure black
      ctx.fillStyle = '#020817';
      ctx.fillRect(0, 0, cw, ch);

      // If showing text screen (OLED 128x64 display text buffer)
      if (showTextOverlay && overlayText) {
        ctx.fillStyle = '#030712';
        ctx.fillRect(4, 4, cw - 8, ch - 8);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(4, 4, cw - 8, ch - 8);

        // Header
        ctx.fillStyle = '#38bdf8';
        ctx.font = `bold ${Math.max(10, Math.floor(ch * 0.12))}px 'JetBrains Mono', monospace`;
        ctx.fillText('COSMOS RESPONDE:', 12, ch * 0.22);

        // Divider
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(12, ch * 0.28);
        ctx.lineTo(cw - 12, ch * 0.28);
        ctx.stroke();

        // Text wrap
        ctx.fillStyle = '#f8fafc';
        ctx.font = `${Math.max(9, Math.floor(ch * 0.10))}px 'JetBrains Mono', monospace`;

        const maxWidth = cw - 24;
        const lineHeight = ch * 0.15;
        const words = overlayText.split(' ');
        let line = '';
        let y = ch * 0.44;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, 12, y);
            line = words[n] + ' ';
            y += lineHeight;
            if (y > ch - 8) break;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 12, y);

        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // OLED screen inner border styling
      ctx.fillStyle = '#030712';
      ctx.fillRect(4, 4, cw - 8, ch - 8);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, cw - 8, ch - 8);

      // Scale calculations based on 128x64 base resolution
      const scale = Math.min(cw / 128, ch / 64) * 0.82;
      const cx = cw / 2;
      const cy = ch / 2;

      // Base geometry (FluxGarage standard)
      const baseEyeW = 36 * scale;
      const baseEyeH = 36 * scale;
      const spaceBetween = 10 * scale;
      const borderRadius = 8 * scale;

      // Evaluate Mood & Expression
      let currentMood = expression.toUpperCase();
      let activePos: CardinalPosition = currentGazePosRef.current;

      // Automatic Idle Gaze (look naturally around if DEFAULT mood)
      if (idleGaze && currentMood === 'DEFAULT' && (expression === 'DEFAULT' || expression === 'NEUTRAL')) {
        if (now - lastGazeShiftRef.current > 3500 + Math.random() * 2000) {
          lastGazeShiftRef.current = now;
          const posOptions: CardinalPosition[] = ['DEFAULT', 'DEFAULT', 'N', 'E', 'W', 'DEFAULT'];
          currentGazePosRef.current = posOptions[Math.floor(Math.random() * posOptions.length)];
        }
        activePos = currentGazePosRef.current;
      }

      // Automatic Natural Blinking
      if (autoBlink && (currentMood === 'DEFAULT' || currentMood === 'NEUTRAL')) {
        if (!isBlinkingRef.current && now - lastBlinkRef.current > 4200) {
          isBlinkingRef.current = true;
          blinkStartRef.current = now;
        } else if (isBlinkingRef.current && now - blinkStartRef.current > 160) {
          isBlinkingRef.current = false;
          lastBlinkRef.current = now;
        }
      }

      const isBlink = currentMood === 'BLINK' || isBlinkingRef.current;

      // Cardinal Position Offsets
      let posDx = 0;
      let posDy = 0;
      if (activePos === 'N' || currentMood === 'THINKING') {
        posDy = -8 * scale;
      } else if (activePos === 'S' || currentMood === 'TIRED' || currentMood === 'SAD') {
        posDy = 6 * scale;
      } else if (activePos === 'E') {
        posDx = 11 * scale;
      } else if (activePos === 'W') {
        posDx = -11 * scale;
      }

      // Mood Animations
      if (currentMood === 'CONFUSED' || currentMood === 'THINKING') {
        posDx += Math.sin(tick * 0.08) * 7 * scale;
      } else if (currentMood === 'LAUGH') {
        posDy += Math.sin(tick * 0.14) * 5 * scale;
      } else if (currentMood === 'TALKING') {
        posDy += Math.sin(tick * 0.18) * 2 * scale;
      }

      const totalEyesW = baseEyeW * 2 + spaceBetween;
      const startX = cx - totalEyesW / 2 + posDx;
      const baseY = cy - baseEyeH / 2 + posDy;

      // Draw Left Eye (0) and Right Eye (1)
      for (let i = 0; i < 2; i++) {
        let ew = baseEyeW;
        let eh = baseEyeH;

        // Curiosity feature: outer eye becomes slightly larger when looking sideways
        if (curiosity) {
          if (activePos === 'E' && i === 1) {
            ew *= 1.1;
            eh *= 1.1;
          } else if (activePos === 'W' && i === 0) {
            ew *= 1.1;
            eh *= 1.1;
          }
        }

        const ox = startX + i * (baseEyeW + spaceBetween) + (i === 1 && curiosity && activePos === 'W' ? baseEyeW * 0.05 : 0);
        const oy = baseY - (eh - baseEyeH) / 2;

        if (isBlink) {
          // Blink: thin horizontal glowing cyan slit
          const slitH = Math.max(2, 2.5 * scale);
          const midY = oy + eh / 2;
          ctx.fillStyle = '#7dd3fc';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = Math.max(1, 1.2 * scale);
          ctx.beginPath();
          ctx.roundRect(ox, midY - slitH, ew, slitH * 2, slitH);
          ctx.fill();
          ctx.stroke();
          continue;
        }

        // Color palettes
        let eyeFill = '#dbeafe';
        let eyeBorder = '#38bdf8';
        let innerFill = '#e0f2fe';
        let pupilColor = '#020817';

        if (currentMood === 'HAPPY' || currentMood === 'LAUGH') {
          eyeFill = '#bae6fd';
          eyeBorder = '#0ea5e9';
          innerFill = '#f0f9ff';
        } else if (currentMood === 'TIRED' || currentMood === 'SAD') {
          eyeFill = '#bfdbfe';
          eyeBorder = '#2563eb';
        } else if (currentMood === 'ANGRY' || currentMood === 'ERROR') {
          eyeFill = '#fee2e2';
          eyeBorder = '#ef4444';
          innerFill = '#fef2f2';
          pupilColor = '#450a0a';
        } else if (currentMood === 'TALKING') {
          eyeFill = '#cffafe';
          eyeBorder = '#22d3ee';
          innerFill = '#ecfeff';
        }

        ctx.save();

        // 1. Draw base eye container (rounded rectangle)
        ctx.fillStyle = eyeFill;
        ctx.strokeStyle = eyeBorder;
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.beginPath();
        ctx.roundRect(ox, oy, ew, eh, borderRadius);
        ctx.fill();
        ctx.stroke();

        // Clip to the eye boundary for realistic eyelid cuts
        ctx.beginPath();
        ctx.roundRect(ox, oy, ew, eh, borderRadius);
        ctx.clip();

        // 2. Inner lens gradient / soft layer
        const pad = Math.max(3, 0.16 * ew);
        ctx.fillStyle = innerFill;
        ctx.beginPath();
        ctx.roundRect(ox + pad, oy + pad, ew - pad * 2, eh - pad * 2, Math.max(2, borderRadius * 0.6));
        ctx.fill();

        // 3. Pupil & look shift
        let lookX = 0;
        let lookY = 0;
        if (activePos === 'E') lookX = ew * 0.15;
        if (activePos === 'W') lookX = -ew * 0.15;
        if (activePos === 'N' || currentMood === 'THINKING') lookY = -eh * 0.12;
        if (activePos === 'S') lookY = eh * 0.12;

        if (currentMood === 'CONFUSED') {
          lookX += Math.sin(tick * 0.1 + i) * 6 * scale;
        } else if (currentMood === 'LAUGH') {
          lookY += Math.sin(tick * 0.15 + i) * 4 * scale;
        } else if (currentMood === 'ANGRY') {
          lookX += i === 0 ? 3 * scale : -3 * scale;
        }

        let pupilW = Math.max(6 * scale, ew * 0.32);
        let pupilH = Math.max(6 * scale, eh * 0.34);

        if (currentMood === 'ANGRY') {
          pupilW *= 0.8;
          pupilH *= 0.9;
        } else if (currentMood === 'HAPPY') {
          pupilW *= 1.1;
          pupilH *= 1.1;
        }

        const pupilCenterX = ox + ew / 2 + lookX;
        const pupilCenterY = oy + eh / 2 + lookY;

        ctx.fillStyle = pupilColor;
        ctx.beginPath();
        ctx.ellipse(pupilCenterX, pupilCenterY, pupilW / 2, pupilH / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Catchlight (glowing white reflection dot)
        const shineR = Math.max(1.5, pupilW * 0.2);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pupilCenterX - pupilW * 0.2, pupilCenterY - pupilH * 0.2, shineR, 0, Math.PI * 2);
        ctx.fill();

        // 4. Mood specific overlays & Eyelid shapes
        if (currentMood === 'HAPPY' || currentMood === 'LAUGH') {
          // Bottom eyelid rises in smooth arc
          const cutH = eh * 0.44;
          ctx.fillStyle = '#030712';
          ctx.beginPath();
          ctx.arc(ox + ew / 2, oy + eh + 2 * scale, ew * 0.7, Math.PI, Math.PI * 2, false);
          ctx.fill();

          // Cute cheek glow
          const cheekR = 4 * scale;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
          ctx.beginPath();
          ctx.arc(ox - 1, oy + eh - 2 * scale, cheekR, 0, Math.PI * 2);
          ctx.arc(ox + ew + 1, oy + eh - 2 * scale, cheekR, 0, Math.PI * 2);
          ctx.fill();
        } else if (currentMood === 'TIRED' || currentMood === 'SAD') {
          // Top eyelid droops down slanted
          const droopH = eh * 0.45;
          ctx.fillStyle = '#030712';
          ctx.beginPath();
          if (i === 0) {
            ctx.moveTo(ox - 2, oy - 2);
            ctx.lineTo(ox + ew + 2, oy - 2);
            ctx.lineTo(ox + ew + 2, oy + droopH);
            ctx.lineTo(ox - 2, oy + droopH * 0.35);
          } else {
            ctx.moveTo(ox - 2, oy - 2);
            ctx.lineTo(ox + ew + 2, oy - 2);
            ctx.lineTo(ox + ew + 2, oy + droopH * 0.35);
            ctx.lineTo(ox - 2, oy + droopH);
          }
          ctx.closePath();
          ctx.fill();
        } else if (currentMood === 'ANGRY' || currentMood === 'ERROR') {
          // Fierce angry slanted cut
          const browH = eh * 0.50;
          ctx.fillStyle = '#030712';
          ctx.beginPath();
          if (i === 0) {
            ctx.moveTo(ox - 2, oy - 2);
            ctx.lineTo(ox + ew + 2, oy - 2);
            ctx.lineTo(ox + ew + 2, oy + browH * 0.25);
            ctx.lineTo(ox - 2, oy + browH);
          } else {
            ctx.moveTo(ox - 2, oy - 2);
            ctx.lineTo(ox + ew + 2, oy - 2);
            ctx.lineTo(ox + ew + 2, oy + browH);
            ctx.lineTo(ox - 2, oy + browH * 0.25);
          }
          ctx.closePath();
          ctx.fill();

          // Brow accent line
          ctx.strokeStyle = currentMood === 'ERROR' ? '#ef4444' : '#38bdf8';
          ctx.lineWidth = Math.max(1.5, 2 * scale);
          ctx.beginPath();
          if (i === 0) {
            ctx.moveTo(ox - 2, oy + browH - 2);
            ctx.lineTo(ox + ew + 2, oy + browH * 0.25 - 2);
          } else {
            ctx.moveTo(ox - 2, oy + browH * 0.25 - 2);
            ctx.lineTo(ox + ew + 2, oy + browH - 2);
          }
          ctx.stroke();
        }

        ctx.restore();
      }

      // 5. Talking state audio waveform equalizer bars
      if (currentMood === 'TALKING') {
        const barCount = 5;
        const barW = 4.5 * scale;
        const barGap = 3.5 * scale;
        const totalW = barCount * barW + (barCount - 1) * barGap;
        const barStartX = cx - totalW / 2;
        const barBaseY = baseY + baseEyeH + 11 * scale;

        for (let b = 0; b < barCount; b++) {
          const barH = (5 + 6 * Math.abs(Math.sin(tick * 0.12 + b * 1.4))) * scale;
          const bx = barStartX + b * (barW + barGap);
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.roundRect(bx, barBaseY - barH, barW, barH, 2);
          ctx.fill();
        }
      }

      // Subtitle / OLED status indicator
      ctx.fillStyle = '#0284c7';
      ctx.font = `bold ${Math.max(7, Math.floor(ch * 0.08))}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`FLUXGARAGE ROBOEYES • ${currentMood}`, cx, ch - 8);

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [expression, position, showTextOverlay, overlayText, autoBlink, idleGaze, curiosity]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-sky-900/60 bg-[#020817] shadow-inner ${className}`}>
      <canvas
        ref={canvasRef}
        width={380}
        height={240}
        className="w-full h-full object-contain block"
      />
      {/* Scanline CRT Overlay */}
      <div className="pointer-events-none absolute inset-0 scanline opacity-30"></div>
    </div>
  );
};
