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
  paymentMethod?: 'CASH' | 'TRANSFER' | 'CARD';
}

export interface BotResponse {
  transactions: ParsedTransactionData[] | null;
  analysisAnswer: string | null;
}

const generateSystemInstruction = (historyContext: string) => `
You are FinBot, a professional Vietnamese financial assistant.
Current Date: ${new Date().toLocaleDateString('vi-VN')}

TASK: Extract transaction details from user input.

RULES:
1. Amount: "k"=000, "tr"=1,000,000.
2. Categories: "Ăn uống", "Di chuyển", "Mua sắm", "Hóa đơn", "Giải trí", "Sức khỏe", "Giáo dục", "Lương", "Đầu tư", "Khác".
3. Payment Method:
   - "ck", "chuyển khoản", "banking" -> 'TRANSFER'
   - "thẻ", "card", "visa" -> 'CARD'
   - Default or "tiền mặt" -> 'CASH'

CONTEXT:
${historyContext}

JSON OUTPUT:
{
  "transactions": [
    {
      "amount": number,
      "category": string,
      "description": string,
      "date": "YYYY-MM-DD",
      "type": "EXPENSE" | "INCOME",
      "person": string | null,
      "location": string | null,
      "paymentMethod": "CASH" | "TRANSFER" | "CARD"
    }
  ],
  "analysisAnswer": string | null
}
`;

export const parseTransactionFromMultimodal = async (
  input: { text?: string; imageBase64?: string; audioBase64?: string; mimeType?: string },
  transactionHistory: Transaction[] = []
): Promise<BotResponse | null> => {
  if (!process.env.API_KEY) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];

  const historyContext = transactionHistory.slice(-20).map(t => 
    `- [${t.date}] ${t.description}: ${t.amount}`
  ).join('\n');

  if (input.text) parts.push({ text: input.text });
  if (input.imageBase64) parts.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType || "image/jpeg" } });
  if (input.audioBase64) parts.push({ inlineData: { data: input.audioBase64, mimeType: input.mimeType || "audio/webm" } });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: { parts },
      config: {
        systemInstruction: generateSystemInstruction(historyContext),
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
                  location: { type: Type.STRING, nullable: true },
                  paymentMethod: { type: Type.STRING, enum: ['CASH', 'TRANSFER', 'CARD'], nullable: true }
                }
              }
            },
            analysisAnswer: { type: Type.STRING, nullable: true }
          }
        }
      }
    });

    if (response.text) return JSON.parse(response.text) as BotResponse;
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const generateBotResponse = (data: ParsedTransactionData): string => {
  let details = "";
  if (data.location) details += ` 📍 ${data.location}`;
  if (data.person) details += ` 👤 ${data.person}`;
  if (data.paymentMethod === 'TRANSFER') details += ` 🏦 CK`;
  if (data.paymentMethod === 'CARD') details += ` 💳 Thẻ`;
  
  return `✅ Ghi nhận: **${formatCurrency(data.amount)}** - _${data.description}_${details}`;
};

export const analyzeFinancialAdvice = async (transactions: Transaction[]): Promise<string> => {
  if (!process.env.API_KEY) return "Vui lòng cấu hình API Key.";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const recentTx = transactions.slice(-30).map(t => `${t.date}: ${t.description} - ${t.amount}`).join('\n');
  const prompt = `Phân tích chi tiêu (tiếng Việt, ngắn gọn): \n${recentTx}`;
  try {
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    return response.text || "Chưa có dữ liệu.";
  } catch (error) {
    return "Lỗi kết nối AI.";
  }
};