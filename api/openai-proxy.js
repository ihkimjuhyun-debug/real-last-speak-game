// api/openai-proxy.js
export default async function handler(req, res) {
    // 보안을 위해 POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    const API_KEY = process.env.OPENAI_API_KEY; // Vercel 대시보드에 설정할 이름

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        
        // OpenAI로부터 받은 결과를 그대로 프론트엔드에 전달
        res.status(200).json(JSON.parse(data.choices[0].message.content));
    } catch (error) {
        res.status(500).json({ error: "AI 분석 중 오류가 발생했습니다." });
    }
}