import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  Eye,
  Brain,
  Cpu,
  Bot,
} from 'lucide-react';
import {
  RobotState,
  ExpressionCode,
  SemaphoreColor,
  LogEntry,
  RobotTelemetry,
} from './types';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { ControlTab } from './components/ControlTab';
import { RoboEyesGalleryTab } from './components/RoboEyesGalleryTab';
import { AILabTab } from './components/AILabTab';
import { FirmwareTab } from './components/FirmwareTab';
import {
  requestAndConnectSerial,
  disconnectSerial,
  sendSerialCommand,
} from './utils/webserial';
import { playBeep, playBuzzerTone, playSuccessMelody, playErrorTone } from './utils/audio';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'control' | 'gallery' | 'ai' | 'firmware'>('control');
  const [robotState, setRobotState] = useState<RobotState>('IDLE');
  const [expression, setExpression] = useState<ExpressionCode>('DEFAULT');
  const [ledColor, setLedColor] = useState<SemaphoreColor>('GREEN');
  const [buzzerActive, setBuzzerActive] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>(
    'Pronto para conexão USB Serial ou testes locais de IA e Expressões.'
  );

  // Connection State
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [portName, setPortName] = useState<string>('COM3 (ESP32)');

  // Telemetry
  const [telemetry, setTelemetry] = useState<RobotTelemetry>({
    state: 'IDLE',
    eyes: 'DEFAULT',
    wifi: '192.168.0.105',
    ip: '192.168.0.105',
    batteryLevel: 98,
    servoLeftSpeed: 1500,
    servoRightSpeed: 1500,
    ledColor: 'GREEN',
    buzzerActive: false,
    soundTriggered: false,
    buttonPressed: false,
    lastCommand: 'STOP',
    timestamp: Date.now(),
  });

  // Logs List
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'sys',
      text: '⚡ Painel COSMOS inicializado com sucesso. Simulador FluxGarage RoboEyes pronto.',
    },
  ]);

  const addLog = useCallback((type: 'tx' | 'rx' | 'sys' | 'ai' | 'err', text: string) => {
    const newEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      text,
    };
    setLogs((prev) => [...prev.slice(-150), newEntry]);
  }, []);

  // Dispatch Commands to Real ESP32 or Simulation
  const handleSendCommand = useCallback(
    async (cmd: string) => {
      const cleanCmd = cmd.trim();
      if (!cleanCmd) return;

      // Update telemetry last command
      setTelemetry((prev) => ({ ...prev, lastCommand: cleanCmd }));

      if (isConnected) {
        const ok = await sendSerialCommand(cleanCmd);
        if (ok) {
          addLog('tx', `>> Enviado ao ESP32: ${cleanCmd}`);
        } else {
          addLog('err', `Erro ao enviar comando serial: ${cleanCmd}`);
        }
      } else {
        addLog('tx', `[SIMULADOR] Comando: ${cleanCmd}`);
      }

      // Process command locally for the visual simulator
      if (cleanCmd.startsWith('EYES_')) {
        const exp = cleanCmd.replace('EYES_', '') as ExpressionCode;
        setExpression(exp);
      } else if (cleanCmd === 'FORWARD') {
        setStatusText('Robô movendo para FRENTE.');
      } else if (cleanCmd === 'BACK') {
        setStatusText('Robô movendo para TRÁS.');
      } else if (cleanCmd === 'LEFT') {
        setStatusText('Robô girando para ESQUERDA.');
      } else if (cleanCmd === 'RIGHT') {
        setStatusText('Robô girando para DIREITA.');
      } else if (cleanCmd === 'STOP') {
        setStatusText('Motores parados.');
      } else if (cleanCmd === 'DANCE') {
        setStatusText('Executando coreografia de dança do robô COSMOS!');
        setExpression('HAPPY');
      } else if (cleanCmd === 'LED_GREEN') {
        setLedColor('GREEN');
      } else if (cleanCmd === 'LED_YELLOW') {
        setLedColor('YELLOW');
      } else if (cleanCmd === 'LED_RED') {
        setLedColor('RED');
      } else if (cleanCmd === 'LED_OFF') {
        setLedColor('OFF');
      } else if (cleanCmd === 'BUZZER_ON') {
        setBuzzerActive(true);
      } else if (cleanCmd === 'BUZZER_OFF') {
        setBuzzerActive(false);
      } else if (cleanCmd === 'BEEP') {
        playBeep();
      } else if (cleanCmd === 'STATUS') {
        addLog('rx', `STATUS:STATE:${robotState}|EYES:${expression}|WIFI:192.168.0.105`);
      } else if (cleanCmd === 'RESET') {
        setRobotState('IDLE');
        setExpression('DEFAULT');
        setLedColor('GREEN');
        addLog('sys', '[SISTEMA] Reset do robô simulado executado.');
      }
    },
    [isConnected, robotState, expression, addLog]
  );

  // Connect Web Serial
  const handleConnectSerial = async () => {
    addLog('sys', 'Solicitando acesso à porta Serial USB do navegador...');
    const result = await requestAndConnectSerial(
      115200,
      (receivedLine) => {
        addLog('rx', `<< ESP32: ${receivedLine}`);

        if (receivedLine.startsWith('EYES:')) {
          const exp = receivedLine.split(':', 2)[1] as ExpressionCode;
          setExpression(exp);
        } else if (receivedLine.startsWith('STATUS:')) {
          setStatusText(`Telemetria ESP32: ${receivedLine}`);
        } else if (receivedLine.startsWith('AI_RESPONSE:')) {
          setExpression('TALKING');
        }
      },
      () => {
        setIsConnected(false);
        addLog('sys', 'Porta Serial desconectada.');
        setStatusText('Desconectado da porta serial.');
      }
    );

    if (result.success) {
      setIsConnected(true);
      setPortName(result.portName);
      addLog('sys', `Conectado com sucesso ao robô ESP32 via ${result.portName}.`);
      setStatusText(`Conectado ao robô na porta ${result.portName}.`);
      handleSendCommand('STATUS');
    } else {
      addLog('err', `Falha na conexão: ${result.error || 'Cancelado pelo usuário'}`);
    }
  };

  const handleDisconnectSerial = async () => {
    await disconnectSerial();
    setIsConnected(false);
    addLog('sys', 'Porta serial fechada pelo usuário.');
    setStatusText('Desconectado. Operando em Modo Simulação.');
  };

  // Hardware triggers
  const handleTriggerButton = () => {
    addLog('rx', '<< GATILHO: Botão físico pressionado (GPIO 4)');
    setRobotState('LISTENING');
    setExpression('HAPPY');
    setLedColor('YELLOW');
    playBeep();
    setStatusText('Robô acordou pelo botão de trigger! Aguardando comando.');

    setTimeout(() => {
      setRobotState('IDLE');
      setLedColor('GREEN');
    }, 3000);
  };

  const handleTriggerSound = () => {
    addLog('rx', '<< GATILHO: Som detectado pelo sensor KY-037 (GPIO 34)');
    setRobotState('LISTENING');
    setExpression('CONFUSED');
    setLedColor('YELLOW');
    playBeep();
    setStatusText('Som detectado! COSMOS atento ao ambiente.');

    setTimeout(() => {
      setRobotState('IDLE');
      setLedColor('GREEN');
      setExpression('DEFAULT');
    }, 2500);
  };

  // Simulated Telemetry Ping Loop (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        state: robotState,
        eyes: expression,
        ledColor,
        buzzerActive,
        timestamp: Date.now(),
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [robotState, expression, ledColor, buzzerActive]);

  return (
    <div className="min-h-screen flex flex-col bg-[#070d1f] text-slate-100 selection:bg-sky-500 selection:text-black">
      {/* Top Header */}
      <Header
        isConnected={isConnected}
        portName={portName}
        robotState={robotState}
        wifiStatus={telemetry.wifi}
        batteryLevel={telemetry.batteryLevel}
        onConnectSerial={handleConnectSerial}
        onDisconnectSerial={handleDisconnectSerial}
      />

      {/* Navigation Tabs */}
      <div className="bg-[#0b1329] border-b border-sky-950 px-4 pt-2">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto max-w-7xl mx-auto">
          <button
            onClick={() => setActiveTab('control')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 ${
              activeTab === 'control'
                ? 'bg-[#131f3d] text-white border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/60'
            }`}
          >
            <Gamepad2 className="w-4 h-4 text-sky-400" />
            <span>🎮 Painel de Controle</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 ${
              activeTab === 'gallery'
                ? 'bg-[#131f3d] text-white border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/60'
            }`}
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>👀 Galeria RoboEyes</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 ${
              activeTab === 'ai'
                ? 'bg-[#131f3d] text-white border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/60'
            }`}
          >
            <Brain className="w-4 h-4 text-purple-400" />
            <span>🧠 Testes de IA (Groq Cloud)</span>
          </button>

          <button
            onClick={() => setActiveTab('firmware')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 ${
              activeTab === 'firmware'
                ? 'bg-[#131f3d] text-white border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>⚡ Firmware & Pinagem ESP32</span>
          </button>
        </div>
      </div>

      {/* Tab Content View */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'control' && (
          <ControlTab
            expression={expression}
            onSetExpression={setExpression}
            onSendCommand={handleSendCommand}
            ledColor={ledColor}
            onSetLed={(c) => {
              setLedColor(c);
              handleSendCommand(`LED_${c}`);
            }}
            buzzerActive={buzzerActive}
            onToggleBuzzer={(active) => {
              setBuzzerActive(active);
              handleSendCommand(active ? 'BUZZER_ON' : 'BUZZER_OFF');
            }}
            logs={logs}
            onClearLogs={() => setLogs([])}
            telemetry={telemetry}
            isConnected={isConnected}
            onConnectSerial={handleConnectSerial}
            onDisconnectSerial={handleDisconnectSerial}
            onTriggerPhysicalButton={handleTriggerButton}
            onTriggerSoundSensor={handleTriggerSound}
          />
        )}

        {activeTab === 'gallery' && (
          <RoboEyesGalleryTab
            currentExpression={expression}
            onSetExpression={setExpression}
            onSendCommand={handleSendCommand}
          />
        )}

        {activeTab === 'ai' && (
          <AILabTab
            expression={expression}
            onSetExpression={setExpression}
            onSendCommand={handleSendCommand}
            isConnected={isConnected}
            onAddLog={addLog}
          />
        )}

        {activeTab === 'firmware' && <FirmwareTab />}
      </main>

      {/* Footer Status Bar */}
      <StatusBar statusText={statusText} telemetry={telemetry} totalLogs={logs.length} />
    </div>
  );
};
