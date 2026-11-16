/* CryptoMesTools · Copyright (C) 2026 Massimo Esposito · licenza GNU AGPL-3.0 (file LICENSE) */
/* Proxy per l'API privata di Kraken, che non accetta chiamate dirette dalle pagine web (CORS).
   Riceve una richiesta già firmata nel browser (la chiave privata non arriva qui), la inoltra a api.kraken.com e restituisce
   la risposta. Non salva e non registra nulla. Solo l'endpoint di lettura Ledgers e solo dalle pagine di CryptoMesTools. */
const PERCORSI = ["/0/private/Ledgers"];
const ORIGINI = ["https://cryptomestools.netlify.app", "https://koinly-tools.netlify.app", "http://localhost:8765", "http://127.0.0.1:8765"];

export default async (req) => {
  const origine = req.headers.get("origin") || "";
  const cors = ORIGINI.includes(origine) ? { "Access-Control-Allow-Origin": origine, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" } : {};
  const risposta = (corpo, stato) => new Response(JSON.stringify(corpo), { status: stato, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return risposta({ error: ["Metodo non ammesso"] }, 405);
  if (origine && !ORIGINI.includes(origine)) return risposta({ error: ["Origine non ammessa"] }, 403);
  let d;
  try { d = await req.json(); } catch (e) { return risposta({ error: ["Richiesta non valida"] }, 400); }
  const { percorso, corpo, chiave, firma } = d || {};
  if (!PERCORSI.includes(percorso) || typeof corpo !== "string" || corpo.length > 500 || !/^nonce=\d+(&[a-z]+=[\w.]*)*$/.test(corpo) ||
      typeof chiave !== "string" || chiave.length > 200 || typeof firma !== "string" || firma.length > 200) return risposta({ error: ["Richiesta non valida"] }, 400);
  try {
    const r = await fetch("https://api.kraken.com" + percorso, { method: "POST", headers: { "API-Key": chiave, "API-Sign": firma, "Content-Type": "application/x-www-form-urlencoded; charset=utf-8", "User-Agent": "CryptoMesTools" }, body: corpo });
    const testo = await r.text();
    return new Response(testo, { status: r.ok ? 200 : 502, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });
  } catch (e) {
    return risposta({ error: ["Kraken non raggiungibile"] }, 502);
  }
};

export const config = { path: "/api/kraken" };
