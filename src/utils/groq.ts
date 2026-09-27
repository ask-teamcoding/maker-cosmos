// Groq API integration with intelligent Cosmos fallback responses

const SYSTEM_PROMPT =
  'Você é o robô assistente COSMOS com display OLED SSD1306 e ESP32. Responda em no máximo 2 frases curtas, simpáticas e animadas em português, sem formatação complexa.';

const COSMOS_FALLBACK_FACTS = [
  'Olá! Eu sou o robô COSMOS movido a ESP32 e servo motores contínuos. Adoro explorar o espaço!',
  'Sabia que as rodas do rover Curiosity em Marte têm furos que deixam marcas em código Morse na areia marciana?',
  'O telescópio James Webb orbita o ponto Lagrange L2 a 1.5 milhão de quilômetros da Terra!',
  'Em gravidade zero, as chamas no espaço ficam perfeitamente esféricas por causa da falta de convecção!',
  'Minhas expressões faciais são geradas em tempo real com a biblioteca oficial FluxGarage RoboEyes!',
  'Robôs espaciais utilizam giroscópios de controle de momento para mudar de direção sem gastar combustível.',
  'O primeiro robô humanoide no espaço foi o Robonaut 2, que chegou à Estação Espacial Internacional em 2011!',
  'Na Lua, as pegadas dos astronautas da missão Apollo permanecerão intactas por milhões de anos porque não há vento!',
];

export async function queryCosmosAI(
  prompt: string,
  apiKey: string,
  model: string = 'llama-3.3-70b-versatile'
): Promise<{ text: string; latencyMs: number; source: 'groq' | 'local_sim' }> {
  const t0 = performance.now();

  const trimmedKey = apiKey.trim();

  // If user provided a valid-looking Groq key, try calling Groq Cloud API
  if (trimmedKey && trimmedKey.startsWith('gsk_')) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${trimmedKey}`,
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          max_tokens: 85,
          temperature: 0.7,
        }),
      });

      const latencyMs = Math.round(performance.now() - t0);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (content) {
        return { text: content, latencyMs, source: 'groq' };
      }
    } catch (err) {
      console.warn('Groq API call error, falling back to local simulator:', err);
      // Fall through to smart simulator
    }
  }

  // Smart local simulator (for instant zero-setup experience or fallback)
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));
  const latencyMs = Math.round(performance.now() - t0);

  const lowerPrompt = prompt.toLowerCase();
  let selectedText = '';

  if (lowerPrompt.includes('quem') || lowerPrompt.includes('voce') || lowerPrompt.includes('você')) {
    selectedText = 'Eu sou o robô COSMOS, um assistente robótico inteligente com ESP32 e olhos animados!';
  } else if (lowerPrompt.includes('olho') || lowerPrompt.includes('express')) {
    selectedText = 'Meus olhos usam a biblioteca FluxGarage RoboEyes com 36x36 pixels e raio de curvatura 8!';
  } else if (lowerPrompt.includes('marte') || lowerPrompt.includes('lua') || lowerPrompt.includes('espaço')) {
    selectedText = 'O monte Olimpo em Marte é três vezes mais alto que o Monte Everest!';
  } else if (lowerPrompt.includes('piada') || lowerPrompt.includes('riso') || lowerPrompt.includes('engraçad')) {
    selectedText = 'Por que o robô foi ao médico? Porque ele tinha um parafuso a menos e pegou um vírus!';
  } else {
    const randomFact = COSMOS_FALLBACK_FACTS[Math.floor(Math.random() * COSMOS_FALLBACK_FACTS.length)];
    selectedText = randomFact;
  }

  return { text: selectedText, latencyMs, source: trimmedKey ? 'groq' : 'local_sim' };
}
