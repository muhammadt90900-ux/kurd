import { useState, useRef, useEffect } from "react";

// ==================== 🔐 تەنها ئەم هێڵە بگۆڕە بۆ کلیدی ڕاستەقینەی Groq ====================
const HARDCODED_GROQ_API_KEY = "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"; // <-- کلیدی خۆت لێرە دابنێ
// =====================================================================

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const detectLanguage = (text) => {
  if (!text) return "ku";
  const ar = (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
  const total = text.replace(/\s/g, "").length;
  return total === 0 ? "ku" : ar / total > 0.3 ? "ku" : "en";
};

const translateWord = async (word, lang) => {
  const pair = lang === "ku" ? "ckb|en" : "en|ckb";
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${pair}&mt=1`);
  const data = await res.json();
  return data.responseData.translatedText;
};

const fetchExamplesFromGroq = async (word, isKu) => {
  // بەکارهێنانی کلیدی جێگیری کراو (hardcoded)
  if (!HARDCODED_GROQ_API_KEY || HARDCODED_GROQ_API_KEY === "gsk_YOUR_REAL_API_KEY_HERE") {
    throw new Error("Please set your real Groq API key inside the code (HARDCODED_GROQ_API_KEY)");
  }

  const systemPrompt = isKu
    ? "تۆ پسپۆڕی زمانی کوردی سۆرانی. تەنها JSON بگەڕێنەوە، هیچ دەقێکی تر. فۆرمات: [{\"ku\":\"ڕستەی کوردی\",\"en\":\"English sentence\"}]"
    : "You are a Kurdish Sorani language expert. Return ONLY JSON, no extra text. Format: [{\"ku\":\"Kurdish Sorani sentence\",\"en\":\"English sentence\"}]";

  const userPrompt = isKu
    ? `بۆ وشەی کوردی "${word}"، تکایە ٢ ڕستەی نمونە بەم فۆرماتە بدەرێت.`
    : `For the English word "${word}", give 2 example sentences in JSON format.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HARDCODED_GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content;
  const cleaned = content.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
};

const SUGGESTIONS = ["خۆشەویستی", "mountain", "ئازادی", "friendship", "ئاو", "wisdom"];

// ==================== ستایلەکانی هەڵبژاردنی ڕووکار (لە سەرەوەی دەستەڕاست) ====================
const SIDEBAR_THEMES_CSS = `
  .theme-sidebar {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 10000;
    display: flex;
    gap: 12px;
    background: rgba(20, 20, 30, 0.7);
    backdrop-filter: blur(12px);
    border-radius: 48px;
    padding: 8px 12px;
    border: 1px solid rgba(255,255,255,0.2);
    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
  }

  .theme-btn {
    width: 44px;
    height: 44px;
    border-radius: 40px;
    border: none;
    font-size: 24px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  .theme-btn.classic { background: #f4ead0; color: #6b1a1a; }
  .theme-btn.modern { background: #0d0f14; color: #00e5c8; }
  .theme-btn.garden { background: #d8f3dc; color: #1a3a2a; }
  .theme-btn.golden { background: #f5efe2; color: #c8922a; }

  .theme-btn.active { transform: scale(1.2); box-shadow: 0 0 0 2px white, 0 0 0 4px currentColor; }
  .theme-btn:hover { transform: scale(1.08); }

  @media (max-width: 640px) {
    .theme-sidebar { top: auto; bottom: 20px; right: 20px; flex-direction: row; border-radius: 60px; padding: 8px 12px; gap: 8px; }
    .theme-btn { width: 38px; height: 38px; font-size: 20px; }
  }
`;

// ==================== Theme 1: Classic CSS (بەهەمان شێوە) ====================
const classicCSS = `/* ... کۆدی کلاسیک لە وەڵامی پێشوو نووسرابوو، بەهەمان شێوە */ 
  ... (بۆ کورتی، هەمان classicCSSی پێشوو) ... `;

// ==================== Theme 2: Modern CSS ====================
const modernCSS = `/* ... هەمان کۆدی پێشوو ... */`;

// ==================== Theme 3: Garden CSS ====================
const gardenCSS = `/* ... */`;

// ==================== Theme 4: Golden CSS ====================
const goldenCSS = `/* ... */`;

// ==================== هەموو تیمەکان ====================
const THEMES = [
  { id: "classic", label: "📜" },
  { id: "modern",  label: "⚡"  },
  { id: "garden",  label: "🌿"  },
  { id: "golden",  label: "✦"   },
];

// ==================== کۆمپۆنێنتی سەرەکی ====================
export default function KurdishDictionaryAllThemes() {
  const [theme, setTheme] = useState("classic");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [examples, setExamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exLoading, setExLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [theme]);

  // Live search with debounce
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (query.trim() === "") return;
    debounceTimer.current = setTimeout(() => {
      doSearch(query);
    }, 500);
    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  const doSearch = async (word) => {
    if (!word.trim()) return;
    setLoading(true); setError(null); setResult(null); setExamples([]);
    try {
      const lang = detectLanguage(word);
      const translation = await translateWord(word, lang);
      const res = { word, translation, isKu: lang === "ku" };
      setResult(res);
      setHistory(prev => [word, ...prev.filter(h => h !== word)].slice(0, 5));
      setLoading(false);
      setExLoading(true);
      try {
        const exs = await fetchExamplesFromGroq(word, lang === "ku");
        setExamples(exs);
      } catch (err) {
        console.warn("Examples error:", err);
        setExamples([]);
        setError(err.message);
      } finally {
        setExLoading(false);
      }
    } catch (err) {
      setError("کێشەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.");
      setLoading(false);
    }
  };

  const CSS_MAP = { classic: classicCSS, modern: modernCSS, garden: gardenCSS, golden: goldenCSS };
  const isKu = result?.isKu;

  return (
    <>
      <style>{SIDEBAR_THEMES_CSS}</style>
      <style>{CSS_MAP[theme]}</style>

      <div className="theme-sidebar">
        {THEMES.map(t => (
          <button
            key={t.id}
            className={`theme-btn ${t.id} ${theme === t.id ? 'active' : ''}`}
            onClick={() => setTheme(t.id)}
            title={`گۆڕین بۆ ڕووکاری ${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* هەموو Theme̸کان بە هەمان شێوەی جاران، بەڵام بەبێ مۆدالی کلید */}
      {theme === "classic" && ( /* ... هەمان بلۆکی classic ... */ )}
      {theme === "modern" && ( /* ... */ )}
      {theme === "garden" && ( /* ... */ )}
      {theme === "golden" && ( /* ... */ )}
    </>
  );
}
