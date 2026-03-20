// Vercel Serverless Function — Gemini API proxy
// GEMINI_API_KEY lives in Vercel Environment Variables (never exposed to browser)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY not set. Go to Vercel Dashboard → Settings → Environment Variables → add GEMINI_API_KEY'
    });
  }

  try {
    const { messages, system } = req.body;

    // Convert chat history to Gemini format
    const geminiHistory = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const lastMessage = messages[messages.length - 1];

    const geminiBody = {
      system_instruction: {
        parts: [{ text: system }]
      },
      contents: [
        ...geminiHistory,
        {
          role: 'user',
          parts: [{ text: lastMessage.content }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7
      }
    };

    // ✅ FIXED: correct model name for Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `Gemini API error ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';
    return res.status(200).json({ content: text });

  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
