class IntentClassifier {
  constructor(llmClient) {
    this.llm = llmClient;
    this.classificationPrompt = `
Analiza el siguiente mensaje del usuario y clasifica su intención principal.

TIPOS DE INTENCIÓN:
1. codex_search - Usuario quiere buscar, revisar o consultar algo específico en el Codex
2. agent_request - Usuario solicita un agente especializado o herramienta específica  
3. casual_chat - Conversación casual, saludo, charla general sin objetivo específico
4. technical_help - Ayuda técnica, programación, configuración
5. information_query - Pregunta informativa general

INSTRUCCIONES:
- Ignora el tono informal o formal del mensaje
- Enfócate en la INTENCIÓN REAL detrás de las palabras
- Si menciona "Codex" o quiere "revisar/ver/buscar algo", es codex_search
- Si es solo saludo sin objetivo específico, es casual_chat

Mensaje del usuario: "{message}"

Responde SOLO en este formato JSON:
{
  "intent": "tipo_de_intencion",
  "confidence": 0.95,
  "reasoning": "Breve explicación de por qué clasificaste así"
}`;
  }

  async classifyIntent(userMessage) {
    try {
      const prompt = this.classificationPrompt.replace('{message}', userMessage);
      
      const response = await this.llm.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Baja temperatura para respuestas consistentes
        max_tokens: 150
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Validación básica
      const validIntents = ['codex_search', 'agent_request', 'casual_chat', 'technical_help', 'information_query'];
      if (!validIntents.includes(result.intent)) {
        throw new Error('Intent no válido recibido del LLM');
      }

      return result;
      
    } catch (error) {
      console.error('Error en clasificación de intención:', error);
      // Fallback seguro
      return {
        intent: 'casual_chat',
        confidence: 0.5,
        reasoning: 'Error en clasificación, usando fallback'
      };
    }
  }

  async routeToAgent(userMessage) {
    const classification = await this.classifyIntent(userMessage);
    
    console.log(`Intención detectada: ${classification.intent} (${classification.confidence})`);
    console.log(`Razonamiento: ${classification.reasoning}`);

    switch (classification.intent) {
      case 'codex_search':
        return this.launchCodexAgent(userMessage);
        
      case 'agent_request':
        return this.launchSpecializedAgent(userMessage);
        
      case 'technical_help':
        return this.launchTechnicalAgent(userMessage);
        
      case 'information_query':
        return this.launchInfoAgent(userMessage);
        
      case 'casual_chat':
      default:
        return this.launchVizta(userMessage);
    }
  }

  launchCodexAgent(message) {
    console.log('🔍 Lanzando agente Codex para búsqueda...');
    // Tu lógica para el agente Codex
  }

  launchVizta(message) {
    console.log('💬 Lanzando Vizta para conversación casual...');
    // Tu lógica para Vizta
  }

  launchSpecializedAgent(message) {
    console.log('🛠 Lanzando agente especializado...');
    // Tu lógica para agentes especializados
  }

  launchTechnicalAgent(message) {
    console.log('⚙️ Lanzando agente técnico...');
    // Tu lógica para ayuda técnica
  }

  launchInfoAgent(message) {
    console.log('ℹ️ Lanzando agente informativo...');
    // Tu lógica para consultas informativas
  }
}

// Ejemplo de uso
async function testClassifier() {
  // Inicializar con tu cliente LLM (OpenAI, Anthropic, etc.)
  const classifier = new IntentClassifier(yourLLMClient);

  const testMessages = [
    "hola revisame si tengo algo de LGBT en el codex?",
    "hola, como estas?",
    "ayudame a configurar mi servidor",
    "que agente necesito para analizar datos?",
    "cual es la capital de Francia?"
  ];

  for (const message of testMessages) {
    console.log(`\n--- Mensaje: "${message}" ---`);
    await classifier.routeToAgent(message);
  }
}

export { IntentClassifier };