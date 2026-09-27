import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  Key,
  Save,
  Clock,
  Eye,
  CheckCircle,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { ExpressionCode } from '../types';
import { RoboEyesCanvas } from './RoboEyesCanvas';
import { queryCosmosAI } from '../utils/groq';
import { speakText, startSpeechRecognition } from '../utils/speech';
import { playSuccessMelody, playErrorTone, playBeep } from '../utils/audio';

interface AILabTabProps {
  expression: ExpressionCode;
  onSetExpression: (exp: ExpressionCode) => void;
  onSendCommand: (cmd: string) => void;
  isConnected: boolean;
  onAddLog: (type: 'tx' | 'rx' | 'sys' | 'ai' | 'err', text: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'cosmos';
  text: string;
  latencyMs?: number;
  timestamp: string;
  source?: 'groq' | 'local_sim';
}

export const AILabTab: React.FC<AILabTabProps> = ({
  expression,
  onSetExpression,
  onSendCommand,
  isConnected,
  onAddLog,
}) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('cosmos_groq_key') || (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_GROQ_API_KEY || '';
  });
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  const [prompt, setPrompt] = useState('Diga um fato curto e incrível sobre robótica e espaço.');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeSpeechCancel, setActiveSpeechCancel] = useState<(() => void) | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'cosmos',
      text: 'COSMOS: Olá! Estou pronto para processar suas perguntas via Groq Cloud ou simulador inteligente.',
      timestamp: new Date().toLocaleTimeString(),
      source: 'local_sim',
    },
  ]);

  const [lastCosmosAnswer, setLastCosmosAnswer] = useState(
    'COSMOS: Olá! Estou pronto para processar suas perguntas via Groq Cloud ou simulador inteligente.'
  );

  const handleSaveKey = () => {
    localStorage.setItem('cosmos_groq_key', apiKey.trim());
    onAddLog('sys', 'Chave da API da Groq salva no armazenamento local.');
  };

  const handleSendPrompt = async (customText?: string) => {
    const textToSend = customText || prompt;
    if (!textToSend.trim() || isProcessing) return;

    setIsProcessing(true);
    onSetExpression('THINKING');
    onAddLog('tx', `[IA PROMPT] Enviando: "${textToSend}"`);

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };
    setChatHistory((prev) => [...prev, userMsg]);

    try {
      const result = await queryCosmosAI(textToSend, apiKey, selectedModel);
      setIsProcessing(false);

      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'cosmos',
        text: result.text,
        latencyMs: result.latencyMs,
        timestamp: new Date().toLocaleTimeString(),
        source: result.source,
      };
      setChatHistory((prev) => [...prev, botMsg]);
      setLastCosmosAnswer(result.text);

      onAddLog('ai', `[IA RESPOSTA] (${result.latencyMs}ms): ${result.text}`);

      // Robot speaks and animates Talking -> Happy
      onSetExpression('TALKING');
      const speech = speakText(
        result.text,
        () => {
          onSetExpression('TALKING');
        },
        () => {
          onSetExpression('HAPPY');
          playSuccessMelody();
        }
      );
      setActiveSpeechCancel(() => speech.cancel);
    } catch (err) {
      setIsProcessing(false);
      onSetExpression('ANGRY');
      playErrorTone();
      const errMsg = err instanceof Error ? err.message : 'Falha na resposta da IA';
      onAddLog('err', `[ERRO IA] ${errMsg}`);
    }
  };

  const handleSendToESP32 = () => {
    if (!prompt.trim()) return;
    if (isConnected) {
      onSendCommand(`PROMPT:${prompt.trim()}`);
      onAddLog('tx', `[SERIAL ESP32] PROMPT:${prompt.trim()}`);
    } else {
      onAddLog('sys', 'Robô desconectado. Executando chamada diretamente pelo simulador web.');
      handleSendPrompt();
    }
  };

  const handleToggleMic = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    onSetExpression('HAPPY');
    playBeep();
    onAddLog('sys', 'Microfone ativado. Fale sua pergunta para o COSMOS...');

    startSpeechRecognition(
      (transcript) => {
        setIsListening(false);
        setPrompt(transcript);
        onAddLog('rx', `[VOZ DETECTADA] "${transcript}"`);
        handleSendPrompt(transcript);
      },
      (err) => {
        setIsListening(false);
        onAddLog('err', `[MICROFONE] ${err}`);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  const handlePlayTTS = () => {
    if (lastCosmosAnswer) {
      onSetExpression('TALKING');
      speakText(
        lastCosmosAnswer,
        () => onSetExpression('TALKING'),
        () => onSetExpression('HAPPY')
      );
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Config Card */}
      <div className="rounded-2xl border border-sky-900/60 bg-[#131f3d]/70 p-4 md:p-6 backdrop-blur shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-sky-950/80 mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-black font-cyber text-sky-300">
              LABORATÓRIO DE TESTES DE IA (GROQ CLOUD & GEMINI)
            </h2>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-sky-950 text-cyan-300 border border-sky-800">
            LLaMA 3.3 70B & Speech API
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* API Key */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-medium flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-sky-400" /> Chave de API Groq (gsk_...):
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Cole sua chave da Groq Cloud ou use o simulador embutido..."
                className="flex-1 bg-[#0b1329] border border-sky-950 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {showKey ? 'Ocultar' : 'Ver'}
              </button>
              <button
                onClick={handleSaveKey}
                className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1 transition-colors shadow"
              >
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Caso não tenha uma chave da Groq, o assistente responderá automaticamente via simulador cognitivo local.
            </p>
          </div>

          {/* Model Selector */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Modelo de IA:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-[#0b1329] border border-sky-950 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recomendado)</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Super Rápido &lt;100ms)</option>
              <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (MoE)</option>
              <option value="gemma2-9b-it">gemma2-9b-it (Google Gemma)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Chat & Prompt Sender */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-sky-900/60 bg-[#131f3d]/70 p-4 md:p-6 backdrop-blur shadow-xl flex flex-col min-h-[480px]">
            {/* Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
              <span className="text-slate-400 font-medium mr-1">Sugestões:</span>
              {[
                'Diga um fato curto sobre robôs e espaço.',
                'Quem é você e quais são suas habilidades?',
                'Conte uma piada divertida de tecnologia.',
                'Qual é a distância da Terra até a Lua?',
              ].map((sug) => (
                <button
                  key={sug}
                  onClick={() => {
                    setPrompt(sug);
                    handleSendPrompt(sug);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#0b1329] hover:bg-sky-950 text-sky-300 border border-sky-950/80 transition-colors text-[11px]"
                >
                  {sug}
                </button>
              ))}
            </div>

            {/* Chat History Box */}
            <div className="flex-1 bg-[#030712] rounded-xl border border-sky-950 p-3 overflow-y-auto space-y-3 max-h-[340px]">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs md:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-sky-600 text-white rounded-tr-none shadow'
                        : 'bg-[#131f3d] text-cyan-200 border border-sky-900/60 rounded-tl-none'
                    }`}
                  >
                    <p>{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500 font-mono">
                    <span>{msg.timestamp}</span>
                    {msg.latencyMs && (
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {msg.latencyMs}ms
                      </span>
                    )}
                    {msg.source === 'groq' && <span className="text-sky-400 font-semibold">Groq API</span>}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-sky-400 animate-pulse p-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>COSMOS está pensando na resposta...</span>
                </div>
              )}
            </div>

            {/* Prompt Input Form */}
            <div className="mt-4 pt-3 border-t border-sky-950/80 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                  placeholder="Digite sua pergunta ou fale pelo microfone..."
                  className="flex-1 bg-[#0b1329] border border-sky-950 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleToggleMic}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isListening
                      ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title="Falar no microfone"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleSendPrompt()}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow glow-cyan disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Enviar Prompt (IA)
                </button>

                <button
                  onClick={handleSendToESP32}
                  className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <Radio className="w-3.5 h-3.5" /> Enviar p/ ESP32
                </button>

                <button
                  onClick={handlePlayTTS}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700"
                  title="Ouvir resposta sintetizada"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Ouvir Resposta (TTS)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: OLED Face & Live SSD1306 Mirror */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-sky-900/60 bg-[#131f3d]/70 p-4 md:p-6 backdrop-blur shadow-xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-sky-950/80 mb-3">
              <h3 className="text-xs font-bold text-sky-400 font-cyber uppercase flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Display OLED SSD1306 do Robô
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-cyan-300">
                128 x 64 px
              </span>
            </div>

            {/* Canvas Face with Text Overlay on Answer */}
            <div className="w-full aspect-[16/10] bg-[#020817] rounded-xl overflow-hidden border border-sky-950 mb-3">
              <RoboEyesCanvas
                expression={expression}
                showTextOverlay={isProcessing || expression === 'TALKING'}
                overlayText={isProcessing ? 'Consultando IA...' : lastCosmosAnswer}
                autoBlink={true}
                idleGaze={true}
                className="w-full h-full"
              />
            </div>

            <div className="p-3 bg-[#0b1329] rounded-xl border border-sky-950 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 font-medium">
                <span>Estado Cognitivo Atual:</span>
                <span className="font-mono text-cyan-300 font-bold">{expression}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Quando a IA responde, o robô alterna os olhos para <strong className="text-sky-300">TALKING</strong>, ativa a síntese de voz em português e executa a dança de comemoração!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
