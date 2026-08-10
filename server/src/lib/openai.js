import OpenAI from 'openai';
import config from '../config/index.js';

let openai;

const getClient = () => {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set — AI features are unavailable.');
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openai;
};

export const chat = async (systemPrompt, userPrompt, { maxTokens = 500 } = {}) => {
  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.4,
  });
  return response.choices[0].message.content.trim();
};
