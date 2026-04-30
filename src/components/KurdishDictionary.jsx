import { useState, useRef, useEffect } from "react";

// ==================== فەرمانە هاوبەشەکان ====================
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const detectLanguage = (text) => {
  if (!text) return "ku";
  const ar = (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
  const total = text.replace(/\s/g, "").length;
  return total === 0 ? "ku" : ar / total > 0.3 ? "ku" : "en";
};

// FIX 1: MyMemory ئیش دەکات بەبێ پاسووەرد — هیچ key پێویست نییە
const translateWord = async (word, lang) => {
  const pair = lang === "ku" ? "ckb|en" : "en|ckb";
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${pair}&mt=1`
  );
  if (!res.ok) throw new Error("MyMemory error");
  const data = await res.json();
  if (!data.responseData?.translatedText) throw new Error("No translation");
  return data.responseData.translatedText;
};

// FIX 2: Groq چاکەی کرد — response_format لابرا (llama3 لەگەڵ json_object نەیتانی)، parsing بەهێزتر
const fetchExamplesFromGroq = async (word, isKu, apiKey) => {
  if (!apiKey) throw new Error("No Groq API Key");

  const systemPrompt = isKu
    ? `تۆ پسپۆڕی زمانی کوردی سۆرانی. تەنها JSON array بگەڕێنەوە، هیچ دەقێکی تر نەیخەرە پێش یان دوای JSON. فۆرمات: [{"ku":"ڕستەی کوردی","en":"English sentence"},{"ku":"ڕستەی کوردی","en":"English sentence"}]`
    : `You are a Kurdish Sorani language expert. Return ONLY a JSON array with no extra text before or after. Format: [{"ku":"Kurdish Sorani sentence","en":"English sentence"},{"ku":"Kurdish Sorani sentence","en":"English sentence"}]`;

  const userPrompt = isKu
    ? `بۆ وشەی کوردی "${word}"، ٢ ڕستەی نمونە بدەرێت.`
    : `For the English word "${word}", give 2 example sentences using it.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 400
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Groq error ${res.status}: ${errData.error?.message || ""}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  // FIX 2b: Robust JSON parsing — سەرچاوەی هەموو کێشەکان
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // Extract JSON array from anywhere in the response
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found in response");

  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("Response is not an array");

  return parsed.slice(0, 2).filter(e => e.ku && e.en);
};

const SUGGESTIONS = ["خۆشەویستی", "mountain", "ئازادی", "friendship", "ئاو", "wisdom"];

// ==================== ستایلی Sidebar و Modal کلیل ====================
// FIX 3: sidebar بۆ سەرەوە دەستەڕاست گوازرایەوە
const SIDEBAR_THEMES_CSS = `
  .theme-sidebar {
    position: fixed;
    right: 16px;
    top: 16px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(20, 20, 30, 0.75);
    backdrop-filter: blur(12px);
    border-radius: 24px;
    padding: 10px 7px;
    border: 1px solid rgba(255,255,255,0.18);
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  }

  .theme-btn {
    width: 40px;
    height: 40px;
    border-radius: 40px;
    border: none;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  .theme-btn.classic { background: #f4ead0; color: #6b1a1a; }
  .theme-btn.modern  { background: #0d0f14; color: #00e5c8; }
  .theme-btn.garden  { background: #d8f3dc; color: #1a3a2a; }
  .theme-btn.golden  { background: #f5efe2; color: #c8922a; }
  .theme-btn.key-btn {
    background: linear-gradient(135deg,#1e1e2f,#2a2a4a) !important;
    color: gold !important;
    border: 1px solid rgba(255,215,0,0.3) !important;
    margin-top: 4px;
  }

  .theme-btn.active {
    transform: scale(1.18);
    box-shadow: 0 0 0 2px white, 0 0 0 4px currentColor;
  }
  .theme-btn:hover:not(.active) { transform: scale(1.08); }

  @media (max-width: 640px) {
    .theme-sidebar {
      top: auto;
      bottom: 16px;
      right: 16px;
      flex-direction: row;
      border-radius: 60px;
      padding: 8px 10px;
      gap: 6px;
    }
    .theme-btn { width: 36px; height: 36px; font-size: 18px; }
    .theme-btn.key-btn { margin-top: 0; margin-right: 4px; }
  }

  /* FIX 4: Key Modal — پاسووەردەکە نەیخوێنرێتەوە */
  .key-modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(6px);
    z-index: 10001;
    display: flex; align-items: center; justify-content: center;
  }
  .key-modal {
    background: #fff;
    padding: 1.8rem 1.5rem;
    border-radius: 24px;
    width: 300px;
    text-align: center;
    direction: rtl;
    font-family: system-ui, sans-serif;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  .key-modal h4 {
    margin: 0 0 0.4rem;
    font-size: 1.1rem;
    color: #1a1a2e;
  }
  .key-modal p {
    font-size: 0.78rem;
    color: #666;
    margin: 0 0 1rem;
    direction: rtl;
  }
  .key-modal-input-wrap {
    position: relative;
    margin: 0 0 1rem;
  }
  .key-modal input {
    width: 100%;
    padding: 9px 14px;
    border: 1.5px solid #ddd;
    border-radius: 40px;
    direction: ltr;
    text-align: left;
    font-size: 0.9rem;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.2s;
  }
  .key-modal input:focus { border-color: #2c7da0; }
  .key-modal-status {
    font-size: 0.72rem;
    color: #2c7da0;
    margin: -0.5rem 0 0.8rem;
    min-height: 1.1em;
  }
  .key-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .key-buttons button {
    padding: 7px 18px;
    border: none;
    border-radius: 30px;
    cursor: pointer;
    font-size: 0.88rem;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .key-btn-save { background: #2c7da0; color: white; }
  .key-btn-clear { background: #e55; color: white; }
  .key-btn-close { background: #eee; color: #444; }
  .key-buttons button:hover { opacity: 0.85; }
  .key-modal small {
    display: block;
    margin-top: 0.9rem;
    font-size: 0.7rem;
    color: #999;
    direction: rtl;
  }
`;

// ==================== Theme 1: Classic CSS ====================
const classicCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,500;0,700;1,500&display=swap');
  .ck-root{--ink:#1a0a00;--parchment:#f4ead0;--parchment-dark:#e8d4a8;--burgundy:#6b1a1a;--gold:#b8860b;--gold-light:#d4a017;--rust:#8b3a1a;--cream:#fdf6e3;--shadow:rgba(26,10,0,0.18);}
  .ck-root{min-height:100vh;background:var(--parchment);background-image:repeating-linear-gradient(0deg,transparent,transparent 28px,rgba(107,26,26,0.05) 28px,rgba(107,26,26,0.05) 29px);font-family:'Amiri','Georgia',serif;direction:rtl;color:var(--ink);padding:0 1rem 4rem;}
  .ck-page{max-width:680px;margin:0 auto;}
  .ck-ornament{text-align:center;padding:1.5rem 0 0.4rem;color:var(--gold);font-size:1.3rem;letter-spacing:0.5rem;}
  .ck-header{text-align:center;padding:1rem 0 1.6rem;border-bottom:2px solid var(--gold);margin-bottom:1.8rem;}
  .ck-title-ku{font-family:'Amiri',serif;font-size:2.4rem;font-weight:700;color:var(--burgundy);text-shadow:1px 1px 0 rgba(184,134,11,0.3);}
  .ck-title-en{font-family:'Playfair Display',serif;font-size:1.05rem;font-style:italic;color:var(--rust);margin-top:0.3rem;letter-spacing:0.05em;}
  .ck-subtitle{font-size:0.82rem;color:var(--gold);margin-top:0.6rem;letter-spacing:0.08em;}
  .ck-search{background:var(--cream);border:1px solid var(--gold);border-top:3px solid var(--burgundy);box-shadow:0 3px 14px var(--shadow);overflow:hidden;margin-bottom:1.5rem;}
  .ck-input-row{display:flex;align-items:stretch;}
  .ck-input{flex:1;background:transparent;border:none;outline:none;font-family:'Amiri',serif;font-size:1.2rem;color:var(--ink);padding:0.9rem 1.1rem;direction:rtl;}
  .ck-input::placeholder{color:#b09060;font-style:italic;}
  .ck-btn{background:var(--burgundy);border:none;color:var(--gold-light);font-family:'Playfair Display',serif;font-size:1rem;padding:0 1.3rem;cursor:pointer;transition:background 0.2s;min-width:56px;}
  .ck-btn:hover:not(:disabled){background:#8b2020;} .ck-btn:disabled{opacity:0.5;cursor:not-allowed;}
  .ck-spinning{display:inline-block;animation:ckspin 1s linear infinite;} @keyframes ckspin{to{transform:rotate(360deg);}}
  .ck-card{background:var(--cream);border:1px solid var(--parchment-dark);border-top:3px solid var(--burgundy);box-shadow:0 4px 18px var(--shadow);padding:1.5rem 1.7rem;margin-bottom:1.5rem;position:relative;animation:ckslide 0.3s ease;}
  @keyframes ckslide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .ck-corner{position:absolute;top:8px;left:12px;color:var(--gold);font-size:1rem;opacity:0.5;}
  .ck-word{font-family:'Amiri',serif;font-size:2rem;font-weight:700;color:var(--burgundy);}
  .ck-dir-label{font-size:0.75rem;color:var(--gold);font-style:italic;letter-spacing:0.06em;font-family:'Playfair Display',serif;direction:ltr;text-align:right;}
  .ck-divider{border:none;border-top:1px dashed var(--gold);margin:0.9rem 0;opacity:0.6;}
  .ck-label{font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--gold);margin-bottom:0.5rem;font-family:'Playfair Display',serif;direction:ltr;}
  .ck-translation{font-family:'Playfair Display',serif;font-size:1.45rem;font-style:italic;color:var(--ink);}
  .ck-examples{display:flex;flex-direction:column;gap:0.75rem;}
  .ck-example{display:flex;gap:0.75rem;padding:0.65rem 0.85rem;background:rgba(184,134,11,0.06);border-right:3px solid var(--gold);}
  .ck-ex-num{font-family:'Amiri',serif;color:var(--gold);font-size:0.95rem;min-width:18px;flex-shrink:0;}
  .ck-ex-ku{font-family:'Amiri',serif;font-size:1rem;color:var(--ink);line-height:1.55;}
  .ck-ex-en{font-family:'Playfair Display',serif;font-size:0.82rem;font-style:italic;color:var(--rust);margin-top:3px;direction:ltr;}
  .ck-loading{color:var(--rust);font-size:0.88rem;font-style:italic;padding:0.4rem 0;}
  .ck-chips-section{margin-bottom:1.5rem;}
  .ck-chips-head{font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--gold);margin-bottom:0.7rem;font-family:'Playfair Display',serif;direction:ltr;}
  .ck-chips{display:flex;flex-wrap:wrap;gap:0.5rem;}
  .ck-chip{font-family:'Amiri',serif;font-size:1rem;padding:0.35rem 0.9rem;border:1px solid var(--parchment-dark);background:var(--cream);color:var(--ink);cursor:pointer;transition:all 0.18s;}
  .ck-chip:hover{background:var(--burgundy);color:var(--gold-light);border-color:var(--burgundy);}
  .ck-error{background:#fff0f0;border:1px solid #c8a0a0;color:#7a2020;padding:0.75rem 1rem;font-size:0.88rem;margin-bottom:1rem;}
  .ck-footer{text-align:center;color:var(--gold);font-family:'Playfair Display',serif;font-size:0.78rem;font-style:italic;padding-top:1.5rem;border-top:1px solid var(--parchment-dark);letter-spacing:0.1em;}
  .ck-skel{background:linear-gradient(90deg,var(--parchment-dark) 25%,var(--parchment) 50%,var(--parchment-dark) 75%);background-size:200% 100%;animation:ckshimmer 1.4s infinite;border-radius:1px;margin-bottom:0.6rem;}
  @keyframes ckshimmer{to{background-position:-200% 0;}}
  .ck-no-key{font-size:0.8rem;color:var(--gold);font-style:italic;padding:0.3rem 0;}
`;

// ==================== Theme 2: Modern CSS ====================
const modernCSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap');
  .md-root{--bg:#0d0f14;--surface:#151820;--surface2:#1c2030;--border:#2a2f3e;--teal:#00e5c8;--teal-dim:rgba(0,229,200,0.12);--teal-glow:rgba(0,229,200,0.25);--text:#e8ecf4;--muted:#5a6078;--accent2:#ff6b6b;--white:#ffffff;}
  .md-root{min-height:100vh;background:var(--bg);background-image:radial-gradient(ellipse at 20% 0%,rgba(0,229,200,0.06) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(0,150,180,0.05) 0%,transparent 60%);font-family:'IBM Plex Sans Arabic',sans-serif;direction:rtl;color:var(--text);padding:0 1rem 4rem;}
  .md-topstrip{height:3px;background:linear-gradient(90deg,transparent,var(--teal),transparent);}
  .md-page{max-width:660px;margin:0 auto;}
  .md-header{padding:2.2rem 0 1.8rem;display:flex;flex-direction:column;gap:0.5rem;}
  .md-badge{display:inline-flex;align-items:center;gap:0.4rem;background:var(--teal-dim);border:1px solid rgba(0,229,200,0.3);color:var(--teal);font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.12em;padding:0.22rem 0.65rem;border-radius:100px;width:fit-content;direction:ltr;}
  .md-badge::before{content:'●';font-size:0.45rem;animation:mdpulse 2s infinite;} @keyframes mdpulse{0%,100%{opacity:1}50%{opacity:0.3}}
  .md-title{font-family:'Syne',sans-serif;font-size:2.5rem;font-weight:800;color:var(--white);letter-spacing:-0.03em;line-height:1.1;direction:ltr;}
  .md-title span{color:var(--teal);}
  .md-subtitle{color:var(--muted);font-size:0.88rem;font-weight:300;margin-top:0.1rem;}
  .md-search{margin:0.5rem 0 1.8rem;}
  .md-input-row{display:flex;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color 0.2s,box-shadow 0.2s;}
  .md-input-row:focus-within{border-color:var(--teal);box-shadow:0 0 0 3px var(--teal-glow);}
  .md-input{flex:1;background:transparent;border:none;outline:none;font-family:'IBM Plex Sans Arabic',sans-serif;font-size:1rem;color:var(--text);padding:0.95rem 1.1rem;direction:rtl;}
  .md-input::placeholder{color:var(--muted);}
  .md-btn{background:var(--teal);border:none;color:var(--bg);font-family:'Syne',sans-serif;font-weight:700;font-size:0.95rem;padding:0 1.4rem;cursor:pointer;transition:all 0.18s;}
  .md-btn:hover:not(:disabled){background:#00ffdd;} .md-btn:disabled{opacity:0.4;cursor:not-allowed;}
  .md-spinning{display:inline-block;animation:mdspin 1s linear infinite;} @keyframes mdspin{to{transform:rotate(360deg);}}
  .md-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:1.5rem;animation:mdfadeup 0.3s ease;}
  @keyframes mdfadeup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .md-card-top{background:var(--surface2);padding:1.1rem 1.4rem;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border);}
  .md-word{font-size:1.9rem;font-weight:600;color:var(--white);line-height:1.2;}
  .md-dir-tag{background:var(--teal-dim);color:var(--teal);font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.08em;padding:0.2rem 0.55rem;border-radius:4px;direction:ltr;flex-shrink:0;margin-top:0.4rem;}
  .md-card-body{padding:1.1rem 1.4rem;}
  .md-section{margin-bottom:1.3rem;} .md-section:last-child{margin-bottom:0;}
  .md-label{font-family:'DM Mono',monospace;font-size:0.6rem;letter-spacing:0.14em;color:var(--muted);text-transform:uppercase;margin-bottom:0.45rem;direction:ltr;}
  .md-translation{font-size:1.35rem;font-weight:500;color:var(--teal);}
  .md-examples{display:flex;flex-direction:column;gap:0.65rem;}
  .md-example{display:grid;grid-template-columns:28px 1fr;gap:0.45rem;padding:0.75rem 0.85rem;background:var(--surface2);border-radius:8px;border:1px solid var(--border);}
  .md-ex-num{font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--teal);padding-top:3px;direction:ltr;}
  .md-ex-ku{font-size:0.92rem;color:var(--text);line-height:1.5;}
  .md-ex-en{font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--muted);margin-top:0.2rem;direction:ltr;}
  .md-loading{color:var(--teal);font-size:0.83rem;padding:0.4rem 0;}
  .md-chips-section{margin-bottom:1.4rem;}
  .md-chips-head{font-family:'DM Mono',monospace;font-size:0.6rem;letter-spacing:0.14em;color:var(--muted);text-transform:uppercase;margin-bottom:0.65rem;direction:ltr;}
  .md-chips{display:flex;flex-wrap:wrap;gap:0.5rem;}
  .md-chip{font-family:'IBM Plex Sans Arabic',sans-serif;font-size:0.88rem;padding:0.3rem 0.8rem;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;transition:all 0.15s;}
  .md-chip:hover{border-color:var(--teal);color:var(--teal);background:var(--teal-dim);}
  .md-error{background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.3);color:var(--accent2);padding:0.75rem 1rem;border-radius:8px;font-size:0.88rem;margin-bottom:1rem;}
  .md-footer{text-align:center;color:var(--muted);font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.1em;padding-top:2rem;direction:ltr;}
  .md-skel{background:linear-gradient(90deg,var(--surface2) 25%,var(--surface) 50%,var(--surface2) 75%);background-size:200% 100%;animation:mdshimmer 1.4s infinite;border-radius:6px;margin-bottom:0.6rem;}
  @keyframes mdshimmer{to{background-position:-200% 0;}}
  .md-no-key{font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--muted);padding:0.3rem 0;}
`;

// ==================== Theme 3: Garden CSS ====================
const gardenCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Josefin+Sans:wght@300;400;600&display=swap');
  .gd-root{--forest:#1a3a2a;--green:#2d6a4f;--green-mid:#40916c;--mint:#74c69d;--pale:#d8f3dc;--cream:#fafaf5;--warm-white:#f5f0e8;--gold:#e9b941;--gold-dim:rgba(233,185,65,0.15);--shadow:rgba(26,58,42,0.15);--text:#1a2e1a;--muted:#5a7a60;}
  .gd-root{min-height:100vh;background:var(--cream);background-image:radial-gradient(circle at 10% 20%,rgba(116,198,157,0.12) 0%,transparent 50%),radial-gradient(circle at 90% 80%,rgba(45,106,79,0.08) 0%,transparent 50%);font-family:'Noto Naskh Arabic',serif;direction:rtl;color:var(--text);padding:0 1rem 4rem;}
  .gd-page{max-width:660px;margin:0 auto;}
  .gd-header{text-align:center;padding:2.2rem 0 1.5rem;}
  .gd-flower{font-size:1.9rem;line-height:1;margin-bottom:0.7rem;display:block;animation:gdsway 4s ease-in-out infinite;} @keyframes gdsway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
  .gd-title{font-family:'Noto Naskh Arabic',serif;font-size:2.4rem;font-weight:700;color:var(--forest);}
  .gd-title-en{font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-style:italic;color:var(--green-mid);margin-top:0.3rem;letter-spacing:0.08em;}
  .gd-rule{display:flex;align-items:center;gap:0.7rem;justify-content:center;margin-top:1rem;}
  .gd-rule-line{flex:1;max-width:80px;height:1px;background:var(--green-mid);opacity:0.4;}
  .gd-rule-flower{color:var(--gold);font-size:0.9rem;}
  .gd-subtitle{color:var(--muted);font-size:0.85rem;margin-top:0.7rem;}
  .gd-search{margin:1.3rem 0 1.6rem;}
  .gd-input-row{display:flex;background:var(--warm-white);border:2px solid var(--mint);border-radius:50px;overflow:hidden;box-shadow:0 4px 20px var(--shadow);transition:box-shadow 0.25s,border-color 0.25s;}
  .gd-input-row:focus-within{border-color:var(--green);box-shadow:0 4px 24px var(--shadow),0 0 0 4px rgba(45,106,79,0.1);}
  .gd-input{flex:1;background:transparent;border:none;outline:none;font-family:'Noto Naskh Arabic',serif;font-size:1.05rem;color:var(--text);padding:0.85rem 1.2rem;direction:rtl;}
  .gd-input::placeholder{color:var(--mint);}
  .gd-btn{background:var(--green);border:none;color:white;font-family:'Josefin Sans',sans-serif;font-weight:600;font-size:0.95rem;padding:0 1.4rem;cursor:pointer;transition:background 0.18s;border-radius:0 50px 50px 0;}
  .gd-btn:hover:not(:disabled){background:var(--forest);} .gd-btn:disabled{opacity:0.45;cursor:not-allowed;}
  .gd-spinning{display:inline-block;animation:gdspin 1s linear infinite;} @keyframes gdspin{to{transform:rotate(360deg);}}
  .gd-card{background:white;border:1px solid rgba(116,198,157,0.4);border-radius:20px;overflow:hidden;margin-bottom:1.5rem;box-shadow:0 6px 30px var(--shadow);animation:gdbloom 0.35s ease;}
  @keyframes gdbloom{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
  .gd-card-head{background:linear-gradient(135deg,var(--forest) 0%,var(--green) 100%);padding:1.2rem 1.5rem;display:flex;justify-content:space-between;align-items:center;}
  .gd-word{font-family:'Noto Naskh Arabic',serif;font-size:1.9rem;font-weight:700;color:white;}
  .gd-dir-badge{background:rgba(255,255,255,0.15);color:var(--pale);font-family:'Josefin Sans',sans-serif;font-size:0.62rem;font-weight:600;letter-spacing:0.1em;padding:0.28rem 0.65rem;border-radius:50px;direction:ltr;border:1px solid rgba(255,255,255,0.2);}
  .gd-card-body{padding:1.2rem 1.5rem;}
  .gd-section{margin-bottom:1.2rem;} .gd-section:last-child{margin-bottom:0;}
  .gd-label{display:flex;align-items:center;gap:0.5rem;font-family:'Josefin Sans',sans-serif;font-size:0.62rem;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--green-mid);margin-bottom:0.55rem;direction:ltr;}
  .gd-label::before{content:'';width:10px;height:2px;background:var(--gold);display:block;}
  .gd-translation{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-style:italic;color:var(--forest);font-weight:600;}
  .gd-examples{display:flex;flex-direction:column;gap:0.7rem;}
  .gd-example{display:flex;gap:0.7rem;padding:0.8rem 0.95rem;background:linear-gradient(135deg,rgba(216,243,220,0.5) 0%,rgba(250,250,245,0.5) 100%);border-radius:12px;border:1px solid rgba(116,198,157,0.25);}
  .gd-ex-num{font-family:'Josefin Sans',sans-serif;font-size:0.7rem;color:var(--mint);font-weight:600;padding-top:4px;min-width:14px;flex-shrink:0;}
  .gd-ex-ku{font-family:'Noto Naskh Arabic',serif;font-size:1rem;color:var(--text);line-height:1.55;}
  .gd-ex-en{font-family:'Cormorant Garamond',serif;font-size:0.85rem;font-style:italic;color:var(--muted);margin-top:2px;direction:ltr;}
  .gd-loading{color:var(--green-mid);font-size:0.85rem;padding:0.4rem 0;}
  .gd-chips-section{margin-bottom:1.4rem;}
  .gd-chips-head{font-family:'Josefin Sans',sans-serif;font-size:0.62rem;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:0.65rem;direction:ltr;}
  .gd-chips{display:flex;flex-wrap:wrap;gap:0.5rem;}
  .gd-chip{font-family:'Noto Naskh Arabic',serif;font-size:0.95rem;padding:0.32rem 0.9rem;border:1.5px solid rgba(116,198,157,0.5);border-radius:50px;background:var(--warm-white);color:var(--green);cursor:pointer;transition:all 0.18s;}
  .gd-chip:hover{background:var(--green);color:white;border-color:var(--green);}
  .gd-error{background:rgba(255,100,100,0.07);border:1px solid rgba(200,100,100,0.25);color:#7a3a2a;padding:0.75rem 1rem;border-radius:12px;font-size:0.88rem;margin-bottom:1rem;}
  .gd-footer{text-align:center;padding-top:1.6rem;color:var(--muted);font-size:0.83rem;}
  .gd-footer-flower{font-size:1.1rem;display:block;margin-bottom:0.25rem;}
  .gd-skel{background:linear-gradient(90deg,var(--pale) 25%,#f0faf2 50%,var(--pale) 75%);background-size:200% 100%;animation:gdshimmer 1.4s infinite;border-radius:8px;margin-bottom:0.6rem;}
  @keyframes gdshimmer{to{background-position:-200% 0;}}
  .gd-no-key{font-family:'Josefin Sans',sans-serif;font-size:0.72rem;color:var(--muted);padding:0.3rem 0;}
`;

// ==================== Theme 4: Golden CSS ====================
const goldenCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@300;400;500;700&display=swap');
  .gl-root{--ink:#1a1008;--paper:#f5efe2;--paper2:#ede4d0;--gold:#c8922a;--gold2:#e8b84b;--rust:#8b3a1a;--teal:#1a5c5c;--teal2:#2a8a7a;--muted:#7a6a50;--border:#c8b898;--shadow:rgba(26,16,8,0.15);}
  .gl-root{min-height:100vh;background:var(--paper);background-image:radial-gradient(ellipse at 10% 0%,rgba(200,146,42,0.12) 0%,transparent 50%),radial-gradient(ellipse at 90% 100%,rgba(26,92,92,0.10) 0%,transparent 50%);font-family:'Tajawal',sans-serif;direction:rtl;color:var(--ink);padding:0 1rem 4rem;}
  .gl-root::after{content:'';position:fixed;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--rust),var(--gold),var(--teal2),var(--gold2));pointer-events:none;z-index:100;}
  .gl-page{max-width:720px;margin:0 auto;}
  .gl-header{text-align:center;padding:2.5rem 0 2rem;animation:glfd 0.7s ease both;} @keyframes glfd{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
  .gl-emblem{width:58px;height:58px;margin:0 auto 18px;border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--gold);background:linear-gradient(135deg,rgba(200,146,42,0.08),transparent);box-shadow:0 0 0 6px rgba(200,146,42,0.07);}
  .gl-eyebrow{font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:9px;}
  .gl-title{font-family:'Amiri',serif;font-size:clamp(2rem,6vw,3rem);font-weight:700;color:var(--ink);line-height:1.15;margin-bottom:9px;}
  .gl-title em{font-style:normal;color:var(--gold);}
  .gl-divider{display:flex;align-items:center;gap:10px;margin:14px auto;width:160px;}
  .gl-divider-line{flex:1;height:1px;background:var(--border);}
  .gl-divider-gem{width:7px;height:7px;background:var(--gold);transform:rotate(45deg);border-radius:1px;}
  .gl-subtitle{font-size:13px;color:var(--muted);font-weight:300;}
  .gl-search{background:white;border:1.5px solid var(--border);border-radius:16px;padding:5px 5px 5px 10px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 24px var(--shadow);margin-bottom:28px;transition:border-color 0.2s,box-shadow 0.2s;animation:glfd 0.7s 0.1s ease both;}
  .gl-search:focus-within{border-color:var(--gold);box-shadow:0 4px 32px rgba(200,146,42,0.15);}
  .gl-input{flex:1;border:none;outline:none;font-family:'Tajawal',sans-serif;font-size:16px;color:var(--ink);background:transparent;direction:rtl;text-align:right;}
  .gl-input::placeholder{color:var(--muted);opacity:0.6;}
  .gl-btn{width:42px;height:42px;border:none;border-radius:10px;background:linear-gradient(135deg,var(--gold),var(--rust));color:white;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.15s,opacity 0.15s;flex-shrink:0;}
  .gl-btn:hover:not(:disabled){transform:scale(1.06);} .gl-btn:disabled{opacity:0.45;cursor:default;}
  .gl-spinning{display:inline-block;animation:glspin 0.9s linear infinite;} @keyframes glspin{to{transform:rotate(360deg);}}
  .gl-card{background:white;border:1.5px solid var(--border);border-radius:20px;overflow:hidden;box-shadow:0 8px 40px var(--shadow);margin-bottom:28px;animation:glci 0.4s ease both;}
  @keyframes glci{from{opacity:0;transform:translateY(18px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  .gl-card-stripe{height:5px;background:linear-gradient(90deg,var(--teal),var(--gold),var(--rust));}
  .gl-card-body{padding:26px 26px 22px;}
  .gl-word-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;}
  .gl-word{font-family:'Amiri',serif;font-size:2.2rem;font-weight:700;color:var(--ink);line-height:1.1;}
  .gl-dir-badge{font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);border:1px solid var(--border);border-radius:20px;padding:3px 9px;white-space:nowrap;margin-top:6px;background:var(--paper);}
  .gl-sep{border:none;border-top:1px solid var(--paper2);margin:0 0 18px;}
  .gl-section{margin-bottom:18px;}
  .gl-label{font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:7px;display:flex;align-items:center;gap:5px;}
  .gl-label::before{content:'';display:block;width:3px;height:11px;background:var(--gold);border-radius:2px;}
  .gl-translation{font-family:'Amiri',serif;font-size:1.6rem;color:var(--teal);}
  .gl-examples{display:flex;flex-direction:column;gap:12px;}
  .gl-example{background:var(--paper);border:1px solid var(--paper2);border-radius:12px;padding:13px 15px;border-right:3px solid var(--teal2);animation:glci 0.35s ease both;}
  .gl-ex-ku{font-family:'Amiri',serif;font-size:1rem;color:var(--ink);line-height:1.65;direction:rtl;text-align:right;margin-bottom:4px;}
  .gl-ex-en{font-size:0.78rem;color:var(--muted);direction:ltr;text-align:left;font-style:italic;font-weight:300;}
  .gl-loading{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:12px;padding:9px 0;}
  .gl-chips-section{margin-bottom:26px;}
  .gl-chips-label{font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--muted);margin-bottom:11px;text-align:center;}
  .gl-chips{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;}
  .gl-chip{font-family:'Tajawal',sans-serif;font-size:13px;padding:6px 15px;border:1.5px solid var(--border);border-radius:100px;background:white;color:var(--ink);cursor:pointer;transition:all 0.18s;}
  .gl-chip:hover{background:var(--gold);border-color:var(--gold);color:white;transform:translateY(-2px);box-shadow:0 4px 12px rgba(200,146,42,0.25);}
  .gl-error{background:rgba(139,58,26,0.08);border:1px solid rgba(139,58,26,0.25);border-radius:12px;padding:13px 17px;color:var(--rust);font-size:13px;margin-bottom:18px;display:flex;align-items:center;gap:7px;}
  .gl-footer{text-align:center;font-size:13px;color:var(--muted);padding-top:18px;border-top:1px solid var(--paper2);font-family:'Amiri',serif;}
  .gl-skel{border-radius:8px;background:linear-gradient(90deg,var(--paper2) 25%,var(--border) 50%,var(--paper2) 75%);background-size:800px 100%;animation:glshimmer 1.4s infinite;margin-bottom:11px;}
  @keyframes glshimmer{from{background-position:-400px 0}to{background-position:400px 0}}
  .gl-no-key{font-size:11px;color:var(--muted);padding:4px 0;font-style:italic;}
`;

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

  // FIX: groqKey لە localStorage دێت، بەڵام localStorage لە artifact نییە — state بەتەنها
  const [groqKey, setGroqKey] = useState(() => {
    try { return localStorage.getItem("groq_api_key") || ""; }
    catch { return ""; }
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [theme]);

  // FIX 4: کاتێک modal دەکرێتەوە، input خاوەن نییە — نەیخوێنرێتەوە
  const openKeyModal = () => {
    setTempKey(""); // هەمووکات خاوەن دەستپێدەکات
    setShowKeyInput(true);
  };

  const saveGroqKey = (key) => {
    const trimmed = key.trim();
    setGroqKey(trimmed);
    try { localStorage.setItem("groq_api_key", trimmed); } catch {}
    setShowKeyInput(false);
  };

  const clearGroqKey = () => {
    setGroqKey("");
    try { localStorage.removeItem("groq_api_key"); } catch {}
    setShowKeyInput(false);
  };

  // FIX 5: fetchExamples — ئەگەر key نەبوو MyMemory وەرگێڕان دەدات بەڵام نمونە نییە
  const fetchExamples = async (word, isKu) => {
    if (!groqKey) throw new Error("NO_KEY");
    return await fetchExamplesFromGroq(word, isKu, groqKey);
  };

  const doSearch = async (word) => {
    if (!word.trim()) return;
    setLoading(true); setError(null); setResult(null); setExamples([]);
    setQuery(word);
    try {
      const lang = detectLanguage(word);
      const translation = await translateWord(word, lang);
      const res = { word, translation, isKu: lang === "ku" };
      setResult(res);
      setHistory(prev => [word, ...prev.filter(h => h !== word)].slice(0, 6));
      setLoading(false);

      // FIX 6: نمونەکان بە جیاوازی بارکرێن — ئەگەر key نەبوو پەیامی ڕوون نیشان بدە
      setExLoading(true);
      try {
        const exs = await fetchExamples(word, lang === "ku");
        setExamples(exs);
      } catch (err) {
        setExamples([]);
        // هیچ error گلۆباڵ نانوسین — تەنها لە بەشی examples نیشان دەدرێت
      } finally {
        setExLoading(false);
      }
    } catch (err) {
      setError("کێشەیەک ڕوویدا لە وەرگێڕاندا. تکایە دووبارە هەوڵ بدەرەوە.");
      setLoading(false);
    }
  };

  const CSS_MAP = { classic: classicCSS, modern: modernCSS, garden: gardenCSS, golden: goldenCSS };
  const isKu = result?.isKu;

  // بەشی نمونە بۆ هەموو تیمەکان — تایبەت بە هەر تیمێک ستایل دەگۆڕێت
  const renderExamplesBlock = (prefix) => {
    if (exLoading) return (
      <div className={`${prefix}-loading`}><span className={`${prefix}-spinning`}>⊙</span> نمونەکان دەگەیەنرێن…</div>
    );
    if (!groqKey && result) return (
      <div className={`${prefix}-no-key`}>
        🔑 بۆ نمونەی ڕستە، Groq API Key دابنێ — کلیک لە دوگمەی 🔑 بکە
      </div>
    );
    if (examples.length > 0) return (
      <div className={`${prefix}-examples`}>
        {examples.map((ex, i) => (
          <div key={i} className={`${prefix}-example`}>
            <div className={`${prefix}-ex-num`}>{i + 1}</div>
            <div>
              <div className={`${prefix}-ex-ku`}>{isKu ? ex.ku : ex.en}</div>
              <div className={`${prefix}-ex-en`}>{isKu ? ex.en : ex.ku}</div>
            </div>
          </div>
        ))}
      </div>
    );
    return null;
  };

  return (
    <>
      <style>{SIDEBAR_THEMES_CSS}</style>
      <style>{CSS_MAP[theme]}</style>

      {/* ───── FIX 3: Sidebar لە سەرەوە دەستەڕاست ───── */}
      <div className="theme-sidebar">
        {THEMES.map(t => (
          <button
            key={t.id}
            className={`theme-btn ${t.id} ${theme === t.id ? "active" : ""}`}
            onClick={() => setTheme(t.id)}
            title={`ڕووکاری ${t.id}`}
          >
            {t.label}
          </button>
        ))}
        <button
          className="theme-btn key-btn"
          onClick={openKeyModal}
          title={groqKey ? "Groq Key دانراوە ✓" : "Groq API Key دابنێ"}
        >
          {groqKey ? "✓" : "🔑"}
        </button>
      </div>

      {/* ───── FIX 4: Key Modal — پاسووەردەکە نییەت لەسەر شاشە ───── */}
      {showKeyInput && (
        <div className="key-modal-backdrop" onClick={() => setShowKeyInput(false)}>
          <div className="key-modal" onClick={e => e.stopPropagation()}>
            <h4>🔑 Groq API Key</h4>
            <p>
              {groqKey
                ? "کلیلت هەیە. دەتوانیت بگۆڕیتەوە یان بیسڕیتەوە."
                : "بۆ نمونەی ڕستەکان، Groq API Key بنووسە."}
            </p>
            <input
              type="password"
              placeholder="gsk_xxxx…"
              value={tempKey}
              onChange={e => setTempKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && tempKey && saveGroqKey(tempKey)}
              autoFocus
            />
            {groqKey && (
              <div className="key-modal-status">
                ✓ کلیلێکت هەیە ({groqKey.length} پیت)
              </div>
            )}
            <div className="key-buttons">
              {tempKey && (
                <button className="key-btn-save" onClick={() => saveGroqKey(tempKey)}>
                  پاشەکەوت
                </button>
              )}
              {groqKey && (
                <button className="key-btn-clear" onClick={clearGroqKey}>
                  سڕینەوە
                </button>
              )}
              <button className="key-btn-close" onClick={() => setShowKeyInput(false)}>
                داخستن
              </button>
            </div>
            <small>Keyەکە تەنها لە ناو browserـی تۆدا هەڵدەگیرێت، بۆ سێرڤەر ناگات.</small>
          </div>
        </div>
      )}

      {/* ========== Theme 1: Classic ========== */}
      {theme === "classic" && (
        <div className="ck-root">
          <div className="ck-page">
            <div className="ck-ornament">❧ ✦ ❧</div>
            <header className="ck-header">
              <div className="ck-title-ku">فەرهەنگی کوردی</div>
              <div className="ck-title-en">Kurdish · English Dictionary</div>
              <div className="ck-subtitle">وشەیەکت بنووسە — زمانەکەت ئۆتۆماتیکی دەناسرێت</div>
            </header>
            <div className="ck-search">
              <div className="ck-input-row">
                <input ref={inputRef} className="ck-input" value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doSearch(query)}
                  placeholder="وشە بنووسە · Type a word…" />
                <button className="ck-btn" onClick={() => doSearch(query)} disabled={loading || !query.trim()}>
                  {loading ? <span className="ck-spinning">⊙</span> : "←"}
                </button>
              </div>
            </div>
            {error && <div className="ck-error">⚠ {error}</div>}
            {loading && <div className="ck-card"><div className="ck-skel" style={{height:34,width:"50%"}} /><div className="ck-skel" style={{height:18,width:"70%"}} /><div className="ck-skel" style={{height:18,width:"55%"}} /></div>}
            {result && !loading && (
              <div className="ck-card">
                <div className="ck-corner">✦</div>
                <div className="ck-word">{result.word}</div>
                <div className="ck-dir-label">{isKu ? "Kurdish Sorani → English" : "English → Kurdish Sorani"}</div>
                <hr className="ck-divider" />
                <div className="ck-label">وەرگێڕان · Translation</div>
                <div className="ck-translation">{result.translation}</div>
                <hr className="ck-divider" />
                <div className="ck-label">نمونەی ڕستەکان · Examples</div>
                {renderExamplesBlock("ck")}
              </div>
            )}
            {history.length > 0 && <div className="ck-chips-section"><div className="ck-chips-head">مێژووی گەڕان · Recent</div><div className="ck-chips">{history.map((w,i) => <button key={i} className="ck-chip" onClick={() => doSearch(w)}>{w}</button>)}</div></div>}
            {!result && !loading && <div className="ck-chips-section"><div className="ck-chips-head">تاقی بکەرەوە · Try these</div><div className="ck-chips">{SUGGESTIONS.map(w => <button key={w} className="ck-chip" onClick={() => doSearch(w)}>{w}</button>)}</div></div>}
            <footer className="ck-footer">❧ کوردی · English Dictionary ❧</footer>
          </div>
        </div>
      )}

      {/* ========== Theme 2: Modern ========== */}
      {theme === "modern" && (
        <div className="md-root">
          <div className="md-topstrip" />
          <div className="md-page">
            <header className="md-header">
              <div className="md-badge">Kurdish AI Dictionary · v2</div>
              <div className="md-title">Kurdi <span>&amp;</span> English</div>
              <div className="md-subtitle">وشەیەکت بنووسە — زمانەکەت ئۆتۆماتیکی دەناسرێت</div>
            </header>
            <div className="md-search">
              <div className="md-input-row">
                <input ref={inputRef} className="md-input" value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doSearch(query)}
                  placeholder="وشە بنووسە · Type a word…" />
                <button className="md-btn" onClick={() => doSearch(query)} disabled={loading || !query.trim()}>
                  {loading ? <span className="md-spinning">⊙</span> : "→"}
                </button>
              </div>
            </div>
            {error && <div className="md-error">⚠ {error}</div>}
            {loading && <div className="md-card"><div className="md-card-top"><div className="md-skel" style={{height:34,width:"40%"}} /></div><div className="md-card-body"><div className="md-skel" style={{height:16,width:"70%"}} /><div className="md-skel" style={{height:16,width:"55%"}} /></div></div>}
            {result && !loading && (
              <div className="md-card">
                <div className="md-card-top">
                  <div className="md-word">{result.word}</div>
                  <div className="md-dir-tag">{isKu ? "KU → EN" : "EN → KU"}</div>
                </div>
                <div className="md-card-body">
                  <div className="md-section"><div className="md-label">Translation</div><div className="md-translation">{result.translation}</div></div>
                  <div className="md-section">
                    <div className="md-label">Example Sentences</div>
                    {renderExamplesBlock("md")}
                  </div>
                </div>
              </div>
            )}
            {history.length > 0 && <div className="md-chips-section"><div className="md-chips-head">Recent Searches</div><div className="md-chips">{history.map((w,i) => <button key={i} className="md-chip" onClick={() => doSearch(w)}>{w}</button>)}</div></div>}
            {!result && !loading && <div className="md-chips-section"><div className="md-chips-head">Try These</div><div className="md-chips">{SUGGESTIONS.map(w => <button key={w} className="md-chip" onClick={() => doSearch(w)}>{w}</button>)}</div></div>}
            <footer className="md-footer">Kurdish · English Dictionary — AI Powered</footer>
          </div>
        </div>
      )}

      {/* ========== Theme 3: Garden ========== */}
      {theme === "garden" && (
        <div className="gd-root">
          <div className="gd-page">
            <header className="gd-header">
              <span className="gd-flower">🌿</span>
              <div className="gd-title">فەرهەنگی کوردی</div>
              <div className="gd-title-en">Kurdish · English Dictionary</div>
              <div className="gd-rule"><div className="gd-rule-line" /><div className="gd-rule-flower">✦</div><div className="gd-rule-line" /></div>
              <div className="gd-subtitle">وشەیەکت بنووسە — زمانەکەت ئۆتۆماتیکی دەناسرێت</div>
            </header>
            <div className="gd-search">
              <div className="gd-input-row">
                <input ref={inputRef} className="gd-input" value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doSearch(query)}
                  placeholder="وشە بنووسە · Type a word…" />
                <button className="gd-btn" onClick={() => doSearch(query)} disabled={loading || !query.trim()}>
                  {loading ? <span className="gd-spinning">⊙</span> : "←"}
                </button>
              </div>
            </div>
            {error && <div className="gd-error">⚠ {error}</div>}
            {loading && <div className="gd-card"><div className="gd-card-head" style={{background:"var(--pale)"}}><div className="gd-skel" style={{height:34,width:"40%",background:"rgba(45,106,79,0.1)"}} /></div><div className="gd-card-body"><div className="gd-skel" style={{height:18,width:"60%"}} /><div className="gd-skel" style={{height:18,width:"75%"}} /></div></div>}
            {result && !loading && (
              <div className="gd-card">
                <div className="gd-card-head">
                  <div className="gd-word">{result.word}</div>
                  <div className="gd-dir-badge">{isKu ? "KU → EN" : "EN → KU"}</div>
                </div>
                <div className="gd-card-body">
                  <div className="gd-section"><div className="gd-label">وەرگێڕان · Translation</div><div className="gd-translation">{result.translation}</div></div>
                  <div className="gd-section">
                    <div className="gd-label">نمونەی ڕستەکان · Examples</div>
                    {renderExamplesBlock("gd")}
                  </div>
                </div>
              </div>
            )}
            {history.length > 0 && <div className="gd-chips-section"><div className="gd-chips-head">مێژووی گەڕان · Recent</div><div className="gd-chips">{history.map((w,i) => <button key={i} className="gd-chip" onClick={() => doSearch(w)}>{w}</button>)}</div></div>}
            {!result && !loading && <div className="gd-chips-section"><div className="gd-chips-head">تاقی بکەرەوە · Try these</div><div className="gd-chips">{SUGGESTIONS.map(w => <button key={w} className="gd-chip" onClick={() => doSearch(w)}>{w}</button>)}</div></div>}
            <footer className="gd-footer"><span className="gd-footer-flower">🌿</span>فەرهەنگی کوردی · Kurdish English Dictionary</footer>
          </div>
        </div>
      )}

      {/* ========== Theme 4: Golden ========== */}
      {theme === "golden" && (
        <div className="gl-root">
          <div className="gl-page">
            <header className="gl-header">
              <div className="gl-emblem">✦</div>
              <div className="gl-eyebrow">فەرهەنگی زیرەک · Smart Dictionary</div>
              <h1 className="gl-title">فەرهەنگا <em>کوردی</em></h1>
              <div className="gl-divider"><div className="gl-divider-line" /><div className="gl-divider-gem" /><div className="gl-divider-line" /></div>
              <p className="gl-subtitle">وشەیەکت بنووسە — زمانەکەت ئۆتۆماتیکی دەناسرێت</p>
            </header>
            <div className="gl-search">
              <input ref={inputRef} className="gl-input" value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch(query)}
                placeholder="وشە بنووسە · Type a word…" />
              <button className="gl-btn" onClick={() => doSearch(query)} disabled={loading || !query.trim()}>
                {loading ? <span className="gl-spinning">⊙</span> : "→"}
              </button>
            </div>
            {error && <div className="gl-error"><span>⚠</span>{error}</div>}
            {loading && <div className="gl-card" style={{padding:"26px"}}><div className="gl-skel" style={{height:46,width:"50%"}} /><div className="gl-skel" style={{height:16,width:"70%"}} /><div className="gl-skel" style={{height:16,width:"55%"}} /></div>}
            {result && !loading && (
              <div className="gl-card">
                <div className="gl-card-stripe" />
                <div className="gl-card-body">
                  <div className="gl-word-row">
                    <div className="gl-word">{result.word}</div>
                    <div className="gl-dir-badge">{isKu ? "کوردی ← ئینگلیزی" : "English ← Kurdish"}</div>
                  </div>
                  <hr className="gl-sep" />
                  <div className="gl-section"><div className="gl-label">وەرگێڕان · Translation</div><div className="gl-translation">{result.translation}</div></div>
                  <hr className="gl-sep" />
                  <div className="gl-section">
                    <div className="gl-label">نمونەی ڕستەکان · Examples</div>
                    {renderExamplesBlock("gl")}
                  </div>
                </div>
              </div>
            )}
            {history.length > 0 && <div className="gl-chips-section"><div className="gl-chips-label">مێژووی گەڕان · Recent</div><div className="gl-chips">{history.map((w,i) => <button key={i} className="gl-chip" onClick={() => doSearch(w)}>{w}</button>)}</div></div>}
            {!result && !loading && <div className="gl-chips-section"><div className="gl-chips-label">تاقی بکەرەوە · Try these</div><div className="gl-chips">{SUGGESTIONS.map(w => <button key={w} className="gl-chip" onClick={() => doSearch(w)}>{w}</button>)}</div></div>}
            <footer className="gl-footer">✦ &nbsp; فەرهەنگا کوردی · Kurdish Dictionary &nbsp; ✦</footer>
          </div>
        </div>
      )}
    </>
  );
}
