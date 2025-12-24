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
Bạn là FinBot, trợ lý quản lý tài chính thông minh. 
Hôm nay là ngày: ${new Date().toLocaleDateString('vi-VN')}

NHIỆM VỤ: Trích xuất thông tin chi tiêu từ tin nhắn người dùng.

QUY TẮC:
1. Số tiền: "k" = nghìn, "tr" = triệu. (VD: 50k = 50000).
2. Hình thức thanh toán:
   - "ck", "chuyển khoản", "banking" -> 'TRANSFER'
   - "thẻ", "card", "visa" -> 'CARD'
   - Mặc định hoặc "tiền mặt" -> 'CASH'
3. Danh mục: "Ăn uống", "Di chuyển", "Mua sắm", "Hóa đơn", "Giải trí", "Sức khỏe", "Giáo dục", "Lương", "Đầu tư", "Khác".

DỮ LIỆU CŨ:
${historyContext}

TRẢ VỀ JSON:
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

  const historyContext = transactionHistory.slice(-15).map(t => 
    `- ${t.date}: ${t.description} ${formatCurrency(t.amount)}`
  ).join('\n');

  if (input.text) parts.push({ text: `YÊU CẦU: ${input.text}` });
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
    console.error("Gemini Error:", error);
    return null;
  }
};

export const generateBotResponse = (data: ParsedTransactionData): string => {
  let method = "";
  if (data.paymentMethod === 'TRANSFER') method = " (🏦 Chuyển khoản)";
  if (data.paymentMethod === 'CARD') method = " (💳 Thẻ)";
  
  return `✅ Đã lưu: **${formatCurrency(data.amount)}** vào mục **${data.category}**\n📝 ${data.description}${method}`;
};

export const analyzeFinancialAdvice = async (transactions: Transaction[]): Promise<string> => {
  if (!process.env.API_KEY) return "Vui lòng cấu hình API Key.";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const recentTx = transactions.slice(-20).map(t => `${t.description}: ${t.amount}`).join(', ');
  const prompt = `Dựa trên các giao dịch này, hãy đưa ra 1 lời khuyên tài chính cực ngắn gọn (1 câu): ${recentTx}`;
  try {
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    return response.text || "Chưa có nhận xét.";
  } catch (error) {
    return "Lỗi phân tích.";
  }
};