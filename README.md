# COSMOS Robot - Central de Controle, RoboEyes & IA

Aplicação web interativa para controle, simulação facial com a biblioteca oficial FluxGarage RoboEyes, telemetria serial e laboratório de inteligência artificial para o robô educacional COSMOS (ESP32 DevKit 30P).

## Recursos Principais

1. **Painel de Controle e Telemetria**:
   - Conexão Serial USB real via Web Serial API (Chrome/Edge) e modo simulação integrado.
   - Controle direcional dos servos contínuos SG90 (Frente, Trás, Esquerda, Direita, Parar e Dança) com atalhos de teclado (W, A, S, D, Espaço).
   - Acionamento do módulo Semáforo LED (Verde, Amarelo, Vermelho, Off) e Buzzer Piezoelétrico 5V (sons e melodias gerados via Web Audio API).
   - Gatilhos virtuais de botão físico (GPIO 4) e sensor de som KY-037 (GPIO 34).
   - Arena 2D física com detecção de obstáculos e rastreamento de trajeto.

2. **Galeria Interativa FluxGarage RoboEyes**:
   - Renderização canvas fluida baseada na geometria e estados da biblioteca original (36x36, raio 8, espaçamento 10).
   - Expressões completas: Default/Neutro, Happy, Confused, Laugh, Tired/Sad, Angry/Error, Blink, Thinking (Norte) e Talking (com equalizador de áudio sincronizado).
   - Auto-blinking e modo de repouso (Idle gaze) com movimentação natural dos olhos.

3. **Laboratório de Testes de IA (Groq Cloud & Voz)**:
   - Integração com a API Groq Cloud (LLaMA 3.3 70B, LLaMA 3.1 8B, Mixtral, Gemma) e simulador cognitivo offline inteligente.
   - Reconhecimento de fala por microfone (Web Speech API PT-BR) e síntese de voz (TTS).
   - Exibição de resposta espelhada no display OLED facial SSD1306 128x64.

4. **Firmware & Pinagem ESP32**:
   - Diagrama interativo de pinagem dos 30 pinos do ESP32 DevKit WROOM.
   - Visualizador de código fonte do firmware `COSMOS_Robot.ino` e gerador do arquivo `secrets.h`.

## Executando o Projeto

```bash
npm install
npm run dev
```
Servidor de desenvolvimento disponível em `http://localhost:3000`.
