/* CryptoMesTools · Copyright (C) 2026 Massimo Esposito · licenza GNU AGPL-3.0 (file LICENSE) */
/* CryptoMesTools · lettura anonimizzata degli estratti conto bancari: PDF con testo, CSV ed Excel (.xlsx) dell'home banking.
   Privacy: di ogni riga si conservano SOLO data, importo, segno e il nome dell'exchange riconosciuto.
   Le righe che non riguardano cripto-attività sono scartate alla lettura (se ne conta solo il numero);
   anche nelle righe tenute il testo originale (nomi, IBAN, indirizzi, causali) non viene mai conservato né mostrato. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KoinlyBanca = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // controparti riconosciute: nome mostrato e parole da cercare (in minuscolo) nella descrizione del movimento
  var CONTROPARTI = [
    ["Binance", /binance/], ["Coinbase", /coinbase/], ["Kraken", /kraken|payward/], ["Bitpanda", /bitpanda/], ["Young Platform", /young\s?platform|young plat/],
    ["Nexo", /\bnexo\b/], ["Crypto.com", /crypto\.com|foris dax|cro card/], ["Bybit", /bybit/], ["Bitstamp", /bitstamp/], ["Bitvavo", /bitvavo/],
    ["Relai", /\brelai\b/], ["Conio", /\bconio\b/], ["The Rock Trading", /the ?rock ?trading/], ["Bitfinex", /bitfinex|ifinex/], ["KuCoin", /kucoin/],
    ["OKX", /\bokx\b|okcoin/], ["Bitget", /bitget/], ["Gate.io", /gate\.io/], ["MEXC", /\bmexc\b/], ["Revolut (cripto)", /revolut.{0,20}(crypto|cripto|bitcoin)/],
    ["MoonPay", /moonpay/], ["Ramp", /ramp network|rampnetwork/], ["Paybis", /paybis/], ["Banxa", /banxa/], ["Wirex", /wirex/], ["SwissBorg", /swissborg/],
    ["Uphold", /uphold/], ["Bit2Me", /bit2me/], ["eToro", /etoro/], ["Paymium", /paymium/], ["Bitonic", /bitonic/], ["Strike", /\bstrike\b/],
    ["Cripto (generico)", /\b(crypto|cripto|bitcoin|btc|ethereum|usdt|exchange cripto)\b/]
  ];
  var MESI = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
  var USCITA = /(bonifico (a favore|disposto|verso|in uscita)|pagamento|addebito|acquisto|prelievo|disposizione|giroconto a|sepa direct debit|carta)/i;
  var ENTRATA = /(bonifico (da|a vostro favore|ricevuto|in entrata)|accredito|versamento|ordinante|incasso|rimborso|giroconto da)/i;

  function controparte(testo) {
    var t = testo.toLowerCase();
    for (var i = 0; i < CONTROPARTI.length; i++) if (CONTROPARTI[i][1].test(t)) return CONTROPARTI[i][0];
    return null;
  }
  function data(testo) {
    var m = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/.exec(testo);
    if (m) { var a = +m[3]; if (a < 100) a += 2000; return a + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2); }
    m = /\b(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\.?\s+(\d{4})\b/i.exec(testo);
    if (m) return m[3] + "-" + ("0" + MESI[m[2].toLowerCase()]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
    return null;
  }
  /* importi nella riga: formato italiano 1.234,56 o inglese 1,234.56, con segno o parentesi */
  function importi(testo) {
    var out = [], re = /(^|[\s€(])([+\-−]?)\s?(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})(?=\s|€|\)|$)/g, m;
    while ((m = re.exec(testo))) {
      var s = m[3], v = /,\d{2}$/.test(s) ? parseFloat(s.replace(/[.\s]/g, "").replace(",", ".")) : parseFloat(s.replace(/,/g, ""));
      if (isFinite(v)) out.push({ v: v, segno: m[2] === "-" || m[2] === "−" ? -1 : m[2] === "+" ? 1 : 0 });
    }
    return out;
  }

  /* pagine: [{ text }] dal PDF (comune/pdftext.js). Restituisce solo i movimenti con exchange, anonimizzati. */
  function leggi(pagine, nomeFile) {
    var righe = [], scartate = 0, lette = 0;
    pagine.forEach(function (p) {
      // una riga con la data ma senza importo prosegue sulla riga successiva (descrizioni lunghe che vanno a capo)
      var linee = String(p.text || "").split("\n"), unite = [];
      for (var i = 0; i < linee.length; i++) {
        var l = linee[i];
        while (data(l) && !importi(l.replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, " ")).length && i + 1 < linee.length && !data(linee[i + 1])) l += " " + linee[++i];
        unite.push(l);
      }
      unite.forEach(function (riga) {
        var d = data(riga); if (!d) return;
        var imp = importi(riga.replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, " ")); if (!imp.length) return;
        lette++;
        var cp = controparte(riga);
        if (!cp) { scartate++; return; }
        // il primo importo della riga è quello del movimento (i successivi sono di solito il saldo)
        var x = imp[0], segno = x.segno || (ENTRATA.test(riga) ? 1 : USCITA.test(riga) ? -1 : -1);
        righe.push({ data: d, importo: x.v, segno: segno, controparte: cp, descrizione: (segno > 0 ? "accredito da " : "addebito verso ") + cp });
        // il testo originale della riga NON viene conservato
      });
    });
    righe.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    return { file: nomeFile ? "estratto conto " + (nomeFile.match(/(20\d{2})/) || ["", ""])[1] : "estratto conto", movimenti: righe, righeLette: lette, righeScartate: scartate };
  }

  /* ---------- movimenti in tabella: CSV ed Excel esportati dall'home banking ----------
     Stessa regola dei PDF: di ogni riga si tengono solo data, importo, segno ed exchange; tutto il resto è scartato alla lettura. */
  var COL_DATA = /^(data( (operazione|contabile|registrazione|movimento|op\.?))?|date|booking date|transaction date|data valuta|valuta)$/i;
  var COL_IMPORTO = /^(importo( in euro| eur| \(eur\)| \(€\))?|amount|ammontare|importo movimento)$/i;
  var COL_DARE = /^(dare|uscite|addebiti|addebito|importo dare|debit|money out)$/i;
  var COL_AVERE = /^(avere|entrate|accrediti|accredito|importo avere|credit|money in)$/i;
  function norma(x) { return String(x == null ? "" : x).replace(/\s+/g, " ").trim(); }
  // numero da cella: 1.234,56 / 1234.56 / -1.500,00 / (1.500,00) / numero Excel
  function numero(x) {
    if (typeof x === "number") return x;
    var t = norma(x).replace(/[€\s]|EUR/gi, ""); if (!t) return null;
    var neg = /^\(.*\)$/.test(t) || /^[-−]/.test(t) || /-$/.test(t); t = t.replace(/[()+\-−]/g, "");
    var v = /,\d{1,2}$/.test(t) ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t.replace(/,/g, ""));
    return isFinite(v) ? (neg ? -v : v) : null;
  }
  // data da cella: testo (gg/mm/aaaa, aaaa-mm-gg, 3 mar 2023) o numero seriale di Excel
  function dataCella(x) {
    if (typeof x === "number" && x > 20000 && x < 80000) return new Date(Date.UTC(1899, 11, 30) + x * 86400000).toISOString().slice(0, 10);
    var t = norma(x), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    if (/^\d{5}(\.\d+)?$/.test(t)) return dataCella(+t);
    return data(t);
  }
  /* righe: matrice di celle (prima riga utile = intestazione). Restituisce gli stessi campi di leggi() */
  function leggiTabella(righe, nomeFile) {
    var testa = -1, cD = -1, cI = -1, cDare = -1, cAvere = -1;
    for (var i = 0; i < Math.min(righe.length, 30) && testa < 0; i++) {
      var r = righe[i].map(function (c) { return norma(c).replace(/[:*]$/, ""); });
      var d = r.findIndex(function (c) { return COL_DATA.test(c); });
      var im = r.findIndex(function (c) { return COL_IMPORTO.test(c); }), da = r.findIndex(function (c) { return COL_DARE.test(c); }), av = r.findIndex(function (c) { return COL_AVERE.test(c); });
      if (d >= 0 && (im >= 0 || da >= 0 || av >= 0)) { testa = i; cD = d; cI = im; cDare = da; cAvere = av; }
    }
    if (testa < 0) return { errore: "Non trovo le colonne della data e dell'importo (o dare e avere): esportate i movimenti in CSV o Excel con l'intestazione delle colonne." };
    var mov = [], lette = 0, scartate = 0;
    righe.slice(testa + 1).forEach(function (r) {
      var g = dataCella(r[cD]); if (!g) return;
      var v = null;
      if (cI >= 0) v = numero(r[cI]);
      if (v == null || v === 0) { var u = cDare >= 0 ? numero(r[cDare]) : null, e = cAvere >= 0 ? numero(r[cAvere]) : null; if (e) v = Math.abs(e); else if (u) v = -Math.abs(u); }
      if (v == null || v === 0) return;
      lette++;
      var testo = r.map(norma).join(" "), cp = controparte(testo);
      if (!cp) { scartate++; return; }
      var segno = v < 0 ? -1 : 1;
      mov.push({ data: g, importo: Math.abs(v), segno: segno, controparte: cp, descrizione: (segno > 0 ? "accredito da " : "addebito verso ") + cp });
      // il testo della riga NON viene conservato
    });
    mov.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    return { file: nomeFile ? "movimenti " + (nomeFile.match(/(20\d{2})/) || ["", ""])[1] : "movimenti", movimenti: mov, righeLette: lette, righeScartate: scartate };
  }
  /* CSV: separatore ; , o tabulazione, campi tra virgolette */
  function righeCsv(testo) {
    testo = String(testo).replace(/^﻿/, "");
    var prima = testo.split(/\r?\n/).slice(0, 10).join("\n"), sep = [";", "\t", ","].sort(function (a, b) { return prima.split(b).length - prima.split(a).length; })[0];
    var out = [], riga = [], campo = "", q = false;
    for (var i = 0; i < testo.length; i++) {
      var c = testo[i];
      if (q) { if (c === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
      else if (c === '"') q = true;
      else if (c === sep) { riga.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && testo[i + 1] === "\n") i++; riga.push(campo); out.push(riga); riga = []; campo = ""; }
      else campo += c;
    }
    if (campo || riga.length) { riga.push(campo); out.push(riga); }
    return out;
  }
  /* Excel (.xlsx): primo foglio, letto nel browser (zip con DecompressionStream). bytes: Uint8Array */
  async function righeXlsx(bytes) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), file = {};
    var fine = -1; for (var i = bytes.length - 22; i >= 0 && i >= bytes.length - 65600; i--) if (dv.getUint32(i, true) === 0x06054b50) { fine = i; break; }
    if (fine < 0) throw new Error("Il file non è un Excel .xlsx: salvatelo come .xlsx o .csv.");
    var n = dv.getUint16(fine + 10, true), p = dv.getUint32(fine + 16, true), dec = new TextDecoder();
    for (var k = 0; k < n; k++) {
      var metodo = dv.getUint16(p + 10, true), dim = dv.getUint32(p + 20, true), ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      file[dec.decode(bytes.subarray(p + 46, p + 46 + ln))] = { metodo: metodo, dim: dim, off: off };
      p += 46 + ln + le + lc;
    }
    async function leggiFile(nome) {
      var f = file[nome]; if (!f) return null;
      var inizio = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true), dati = bytes.subarray(inizio, inizio + f.dim);
      if (f.metodo === 0) return dec.decode(dati);
      var ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(dati); w.close();
      return dec.decode(await new Response(ds.readable).arrayBuffer());
    }
    var xml = function (t) { return t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); };
    var condivise = [], ss = await leggiFile("xl/sharedStrings.xml");
    if (ss) (ss.match(/<si>[\s\S]*?<\/si>/g) || []).forEach(function (si) { condivise.push(xml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(function (t) { return t.replace(/<[^>]+>/g, ""); }).join(""))); });
    var nomeFoglio = Object.keys(file).filter(function (x) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(x); }).sort()[0];
    var foglio = nomeFoglio ? await leggiFile(nomeFoglio) : null;
    if (!foglio) throw new Error("Nel file Excel non trovo il foglio dei movimenti.");
    var col = function (ref) { var l = /^[A-Z]+/.exec(ref)[0], v = 0; for (var j = 0; j < l.length; j++) v = v * 26 + l.charCodeAt(j) - 64; return v - 1; };
    return (foglio.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []).map(function (row) {
      var r = [];
      (row.match(/<c [^>]*?(\/>|>[\s\S]*?<\/c>)/g) || []).forEach(function (c) {
        var ref = /r="([A-Z]+)\d+"/.exec(c), t = /t="([^"]+)"/.exec(c), v = /<v>([\s\S]*?)<\/v>/.exec(c), is = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(c);
        if (!ref) return;
        var val = t && t[1] === "s" && v ? condivise[+v[1]] : t && t[1] === "inlineStr" && is ? xml(is[1]) : t && t[1] === "str" && v ? xml(v[1]) : v ? (isFinite(+v[1]) ? +v[1] : xml(v[1])) : "";
        r[col(ref[1])] = val;
      });
      for (var j = 0; j < r.length; j++) if (r[j] === undefined) r[j] = "";
      return r;
    });
  }

  /* riscontro con i movimenti in valuta di Koinly sugli exchange (versamenti e prelievi): importo uguale (±1% o ±2 €)
     e date entro 7 giorni. movKoinly: [{ data, intermediario, verso: "versamento"|"prelievo", importo }] */
  function riscontra(banca, movKoinly) {
    var usati = {};
    banca.forEach(function (b) {
      var best = null;
      movKoinly.forEach(function (k, i) {
        if (usati[i]) return;
        if ((b.segno < 0) !== (k.verso === "versamento" || k.verso === "acquisto")) return;
        var tol = Math.max(2, k.importo * 0.01), gg = Math.abs((Date.parse(b.data) - Date.parse(k.data)) / 86400000);
        if (Math.abs(k.importo - b.importo) > tol || gg > 7) return;
        if (!best || gg < best.gg) best = { i: i, gg: gg };
      });
      if (best) { usati[best.i] = true; b.riscontro = movKoinly[best.i]; }
    });
    var nonInBanca = movKoinly.filter(function (k, i) { return !usati[i]; });
    return { riscontrati: banca.filter(function (b) { return b.riscontro; }).length, senzaRiscontro: banca.filter(function (b) { return !b.riscontro; }), koinlySenzaBanca: nonInBanca };
  }

  return { leggi: leggi, leggiTabella: leggiTabella, righeCsv: righeCsv, righeXlsx: righeXlsx, riscontra: riscontra, controparte: controparte, importi: importi, data: data };
});
