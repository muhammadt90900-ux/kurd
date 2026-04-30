import { useState, useRef, useEffect } from "react";

// ==================== URLی پشت ئێند ====================
// ئەمە URLی پشت ئێندی تۆیە بۆ Gemini، بەڵام ئێمە بە کاری ناهێنین
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzF8IM80SR6QVzrVXCOasnbUO2lUDMcRQdyX7-1Pr7CnTR6e0wSfQL7S_32W6M-Gk/exec";

// ==================== کلیلی API بۆ Groq و Mistral ====================
// تکایە کلیلی خۆتی لێرە دابنێ
// بۆ وەرگرتنی کلیلی Groq: بچۆ بە https://console.groq.com/keys
const GROQ_API_KEY = "";
// بۆ وەرگرتنی کلیلی Mistral: بچۆ بە https://console.mistral.ai/api-keys
const MISTRAL_API_KEY = "YourMistralAPIKeyHere";

// ==================== ستایلەکان (بە هەمان شێوەی خۆت) ====================
const style = `... (هەمان ستایلەکانی پێشووتر، بەڵام بۆ کورتی لێرە هەر وەک خۆیان دەمێننەوە) ...`;

// ==================== فەرمانی یارمەتیدەر بۆ دواکەوتن (Delay) ====================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== کۆمپۆنێنتی سەرەکی ====================
export default function KurdishDictionary() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [examples, setExamples] = useState([]);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // دیاریکردنی زمانی وشەکە
  const detectLanguage = (text) => {
    if (!text) return "ku";
    const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
    const total = text.replace(/\s/g, "").length;
    return total === 0 ? "ku" : arabicChars / total > 0.3 ? "ku" : "en";
  };

  // وەرگێڕان بە MyMemory API (بێ بەرامبەر)
  const translateWord = async (word, sourceLang) => {
    const pair = sourceLang === "ku" ? "ckb|en" : "en|ckb";
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${pair}&mt=1`;
    const res = await fetch(url);
    const data = await res.json();
    return data.responseData.translatedText;
  };

  // ========== Groq API (یەکەم هەوڵ: خێراترین) ==========
  const fetchFromGroq = async (word, isKu) => {
    console.log("📡 هەوڵدەدەم بە Groq...");
    
    const prompt = isKu 
      ? `بۆ وشەی کوردی "${word}"، تکایە ٣ ڕستەی نموونەیی دروست بکە بە شێوەی JSON. تەنها JSON بگەڕێنەوە، هیچ دەقێکی تری زیاد مەکە، بێ هێڵکاری.
      فۆرمات: [{"ku": "...", "en": "..."}]`
      : `For the Kurdish Sorani word "${word}", create 3 example sentences as JSON. Return ONLY valid JSON, no extra text, no markdown.
      Format: [{"en": "...", "ku": "..."}]`;
    
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Groq هەڵەی ${response.status}:`, errorData);
        return null;
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;
      content = content.replace(/```json|```/g, "").trim();
      const examples = JSON.parse(content);
      console.log("✅ Groq سەرکەوتوو بوو!");
      return examples.slice(0, 3);
    } catch (err) {
      console.error("Groq هەڵەی پەیوەندی:", err);
      return null;
    }
  };

  // ========== Mistral API (دووەم هەوڵ) ==========
  const fetchFromMistral = async (word, isKu) => {
    console.log("📡 هەوڵدەدەم بە Mistral...");
    
    const prompt = isKu 
      ? `بۆ وشەی کوردی "${word}"، ٣ ڕستەی نموونەیی دروست بکە بە شێوەی JSON. تەنها JSON: [{"ku":"...","en":"..."}]`
      : `For English word "${word}", create 3 example sentences as JSON. ONLY JSON: [{"en":"...","ku":"..."}]`;
    
    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: "mistral-tiny",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Mistral هەڵەی ${response.status}:`, errorData);
        return null;
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;
      content = content.replace(/```json|```/g, "").trim();
      const examples = JSON.parse(content);
      console.log("✅ Mistral سەرکەوتوو بوو!");
      return examples.slice(0, 3);
    } catch (err) {
      console.error("Mistral هەڵەی پەیوەندی:", err);
      return null;
    }
  };

  // ========== وەرگرتنی نمونە لە چەندین سەرچاوە بە شێوەی زنجیرەیی ==========
  const fetchExamples = async (word, direction) => {
    setExamplesLoading(true);
    setExamples([]);
    
    const isKu = direction === "ku-en";
    
    // ✅ ڕیزبەندی هەوڵەکان: یەکەم Groq، دووەم Mistral، سێیەم Gemini (پشت ئێند)
    const providers = [
      { name: "Groq", fn: () => fetchFromGroq(word, isKu) },
      { name: "Mistral", fn: () => fetchFromMistral(word, isKu) },
      { 
        name: "Gemini", 
        fn: async () => {
          console.log("📡 هەوڵدەدەم بە Gemini (Apps Script)...");
          try {
            const res = await fetch(APPS_SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ word, direction })
            });
            const data = await res.json();
            if (data && !data.error && Array.isArray(data)) {
              console.log("✅ Gemini سەرکەوتوو بوو!");
              return data.slice(0, 3);
            }
            return null;
          } catch (err) {
            console.error("Gemini هەڵەی پەیوەندی:", err);
            return null;
          }
        }
      }
    ];
    
    // هەوڵدان بە ڕیزبەندی
    for (const provider of providers) {
      try {
        const result = await provider.fn();
        if (result && result.length > 0) {
          setExamples(result);
          setExamplesLoading(false);
          return;
        }
        // کەمی دواکەوتن (500ms) پێش هەوڵی دواتر بۆ خێرایی
        await delay(500);
      } catch (err) {
        console.error(`${provider.name} شکستی هێنا:`, err);
      }
    }
    
    // ئەگەر هیچ کامێک سەرکەوتوو نەبوو
    console.log("⚠️ هەموو سەرچاوەکان شکستیان هێنا، نمونەی گشتی پیشان دەدرێت");
    const fallbackExamples = isKu
      ? [{ ku: `بۆ وشەی "${word}" نمونەیەک نەدۆزرایەوە`, en: `No example found for "${word}"` }]
      : [{ en: `No example found for "${word}"`, ku: `بۆ وشەی "${word}" نمونەیەک نەدۆزرایەوە` }];
    setExamples(fallbackExamples);
    setExamplesLoading(false);
  };

  // فەرمانی سەرەکی گەڕان
  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setExamples([]);

    try {
      const sourceLang = detectLanguage(query);
      const direction = sourceLang === "ku" ? "ku-en" : "en-ku";
      const translation = await translateWord(query, sourceLang);
      const newResult = { word: query, translation, direction };
      setResult(newResult);
      setHistory(prev => [{ query, result: newResult }, ...prev.slice(0, 4)]);
      
      // فەرمانی وەرگرتنی نمونەکان (بە شێوەی زنجیرەیی لە چەندین سەرچاوە)
      await fetchExamples(query, direction);
    } catch (err) {
      console.error("هەڵەی گشتی:", err);
      setError("کێشەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.");
    } finally {
      setLoading(false);
    }
  };

  const isKu = result?.direction === "ku-en";

  return (
    <>
      <style>{style}</style>
      <div className="kd-root">
        <div className="kd-grain" />
        <div className="kd-topbar" />
        <div className="kd-wrap">

          <header className="kd-header">
            <div className="kd-eyebrow">فەرهەنگی زیرەک</div>
            <h1 className="kd-title">کوردی <em>&amp;</em> English</h1>
            <p className="kd-subtitle">وشەیەکت بنووسە — زمانەکەت ئۆتۆماتیکی دەناسرێت</p>
            <div className="kd-rule">
              <div className="kd-rule-inner">
                <div className="kd-dot" />
                <div className="kd-dot big" />
                <div className="kd-dot" />
              </div>
            </div>
          </header>

          <div className="kd-search-wrap">
            <div className="kd-input-row">
              <input
                ref={inputRef}
                className="kd-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && search()}
                placeholder="وشە بنووسە · Type a word…"
              />
              <button className="kd-btn" onClick={search} disabled={loading || !query.trim()}>
                {loading ? <span className="spinning">⊙</span> : "→"}
              </button>
            </div>
          </div>

          {error && <div className="kd-error"><span>⚠</span>{error}</div>}

          {loading && (
            <div className="kd-card-skeleton">
              <div className="kd-skel kd-skel-big" />
              <div className="kd-skel kd-skel-line" style={{ width: "80%" }} />
              <div className="kd-skel kd-skel-line" style={{ width: "60%" }} />
              <div className="kd-skel kd-skel-line" style={{ width: "70%" }} />
            </div>
          )}

          {result && !loading && (
            <div className="kd-card">
              <div className="kd-card-deco" />
              <div className="kd-card-head">
                <div>
                  <div className="kd-word">{result.word}</div>
                  <div className="kd-dir-label">
                    {isKu ? "Kurdish Sorani → English" : "English → Kurdish Sorani"}
                  </div>
                </div>
                <div className="kd-tag">وشە · Word</div>
              </div>

              <div className="kd-section">
                <div className="kd-label">وەرگێڕان · Translation</div>
                <div className="kd-translation">{result.translation}</div>
              </div>

              <div className="kd-section">
                <div className="kd-label">نمونەی ڕستەکان · Examples</div>
                {examplesLoading && (
                  <div className="kd-loading">
                    <span className="spinning">⊙</span> نمونەکان دەگەیەنرێن…
                  </div>
                )}
                {!examplesLoading && examples.length > 0 && (
                  <div className="kd-examples">
                    {examples.map((ex, i) => (
                      <div key={i} className="kd-example">
                        <div className="kd-ex-num">{i + 1}.</div>
                        <div>
                          <div className="kd-ex-source">{isKu ? ex.ku : ex.en}</div>
                          <div className="kd-ex-trans">{isKu ? ex.en : ex.ku}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!examplesLoading && examples.length === 0 && (
                  <div style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>
                    نمونەیەک نەدۆزرایەوە
                  </div>
                )}
              </div>
            </div>
          )}

          {history.length > 1 && (
            <div className="kd-suggest-section">
              <div className="kd-section-head">مێژووی گەڕان · Recent</div>
              <div className="kd-chips">
                {history.slice(1).map((h, i) => (
                  <button
                    key={i}
                    className="kd-chip"
                    onClick={() => {
                      setQuery(h.query);
                      setResult(h.result);
                      fetchExamples(h.query, h.result.direction);
                    }}
                  >
                    {h.query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="kd-suggest-section">
              <div className="kd-section-head">تاقی بکەرەوە · Try these</div>
              <div className="kd-chips">
                {["خۆشەویستی", "mountain", "ئازادی", "knowledge", "ئاو", "friendship"].map(w => (
                  <button key={w} className="kd-chip" onClick={() => setQuery(w)}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          <footer className="kd-footer">
            <strong>✦</strong> کوردی · English Dictionary <strong>✦</strong>
          </footer>
        </div>
      </div>
    </>
  );
}
