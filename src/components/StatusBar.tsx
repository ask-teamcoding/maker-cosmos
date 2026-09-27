import React from 'react';
import { Activity, Terminal, ShieldCheck } from 'lucide-react';
import { RobotTelemetry } from '../types';

interface StatusBarProps {
  statusText: string;
  telemetry: RobotTelemetry;
  totalLogs: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  statusText,
  telemetry,
  totalLogs,
}) => {
  return (
    <footer className="bg-[#070d1f] border-t border-sky-950 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
      <div className="flex items-center gap-2 truncate max-w-xl">
        <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
        <span className="text-slate-300 font-mono truncate">{statusText}</span>
      </div>

      <div className="flex items-center gap-4 text-[11px] font-mono">
        <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
          <Terminal className="w-3 h-3 text-sky-400" /> Logs: <strong className="text-slate-200">{totalLogs}</strong>
        </span>
        <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
          Telemetria: <strong className="text-sky-300">OK (115200 bps)</strong>
        </span>
        <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60">
          <ShieldCheck className="w-3 h-3" /> WDT Seguranca Ativa (25s)
        </span>
      </div>
    </footer>
  );
};
