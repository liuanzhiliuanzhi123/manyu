// Coze API 服务

const BOT_ID = process.env.COZE_BOT_ID?.trim() || "";
const TOKEN = process.env.COZE_API_TOKEN?.trim() || "";
const USER_ID = process.env.COZE_USER_ID?.trim() || "";
const COZE_API_URL = process.env.COZE_API_URL?.trim() || "https://api.coze.cn/v3/chat";

export interface CozeResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 模拟数据，当 API 调用失败时使用
const mockSpots = [
  {
    id: "mock-1",
    name: "故宫博物院",
    type: "attraction",
    address: "北京市东城区景山前街4号",
    rating: 4.9,
    heat: 98,
    ticketPrice: 60,
    description: "明清两代的皇家宫殿，世界上现存规模最大、保存最为完整的木质结构古建筑群。",
    image: "https://images.unsplash.com/photo-1584646098378-0874589d76b1?w=800&q=80",
    tags: ["历史文化", "世界遗产", "必游"],
    openTime: "08:30-17:00",
    phone: "010-85007421"
  },
  {
    id: "mock-2",
    name: "颐和园",
    type: "attraction",
    address: "北京市海淀区新建宫门路19号",
    rating: 4.8,
    heat: 95,
    ticketPrice: 30,
    description: "中国现存规模最大、保存最完整的皇家园林，被誉为皇家园林博物馆。",
    image: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=800&q=80",
    tags: ["皇家园林", "世界遗产", "亲子"],
    openTime: "06:30-18:00",
    phone: "010-62881144"
  },
  {
    id: "mock-3",
    name: "长城·八达岭",
    type: "attraction",
    address: "北京市延庆区八达岭镇",
    rating: 4.9,
    heat: 99,
    ticketPrice: 40,
    description: "万里长城的精华所在，是中华民族的象征，也是世界文化遗产。",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=80",
    tags: ["世界遗产", "必游", "户外"],
    openTime: "07:30-17:30",
    phone: "010-69121268"
  }
];

export async function searchCozeDatabase(query: string): Promise<any[]> {
  try {
    console.log("开始搜索 Coze 数据库:", query);
    console.log("使用的 API 地址:", COZE_API_URL);
    
    if (!BOT_ID || !TOKEN || !USER_ID) {
      console.warn("Coze API config is missing. Falling back to mock spots.");
      return mockSpots.filter(spot =>
        spot.name.toLowerCase().includes(query.toLowerCase()) ||
        spot.address.toLowerCase().includes(query.toLowerCase()) ||
        spot.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    }

    const response = await fetch(COZE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        bot_id: BOT_ID,
        user_id: USER_ID,
        messages: [
          {
            role: "user",
            content: `搜索: ${query}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      }),
    });

    console.log("Coze API 响应状态:", response.status);
    console.log("Coze API 响应头:", Object.fromEntries(response.headers));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Coze API 错误详情:", errorText);
      // API 调用失败时返回模拟数据
      console.log("使用模拟数据作为替代");
      return mockSpots.filter(spot => 
        spot.name.toLowerCase().includes(query.toLowerCase()) ||
        spot.address.toLowerCase().includes(query.toLowerCase()) ||
        spot.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    }

    const data = await response.json();
    console.log("Coze API 响应数据:", data);
    
    // 解析 Coze V3 API 返回的内容
    try {
      // 检查响应格式是否符合 Coze V3 API
      if (data.code === 0 && data.data) {
        const content = data.data.messages?.[0]?.content || data.data.content;
        if (content) {
          // 提取 JSON 部分
          const jsonMatch = content.match(/```json[\s\S]*?```/);
          if (jsonMatch) {
            const jsonContent = jsonMatch[0].replace(/```json|```/g, "").trim();
            return JSON.parse(jsonContent);
          }
          // 如果不是 JSON 格式，尝试直接解析
          return JSON.parse(content);
        }
      }
      // 响应格式不符合预期，返回模拟数据
      console.error("Coze API 响应格式不符合预期:", data);
      return mockSpots.filter(spot => 
        spot.name.toLowerCase().includes(query.toLowerCase()) ||
        spot.address.toLowerCase().includes(query.toLowerCase()) ||
        spot.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    } catch (error) {
      console.error("解析 Coze 响应失败:", error);
      // 解析失败时返回模拟数据
      return mockSpots.filter(spot => 
        spot.name.toLowerCase().includes(query.toLowerCase()) ||
        spot.address.toLowerCase().includes(query.toLowerCase()) ||
        spot.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    }
  } catch (error) {
    console.error("搜索 Coze 数据库失败:", error);
    // 网络错误时返回模拟数据
    return mockSpots.filter(spot => 
      spot.name.toLowerCase().includes(query.toLowerCase()) ||
      spot.address.toLowerCase().includes(query.toLowerCase()) ||
      spot.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
  }
}
