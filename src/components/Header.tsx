import React from 'react';
import { Bot, Wifi, Zap, Usb, AlertTriangle } from 'lucide-react';
import { RobotState } from '../types';

interface HeaderProps {
  isConnected: boolean;
  portName: string;
  robotState: RobotState;
  wifiStatus: string;
  batteryLevel: number;
  onConnectSerial: () => void;
  onDisconnectSerial: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  portName,
  robotState,
  wifiStatus,
  batteryLevel,
  onConnectSerial,
  onDisconnectSerial,
}) => {
  return (
    <header className="bg-[#070d1f] border-b border-sky-950/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="relative p-2 rounded-xl bg-gradient-to-br from-sky-900/60 to-cyan-950/80 border border-sky-500/40 glow-cyan">
          <Bot className="w-6 h-6 text-sky-400 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-black tracking-wide font-cyber text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-200">
              ⚡ ROBÔ COSMOS
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-950/90 text-sky-300 border border-sky-800">
              ESP32 DevKit 30P
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Central de Controle, Expressões Faciais RoboEyes & Inteligência Artificial
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        {/* State Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800">
          <span className="text-slate-400 font-medium">Estado:</span>
          <span
            className={`font-mono font-bold px-1.5 py-0.2 rounded ${
              robotState === 'IDLE'
                ? 'text-cyan-400 bg-cyan-950/60'
                : robotState === 'PROCESSING' || robotState === 'LISTENING'
                ? 'text-amber-400 bg-amber-950/60 animate-pulse'
                : robotState === 'RESPONDING'
                ? 'text-emerald-400 bg-emerald-950/60'
                : 'text-rose-400 bg-rose-950/60'
            }`}
          >
            {robotState}
          </span>
        </div>

        {/* Wi-Fi Telemetry */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono text-[11px]">{wifiStatus || '192.168.0.105 (Online)'}</span>
        </div>

        {/* Battery */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="font-mono text-[11px]">{batteryLevel}% (LiPo 7.4V)</span>
        </div>

        {/* Connection Mode & Action */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              onClick={onDisconnectSerial}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-md active:scale-95"
            >
              <Usb className="w-3.5 h-3.5" />
              <span>Desconectar ({portName})</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline-block text-[11px] text-amber-400/90 font-medium px-2 py-1 rounded bg-amber-950/40 border border-amber-800/60">
                ● Modo Simulação Ativo
              </span>
              <button
                onClick={onConnectSerial}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow-md active:scale-95 glow-cyan"
                title="Conectar robô real via porta Serial USB do navegador"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>🔌 Conectar USB</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
