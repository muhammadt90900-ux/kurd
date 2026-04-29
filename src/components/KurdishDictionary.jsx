[4/29/2026 6:19 PM] خۆم: import { useState, useRef, useEffect } from "react";

export default function KurdishDictionary() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const detectLanguage = (text) => {
    if (!text) return "ku";
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F]/;
    const arabicChars = (text.match(arabicPattern) || []).length;
    const totalChars = text.replace(/\s/g, "").length;
    if (totalChars === 0) return "ku";
    return arabicChars / totalChars > 0.3 ? "ku" : "en";
  };

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const sourceLang = detectLanguage(query);
      const langPair = sourceLang === "ku" ? "ckb|en" : "en|ckb";
      const direction = sourceLang === "ku" ? "ku-en" : "en-ku";

      const apiUrl = https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=${langPair}&mt=1;

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.responseStatus !== 200) {
        throw new Error(data.responseDetails || "وەرگێڕان شکستی هێنا");
      }

      const translatedText = data.responseData.translatedText;

      const parsedResult = {
        word: query,
        translation: translatedText,
        transliteration: null,
        partOfSpeech: null,
        definition: null,
        examples: [],
        direction: direction,
      };

      setResult(parsedResult);
      setHistory(prev => [{ query, result: parsedResult }, ...prev.slice(0, 4)]);
    } catch (err) {
      setError("کێشەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") search();
  };

  const isKurdishDir = result?.direction === "ku-en";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #12131f 50%, #0d1117 100%)",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#e8e0d0",
      padding: "0",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 20% 20%, rgba(180,140,60,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(100,160,200,0.05) 0%, transparent 60%)",
      }} />

      <div style={{
        height: "4px",
        background: "linear-gradient(90deg, transparent, #c9a84c, #e8c87a, #c9a84c, transparent)",
      }} />

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{
            display: "inline-block",
            border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: "2px",
            padding: "6px 20px",
            marginBottom: "16px",
            fontSize: "11px",
            letterSpacing: "4px",
            textTransform: "uppercase",
            color: "#c9a84c",
            background: "rgba(201,168,76,0.05)",
          }}>
            فەرهەنگی زیرەک · Smart Dictionary
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 6vw, 46px)",
            fontWeight: "400",
            letterSpacing: "-0.5px",
            margin: "0 0 8px",
            background: "linear-gradient(135deg, #f0e6cc 0%, #c9a84c 50%, #e8c87a 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
