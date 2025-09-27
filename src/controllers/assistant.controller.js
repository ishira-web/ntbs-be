// controllers/assistant.controller.js
import "dotenv/config";

const OPENROUTER_URL   = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

function baseHeaders() {
  return {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL || "http://localhost:5173",
    "X-Title": process.env.APP_NAME || "Health Assistant",
  };
}

/** -------------------------------------------------------
 *  SIMPLE DOMAIN GUARD (health-only)
 *  - broad keyword net incl. synonyms & common misspellings
 *  - checks the latest user message only
 * ------------------------------------------------------ */
const HEALTH_KEYWORDS = [
  // general
  "health","healthy","wellness","medical","medicine","clinical","clinic","hospital","nurse","doctor","physician",
  "symptom","diagnosis","treatment","therapy","side effect","dose","dosage","contraindication","allergy",
  // body systems / conditions
  "heart","cardio","bp","blood pressure","diabetes","sugar","glucose","cholesterol","asthma","copd","arthritis",
  "rheumatology","sle","ra","migraine","headache","fever","cough","flu","cold","infection","antibiotic",
  // blood & hematology ✅
  "blood","blood type","blood group","plasma","platelet","hemoglobin","anemia","transfusion","donor","donation",
  // lifestyle
  "diet","nutrition","calorie","protein","carb","fat","hydration","water","sleep","exercise","workout","fitness",
  "yoga","physio","physiotherapy","rehab","smoking","alcohol","stress","mental","anxiety","depression","mindfulness",
  // women’s & men’s health
  "pregnan","maternal","menstru","period","fertility","prostate","sexual health",
  // labs & vitals
  "lab","test","cbc","esr","crp","vitamin","vitals","pulse","oxygen","spo2","temperature","urine",
  // public health
  "vaccine","immunization","hygiene","sanitation","epidemic","pandemic"
];

function isHealthTopic(text = "") {
  const q = text.toLowerCase();
  return HEALTH_KEYWORDS.some(k => q.includes(k));
}

const REFUSAL_MESSAGE =
  "I’m your health assistant, so I stick to health-related questions only. " +
  "Try asking about topics like:\n\n" +
  "• Symptoms & when to see a doctor\n" +
  "• Fitness & exercise plans\n" +
  "• Diet, hydration, and weight management\n" +
  "• Lab tests (e.g., ESR, CRP) and what they mean\n" +
  "• Managing chronic conditions (e.g., diabetes, arthritis)\n" +
  "• Sleep, stress, and mental well-being\n\n" +
  "For example: “How many liters of water should I drink daily?”, “Is brisk walking enough to lower cholesterol?”, or “What does a high CRP indicate?”";

export async function chatWithAssistant(req, res) {
  try {
    const {
      messages = [],
      temperature = 0.3,
      max_tokens = 600,
      stream = true, // default to streaming for a nice UX
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] is required" });
    }

    const lastUserMsg = [...messages].reverse().find(m => m?.role === "user")?.content || "";

    // Guardrail: block non-health topics with a friendly redirect
    if (!isHealthTopic(lastUserMsg)) {
      if (stream) {
        // Send a minimal OpenAI-style SSE stream with one delta so your frontend shows it nicely
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const chunk = {
          id: "health-guard",
          object: "chat.completion.chunk",
          choices: [{ delta: { content: REFUSAL_MESSAGE } }]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }
      return res.json({
        id: "health-guard",
        object: "chat.completion",
        choices: [{ message: { role: "assistant", content: REFUSAL_MESSAGE } }]
      });
    }

    // Forward to OpenRouter
    const r = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature,
        max_tokens,
        stream
      }),
    });

    if (!stream) {
      const data = await r.json();
      return res.status(r.ok ? 200 : 500).json(data);
    }

    // Stream passthrough
    if (!r.ok || !r.body) {
      const text = await r.text();
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const err = { choices: [{ delta: { content: `Error: ${text || r.statusText}` } }] };
      res.write(`data: ${JSON.stringify(err)}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
    res.end();
  } catch (err) {
    console.error("assistant.chat error:", err);
    return res.status(500).json({ error: "Assistant backend error" });
  }
}
