#pragma once
// ============================================================================
// SEGREDOS DO ROBO COSMOS - NAO SUBA ESTE ARQUIVO PARA O GITHUB!
// ============================================================================
// Preencha os 3 valores abaixo com os SEUS dados reais e depois adicione a
// linha "secrets.h" no arquivo .gitignore do seu repositorio, antes de
// publicar o projeto (o README que voce esta revisando no Agente Coding e
// um bom lugar para lembrar dessa mesma regra).
//
// A chave da Groq que estava escrita direto no .ino antigo deve ser
// considerada COMPROMETIDA. Gere uma chave nova em:
//   https://console.groq.com/keys
// e cole a chave nova aqui, nunca a antiga.
// ============================================================================

// Rede Wi-Fi (o ESP32 só conecta em redes de 2.4GHz, não em 5GHz)
#define WIFI_SSID_SECRET     "COLOQUE_O_NOME_DO_SEU_WIFI_AQUI"
#define WIFI_PASSWORD_SECRET "COLOQUE_A_SENHA_DO_SEU_WIFI_AQUI"

// Chave da API da Groq Cloud
#define GROQ_API_KEY_SECRET  "COLOQUE_SUA_CHAVE_GROQ_NOVA_AQUI"
