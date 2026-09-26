/*
  ============================================================================
  PROJETO: Robô Assistente de IA "COSMOS"  (versão com hardening de segurança)
  ============================================================================
  Firmware para ESP32 WROOM DevKit (30 pinos) que integra um display OLED
  (rosto animado), 2 servos SG90 modificados para rotação contínua (rodas),
  buzzer, semáforo de LEDs, botão e sensor de som KY-037, com processamento
  de linguagem natural via API da Groq (modelo Llama 3.3 70B).

  Placa: ESP32 WROOM DevKit 30 pinos (Board: "ESP32 Dev Module" na IDE Arduino)

  ----------------------------------------------------------------------------
  BIBLIOTECAS NECESSÁRIAS (Gerenciador de Bibliotecas do Arduino):
    1. "ArduinoJson"        - Autor: Benoit Blanchon        (versão 6.x)
    2. "Adafruit SSD1306"   - Autor: Adafruit
    3. "Adafruit GFX Library" - Autor: Adafruit
    4. "ESP32Servo"         - Autor: Kevin Harrington / madhephaestus

  Bibliotecas nativas do core ESP32 (já inclusas ao instalar a placa "ESP32"
  no Gerenciador de Placas): WiFi.h, HTTPClient.h, WiFiClientSecure.h, Wire.h,
  Preferences.h, esp_task_wdt.h.

  ----------------------------------------------------------------------------
  MAPA DE PINAGEM:
    Display OLED SSD1306 (I2C)....... SDA -> GPIO 21 | SCL -> GPIO 22
    Servo Esquerdo (SG90 contínuo).... GPIO 13
    Servo Direito  (SG90 contínuo).... GPIO 12  (*)
    Buzzer Ativo 5V................... GPIO 27
    LED Semáforo Vermelho............. GPIO 25
    LED Semáforo Amarelo.............. GPIO 33
    LED Semáforo Verde................ GPIO 32
    Botão (Push Button)............... GPIO 4   (INPUT_PULLUP)
    Sensor de Som KY-037 (Digital).... GPIO 34
    Sensor de Som KY-037 (Analógico).. GPIO 35  (alternativo)

    (*) GPIO 12 é pino de "strapping" (MTDI). Normalmente inofensivo com um
    servo, mas se a placa ficar instável ao energizar, mude para outro GPIO.

  ============================================================================
  CAMADAS DE SEGURANÇA IMPLEMENTADAS NESTE FIRMWARE
  ============================================================================
  Nenhum software sozinho torna um dispositivo "inquebrável" — qualquer
  fabricante que prometa isso está exagerando. O que este firmware faz é
  aplicar boas práticas reais de engenharia de sistemas embarcados para
  reduzir a superfície de ataque e fazer o robô falhar de forma SEGURA
  (fail-safe) em vez de continuar operando de forma imprevisível:

  1. WATCHDOG DE HARDWARE (esp_task_wdt): se o programa travar por qualquer
     motivo (bug, dado malformado, pico elétrico), o próprio chip se
     reinicia automaticamente após WDT_TIMEOUT_SECONDS.

  2. DETECÇÃO DE "CRASH LOOP": o número de reinicializações é contado na
     memória não-volátil (NVS). Se o robô reiniciar repetidamente sem
     conseguir ficar estável (indício de falha persistente ou ataque),
     ele entra sozinho em BLOQUEIO DE SEGURANÇA.

  3. BLOQUEIO DE SEGURANÇA (STATE_LOCKDOWN): quando acionado, o robô:
       - desconecta o Wi-Fi e desliga o rádio;
       - desativa (detach) os servos, parando qualquer movimento;
       - acende alarme visual (LED vermelho piscando) e sonoro;
       - mostra o motivo do bloqueio no display;
       - PERSISTE entre reinicializações (fica salvo na NVS);
       - só é removido com uma ação física deliberada: manter o botão
         físico pressionado por 5 segundos. Isso impede que o próprio
         travamento seja "burlado" remotamente pela rede.

  4. VALIDAÇÃO E LIMITE DE TAMANHO das respostas HTTP da API (proteção
     contra respostas anormalmente grandes ou corrompidas, que poderiam
     indicar adulteração ou tentativa de sobrecarregar a memória do chip).

  5. SANITIZAÇÃO DE ENTRADAS: qualquer texto recebido (resposta da IA ou
     prompt digitado via Serial) passa por um filtro que remove caracteres
     de controle antes de ser usado ou exibido.

  6. CONTADOR DE ANOMALIAS DE API: respostas JSON corrompidas repetidas
     (possível indício de adulteração da comunicação) também acionam o
     bloqueio de segurança, mesmo sem reinicializações.

  7. VERIFICAÇÃO DE CREDENCIAIS PADRÃO: o firmware recusa operar
     normalmente se WIFI_SSID/WIFI_PASSWORD/GROQ_API_KEY ainda estiverem
     com os valores de exemplo (evita rodar "meio configurado").

  8. ESTRUTURA PARA VALIDAÇÃO DE CERTIFICADO TLS (certificate pinning):
     por padrão a conexão HTTPS usa setInsecure() para simplificar (ver
     nota abaixo), mas o código já está pronto para validar o certificado
     real da Groq — basta colar o certificado em GROQ_ROOT_CA e ativar
     ENABLE_TLS_CERT_PINNING.

  9. SUPERFÍCIE DE ATAQUE MÍNIMA POR DESIGN: este firmware NÃO implementa
     OTA (atualização de firmware remota), nem abre nenhum servidor/porta
     de rede — ele só faz conexões de SAÍDA para a API da Groq. Menos
     portas abertas = menos pontos de entrada para um invasor.

  ----------------------------------------------------------------------------
  SOBRE ATAQUES "PELO CHIP" (hardware) — o que o software NÃO resolve:
  ----------------------------------------------------------------------------
  Ataques físicos ao silício (extração de firmware via JTAG, leitura direta
  da flash, glitching de tensão) não podem ser bloqueados por código dentro
  do sketch — eles exigem recursos de HARDWARE do próprio ESP32, que são
  configurados uma única vez, gravando fusíveis (eFuses) internos, fora da
  IDE Arduino:
    - "Secure Boot V2": impede que qualquer firmware não assinado
      digitalmente seja executado no chip.
    - "Flash Encryption": criptografa todo o conteúdo da memória flash
      (incluindo Wi-Fi/API key), impedindo leitura direta do chip.
    - Desativação da interface JTAG: fecha a porta de depuração usada em
      ataques físicos.
  Esses recursos são gravados com as ferramentas "espsecure.py" e
  "espefuse.py" (instaladas junto com o core ESP32 do Arduino) e estão
  documentados oficialmente em docs.espressif.com, na seção "Security
  Features" do ESP32. ATENÇÃO: gravar esses fusíveis é IRREVERSÍVEL — um
  erro pode inutilizar a placa permanentemente. Teste sempre numa placa
  sobressalente antes de aplicar no robô final, e só faça isso se
  realmente precisar desse nível de proteção (ex.: produto comercial).

  NOTA DE SEGURANÇA (HTTPS): ver ENABLE_TLS_CERT_PINNING acima.
  NOTA SOBRE O BUZZER: buzzers ATIVOS não reproduzem tons diferentes (têm
  oscilador fixo); a melodia ainda soa como uma sequência de "beeps" no
  ritmo correto, o que já atende ao alarme sonoro do bloqueio de segurança.
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

// ============================================================================
// ======================= CONFIGURAÇÃO DO USUÁRIO ===========================
// ============================================================================

const char* WIFI_SSID     = "Camila";       // <-- Credenciais fornecidas para teste
const char* WIFI_PASSWORD = "2552201704";      // <-- Credenciais fornecidas para teste

const char* GROQ_API_KEY  = "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";  // <-- Key fornecida para teste
const char* GROQ_MODEL    = "llama-3.3-70b-versatile";
const char* GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const char* GROQ_SYSTEM_PROMPT =
  "Voce e o COSMOS, um pequeno robo assistente de IA, simpatico e animado. "
  "Responda de forma bem curta (no maximo 2 frases), em portugues, pois a "
  "resposta sera exibida em um display OLED pequeno.";

const char* DEFAULT_USER_PROMPT = "Diga um fato curto e interessante sobre robos.";

const int GROQ_MAX_TOKENS  = 120;
const float GROQ_TEMPERATURE = 0.7;
const unsigned long GROQ_HTTP_TIMEOUT_MS = 15000;

// --- Validação de certificado TLS (recomendado para uso em produção) ---
// Por padrão, a conexão usa setInsecure() (não valida o certificado do
// servidor) para simplificar o protótipo. Para produção: em um PC, rode
//     openssl s_client -connect api.groq.com:443 -showcerts
// copie o certificado RAIZ (o último da cadeia, formato PEM), cole abaixo
// em GROQ_ROOT_CA e mude ENABLE_TLS_CERT_PINNING para true.
const bool ENABLE_TLS_CERT_PINNING = false;

const char* GROQ_ROOT_CA = R"PEMCERT(
-----BEGIN CERTIFICATE-----
COLE_AQUI_O_CERTIFICADO_RAIZ_ATUAL_DA_API_GROQ_EM_FORMATO_PEM
-----END CERTIFICATE-----
)PEMCERT";

// ============================================================================
// ============================ PINAGEM (GPIOs) ==============================
// ============================================================================

#define PIN_OLED_SDA        21
#define PIN_OLED_SCL         22

#define PIN_SERVO_LEFT       13
#define PIN_SERVO_RIGHT      12

#define PIN_BUZZER           27

#define PIN_LED_RED          25
#define PIN_LED_YELLOW       33
#define PIN_LED_GREEN        32

#define PIN_BUTTON            4

#define PIN_SOUND_DIGITAL    34
#define PIN_SOUND_ANALOG     35

const bool USE_ANALOG_SOUND_SENSOR = false;
const int  SOUND_THRESHOLD_ANALOG  = 2500;

// ============================================================================
// ========================= CONFIGURAÇÃO DO DISPLAY ==========================
// ============================================================================

#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT   64
#define OLED_RESET      -1
#define OLED_I2C_ADDRESS 0x3C  // Troque para 0x3D se necessário

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ============================================================================
// ============================ SERVOS (RODAS) ================================
// ============================================================================

Servo servoLeft;
Servo servoRight;

const int SERVO_MIN_US   = 500;
const int SERVO_MAX_US   = 2500;
const int SERVO_STOP_US  = 1500;
const int SERVO_FAST_US_DELTA = 300;

// ============================================================================
// =================== CONSTANTES DE SEGURANÇA E RESILIÊNCIA ==================
// ============================================================================

const uint32_t WDT_TIMEOUT_SECONDS       = 25;    // Watchdog: reinicia se o loop travar
const int      MAX_BOOT_LOOP_COUNT       = 5;     // Reinicios seguidos sem estabilizar -> bloqueio
const unsigned long STABLE_RUNTIME_MS    = 30000; // Tempo em IDLE p/ considerar o boot "saudavel"
const int      MAX_JSON_ERRORS_BEFORE_LOCKDOWN = 3; // Respostas corrompidas seguidas -> bloqueio
const size_t   MAX_HTTP_RESPONSE_BYTES   = 8192;  // Limite de tamanho aceito da resposta da API
const size_t   MAX_SERIAL_PROMPT_LENGTH  = 200;   // Limite de caracteres p/ prompt via Serial
const unsigned long LOCKDOWN_UNLOCK_HOLD_MS = 5000; // Tempo de botao p/ desbloqueio manual

// ============================================================================
// ============================ MÁQUINA DE ESTADOS ============================
// ============================================================================

enum RobotState {
  STATE_IDLE,        // Neutro/espera: olhos piscando
  STATE_LISTENING,   // Gatilho acionado (botão ou som)
  STATE_PROCESSING,  // Enviando/aguardando resposta da Groq
  STATE_RESPONDING,  // Executa movimento, som e exibe resposta
  STATE_ERROR,       // Falha de Wi-Fi, API ou configuração pendente
  STATE_LOCKDOWN     // Bloqueio de segurança (persistente)
};

RobotState currentState = STATE_IDLE;

enum SemaforoColor { SEM_OFF, SEM_RED, SEM_YELLOW, SEM_GREEN };

enum EyeState {
  EYE_NEUTRAL,
  EYE_BLINK,
  EYE_HAPPY,
  EYE_THINKING,
  EYE_TALKING,
  EYE_SAD,
  EYE_ERROR_X
};

// ============================================================================
// ============================ VARIÁVEIS GLOBAIS =============================
// ============================================================================

String currentPrompt    = "";
String aiResponseText   = "";
String lastErrorMessage = "";
String lockdownReason   = "";

Preferences prefs;
int consecutiveJsonErrors = 0;
unsigned long unlockHoldStart = 0;

unsigned long lastBlinkTime   = 0;
unsigned long blinkStartTime  = 0;
bool isBlinking = false;
const unsigned long BLINK_INTERVAL_MS = 4000;
const unsigned long BLINK_DURATION_MS  = 150;

int lastButtonReading = HIGH;
int stableButtonState  = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY_MS = 50;

const unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
const unsigned long ERROR_RETRY_INTERVAL_MS = 5000;

unsigned long idleStartTime = 0;
bool runtimeMarkedStable = false;

// ============================================================================
// =========================== PROTÓTIPOS DE FUNÇÕES ==========================
// ============================================================================

bool setupWiFi();
bool sendGroqRequest(const String &userPrompt, String &outResponse);
void updateOledEyes(EyeState state);
void playBuzzerTone(unsigned int freq, unsigned int durationMs);
String sanitizeText(const String &input);

// ============================================================================
// ================================ SETUP ======================================
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== Inicializando COSMOS ===");

  // --- Pinos e display são sempre inicializados, mesmo em bloqueio ---
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_SOUND_DIGITAL, INPUT);

  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  setSemaphore(SEM_OFF);
  digitalWrite(PIN_BUZZER, LOW);

  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS)) {
    Serial.println("ERRO: display OLED nao encontrado. Verifique endereco/conexoes I2C.");
  }
  display.clearDisplay();
  display.display();

  // --- Verificações de segurança (pode definir currentState = STATE_LOCKDOWN) ---
  setupSecurity();

  if (currentState == STATE_LOCKDOWN) {
    setSemaphore(SEM_RED);
    displayStatusMessage("SISTEMA BLOQUEADO", lockdownReason);
    Serial.print("Dispositivo iniciou em BLOQUEIO DE SEGURANCA. Motivo: ");
    Serial.println(lockdownReason);
    return; // Servos e Wi-Fi permanecem desligados; loop() cuida do resto.
  }

  if (usingPlaceholderCredentials()) {
    lastErrorMessage = "Configure WIFI/API no codigo";
    currentState = STATE_ERROR;
    setSemaphore(SEM_RED);
    displayStatusMessage("Configuracao pendente", "Edite WIFI/API no .ino");
    Serial.println("AVISO: WIFI_SSID/WIFI_PASSWORD/GROQ_API_KEY ainda estao com valores de exemplo.");
    return;
  }

  // --- Inicialização dos servos ---
  servoLeft.setPeriodHertz(50);
  servoRight.setPeriodHertz(50);
  servoLeft.attach(PIN_SERVO_LEFT, SERVO_MIN_US, SERVO_MAX_US);
  servoRight.attach(PIN_SERVO_RIGHT, SERVO_MIN_US, SERVO_MAX_US);
  stopMotors();

  // --- Animação de boot: olhos abrindo + semáforo amarelo ---
  setSemaphore(SEM_YELLOW);
  runBootAnimation();

  // --- Conexão Wi-Fi ---
  bool wifiOk = setupWiFi();

  if (wifiOk) {
    setSemaphore(SEM_GREEN);
    playBuzzerTone(1000, 150);
    currentState = STATE_IDLE;
    displayStatusMessage("COSMOS online!", "Pressione o botao");
  } else {
    setSemaphore(SEM_RED);
    playErrorTone();
    lastErrorMessage = "Falha no Wi-Fi";
    currentState = STATE_ERROR;
  }

  lastBlinkTime = millis();
  delay(800);
}

// ============================================================================
// ================================= LOOP ======================================
// ============================================================================

void loop() {
  esp_task_wdt_reset(); // Alimenta o watchdog a cada iteracao

  switch (currentState) {

    case STATE_IDLE: {
      if (idleStartTime == 0) idleStartTime = millis();
      if (!runtimeMarkedStable && (millis() - idleStartTime > STABLE_RUNTIME_MS)) {
        prefs.putInt("bootCount", 0); // Boot considerado saudavel: zera o contador de crash-loop
        runtimeMarkedStable = true;
      }

      updateIdleEyes();

      if (WiFi.status() != WL_CONNECTED) {
        lastErrorMessage = "Wi-Fi desconectado";
        currentState = STATE_ERROR;
        break;
      }

      if (checkTriggers()) {
        currentState = STATE_LISTENING;
      }
      break;
    }

    case STATE_LISTENING:
      handleListeningState();
      currentState = STATE_PROCESSING;
      break;

    case STATE_PROCESSING:
      handleProcessingState(); // Define currentState internamente
      break;

    case STATE_RESPONDING:
      handleRespondingState();
      currentState = STATE_IDLE;
      idleStartTime = millis();
      break;

    case STATE_ERROR:
      handleErrorState();
      break;

    case STATE_LOCKDOWN:
      handleLockdownState();
      break;
  }
}

// ============================================================================
// ============================ CAMADA DE SEGURANÇA ============================
// ============================================================================

// Verifica se as credenciais ainda estão com os valores de exemplo do template.
bool usingPlaceholderCredentials() {
  return (strcmp(WIFI_SSID, "SUA_REDE_WIFI") == 0) ||
         (strcmp(WIFI_PASSWORD, "SUA_SENHA_WIFI") == 0) ||
         (strcmp(GROQ_API_KEY, "SUA_CHAVE_API_GROQ") == 0);
}

// Remove caracteres de controle de qualquer texto externo (resposta da IA ou
// entrada via Serial) antes de usá-lo ou exibi-lo — evita que dados
// corrompidos ou adulterados injetem sequências inesperadas no sistema.
String sanitizeText(const String &input) {
  String out;
  out.reserve(input.length());
  for (size_t i = 0; i < input.length(); i++) {
    char c = input[i];
    if (c == '\n' || c == '\r' || (c >= 32 && c < 127)) {
      out += c;
    }
  }
  return out;
}

// Inicializa a memória não-volátil (NVS), o watchdog de hardware, e checa se
// o dispositivo deve iniciar diretamente em bloqueio (seja porque um
// bloqueio anterior ainda não foi confirmado/removido manualmente, seja
// porque o número de reinicializações seguidas indica uma falha persistente).
void setupSecurity() {
  prefs.begin("cosmos_sec", false);

  bool previousLockdown = prefs.getBool("lockdown", false);
  if (previousLockdown) {
    lockdownReason = prefs.getString("reason", "Violacao de seguranca detectada anteriormente");
    currentState = STATE_LOCKDOWN;
  } else {
    int bootCount = prefs.getInt("bootCount", 0) + 1;
    prefs.putInt("bootCount", bootCount);
    Serial.printf("Contador de reinicializacoes desde o ultimo boot estavel: %d\n", bootCount);

    if (bootCount >= MAX_BOOT_LOOP_COUNT) {
      triggerLockdown("Ciclo de reinicios repetidos detectado (possivel falha ou ataque)");
    }

    consecutiveJsonErrors = prefs.getInt("jsonErr", 0);
  }

  // Watchdog de hardware: reinicia o ESP32 automaticamente se o loop travar
  esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  esp_task_wdt_add(NULL);
}

// Aciona o bloqueio de segurança: contém o robô (para movimento e rede),
// registra o motivo de forma persistente (sobrevive a reinicializações) e
// muda o estado para STATE_LOCKDOWN.
void triggerLockdown(const String &reason) {
  Serial.print("!!! BLOQUEIO DE SEGURANCA ACIONADO: ");
  Serial.println(reason);

  lockdownReason = reason;
  prefs.putBool("lockdown", true);
  prefs.putString("reason", reason);

  // Ações de contenção imediatas
  stopMotors();
  servoLeft.detach();
  servoRight.detach();
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);

  currentState = STATE_LOCKDOWN;
}

// Contabiliza uma resposta de API corrompida/inválida; várias seguidas
// acionam o bloqueio de segurança (pode indicar adulteração da comunicação).
void registerJsonAnomaly() {
  consecutiveJsonErrors++;
  prefs.putInt("jsonErr", consecutiveJsonErrors);
  Serial.printf("Anomalia de resposta da API registrada (%d/%d)\n",
                consecutiveJsonErrors, MAX_JSON_ERRORS_BEFORE_LOCKDOWN);

  if (consecutiveJsonErrors >= MAX_JSON_ERRORS_BEFORE_LOCKDOWN) {
    triggerLockdown("Respostas invalidas/corrompidas repetidas da API");
  }
}

void resetJsonAnomalyCounter() {
  if (consecutiveJsonErrors != 0) {
    consecutiveJsonErrors = 0;
    prefs.putInt("jsonErr", 0);
  }
}

// Remove o bloqueio de segurança e reinicia o dispositivo do zero. Só é
// chamada após o usuário manter o botão físico pressionado por
// LOCKDOWN_UNLOCK_HOLD_MS — uma ação humana e local, não remota.
void clearLockdownAndRestart() {
  prefs.putBool("lockdown", false);
  prefs.putInt("bootCount", 0);
  prefs.putInt("jsonErr", 0);
  Serial.println("Bloqueio de seguranca removido manualmente. Reiniciando...");
  displayStatusMessage("Bloqueio removido", "Reiniciando...");
  delay(1000);
  ESP.restart();
}

// Estado de bloqueio: alarme visual/sonoro contínuo e espera pela
// confirmação manual (botão físico mantido pressionado).
void handleLockdownState() {
  static unsigned long lastAlarmToggle = 0;
  static bool alarmOn = false;

  if (millis() - lastAlarmToggle > 300) {
    alarmOn = !alarmOn;
    digitalWrite(PIN_LED_RED, alarmOn ? HIGH : LOW);
    if (alarmOn) tone(PIN_BUZZER, 900, 150);
    lastAlarmToggle = millis();
  }

  updateOledEyes(EYE_ERROR_X);
  displayStatusMessage("SISTEMA BLOQUEADO", lockdownReason);

  if (digitalRead(PIN_BUTTON) == LOW) {
    if (unlockHoldStart == 0) unlockHoldStart = millis();
    if (millis() - unlockHoldStart > LOCKDOWN_UNLOCK_HOLD_MS) {
      clearLockdownAndRestart();
    }
  } else {
    unlockHoldStart = 0;
  }
}

// ============================================================================
// ========================== FUNÇÕES DE ESTADO (LÓGICA) ======================
// ============================================================================

bool checkTriggers() {
  bool buttonPressed = false;

  int reading = digitalRead(PIN_BUTTON);
  if (reading != lastButtonReading) {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY_MS) {
    if (reading != stableButtonState) {
      stableButtonState = reading;
      if (stableButtonState == LOW) {
        buttonPressed = true;
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

  return buttonPressed || soundDetected;
}

void handleListeningState() {
  updateOledEyes(EYE_HAPPY);
  playBuzzerTone(1500, 80);

  if (Serial.available() > 0) {
    String serialInput = Serial.readStringUntil('\n');
    serialInput = sanitizeText(serialInput);
    serialInput.trim();
    if (serialInput.length() > MAX_SERIAL_PROMPT_LENGTH) {
      serialInput = serialInput.substring(0, MAX_SERIAL_PROMPT_LENGTH);
    }
    currentPrompt = (serialInput.length() > 0) ? serialInput : String(DEFAULT_USER_PROMPT);
  } else {
    currentPrompt = String(DEFAULT_USER_PROMPT);
  }

  delay(400);
}

void handleProcessingState() {
  setSemaphore(SEM_YELLOW);
  updateOledEyes(EYE_THINKING);

  Serial.print("Enviando prompt para a Groq: ");
  Serial.println(currentPrompt);

  String resposta;
  bool ok = sendGroqRequest(currentPrompt, resposta);

  // Uma anomalia grave detectada dentro de sendGroqRequest() pode já ter
  // acionado o bloqueio de seguranca — nesse caso, não sobrescrever o estado.
  if (currentState == STATE_LOCKDOWN) {
    return;
  }

  if (ok) {
    aiResponseText = resposta;
    Serial.print("Resposta da Groq: ");
    Serial.println(aiResponseText);
    currentState = STATE_RESPONDING;
  } else {
    lastErrorMessage = resposta;
    Serial.print("Erro na chamada da API: ");
    Serial.println(lastErrorMessage);
    currentState = STATE_ERROR;
  }
}

void handleRespondingState() {
  setSemaphore(SEM_GREEN);
  playSuccessMelody();
  danceRoutine();
  speakAnimation(aiResponseText);
  displayResponseText(aiResponseText);
  delay(3500);
}

void handleErrorState() {
  setSemaphore(SEM_RED);
  updateOledEyes(EYE_ERROR_X);
  displayStatusMessage("Ops! Erro:", lastErrorMessage);
  playErrorTone();

  unsigned long waitStart = millis();
  while (millis() - waitStart < ERROR_RETRY_INTERVAL_MS) {
    esp_task_wdt_reset();
    delay(50);
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Tentando reconectar ao Wi-Fi...");
    setupWiFi();
  }

  if (WiFi.status() == WL_CONNECTED) {
    setSemaphore(SEM_GREEN);
    playBuzzerTone(1000, 120);
    currentState = STATE_IDLE;
    idleStartTime = millis();
  }
}

// ============================================================================
// ================================ WI-FI ======================================
// ============================================================================

bool setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando ao Wi-Fi");
  unsigned long startAttempt = millis();

  while (WiFi.status() != WL_CONNECTED &&
         (millis() - startAttempt) < WIFI_CONNECT_TIMEOUT_MS) {
    esp_task_wdt_reset();
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi conectado! IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("Falha ao conectar ao Wi-Fi (timeout).");
  return false;
}

// ============================================================================
// ============================= CLIENTE GROQ ==================================
// ============================================================================

bool sendGroqRequest(const String &userPrompt, String &outResponse) {
  if (WiFi.status() != WL_CONNECTED) {
    outResponse = "Sem conexao Wi-Fi";
    return false;
  }

  WiFiClientSecure secureClient;
  if (ENABLE_TLS_CERT_PINNING) {
    secureClient.setCACert(GROQ_ROOT_CA);
  } else {
    secureClient.setInsecure();
    Serial.println("AVISO: validacao de certificado TLS desativada (ver cabecalho do arquivo).");
  }

  HTTPClient https;
  if (!https.begin(secureClient, GROQ_API_ENDPOINT)) {
    outResponse = "Falha ao iniciar conexao HTTPS";
    return false;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", String("Bearer ") + GROQ_API_KEY);
  https.setTimeout(GROQ_HTTP_TIMEOUT_MS);

  StaticJsonDocument<512> requestDoc;
  requestDoc["model"] = GROQ_MODEL;
  requestDoc["temperature"] = GROQ_TEMPERATURE;
  requestDoc["max_tokens"] = GROQ_MAX_TOKENS;

  JsonArray messages = requestDoc.createNestedArray("messages");
  JsonObject systemMsg = messages.createNestedObject();
  systemMsg["role"] = "system";
  systemMsg["content"] = GROQ_SYSTEM_PROMPT;
  JsonObject userMsg = messages.createNestedObject();
  userMsg["role"] = "user";
  userMsg["content"] = userPrompt;

  String payload;
  serializeJson(requestDoc, payload);

  int httpCode = https.POST(payload);
  bool success = false;

  if (httpCode == HTTP_CODE_OK) {
    // Verifica o tamanho anunciado da resposta ANTES de baixá-la por completo
    int contentLength = https.getSize(); // -1 se desconhecido (ex.: chunked)
    if (contentLength > (int)MAX_HTTP_RESPONSE_BYTES) {
      outResponse = "Resposta da API excedeu o limite de seguranca de tamanho";
      https.end();
      registerJsonAnomaly();
      return false;
    }

    String responseBody = https.getString();

    // Segunda verificacao apos o download (cobre respostas "chunked")
    if (responseBody.length() > MAX_HTTP_RESPONSE_BYTES) {
      outResponse = "Resposta da API excedeu o limite de seguranca de tamanho";
      https.end();
      registerJsonAnomaly();
      return false;
    }

    DynamicJsonDocument responseDoc(4096);
    DeserializationError jsonErr = deserializeJson(responseDoc, responseBody);

    if (!jsonErr) {
      const char* content = responseDoc["choices"][0]["message"]["content"] | "";
      String cleanContent = sanitizeText(String(content));
      cleanContent.trim();

      if (cleanContent.length() > 0) {
        outResponse = cleanContent;
        success = true;
        resetJsonAnomalyCounter();
      } else {
        outResponse = "Resposta vazia da API";
        registerJsonAnomaly();
      }
    } else {
      outResponse = "Erro ao interpretar JSON da resposta (possivel resposta corrompida)";
      Serial.print("Erro ArduinoJson: ");
      Serial.println(jsonErr.c_str());
      registerJsonAnomaly();
    }
  } else if (httpCode > 0) {
    outResponse = "Erro HTTP: " + String(httpCode);
    Serial.printf("Groq retornou codigo HTTP: %d\n", httpCode);
  } else {
    outResponse = "Falha na conexao (codigo " + String(httpCode) + ")";
  }

  https.end();
  return success;
}

// ============================================================================
// ============================ ROSTO / OLHOS (OLED) ==========================
// ============================================================================

void runBootAnimation() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(14, 26);
  display.println("Iniciando COSMOS...");
  display.display();
  delay(600);

  const int leftX = 32, rightX = 96, centerY = 32, eyeW = 34;
  for (int h = 4; h <= eyeW; h += 6) {
    display.clearDisplay();
    display.fillRoundRect(leftX - eyeW / 2, centerY - h / 2, eyeW, h, 6, SSD1306_WHITE);
    display.fillRoundRect(rightX - eyeW / 2, centerY - h / 2, eyeW, h, 6, SSD1306_WHITE);
    display.display();
    delay(80);
  }
  delay(300);
}

void updateOledEyes(EyeState state) {
  display.clearDisplay();

  const int leftX = 32, rightX = 96, centerY = 30;
  const int eyeW = 34, eyeH = 34, radius = 8;

  switch (state) {

    case EYE_NEUTRAL:
      display.fillRoundRect(leftX - eyeW / 2, centerY - eyeH / 2, eyeW, eyeH, radius, SSD1306_WHITE);
      display.fillRoundRect(rightX - eyeW / 2, centerY - eyeH / 2, eyeW, eyeH, radius, SSD1306_WHITE);
      break;

    case EYE_BLINK:
      display.fillRoundRect(leftX - eyeW / 2, centerY - 3, eyeW, 6, 3, SSD1306_WHITE);
      display.fillRoundRect(rightX - eyeW / 2, centerY - 3, eyeW, 6, 3, SSD1306_WHITE);
      break;

    case EYE_HAPPY:
      display.fillTriangle(leftX - 17, centerY + 10, leftX, centerY - 10, leftX + 17, centerY + 10, SSD1306_WHITE);
      display.fillTriangle(rightX - 17, centerY + 10, rightX, centerY - 10, rightX + 17, centerY + 10, SSD1306_WHITE);
      break;

    case EYE_THINKING:
      display.drawCircle(leftX, centerY, 16, SSD1306_WHITE);
      display.fillCircle(leftX - 3, centerY - 9, 5, SSD1306_WHITE);
      display.drawCircle(rightX, centerY, 16, SSD1306_WHITE);
      display.fillCircle(rightX + 3, centerY - 9, 5, SSD1306_WHITE);
      break;

    case EYE_TALKING: {
      display.fillRoundRect(leftX - eyeW / 2, centerY - 20, eyeW, 18, radius, SSD1306_WHITE);
      display.fillRoundRect(rightX - eyeW / 2, centerY - 20, eyeW, 18, radius, SSD1306_WHITE);

      int barX = 40;
      for (int i = 0; i < 6; i++) {
        int h = 3 + ((millis() / 60 + i * 7) % 16);
        display.fillRect(barX + i * 8, 58 - h, 4, h, SSD1306_WHITE);
      }
      break;
    }

    case EYE_SAD:
      display.drawLine(leftX - 16, centerY - 16, leftX + 4, centerY - 8, SSD1306_WHITE);
      display.drawLine(rightX + 16, centerY - 16, rightX - 4, centerY - 8, SSD1306_WHITE);
      display.fillRoundRect(leftX - eyeW / 2, centerY - 4, eyeW, 14, radius, SSD1306_WHITE);
      display.fillRoundRect(rightX - eyeW / 2, centerY - 4, eyeW, 14, radius, SSD1306_WHITE);
      break;

    case EYE_ERROR_X:
      display.drawLine(leftX - 15, centerY - 15, leftX + 15, centerY + 15, SSD1306_WHITE);
      display.drawLine(leftX - 15, centerY + 15, leftX + 15, centerY - 15, SSD1306_WHITE);
      display.drawLine(rightX - 15, centerY - 15, rightX + 15, centerY + 15, SSD1306_WHITE);
      display.drawLine(rightX - 15, centerY + 15, rightX + 15, centerY - 15, SSD1306_WHITE);
      break;
  }

  display.display();
}

void updateIdleEyes() {
  unsigned long now = millis();

  if (!isBlinking && (now - lastBlinkTime > BLINK_INTERVAL_MS)) {
    isBlinking = true;
    blinkStartTime = now;
  }

  if (isBlinking) {
    updateOledEyes(EYE_BLINK);
    if (now - blinkStartTime > BLINK_DURATION_MS) {
      isBlinking = false;
      lastBlinkTime = now;
    }
  } else {
    updateOledEyes(EYE_NEUTRAL);
  }
}

void speakAnimation(const String &text) {
  unsigned long duration = min((unsigned long)3000, (unsigned long)(text.length() * 60));
  duration = max(duration, (unsigned long)1200);

  unsigned long start = millis();
  while (millis() - start < duration) {
    esp_task_wdt_reset();
    updateOledEyes(EYE_TALKING);
    delay(90);
  }
}

void displayStatusMessage(const String &title, const String &subtitle) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 4);
  display.println(title);
  display.drawLine(0, 14, 128, 14, SSD1306_WHITE);
  display.setCursor(0, 20);
  display.println(subtitle);
  display.display();
}

void displayResponseText(const String &text) {
  String textoExibido = text;
  const int MAX_CHARS_TELA = 130;
  if (textoExibido.length() > MAX_CHARS_TELA) {
    textoExibido = textoExibido.substring(0, MAX_CHARS_TELA - 3) + "...";
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("COSMOS diz:");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  display.setCursor(0, 14);
  display.print(textoExibido);
  display.display();
}

// ============================================================================
// ============================= SEMÁFORO DE LEDS ==============================
// ============================================================================

void setSemaphore(SemaforoColor color) {
  digitalWrite(PIN_LED_RED,    color == SEM_RED    ? HIGH : LOW);
  digitalWrite(PIN_LED_YELLOW, color == SEM_YELLOW ? HIGH : LOW);
  digitalWrite(PIN_LED_GREEN,  color == SEM_GREEN  ? HIGH : LOW);
}

// ============================================================================
// ========================== MOVIMENTO DOS SERVOS (RODAS) =====================
// ============================================================================

void stopMotors() {
  servoLeft.writeMicroseconds(SERVO_STOP_US);
  servoRight.writeMicroseconds(SERVO_STOP_US);
}

void moveForward(unsigned long durationMs) {
  servoLeft.writeMicroseconds(SERVO_STOP_US + SERVO_FAST_US_DELTA);
  servoRight.writeMicroseconds(SERVO_STOP_US - SERVO_FAST_US_DELTA);
  delay(durationMs);
  stopMotors();
}

void moveBackward(unsigned long durationMs) {
  servoLeft.writeMicroseconds(SERVO_STOP_US - SERVO_FAST_US_DELTA);
  servoRight.writeMicroseconds(SERVO_STOP_US + SERVO_FAST_US_DELTA);
  delay(durationMs);
  stopMotors();
}

void spinLeft(unsigned long durationMs) {
  servoLeft.writeMicroseconds(SERVO_STOP_US - SERVO_FAST_US_DELTA);
  servoRight.writeMicroseconds(SERVO_STOP_US - SERVO_FAST_US_DELTA);
  delay(durationMs);
  stopMotors();
}

void spinRight(unsigned long durationMs) {
  servoLeft.writeMicroseconds(SERVO_STOP_US + SERVO_FAST_US_DELTA);
  servoRight.writeMicroseconds(SERVO_STOP_US + SERVO_FAST_US_DELTA);
  delay(durationMs);
  stopMotors();
}

void danceRoutine() {
  moveForward(300);
  delay(120);
  moveBackward(300);
  delay(120);
  spinLeft(250);
  delay(120);
  spinRight(250);
  delay(120);
  stopMotors();
}

// ============================================================================
// ================================ BUZZER ======================================
// ============================================================================

void playBuzzerTone(unsigned int freq, unsigned int durationMs) {
  tone(PIN_BUZZER, freq, durationMs);
  delay(durationMs + 20);
  noTone(PIN_BUZZER);
}

void playSuccessMelody() {
  int notas[]   = {523, 659, 784, 1046};
  int duracao[] = {100, 100, 100, 160};
  for (int i = 0; i < 4; i++) {
    playBuzzerTone(notas[i], duracao[i]);
    delay(30);
  }
}

void playErrorTone() {
  playBuzzerTone(300, 200);
  delay(60);
  playBuzzerTone(180, 350);
}
