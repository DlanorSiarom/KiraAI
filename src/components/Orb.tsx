import React, { useEffect, useRef } from 'react';
import { Mic, Sparkles, Volume2 } from 'lucide-react';
import { OrbState } from '../types';

interface OrbProps {
  state: OrbState;
  audioLevel?: number; // 0 to 1
  onClick?: () => void;
}

export const Orb: React.FC<OrbProps> = ({ state, audioLevel = 0, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    // Ambient floating holographic stardust particles
    const particles = Array.from({ length: 32 }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: 60 + Math.random() * 85,
      radius: Math.random() * 1.6 + 0.4,
      speed: (Math.random() * 0.015 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
      opacity: Math.random() * 0.7 + 0.3,
      color: Math.random() > 0.5 ? '#38bdf8' : Math.random() > 0.5 ? '#c084fc' : '#2dd4bf',
    }));

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // State speed & energy multipliers
      let speedMult = 1;
      let energyScale = 0.05 + audioLevel * 0.45;

      if (state === 'thinking') {
        speedMult = 2.6;
        energyScale = 0.25;
      } else if (state === 'listening') {
        speedMult = 1.4;
        energyScale = 0.15 + audioLevel * 0.65;
      } else if (state === 'speaking') {
        speedMult = 1.7;
        energyScale = 0.2 + audioLevel * 0.4;
      }

      time += 0.02 * speedMult;

      const baseR = 92;

      // 1. Outer Holographic Nebula Aura (Soft atmospheric back-glow)
      const auraGradient = ctx.createRadialGradient(cx, cy, baseR * 0.3, cx, cy, baseR * 2.1);
      if (state === 'listening') {
        auraGradient.addColorStop(0, `rgba(6, 182, 212, ${0.45 + energyScale * 0.3})`);
        auraGradient.addColorStop(0.4, `rgba(14, 116, 144, ${0.25 + energyScale * 0.2})`);
        auraGradient.addColorStop(0.8, 'rgba(2, 132, 199, 0.08)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (state === 'thinking') {
        auraGradient.addColorStop(0, 'rgba(168, 85, 247, 0.5)');
        auraGradient.addColorStop(0.5, 'rgba(126, 34, 206, 0.25)');
        auraGradient.addColorStop(0.8, 'rgba(88, 28, 135, 0.08)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        auraGradient.addColorStop(0, `rgba(59, 130, 246, ${0.35 + energyScale * 0.2})`);
        auraGradient.addColorStop(0.45, `rgba(99, 102, 241, ${0.2 + energyScale * 0.15})`);
        auraGradient.addColorStop(0.8, 'rgba(147, 51, 234, 0.06)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 2.1, 0, Math.PI * 2);
      ctx.fill();

      // 2. Swirling Iridescent Plasma Waves (Multi-harmonic sine turbulence)
      const numWaves = 4;
      for (let w = 0; w < numWaves; w++) {
        const waveAngleOffset = (w * Math.PI) / numWaves + time * (0.8 + w * 0.2);
        const waveScale = 1 - w * 0.08;
        const currentR = baseR * waveScale;

        ctx.save();
        ctx.beginPath();

        const segments = 120;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;

          // Harmonic multi-frequency deformation
          const d1 = Math.sin(theta * 3 + time * 2.2 + waveAngleOffset) * (8 + energyScale * 18);
          const d2 = Math.cos(theta * 5 - time * 1.6 + w) * (5 + energyScale * 12);
          const d3 = Math.sin(theta * 2 + time * 3.1) * (4 + energyScale * 8);

          const r = currentR + d1 + d2 + d3;
          const x = cx + r * Math.cos(theta);
          const y = cy + r * Math.sin(theta);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        // Iridescent chromatic gradient for each wave
        const pGrad = ctx.createRadialGradient(
          cx + Math.cos(time + w) * 20,
          cy + Math.sin(time + w) * 20,
          currentR * 0.1,
          cx,
          cy,
          currentR * 1.15
        );

        if (w === 0) {
          pGrad.addColorStop(0, 'rgba(224, 242, 254, 0.95)'); // Diamond cyan core
          pGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.85)'); // Electric cyan
          pGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.75)'); // Indigo
          pGrad.addColorStop(1, 'rgba(168, 85, 247, 0.4)'); // Violet rim
        } else if (w === 1) {
          pGrad.addColorStop(0, 'rgba(147, 197, 253, 0.8)');
          pGrad.addColorStop(0.4, 'rgba(129, 140, 248, 0.7)');
          pGrad.addColorStop(0.75, 'rgba(192, 132, 252, 0.6)');
          pGrad.addColorStop(1, 'rgba(236, 72, 153, 0.3)'); // Rose magenta rim
        } else if (w === 2) {
          pGrad.addColorStop(0, 'rgba(45, 212, 191, 0.75)'); // Turquoise
          pGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.65)');
          pGrad.addColorStop(1, 'rgba(139, 92, 246, 0.35)');
        } else {
          pGrad.addColorStop(0, 'rgba(244, 114, 182, 0.65)'); // Pastel pink
          pGrad.addColorStop(0.6, 'rgba(96, 165, 250, 0.5)');
          pGrad.addColorStop(1, 'rgba(56, 189, 248, 0.2)');
        }

        ctx.fillStyle = pGrad;
        ctx.shadowColor = w === 0 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(168, 85, 247, 0.5)';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.restore();
      }

      // 3. Central Luminous Core (White-hot energy singularity)
      const coreR = baseR * (0.42 + Math.sin(time * 2.5) * 0.04 + energyScale * 0.15);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      coreGrad.addColorStop(0.4, 'rgba(186, 230, 253, 0.9)');
      coreGrad.addColorStop(0.75, 'rgba(56, 189, 248, 0.6)');
      coreGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // 4. Glass Sphere Outer Shell (Fresnel Refraction & Curved Rim)
      const glassR = baseR + 4;
      const glassGrad = ctx.createRadialGradient(
        cx - glassR * 0.35,
        cy - glassR * 0.35,
        glassR * 0.05,
        cx,
        cy,
        glassR
      );
      glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      glassGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.02)');
      glassGrad.addColorStop(0.92, 'rgba(255, 255, 255, 0.12)');
      glassGrad.addColorStop(0.98, 'rgba(56, 189, 248, 0.4)');
      glassGrad.addColorStop(1, 'rgba(168, 85, 247, 0.2)');

      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glassR, 0, Math.PI * 2);
      ctx.fill();

      // Outer glass edge stroke
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, glassR, 0, Math.PI * 2);
      ctx.stroke();

      // 5. Curved Glass Specular Highlight (The 3D Tactile Bubble Reflection)
      ctx.save();
      ctx.translate(cx - glassR * 0.36, cy - glassR * 0.38);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, glassR * 0.38, glassR * 0.16, 0, 0, Math.PI * 2);
      const specGrad = ctx.createLinearGradient(0, -glassR * 0.16, 0, glassR * 0.16);
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      specGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specGrad;
      ctx.fill();
      ctx.restore();

      // Secondary bottom-rim bounce specular
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + glassR * 0.2, cy + glassR * 0.35, glassR * 0.45, 0.2, Math.PI * 0.8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();

      // 6. Holographic Orbiting Stardust Particles
      particles.forEach((p) => {
        p.angle += p.speed * speedMult;
        const orbitR = p.distance + Math.sin(time + p.angle) * 8;
        const px = cx + orbitR * Math.cos(p.angle);
        const py = cy + (orbitR * 0.65) * Math.sin(p.angle); // elliptical perspective tilt

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity * (0.6 + Math.sin(time * 3 + p.angle) * 0.4);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, p.radius * (1 + energyScale * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, audioLevel]);

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center justify-center cursor-pointer select-none group"
      title="Toque no orbe para falar com a Kira"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Background ambient radial blue/violet backlight */}
      <div
        className={`absolute w-[380px] h-[380px] rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          state === 'listening'
            ? 'bg-cyan-500/35 scale-110 shadow-[0_0_60px_rgba(6,182,212,0.45)]'
            : state === 'speaking'
            ? 'bg-indigo-600/30 shadow-[0_0_50px_rgba(99,102,241,0.35)]'
            : state === 'thinking'
            ? 'bg-purple-600/35 shadow-[0_0_50px_rgba(168,85,247,0.35)]'
            : 'bg-blue-600/20 group-hover:bg-cyan-500/25'
        }`}
      />

      {/* High-DPI Canvas rendering the iridescent glassmorphic plasma orb */}
      <canvas
        ref={canvasRef}
        width={360}
        height={360}
        className={`w-[290px] h-[290px] sm:w-[330px] sm:h-[330px] relative z-10 transition-transform duration-500 hover:scale-105 active:scale-95 ${
          state === 'listening' ? 'drop-shadow-[0_0_30px_rgba(6,182,212,0.55)]' : 'drop-shadow-[0_0_25px_rgba(56,189,248,0.35)]'
        }`}
      />

      {/* Interactive Floating Status Pill */}
      <div className="relative z-10 -mt-2 transition-transform duration-300">
        {state === 'listening' ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/85 border border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] text-xs font-medium text-cyan-200 animate-pulse">
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ouvindo sua voz... toque para enviar</span>
          </div>
        ) : state === 'speaking' ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/85 border border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.3)] text-xs font-medium text-indigo-200">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Kira falando... toque para interromper</span>
          </div>
        ) : state === 'thinking' ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/85 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.3)] text-xs font-medium text-purple-200 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            <span>Processando pensamento...</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 group-hover:bg-cyan-950/70 border border-white/10 group-hover:border-cyan-500/40 text-[11px] font-medium text-white/60 group-hover:text-cyan-200 transition-all shadow-sm">
            <Mic className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Toque no orbe para falar</span>
          </div>
        )}
      </div>
    </div>
  );
};
