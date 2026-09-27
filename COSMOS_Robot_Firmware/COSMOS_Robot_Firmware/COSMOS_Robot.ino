/*
  ============================================================================
  PROJETO: ROBO ASSISTENTE DE IA "COSMOS" - VERSAO FINAL UNIFICADA (v2.1)
  ============================================================================
  Placa: ESP32 WROOM DevKit (30 pinos)
  Biblioteca dos Olhos: FluxGarage RoboEyes (https://github.com/FluxGarage/RoboEyes)

  Este e o UNICO arquivo .ino que deve existir na pasta do sketch. Se voce
  tinha um "COSMOS_Robot_v2_NEW.ino" junto com este, DELETE-O ou mova para
  fora da pasta: o compilador do Arduino concatena todos os .ino de uma
  mesma pasta como se fossem um so arquivo, e dois setup()/loop() juntos
  geram erro de compilacao (funcao duplicada).

  ----------------------------------------------------------------------------
  BIBLIOTECAS NECESSARIAS (Arduino IDE > Gerenciador de Bibliotecas):
    1. "Adafruit SSD1306"     por Adafruit
    2. "Adafruit GFX Library" por Adafruit
    3. "ArduinoJson"          por Benoit Blanchon (v6.x ou v7.x)
    4. "ESP32Servo"           por Kevin Harrington / madhephaestus
    5. "FluxGarage RoboEyes"  por Dennis Hoelscher (FluxGarage)
       * O arquivo FluxGarage_RoboEyes.h ja esta incluso localmente no projeto!

  ----------------------------------------------------------------------------
  SEGURANCA - LEIA ANTES DE COMPILAR:
    O Wi-Fi e a chave da Groq NAO ficam mais escritos aqui dentro. Eles vem
    de um arquivo separado chamado "secrets.h" (incluido no pacote). Abra
    esse arquivo, preencha com os SEUS dados e NUNCA o envie para o GitHub
    ou para qualquer lugar publico (adicione "secrets.h" ao .gitignore).
    Se a sua chave antiga da Groq ja apareceu em algum arquivo de texto
    puro, considere-a comprometida: gere uma chave nova no console da Groq.

  ----------------------------------------------------------------------------
  MAPA DE PINAGEM:
    - Display OLED SSD1306 I2C : SDA -> GPIO 21 | SCL -> GPIO 22
    - Servos SG90 (Rodas)      : Esquerdo -> GPIO 13 | Direito -> GPIO 12*
      (*GPIO12 e um "strapping pin" de boot no ESP32. O servo so e
       inicializado no setup(), depois do boot, entao normalmente e seguro -
       mas se o robo tiver reinicios/boot loop estranhos, troque para GPIO14.)
    - Buzzer Ativo 5V          : GPIO 27
    - Modulo Semaforo LED      : Vermelho GPIO 25 | Amarelo GPIO 33 | Verde GPIO 32
    - Botao Tactil (Trigger)   : GPIO 4 (INPUT_PULLUP)
    - Sensor de Som KY-037     : Digital GPIO 34 | Analogico GPIO 35 (opcional)

  Consulte o "Guia de Montagem COSMOS" para o passo a passo fisico completo.
  ============================================================================
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <Preferences.h>
#include <esp_task_wdt.h>

// Inclusao da Biblioteca Oficial FluxGarage RoboEyes
#include "FluxGarage_RoboEyes.h"

// Credenciais ficam FORA deste arquivo (nunca commitar secrets.h!)
#include "secrets.h"

// ============================================================================
// 1. CONFIGURACOES DE REDE E GROQ CLOUD
// ============================================================================

const char* WIFI_SSID     = WIFI_SSID_SECRET;
const char* WIFI_PASSWORD = WIFI_PASSWORD_SECRET;

const char* GROQ_API_KEY      = GROQ_API_KEY_SECRET;
const char* GROQ_MODEL        = "llama-3.3-70b-versatile";
const char* GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const char* GROQ_SYSTEM_PROMPT = 
  "Voce e o COSMOS, robo assistente simpatico. Responda em no maximo 2 frases "
  "bem curtas e animadas, em portugues, sem caracteres especiais.";

const char* DEFAULT_USER_PROMPT = "Diga um fato curto e divertido sobre robos e espaco.";

const int           GROQ_MAX_TOKENS        = 85;
const float         GROQ_TEMPERATURE       = 0.7f;
const unsigned long GROQ_HTTP_TIMEOUT_MS   = 12000;
const size_t        MAX_PROMPT_LENGTH      = 280; // limite de seguranca para PROMPT: via serial

// ============================================================================
// 2. PINAGEM DE HARDWARE
// ============================================================================

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
#define PIN_SOUND_ANALOG    35

const bool USE_ANALOG_SOUND_SENSOR = false;
const int  SOUND_THRESHOLD_ANALOG  = 2500;

// ============================================================================
// 3. DISPLAY OLED & INSTANCIA FLUXGARAGE ROBOEYES
// ============================================================================

#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT        64
#define OLED_RESET           -1
#define OLED_I2C_ADDRESS   0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Instancia Oficial do RoboEyes acoplada ao display Adafruit SSD1306
RoboEyes<Adafruit_SSD1306> roboEyes(display);

// ============================================================================
// 4. SERVOS (RODAS CONTINUAS)
// ============================================================================

Servo servoLeft;
Servo servoRight;

const int SERVO_MIN_US        = 500;
const int SERVO_MAX_US        = 2500;
const int SERVO_STOP_US       = 1500;
const int SERVO_SPEED_DELTA   = 350;

// ============================================================================
// 5. MAQUINA DE ESTADOS E VARIAVEIS
// ============================================================================

enum RobotState {
  STATE_IDLE,        // RoboEyes em repouso (Auto-Blinker + IdleMode ativo)
  STATE_LISTENING,   // Botao ou Som detectado -> olhos felizes e atentos
  STATE_PROCESSING,  // Enviando para Groq -> olhos curiosos/pensativos (Norte/Confused)
  STATE_RESPONDING,  // Resposta IA recebida -> anim_laugh + danca + texto OLED
  STATE_ERROR,       // Falha -> olhos ANGRY/TIRED + LED vermelho
  STATE_LOCKDOWN     // Seguranca
};

enum SemaforoColor { 
  SEM_OFF, 
  SEM_RED, 
  SEM_YELLOW, 
  SEM_GREEN 
};

RobotState currentState = STATE_IDLE;

String currentPrompt    = "";
String aiResponseText   = "";
String lastErrorMessage = "";
String lockdownReason   = "";
String lastEyesState    = "NEUTRAL"; // ultimo estado dos olhos, usado na telemetria

// Controle do Botao (Debounce)
int           lastButtonReading = HIGH;
int           stableButtonState = HIGH;
unsigned long lastDebounceTime  = 0;
const unsigned long DEBOUNCE_MS = 50;

// Timer para alternancia da tela de texto para os olhos
unsigned long textDisplayUntil  = 0;
bool          showingTextScreen = false;

// Telemetria Serial
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 2500;

// Watchdog e Seguranca
Preferences prefs;
const uint32_t WDT_TIMEOUT_SECONDS = 25;
unsigned long unlockHoldStart = 0;

// ============================================================================
// 6. PROTOTIPOS
// ============================================================================

bool setupWiFi();
bool sendGroqRequest(const String &prompt, String &outResponse);

void setSemaphore(SemaforoColor color);
void playBuzzerTone(unsigned int freq, unsigned int durationMs);
void playSuccessMelody();
void playErrorTone();

void stopMotors();
void moveForward(unsigned long durationMs);
void moveBackward(unsigned long durationMs);
void spinLeft(unsigned long durationMs);
void spinRight(unsigned long durationMs);
void danceRoutine();

bool checkTriggers();
void handleListeningState();
void handleProcessingState();
void handleRespondingState();
void handleErrorState();
void handleLockdownState();

void processSerialCommands();
void sendTelemetry();
String sanitizeText(const String &input);
void setupSecurity();
void triggerLockdown(const String &reason);
void clearLockdownAndRestart();

// ============================================================================
// 7. SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(150);
  Serial.println(F("\n=========================================="));
  Serial.println(F("   COSMOS ROBOT - FLUXGARAGE ROBOEYES     "));
  Serial.println(F("=========================================="));

  // GPIOs
  pinMode(PIN_BUTTON,        INPUT_PULLUP);
  pinMode(PIN_SOUND_DIGITAL, INPUT);
  pinMode(PIN_LED_RED,       OUTPUT);
  pinMode(PIN_LED_YELLOW,    OUTPUT);
  pinMode(PIN_LED_GREEN,     OUTPUT);
  pinMode(PIN_BUZZER,        OUTPUT);

  setSemaphore(SEM_OFF);
  digitalWrite(PIN_BUZZER, LOW);

  // Display OLED SSD1306
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS)) {
    Serial.println(F("[ERRO] Display OLED nao encontrado no I2C!"));
  }
  display.clearDisplay();
  display.display();

  // INICIALIZACAO OFICIAL DA BIBLIOTECA FLUXGARAGE ROBOEYES
  roboEyes.begin(SCREEN_WIDTH, SCREEN_HEIGHT, 80); // 80 FPS para animacao fluida
  roboEyes.setWidth(36, 36);                       // Largura dos olhos
  roboEyes.setHeight(36, 36);                      // Altura dos olhos
  roboEyes.setBorderradius(8, 8);                  // Borda arredondada suave
  roboEyes.setSpacebetween(10);                    // Espaco entre os olhos
  roboEyes.setCuriosity(ON);                       // Olho externo aumenta quando olha para os lados
  roboEyes.close();                                // Comeca com os olhos fechados para abrir suavemente

  // Watchdog e Seguranca
  setupSecurity();

  if (currentState == STATE_LOCKDOWN) {
    setSemaphore(SEM_RED);
    return;
  }

  // Inicializacao dos Servos
  servoLeft.setPeriodHertz(50);
  servoRight.setPeriodHertz(50);
  servoLeft.attach(PIN_SERVO_LEFT,  SERVO_MIN_US, SERVO_MAX_US);
  servoRight.attach(PIN_SERVO_RIGHT, SERVO_MIN_US, SERVO_MAX_US);
  stopMotors();

  // Sinalizacao de Boot (Semaforo Amarelo + Abertura suave dos olhos)
  setSemaphore(SEM_YELLOW);
  delay(300);
  roboEyes.open(); // Abre os olhos com animacao interpolada

  // Conexao Wi-Fi
  bool wifiOk = setupWiFi();

  if (wifiOk) {
    setSemaphore(SEM_GREEN);
    playBuzzerTone(1000, 150);
    currentState = STATE_IDLE;
    
    // Configura o comportamento natural e expressivo do RoboEyes em repouso
    roboEyes.setMood(DEFAULT);
    roboEyes.setPosition(DEFAULT);
    roboEyes.setAutoblinker(ON, 3, 2); // Pisca automaticamente a cada 3-5s
    roboEyes.setIdleMode(ON, 2, 2);     // Olha suavemente para direcoes aleatorias
    Serial.println(F("WIFI_CONNECTED"));
  } else {
    setSemaphore(SEM_RED);
    playErrorTone();
    lastErrorMessage = "Wi-Fi Desconectado";
    currentState = STATE_ERROR;
    roboEyes.setMood(TIRED);
    Serial.println(F("WIFI_DISCONNECTED"));
  }

  delay(400);
}

// ============================================================================
// 8. LOOP PRINCIPAL
// ============================================================================

void loop() {
  esp_task_wdt_reset();

  // RENDERIZADOR FLUXGARAGE ROBOEYES:
  // Se nao estiver exibindo uma tela fixa de texto da IA, renderiza os olhos fluidos
  if (!showingTextScreen) {
    roboEyes.update();
  } else {
    if (millis() > textDisplayUntil) {
      showingTextScreen = false;
      display.clearDisplay();
      roboEyes.open();
      roboEyes.setMood(DEFAULT);
      roboEyes.setAutoblinker(ON, 3, 2);
      roboEyes.setIdleMode(ON, 2, 2);
    }
  }

  // Monitora comandos seriais do PC
  processSerialCommands();

  // Telemetria periodica
  if (millis() - lastTelemetryTime > TELEMETRY_INTERVAL_MS) {
    sendTelemetry();
    lastTelemetryTime = millis();
  }

  // Maquina de Estados
  switch (currentState) {

    case STATE_IDLE: {
      if (checkTriggers()) {
        currentState = STATE_LISTENING;
      }
      break;
    }

    case STATE_LISTENING: {
      handleListeningState();
      currentState = STATE_PROCESSING;
      break;
    }

    case STATE_PROCESSING: {
      handleProcessingState();
      break;
    }

    case STATE_RESPONDING: {
      handleRespondingState();
      currentState = STATE_IDLE;
      break;
    }

    case STATE_ERROR: {
      handleErrorState();
      break;
    }

    case STATE_LOCKDOWN: {
      handleLockdownState();
      break;
    }
  }
}

// ============================================================================
// 9. FUNCOES DA MAQUINA DE ESTADOS & ROBOEYES
// ============================================================================

bool checkTriggers() {
  int reading = digitalRead(PIN_BUTTON);
  if (reading != lastButtonReading) {
    lastDebounceTime = millis();
  }

  bool buttonPressed = false;
  if ((millis() - lastDebounceTime) > DEBOUNCE_MS) {
    if (reading != stableButtonState) {
      stableButtonState = reading;
      if (stableButtonState == LOW) {
        buttonPressed = true;
        Serial.println(F("BUTTON_PRESSED"));
      }
    }
  }
  lastButtonReading = reading;

  bool soundDetected = false;
  if (USE_ANALOG_SOUND_SENSOR) {
    soundDetected = (analogRead(PIN_SOUND_ANALOG) > SOUND_THRESHOLD_ANALOG);
  } else {
    soundDetected = (digitalRead(PIN_SOUND_DIGITAL) == HIGH);
  }

  if (soundDetected) {
    Serial.println(F("SOUND_DETECTED"));
  }

  return buttonPressed || soundDetected;
}

void handleListeningState() {
  setSemaphore(SEM_YELLOW);
  playBuzzerTone(1400, 80);

  // Configuracao RoboEyes: Fica atento, desliga idle aleatorio e poe humor feliz
  roboEyes.setIdleMode(OFF, 0, 0);
  roboEyes.setPosition(DEFAULT);
  roboEyes.setMood(HAPPY);
  roboEyes.open();
  lastEyesState = "HAPPY";
  Serial.println(F("EYES:HAPPY"));

  if (currentPrompt.length() == 0) {
    currentPrompt = String(DEFAULT_USER_PROMPT);
  }
  delay(300);
}

void handleProcessingState() {
  setSemaphore(SEM_YELLOW);

  // RoboEyes: Pensando! Olha para cima (Norte) e aciona animacao confuso/buscando
  roboEyes.setMood(DEFAULT);
  roboEyes.setPosition(N);
  roboEyes.anim_confused();
  lastEyesState = "THINKING";
  Serial.println(F("EYES:THINKING"));

  Serial.print(F("[GROQ] Consultando: "));
  Serial.println(currentPrompt);

  String respostaGroq = "";
  bool sucesso = sendGroqRequest(currentPrompt, respostaGroq);

  if (currentState == STATE_LOCKDOWN) return;

  if (sucesso) {
    aiResponseText = respostaGroq;
    Serial.print(F("AI_RESPONSE:"));
    Serial.println(aiResponseText);
    currentState = STATE_RESPONDING;
  } else {
    lastErrorMessage = respostaGroq;
    Serial.print(F("[ERRO] Groq: "));
    Serial.println(lastErrorMessage);
    currentState = STATE_ERROR;
  }

  currentPrompt = "";
}

void handleRespondingState() {
  setSemaphore(SEM_GREEN);
  playSuccessMelody();

  // RoboEyes: Expressao feliz comemorando e rindo com a resposta!
  roboEyes.setMood(HAPPY);
  roboEyes.anim_laugh();
  roboEyes.setVFlicker(ON, 2); // Vibracao de fala animada
  lastEyesState = "HAPPY";
  Serial.println(F("EYES:HAPPY"));

  // Executa a dança do COSMOS com os servos
  danceRoutine();

  roboEyes.setVFlicker(OFF, 0);

  // Exibe o texto da resposta da IA no display OLED por 4 segundos
  showingTextScreen = true;
  textDisplayUntil = millis() + 4500;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("COSMOS RESPONDE:"));
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  display.setCursor(0, 14);

  String out = aiResponseText;
  if (out.length() > 115) out = out.substring(0, 112) + "...";
  display.print(out);
  display.display();
}

void handleErrorState() {
  setSemaphore(SEM_RED);
  playErrorTone();

  // RoboEyes: Olhar irritado/alerta e com vibracao de erro
  roboEyes.setMood(ANGRY);
  roboEyes.setHFlicker(ON, 3);
  lastEyesState = "ERROR";
  Serial.println(F("EYES:ERROR"));

  unsigned long t0 = millis();
  while (millis() - t0 < 3500) {
    esp_task_wdt_reset();
    roboEyes.update();
    processSerialCommands();
    delay(20);
  }

  roboEyes.setHFlicker(OFF, 0);

  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  if (WiFi.status() == WL_CONNECTED) {
    setSemaphore(SEM_GREEN);
    playBuzzerTone(1000, 100);
    currentState = STATE_IDLE;
    roboEyes.setMood(DEFAULT);
    roboEyes.setIdleMode(ON, 2, 2);
    roboEyes.setAutoblinker(ON, 3, 2);
    Serial.println(F("WIFI_CONNECTED"));
  }
}

void handleLockdownState() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;

  if (millis() - lastBlink > 250) {
    ledState = !ledState;
    digitalWrite(PIN_LED_RED, ledState ? HIGH : LOW);
    if (ledState) tone(PIN_BUZZER, 880, 100);
    lastBlink = millis();
  }

  roboEyes.setMood(ANGRY);
  roboEyes.close();

  if (digitalRead(PIN_BUTTON) == LOW) {
    if (unlockHoldStart == 0) unlockHoldStart = millis();
    if (millis() - unlockHoldStart > 5000) {
      clearLockdownAndRestart();
    }
  } else {
    unlockHoldStart = 0;
  }
}

// ============================================================================
// 10. WI-FI & GROQ REST
// ============================================================================

bool setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print(F("[WIFI] Conectando"));

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 14000) {
    esp_task_wdt_reset();
    roboEyes.update();
    delay(200);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("[WIFI] IP: "));
    Serial.println(WiFi.localIP());
    return true;
  }
  return false;
}

bool sendGroqRequest(const String &prompt, String &outResponse) {
  if (WiFi.status() != WL_CONNECTED) {
    outResponse = "Sem conexao Wi-Fi";
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, GROQ_API_ENDPOINT)) {
    outResponse = "Falha HTTPClient";
    return false;
  }

  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Authorization", String("Bearer ") + GROQ_API_KEY);
  http.setTimeout(GROQ_HTTP_TIMEOUT_MS);

  StaticJsonDocument<768> doc;
  doc["model"]       = GROQ_MODEL;
  doc["temperature"] = GROQ_TEMPERATURE;
  doc["max_tokens"]  = GROQ_MAX_TOKENS;

  JsonArray msgs = doc.createNestedArray("messages");
  JsonObject sm  = msgs.createNestedObject();
  sm["role"]     = "system";
  sm["content"]  = GROQ_SYSTEM_PROMPT;

  JsonObject um  = msgs.createNestedObject();
  um["role"]     = "user";
  um["content"]  = prompt;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  int code = http.POST(jsonPayload);
  bool ok = false;

  if (code == HTTP_CODE_OK) {
    String respStr = http.getString();
    DynamicJsonDocument respDoc(4096);
    DeserializationError err = deserializeJson(respDoc, respStr);

    if (!err) {
      const char* content = respDoc["choices"][0]["message"]["content"] | "";
      String clean = sanitizeText(String(content));
      clean.trim();
      if (clean.length() > 0) {
        outResponse = clean;
        ok = true;
      } else {
        outResponse = "Resposta vazia da IA";
      }
    } else {
      outResponse = "Erro ao ler JSON";
    }
  } else if (code > 0) {
    outResponse = "HTTP " + String(code);
  } else {
    outResponse = "Falha conexao HTTPS";
  }

  http.end();
  return ok;
}

// ============================================================================
// 11. ATUADORES & MOTORES
// ============================================================================

void setSemaphore(SemaforoColor color) {
  digitalWrite(PIN_LED_RED,    color == SEM_RED    ? HIGH : LOW);
  digitalWrite(PIN_LED_YELLOW, color == SEM_YELLOW ? HIGH : LOW);
  digitalWrite(PIN_LED_GREEN,  color == SEM_GREEN  ? HIGH : LOW);
}

void stopMotors() {
  servoLeft.writeMicroseconds(SERVO_STOP_US);
  servoRight.writeMicroseconds(SERVO_STOP_US);
}

void moveForward(unsigned long durationMs) {
  servoLeft.writeMicroseconds(SERVO_STOP_US + SERVO_SPEED_DELTA);
  servoRight.writeMicroseconds(SERVO_STOP_US - SERVO_SPEED_DELTA);
  delay(durationMs);
  stopMotors();
}

void moveBackward(unsigned long durationMs) {
  servoLeft.writeMicroseconds(SERVO_STOP_US - SERVO_SPEED_DELTA);
  servoRight.writeMicroseconds(SERVO_STOP_US + SERVO_SPEED_DELTA);
  delay(durationMs);
  stopMotors();
}

void spinLeft(unsigned long durationMs) {
  servoLeft.writeMicroseconds(SERVO_STOP_US - SERVO_SPEED_DELTA);
  servoRight.writeMicroseconds(SERVO_STOP_US - SERVO_SPEED_DELTA);
  delay(durationMs);
  stopMotors();
}

void spinRight(unsigned long durationMs) {
  servoLeft.writeMicroseconds(SERVO_STOP_US + SERVO_SPEED_DELTA);
  servoRight.writeMicroseconds(SERVO_STOP_US + SERVO_SPEED_DELTA);
  delay(durationMs);
  stopMotors();
}

void danceRoutine() {
  moveForward(240);
  delay(80);
  moveBackward(240);
  delay(80);
  spinLeft(180);
  delay(80);
  spinRight(180);
  delay(80);
  stopMotors();
}

void playBuzzerTone(unsigned int freq, unsigned int durationMs) {
  tone(PIN_BUZZER, freq, durationMs);
  delay(durationMs + 20);
  noTone(PIN_BUZZER);
}

void playSuccessMelody() {
  const int n[] = { 523, 659, 784, 1046 };
  const int d[] = {  80,  80,  80,  160 };
  for (int i = 0; i < 4; i++) {
    playBuzzerTone(n[i], d[i]);
    delay(20);
  }
}

void playErrorTone() {
  playBuzzerTone(300, 160);
  delay(40);
  playBuzzerTone(180, 260);
}

// ============================================================================
// 12. PROTOCOLO SERIAL BIDIRECIONAL COM O PC
// ============================================================================

void processSerialCommands() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd = sanitizeText(cmd);
  cmd.trim();
  if (cmd.length() == 0) return;

  // Movimento
  if      (cmd == "FORWARD")  { moveForward(300); }
  else if (cmd == "BACK")     { moveBackward(300); }
  else if (cmd == "LEFT")     { spinLeft(250); }
  else if (cmd == "RIGHT")    { spinRight(250); }
  else if (cmd == "STOP")     { stopMotors(); }

  // Expressoes e Animacoes FluxGarage RoboEyes
  else if (cmd == "EYES_NEUTRAL" || cmd == "EYES_DEFAULT") {
    showingTextScreen = false;
    roboEyes.setVFlicker(OFF, 0);
    roboEyes.open();
    roboEyes.setMood(DEFAULT);
    roboEyes.setPosition(DEFAULT);
    roboEyes.setIdleMode(ON, 2, 2);
    roboEyes.setAutoblinker(ON, 3, 2);
    lastEyesState = "NEUTRAL";
    Serial.println(F("EYES:NEUTRAL"));
  }
  else if (cmd == "EYES_TALKING") {
    showingTextScreen = false;
    roboEyes.setIdleMode(OFF, 0, 0);
    roboEyes.open();
    roboEyes.setMood(HAPPY);
    roboEyes.setPosition(DEFAULT);
    roboEyes.setVFlicker(ON, 2); // simula "boca" falando com vibracao vertical
    lastEyesState = "TALKING";
    Serial.println(F("EYES:TALKING"));
  }
  else if (cmd == "EYES_HAPPY") {
    showingTextScreen = false;
    roboEyes.open();
    roboEyes.setMood(HAPPY);
    roboEyes.setPosition(DEFAULT);
    lastEyesState = "HAPPY";
    Serial.println(F("EYES:HAPPY"));
  }
  else if (cmd == "EYES_TIRED" || cmd == "EYES_SAD") {
    showingTextScreen = false;
    roboEyes.open();
    roboEyes.setMood(TIRED);
    roboEyes.setPosition(S);
    lastEyesState = "SAD";
    Serial.println(F("EYES:SAD"));
  }
  else if (cmd == "EYES_ANGRY" || cmd == "EYES_ERROR") {
    showingTextScreen = false;
    roboEyes.open();
    roboEyes.setMood(ANGRY);
    lastEyesState = "ERROR";
    Serial.println(F("EYES:ERROR"));
  }
  else if (cmd == "EYES_THINKING") {
    showingTextScreen = false;
    roboEyes.open();
    roboEyes.setMood(DEFAULT);
    roboEyes.setPosition(N);
    roboEyes.anim_confused();
    lastEyesState = "THINKING";
    Serial.println(F("EYES:THINKING"));
  }
  else if (cmd == "EYES_LAUGH") {
    showingTextScreen = false;
    roboEyes.open();
    roboEyes.setMood(HAPPY);
    roboEyes.anim_laugh();
    lastEyesState = "HAPPY";
    Serial.println(F("EYES:HAPPY"));
  }
  else if (cmd == "EYES_CONFUSED") {
    showingTextScreen = false;
    roboEyes.open();
    roboEyes.anim_confused();
    lastEyesState = "THINKING";
    Serial.println(F("EYES:THINKING"));
  }
  else if (cmd == "EYES_BLINK") {
    showingTextScreen = false;
    roboEyes.blink();
    lastEyesState = "BLINK";
    Serial.println(F("EYES:BLINK"));
  }

  // Perifericos
  else if (cmd == "BUZZER_ON")  { digitalWrite(PIN_BUZZER, HIGH); }
  else if (cmd == "BUZZER_OFF") { digitalWrite(PIN_BUZZER, LOW); }
  else if (cmd == "BEEP")       { playBuzzerTone(1200, 90); }
  else if (cmd == "LED_GREEN")  { setSemaphore(SEM_GREEN); }
  else if (cmd == "LED_YELLOW") { setSemaphore(SEM_YELLOW); }
  else if (cmd == "LED_RED")    { setSemaphore(SEM_RED); }
  else if (cmd == "LED_OFF")    { setSemaphore(SEM_OFF); }

  // Estados
  else if (cmd == "LISTEN") {
    if (currentState == STATE_IDLE) currentState = STATE_LISTENING;
  }
  else if (cmd == "IDLE") {
    showingTextScreen = false;
    roboEyes.setVFlicker(OFF, 0);
    currentState = STATE_IDLE;
    roboEyes.setMood(DEFAULT);
    roboEyes.setPosition(DEFAULT);
    roboEyes.setIdleMode(ON, 2, 2);
    roboEyes.setAutoblinker(ON, 3, 2);
  }
  else if (cmd == "STATUS") {
    sendTelemetry();
  }
  else if (cmd == "RESET") {
    Serial.println(F("[SISTEMA] Reiniciando..."));
    delay(200);
    ESP.restart();
  }
  else if (cmd.startsWith("PROMPT:")) {
    String p = cmd.substring(7);
    p.trim();
    if (p.length() > MAX_PROMPT_LENGTH) p = p.substring(0, MAX_PROMPT_LENGTH);
    if (p.length() > 0 && currentState == STATE_IDLE) {
      currentPrompt = p;
      currentState  = STATE_PROCESSING;
    }
  }
}

void sendTelemetry() {
  String wifiStatus = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : "OFFLINE";
  
  String stateStr = "IDLE";
  switch (currentState) {
    case STATE_IDLE:       stateStr = "IDLE"; break;
    case STATE_LISTENING:  stateStr = "LISTENING"; break;
    case STATE_PROCESSING: stateStr = "PROCESSING"; break;
    case STATE_RESPONDING: stateStr = "RESPONDING"; break;
    case STATE_ERROR:      stateStr = "ERROR"; break;
    case STATE_LOCKDOWN:   stateStr = "LOCKDOWN"; break;
  }

  Serial.print(F("STATUS:STATE:"));
  Serial.print(stateStr);
  Serial.print(F("|EYES:"));
  Serial.print(lastEyesState);
  Serial.print(F("|WIFI:"));
  Serial.println(wifiStatus);
}

String sanitizeText(const String &input) {
  String out;
  out.reserve(input.length());
  for (size_t i = 0; i < input.length(); i++) {
    char c = input[i];
    if (c == '\n' || c == '\r' || (c >= 32 && c < 127)) out += c;
  }
  return out;
}

void setupSecurity() {
  prefs.begin("cosmos_sec", false);
  bool prevLockdown = prefs.getBool("lockdown", false);
  if (prevLockdown) {
    lockdownReason = prefs.getString("reason", "Violacao detectada");
    currentState   = STATE_LOCKDOWN;
  }
  esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  esp_task_wdt_add(NULL);
}

void triggerLockdown(const String &reason) {
  lockdownReason = reason;
  prefs.putBool("lockdown", true);
  prefs.putString("reason", reason);
  stopMotors();
  servoLeft.detach();
  servoRight.detach();
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);
  currentState = STATE_LOCKDOWN;
}

void clearLockdownAndRestart() {
  prefs.putBool("lockdown", false);
  delay(400);
  ESP.restart();
}
