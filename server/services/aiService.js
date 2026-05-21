const axios = require('axios');

const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-26b-a4b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openrouter/free'
];

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const EXPLAIN_MODE_INSTRUCTIONS = {
  lawyer: 'Use professional legal terminology. Write detailed legal analysis with precise legal reasoning. Reference relevant legal concepts. Assume the reader is a legal professional.',
  normal: 'Use everyday language that a normal person can understand. Explain legal concepts simply without dumbing down the content. Balance clarity with accuracy.',
  teen: 'Use very simple, conversational language as if explaining to an 18-year-old. Keep sentences short. Use modern, easy vocabulary. Avoid all jargon. Make it feel like a friend explaining.',
  village: 'Use extremely basic, simple language. Avoid ALL legal jargon and complex words. Use very short sentences. Explain as if talking to someone with limited formal education. Use analogies from daily village life. Be warm and respectful.',
  business: 'Focus on financial risks, liability exposure, monetary impact, and business consequences. Use business terminology. Emphasize what matters for an entrepreneur or business owner. Highlight clauses that could cost money.',
};

function buildPrompt(text, language, explainMode = 'normal') {
  const truncatedText = text ? text.substring(0, 10000) : '';
  const modeInstruction = EXPLAIN_MODE_INSTRUCTIONS[explainMode] || EXPLAIN_MODE_INSTRUCTIONS.normal;
  return `
You are an expert legal assistant.

Analyze this legal document carefully.

${modeInstruction}

Return output in EXACTLY this JSON format:
{
  "simpleSummary": "Simple Summary here",
  "importantClauses": [{"clause": "exact quote", "explanation": "simple explanation"}],
  "dangerousClauses": [{"clause": "exact quote", "explanation": "why it's dangerous"}],
  "hiddenFinancialRisks": [{"clause": "exact quote", "explanation": "financial risk explanation"}],
  "questionsToAsk": ["question 1", "question 2"],
  "negotiationSuggestions": ["suggestion 1"],
  "trustScore": 85,
  "severityAnalysis": "High/Medium/Low",
  "riskScore": 15
}

IMPORTANT:
- Output only valid JSON.
- Do not hallucinate.
- Quote exact clause before explanation.
- If uncertain, say uncertain.
- Keep explanations human-friendly.
- Detect risky patterns.
- Identify hidden penalties.
- Explain in ${language}.

Document text:
"""
${truncatedText}
"""
`;
}

function parseAIResponse(rawContent) {
  let content = rawContent.trim();

  if (content.startsWith('```json')) {
    content = content.substring(7);
  } else if (content.startsWith('```')) {
    content = content.substring(3);
  }
  if (content.endsWith('```')) {
    content = content.substring(0, content.length - 3);
  }

  const trimmed = content.trim();
  return JSON.parse(trimmed);
}

async function tryModel(model, prompt) {
  console.log(`AI Service: Trying model: ${model}`);
  console.time(`AI_${model}`);
  
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.CLIENT_URL,
          'X-Title': 'Legalyn'
        },
        timeout: 120000
      }
    );

    console.timeEnd(`AI_${model}`);
    return response;
  } catch (error) {
    console.timeEnd(`AI_${model}`);
    throw error;
  }
}