[4/29/2026 6:19 PM] خۆم: backgroundClip: "text",
            lineHeight: 1.2,
          }}>
            کوردی · English
          </h1>
          <p style={{ color: "rgba(232,224,208,0.45)", fontSize: "14px", margin: 0 }}>
            وشەیەکت بنووسە — زمانەکەت ئۆتۆماتیکی دەناسرێت
          </p>
        </div>

        <div style={{ position: "relative", marginBottom: "32px" }}>
          <div style={{
            display: "flex",
            gap: "0",
            border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: "4px",
            overflow: "hidden",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 0 0 1px rgba(201,168,76,0.05), 0 4px 24px rgba(0,0,0,0.3)",
            transition: "box-shadow 0.3s",
          }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="وشە بنووسە · Type a word..."
              style={{
                flex: 1,
                padding: "18px 24px",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#e8e0d0",
                fontSize: "18px",
                fontFamily: "inherit",
                letterSpacing: "0.3px",
              }}
            />
            <button
              onClick={search}
              disabled={loading || !query.trim()}
              style={{
                padding: "18px 28px",
                background: loading ? "rgba(201,168,76,0.15)" : "rgba(201,168,76,0.2)",
                border: "none",
                borderLeft: "1px solid rgba(201,168,76,0.2)",
                color: "#c9a84c",
                cursor: loading ? "wait" : "pointer",
                fontSize: "20px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "64px",
              }}
            >
              {loading ? (
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span>
              ) : "⟶"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: "16px 20px",
            background: "rgba(220,60,60,0.1)",
            border: "1px solid rgba(220,60,60,0.3)",
            borderRadius: "4px",
            color: "#f08080",
            marginBottom: "24px",
            fontSize: "14px",
          }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{
            border: "1px solid rgba(201,168,76,0.2)",
            borderRadius: "4px",
            overflow: "hidden",
            background: "rgba(255,255,255,0.02)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            marginBottom: "32px",
            animation: "fadeUp 0.4s ease",
          }}>
            <div style={{
              padding: "24px 28px 20px",
              borderBottom: "1px solid rgba(201,168,76,0.12)",
              background: "rgba(201,168,76,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "28px", fontWeight: "400", marginBottom: "6px", color: "#f0e6cc" }}>
                    {result.word}
                  </div>
                  {result.transliteration && (
                    <div style={{ fontSize: "13px", color: "rgba(201,168,76,0.6)", fontStyle: "italic" }}>
                      /{result.transliteration}/
                    </div>
                  )}
                </div>
                <span style={{
[4/29/2026 6:19 PM] خۆم: fontSize: "11px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "#c9a84c",
                  background: "rgba(201,168,76,0.1)",
                  border: "1px solid rgba(201,168,76,0.2)",
                  padding: "4px 10px",
                  borderRadius: "2px",
                  alignSelf: "flex-start",
                  marginTop: "4px",
                }}>
                  {result.partOfSpeech || "وشە"}
                </span>
              </div>
            </div>

            <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "rgba(232,224,208,0.35)", marginBottom: "10px" }}>
                وەرگێڕان · Translation
              </div>
              <div style={{ fontSize: "26px", color: "#c9a84c", fontWeight: "400" }}>
                {result.translation}
              </div>
            </div>

            {result.definition && (
              <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "rgba(232,224,208,0.35)", marginBottom: "10px" }}>
                  مانا · Definition
                </div>
                <p style={{ margin: 0, color: "rgba(232,224,208,0.75)", fontSize: "15px", lineHeight: 1.7 }}>
                  {result.definition}
                </p>
              </div>
            )}

            {result.examples?.length > 0 && (
              <div style={{ padding: "20px 28px" }}>
                <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "rgba(232,224,208,0.35)", marginBottom: "14px" }}>
                  نموونەکان · Examples
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {result.examples.map((ex, i) => (
                    <div key={i} style={{
                      borderLeft: "2px solid rgba(201,168,76,0.3)",
                      paddingLeft: "16px",
                    }}>
                      <div style={{ fontSize: "15px", color: "#e8e0d0", marginBottom: "4px" }}>{ex.source}</div>
                      <div style={{ fontSize: "14px", color: "rgba(201,168,76,0.7)", fontStyle: "italic" }}>{ex.translation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {history.length > 1 && (
          <div>
            <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "rgba(232,224,208,0.25)", marginBottom: "12px" }}>
              مێژووی گەڕان · Recent
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {history.slice(1).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(h.query); setResult(h.result); }}
                  style={{
                    padding: "6px 14px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(201,168,76,0.15)",
                    borderRadius: "2px",
                    color: "rgba(232,224,208,0.5)",
                    cursor: "pointer",
                    fontSize: "13px",
                    transition: "all 0.2s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = "rgba(201,168,76,0.4)"; e.target.style.color = "#c9a84c"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "rgba(201,168,76,0.15)"; e.target.style.color = "rgba(232,224,208,0.5)"; }}
                >
                  {h.query}
                </button>
              ))}
            </div>
          </div>
        )}
[4/29/2026 6:19 PM] خۆم: {!result && !loading && (
          <div style={{ marginTop: "8px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "rgba(232,224,208,0.2)", marginBottom: "12px" }}>
              نموونەکان · Try these
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {["خۆشەویستی", "mountain", "ئازادی", "knowledge", "ئاو", "friendship"].map(w => (
                <button
                  key={w}
                  onClick={() => { setQuery(w); }}
                  style={{
                    padding: "7px 16px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(201,168,76,0.12)",
                    borderRadius: "2px",
                    color: "rgba(232,224,208,0.4)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = "rgba(201,168,76,0.35)"; e.target.style.color = "#c9a84c"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "rgba(201,168,76,0.12)"; e.target.style.color = "rgba(232,224,208,0.4)"; }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::placeholder { color: rgba(232,224,208,0.2) !important; }
        input { caret-color: #c9a84c; }
      }</style>
    </div>
  );
}
