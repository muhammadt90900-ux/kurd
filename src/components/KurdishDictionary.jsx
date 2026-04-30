import { useState, useRef, useEffect } from "react";

// ==================== URLی پشت ئێند (Google Apps Script) ====================
// پاش بڵاوکردنەوەی Apps Script، ئەم URL-ەی خوارەوە بە URLەکەی خۆت بگۆڕە
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxS7BIMzrMGSWQhN7c9y8qg09fjGOolRI5FiX2jtryNyL4XSRWpfxoY7hg_YB697wSj/exec";

// ==================== ستایلەکان (هەمان ستایلی خۆت، تەنها کورتکراوە) ====================
const style = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&family=Noto+Naskh+Arabic:wght@400;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #1a1209;
    --ink2: #2d2010;
    --paper: #faf6ee;
    --paper2: #f3ead8;
    --paper3: #ede0c4;
    --amber: #b8861b;
    --amber-light: #d4a63a;
    --amber-pale: #f0d898;
    --amber-faint: rgba(184,134,27,0.08);
    --amber-border: rgba(184,134,27,0.22);
    --rust: #8b3a1a;
    --muted: rgba(26,18,9,0.45);
    --faint: rgba(26,18,9,0.18);
    --radius: 2px;
  }

  body { background: var(--paper); }

  ::selection { background: var(--amber-pale); color: var(--ink); }
  ::placeholder { color: var(--faint) !important; }
  input { caret-color: var(--amber); }

  .kd-root {
    min-height: 100vh;
    background: var(--paper);
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23b8861b' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    font-family: 'DM Sans', sans-serif;
    color: var(--ink);
    position: relative;
    overflow-x: hidden;
  }

  .kd-topbar {
    height: 3px;
    background: linear-gradient(90deg, var(--rust) 0%, var(--amber) 40%, var(--amber-light) 60%, var(--amber) 80%, var(--rust) 100%);
  }

  .kd-grain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-size: 200px;
  }

  .kd-wrap {
    max-width: 700px;
    margin: 0 auto;
    padding: 64px 28px 100px;
    position: relative;
    z-index: 1;
  }

  .kd-header {
    text-align: center;
    margin-bottom: 56px;
    position: relative;
  }

  .kd-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 10px;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: var(--amber);
    font-weight: 500;
    margin-bottom: 18px;
  }
  .kd-eyebrow::before, .kd-eyebrow::after {
    content: '';
    display: block;
    width: 28px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--amber));
  }
  .kd-eyebrow::after { transform: scaleX(-1); }

  .kd-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(36px, 7vw, 62px);
    font-weight: 700;
    color: var(--ink);
    line-height: 1.1;
    margin-bottom: 4px;
    letter-spacing: -1px;
  }

  .kd-title em {
    font-style: italic;
    color: var(--amber);
  }

  .kd-subtitle {
    font-size: 14px;
    color: var(--muted);
    font-weight: 300;
    margin-top: 14px;
    letter-spacing: 0.3px;
  }

  .kd-rule {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 28px;
    color: var(--amber-border);
  }
  .kd-rule::before, .kd-rule::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--amber-border);
  }
  .kd-rule-inner { display: flex; gap: 6px; align-items: center; }
  .kd-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--amber); opacity: 0.5; }
  .kd-dot.big { width: 6px; height: 6px; opacity: 0.7; }

  .kd-search-wrap { position: relative; margin-bottom: 40px; }

  .kd-input-row {
    display: flex;
    background: white;
    border: 1.5px solid var(--paper3);
    box-shadow: 0 2px 0 var(--paper3), 0 12px 48px rgba(26,18,9,0.08);
    transition: border-color 0.25s, box-shadow 0.25s;
    position: relative;
  }
  .kd-input-row:focus-within {
    border-color: var(--amber);
    box-shadow: 0 2px 0 var(--amber-pale), 0 12px 48px rgba(26,18,9,0.12);
  }
  .kd-input-row::before {
    content: '';
    position: absolute;
    top: -4px; left: -4px; right: -4px; bottom: -4px;
    border: 1px solid var(--amber-border);
    pointer-events: none;
  }

  .kd-input {
    flex: 1;
    padding: 22px 28px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--ink);
    font-size: 20px;
    font-family: 'Playfair Display', serif;
    font-weight: 400;
    letter-spacing: 0.2px;
  }

  .kd-btn {
    padding: 22px 30px;
    background: var(--amber);
    border: none;
    color: white;
    cursor: pointer;
    font-size: 18px;
    transition: background 0.2s, transform 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 72px;
    font-weight: 500;
  }
  .kd-btn:hover:not(:disabled) { background: var(--amber-light); }
  .kd-btn:active:not(:disabled) { transform: scale(0.97); }
  .kd-btn:disabled { opacity: 0.35; cursor: default; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinning { display: inline-block; animation: spin 0.8s linear infinite; }

  .kd-error {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: rgba(139,58,26,0.06);
    border-left: 3px solid var(--rust);
    color: var(--rust);
    font-size: 14px;
    margin-bottom: 28px;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .kd-card {
    background: white;
    border: 1.5px solid var(--paper3);
    box-shadow: 0 2px 0 var(--paper3), 0 16px 64px rgba(26,18,9,0.07);
    margin-bottom: 40px;
    animation: slideUp 0.45s cubic-bezier(0.22,1,0.36,1);
    position: relative;
    overflow: hidden;
  }
  .kd-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--amber), var(--amber-light), var(--amber));
  }

  .kd-card-deco {
    position: absolute;
    bottom: 0; right: 0;
    width: 80px; height: 80px;
    opacity: 0.04;
    background: radial-gradient(circle at bottom right, var(--amber) 0%, transparent 70%);
    pointer-events: none;
  }

  .kd-card-head {
    padding: 28px 32px 24px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 14px;
    background: linear-gradient(180deg, rgba(184,134,27,0.03) 0%, transparent 100%);
    border-bottom: 1px solid var(--faint);
  }

  .kd-word {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.5px;
    line-height: 1.2;
  }

  .kd-dir-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 6px;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
  }
  .kd-dir-label::before {
    content: '';
    display: inline-block;
    width: 16px;
    height: 1px;
    background: var(--amber);
    margin-right: 2px;
  }

  .kd-tag {
    font-size: 9px;
    letter-spacing: 3.5px;
    text-transform: uppercase;
    color: var(--amber);
    border: 1px solid var(--amber-border);
    padding: 6px 14px;
    background: var(--amber-faint);
    font-weight: 500;
    align-self: flex-start;
  }

  .kd-section {
    padding: 24px 32px;
    border-bottom: 1px solid var(--faint);
  }
  .kd-section:last-child { border-bottom: none; }

  .kd-label {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
  }
  .kd-label::after { content: ''; flex: 1; height: 1px; background: var(--faint); }

  .kd-translation {
    font-family: 'Playfair Display', serif;
    font-size: 34px;
    color: var(--amber);
    font-weight: 400;
    font-style: italic;
    line-height: 1.25;
  }

  .kd-examples { display: flex; flex-direction: column; gap: 14px; }

  .kd-example {
    padding: 16px 20px;
    background: var(--paper);
    border: 1px solid var(--faint);
    display: flex;
    gap: 16px;
  }

  .kd-ex-num {
    font-family: 'Playfair Display', serif;
    font-size: 11px;
    color: var(--amber);
    font-style: italic;
    min-width: 20px;
    padding-top: 2px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .kd-ex-source { font-size: 15px; color: var(--ink); line-height: 1.7; margin-bottom: 4px; }
  .kd-ex-trans  { font-size: 13px; color: var(--muted); font-style: italic; line-height: 1.6; }

  .kd-loading { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 14px; font-style: italic; }

  .kd-card-skeleton {
    background: white;
    border: 1.5px solid var(--paper3);
    box-shadow: 0 2px 0 var(--paper3), 0 12px 40px rgba(26,18,9,0.06);
    margin-bottom: 40px;
    padding: 32px;
    animation: slideUp 0.35s ease;
  }

  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position: 600px 0; }
  }
  .kd-skel {
    border-radius: 2px;
    background: linear-gradient(90deg, var(--paper2) 0px, var(--paper3) 200px, var(--paper2) 400px);
    background-size: 600px 100%;
    animation: shimmer 1.5s infinite linear;
  }
  .kd-skel-line { height: 12px; margin-bottom: 10px; }
  .kd-skel-big  { height: 36px; width: 50%; margin-bottom: 24px; }

  .kd-suggest-section { margin-bottom: 40px; }

  .kd-section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
  }
  .kd-section-head::before { content: ''; width: 3px; height: 3px; border-radius: 50%; background: var(--amber); flex-shrink: 0; }
  .kd-section-head::after  { content: ''; flex: 1; height: 1px; background: var(--faint); }

  .kd-chips { display: flex; flex-wrap: wrap; gap: 8px; }

  .kd-chip {
    padding: 8px 18px;
    background: white;
    border: 1.5px solid var(--paper3);
    color: var(--ink);
    cursor: pointer;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.18s;
    box-shadow: 0 1px 0 var(--paper3);
  }
  .kd-chip:hover {
    border-color: var(--amber);
    color: var(--amber);
    background: var(--amber-faint);
    box-shadow: 0 2px 0 var(--amber-pale);
  }

  .kd-footer {
    text-align: center;
    padding-top: 40px;
    border-top: 1px solid var(--faint);
    color: var(--muted);
    font-size: 12px;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .kd-footer strong { color: var(--amber); font-weight: 400; }

  @media (max-width: 480px) {
    .kd-wrap { padding: 40px 16px 80px; }
    .kd-card-head, .kd-section { padding-left: 20px; padding-right: 20px; }
    .kd-title { letter-spacing: -0.5px; }
    .kd-translation { font-size: 28px; }
  }
`;

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

  // وەرگرتنی نمونەی ڕستە لە ڕێگەی پشت ئێند (Google Apps Script + Gemini)
  const fetchExamples = async (word, direction) => {
    setExamplesLoading(true);
    setExamples([]);
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, direction })
      });
      const data = await res.json();
      setExamples(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("هەڵە لە وەرگرتنی نمونەکان:", err);
      setExamples([]);
    } finally {
      setExamplesLoading(false);
    }
  };

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
      await fetchExamples(query, direction);
    } catch (err) {
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
