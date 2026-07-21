/**
 * OpenAI Client Configuration
 * 
 * Initializes and exports the OpenAI client for use across
 * the AI reasoning pipeline.
 */

const OpenAI = require('openai');

let clientInstance = null;

/**
 * Returns a singleton OpenAI client instance.
 * @returns {OpenAI}
 */
function getOpenAIClient() {
  if (!clientInstance) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GROQ_API_KEY is not configured. Please set it in your .env.local file.'
      );
    }

    clientInstance = new OpenAI({ 
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  return clientInstance;
}

/**
 * Returns the configured model name.
 * @returns {string}
 */
function getModelName() {
  return process.env.AI_MODEL || 'llama-3.1-8b-instant';
}

/**
 * Validates the OpenAI connection by listing available models.
 * @returns {Promise<{ connected: boolean, model: string, error: string|null }>}
 */
async function validateOpenAIConnection() {
  try {
    const client = getOpenAIClient();
    const model = getModelName();

    // Make a minimal API call to verify
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
    });

    return {
      connected: true,
      model,
      error: null,
    };
  } catch (err) {
    return {
      connected: false,
      model: getModelName(),
      error: err.message,
    };
  }
}

module.exports = {
  getOpenAIClient,
  getModelName,
  validateOpenAIConnection,
};
