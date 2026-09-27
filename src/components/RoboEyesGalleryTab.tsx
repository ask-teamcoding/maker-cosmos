import React, { useState } from 'react';
import { ExpressionCode, CardinalPosition } from '../types';
import { RoboEyesCanvas } from './RoboEyesCanvas';
import { Eye, Sparkles, Send, Play, Sliders, CheckCircle2 } from 'lucide-react';

interface RoboEyesGalleryTabProps {
  currentExpression: ExpressionCode;
  onSetExpression: (exp: ExpressionCode) => void;
  onSendCommand: (cmd: string) => void;
}

interface ExpressionCardData {
  code: ExpressionCode;
  title: string;
  desc: string;
  color: string;
  badge: string;
  position?: CardinalPosition;
}

export const RoboEyesGalleryTab: React.FC<RoboEyesGalleryTabProps> = ({
  currentExpression,
  onSetExpression,
  onSendCommand,
}) => {
  const [selectedPreview, setSelectedPreview] = useState<ExpressionCode>(currentExpression);
  const [curiosityEnabled, setCuriosityEnabled] = useState(true);
  const [autoBlinkEnabled, setAutoBlinkEnabled] = useState(true);
  const [cardinalGaze, setCardinalGaze] = useState<CardinalPosition>('DEFAULT');

  const expressions: ExpressionCardData[] = [
    {
      code: 'DEFAULT',
      title: 'Default (Repouso / Neutro)',
      desc: 'Olhos abertos retangulares arredondados clássicos do FluxGarage RoboEyes (36x36, raio 8, espaço 10).',
      color: 'border-sky-500/60 text-sky-400',
      badge: 'Básico',
      position: 'DEFAULT',
    },
    {
      code: 'HAPPY',
      title: 'Happy (Feliz / Empolgado)',
      desc: 'Pálpebras inferiores subindo em arco suave (estilo anime) com brilho azul nas bochechas.',
      color: 'border-emerald-500/60 text-emerald-400',
      badge: 'Humor',
      position: 'DEFAULT',
    },
    {
      code: 'CONFUSED',
      title: 'Confused (Pensando / Busca)',
      desc: 'Animação oficial anim_confused() com balanço horizontal sincronizado em onda senoidal.',
      color: 'border-amber-500/60 text-amber-400',
      badge: 'Dinâmico',
      position: 'DEFAULT',
    },
    {
      code: 'LAUGH',
      title: 'Laugh (Rindo / Alegria)',
      desc: 'Animação oficial anim_laugh() com pulos verticais animados e expressão sorridente.',
      color: 'border-cyan-500/60 text-cyan-400',
      badge: 'Dinâmico',
      position: 'DEFAULT',
    },
    {
      code: 'TIRED',
      title: 'Tired (Cansado / Triste)',
      desc: 'Pálpebras superiores inclinadas para baixo em corte melancólico e olhar para o Sul.',
      color: 'border-slate-500/60 text-slate-300',
      badge: 'Humor',
      position: 'S',
    },
    {
      code: 'ANGRY',
      title: 'Angry (Alerta / Bravo)',
      desc: 'Pálpebras superiores anguladas em expressão determinada com linha de sobrancelha.',
      color: 'border-rose-500/60 text-rose-400',
      badge: 'Alerta',
      position: 'DEFAULT',
    },
    {
      code: 'BLINK',
      title: 'Blink (Piscar de Olhos)',
      desc: 'Fechamento e reabertura suave dos olhos em fenda brilhante. Ocorre a cada 4.2s.',
      color: 'border-sky-400/60 text-sky-300',
      badge: 'Auto',
      position: 'DEFAULT',
    },
    {
      code: 'THINKING',
      title: 'Norte (Olhar p/ Cima)',
      desc: 'Posição cardinal N olhando para cima com busca horizontal enquanto o robô consulta a IA.',
      color: 'border-purple-500/60 text-purple-400',
      badge: 'Posição',
      position: 'N',
    },
    {
      code: 'TALKING',
      title: 'Talking (Falando / Áudio)',
      desc: 'Feliz + equalizador gráfico de áudio animado na parte inferior enquanto a voz sintetizada fala.',
      color: 'border-teal-500/60 text-teal-300',
      badge: 'Voz / IA',
      position: 'DEFAULT',
    },
  ];

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Control Settings */}
      <div className="rounded-2xl border border-sky-900/60 bg-[#131f3d]/70 p-4 md:p-6 backdrop-blur shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-black font-cyber text-sky-300">
              GALERIA DE EXPRESSÕES FLUXGARAGE ROBOEYES
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
            Simulador visual 100% fiel à biblioteca C++ do Dennis Hoelscher para display OLED SSD1306 128x64.
            Escolha uma expressão abaixo para testar instantaneamente.
          </p>
        </div>

        {/* Global Eyes Modifiers */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0b1329] p-2 rounded-xl border border-sky-950 text-xs">
          <button
            onClick={() => setCuriosityEnabled(!curiosityEnabled)}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
              curiosityEnabled ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Curiosity: {curiosityEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setAutoBlinkEnabled(!autoBlinkEnabled)}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
              autoBlinkEnabled ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Auto-Blink: {autoBlinkEnabled ? 'ON' : 'OFF'}
          </button>
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <span className="text-slate-400">Direção:</span>
            {(['DEFAULT', 'N', 'S', 'E', 'W'] as CardinalPosition[]).map((pos) => (
              <button
                key={pos}
                onClick={() => setCardinalGaze(pos)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-bold ${
                  cardinalGaze === pos ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of 9 Expression Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {expressions.map((item) => {
          const isSelected = currentExpression === item.code;

          return (
            <div
              key={item.code}
              className={`rounded-2xl border bg-[#131f3d]/80 p-4 backdrop-blur shadow-lg transition-all hover:scale-[1.01] flex flex-col justify-between ${
                isSelected ? 'border-sky-400 ring-2 ring-sky-500/40 glow-cyan' : 'border-sky-950 hover:border-sky-800'
              }`}
            >
              <div>
                {/* Header card */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-100 font-cyber">{item.title}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-sky-300">
                    {item.badge}
                  </span>
                </div>

                {/* Canvas Render */}
                <div className="w-full aspect-[16/10] my-2 bg-[#020817] rounded-xl overflow-hidden border border-sky-950">
                  <RoboEyesCanvas
                    expression={item.code}
                    position={cardinalGaze !== 'DEFAULT' ? cardinalGaze : item.position || 'DEFAULT'}
                    curiosity={curiosityEnabled}
                    autoBlink={autoBlinkEnabled}
                    className="w-full h-full"
                  />
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 leading-relaxed min-h-[38px] mt-2 mb-3">
                  {item.desc}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-sky-950/80">
                <button
                  onClick={() => {
                    onSetExpression(item.code);
                    setSelectedPreview(item.code);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow glow-cyan'
                      : 'bg-slate-800 hover:bg-slate-700 text-sky-300'
                  }`}
                >
                  {isSelected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isSelected ? 'Ativo Agora' : 'Visualizar'}
                </button>

                <button
                  onClick={() => {
                    onSendCommand(`EYES_${item.code}`);
                    onSetExpression(item.code);
                  }}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white text-xs font-bold transition-all shadow flex items-center justify-center gap-1"
                  title="Enviar comando serial para ESP32"
                >
                  <Send className="w-3.5 h-3.5" /> Enviar Robô
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
