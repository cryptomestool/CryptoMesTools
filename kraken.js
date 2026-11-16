/* CryptoMesTools · Copyright (C) 2026 Massimo Esposito · licenza GNU AGPL-3.0 (file LICENSE) */
/* CryptoMesTools · movimenti di Kraken con la chiave API del cliente (sola lettura, permesso «Query Ledger Entries»).
   La firma di ogni richiesta (HMAC-SHA512, come da documentazione Kraken) si calcola qui nel browser: il segreto della chiave
   non lascia mai il computer e non viene salvato. L'API privata di Kraken non accetta chiamate dirette dalle pagine web (CORS),
   quindi la richiesta già firmata passa dal proxy del sito (netlify/functions/kraken.mjs), che la inoltra così com'è a
   api.kraken.com e restituisce la risposta senza conservarla. Arrivano al proxy: la parte pubblica della chiave, la firma
   (valida per quella sola richiesta) e i movimenti restituiti da Kraken.
   I movimenti diventano un CSV con le stesse colonne dell'esportazione «Ledgers», letto da KoinlyPiattaforme.leggiKraken:
   così CSV e API si uniscono e le righe presenti in entrambi contano una volta (stesso txid). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KoinlyKraken = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PERCORSO = "/0/private/Ledgers";
  var COLONNE = ["txid", "refid", "time", "type", "subtype", "aclass", "asset", "wallet", "amount", "fee", "balance"];

  function daBase64(s) { var b = atob(String(s).trim()), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function inBase64(buf) { var u = new Uint8Array(buf), s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }

  /* API-Sign = base64( HMAC-SHA512( base64decode(segreto), percorso + SHA256(nonce + corpo) ) ) */
  async function firma(percorso, nonce, corpo, segreto) {
    var enc = new TextEncoder(), cs = crypto.subtle;
    var h = new Uint8Array(await cs.digest("SHA-256", enc.encode(nonce + corpo)));
    var p = enc.encode(percorso), msg = new Uint8Array(p.length + h.length); msg.set(p); msg.set(h, p.length);
    var k = await cs.importKey("raw", daBase64(segreto), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    return inBase64(await cs.sign("HMAC", k, msg));
  }

  /* proxy: sul sito pubblicato è lo stesso indirizzo; in anteprima locale si usa quello pubblicato */
  function proxyPredefinito() {
    var h = typeof location !== "undefined" ? location.hostname : "";
    return /^(localhost|127\.0\.0\.1)$/.test(h) || !h ? "https://koinly-tools.netlify.app/api/kraken" : "/api/kraken";
  }
  function controllaChiave(chiave, segreto) {
    if (!String(chiave || "").trim() || !String(segreto || "").trim()) return "Inserite la chiave API (API Key) e la chiave privata (Private Key) generate su Kraken.";
    try { if (daBase64(segreto).length < 32) return "La chiave privata non sembra corretta: è il testo lungo che Kraken mostra una sola volta, alla creazione della chiave."; }
    catch (e) { return "La chiave privata non è nel formato di Kraken (base64)."; }
    return null;
  }
  var ERRORI = {
    "EAPI:Invalid key": "Chiave API non valida o revocata.",
    "EAPI:Invalid signature": "Firma rifiutata: la chiave privata non corrisponde alla chiave API.",
    "EAPI:Invalid nonce": "Kraken ha rifiutato il nonce: se la stessa chiave è usata da un altro programma, createne una nuova solo per CryptoMesTools.",
    "EGeneral:Permission denied": "La chiave non ha il permesso «Query Ledger Entries»: modificatela su Kraken (Impostazioni → API).",
    "EAPI:Feature disabled": "La funzione è disattivata per questo conto Kraken."
  };
  var attendi = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* scarica tutti i movimenti (50 per richiesta, dal più recente) con pause per i limiti di Kraken; restituisce l'oggetto ledger */
  async function scaricaLedger(o) {
    var errore = controllaChiave(o.chiave, o.segreto); if (errore) throw new Error(errore);
    var proxy = o.proxy || proxyPredefinito(), avanz = o.avanzamento || function () {}, invia = o.fetch || fetch;
    var ledger = {}, totale = null, ofs = 0, ultimoNonce = 0, tentativi = 0;
    while (totale === null || ofs < totale) {
      var nonce = Math.max(Date.now() * 1000, ultimoNonce + 1); ultimoNonce = nonce;
      var corpo = "nonce=" + nonce + "&ofs=" + ofs + (o.dal ? "&start=" + Math.floor(o.dal / 1000) : "");
      var sign = await firma(PERCORSO, String(nonce), corpo, o.segreto);
      var r;
      try { r = await invia(proxy, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ percorso: PERCORSO, corpo: corpo, chiave: String(o.chiave).trim(), firma: sign }) }); }
      catch (e) { throw new Error("Collegamento con Kraken non raggiungibile (" + proxy + "): controllate la connessione o riprovate più tardi."); }
      if (!r.ok) throw new Error("Il collegamento con Kraken non risponde (" + r.status + "): riprovare più tardi.");
      var j = await r.json(), err = (j.error || [])[0];
      if (err) {
        if (/Rate limit|Throttled|Temporary lockout/i.test(err) && tentativi < 8) { tentativi++; avanz("Kraken chiede di rallentare: attesa " + (tentativi * 5) + " secondi"); await attendi(tentativi * 5000); continue; }
        throw new Error(ERRORI[err] || "Kraken risponde: " + err);
      }
      tentativi = 0;
      var res = j.result || {}, voci = res.ledger || {}, ids = Object.keys(voci);
      totale = +res.count || 0;
      ids.forEach(function (id) { ledger[id] = voci[id]; });
      ofs += 50;
      avanz("Kraken: " + Math.min(Object.keys(ledger).length, totale).toLocaleString("it-IT") + " movimenti su " + totale.toLocaleString("it-IT"));
      if (!ids.length) break;
      if (ofs < totale) await attendi(o.pausa == null ? 3000 : o.pausa);
    }
    return ledger;
  }

  function dataUTC(sec) { var d = new Date(Math.round(+sec * 1000)); return isFinite(d) ? d.toISOString().slice(0, 19).replace("T", " ") : ""; }
  function cella(v) { var s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  /* ledger dell'API → CSV nel formato dell'esportazione «Ledgers» di Kraken (orari UTC) */
  function versoCsv(ledger) {
    var righe = Object.keys(ledger).map(function (id) { var x = ledger[id]; return { txid: id, refid: x.refid, time: dataUTC(x.time), t: +x.time, type: x.type, subtype: x.subtype, aclass: x.aclass, asset: x.asset, wallet: x.wallet || "", amount: x.amount, fee: x.fee, balance: x.balance }; });
    righe.sort(function (a, b) { return a.t - b.t || (a.txid < b.txid ? -1 : 1); });
    return COLONNE.join(",") + "\n" + righe.map(function (x) { return COLONNE.map(function (c) { return cella(x[c]); }).join(","); }).join("\n") + (righe.length ? "\n" : "");
  }

  return { firma: firma, scaricaLedger: scaricaLedger, versoCsv: versoCsv, controllaChiave: controllaChiave, proxyPredefinito: proxyPredefinito, PERCORSO: PERCORSO };
});
