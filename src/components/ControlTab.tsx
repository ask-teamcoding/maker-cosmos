import React, { useState, useEffect } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  Bell,
  RefreshCw,
  Usb,
  Flame,
  Radio,
  Trash2,
  Mic,
  Maximize2,
  Sliders,
  Send,
} from 'lucide-react';
import { ExpressionCode, SemaphoreColor, LogEntry, RobotTelemetry } from '../types';
import { RoboEyesCanvas } from './RoboEyesCanvas';
import { ArenaSimulator } from './ArenaSimulator';
import { playBeep, playBuzzerTone, playSuccessMelody, playErrorTone } from '../utils/audio';

interface ControlTabProps {
  expression: ExpressionCode;
  onSetExpression: (exp: ExpressionCode) => void;
  onSendCommand: (cmd: string) => void;
  ledColor: SemaphoreColor;
  onSetLed: (color: SemaphoreColor) => void;
  buzzerActive: boolean;
  onToggleBuzzer: (active: boolean) => void;
  logs: LogEntry[];
  onClearLogs: () => void;
  telemetry: RobotTelemetry;
  isConnected: boolean;
  onConnectSerial: () => void;
  onDisconnectSerial: () => void;
  onTriggerSoundSensor: () => void;
  onTriggerPhysicalButton: () => void;
}

