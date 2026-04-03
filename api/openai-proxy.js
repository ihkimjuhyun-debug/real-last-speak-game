// api/openai-proxy.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { audio, topic } = req.body;
    const API_KEY = process.env.OPENAI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: "환경변수 OPENAI_API_KEY가 없습니다!" });
    }

    try {
        const audioBuffer = Buffer.from(audio, 'base64');
        const blob = new Blob([audioBuffer], { type: 'audio/m4a' });
        
        const formData = new FormData();
        formData.append('file', blob, 'audio.m4a');
        formData.append('model', 'whisper-1');

        // 1. Whisper STT: 음성을 텍스트로 변환
        const sttResponse = await fetch("[https://api.openai.com/v1/audio/transcriptions](https://api.openai.com/v1/audio/transcriptions)", {
            method: "POST",
            headers: { "Authorization": `Bearer ${API_KEY}` },
            body: formData
        });

        const sttData = await sttResponse.json();
        if (sttData.error) throw new Error("Whisper 에러: " + sttData.error.message);

        const userSpeech = sttData.text;

        // 2. 프롬프트 구조 강제화 (이 부분이 핵심 해결책입니다!)
        const systemRole = `You are an expert English speaking coach. 
        Your task is to analyze the user's spoken English for the topic: "${topic}".
        Focus on naturalness, professional vocabulary, and nuanced expressions.`;

        // AI가 딴짓을 못하도록 JSON 템플릿을 하드코딩해서 줍니다.
        const instruction = `
        Evaluate the transcription: "${userSpeech}"
        
        You MUST return the result EXACTLY in the following JSON structure. Do not change the key names.
        {
            "total_score": <number between 0-100 based on grammar and fluency>,
            "sentences": [
                {
                    "orig": "<original sentence from the transcript>",
                    "better_en": "<a much more natural, native-like version>",
                    "better_ko": "<a natural Korean translation of better_en>",
                    "explanation": "<detailed explanation in Korean about why the original was awkward and what nuance the improved version adds>"
                }
            ]
        }
        `;

        // 3. GPT-4o-mini 분석
        const gptResponse = await fetch("[https://api.openai.com/v1/chat/completions](https://api.openai.com/v1/chat/completions)", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemRole },
                    { role: "user", content: instruction }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        const gptData = await gptResponse.json();
        if (gptData.error) throw new Error("GPT 에러: " + gptData.error.message);

        // 4. 안전장치: AI가 가끔 마크다운 텍스트(```json)를 포함해서 보내는 경우를 대비해 텍스트 클렌징
        let content = gptData.choices[0].message.content.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const feedback = JSON.parse(content);

        // 프론트엔드와 데이터 구조를 맞추어 응답 전송
        res.status(200).json({ 
            ...feedback, 
            user_speech: userSpeech 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}
