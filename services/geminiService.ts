import { GoogleGenAI, Type } from "@google/genai";
import { TransactionType, Transaction } from "../types";

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export interface ParsedTransactionData {
  amount: number;
  category: string;
  description: string;
  date: string;
  type: TransactionType;
  person?: string;
  location?: string;
}

export interface BotResponse {
  transactions: ParsedTransactionData[] | null;
  analysisAnswer: string | null;
}

const generateSystemInstruction = (historyContext: string) => `
SYSTEM_ROLE: You are FinBot, a precise data extraction engine.

*** TASK ***
Extract financial transaction details from the USER_REQUEST.

${historyContext ? `*** CONTEXT (Reference Only) ***\n${historyContext}\n` : ''}

*** RULES ***
1. **Source of Truth**: Extract information ONLY from the "USER_REQUEST".
2. **Amounts**: 
   - "k" = 000 (e.g., 30k = 30000).
   - "tr" = 1000000.
   - If user says just "50", assume 50000 if context implies small purchase, or look for unit.
3. **Category**: Map to: Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Giải trí, Sức khỏe, Giáo dục, Lương, Đầu tư, Khác.
4. **Dates**: Default to TODAY (YYYY-MM-DD) unless user says "Hôm qua" (Yesterday).
5. **Silence**: If the input is just "hello" or invalid, return empty transactions.

*** OUTPUT JSON ***
{
  "transactions": [
    { 
      "amount": number, 
      "category": "String", 
      "description": "String", 
      "date": "YYYY-MM-DD", 
      "type": "EXPENSE" | "INCOME", 
      "person": "String", 
      "location": "String" 
    }
  ],
  "analysisAnswer": null
}
`;

export const parseTransactionFromMultimodal = async (
  input: { text?: string; imageBase64?: string; audioBase64?: string; mimeType?: string },
  transactionHistory: Transaction[] = []
): Promise<BotResponse | null> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];

  // LOGIC CHANGE: If transactionHistory is empty, we strictly do NOT provide context tags.
  // This isolates the AI to looking ONLY at the input text.
  let historyContext = "";
  if (transactionHistory.length > 0) {
      historyContext = transactionHistory.slice(-10).map(t => 
        `- ${t.date}: ${t.description} (${t.amount})`
      ).join('\n');
  }

  if (input.text) {
      parts.push({ text: `USER_REQUEST: ${input.text}` });
  }

  if (input.imageBase64) {
    parts.push({
      inlineData: {
        data: input.imageBase64,
        mimeType: input.mimeType || "image/jpeg",
      },
    });
    if (!input.text) parts.push({ text: "USER_REQUEST: Extract items from image." });
  }

  if (input.audioBase64) {
    parts.push({
      inlineData: {
        data: input.audioBase64,
        mimeType: input.mimeType || "audio/webm",
      },
    });
    if (!input.text) parts.push({ text: "USER_REQUEST: (Audio) Extract spoken transaction." });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: { parts },
      config: {
        systemInstruction: generateSystemInstruction(historyContext),
        temperature: 0, // Absolute zero creativity
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              nullable: true,
              items: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  date: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['EXPENSE', 'INCOME'] },
                  person: { type: Type.STRING, nullable: true },
                  location: { type: Type.STRING, nullable: true }
                }
              }
            },
            analysisAnswer: { type: Type.STRING, nullable: true }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as BotResponse;
      return data;
    }
    return null;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};

export const generateBotResponse = (data: ParsedTransactionData): string => {
  let details = "";
  if (data.location) details += ` 📍 ${data.location}`;
  if (data.person) details += ` 👤 ${data.person}`;
  
  const icon = data.type === TransactionType.INCOME ? '💰' : '💸';
  return `${icon} **${data.category}**: ${formatCurrency(data.amount)}\n📝 _${data.description}_${details}`;
};

export const analyzeFinancialAdvice = async (transactions: Transaction[]): Promise<string> => {
  if (!process.env.API_KEY) return "Vui lòng cấu hình API Key.";

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const recentTx = transactions.slice(-50).map(t => 
    `${t.date}: ${t.description} (${t.category}) - ${t.amount}`
  ).join('\n');

  const prompt = `
    Lịch sử giao dịch:
    ${recentTx}
    
    Nhận xét ngắn (1 câu) về chi tiêu:
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Chưa có dữ liệu.";
  } catch (error) {
    return "Lỗi kết nối AI.";
  }
};