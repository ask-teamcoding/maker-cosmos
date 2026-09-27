import React, { useEffect, useRef, useState } from 'react';
import { ExpressionCode, SemaphoreColor } from '../types';
import { Compass, RotateCcw, Sparkles } from 'lucide-react';

interface ArenaSimulatorProps {
  lastCommand: string;
  expression: ExpressionCode;
  ledColor: SemaphoreColor;
  buzzerActive: boolean;
  onObstacleDetect?: (detected: boolean) => void;
}

export const ArenaSimulator: React.FC<ArenaSimulatorProps> = ({
  lastCommand,
  expression,
  ledColor,
  buzzerActive,
  onObstacleDetect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [robotPos, setRobotPos] = useState({ x: 180, y: 140, heading: 0 });
  const trailRef = useRef<{ x: number; y: number; alpha: number }[]>([]);
  const motionRef = useRef({
    linearSpeed: 0, // px per frame
    angularSpeed: 0, // rad per frame
    activeCommand: 'STOP',
    danceStep: 0,
    danceTimer: 0,
  });

  const obstacles = useRef([
    { x: 80, y: 60, r: 18, label: 'Bloco A' },
    { x: 280, y: 70, r: 22, label: 'Cone' },
    { x: 120, y: 220, r: 20, label: 'Poste' },
    { x: 290, y: 210, r: 24, label: 'Bloco B' },
  ]);

  // Handle motor commands
  useEffect(() => {
    const m = motionRef.current;
    m.activeCommand = lastCommand;

    if (lastCommand === 'FORWARD') {
      m.linearSpeed = 2.4;
      m.angularSpeed = 0;
    } else if (lastCommand === 'BACK') {
      m.linearSpeed = -2.0;
      m.angularSpeed = 0;
    } else if (lastCommand === 'LEFT') {
      m.linearSpeed = 0.5;
      m.angularSpeed = -0.06;
    } else if (lastCommand === 'RIGHT') {
      m.linearSpeed = 0.5;
      m.angularSpeed = 0.06;
    } else if (lastCommand === 'STOP') {
      m.linearSpeed = 0;
      m.angularSpeed = 0;
      m.danceStep = 0;
    } else if (lastCommand === 'DANCE') {
      m.danceStep = 1;
      m.danceTimer = performance.now();
    }
  }, [lastCommand]);

  // Reset Arena Position
  const handleResetPosition = () => {
    setRobotPos({ x: 180, y: 140, heading: 0 });
    trailRef.current = [];
    motionRef.current.linearSpeed = 0;
    motionRef.current.angularSpeed = 0;
  };

  // Main Animation / Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const loop = () => {
      const m = motionRef.current;
      const now = performance.now();

      // Handle dance choreo sequence (Forward -> Back -> Spin Left -> Spin Right -> Stop)
      if (m.danceStep > 0) {
        const elapsed = now - m.danceTimer;
        if (elapsed < 300) {
          m.linearSpeed = 2.6;
          m.angularSpeed = 0;
        } else if (elapsed < 600) {
          m.linearSpeed = -2.6;
          m.angularSpeed = 0;
        } else if (elapsed < 900) {
          m.linearSpeed = 0;
          m.angularSpeed = -0.12;
        } else if (elapsed < 1200) {
          m.linearSpeed = 0;
          m.angularSpeed = 0.12;
        } else {
          m.danceStep = 0;
          m.linearSpeed = 0;
          m.angularSpeed = 0;
        }
      }

      setRobotPos((prev) => {
        let newHeading = prev.heading + m.angularSpeed;
        let newX = prev.x + Math.cos(newHeading) * m.linearSpeed;
        let newY = prev.y + Math.sin(newHeading) * m.linearSpeed;

        // Arena boundaries
        const pad = 24;
        if (newX < pad) { newX = pad; m.linearSpeed = 0; }
        if (newX > canvas.width - pad) { newX = canvas.width - pad; m.linearSpeed = 0; }
        if (newY < pad) { newY = pad; m.linearSpeed = 0; }
        if (newY > canvas.height - pad) { newY = canvas.height - pad; m.linearSpeed = 0; }

        // Check proximity to obstacles
        let detected = false;
        for (const obs of obstacles.current) {
          const dist = Math.hypot(newX - obs.x, newY - obs.y);
          if (dist < obs.r + 28) {
            detected = true;
            // soft repulsive bounce
            const angle = Math.atan2(newY - obs.y, newX - obs.x);
            newX = obs.x + Math.cos(angle) * (obs.r + 28);
            newY = obs.y + Math.sin(angle) * (obs.r + 28);
          }
        }
        onObstacleDetect?.(detected);

        // Add trail dot if moving
        if (Math.abs(m.linearSpeed) > 0.1 || Math.abs(m.angularSpeed) > 0.01) {
          if (trailRef.current.length === 0 || Math.hypot(newX - trailRef.current[trailRef.current.length - 1].x, newY - trailRef.current[trailRef.current.length - 1].y) > 6) {
            trailRef.current.push({ x: newX, y: newY, alpha: 0.8 });
            if (trailRef.current.length > 40) trailRef.current.shift();
          }
        }

        return { x: newX, y: newY, heading: newHeading };
      });

      // Clear & Draw Field
      ctx.fillStyle = '#060d21';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid Pattern
      ctx.strokeStyle = '#0d1a3a';
      ctx.lineWidth = 1;
      const gridSize = 25;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Trails
      for (let i = 0; i < trailRef.current.length; i++) {
        const pt = trailRef.current[i];
        ctx.fillStyle = `rgba(14, 165, 233, ${(i / trailRef.current.length) * 0.4})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Obstacles
      for (const obs of obstacles.current) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(obs.label, obs.x, obs.y + 3);
      }

      // Draw Robot Chassis at (robotPos.x, robotPos.y, heading)
      // Read latest state for rendering
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currPos = (canvas as any)._lastPos || { x: 180, y: 140, heading: 0 };

      ctx.save();
      ctx.translate(currPos.x, currPos.y);
      ctx.rotate(currPos.heading);

      // Robot Chassis Body (Rounded rectangle)
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-20, -18, 40, 36, 6);
      ctx.fill();
      ctx.stroke();

      // Front Face / OLED Screen Area
      ctx.fillStyle = '#020617';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(8, -12, 10, 24, 2);
      ctx.fill();
      ctx.stroke();

      // Front Eyes glow
      ctx.fillStyle = expression === 'HAPPY' ? '#38bdf8' : expression === 'ANGRY' || expression === 'ERROR' ? '#f87171' : '#bae6fd';
      ctx.fillRect(11, -8, 4, 6);
      ctx.fillRect(11, 2, 4, 6);

      // Continuous Servo Wheels (Left & Right)
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      // Left Wheel (top in local space)
      ctx.fillRect(-12, -24, 24, 6);
      ctx.strokeRect(-12, -24, 24, 6);
      // Right Wheel (bottom in local space)
      ctx.fillRect(-12, 18, 24, 6);
      ctx.strokeRect(-12, 18, 24, 6);

      // Wheel Tread Motion Lines
      if (Math.abs(m.linearSpeed) > 0.2 || Math.abs(m.angularSpeed) > 0.01) {
        ctx.strokeStyle = '#0ea5e9';
        ctx.beginPath();
        const offset = (now * 0.05) % 6;
        ctx.moveTo(-10 + offset, -24);
        ctx.lineTo(-10 + offset, -18);
        ctx.moveTo(-10 + offset, 18);
        ctx.lineTo(-10 + offset, 24);
        ctx.stroke();
      }

      // Traffic Light LED module on back
      let ledFill = '#334155';
      if (ledColor === 'GREEN') ledFill = '#22c55e';
      else if (ledColor === 'YELLOW') ledFill = '#eab308';
      else if (ledColor === 'RED') ledFill = '#ef4444';

      ctx.fillStyle = ledFill;
      ctx.beginPath();
      ctx.arc(-12, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      // Buzzer sound waves indicator
      if (buzzerActive) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-12, 0, 10, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-12, 0, 16, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      }

      // Direction Arrow in center
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(2, -3);
      ctx.moveTo(6, 0);
      ctx.lineTo(2, 3);
      ctx.stroke();

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [expression, ledColor, buzzerActive, onObstacleDetect]);

  // Keep ref synchronized for render loop
  useEffect(() => {
    if (canvasRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (canvasRef.current as any)._lastPos = robotPos;
    }
  }, [robotPos]);

  return (
    <div className="relative rounded-xl border border-sky-900/50 bg-[#060d21] p-2 overflow-hidden">
      <div className="flex items-center justify-between px-2 pb-1.5 border-b border-sky-950">
        <span className="text-[11px] font-bold text-sky-400 font-cyber flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5" /> ARENA 2D DE MOVIMENTO & SERVOS
        </span>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="font-mono bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
            X:{Math.round(robotPos.x)} Y:{Math.round(robotPos.y)} θ:{Math.round((robotPos.heading * 180) / Math.PI)}°
          </span>
          <button
            onClick={handleResetPosition}
            title="Resetar Posição"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={360}
        height={260}
        className="w-full h-[220px] object-contain block rounded"
      />

      <div className="flex items-center justify-between text-[10px] px-2 pt-1.5 text-slate-400 bg-slate-950/60 rounded">
        <span>Servos SG90: GPIO 13 (Esq) & GPIO 12 (Dir)</span>
        <span className="flex items-center gap-1 text-sky-300">
          <Sparkles className="w-3 h-3" /> Comando Ativo: <strong className="font-mono text-cyan-300">{lastCommand || 'STOP'}</strong>
        </span>
      </div>
    </div>
  );
};
