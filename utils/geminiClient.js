import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: OpenAI API key not found in environment variables (OPENAI_API_KEY)");
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey });
}

function toChatMessages(prompt, systemInstruction) {
  if (Array.isArray(prompt)) {
    return prompt.map((p) => ({
      role: p.role,
      content: p.content,
    }));
  }

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: String(prompt) });
  return messages;
}

export async function generateContent(prompt, systemInstruction, model) {
  try {
    const chosenModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const messages = toChatMessages(prompt, systemInstruction);

    const openai = getOpenAIClient();
    const result = await openai.chat.completions.create({
      model: chosenModel,
      messages,
      temperature: 0.7,
    });

    const content = result?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : JSON.stringify(content ?? '');
  } catch (error) {
    console.error("Error generating content with OpenAI:", error);
    if (error?.status === 401) {
      throw new Error("OpenAI authentication failed: check OPENAI_API_KEY");
    }
    throw error;
  }
}

export async function generateContentFromImage(prompt, imageData, options = {}) {
  try {
    const chosenModel = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const mimeType = options.mimeType || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${imageData}`;

    const openai = getOpenAIClient();
    const result = await openai.chat.completions.create({
      model: chosenModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: String(prompt) },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
    });

    const content = result?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : JSON.stringify(content ?? '');
  } catch (error) {
    console.error("Error generating content from image with OpenAI:", error);
    throw error;
  }
}