const analyzeLegalDocument = async (text, language = 'English', explainMode = 'normal') => {
  console.log(`AI Service: Analyzing with mode=${explainMode}, language=${language}`);
  const prompt = buildPrompt(text, language, explainMode);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    for (const model of MODELS) {
      try {
        console.log(`AI Service: Attempt ${attempt}/${MAX_RETRIES} with model: ${model}`);
        const response = await tryModel(model, prompt);

        const rawContent = response.data.choices[0].message.content.trim();
        console.log(`AI Service: Model ${model} responded (${rawContent.length} chars)`);

        const parsed = parseAIResponse(rawContent);
        console.log(`AI Service: Analysis complete, riskScore:`, parsed.riskScore);
        return parsed;

      } catch (error) {
        lastError = error;

        if (error.response) {
          const status = error.response.status;
          const errorData = error.response.data;
          console.error(`AI Service: Model ${model} failed with status ${status}:`,
            errorData?.error?.message || JSON.stringify(errorData).substring(0, 200));

          // 429 = rate limited, retry with backoff
          if (status === 429) {
            console.log(`AI Service: Rate limited on ${model}, will retry...`);
            continue;
          }

          // 4xx other than 429 = model unavailable, try next
          if (status >= 400 && status < 500 && status !== 429) {
            console.log(`AI Service: Model ${model} unavailable (${status}), trying next model...`);
            continue;
          }

          // 5xx = server error, retry attempt
          if (status >= 500) {
            console.log(`AI Service: Server error on ${model}, will retry...`);
            continue;
          }
        } else if (error.code === 'ECONNABORTED') {
          console.error(`AI Service: Timeout on ${model}`);
          continue;
        } else {
          console.error(`AI Service: Network error on ${model}:`, error.message);
          continue;
        }
      }
    }

    // Exponential backoff before next retry round
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      console.log(`AI Service: Waiting ${delay}ms before retry ${attempt + 1}...`);
      await sleep(delay);
    }
  }

  // All models exhausted
  if (lastError?.response) {
    throw new Error(
      `AI analysis failed after ${MAX_RETRIES} attempts across ${MODELS.length} models. ` +
      `Last error: ${lastError.response.data?.error?.message || `HTTP ${lastError.response.status}`}`
    );
  }
  throw new Error(
    `AI analysis failed after ${MAX_RETRIES} attempts across ${MODELS.length} models. ` +
    `Last error: ${lastError?.message || 'Unknown error'}`
  );
};

const TRANSLATION_CACHE = new Map();

const translateAnalysis = async (analysis, targetLanguage) => {
  const cacheKey = `${targetLanguage}_${JSON.stringify(analysis).substring(0, 200)}`;
  if (TRANSLATION_CACHE.has(cacheKey)) {
    console.log(`Translation: Cache hit for ${targetLanguage}`);
    return TRANSLATION_CACHE.get(cacheKey);
  }

  const prompt = `
You are a legal document translator.

Translate the following legal analysis into ${targetLanguage}.

CRITICAL RULES:
- Preserve ALL legal meaning and intent
- Use simple, natural ${targetLanguage} that common people understand
- Keep the exact same JSON structure — do NOT change keys
- Translate only the VALUES, not the keys
- If a legal term has no direct translation, explain it briefly in parentheses
- Output ONLY valid JSON, no extra text

Original analysis JSON to translate:
${JSON.stringify(analysis, null, 2)}
`;

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    for (const model of MODELS) {
      try {
        console.log(`Translation: Attempt ${attempt}/${MAX_RETRIES} with ${model} for ${targetLanguage}`);
        const response = await tryModel(model, prompt);
        const rawContent = response.data.choices[0].message.content.trim();
        console.log(`Translation: Model ${model} responded (${rawContent.length} chars)`);

        let content = rawContent;
        if (content.startsWith('```json')) content = content.substring(7);
        else if (content.startsWith('```')) content = content.substring(3);
        if (content.endsWith('```')) content = content.substring(0, content.length - 3);

        const parsed = JSON.parse(content.trim());
        TRANSLATION_CACHE.set(cacheKey, parsed);
        // Clear old cache entries if too many
        if (TRANSLATION_CACHE.size > 100) {
          const firstKey = TRANSLATION_CACHE.keys().next().value;
          TRANSLATION_CACHE.delete(firstKey);
        }
        console.log(`Translation: Complete for ${targetLanguage}`);
        return parsed;
      } catch (error) {
        lastError = error;
        if (error.response) {
          const status = error.response.status;
          if (status === 429) continue;
          if (status >= 400 && status < 500 && status !== 429) continue;
          if (status >= 500) continue;
        } else if (error.code === 'ECONNABORTED') {
          continue;
        }
      }
    }
    if (attempt < MAX_RETRIES) {
      await sleep(BASE_DELAY * Math.pow(2, attempt - 1));
    }
  }

  throw new Error(
    `Translation failed for ${targetLanguage} after ${MAX_RETRIES} attempts. ` +
    `Last error: ${lastError?.response?.data?.error?.message || lastError?.message || 'Unknown'}`
  );
};

module.exports = { analyzeLegalDocument, translateAnalysis };
