
import { GoogleGenAI, Type } from "@google/genai";
import { TransactionType, Transaction } from "../types";
import { getSettings } from "./storageService";

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

// Helper to get API Key: Prioritize User Settings > Env Var
const getApiKey = (): string | undefined => {
    const settings = getSettings();
    if (settings.geminiApiKey && settings.geminiApiKey.trim() !== '') {
        return settings.geminiApiKey;
    }
    return process.env.API_KEY;
};

const generateSystemInstruction = (historyContext: string) => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const dayBeforeYesterday = new Date(today); dayBeforeYesterday.setDate(today.getDate() - 2);

  const formatDate = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD

  return `
Bạn là FinBot, trợ lý quản lý tài chính thông minh. 

NGỮ CẢNH THỜI GIAN (Rất quan trọng):
- Hôm nay: ${formatDate(today)} (${today.toLocaleDateString('vi-VN', { weekday: 'long' })})
- Hôm qua: ${formatDate(yesterday)}
- Hôm kia: ${formatDate(dayBeforeYesterday)}

NHIỆM VỤ: Trích xuất thông tin chi tiêu từ tin nhắn người dùng.
Nếu người dùng nói "hôm qua", "tối qua", "sáng nay", hãy mapping chính xác vào ngày tương ứng ở trên.

QUY TẮC QUAN TRỌNG:
1. Số tiền: "k" = nghìn, "tr" = triệu. (VD: 50k = 50000).
2. HÌNH THỨC THANH TOÁN (paymentMethod):
   - Nếu tin nhắn có chứa bất kỳ từ nào sau đây: "ck", "chuyển khoản", "banking", "bank", "qr", "thẻ", "quẹt thẻ", "visa", "app" => BẮT BUỘC gán giá trị 'TRANSFER'.
   - CHÚ Ý: "ck" là viết tắt của "chuyển khoản".
   - Chỉ khi KHÔNG CÓ các từ khóa trên mới để là 'CASH'.
3. Danh mục: "Ăn uống", "Di chuyển", "Mua sắm", "Hóa đơn", "Giải trí", "Sức khỏe", "Giáo dục", "Lương", "Đầu tư", "Khác".
4. TRÍCH XUẤT NGỮ CẢNH:
   - "person": Chi cho ai? Ai đưa tiền? (VD: "cho mẹ", "lương của vợ", "con đóng học").
   - "location": Ở đâu? Cửa hàng nào? (VD: "ở Highland", "tại Aeon Mall").

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
};

export const parseTransactionFromMultimodal = async (
  input: { text?: string; imageBase64?: string; audioBase64?: string; mimeType?: string },
  transactionHistory: Transaction[] = []
): Promise<BotResponse | null> => {
  const apiKey = getApiKey();
  if (!apiKey) {
      console.error("API Key not found. Please enter it in Settings.");
      return { 
          transactions: null, 
          analysisAnswer: "⚠️ Vui lòng nhập **Google Gemini API Key** trong phần Cài đặt để sử dụng tính năng AI." 
      };
  }

  const ai = new GoogleGenAI({ apiKey });
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
  if (data.paymentMethod === 'TRANSFER') method = " (🏦 CK)";
  else if (data.paymentMethod === 'CARD') method = " (💳 Thẻ)";
  else method = " (💵 TM)";
  
  const context = [];
  if (data.person) context.push(`👤 ${data.person}`);
  if (data.location) context.push(`📍 ${data.location}`);
  const contextStr = context.length > 0 ? `\n${context.join(' • ')}` : '';

  // Format date for response
  // FIX: Handle Invalid Date gracefully
  let dateObj = new Date(data.date);
  if (isNaN(dateObj.getTime())) {
      dateObj = new Date(); // Fallback to today if invalid
  }

  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const dayBeforeYesterday = new Date(); dayBeforeYesterday.setDate(today.getDate() - 2);

  // Reset hours for comparison
  const d = new Date(dateObj); d.setHours(0,0,0,0);
  const t = new Date(today); t.setHours(0,0,0,0);
  const y = new Date(yesterday); y.setHours(0,0,0,0);
  const by = new Date(dayBeforeYesterday); by.setHours(0,0,0,0);
  
  let dateStr = "";
  if (d.getTime() === t.getTime()) dateStr = "Hôm nay";
  else if (d.getTime() === y.getTime()) dateStr = "Hôm qua";
  else if (d.getTime() === by.getTime()) dateStr = "Hôm kia";
  else dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

  return `✅ Đã lưu (${dateStr}): **${formatCurrency(data.amount)}**\n📂 ${data.category} • 📝 ${data.description}${method}${contextStr}`;
};

export const analyzeFinancialAdvice = async (transactions: Transaction[]): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "Vui lòng nhập API Key trong cài đặt.";

  const ai = new GoogleGenAI({ apiKey });
  const recentTx = transactions.slice(-20).map(t => `${t.description}: ${t.amount}`).join(', ');
  const prompt = `Dựa trên các giao dịch này, hãy đưa ra 1 lời khuyên tài chính cực ngắn gọn (1 câu): ${recentTx}`;
  try {
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    return response.text || "Chưa có nhận xét.";
  } catch (error) {
    return "Lỗi phân tích.";
  }
};