export const ControlTab: React.FC<ControlTabProps> = ({
  expression,
  onSetExpression,
  onSendCommand,
  ledColor,
  onSetLed,
  buzzerActive,
  onToggleBuzzer,
  logs,
  onClearLogs,
  telemetry,
  isConnected,
  onConnectSerial,
  onDisconnectSerial,
  onTriggerSoundSensor,
  onTriggerPhysicalButton,
}) => {
  const [selectedBaud, setSelectedBaud] = useState('115200');
  const [selectedPort, setSelectedPort] = useState('COM3 (ESP32)');
  const [activeTabSubView, setActiveTabSubView] = useState<'both' | 'eyes' | 'arena'>('both');
  const [customCmdInput, setCustomCmdInput] = useState('');

  // Keyboard controls for robot driving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        onSendCommand('FORWARD');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onSendCommand('BACK');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        onSendCommand('LEFT');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onSendCommand('RIGHT');
      } else if (e.key === ' ' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        onSendCommand('STOP');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSendCommand]);

  const handleCustomCmdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customCmdInput.trim()) {
      onSendCommand(customCmdInput.trim());
      setCustomCmdInput('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-2 md:p-4">
      {/* ========================================================================= */}
      {/* COLUNA ESQUERDA: Conexão Serial, Motores, Semáforo, Buzzer e Sensores */}
      {/* ========================================================================= */}
      <div className="lg:col-span-4 space-y-4">
        {/* Bloco 1: Conexão Serial */}
        <div className="rounded-xl border border-sky-900/60 bg-[#131f3d]/80 p-3.5 backdrop-blur shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-sky-950/80 mb-3">
            <h3 className="text-xs font-bold text-sky-400 font-cyber flex items-center gap-1.5 uppercase">
              <Usb className="w-3.5 h-3.5" /> Conexão Serial ESP32
            </h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isConnected ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-400'}`}>
              {isConnected ? 'USB Ativo' : 'Simulador'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Porta Serial (COM / USB):</label>
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                className="w-full bg-[#0b1329] border border-sky-950 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
              >
                <option value="COM3 (ESP32)">COM3 (Silicon Labs CP210x / ESP32)</option>
                <option value="COM4 (USB Serial)">COM4 (CH340 USB Serial)</option>
                <option value="COM1">COM1 (Standard Serial)</option>
                <option value="/dev/ttyUSB0">/dev/ttyUSB0 (Linux/Mac)</option>
                <option value="/dev/ttyACM0">/dev/ttyACM0 (ESP32 Direct)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Baudrate (bps):</label>
              <select
                value={selectedBaud}
                onChange={(e) => setSelectedBaud(e.target.value)}
                className="w-full bg-[#0b1329] border border-sky-950 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
              >
                <option value="115200">115200 bps (Padrão Firmware COSMOS)</option>
                <option value="9600">9600 bps</option>
                <option value="57600">57600 bps</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {isConnected ? (
                <button
                  onClick={onDisconnectSerial}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Usb className="w-3.5 h-3.5" /> Desconectar
                </button>
              ) : (
                <button
                  onClick={onConnectSerial}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow glow-cyan"
                >
                  <Usb className="w-3.5 h-3.5" /> 🔌 Conectar
                </button>
              )}
              <button
                onClick={() => onSendCommand('STATUS')}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                title="Requisitar telemetria STATUS do ESP32"
              >
                <RefreshCw className="w-3 h-3" /> Status
              </button>
            </div>
          </div>
        </div>

        {/* Bloco 2: Controle de Motores (Servos SG90) */}
        <div className="rounded-xl border border-sky-900/60 bg-[#131f3d]/80 p-3.5 backdrop-blur shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-sky-950/80 mb-3">
            <h3 className="text-xs font-bold text-sky-400 font-cyber flex items-center gap-1.5 uppercase">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Controle de Servos (Rodas)
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Teclado: W, A, S, D, Espaço</span>
          </div>

          <div className="flex flex-col items-center justify-center py-1">
            {/* Forward */}
            <button
              onClick={() => onSendCommand('FORWARD')}
              className={`w-28 py-2 mb-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${
                telemetry.lastCommand === 'FORWARD'
                  ? 'bg-sky-500 text-white border-sky-300 shadow glow-cyan'
                  : 'bg-slate-800/90 text-sky-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <ArrowUp className="w-4 h-4" /> Frente (W)
            </button>

            {/* Left, Stop, Right */}
            <div className="flex items-center gap-1.5 w-full justify-center">
              <button
                onClick={() => onSendCommand('LEFT')}
                className={`w-24 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border transition-all active:scale-95 ${
                  telemetry.lastCommand === 'LEFT'
                    ? 'bg-sky-500 text-white border-sky-300 shadow glow-cyan'
                    : 'bg-slate-800/90 text-sky-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <ArrowLeft className="w-4 h-4" /> Esq (A)
              </button>

              <button
                onClick={() => onSendCommand('STOP')}
                className="w-24 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow transition-all active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Parar (X)
              </button>

              <button
                onClick={() => onSendCommand('RIGHT')}
                className={`w-24 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border transition-all active:scale-95 ${
                  telemetry.lastCommand === 'RIGHT'
                    ? 'bg-sky-500 text-white border-sky-300 shadow glow-cyan'
                    : 'bg-slate-800/90 text-sky-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Dir (D) <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Backward */}
            <button
              onClick={() => onSendCommand('BACK')}
              className={`w-28 py-2 mt-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${
                telemetry.lastCommand === 'BACK'
                  ? 'bg-sky-500 text-white border-sky-300 shadow glow-cyan'
                  : 'bg-slate-800/90 text-sky-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <ArrowDown className="w-4 h-4" /> Trás (S)
            </button>
          </div>

          <div className="mt-3 pt-2 border-t border-sky-950/80 flex items-center justify-between">
            <button
              onClick={() => {
                onSendCommand('DANCE');
                playSuccessMelody();
              }}
              className="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow"
            >
              <Sparkles className="w-3.5 h-3.5" /> Coreografia & Dança COSMOS
            </button>
          </div>
        </div>

        {/* Bloco 3: Semáforo LED, Buzzer 5V & Sensores Físicos */}
        <div className="rounded-xl border border-sky-900/60 bg-[#131f3d]/80 p-3.5 backdrop-blur shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-sky-950/80 mb-3">
            <h3 className="text-xs font-bold text-sky-400 font-cyber flex items-center gap-1.5 uppercase">
              <Radio className="w-3.5 h-3.5 text-emerald-400" /> Semáforo LED & Buzzer 5V
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">GPIO 25, 33, 32, 27</span>
          </div>

          {/* Semáforo */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium">Módulo Semáforo:</span>
              <span className="font-mono text-[11px] text-slate-400">
                Ativo: <strong className="text-sky-300">{ledColor}</strong>
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => onSetLed('GREEN')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                  ledColor === 'GREEN'
                    ? 'bg-emerald-600 text-white border-emerald-400 glow-green'
                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60 hover:bg-emerald-900/60'
                }`}
              >
                🟢 Verde
              </button>
              <button
                onClick={() => onSetLed('YELLOW')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                  ledColor === 'YELLOW'
                    ? 'bg-amber-600 text-white border-amber-400 glow-yellow'
                    : 'bg-amber-950/60 text-amber-300 border-amber-900/60 hover:bg-amber-900/60'
                }`}
              >
                🟡 Amarelo
              </button>
              <button
                onClick={() => onSetLed('RED')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                  ledColor === 'RED'
                    ? 'bg-rose-600 text-white border-rose-400 glow-red'
                    : 'bg-rose-950/60 text-rose-300 border-rose-900/60 hover:bg-rose-900/60'
                }`}
              >
                🔴 Vermelho
              </button>
              <button
                onClick={() => onSetLed('OFF')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-all ${
                  ledColor === 'OFF'
                    ? 'bg-slate-700 text-white border-slate-500'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                ✕ Off
              </button>
            </div>
          </div>

          {/* Buzzer */}
          <div className="space-y-2 pt-2 border-t border-sky-950/80">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium">Buzzer Ativo / Tom:</span>
              <span className="font-mono text-[11px] text-slate-400">GPIO 27</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  onSendCommand('BEEP');
                  playBeep();
                }}
                className="py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1 shadow transition-colors"
              >
                <Bell className="w-3.5 h-3.5" /> Beep Curto
              </button>
              <button
                onClick={() => {
                  onToggleBuzzer(!buzzerActive);
                  if (!buzzerActive) playBuzzerTone(2000, 300);
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-colors ${
                  buzzerActive
                    ? 'bg-amber-600 text-white border-amber-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {buzzerActive ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {buzzerActive ? 'Desligar' : 'Ligar Contínuo'}
              </button>
              <button
                onClick={() => {
                  onSendCommand('EYES_ERROR');
                  playErrorTone();
                }}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700 transition-colors"
              >
                Alerta Erro
              </button>
            </div>
          </div>

          {/* Gatilhos Físicos (Botão e Som) */}
          <div className="mt-3 pt-2 border-t border-sky-950/80 space-y-1.5">
            <span className="block text-[11px] text-slate-400 font-medium">Sensores de Entrada do Robô:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onTriggerPhysicalButton}
                className="py-1.5 px-2 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                🔘 Pressionar Botão (GPIO 4)
              </button>
              <button
                onClick={onTriggerSoundSensor}
                className="py-1.5 px-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Mic className="w-3.5 h-3.5" /> Som KY-037 (GPIO 34)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLUNA CENTRO: Preview OLED RoboEyes & Arena 2D de Movimento */}
      {/* ========================================================================= */}
      <div className="lg:col-span-5 space-y-4">
        {/* Bloco Display Facial OLED */}
        <div className="rounded-xl border border-sky-900/60 bg-[#131f3d]/80 p-3.5 backdrop-blur shadow-md flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-sky-950/80 mb-3">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-sky-400 font-cyber uppercase">
                Display OLED Facial (SSD1306 128x64)
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                I2C SDA:21 SCL:22
              </span>
            </div>
          </div>

          {/* Canvas dos Olhos */}
          <div className="w-full aspect-[16/10] max-h-[250px] mb-3">
            <RoboEyesCanvas
              expression={expression}
              autoBlink={true}
              idleGaze={true}
              curiosity={true}
              className="w-full h-full"
            />
          </div>

          {/* Botões Rápidos de Expressão */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
              <span>Expressões Rápidas:</span>
              <span className="font-mono text-cyan-300 font-bold">{expression}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {(['DEFAULT', 'HAPPY', 'CONFUSED', 'LAUGH', 'TIRED', 'ANGRY'] as ExpressionCode[]).map((exp) => (
                <button
                  key={exp}
                  onClick={() => onSetExpression(exp)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all border ${
                    expression === exp
                      ? 'bg-sky-600 text-white border-sky-400 shadow glow-cyan'
                      : 'bg-[#0b1329] text-sky-300 border-sky-950 hover:bg-slate-800'
                  }`}
                >
                  {exp === 'DEFAULT' ? 'Neutro' : exp === 'HAPPY' ? 'Feliz' : exp === 'CONFUSED' ? 'Confuso' : exp === 'LAUGH' ? 'Rindo' : exp === 'TIRED' ? 'Cansado' : 'Bravo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bloco Arena 2D de Movimento */}
        <ArenaSimulator
          lastCommand={telemetry.lastCommand}
          expression={expression}
          ledColor={ledColor}
          buzzerActive={buzzerActive}
        />
      </div>

      {/* ========================================================================= */}
      {/* COLUNA DIREITA: Telemetria & Console de Logs em Tempo Real */}
      {/* ========================================================================= */}
      <div className="lg:col-span-3 flex flex-col space-y-4">
        <div className="rounded-xl border border-sky-900/60 bg-[#131f3d]/80 p-3.5 backdrop-blur shadow-md flex-1 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2 border-b border-sky-950/80 mb-2">
            <h3 className="text-xs font-bold text-sky-400 font-cyber flex items-center gap-1.5 uppercase">
              Telemetria & Logs em Tempo Real
            </h3>
            <button
              onClick={onClearLogs}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Limpar
            </button>
          </div>

          {/* Terminal Box */}
          <div className="flex-1 bg-[#030712] rounded-lg border border-sky-950/80 p-2.5 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1.5 max-h-[460px]">
            {logs.map((log) => (
              <div key={log.id} className="break-words">
                <span className="text-slate-600 mr-1.5">[{log.timestamp}]</span>
                <span
                  className={
                    log.type === 'tx'
                      ? 'text-amber-400 font-semibold'
                      : log.type === 'rx'
                      ? 'text-cyan-300 font-semibold'
                      : log.type === 'ai'
                      ? 'text-emerald-400'
                      : log.type === 'err'
                      ? 'text-rose-400 font-bold'
                      : 'text-slate-400'
                  }
                >
                  {log.text}
                </span>
              </div>
            ))}
          </div>

          {/* Command Prompt Sender */}
          <form onSubmit={handleCustomCmdSubmit} className="mt-3 flex items-center gap-1.5">
            <input
              type="text"
              value={customCmdInput}
              onChange={(e) => setCustomCmdInput(e.target.value)}
              placeholder="Comando manual (ex: EYES_HAPPY)..."
              className="flex-1 bg-[#0b1329] border border-sky-950 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
