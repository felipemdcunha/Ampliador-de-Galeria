
import { GoogleGenAI, Type } from "@google/genai";

export class GeminiService {
  private getClient() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  // Lógica de retry para erros transientes (como 503 - Overloaded)
  private async withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = error?.message?.includes('503') || error?.message?.includes('overloaded');
      if (isRetryable && retries > 0) {
        console.warn(`Modelo sobrecarregado. Tentando novamente em ${delay}ms... (${retries} tentativas restantes)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  async suggestPrompts(
    imageSource: string,
    systemPrompt: string,
    type: 'humanized' | 'creative_scene'
  ): Promise<string[]> {
    const ai = this.getClient();
    const promptText = `
      Baseado na imagem fornecida e nas instruções do sistema: "${systemPrompt}".
      A finalidade é: ${type === 'humanized' ? 'Humanizar o ambiente (adicionar pessoas interagindo naturalmente)' : 'Criar uma cena criativa com pessoas'}.
      Gere 3 sugestões de prompts detalhados em inglês para uma IA de geração de imagem. 
      Retorne APENAS um array JSON de strings.
    `;

    const base64Data = imageSource.split(',')[1] || imageSource;

    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: promptText }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      try {
        const text = response.text || '[]';
        return JSON.parse(text.trim());
      } catch (e) {
        console.error("Erro ao parsear resposta do Gemini", e);
        return ["A realistic high quality humanized interior scene"];
      }
    });
  }

  async generateAmplifiedImage(
    referenceImageBase64: string,
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' = '1:1',
    quality: '1K' | '2K' | '4K' = '1K'
  ): Promise<string> {
    const ai = this.getClient();
    const base64Data = referenceImageBase64.split(',')[1] || referenceImageBase64;
    
    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: prompt }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: quality as any
          }
        }
      });

      for (const candidate of response.candidates || []) {
        for (const part of candidate.content.parts || []) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }

      throw new Error("Nenhum dado de imagem retornado pelo Gemini Pro");
    });
  }
}
