import OpenAI from 'openai';
import config from '../config/index.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export const chat = async (systemPrompt, userPrompt, { maxTokens = 500 } = {}) => {
  const response = await openai.chat.completions.create({
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
