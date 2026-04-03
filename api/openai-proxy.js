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
        const sttResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${API_KEY}` },
            body: formData
        });

        const sttData = await sttResponse.json();
        if (sttData.error) throw new Error("Whisper 에러: " + sttData.error.message);

        const userSpeech = sttData.text;

        // 2. 고퀄리티 분석을 위한 전문적인 프롬프트 설계
        const systemRole = `You are an expert English speaking coach. 
        Your task is to analyze the user's spoken English for the topic: "${topic}".
        Focus on naturalness, professional vocabulary, and nuanced expressions.`;

        const instruction = `
        1. Evaluate the transcription: "${userSpeech}"
        2. Provide a total score (0-100) based on grammar, fluency, and vocabulary.
        3. Break down the speech into sentences and for each sentence provide:
           - "orig": The original sentence from the transcript.
           - "better_en": A much more natural, native-like version.
           - "better_ko": A natural Korean translation.
           - "explanation": A detailed explanation (in Korean) about why the original was awkward and what nuance the improved version adds. 
        4. If the sentence was already perfect, suggest a more sophisticated 'Elite' level alternative.
        
        Return the result strictly in JSON format.`;

        // 3. GPT-4o-mini 분석 (디테일한 피드백 생성)
        const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o-mini", // 비용 효율과 성능 모두 훌륭합니다.
                messages: [
                    { role: "system", content: systemRole },
                    { role: "user", content: instruction }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7 // 너무 뻔하지 않은 다양한 표현을 유도합니다.
            })
        });

        const gptData = await gptResponse.json();
        if (gptData.error) throw new Error("GPT 에러: " + gptData.error.message);

        const feedback = JSON.parse(gptData.choices[0].message.content);

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
