// api/openai-proxy.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { audio, topic } = req.body;
    const API_KEY = process.env.OPENAI_API_KEY;

    // 1. 키 체크 (이게 없으면 500 납니다)
    if (!API_KEY) {
        return res.status(500).json({ error: "환경변수 OPENAI_API_KEY가 없습니다!" });
    }

    try {
        const audioBuffer = Buffer.from(audio, 'base64');
        const blob = new Blob([audioBuffer], { type: 'audio/m4a' });
        
        const formData = new FormData();
        formData.append('file', blob, 'audio.m4a');
        formData.append('model', 'whisper-1');

        // Whisper STT
        const sttResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${API_KEY}` },
            body: formData
        });

        const sttData = await sttResponse.json();
        if (sttData.error) throw new Error("Whisper 에러: " + sttData.error.message);

        const userSpeech = sttData.text;

        // GPT 분석
        const prompt = `Analyze: "${userSpeech}" about topic "${topic}". Score 0-100. JSON: {"total_score": 85, "sentences": [{"orig": "", "better_en": "", "better_ko": "", "tip_en": "", "tip_ko": ""}]}`;

        const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        });

        const gptData = await gptResponse.json();
        if (gptData.error) throw new Error("GPT 에러: " + gptData.error.message);

        const feedback = JSON.parse(gptData.choices[0].message.content);
        res.status(200).json({ ...feedback, user_speech: userSpeech });

    } catch (error) {
        // [디버깅] 실제 에러를 화면에 뿌려줍니다.
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}
