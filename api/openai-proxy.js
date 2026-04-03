export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { audio, topic } = req.body;
    const API_KEY = process.env.OPENAI_API_KEY;

    try {
        const audioBuffer = Buffer.from(audio, 'base64');
        const blob = new Blob([audioBuffer], { type: 'audio/m4a' });
        const formData = new FormData();
        formData.append('file', blob, 'audio.m4a');
        formData.append('model', 'whisper-1');

        const sttResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: formData
        });
        const sttData = await sttResponse.json();
        const userSpeech = sttData.text;

        const instruction = `Evaluate transcription: "${userSpeech}" for topic: "${topic}". Return JSON ONLY: {"total_score": 0-100, "sentences": [{"orig": "...", "better_en": "...", "better_ko": "...", "explanation": "..."}]}`;

        const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: instruction }],
                response_format: { type: "json_object" }
            })
        });
        const gptData = await gptResponse.json();
        const feedback = JSON.parse(gptData.choices[0].message.content);

        res.status(200).json({ ...feedback, user_speech: userSpeech });
    } catch (e) { res.status(500).json({ error: e.message }); }
}
