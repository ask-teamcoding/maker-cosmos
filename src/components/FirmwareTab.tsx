import React, { useState } from 'react';
import {
  Cpu,
  FileCode,
  Download,
  Copy,
  Check,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';

export const FirmwareTab: React.FC = () => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeCodeFile, setActiveCodeFile] = useState<'ino' | 'secrets' | 'roboeyes'>('ino');
  const [wifiSsid, setWifiSsid] = useState('Minha_Rede_WiFi');
  const [wifiPass, setWifiPass] = useState('minhasenha123');
  const [groqKey, setGroqKey] = useState('gsk_minha_chave_groq');
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);

  const pinDetails: Record<number, { name: string; component: string; desc: string; color: string }> = {
    21: { name: 'GPIO 21', component: 'OLED SSD1306 (SDA)', desc: 'Linha de dados I2C para o display facial dos olhos', color: 'text-sky-400' },
    22: { name: 'GPIO 22', component: 'OLED SSD1306 (SCL)', desc: 'Linha de clock I2C para o display facial dos olhos', color: 'text-sky-400' },
    13: { name: 'GPIO 13', component: 'Servo Esquerdo (Roda)', desc: 'Sinal PWM 50Hz para o servo contínuo SG90 esquerdo', color: 'text-amber-400' },
    12: { name: 'GPIO 12', component: 'Servo Direito (Roda)', desc: 'Sinal PWM 50Hz para o servo contínuo SG90 direito', color: 'text-amber-400' },
    27: { name: 'GPIO 27', component: 'Buzzer Ativo 5V', desc: 'Saída digital para bipes, tons musicais e alertas', color: 'text-cyan-300' },
    25: { name: 'GPIO 25', component: 'LED Vermelho (Semáforo)', desc: 'Sinalizador de erro, Wi-Fi offline e alerta', color: 'text-rose-400' },
    33: { name: 'GPIO 33', component: 'LED Amarelo (Semáforo)', desc: 'Sinalizador de boot, escuta e processamento IA', color: 'text-yellow-400' },
    32: { name: 'GPIO 32', component: 'LED Verde (Semáforo)', desc: 'Sinalizador de repouso, Wi-Fi conectado e sucesso', color: 'text-emerald-400' },
    4:  { name: 'GPIO 4',  component: 'Botão de Trigger (Tactil)', desc: 'Entrada INPUT_PULLUP para despertar o robô', color: 'text-purple-400' },
    34: { name: 'GPIO 34', component: 'Sensor de Som KY-037', desc: 'Entrada digital de detecção de palmas e voz', color: 'text-blue-300' },
  };

  const secretsTemplate = `// ============================================================================
// COSMOS ROBOT - ARQUIVO DE SEGURANCA "secrets.h"
// Preencha com as suas credenciais e NUNCA compartilhe publicamente!
// ============================================================================

#ifndef COSMOS_SECRETS_H
#define COSMOS_SECRETS_H

#define WIFI_SSID_SECRET      "${wifiSsid}"
#define WIFI_PASSWORD_SECRET  "${wifiPass}"
#define GROQ_API_KEY_SECRET   "${groqKey}"

#endif // COSMOS_SECRETS_H
`;

  const inoSnippet = `/*
  PROJETO: ROBO ASSISTENTE DE IA "COSMOS" - VERSAO UNIFICADA (ESP32 DevKit 30P)
  Biblioteca dos Olhos: FluxGarage RoboEyes (https://github.com/FluxGarage/RoboEyes)
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include "FluxGarage_RoboEyes.h"
#include "secrets.h"

// Pinagem Oficial
#define PIN_OLED_SDA        21
#define PIN_OLED_SCL        22
#define PIN_SERVO_LEFT      13
#define PIN_SERVO_RIGHT     12
#define PIN_BUZZER          27
#define PIN_LED_RED         25
#define PIN_LED_YELLOW      33
#define PIN_LED_GREEN       32
#define PIN_BUTTON           4
#define PIN_SOUND_DIGITAL   34

Adafruit_SSD1306 display(128, 64, &Wire, -1);
RoboEyes<Adafruit_SSD1306> roboEyes(display);
Servo servoLeft;
Servo servoRight;

void setup() {
  Serial.begin(115200);
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  
  // Inicializacao dos olhos FluxGarage RoboEyes
  roboEyes.begin(128, 64, 80);
  roboEyes.setWidth(36, 36);
  roboEyes.setHeight(36, 36);
  roboEyes.setBorderradius(8, 8);
  roboEyes.setSpacebetween(10);
  roboEyes.setAutoblinker(ON, 3, 2);
  roboEyes.setIdleMode(ON, 2, 2);
  
  servoLeft.attach(PIN_SERVO_LEFT, 500, 2500);
  servoRight.attach(PIN_SERVO_RIGHT, 500, 2500);
  
  setupWiFi();
}

void loop() {
  roboEyes.update();
  processSerialCommands();
}`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadSecrets = () => {
    const element = document.createElement('a');
    const file = new Blob([secretsTemplate], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'secrets.h';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="rounded-2xl border border-sky-900/60 bg-[#131f3d]/70 p-4 md:p-6 backdrop-blur shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-black font-cyber text-sky-300">
              FIRMWARE & PINAGEM DO ESP32 WROOM (30 PINOS)
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-300 max-w-3xl">
            Diagrama esquemático completo de ligação dos componentes, gerador do arquivo <code>secrets.h</code> e código fonte do firmware Arduino para o robô COSMOS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/FluxGarage/RoboEyes"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Docs FluxGarage
          </a>
        </div>
      </div>

      {/* Main Content Grid: Pinout Map + Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive ESP32 Pinout Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-sky-900/60 bg-[#131f3d]/70 p-4 md:p-6 backdrop-blur shadow-xl">
            <h3 className="text-xs font-bold text-sky-400 font-cyber uppercase mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Mapa de Pinagem Interativo
            </h3>

            {/* ESP32 Pin List */}
            <div className="space-y-2 text-xs">
              {[21, 22, 13, 12, 27, 25, 33, 32, 4, 34].map((pinNum) => {
                const pin = pinDetails[pinNum];
                const isHovered = hoveredPin === pinNum;

                return (
                  <div
                    key={pinNum}
                    onMouseEnter={() => setHoveredPin(pinNum)}
                    onMouseLeave={() => setHoveredPin(null)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isHovered
                        ? 'bg-sky-950/90 border-sky-400 glow-cyan'
                        : 'bg-[#0b1329]/80 border-sky-950 hover:border-sky-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono font-bold ${pin.color}`}>{pin.name}</span>
                      <span className="text-slate-200 font-semibold">{pin.component}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{pin.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Code Viewer & secrets.h Generator */}
        <div className="lg:col-span-7 space-y-4">
          {/* File Selector Tabs */}
          <div className="rounded-2xl border border-sky-900/60 bg-[#131f3d]/70 p-4 md:p-6 backdrop-blur shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sky-950/80 mb-4">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveCodeFile('ino')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors ${
                    activeCodeFile === 'ino' ? 'bg-sky-600 text-white shadow' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  COSMOS_Robot.ino
                </button>
                <button
                  onClick={() => setActiveCodeFile('secrets')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors ${
                    activeCodeFile === 'secrets' ? 'bg-sky-600 text-white shadow' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  secrets.h (Gerador)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(activeCodeFile === 'ino' ? inoSnippet : secretsTemplate)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedCode ? 'Copiado!' : 'Copiar'}
                </button>
                {activeCodeFile === 'secrets' && (
                  <button
                    onClick={handleDownloadSecrets}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow"
                  >
                    <Download className="w-3 h-3" /> Baixar secrets.h
                  </button>
                )}
              </div>
            </div>

            {/* secrets.h form when active */}
            {activeCodeFile === 'secrets' && (
              <div className="p-3 bg-[#0b1329] rounded-xl border border-sky-950 mb-4 space-y-3 text-xs">
                <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                  <Lock className="w-3.5 h-3.5" /> Preencha suas credenciais para gerar o arquivo:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Wi-Fi SSID:</label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      className="w-full bg-[#131f3d] border border-sky-950 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Wi-Fi Senha:</label>
                    <input
                      type="text"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                      className="w-full bg-[#131f3d] border border-sky-950 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Chave da Groq:</label>
                    <input
                      type="text"
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      className="w-full bg-[#131f3d] border border-sky-950 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Code Display */}
            <div className="bg-[#030712] rounded-xl border border-sky-950 p-3.5 overflow-x-auto max-h-[460px]">
              <pre className="font-mono text-xs text-sky-200 leading-relaxed">
                <code>{activeCodeFile === 'ino' ? inoSnippet : secretsTemplate}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
