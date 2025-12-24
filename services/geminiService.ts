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
You are a smart financial assistant for a Vietnamese user. 
CURRENT DATE: ${new Date().toLocaleDateString('vi-VN')} (${new Date().toISOString().split('T')[0]})

Your task is TWO-FOLD:
1. RECORD TRANSACTIONS: Extract spending or income from user input. 
   - CRITICAL: The user might say multiple items. Split them.
   - Currency: "k" = 000. 
   - Categories: "Ăn uống", "Di chuyển", "Mua sắm", "Hóa đơn", "Giải trí", "Sức khỏe", "Giáo dục", "Lương", "Đầu tư", "Khác".
   
   - EXTRACTION RULES (IMPORTANT):
     1. **description**: The main item or action (e.g., "Ăn phở", "Mua áo thun", "Tiền ăn vặt").
     2. **person**: Specific name of person involved (e.g., "Châu", "Nam", "Mẹ"). If generic like "bạn bè", ignore or keep brief.
     3. **location**: Specific place/brand (e.g., "Quán Bà Hằng", "Vinmart", "Shopee").

     Examples:
     - Input: "Cho châu 10k tiền ăn vặt" 
       -> description: "Tiền ăn vặt", person: "Châu", amount: 10000
     - Input: "Ăn phở quán bà hằng với nam hết 30k" 
       -> description: "Ăn phở", location: "Quán Bà Hằng", person: "Nam", amount: 30000
     - Input: "Mua rau thịt ở vinmart" 
       -> description: "Mua rau thịt", location: "Vinmart"

2. ANALYZE DATA: If user asks a question, return 'analysisAnswer'.

CONTEXT (Recent User Transactions):
${historyContext}

OUTPUT FORMAT (JSON):
{
  "transactions": [ { ... } ] OR null,
  "analysisAnswer": "String" OR null
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

  // Context: Date, Desc, Amount, Cat, Person, Location
  const historyContext = transactionHistory.slice(-100).map(t => 
    `- [${t.date}] ${t.description} (${t.category}): ${t.amount} ${t.person ? `| Với: ${t.person}` : ''} ${t.location ? `| Tại: ${t.location}` : ''}`
  ).join('\n');

  if (input.text) parts.push({ text: input.text });

  if (input.imageBase64) {
    parts.push({
      inlineData: {
        data: input.imageBase64,
        mimeType: input.mimeType || "image/jpeg",
      },
    });
    if (!input.text) parts.push({ text: "Analyze this image for expenses." });
  }

  if (input.audioBase64) {
    parts.push({
      inlineData: {
        data: input.audioBase64,
        mimeType: input.mimeType || "audio/webm",
      },
    });
    if (!input.text) parts.push({ text: "Listen carefully. Split multiple items if spoken. Answer if it's a question." });
  }

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
  
  return `✅ Ghi nhận: **${formatCurrency(data.amount)}** - _${data.description}_${details} (${data.category})`;
};

export const analyzeFinancialAdvice = async (transactions: Transaction[]): Promise<string> => {
  if (!process.env.API_KEY) return "Vui lòng cấu hình API Key.";

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const recentTx = transactions.slice(-60).map(t => 
    `${t.date}: ${t.description} (${t.category}) - ${t.amount} ${t.person ? `[Với: ${t.person}]` : ''} ${t.location ? `[Tại: ${t.location}]` : ''}`
  ).join('\n');

  const prompt = `
    Dựa trên lịch sử giao dịch:
    ${recentTx}

    Hãy đóng vai chuyên gia tài chính và phân tích SÂU (150 từ):
    1. Nhận diện thói quen dựa trên NGƯỜI (Person) và ĐỊA ĐIỂM (Location). (Ví dụ: Hay ăn với ai? Hay mua sắm ở đâu?).
    2. Chỉ ra xu hướng tiêu dùng (Tăng/giảm).
    3. Lời khuyên cụ thể.
    4. Giọng điệu vui vẻ, tiếng Việt.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Không thể phân tích lúc này.";
  } catch (error) {
    console.error("Analysis Error:", error);
    return "Lỗi kết nối khi phân tích.";
  }
};