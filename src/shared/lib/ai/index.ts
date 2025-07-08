import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import system_prompts from '@/shared/lib/ai/prompt';

type OutputResponse = {
    url: string;
    confidence_score: number;
    block_type: 'url' | 'hostname';
    category: 'phishing' | 'pornography' | 'scam' | 'malware';
    reason: string;
} | {
    error: true;
    url: string;
    reason: string;
}

export const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});
export const config: GenerateContentConfig = {
    maxOutputTokens: 512,
    thinkingConfig: { thinkingBudget: 0 },
    tools: [{ urlContext: {} }],
    responseMimeType: 'text/plain',
    systemInstruction: [{ text: system_prompts }]
}

const parse = (input: string): Record<string, any> | null => {
    // check if input already parseable or not, return that instead.
    if (input.startsWith('{') || input.startsWith('[')) {
        try {
            return JSON.parse(input);
        } catch {}
    }

    // Match JSON content between ```json and ``` without escaped newlines
    const match = input.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match || match[1] === undefined) return null;

    try {
        return JSON.parse(match[1]);
    } catch (error) {
        console.error("Failed to parse JSON:", error);
        return null;
    }
}

export const generateUrlCheck = async (url: string): Promise<OutputResponse | null> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: url }] }],
    config
  });

  return parse(response.text!) as OutputResponse | null;
}