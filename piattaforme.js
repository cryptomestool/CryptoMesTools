/* CryptoMesTools · Copyright (C) 2026 Massimo Esposito · licenza GNU AGPL-3.0 (file LICENSE) */
/* CryptoMesTools · lettura diretta dei CSV delle piattaforme (senza Koinly).
   Ogni lettore trasforma il file nello stesso elenco di movimenti prodotto da KoinlyDetenzione.leggiTransazioni,
   così costi, detenzione, soglia, RW, RT e sanzioni restano invariati.
   Tipi come Koinly: "trade" (permuta, acquisto, vendita), "deposit", "withdrawal"; etichette: reward, lending_interest,
   airdrop, cashback, tax, cost, swap. I movimenti interni alla stessa piattaforma (Earn, staking, conti) non sono riportati.
   Controvalore: "valore" in euro solo quando il file lo dà in euro (scambi contro EUR); altrimenti «controvalore»
   nella valuta del file (USD per Coinbase e Nexo) oppure assente, da completare con i prezzi di mercato.
   Piattaforme: Binance (Transaction History, con Deposit e Withdraw History per indirizzi e hash e il report fiscale per i
   valori in euro), Coinbase (report delle transazioni) e Coinbase Pro (estratto conto «account»), Nexo, Young Platform, Revolut (sezione Cripto e
   Revolut X), Kraken (Ledgers, da CSV o da API), Relai, Ledger Live, BitBoxApp, Etherscan; l'estratto conto in euro di Revolut è riconosciuto ma non contiene le cripto. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./detenzione.js"));
  else root.KoinlyPiattaforme = factory(root.KoinlyDetenzione);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";

  var FIAT = ["EUR", "USD", "GBP", "CHF"];

  /* ---------- CSV ---------- */
  function righeCsv(testo) {
    var out = [], riga = [], campo = "", q = false;
    testo = String(testo).replace(/^﻿/, "");
    var sep = /;/.test(testo.split(/\r?\n/)[0] || "") && !/,/.test(testo.split(/\r?\n/)[0] || "") ? ";" : ",";
    for (var i = 0; i < testo.length; i++) {
      var c = testo[i];
      if (q) { if (c === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
      else if (c === '"') q = true;
      else if (c === sep) { riga.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && testo[i + 1] === "\n") i++; riga.push(campo); out.push(riga); riga = []; campo = ""; }
      else campo += c;
    }
    if (campo || riga.length) { riga.push(campo); out.push(riga); }
    return out.filter(function (r) { return r.join("").trim(); });
  }
  /* tabella con intestazione: la prima riga (entro le prime 10) che contiene tutte le colonne richieste */
  function tabella(testo, richieste) {
    var t = righeCsv(testo);
    for (var i = 0; i < Math.min(t.length, 10); i++) {
      var h = t[i].map(function (x) { return x.trim(); });
      if (richieste.every(function (n) { return h.indexOf(n) >= 0; })) {
        return t.slice(i + 1).map(function (r, k) { var o = { _riga: i + k + 2 }; h.forEach(function (n, j) { o[n] = (r[j] == null ? "" : r[j]).trim(); }); return o; });
      }
    }
    return null;
  }
  function intestazione(testo) { var t = righeCsv(String(testo).slice(0, 4000)); return t.slice(0, 10).map(function (r) { return r.map(function (x) { return x.trim(); }); }); }
  function haColonne(testo, nomi) { return intestazione(testo).some(function (h) { return nomi.every(function (n) { return h.indexOf(n) >= 0; }); }); }

  /* "2020-10-11 11:01:07" con scarto orario in ore (Binance indica il fuso nel nome del file, es. «(UTC+2)») */
  function data(s, scarto) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || "").trim());
    if (!m) return null;
    return Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - (scarto || 0) * 3600000;
  }
  function scartoDaNome(nome) { var m = /\(UTC([+-]\d{1,2})(?::?(\d{2}))?\)/i.exec(nome || ""); return m ? +m[1] + (m[2] ? Math.sign(+m[1]) * m[2] / 60 : 0) : 0; }
  function num(s) { var t = String(s == null ? "" : s).replace(/[$€\s]/g, "").replace(/,/g, ""); var v = parseFloat(t); return isFinite(v) ? v : 0; }
  function q(s) { return D.dec(String(s == null ? "" : s).replace(/[$€\s,]/g, "")); }
  function abs(v) { return v < 0n ? -v : v; }

  /* movimento nel formato di KoinlyDetenzione.leggiTransazioni */
  function movimento(o) {
    var t = { riga: o.riga || 0, ts: o.ts, tipo: o.tipo, tag: o.tag || "", valore: o.valore || 0, valoreFee: o.valoreFee || 0, valutaValore: "EUR",
      descrizione: o.descrizione || "", walletDa: "", walletA: "", idDa: "", idA: "", txSrc: o.txSrc || "", txDest: o.txDest || "", txHash: o.txHash || "",
      piattaforma: o.wallet, controvalore: o.controvalore || null, fonteValore: o.valore ? "file (EUR)" : o.controvalore ? "file (" + o.controvalore.valuta + ")" : "", voci: [] };
    var v = function (sim, qta, segno, lato) { if (!sim || qta === 0n) return; var s = sim.toUpperCase(); t.voci.push({ valuta: s, simbolo: s, q: segno < 0 ? -abs(qta) : abs(qta), lato: lato }); };
    if (o.da) { v(o.da[0], o.da[1], -1, "da"); t.walletDa = o.wallet; }
    if (o.a) { v(o.a[0], o.a[1], 1, "a"); t.walletA = o.wallet; }
    if (o.fee) { v(o.fee[0], o.fee[1], -1, "fee"); if (!t.walletDa) t.walletDa = o.wallet; }
    // valore in euro dal file quando una delle due gambe è in euro
    if (!t.valore) t.voci.forEach(function (x) { if (x.simbolo === "EUR" && x.lato !== "fee") t.valore = D.decNum(abs(x.q)); });
    if (t.valore && !t.fonteValore) t.fonteValore = "file (EUR)";
    return t.voci.length ? t : null;
  }

  /* ---------- Binance ---------- */
  var BIN_SCAMBI = /^(Buy|Sell|Fee|Transaction (Buy|Spend|Sold|Revenue|Fee)|Binance Convert|Small Assets Exchange BNB|Large OTC trading|Auto-Invest Transaction|ETH 2\.0 Staking)$/i;
  var BIN_INTERNI = /^(Simple Earn (Flexible|Locked) (Subscription|Redemption)|Staking (Purchase|Redemption)|Savings (Purchase|Principal redemption)|Transfer Between (Main|Spot|Funding).*|Transfer (Between|from|to).*|Main and Funding Account Transfer|Funding Account Transfer|Launchpool Subscription\/Redemption|Pool Distribution|Collateral.*|Isolated Margin Loan|Margin Loan)$/i;
  var BIN_PROVENTI = [[/Simple Earn .*Interest|Savings Interest|Launchpool Interest|Launchpool Airdrop - System Distribution|BNB Vault Rewards|Liquid Swap rewards/i, "lending_interest"],
    [/Staking Rewards|ETH 2\.0 Staking Rewards|DOT Slot Auction Rewards|POS savings interest/i, "reward"], [/Airdrop|Distribution|HODLer/i, "airdrop"],
    [/Cashback|Card Cashback|Commission Rebate|Referral/i, "cashback"], [/Mission Reward|Learn and Earn|Crypto Box/i, "reward"]];
  function righeBinance(testo, nome) {
    var r = tabella(testo, ["Operation", "Coin", "Change"]);
    if (!r) return null;
    var colT = r.length && r[0].UTC_Time != null ? "UTC_Time" : "Time", noto = colT === "UTC_Time" || /\(UTC[+-]/i.test(nome || ""), scarto = colT === "UTC_Time" ? 0 : scartoDaNome(nome);
    r.forEach(function (x) { x.ts = data(x[colT], scarto); x.op = x.Operation; x.q = q(x.Change); });
    r = r.filter(function (x) { return x.ts != null && x.q !== 0n; });
    r.fusoNoto = noto;
    return r;
  }
  /* più storici Binance (anche sovrapposti o con le righe in altro ordine): ogni riga conta una volta; righe identiche
     nello stesso file (due esecuzioni uguali nello stesso secondo) restano quante sono nel file che ne ha di più */
  function unisciBinance(files, avvisi) {
    var out = [], cont = {};
    var chiave = function (x, sp) { return [x.ts + (sp || 0), x.Account, x.Operation, x.Coin, D.decStr(x.q), x.Remark].join("|"); };
    var lette = files.map(function (f) { return { f: f, r: righeBinance(f.testo, f.nome) }; }).filter(function (z) { return z.r; });
    // prima i file con il fuso indicato nel nome («(UTC+2)»); per gli altri il fuso si ricava confrontando le righe già lette
    lette.sort(function (a, b) { return (b.r.fusoNoto ? 1 : 0) - (a.r.fusoNoto ? 1 : 0); });
    lette.forEach(function (z) {
      var r = z.r;
      if (!r.fusoNoto) {
        var migliore = 0, best = -1, campione = r.slice(0, 2000);
        if (out.length) for (var h = -12; h <= 14; h++) { var n = 0; campione.forEach(function (x) { if (cont[chiave(x, -h * 3600000)]) n++; }); if (n > best) { best = n; migliore = h; } }
        if (migliore) r.forEach(function (x) { x.ts -= migliore * 3600000; });
        if (avvisi) avvisi.push("«" + z.f.nome + "»: il nome del file non indica il fuso orario" + (out.length && best > 0 ? "; ricavato UTC" + (migliore >= 0 ? "+" : "") + migliore + " confrontando le righe con gli altri storici." : "; ore lette come UTC, da verificare."));
      }
      var loc = {};
      r.forEach(function (x) {
        var k = chiave(x);
        loc[k] = (loc[k] || 0) + 1;
        if (loc[k] > (cont[k] || 0)) { cont[k] = loc[k]; out.push(x); }
      });
    });
    return out;
  }
  function leggiBinance(testo, nome, extra) {
    var avvisi = [], mov = [], W = "Binance";
    var r = Array.isArray(testo) ? unisciBinance(testo, avvisi) : righeBinance(testo, nome);
    if (!r) return { errore: "File Binance senza le colonne Operation, Coin, Change." };
    r.sort(function (a, b) { return a.ts - b.ts || a._riga - b._riga; });
    var usati = {};
    // depositi e prelievi: indirizzi e hash dai file Deposit e Withdraw History, se caricati
    var abbina = function (lista, x, quantita) {
      if (!lista) return null;
      var best = null;
      lista.forEach(function (d, i) { if (d.usato || d.coin !== x.Coin) return; var dt = Math.abs(d.ts - x.ts); if (dt > 6 * 3600000) return; if (abs(d.q - quantita) > abs(quantita) / 1000n) return; if (!best || dt < best.dt) best = { d: d, dt: dt }; });
      if (best) best.d.usato = true;
      return best && best.d;
    };
    var gruppi = {}, ordine = [];
    r.forEach(function (x, i) {
      var op = x.op;
      if (BIN_SCAMBI.test(op)) {
        // gli scambi si raggruppano per secondo; il Binance Convert a volte scrive le due gambe a un secondo di distanza
        var k = Math.floor(x.ts / 1000);
        if (/Convert/i.test(op) && !gruppi[k] && gruppi[k - 1] && /Convert/i.test(gruppi[k - 1][0].op)) k = k - 1;
        if (!gruppi[k]) { gruppi[k] = []; ordine.push(k); }
        gruppi[k].push(x); return;
      }
      if (BIN_INTERNI.test(op) || /^On-Chain - Payment$/i.test(op)) { usati.interni = (usati.interni || 0) + 1; return; }
      if (/^Deposit$/i.test(op) && x.q > 0n) {
        var d = abbina(extra && extra.depositi, x, x.q);
        mov.push(movimento({ riga: x._riga, ts: x.ts, tipo: "deposit", wallet: W, a: [x.Coin, x.q], txHash: d ? d.txid : "", txSrc: d ? d.indirizzo : "", descrizione: op + (d ? " (" + d.rete + ")" : "") }));
        return;
      }
      if (/^(Withdraw|Fiat Withdraw)$/i.test(op) && x.q < 0n) {
        var w = abbina(extra && extra.prelievi, x, abs(x.q));
        var fee = w ? w.fee : 0n, netto = abs(x.q) - fee;
        mov.push(movimento({ riga: x._riga, ts: x.ts, tipo: "withdrawal", wallet: W, da: [x.Coin, netto], fee: fee ? [x.Coin, fee] : null, txHash: w ? w.txid : "", txDest: w ? w.indirizzo : "", descrizione: op + (x.Remark ? " · " + x.Remark : "") }));
        return;
      }
      if (/^(Deposit|Fiat Deposit)$/i.test(op)) { mov.push(movimento({ riga: x._riga, ts: x.ts, tipo: "deposit", wallet: W, a: [x.Coin, x.q], descrizione: op })); return; }
      if (/^Tax (Payment|Liquidation)$/i.test(op)) { mov.push(movimento({ riga: x._riga, ts: x.ts, tipo: "withdrawal", tag: "tax", wallet: W, da: [x.Coin, x.q], descrizione: op + (x.Remark ? " · " + x.Remark : "") })); return; }
      if (/^(Fund Recovery|Asset - Transfer)$/i.test(op) && x.q < 0n) { mov.push(movimento({ riga: x._riga, ts: x.ts, tipo: "withdrawal", tag: "cost", wallet: W, da: [x.Coin, x.q], descrizione: op + (x.Remark ? " · " + x.Remark : "") })); avvisi.push("Riga " + x._riga + ": «" + op + "» " + x.Change + " " + x.Coin + " trattata come uscita senza corrispettivo, da verificare."); return; }
      if (/Token Swap - Redenomination|Rebranding/i.test(op) && x.q < 0n) {
        // rinomina (es. NANO → XNO): si abbina alla Distribution della nuova cripto con la stessa quantità
        var nuova = r.filter(function (y) { return !y.usata && /Distribution/i.test(y.op) && y.q === abs(x.q) && new RegExp("^" + x.Coin + " to ", "i").test(y.Remark || ""); })[0];
        if (nuova) { nuova.usata = true; mov.push(movimento({ riga: x._riga, ts: nuova.ts, tipo: "trade", tag: "swap", wallet: W, da: [x.Coin, x.q], a: [nuova.Coin, nuova.q], descrizione: "Rinomina " + x.Coin + " → " + nuova.Coin })); return; }
      }
      if (x.q > 0n) {
        var tag = ""; BIN_PROVENTI.forEach(function (p) { if (!tag && p[0].test(op)) tag = p[1]; });
        if (/Distribution/i.test(op) && x.usata) return;
        if (tag) { mov.push(movimento({ riga: x._riga, ts: x.ts, tipo: "deposit", tag: tag, wallet: W, a: [x.Coin, x.q], descrizione: op + (x.Remark ? " · " + x.Remark : "") })); return; }
      }
      // tutto il resto: entrata o uscita da verificare
      mov.push(movimento({ riga: x._riga, ts: x.ts, tipo: x.q > 0n ? "deposit" : "withdrawal", wallet: W, a: x.q > 0n ? [x.Coin, x.q] : null, da: x.q < 0n ? [x.Coin, x.q] : null, descrizione: op + (x.Remark ? " · " + x.Remark : "") }));
      avvisi.push("Riga " + x._riga + ": operazione Binance «" + op + "» non riconosciuta, letta come " + (x.q > 0n ? "entrata" : "uscita") + " di " + x.Change + " " + x.Coin + ".");
    });
    // Distribution già abbinate a una rinomina: tolte
    mov = mov.filter(function (m) { return m; });
    var rin = r.filter(function (y) { return y.usata; }).map(function (y) { return y._riga; });
    mov = mov.filter(function (m) { return rin.indexOf(m.riga) < 0; });
    ordine.forEach(function (k) { scambiBinance(gruppi[k], W).forEach(function (m) { mov.push(m); }); });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    var res = risultato("Binance", mov, avvisi, r.length);
    res.interni = usati.interni || 0;
    if (extra && extra.depositi) res.senzaHash = mov.filter(function (m) { return m.tipo === "deposit" && !m.tag && !m.txHash && m.voci.some(function (v) { return FIAT.indexOf(v.simbolo) < 0; }); }).length;
    return res;
  }
  /* righe di uno stesso secondo → una permuta per coppia di cripto (uscita, entrata), con la commissione */
  function scambiBinance(g, W) {
    var out = [], cur = null, coppie = {};
    var chiudi = function () {
      if (!cur) return;
      var k = (cur.da ? cur.da[0] : "") + ">" + (cur.a ? cur.a[0] : "");
      var c = coppie[k];
      if (c) { if (cur.da) c.da[1] += cur.da[1]; if (cur.a) c.a[1] += cur.a[1]; cur.fee.forEach(function (f) { c.fee.push(f); }); }
      else { coppie[k] = cur; out.push(cur); }
      cur = null;
    };
    // Small Assets Exchange: le righe indicano la coppia nella colonna Remark («SOL to BNB»)
    var piccoli = g.every(function (x) { return /Small Assets/i.test(x.op); });
    if (piccoli) {
      var usc = g.filter(function (x) { return x.q < 0n; }), ent = g.filter(function (x) { return x.q > 0n; });
      usc.forEach(function (u, i) {
        var e = ent.filter(function (y) { return !y.preso && (y.Remark && u.Remark ? y.Remark === u.Remark : true); })[0];
        if (e) e.preso = true;
        out.push({ da: [u.Coin, abs(u.q)], a: e ? [e.Coin, e.q] : null, fee: [], riga: u._riga, ts: u.ts, op: u.op });
      });
      ent.filter(function (y) { return !y.preso; }).forEach(function (e) { if (out.length) { var o = out[out.length - 1]; if (o.a && o.a[0] === e.Coin) o.a[1] += e.q; } });
    } else {
      // l'ordine delle righe nello stesso secondo non è affidabile: si sommano le quantità per cripto
      var net = {}, fees = [], prima = g[0];
      g.forEach(function (x) { if (/Fee/i.test(x.op)) fees.push([x.Coin, abs(x.q)]); else net[x.Coin] = (net[x.Coin] || 0n) + x.q; });
      var usc = Object.keys(net).filter(function (k) { return net[k] < 0n; }), ent = Object.keys(net).filter(function (k) { return net[k] > 0n; });
      if (usc.length <= 1 && ent.length <= 1) out.push({ da: usc.length ? [usc[0], abs(net[usc[0]])] : null, a: ent.length ? [ent[0], net[ent[0]]] : null, fee: fees, riga: prima._riga, ts: prima.ts, op: prima.op });
      else {
        // più coppie nello stesso secondo: abbinamento nell'ordine delle righe, commissioni sul primo scambio
        g.forEach(function (x) {
          if (/Fee/i.test(x.op)) return;
          if (x.q < 0n) { if (cur && (cur.a && cur.da || cur.da && cur.da[0] !== x.Coin)) chiudi(); if (!cur) cur = { fee: [], riga: x._riga, ts: x.ts, op: x.op }; if (cur.da) cur.da[1] += abs(x.q); else cur.da = [x.Coin, abs(x.q)]; }
          else { if (cur && (cur.a && cur.da || cur.a && cur.a[0] !== x.Coin)) chiudi(); if (!cur) cur = { fee: [], riga: x._riga, ts: x.ts, op: x.op }; if (cur.a) cur.a[1] += x.q; else cur.a = [x.Coin, x.q]; }
        });
        chiudi();
        if (out.length) out[0].fee = fees;
      }
    }
    return out.map(function (s) {
      // commissioni: si sommano per cripto; se ce n'è più d'una, la seconda resta come uscita separata
      var fee = {}; s.fee.forEach(function (f) { fee[f[0]] = (fee[f[0]] || 0n) + f[1]; });
      var fk = Object.keys(fee);
      var tipo = s.da && s.a ? "trade" : s.a ? "deposit" : "withdrawal";
      // la commissione nella cripto ricevuta o ceduta resta sullo scambio; le altre (es. BNB) diventano uscite di costo come in Koinly
      var fp = fk.filter(function (k) { return (s.a && s.a[0] === k) || (s.da && s.da[0] === k); })[0] || fk[0];
      var m = movimento({ riga: s.riga, ts: s.ts, tipo: tipo, wallet: W, da: s.da, a: s.a, fee: fp ? [fp, fee[fp]] : null, descrizione: s.op });
      if (m && tipo !== "trade") m.descrizione += " (scambio incompleto: una sola gamba nel file)";
      var res = [m];
      fk.filter(function (k) { return k !== fp; }).forEach(function (k) { res.push(movimento({ riga: s.riga, ts: s.ts, tipo: "withdrawal", tag: "cost", wallet: W, da: [k, fee[k]], descrizione: "Commissione dello scambio" })); });
      return res;
    }).reduce(function (a, b) { return a.concat(b); }, []).filter(Boolean);
  }
  function leggiBinanceMovimentiEsterni(testo, nome, tipo) {
    var r = tabella(testo, ["Coin", "Amount", "TXID"]);
    if (!r) return null;
    var colT = r.length && r[0]["Date(UTC)"] != null ? "Date(UTC)" : r.length && r[0].UTC_Time != null ? "UTC_Time" : "Time";
    var scarto = /UTC/.test(colT) ? 0 : scartoDaNome(nome);
    return r.filter(function (x) { return !x.Status || /Completed|Success/i.test(x.Status); }).map(function (x) {
      return { ts: data(x[colT], scarto), coin: x.Coin, rete: x.Network || "", q: q(x.Amount), fee: x.Fee ? q(x.Fee) : 0n, indirizzo: x.Address || "", txid: x.TXID || "" };
    }).map(function (x) { if (tipo === "prelievi") x.q = x.q + x.fee; return x; });
  }

  /* ---------- Coinbase ---------- */
  var CB_INTERNI = /^(Pro Deposit|Pro Withdrawal|Exchange Deposit|Exchange Withdrawal|Retail Staking Transfer|Retail Unstaking Transfer|Retail Eth2 Deprecation|Staking Transfer|Unstaking Transfer)$/i;
  function leggiCoinbase(testo) {
    var r = Array.isArray(testo) ? testo : tabella(testo, ["Timestamp", "Transaction Type", "Asset", "Quantity Transacted"]);
    if (!r) return { errore: "File Coinbase senza le colonne Timestamp, Transaction Type, Asset, Quantity Transacted." };
    var mov = [], avvisi = [], W = "Coinbase", interni = 0, pro = {}, trasfPro = [];
    r.forEach(function (x) {
      var ts = data(x.Timestamp, 0); if (ts == null) return;
      var tipo = x["Transaction Type"], sim = x.Asset, qta = q(x["Quantity Transacted"]), note = x.Notes || "";
      var valuta = (x["Price Currency"] || "USD").toUpperCase();
      var cv = function () { var s = Math.abs(num(x.Subtotal)) || Math.abs(num(x["Price at Transaction"]) * D.decNum(abs(qta))); return s ? { importo: s, valuta: valuta } : null; };
      var base = { riga: x._riga, ts: ts, wallet: W, txHash: x.ID ? "" : "", descrizione: tipo + (note ? " · " + note : "") };
      var m, mm;
      if (CB_INTERNI.test(tipo)) {
        // Coinbase Pro / Exchange: conto separato; le sue operazioni non sono in questo file
        interni++; pro[sim] = (pro[sim] || 0n) + (/Deposit/i.test(tipo) ? abs(qta) : -abs(qta)); trasfPro.push({ ts: ts, sim: sim.toUpperCase(), q: /Deposit/i.test(tipo) ? abs(qta) : -abs(qta) }); return;
      }
      if (/Buy|Sell/i.test(tipo) && (mm = /(Bought|Sold) ([\d.,]+) (\w+) for ([\d.,]+) (\w+)/i.exec(note))) {
        var acq = /Bought/i.test(mm[1]);
        var qa = q(mm[2]), sa = mm[3], qb = q(mm[4]), sb = mm[5];
        m = Object.assign(base, { tipo: "trade", da: acq ? [sb, qb] : [sa, qa], a: acq ? [sa, qa] : [sb, qb], controvalore: cv() });
      } else if (/Convert/i.test(tipo) && (mm = /Converted ([\d.,]+) (\w+) to ([\d.,]+) (\w+)/i.exec(note))) {
        m = Object.assign(base, { tipo: "trade", da: [mm[2], q(mm[1])], a: [mm[4], q(mm[3])], controvalore: cv() });
      } else if (/^(Buy|Advanced Trade Buy)$/i.test(tipo)) {
        var tot = num(x["Total (inclusive of fees and/or spread)"]);
        m = Object.assign(base, { tipo: "trade", da: [valuta, q(Math.abs(tot).toFixed(8))], a: [sim, qta], controvalore: cv() });
      } else if (/^(Sell|Advanced Trade Sell)$/i.test(tipo)) {
        var tot2 = num(x["Total (inclusive of fees and/or spread)"]);
        m = Object.assign(base, { tipo: "trade", da: [sim, qta], a: [valuta, q(Math.abs(tot2).toFixed(8))], controvalore: cv() });
      } else if (/^(Deposit)$/i.test(tipo)) m = Object.assign(base, { tipo: "deposit", a: [sim, qta], controvalore: cv() });
      else if (/^(Withdrawal)$/i.test(tipo)) m = Object.assign(base, { tipo: "withdrawal", da: [sim, qta], controvalore: cv() });
      else if (/^(Receive)$/i.test(tipo)) m = Object.assign(base, { tipo: "deposit", a: [sim, qta], txSrc: x["Sender Address"] || "", controvalore: cv() });
      else if (/^(Send)$/i.test(tipo)) m = Object.assign(base, { tipo: "withdrawal", da: [sim, qta], txDest: x["Recipient Address"] || "", controvalore: cv() });
      else if (/Reward|Staking Income|Inflation Reward|Learning Reward|Coinbase Earn/i.test(tipo)) m = Object.assign(base, { tipo: "deposit", tag: /Learning|Earn/i.test(tipo) ? "reward" : "reward", a: [sim, qta], controvalore: cv() });
      else {
        m = Object.assign(base, { tipo: qta > 0n ? "deposit" : "withdrawal", a: qta > 0n ? [sim, qta] : null, da: qta < 0n ? [sim, qta] : null, controvalore: cv() });
        avvisi.push("Riga " + x._riga + ": operazione Coinbase «" + tipo + "» non riconosciuta, letta come " + (qta > 0n ? "entrata" : "uscita") + ".");
      }
      var t = movimento(m); if (t) mov.push(t);
    });
    var res = risultato("Coinbase", mov, avvisi, r.length);
    res.interni = interni;
    res.trasfPro = trasfPro;
    var pk = Object.keys(pro).filter(function (k) { return pro[k] !== 0n; });
    if (pk.length) res.avvisi.push("Trasferimenti verso e da Coinbase Pro / Advanced (conto separato) non in pareggio: " + pk.map(function (k) { return D.decStr(pro[k], 8) + " " + k; }).join(", ") + ". Gli scambi fatti su Coinbase Pro non sono in questo file: serve l'estratto «fills» o «account» di Coinbase Pro.");
    return res;
  }

  /* ---------- Nexo ---------- */
  var NEXO_INTERNI = /^(Locking Term Deposit|Unlocking Term Deposit|Transfer Out|Transfer In|Credit Card Withdrawal Credit|Exchange Credit|Deposit To Exchange)$/i;
  function leggiNexo(testo) {
    var r = Array.isArray(testo) ? testo : tabella(testo, ["Transaction", "Type", "Input Currency", "Input Amount", "Output Currency", "Output Amount"]);
    if (!r) return { errore: "File Nexo senza le colonne Transaction, Type, Input/Output Currency e Amount." };
    var mov = [], avvisi = [], W = "Nexo", interni = 0;
    var colT = r.length && r[0]["Date / Time (UTC)"] != null ? "Date / Time (UTC)" : "Date / Time";
    r.forEach(function (x) {
      var ts = data(x[colT], 0); if (ts == null) return;
      if (x.Details && !/^approved/i.test(x.Details)) return;
      var tipo = x.Type, iC = nexoSim(x["Input Currency"]), iQ = q(x["Input Amount"]), oC = nexoSim(x["Output Currency"]), oQ = q(x["Output Amount"]);
      var usd = num(x["USD Equivalent"]), cv = usd ? { importo: usd, valuta: "USD" } : null;
      var fee = x.Fee && x.Fee !== "-" ? [nexoSim(x["Fee Currency"]), q(x.Fee)] : null;
      var hash = /approved \/ (0x[0-9a-f]{64}|[0-9a-f]{64})/i.exec(x.Details || "");
      var base = { riga: x._riga, ts: ts, wallet: W, controvalore: cv, descrizione: tipo + " · " + (x.Details || "").replace(/^approved \/ /i, ""), txHash: hash ? hash[1] : x.Transaction }, m;
      if (tipo === "Deposit To Exchange" && iC === "EUR") { m = Object.assign(base, { tipo: "deposit", a: ["EUR", iQ] }); }
      else if (NEXO_INTERNI.test(tipo)) { interni++; return; }
      else if (/Interest|Dividend/i.test(tipo)) m = Object.assign(base, { tipo: "deposit", tag: "lending_interest", a: [oC, oQ] });
      else if (/Cashback|Referral Bonus|Bonus/i.test(tipo)) m = Object.assign(base, { tipo: "deposit", tag: /Cashback/i.test(tipo) ? "cashback" : "reward", a: [oC, oQ] });
      else if (/^Exchange|Exchange Deposited On|Exchange To Withdraw/i.test(tipo)) m = Object.assign(base, { tipo: "trade", da: [iC, iQ], a: [oC, oQ] });
      else if (/^(Withdrawal|Withdraw Exchanged)$/i.test(tipo)) m = Object.assign(base, { tipo: "withdrawal", da: [oC, oQ], fee: fee || (abs(iQ) > abs(oQ) ? [iC, abs(iQ) - abs(oQ)] : null) });
      else if (/Top up Crypto|^Deposit$|Top Up/i.test(tipo)) m = Object.assign(base, { tipo: "deposit", a: [oC, oQ] });
      else if (/Nexo Card Purchase/i.test(tipo)) { m = Object.assign(base, { tipo: "withdrawal", tag: "cost", da: [iC, iQ] }); avvisi.push("Riga " + x._riga + ": spesa con la Nexo Card (" + x["Input Amount"] + " " + iC + "), letta come uscita senza corrispettivo; verificare se pagata con la linea di credito."); }
      else if (/Fee/i.test(tipo)) m = Object.assign(base, { tipo: "withdrawal", tag: "cost", da: [iC, iQ] });
      else if (/Loan|Credit|Repayment|Liquidation/i.test(tipo)) { m = Object.assign(base, { tipo: iQ < 0n ? "withdrawal" : "deposit", tag: "loan", da: iQ < 0n ? [iC, iQ] : null, a: iQ > 0n ? [iC, iQ] : null }); avvisi.push("Riga " + x._riga + ": movimento della linea di credito Nexo «" + tipo + "», da verificare."); }
      else { m = Object.assign(base, { tipo: iQ < 0n ? "withdrawal" : "deposit", da: iQ < 0n ? [iC, iQ] : null, a: iQ >= 0n ? [oC, oQ] : null }); avvisi.push("Riga " + x._riga + ": operazione Nexo «" + tipo + "» non riconosciuta."); }
      var t = movimento(m); if (t) mov.push(t);
    });
    var res = risultato("Nexo", mov, avvisi, r.length);
    res.interni = interni;
    return res;
  }
  /* Nexo usa EURX e USDX (o XUSD) per i saldi in euro e dollari, che qui tornano EUR e USD, e «NEXONEXO» per il token */
  function nexoSim(s) { var t = String(s || "").trim().toUpperCase(); return t === "NEXONEXO" ? "NEXO" : t === "EURX" ? "EUR" : t === "USDX" || t === "XUSD" ? "USD" : t; }

  /* ---------- Young Platform ---------- */
  function leggiYoung(testo) {
    var r = Array.isArray(testo) ? testo : tabella(testo, ["credit", "debit", "currency", "date", "tx_type"]);
    if (!r) return { errore: "File Young Platform senza le colonne credit, debit, currency, date, tx_type." };
    var mov = [], avvisi = [], W = "Young Platform", interni = 0, ordini = [];
    r.forEach(function (x) {
      x.ts = Date.parse(x.date); x.qq = q(x.credit) - q(x.debit);
    });
    r = r.filter(function (x) { return isFinite(x.ts) && x.qq !== 0n; }).sort(function (a, b) { return a.ts - b.ts || a._riga - b._riga; });
    r.forEach(function (x) {
      var t = x.tx_type.toUpperCase(), base = { riga: x._riga, ts: x.ts, wallet: W, descrizione: t };
      if (/SAVINGS|LOCK|STAKE_(IN|OUT)/.test(t) && !/REWARD|INTEREST/.test(t)) { interni++; return; }
      if (/^(ORDER_(PLACEMENT|MATCHED|CANCEL)|RFQ)/.test(t)) { ordini.push(x); return; }
      var m;
      if (/DEPOSIT/.test(t)) m = Object.assign(base, { tipo: "deposit", a: [x.currency, x.qq] });
      else if (/WITHDRAW/.test(t)) m = Object.assign(base, { tipo: "withdrawal", da: [x.currency, x.qq] });
      else if (/REWARD|INTEREST|BONUS|CASHBACK|AIRDROP/.test(t) && x.qq > 0n) m = Object.assign(base, { tipo: "deposit", tag: /AIRDROP/.test(t) ? "airdrop" : /CASHBACK/.test(t) ? "cashback" : "reward", a: [x.currency, x.qq] });
      else if (/FEE/.test(t)) m = Object.assign(base, { tipo: "withdrawal", tag: "cost", da: [x.currency, x.qq] });
      else if (/ADMIN/.test(t) && x.qq < 0n) { m = Object.assign(base, { tipo: "withdrawal", tag: "cost", da: [x.currency, x.qq], descrizione: "Addebito amministrativo" }); avvisi.push("Riga " + x._riga + ": addebito amministrativo Young Platform di " + x.debit + " " + x.currency + ", letto come costo."); }
      else { m = Object.assign(base, { tipo: x.qq > 0n ? "deposit" : "withdrawal", a: x.qq > 0n ? [x.currency, x.qq] : null, da: x.qq < 0n ? [x.currency, x.qq] : null }); avvisi.push("Riga " + x._riga + ": operazione Young Platform «" + t + "» non riconosciuta."); }
      var tt = movimento(m); if (tt) mov.push(tt);
    });
    // ordini: ogni ORDER_PLACEMENT (uscita) si abbina al primo ORDER_MATCHED (entrata) che lo segue entro 10 secondi;
    // ORDER_CANCELLED restituisce l'importo di un ordine non eseguito; RFQ (acquisto rapido) ha le due gambe nello stesso istante
    var aperti = [];
    ordini.forEach(function (x) {
      if (x.qq < 0n) { aperti.push(x); return; }
      if (/CANCEL/i.test(x.tx_type)) { var j = -1; for (var z = aperti.length - 1; z >= 0; z--) if (aperti[z].currency === x.currency && -aperti[z].qq === x.qq) { j = z; break; } if (j >= 0) aperti.splice(j, 1); else { var tr = movimento({ riga: x._riga, ts: x.ts, tipo: "deposit", wallet: W, a: [x.currency, x.qq], descrizione: "Ordine annullato" }); if (tr) mov.push(tr); avvisi.push("Riga " + x._riga + ": ordine annullato senza l'ordine di partenza."); } return; }
      var i = -1; for (var k = 0; k < aperti.length; k++) if (x.ts - aperti[k].ts <= 10000 && aperti[k].currency !== x.currency) { i = k; break; }
      if (i >= 0) { var u = aperti.splice(i, 1)[0]; var tt = movimento({ riga: u._riga, ts: x.ts, tipo: "trade", wallet: W, da: [u.currency, u.qq], a: [x.currency, x.qq], descrizione: "Ordine" }); if (tt) mov.push(tt); }
      else { var t2 = movimento({ riga: x._riga, ts: x.ts, tipo: "deposit", wallet: W, a: [x.currency, x.qq], descrizione: x.tx_type }); if (t2) mov.push(t2); avvisi.push("Riga " + x._riga + ": ordine eseguito senza la corrispondente uscita."); }
    });
    aperti.forEach(function (u) { var t3 = movimento({ riga: u._riga, ts: u.ts, tipo: "withdrawal", wallet: W, da: [u.currency, u.qq], descrizione: u.tx_type }); if (t3) mov.push(t3); avvisi.push("Riga " + u._riga + ": ordine senza esecuzione abbinata, letto come uscita."); });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    var res = risultato("Young Platform", mov, avvisi, r.length);
    res.interni = interni;
    return res;
  }

  /* ---------- Coinbase Pro (estratto conto «account»: deposit, withdrawal, match, fee) ---------- */
  function leggiCoinbasePro(testo) {
    var r = Array.isArray(testo) ? testo : tabella(testo, ["type", "time", "amount", "amount/balance unit", "trade id"]);
    if (!r) return { errore: "Estratto Coinbase Pro senza le colonne type, time, amount, amount/balance unit, trade id." };
    var mov = [], avvisi = [], W = "Coinbase", scambi = {}, ordine = [];
    r.forEach(function (x) {
      var ts = Date.parse(x.time); if (!isFinite(ts)) return;
      var tipo = x.type.toLowerCase(), u = x["amount/balance unit"].toUpperCase(), qq = q(x.amount);
      if (qq === 0n) return;
      if (tipo === "match" || tipo === "fee") {
        var k = x["trade id"] + "|" + (x["order id"] || "");
        if (!scambi[k]) { scambi[k] = { ts: ts, riga: x._riga, voci: [], fee: [] }; ordine.push(k); }
        (tipo === "fee" ? scambi[k].fee : scambi[k].voci).push([u, qq]);
        return;
      }
      if (tipo === "deposit" || tipo === "withdrawal") {
        var t = movimento({ riga: x._riga, ts: ts, tipo: tipo === "deposit" ? "deposit" : "withdrawal", wallet: W, a: qq > 0n ? [u, qq] : null, da: qq < 0n ? [u, qq] : null, descrizione: "Coinbase Pro " + tipo });
        if (t) { t.pro = { ts: ts, sim: u, q: qq }; mov.push(t); }
        return;
      }
      var t2 = movimento({ riga: x._riga, ts: ts, tipo: qq > 0n ? "deposit" : "withdrawal", wallet: W, a: qq > 0n ? [u, qq] : null, da: qq < 0n ? [u, qq] : null, descrizione: "Coinbase Pro " + tipo });
      if (t2) mov.push(t2);
      avvisi.push("Riga " + x._riga + ": voce Coinbase Pro «" + x.type + "» non riconosciuta.");
    });
    var buchi = buchiSaldoPro(r);
    if (buchi.length) {
      var perMese = {}; buchi.forEach(function (b) { var k = b.mese + " " + b.unita; perMese[k] = (perMese[k] || 0n) + b.diff; });
      avvisi.push("Il saldo riportato nell'estratto Coinbase Pro salta in " + buchi.length + " punti: mancano righe nei file. Differenze per mese (+ entrate mancanti, − uscite mancanti): " +
        Object.keys(perMese).sort().filter(function (k) { return perMese[k] !== 0n; }).map(function (k) { return k + " " + (perMese[k] > 0n ? "+" : "") + D.decStr(perMese[k], 8); }).join("; ") + ". Richiedere gli estratti di quei mesi.");
    }
    ordine.forEach(function (k) {
      var s = scambi[k], net = {};
      s.voci.forEach(function (v) { net[v[0]] = (net[v[0]] || 0n) + v[1]; });
      var usc = Object.keys(net).filter(function (c) { return net[c] < 0n; })[0], ent = Object.keys(net).filter(function (c) { return net[c] > 0n; })[0];
      var fee = {}; s.fee.forEach(function (f) { fee[f[0]] = (fee[f[0]] || 0n) + abs(f[1]); });
      var fk = Object.keys(fee)[0];
      var t = movimento({ riga: s.riga, ts: s.ts, tipo: usc && ent ? "trade" : ent ? "deposit" : "withdrawal", wallet: W, da: usc ? [usc, net[usc]] : null, a: ent ? [ent, net[ent]] : null, fee: fk ? [fk, fee[fk]] : null, descrizione: "Coinbase Pro trade " + k.split("|")[0] });
      if (t) mov.push(t);
    });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    return risultato("Coinbase Pro", mov, avvisi, r.length);
  }

  /* continuità del saldo (colonna balance) per valuta: le righe dello stesso istante possono essere in qualunque ordine,
     quindi il controllo è sul saldo dopo l'intero gruppo */
  function buchiSaldoPro(r) {
    if (!r.length || r[0].balance == null) return [];
    var per = {}, out = [], tol = D.UNO / 100000000n;
    r.forEach(function (x) { var u = (x["amount/balance unit"] || "").toUpperCase(); (per[u] = per[u] || []).push(x); });
    Object.keys(per).forEach(function (u) {
      var l = per[u].slice().sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; }), prec = 0n, i = 0;
      while (i < l.length) {
        var j = i, somma = 0n, saldi = [];
        while (j < l.length && l[j].time === l[i].time) { somma += q(l[j].amount); saldi.push(q(l[j].balance)); j++; }
        var dopo = prec + somma, d = null;
        saldi.forEach(function (b) { var x = b - dopo; if (d === null || abs(x) < abs(d)) d = x; });
        if (abs(d) > tol) out.push({ mese: l[i].time.slice(0, 7), unita: u, diff: d, data: l[i].time.slice(0, 10) });
        prec = dopo + (abs(d) > tol ? d : 0n);
        i = j;
      }
    });
    return out;
  }

  /* ---------- report fiscale Binance (Tax report: valori in euro di ogni operazione) ---------- */
  /* ora locale italiana (colonna datetime_tz_CET, con l'ora legale) → UTC */
  function romaUTC(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[-T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || "").trim()); if (!m) return null;
    var y = +m[1], loc = Date.UTC(y, m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    var ultimaDom = function (mese) { var d = new Date(Date.UTC(y, mese + 1, 0)); return Date.UTC(y, mese, d.getUTCDate() - d.getUTCDay(), 1); };
    var estate = loc - 3600000 >= ultimaDom(2) && loc - 7200000 < ultimaDom(9);
    return loc - (estate ? 7200000 : 3600000);
  }
  function righeFiscaleBinance(testo) {
    var r = tabella(testo, ["datetime_tz_CET", "type", "sent_amount", "sent_currency", "sent_value_EUR", "received_amount", "received_currency", "received_value_EUR"]);
    if (!r) return null;
    return r.map(function (x) {
      return { ts: romaUTC(x.datetime_tz_CET), tipo: x.type, modo: x.market_model_type, riga: x._riga, id: x.id,
        sC: (x.sent_currency || "").toUpperCase(), sQ: q(x.sent_amount), sV: num(x.sent_value_EUR), sAddr: x.sent_address || "",
        rC: (x.received_currency || "").toUpperCase(), rQ: q(x.received_amount), rV: num(x.received_value_EUR), rAddr: x.received_address || "",
        fC: (x.fee_currency || "").toUpperCase(), fQ: q(x.fee_amount), fV: num(x.fee_value_EUR) };
    }).filter(function (x) { return x.ts != null; });
  }
  /* il report fiscale da solo, quando manca lo storico completo */
  function leggiFiscaleBinance(righe) {
    var mov = [], avvisi = [], W = "Binance";
    righe.forEach(function (x) {
      var o = { riga: x.riga, ts: x.ts, wallet: W, descrizione: x.tipo + " " + x.modo, txHash: "" };
      if (x.sQ > 0n && x.rQ > 0n) { o.tipo = "trade"; o.da = [x.sC, x.sQ]; o.a = [x.rC, x.rQ]; o.valore = x.sC === "EUR" || x.rC === "EUR" ? 0 : x.rV || x.sV; }
      else if (x.rQ > 0n) { o.tipo = "deposit"; o.a = [x.rC, x.rQ]; o.valore = x.rV; o.txSrc = x.sAddr; }
      else if (x.sQ > 0n) { o.tipo = "withdrawal"; o.tag = /Cost/i.test(x.tipo) ? "cost" : ""; o.da = [x.sC, x.sQ]; o.valore = x.sV; o.txDest = x.sAddr; }
      else return;
      if (x.fQ > 0n && x.fC) { o.fee = [x.fC, x.fQ]; o.valoreFee = x.fV; }
      var t = movimento(o); if (t) { if (t.valore) t.fonteValore = "report fiscale Binance"; mov.push(t); }
    });
    avvisi.push("Usato il solo report fiscale Binance: non contiene interessi Earn, staking e altre voci dello storico completo. Caricare anche la Transaction History.");
    return risultato("Binance", mov, avvisi, righe.length);
  }
  /* valori in euro dal report fiscale sui movimenti dello storico: stessa coppia di cripto, quantità entro l'1%, entro 2 minuti
     (gli scambi spot del report possono essere più esecuzioni dello stesso secondo: si sommano) */
  function valoriDaFiscale(mov, righe) {
    var idx = {};
    righe.forEach(function (x) { var k = x.sC + ">" + x.rC; (idx[k] = idx[k] || []).push(x); });
    var vicino = function (a, b) { var A = D.decNum(abs(a)), B = D.decNum(abs(b)); return Math.abs(A - B) <= Math.max(A, B) * 0.01 + 1e-12; };
    var n = 0;
    mov.forEach(function (m) {
      if (m.piattaforma !== "Binance" || (m.valore && m.fonteValore === "file (EUR)")) return;
      var da = m.voci.filter(function (v) { return v.lato === "da"; })[0], a = m.voci.filter(function (v) { return v.lato === "a"; })[0], fee = m.voci.filter(function (v) { return v.lato === "fee"; })[0];
      var k = (da ? da.simbolo : "") + ">" + (a ? a.simbolo : ""), cand = (idx[k] || []).filter(function (x) { return !x.usato && Math.abs(x.ts - m.ts) <= 120000; });
      if (!cand.length) return;
      // stesso secondo del più vicino: somma delle esecuzioni
      cand.sort(function (x, y) { return Math.abs(x.ts - m.ts) - Math.abs(y.ts - m.ts); });
      var sec = cand.filter(function (x) { return Math.floor(x.ts / 1000) === Math.floor(cand[0].ts / 1000); });
      var sQ = 0n, rQ = 0n, sV = 0, rV = 0, fV = 0;
      sec.forEach(function (x) { sQ += x.sQ; rQ += x.rQ; sV += x.sV; rV += x.rV; fV += x.fV; });
      var ok = (!da || vicino(da.q, sQ)) && (!a || vicino(a.q, rQ));
      if (!ok) { sec = [cand[0]]; sQ = cand[0].sQ; rQ = cand[0].rQ; sV = cand[0].sV; rV = cand[0].rV; fV = cand[0].fV; ok = (!da || vicino(da.q, sQ)) && (!a || vicino(a.q, rQ)); }
      if (!ok) return;
      sec.forEach(function (x) { x.usato = true; });
      if (!m.valore) { m.valore = a && da ? (rV || sV) : a ? rV : sV; m.fonteValore = "report fiscale Binance"; }
      if (fee && fV && !m.valoreFee) m.valoreFee = fV;
      n++;
    });
    return n;
  }

  function risultato(piattaforma, mov, avvisi, righe) {
    var senza = mov.filter(function (m) { return !m.valore && !m.controvalore && m.voci.some(function (v) { return FIAT.indexOf(v.simbolo) < 0; }); }).length;
    return { piattaforma: piattaforma, formato: piattaforma, numeri: "en", fuso: "UTC", movimenti: mov, righe: righe, cancellate: 0, senzaData: 0, senzaImporti: 0, avvisi: avvisi, senzaControvalore: senza };
  }

  /* ---------- Kraken (ledgers: CSV «Ledgers» dell'esportazione o API privata Ledgers, stesse colonne) ----------
     Ogni riga è una variazione di saldo; le righe con lo stesso refid sono una sola operazione (le due gambe di uno scambio).
     amount con segno, fee a parte (positiva, sempre addebitata sull'asset della riga). Gli asset hanno i nomi storici di Kraken
     (XXBT, XETH, ZEUR…) e i suffissi dei conti interni (.S staking, .M opt-in rewards, .F earn flessibile, .B bonded, .HOLD). */
  var KRAKEN_NOMI = { XBT: "BTC", XXBT: "BTC", XDG: "DOGE", XXDG: "DOGE", XETH: "ETH", ETH2: "ETH", XLTC: "LTC", XXRP: "XRP", XXLM: "XLM", XETC: "ETC", XMLN: "MLN", XREP: "REP", XZEC: "ZEC", XXMR: "XMR", XICN: "ICN", XNMC: "NMC", XXVN: "XVN", ZEUR: "EUR", ZUSD: "USD", ZGBP: "GBP", ZCAD: "CAD", ZJPY: "JPY", ZAUD: "AUD", ZCHF: "CHF" };
  function krakenSim(a) { var s = String(a || "").trim().toUpperCase().replace(/\.(S|M|F|P|B|HOLD|EQ)$/, ""); return KRAKEN_NOMI[s] || s; }
  var KRAKEN_INTERNI = /^(spottostaking|stakingfromspot|stakingtospot|spotfromstaking|spottofutures|spotfromfutures|allocation|deallocation|autoallocation|migration)$/i;
  function leggiKraken(testo) {
    var r = Array.isArray(testo) ? testo : tabella(testo, ["refid", "time", "type", "asset", "amount", "fee"]);
    if (!r) return { errore: "File Kraken senza le colonne refid, time, type, asset, amount, fee (serve l'esportazione «Ledgers»)." };
    var mov = [], avvisi = [], W = "Kraken", interni = 0, margine = 0, gruppi = {}, ordine = [], sconosciuti = {};
    r.forEach(function (x) {
      x.ts = data(x.time); x.sim = krakenSim(x.asset); x.qq = q(x.amount); x.ff = q(x.fee);
      x.tipo = String(x.type || "").toLowerCase(); x.sub = String(x.subtype || "").toLowerCase();
    });
    r = r.filter(function (x) { return x.ts != null && (x.qq !== 0n || x.ff !== 0n); }).sort(function (a, b) { return a.ts - b.ts || a._riga - b._riga; });
    var cv = function (voci) { var f = voci.filter(function (v) { return v[0] !== "EUR" && FIAT.indexOf(v[0]) >= 0; })[0]; return f ? { importo: D.decNum(abs(f[1])), valuta: f[0] } : null; };
    var commissione = function (x, descr) { if (x.ff <= 0n) return; var t = movimento({ riga: x._riga, ts: x.ts, tipo: "withdrawal", tag: "cost", wallet: W, da: [x.sim, x.ff], descrizione: descr }); if (t) mov.push(t); };
    r.forEach(function (x) {
      var base = { riga: x._riga, ts: x.ts, wallet: W, descrizione: "Kraken " + x.tipo + (x.sub ? " (" + x.sub + ")" : "") }, m = null;
      if (/^(trade|spend|receive|adjustment)$/.test(x.tipo) && x.refid) {
        var k = x.refid; if (!gruppi[k]) { gruppi[k] = []; ordine.push(k); } gruppi[k].push(x); return;
      }
      if (/^(margin|rollover|settled)$/.test(x.tipo)) { margine++; return; }
      if ((x.tipo === "transfer" || x.tipo === "earn") && KRAKEN_INTERNI.test(x.sub)) { interni++; commissione(x, "Commissione Kraken su movimento interno"); return; }
      if (x.tipo === "deposit" && x.qq > 0n) m = Object.assign(base, { tipo: "deposit", a: [x.sim, x.qq], fee: x.ff > 0n ? [x.sim, x.ff] : null });
      else if (x.tipo === "withdrawal" && x.qq < 0n) m = Object.assign(base, { tipo: "withdrawal", da: [x.sim, x.qq], fee: x.ff > 0n ? [x.sim, x.ff] : null });
      else if ((x.tipo === "staking" || x.tipo === "dividend" || (x.tipo === "earn" && /^(reward|)$/.test(x.sub))) && x.qq > 0n) m = Object.assign(base, { tipo: "deposit", tag: "reward", a: [x.sim, x.qq], descrizione: "Ricompensa Kraken (" + x.tipo + ")" });
      else if (x.tipo === "transfer" && x.qq > 0n) { m = Object.assign(base, { tipo: "deposit", tag: "airdrop", a: [x.sim, x.qq], descrizione: "Accredito Kraken (airdrop o fork)" }); avvisi.push("Riga " + x._riga + ": accredito «transfer» di " + D.decStr(x.qq) + " " + x.sim + " letto come airdrop o fork: verificare."); }
      else if (x.tipo === "credit" && x.qq > 0n) { m = Object.assign(base, { tipo: "deposit", tag: "cashback", a: [x.sim, x.qq], descrizione: "Accredito promozionale Kraken" }); }
      else {
        m = Object.assign(base, { tipo: x.qq > 0n ? "deposit" : "withdrawal", a: x.qq > 0n ? [x.sim, x.qq] : null, da: x.qq < 0n ? [x.sim, x.qq] : null, fee: x.ff > 0n ? [x.sim, x.ff] : null });
        var sk = x.tipo + (x.sub ? "/" + x.sub : ""); sconosciuti[sk] = (sconosciuti[sk] || 0) + 1;
      }
      var t = movimento(m); if (t) mov.push(t);
    });
    // scambi (trade), acquisti rapidi (spend/receive) e conversioni (adjustment): le gambe con lo stesso refid
    ordine.forEach(function (k) {
      var g = gruppi[k], net = {}, fee = {}, sims = [];
      g.forEach(function (x) { if (!(x.sim in net)) { net[x.sim] = 0n; sims.push(x.sim); } net[x.sim] += x.qq; if (x.ff > 0n) fee[x.sim] = (fee[x.sim] || 0n) + x.ff; });
      var usc = sims.filter(function (s) { return net[s] < 0n; }), ent = sims.filter(function (s) { return net[s] > 0n; });
      var tipoG = g[0].tipo, descr = tipoG === "trade" ? "Scambio Kraken" : tipoG === "adjustment" ? "Conversione Kraken (adjustment)" : "Acquisto rapido Kraken";
      var fk = Object.keys(fee), fp = fk.filter(function (s) { return usc.indexOf(s) >= 0 || ent.indexOf(s) >= 0; })[0] || fk[0];
      if (usc.length === 1 && ent.length === 1) {
        var t = movimento({ riga: g[0]._riga, ts: g[g.length - 1].ts, tipo: "trade", wallet: W, da: [usc[0], net[usc[0]]], a: [ent[0], net[ent[0]]], fee: fp ? [fp, fee[fp]] : null, descrizione: descr, controvalore: cv([[usc[0], net[usc[0]]], [ent[0], net[ent[0]]]]) });
        if (t) mov.push(t);
      } else {
        if (usc.length + ent.length > 0) avvisi.push("Riga " + g[0]._riga + ": operazione Kraken " + k + " (" + tipoG + ") con " + (usc.length ? usc.length + " uscite" : "nessuna uscita") + " e " + (ent.length ? ent.length + " entrate" : "nessuna entrata") + ": lette come movimenti separati, da verificare.");
        var restanti = Object.assign({}, fee);
        sims.forEach(function (s) {
          if (net[s] === 0n) return;
          var f = restanti[s]; delete restanti[s];
          var tt = movimento({ riga: g[0]._riga, ts: g[0].ts, tipo: net[s] > 0n ? "deposit" : "withdrawal", wallet: W, a: net[s] > 0n ? [s, net[s]] : null, da: net[s] < 0n ? [s, net[s]] : null, fee: f ? [s, f] : null, descrizione: descr + " (gamba isolata)" });
          if (tt) mov.push(tt);
        });
        Object.keys(restanti).forEach(function (s) { var tc = movimento({ riga: g[0]._riga, ts: g[0].ts, tipo: "withdrawal", tag: "cost", wallet: W, da: [s, restanti[s]], descrizione: "Commissione " + descr.toLowerCase() }); if (tc) mov.push(tc); });
        return;
      }
      fk.filter(function (s) { return s !== fp; }).forEach(function (s) { var tc = movimento({ riga: g[0]._riga, ts: g[0].ts, tipo: "withdrawal", tag: "cost", wallet: W, da: [s, fee[s]], descrizione: "Commissione " + descr.toLowerCase() }); if (tc) mov.push(tc); });
    });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    if (margine) avvisi.push(margine + " righe di trading a margine (margin, rollover, settled) non lette: sono strumenti derivati, da trattare a parte.");
    Object.keys(sconosciuti).forEach(function (s) { avvisi.push("Operazioni Kraken «" + s + "» non riconosciute (" + sconosciuti[s] + "): lette come entrate o uscite, da verificare."); });
    var res = risultato("Kraken", mov, avvisi, r.length);
    res.interni = interni;
    return res;
  }

  /* ---------- riconoscimento ---------- */
  function riconosci(testo, nome) {
    if (haColonne(testo, ["Operation", "Coin", "Change"])) return "binance";
    if (haColonne(testo, ["refid", "time", "type", "asset", "amount", "fee"])) return "kraken";
    if (haColonne(testo, ["txid", "ordertxid", "pair", "time", "type", "vol"])) return "kraken-scambi";
    if (haColonne(testo, ["datetime_tz_CET", "sent_amount", "received_amount", "sent_value_EUR"])) return "binance-fiscale";
    if (haColonne(testo, ["portfolio", "type", "time", "amount", "amount/balance unit"])) return "coinbase-pro";
    if (haColonne(testo, ["portfolio", "trade id", "product", "side", "created at", "size"])) return "coinbase-pro-fills";
    if (haColonne(testo, ["Coin", "Amount", "TXID"]) && haColonne(testo, ["Fee"])) return "binance-prelievi";
    if (haColonne(testo, ["Coin", "Amount", "TXID"])) return "binance-depositi";
    if (haColonne(testo, ["Timestamp", "Transaction Type", "Asset", "Quantity Transacted"])) return "coinbase";
    if (haColonne(testo, ["Transaction", "Type", "Input Currency", "Output Currency"])) return "nexo";
    if (haColonne(testo, ["credit", "debit", "currency", "date", "tx_type"])) return "young";
    if (haColonne(testo, ["Tipo", "Prodotto", "Data di inizio", "Descrizione", "Importo", "Valuta"]) || haColonne(testo, ["Type", "Product", "Started Date", "Description", "Amount", "Currency"])) return "revolut-conto";
    if (haColonne(testo, ["Operation Date", "Currency Ticker", "Operation Type", "Operation Amount"])) return "ledger";
    if (haColonne(testo, ["Symbol", "Type", "Quantity", "Price", "Value", "Fees", "Date"])) return "revolut";
    if (haColonne(testo, ["Data e ora", "Ceduto (quantità)", "Ricevuto (quantità)"])) return "scambi-app";
    if (haColonne(testo, ["Date", "Transaction Type", "BTC Amount", "Fiat Amount (excl. fees)"])) return "relai";
    if (haColonne(testo, ["Time", "Type", "Amount", "Unit", "Transaction ID"])) return "bitbox";
    if (haColonne(testo, ["Transaction Hash", "DateTime (UTC)", "From", "To"])) return "etherscan";
    if (haColonne(testo, ["Portafoglio", "Tipo", "Chiave pubblica estesa (sola lettura)"])) return "chiavi";
    if (haColonne(testo, ["Portafoglio", "Tipo indirizzo", "Indirizzo"])) return "indirizzi";
    if (haColonne(testo, ["ID (read-only)", "Date (UTC)", "From Amount", "To Amount"]) || haColonne(testo, ["Date", "Sent Amount", "Received Amount"])) return "koinly";
    return null;
  }

  /* Ledger Live: «Operations» esportate dall'app (Impostazioni → Account → Esporta operazioni) */
  function leggiLedger(testo) {
    var r = Array.isArray(testo) ? testo : tabella(testo, ["Operation Date", "Currency Ticker", "Operation Type", "Operation Amount"]);
    if (!r) return { errore: "File Ledger Live senza le colonne Operation Date, Currency Ticker, Operation Type, Operation Amount." };
    var mov = [], avvisi = [];
    r.forEach(function (x) {
      var ts = Date.parse(x["Operation Date"]); if (!isFinite(ts)) return;
      var W = "Ledger" + (x["Account Name"] ? " · " + x["Account Name"] : ""), sim = x["Currency Ticker"], tipo = (x["Operation Type"] || "").toUpperCase();
      var qta = q(x["Operation Amount"]), fee = q(x["Operation Fees"]);
      var cvT = (x["Countervalue Ticker"] || "").toUpperCase(), cvV = num(x["Countervalue at Operation Date"]);
      var o = { riga: x._riga, ts: ts, wallet: W, txHash: x["Operation Hash"] || "", descrizione: tipo, valore: cvT === "EUR" ? cvV : 0, controvalore: cvT && cvT !== "EUR" && cvV ? { importo: cvV, valuta: cvT } : null };
      if (/^(IN|REWARD|REWARD_PAYOUT|WITHDRAW_UNBONDED)$/.test(tipo)) { o.tipo = "deposit"; o.tag = /REWARD/.test(tipo) ? "reward" : ""; o.a = [sim, qta]; }
      else if (/^(OUT)$/.test(tipo)) { o.tipo = "withdrawal"; o.da = [sim, fee && qta > fee ? qta - fee : qta]; if (fee) o.fee = [sim, fee]; }
      else if (/^(FEES|DELEGATE|UNDELEGATE|REDELEGATE|BOND|UNBOND|NONE|OPT_IN|APPROVE)$/.test(tipo)) { if (!fee) return; o.tipo = "withdrawal"; o.tag = "cost"; o.fee = [sim, fee]; }
      else { o.tipo = qta > 0n ? "deposit" : "withdrawal"; o.a = [sim, qta]; avvisi.push("Riga " + x._riga + ": operazione Ledger «" + tipo + "» non riconosciuta."); }
      var t = movimento(o); if (t) mov.push(t);
    });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    return risultato("Ledger", mov, avvisi, r.length);
  }

  /* ---------- Revolut (estratto della sezione Cripto e di Revolut X, in italiano) ---------- */
  var MESI = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12, jan: 1, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, dec: 12 };
  /* «25 feb 2025, 06:47:29» in ora italiana → UTC */
  function dataRevolut(s) {
    var m = /^(\d{1,2}) (\w{3})\w* (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(s || "").trim().toLowerCase());
    if (m && MESI[m[2]]) return romaUTC(m[3] + "-" + ("0" + MESI[m[2]]).slice(-2) + "-" + ("0" + m[1]).slice(-2) + " " + ("0" + m[4]).slice(-2) + ":" + m[5] + ":" + (m[6] || "00"));
    return /^\d{4}-\d{2}-\d{2}/.test(String(s || "").trim()) ? romaUTC(s) : null;
  }
  /* «88.836,46 €» o «0,00562831» → stringa numerica */
  function numIt(s) { var t = String(s == null ? "" : s).replace(/[€$\s]/g, ""); if (/,/.test(t)) t = t.replace(/\./g, "").replace(",", "."); return t; }
  function leggiRevolut(testo) {
    var r = Array.isArray(testo) ? testo : tabella(testo, ["Symbol", "Type", "Quantity", "Price", "Value", "Fees", "Date"]);
    if (!r) return { errore: "Estratto Revolut cripto senza le colonne Symbol, Type, Quantity, Price, Value, Fees, Date." };
    var mov = [], avvisi = [], W = "Revolut";
    r.forEach(function (x) {
      var ts = dataRevolut(x.Date); if (ts == null) return;
      var sim = x.Symbol.toUpperCase(), tipo = x.Type, qq = q(numIt(x.Quantity)), val = num(numIt(x.Value)), fee = num(numIt(x.Fees));
      var X = /Revolut X/i.test(tipo), base = { riga: x._riga, ts: ts, wallet: W, descrizione: tipo }, add = function (o) { var t = movimento(Object.assign({}, base, o)); if (t) mov.push(t); };
      var eur = function (v) { return q(v.toFixed(2)); };
      if (/^(Acquisto|Acquista|Buy)/i.test(tipo)) {
        // l'acquisto dall'app parte dal conto in euro (nessuna riga di ricarica): entrata dell'importo, poi lo scambio; commissione compresa nel valore
        if (!X) add({ tipo: "deposit", a: ["EUR", eur(val)], descrizione: "Addebito sul conto Revolut per l'acquisto" });
        add({ tipo: "trade", da: ["EUR", eur(val - fee)], a: [sim, qq], fee: fee ? ["EUR", eur(fee)] : null, valore: val - fee, valoreFee: fee });
      } else if (/^(Vendita|Vendi|Sell)/i.test(tipo)) {
        // corrispettivo lordo; la commissione in euro lo riduce (accredito netto = valore − commissione)
        add({ tipo: "trade", da: [sim, qq], a: ["EUR", eur(val)], fee: fee ? ["EUR", eur(fee)] : null, valore: val, valoreFee: fee });
        if (!X) add({ tipo: "withdrawal", da: ["EUR", eur(val - fee)], descrizione: "Accredito sul conto Revolut della vendita" });
      } else if (/^(Invio|Send)/i.test(tipo)) {
        // la commissione è indicata in euro ma trattenuta in cripto: euro ÷ prezzo
        var prezzo = num(numIt(x.Price)), fq = fee && prezzo ? q((fee / prezzo).toFixed(10)) : 0n;
        add({ tipo: "withdrawal", da: [sim, qq], fee: fq ? [sim, fq] : null, valore: val, valoreFee: fee, descrizione: tipo + (fee ? " (commissione " + fee.toFixed(2) + " €)" : "") });
      }
      else if (/^(Ricezione|Receive)/i.test(tipo)) add(sim === "EUR" ? { tipo: "deposit", a: ["EUR", eur(val)] } : { tipo: "deposit", a: [sim, qq], valore: val });
      else if (/^(Altro|Other)/i.test(tipo) && sim === "EUR") add({ tipo: "withdrawal", da: ["EUR", eur(val)], descrizione: "Trasferimento in euro da Revolut X" });
      else if (/Staking|Ricompens|Reward|Interess/i.test(tipo)) add({ tipo: "deposit", tag: "reward", a: [sim, qq], valore: val });
      else avvisi.push("Riga " + x._riga + ": voce Revolut «" + tipo + "» non riconosciuta.");
    });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    return risultato("Revolut", mov, avvisi, r.length);
  }

  /* ---------- Relai (acquisti di BTC inviati direttamente al wallet del cliente) ---------- */
  function leggiRelai(testo) {
    var r = Array.isArray(testo) ? testo : tabella(testo, ["Date", "Transaction Type", "BTC Amount", "Fiat Amount (excl. fees)", "Destination"]);
    if (!r) return { errore: "File Relai senza le colonne Date, Transaction Type, BTC Amount, Fiat Amount (excl. fees), Destination." };
    var mov = [], avvisi = [], W = "Relai";
    r.forEach(function (x) {
      var ts = Date.parse(x.Date); if (!isFinite(ts)) return;
      var btc = q(x["BTC Amount"]), fiat = (x["Fiat Currency"] || "EUR").toUpperCase(), imp = q(x["Fiat Amount (excl. fees)"]), fee = q(x.Fee), fc = (x["Fee Currency"] || fiat).toUpperCase();
      var base = { riga: x._riga, ts: ts, wallet: W, txHash: "" }, add = function (o) { var t = movimento(Object.assign({}, base, o)); if (t) mov.push(t); };
      if (/Buy/i.test(x["Transaction Type"])) {
        // bonifico a Relai, acquisto, invio dei BTC all'indirizzo di destinazione (wallet del cliente)
        add({ tipo: "deposit", a: [fiat, imp + (fc === fiat ? fee : 0n)], descrizione: "Bonifico a Relai" });
        add({ tipo: "trade", da: [fiat, imp], a: ["BTC", btc], fee: fee ? [fc, fee] : null, descrizione: "Acquisto Relai " + (x["Operation ID"] || "") });
        add({ tipo: "withdrawal", da: ["BTC", btc], txDest: x.Destination || "", descrizione: "Invio a " + (x.Destination || "indirizzo non indicato") });
      } else if (/Sell/i.test(x["Transaction Type"])) {
        add({ tipo: "deposit", a: ["BTC", btc], descrizione: "BTC inviati a Relai per la vendita" });
        add({ tipo: "trade", da: ["BTC", btc], a: [fiat, imp], fee: fee ? [fc, fee] : null, descrizione: "Vendita Relai " + (x["Operation ID"] || "") });
        add({ tipo: "withdrawal", da: [fiat, imp - (fc === fiat ? fee : 0n)], descrizione: "Bonifico dalla vendita Relai" });
      } else avvisi.push("Riga " + x._riga + ": operazione Relai «" + x["Transaction Type"] + "» non riconosciuta.");
    });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    return risultato("Relai", mov, avvisi, r.length);
  }

  /* ---------- BitBoxApp (export delle transazioni di un account) ---------- */
  function leggiBitBox(testo, nome) {
    var r = tabella(testo, ["Time", "Type", "Amount", "Unit", "Transaction ID"]);
    if (!r) return { errore: "Export BitBoxApp senza le colonne Time, Type, Amount, Unit, Transaction ID." };
    var n = /BitBox0?2?[ _-]*n?\.?[ _-]*(\d+)/i.exec(nome || ""), W = "BitBox02" + (n ? " n." + n[1] : ""), mov = [], avvisi = [];
    var unita = function (v, u) { return /sat/i.test(u || "") ? q(v) / 100000000n : q(v); };
    r.forEach(function (x) {
      var ts = Date.parse(x.Time); if (!isFinite(ts)) return;
      var sim = /sat/i.test(x.Unit) ? "BTC" : x.Unit.toUpperCase(), qq = unita(x.Amount, x.Unit), fee = x.Fee ? unita(x.Fee, x["Fee Unit"]) : 0n;
      var cv = num(x["Historical value"]), cvU = (x["Historical value currency"] || "").toUpperCase();
      var o = { riga: x._riga, ts: ts, wallet: W, txHash: x["Transaction ID"] || "", descrizione: x.Type + (x.Note ? " · " + x.Note : ""), valore: cvU === "EUR" ? cv : 0, controvalore: cvU && cvU !== "EUR" && cv ? { importo: cv, valuta: cvU } : null };
      if (/^receiv/i.test(x.Type)) { o.tipo = "deposit"; o.a = [sim, qq]; o.txSrc = ""; }
      else if (/^sent$/i.test(x.Type) || /^send/i.test(x.Type)) { o.tipo = "withdrawal"; o.da = [sim, qq]; o.txDest = x.Address || ""; if (fee) o.fee = [sim, fee]; }
      else if (/self/i.test(x.Type)) { if (!fee) return; o.tipo = "withdrawal"; o.tag = "cost"; o.fee = [sim, fee]; o.descrizione = "Invio a sé stesso: solo commissione"; }
      else { avvisi.push("Riga " + x._riga + ": voce BitBoxApp «" + x.Type + "» non riconosciuta."); return; }
      var t = movimento(o); if (t) mov.push(t);
    });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    return risultato(W, mov, avvisi, r.length);
  }

  /* ---------- Etherscan (export «Transactions» o «Token Transfers» di un indirizzo) ---------- */
  function leggiEtherscan(testo, nome) {
    var r = tabella(testo, ["Transaction Hash", "DateTime (UTC)", "From", "To"]);
    if (!r) return { errore: "Export Etherscan senza le colonne Transaction Hash, DateTime (UTC), From, To." };
    var token = r.length && r[0].TokenSymbol != null;
    // l'indirizzo del cliente è quello che compare in ogni riga (in uscita o in entrata)
    var cont = {}; r.forEach(function (x) { [x.From, x.To].forEach(function (a) { a = (a || "").toLowerCase(); if (a) cont[a] = (cont[a] || 0) + 1; }); });
    var mio = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; })[0] || "";
    var W = "ETH " + mio.slice(0, 6) + "…" + mio.slice(-4), mov = [], avvisi = [];
    r.forEach(function (x) {
      var ts = data(x["DateTime (UTC)"], 0); if (ts == null) return;
      var da = (x.From || "").toLowerCase(), a = (x.To || "").toLowerCase(), errore = /error|fail/i.test(x.Status || "") || !!x.ErrCode;
      var o = { riga: x._riga, ts: ts, wallet: W, txHash: x["Transaction Hash"], txSrc: da, txDest: a, descrizione: (x.Method || (token ? "Token transfer" : "Transfer")) + (errore ? " (non riuscita)" : "") };
      if (token) {
        var sim = (x.TokenSymbol || "").toUpperCase(), v = q(String(x.TokenValue || x.Value || "").replace(/,/g, ""));
        if (!v) return;
        if (a === mio && da !== mio) { o.tipo = "deposit"; o.a = [sim, v]; }
        else if (da === mio && a !== mio) { o.tipo = "withdrawal"; o.da = [sim, v]; }
        else return;
      } else {
        var vin = q(x["Value_IN(ETH)"]), vout = q(x["Value_OUT(ETH)"]), fee = da === mio ? q(x["TxnFee(ETH)"]) : 0n;
        if (errore) { vin = 0n; vout = 0n; }
        if (vin > 0n && a === mio) { o.tipo = "deposit"; o.a = ["ETH", vin]; }
        else if (vout > 0n) { o.tipo = "withdrawal"; o.da = ["ETH", vout]; if (fee) o.fee = ["ETH", fee]; }
        else if (fee) { o.tipo = "withdrawal"; o.tag = "cost"; o.fee = ["ETH", fee]; o.descrizione += ": solo commissione di rete"; }
        else return;
      }
      var t = movimento(o); if (t) mov.push(t);
    });
    mov.sort(function (a, b) { return a.ts - b.ts || a.riga - b.riga; });
    var res = risultato(W, mov, avvisi, r.length);
    res.indirizzo = mio;
    if (!token) res.avvisi.push("Export Etherscan delle sole transazioni in ETH: i token (USDT, USDC…) e i trasferimenti interni dei contratti sono in export separati («Token Transfers», «Internal Transactions»).");
    return res;
  }

  /* più file insieme: gli storici Binance si uniscono; Deposit e Withdraw History aggiungono indirizzi e hash; il report fiscale
     Binance dà i valori in euro; l'estratto Coinbase Pro si abbina ai trasferimenti «Pro Deposit / Pro Withdrawal» di Coinbase */
  function leggiFile(files) {
    var esiti = [], extra = { depositi: null, prelievi: null }, principali = [], visti = {}, binance = [], fiscale = [], fills = [], scambiApp = [];
    files = files.filter(function (f) { var k = f.testo.length + ":" + f.testo.slice(0, 2000) + f.testo.slice(-2000); if (visti[k]) { esiti.push({ nome: f.nome, doppio: visti[k], errore: "Stesso contenuto di «" + visti[k] + "»: non letto una seconda volta." }); return false; } visti[k] = f.nome; return true; });
    files.forEach(function (f) {
      var tipo = riconosci(f.testo, f.nome);
      if (tipo === "binance-depositi") extra.depositi = (extra.depositi || []).concat(leggiBinanceMovimentiEsterni(f.testo, f.nome, "depositi") || []);
      else if (tipo === "binance-prelievi") extra.prelievi = (extra.prelievi || []).concat(leggiBinanceMovimentiEsterni(f.testo, f.nome, "prelievi") || []);
      else if (tipo === "binance") binance.push(f);
      else if (tipo === "binance-fiscale") { var rf = righeFiscaleBinance(f.testo) || []; rf.forEach(function (x) { fiscale.push(x); }); esiti.push({ nome: f.nome, piattaforma: "Binance (report fiscale)", righe: rf.length, movimenti: [], avvisi: [], ausiliario: true }); }
      else if (tipo === "coinbase-pro-fills") fills.push(f);
      else if (tipo === "scambi-app") { var sa = leggiScambiApp(f.testo) || []; sa.forEach(function (x) { scambiApp.push(x); }); esiti.push({ nome: f.nome, piattaforma: "Scambi nelle app dei wallet", ausiliario: true, righe: sa.length, movimenti: [], avvisi: [sa.length + " scambi: uniranno uscite ed entrate on-chain in permute."] }); }
      else principali.push({ f: f, tipo: tipo });
    });
    if (binance.length) { var rb = leggiBinance(binance, null, extra); rb.nome = binance.map(function (f) { return f.nome; }).join(" + "); if (binance.length > 1) rb.avvisi.unshift(binance.length + " storici Binance uniti: le righe presenti in più file contano una volta."); esiti.push(rb); }
    else if (fiscale.length) {
      // report fiscale da solo: le righe di più anni si uniscono per identificativo
      var vf = {}; var uniche = fiscale.filter(function (x) { if (x.id && vf[x.id]) return false; vf[x.id] = 1; return true; });
      var rfb = leggiFiscaleBinance(uniche); rfb.nome = "report fiscale Binance"; esiti.push(rfb); fiscale = [];
    }
    var haPro = principali.some(function (p) { return p.tipo === "coinbase-pro"; });
    if (fills.length) esiti.push({ nome: fills.map(function (f) { return f.nome; }).join(" + "), piattaforma: "Coinbase Pro (fills)", ausiliario: true, movimenti: [], avvisi: [(fills.length > 1 ? fills.length + " file" : "File") + " «fills» di Coinbase Pro non usati: " + (haPro ? "gli scambi sono già nell'estratto conto." : "contengono solo gli scambi; serve l'estratto conto «account», che ha anche depositi, prelievi e commissioni.")] });
    // stessa piattaforma in più file (anni, mesi, esportazioni ripetute): righe unite, ogni riga una volta sola
    var perTipo = {}, ordineTipi = [];
    principali.forEach(function (p) {
      if (p.tipo === "bitbox" || p.tipo === "etherscan") { var rw = p.tipo === "bitbox" ? leggiBitBox(p.f.testo, p.f.nome) : leggiEtherscan(p.f.testo, p.f.nome); rw.nome = p.f.nome; esiti.push(rw); return; }
      if (p.tipo === "chiavi" || p.tipo === "indirizzi") { esiti.push({ nome: p.f.nome, piattaforma: p.tipo === "chiavi" ? "Chiavi pubbliche" : "Indirizzi dei wallet", ausiliario: true, movimenti: [], avvisi: ["Elenco di " + (p.tipo === "chiavi" ? "chiavi pubbliche" : "indirizzi") + ": servirà per la lettura dalla blockchain e per attribuire i wallet al cliente."] }); return; }
      if (p.tipo === "koinly") { esiti.push({ nome: p.f.nome, errore: "File di Koinly: in questa modalità si caricano i file delle piattaforme. I file Koinly si usano nella modalità «file Koinly»." }); return; }
      if (p.tipo === "kraken-scambi") { esiti.push({ nome: p.f.nome, errore: "È l'elenco «Trades» di Kraken: contiene solo gli scambi. Serve l'esportazione «Ledgers», che ha anche depositi, prelievi, staking e commissioni (oppure il collegamento con la chiave API)." }); return; }
      if (!LETTORI[p.tipo]) {
        esiti.push({ nome: p.f.nome, errore: p.tipo === "revolut-conto" ? "È l'estratto del conto in euro di Revolut: le cripto non ci sono (gli acquisti risultano solo come «Transfer to Revolut Digital Assets»). Serve l'estratto della sezione Cripto o di Revolut X." : "Formato non riconosciuto." });
        return;
      }
      if (!perTipo[p.tipo]) { perTipo[p.tipo] = []; ordineTipi.push(p.tipo); }
      perTipo[p.tipo].push(p.f);
    });
    ordineTipi.forEach(function (tipo) {
      var L = LETTORI[tipo], fs = perTipo[tipo], r;
      if (fs.length === 1) r = L.leggi(fs[0].testo);
      else {
        var righe = unisciRighe(fs, L.colonne, L.chiave);
        r = L.leggi(righe.righe);
        r.avvisi.unshift(fs.length + " file " + r.piattaforma + " uniti: " + righe.totali.toLocaleString("it-IT") + " righe lette, " + righe.righe.length.toLocaleString("it-IT") + " diverse (le righe presenti in più file contano una volta).");
      }
      r.nome = fs.map(function (f) { return f.nome; }).join(" + ");
      esiti.push(r);
    });
    abbinaCoinbasePro(esiti);
    var mov = [];
    esiti.forEach(function (e) { (e.movimenti || []).forEach(function (m) { mov.push(m); }); });
    mov.sort(function (a, b) { return a.ts - b.ts; });
    var valoriFiscale = fiscale.length ? valoriDaFiscale(mov, fiscale) : 0;
    return { file: esiti, movimenti: mov, depositiBinance: extra.depositi ? extra.depositi.length : 0, prelieviBinance: extra.prelievi ? extra.prelievi.length : 0, valoriFiscaleBinance: valoriFiscale, righeFiscaleBinance: fiscale.length, scambiApp: scambiApp };
  }
  /* trasferimenti tra wallet e piattaforme del cliente: un prelievo e un deposito della stessa cripto diventano un solo
     movimento «transfer» (nessuna cessione; la commissione resta come onere). Abbinamento:
     1) stesso hash della transazione (es. prelievo Binance ↔ ricezione on-chain);
     2) senza hash: stessa cripto, quantità ricevuta pari a quella inviata (o inferiore fino all'1%, per la commissione di rete),
        deposito entro 48 ore dopo il prelievo, un solo candidato possibile. */
  /* lo stesso movimento da due fonti (es. export BitBoxApp o Ledger Live e lettura on-chain dello stesso wallet):
     stesso hash, stesso tipo, stesse quantità → uno solo, si tiene la fonte con il controvalore in euro o la prima */
  function togliDoppioni(mov) {
    var norm = function (h) { return String(h || "").trim().toLowerCase().replace(/^0x/, ""); }, visti = {}, doppi = 0;
    var out = mov.filter(function (m) {
      var h = norm(m.txHash); if (h.length < 32) return true;
      var k = h + "|" + m.tipo + "|" + m.voci.filter(function (v) { return v.lato !== "fee"; }).map(function (v) { return v.simbolo + D.decStr(v.q); }).sort().join(",");
      var p = visti[k];
      if (!p) { visti[k] = m; return true; }
      if (!p.valore && m.valore) { p.valore = m.valore; p.fonteValore = m.fonteValore; }
      if (!p.controvalore && m.controvalore) p.controvalore = m.controvalore;
      if (!p.voci.some(function (v) { return v.lato === "fee"; })) m.voci.filter(function (v) { return v.lato === "fee"; }).forEach(function (v) { p.voci.push(v); });
      p.altraFonte = (p.altraFonte ? p.altraFonte + ", " : "") + (m.piattaforma || m.walletA || m.walletDa);
      doppi++; return false;
    });
    return { movimenti: out, doppi: doppi };
  }
  function abbinaTrasferimenti(mov) {
    var td = togliDoppioni(mov); mov = td.movimenti;
    var norm = function (h) { return String(h || "").trim().toLowerCase().replace(/^0x/, ""); };
    var dep = mov.filter(function (m) { return m.tipo === "deposit" && !m.tag && m.voci.length === 1 && m.voci[0].lato === "a"; });
    var pre = mov.filter(function (m) { return m.tipo === "withdrawal" && !m.tag && m.voci.some(function (v) { return v.lato === "da"; }); });
    var perHash = {}; dep.forEach(function (d) { var h = norm(d.txHash); if (h.length >= 32) (perHash[h] = perHash[h] || []).push(d); });
    var coppie = [], usati = new Set(), perHashN = 0, perImportoN = 0;
    pre.forEach(function (w) {
      var da = w.voci.filter(function (v) { return v.lato === "da"; })[0], h = norm(w.txHash);
      var c = (perHash[h] || []).filter(function (d) { return !usati.has(d) && d.voci[0].simbolo === da.simbolo && d.walletA !== w.walletDa; })[0];
      if (c) { usati.add(c); usati.add(w); coppie.push([w, c, "hash"]); perHashN++; }
    });
    pre.forEach(function (w) {
      if (usati.has(w)) return;
      var da = w.voci.filter(function (v) { return v.lato === "da"; })[0], qd = -da.q;
      var c = dep.filter(function (d) {
        if (usati.has(d) || d.voci[0].simbolo !== da.simbolo || d.walletA === w.walletDa) return false;
        var qa = d.voci[0].q, dt = d.ts - w.ts;
        return dt >= -600000 && dt <= 172800000 && qa <= qd && qa * 100n >= qd * 99n && (!w.txHash || !d.txHash || norm(w.txHash) === norm(d.txHash));
      });
      if (c.length === 1) { usati.add(c[0]); usati.add(w); coppie.push([w, c[0], "importo"]); perImportoN++; }
    });
    var tolti = new Set();
    coppie.forEach(function (cp) {
      var w = cp[0], d = cp[1], a = d.voci[0], da = w.voci.filter(function (v) { return v.lato === "da"; })[0];
      // la differenza tra inviato e ricevuto (commissione trattenuta dalla piattaforma) si aggiunge alla commissione
      var diff = -da.q - a.q, fee = w.voci.filter(function (v) { return v.lato === "fee"; })[0];
      w.tipo = "transfer"; w.walletA = d.walletA; w.txSrc = w.txSrc || d.txSrc; w.txDest = w.txDest || d.txDest; w.txHash = w.txHash || d.txHash;
      w.voci = [{ valuta: da.valuta, simbolo: da.simbolo, q: -a.q, lato: "da" }, { valuta: a.valuta, simbolo: a.simbolo, q: a.q, lato: "a" }];
      var fq = (fee && fee.simbolo === da.simbolo ? -fee.q : 0n) + diff;
      if (fq > 0n) w.voci.push({ valuta: da.valuta, simbolo: da.simbolo, q: -fq, lato: "fee" }); else if (fee && fee.simbolo !== da.simbolo) w.voci.push(fee);
      w.descrizione = "Trasferimento " + (w.piattaforma || w.walletDa) + " → " + (d.piattaforma || d.walletA) + " (abbinato per " + (cp[2] === "hash" ? "hash della transazione" : "quantità e data") + ")";
      w.abbinamento = cp[2];
      tolti.add(d);
    });
    var out = mov.filter(function (m) { return !tolti.has(m); });
    return { movimenti: out, perHash: perHashN, perImporto: perImportoN, doppi: td.doppi };
  }

  /* ---------- scambi fatti dentro l'app di un wallet (es. SafePal «Scambia»), elencati dallo studio o dal cliente ---------- */
  /* data: numero seriale di Excel o testo «gg/mm/aaaa hh:mm», in ora italiana */
  function dataScambio(v) {
    var t = String(v == null ? "" : v).trim(), m;
    if (/^\d+(\.\d+)?$/.test(t)) { var ms = Math.round((parseFloat(t) - 25569) * 86400000), d = new Date(ms); return romaUTC(d.toISOString().slice(0, 19).replace("T", " ")); }
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t))) return romaUTC(m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) + " " + ("0" + m[4]).slice(-2) + ":" + m[5] + ":" + (m[6] || "00"));
    return /^\d{4}-\d{2}-\d{2}/.test(t) ? romaUTC(t) : null;
  }
  function leggiScambiApp(testo) {
    var r = tabella(testo, ["Data e ora", "Ceduto (quantità)", "Ceduto (moneta)", "Ricevuto (quantità)", "Ricevuto (moneta)"]);
    if (!r) return null;
    return r.filter(function (x) { return !/non riuscit|fallit|annullat/i.test(x["Esito / note"] || x.Esito || ""); }).map(function (x) {
      return { riga: x._riga, n: x["N."] || "", ts: dataScambio(x["Data e ora"]), wallet: (x.Portafoglio || "").trim(), daSim: x["Ceduto (moneta)"].toUpperCase(), daQ: q(x["Ceduto (quantità)"]), aSim: x["Ricevuto (moneta)"].toUpperCase(), aQ: q(x["Ricevuto (quantità)"]) };
    }).filter(function (x) { return x.ts != null && x.daQ > 0n && x.aQ > 0n; });
  }
  /* «SafePal 1 - antosafebackup» e «SafePal 1 Legacy», «SafePal 1 ETH»: stesso dispositivo «SafePal 1» */
  function dispositivo(w) { var m = /^(.*?\d+)\b/.exec(String(w || "").trim()); return (m ? m[1] : String(w || "").split(/[ -]/)[0]).toLowerCase(); }
  /* ogni scambio dell'elenco unisce l'uscita e l'entrata corrispondenti (anche su blockchain diverse) in una permuta */
  function applicaScambi(mov, scambi) {
    var vicino = function (x, y, perc) { return x <= y * (100n + BigInt(perc)) / 100n && x >= y * (100n - BigInt(perc)) / 100n; };
    var tolti = new Set(), fatti = 0, giaScambi = 0, mancanti = [];
    scambi.forEach(function (s) {
      var dsp = dispositivo(s.wallet);
      var stessoDisp = function (m, lato) { return dsp && dispositivo(lato === "da" ? m.walletDa : m.walletA) === dsp; };
      // già una permuta nella stessa transazione (scambio sulla stessa blockchain)
      var t0 = mov.filter(function (m) { return !tolti.has(m) && m.tipo === "trade" && !m.scambioApp && Math.abs(m.ts - s.ts) <= 3 * 3600000 && m.voci.some(function (v) { return v.lato === "da" && v.simbolo === s.daSim && vicino(-v.q, s.daQ, 2); }) && m.voci.some(function (v) { return v.lato === "a" && v.simbolo === s.aSim && vicino(v.q, s.aQ, 3); }); })[0];
      if (t0) { t0.scambioApp = s; giaScambi++; return; }
      var w = mov.filter(function (m) { return !tolti.has(m) && m.tipo === "withdrawal" && !m.tag && !m.scambioApp && stessoDisp(m, "da") && Math.abs(m.ts - s.ts) <= 3 * 3600000 && m.voci.some(function (v) { return v.lato === "da" && v.simbolo === s.daSim && vicino(-v.q, s.daQ, 1); }); })
        .sort(function (a, b) { return Math.abs(a.ts - s.ts) - Math.abs(b.ts - s.ts); })[0];
      var d = mov.filter(function (m) { return !tolti.has(m) && m.tipo === "deposit" && !m.tag && stessoDisp(m, "a") && m.ts >= s.ts - 3 * 3600000 && m.ts <= s.ts + 12 * 3600000 && m.voci.some(function (v) { return v.lato === "a" && v.simbolo === s.aSim && vicino(v.q, s.aQ, 3); }); })
        .sort(function (a, b) { return Math.abs(a.ts - s.ts) - Math.abs(b.ts - s.ts); })[0];
      if (!w || !d) { mancanti.push({ scambio: s, manca: !w && !d ? "uscita ed entrata" : !w ? "uscita di " + s.daSim : "entrata di " + s.aSim }); return; }
      var fee = w.voci.filter(function (v) { return v.lato === "fee"; });
      w.tipo = "trade"; w.walletA = d.walletA; w.txSrc = w.txSrc || ""; w.hashEntrata = d.txHash;
      w.voci = [w.voci.filter(function (v) { return v.lato === "da"; })[0], d.voci[0]].concat(fee);
      w.descrizione = "Scambio nell'app " + s.wallet + (s.n ? " n. " + s.n : "") + ": " + D.decStr(s.daQ) + " " + s.daSim + " → " + D.decStr(s.aQ) + " " + s.aSim;
      w.scambioApp = s; tolti.add(d); fatti++;
    });
    return { movimenti: mov.filter(function (m) { return !tolti.has(m); }), abbinati: fatti, giaPermute: giaScambi, mancanti: mancanti };
  }

  /* lettori per tipo: colonne dell'intestazione e chiave che identifica la riga tra file diversi */
  var tutte = function (x) { return Object.keys(x).filter(function (k) { return k !== "_riga" && k !== "balance" && k !== "Saldo"; }).sort().map(function (k) { return k + "=" + x[k]; }).join("|"); };
  var LETTORI = {
    "coinbase": { leggi: function (t) { return leggiCoinbase(t); }, colonne: ["Timestamp", "Transaction Type", "Asset", "Quantity Transacted"], chiave: function (x) { return x.ID ? "id=" + x.ID : tutte(x); } },
    "coinbase-pro": { leggi: function (t) { return leggiCoinbasePro(t); }, colonne: ["type", "time", "amount", "amount/balance unit", "trade id"], chiave: function (x) { return [x.portfolio, x.type, x.time, x.amount, x["amount/balance unit"], x["transfer id"], x["trade id"], x["order id"]].join("|"); } },
    "nexo": { leggi: function (t) { return leggiNexo(t); }, colonne: ["Transaction", "Type", "Input Currency", "Input Amount", "Output Currency", "Output Amount"], chiave: function (x) { return x.Transaction ? "id=" + x.Transaction : tutte(x); } },
    "young": { leggi: function (t) { return leggiYoung(t); }, colonne: ["credit", "debit", "currency", "date", "tx_type"], chiave: function (x) { return x.id ? "id=" + x.id : tutte(x); } },
    "revolut": { leggi: function (t) { return leggiRevolut(t); }, colonne: ["Symbol", "Type", "Quantity", "Price", "Value", "Fees", "Date"], chiave: tutte },
    "relai": { leggi: function (t) { return leggiRelai(t); }, colonne: ["Date", "Transaction Type", "BTC Amount", "Fiat Amount (excl. fees)", "Destination"], chiave: function (x) { return x["Operation ID"] ? "id=" + x["Operation ID"] : tutte(x); } },
    "kraken": { leggi: function (t) { return leggiKraken(t); }, colonne: ["refid", "time", "type", "asset", "amount", "fee"], chiave: function (x) { return x.txid ? "id=" + x.txid : tutte(x); } },
    "ledger": { leggi: function (t) { return leggiLedger(t); }, colonne: ["Operation Date", "Currency Ticker", "Operation Type", "Operation Amount"], chiave: function (x) { return [x["Operation Date"], x["Currency Ticker"], x["Operation Type"], x["Operation Amount"], x["Operation Hash"], x["Account Name"]].join("|"); } }
  };
  /* unione di più file: una riga compare tante volte quante nel file che ne ha di più (righe uguali nello stesso file restano) */
  function unisciRighe(files, colonne, chiave) {
    var out = [], cont = {}, totali = 0;
    files.forEach(function (f) {
      var r = tabella(f.testo, colonne); if (!r) return;
      totali += r.length;
      var loc = {};
      r.forEach(function (x) { var k = chiave(x); loc[k] = (loc[k] || 0) + 1; if (loc[k] > (cont[k] || 0)) { cont[k] = loc[k]; out.push(x); } });
    });
    return { righe: out, totali: totali };
  }

  /* depositi e prelievi di Coinbase Pro che corrispondono ai «Pro Deposit / Pro Withdrawal» di Coinbase: passaggi interni, tolti */
  function abbinaCoinbasePro(esiti) {
    var cb = esiti.filter(function (e) { return e.piattaforma === "Coinbase" && e.trasfPro; }), pro = esiti.filter(function (e) { return e.piattaforma === "Coinbase Pro"; });
    if (!pro.length) return;
    var tr = []; cb.forEach(function (e) { e.trasfPro.forEach(function (x) { tr.push(x); }); e.avvisi = e.avvisi.filter(function (a) { return !/Coinbase Pro \/ Advanced/.test(a); }); });
    var interni = 0;
    pro.forEach(function (e) {
      e.movimenti = e.movimenti.filter(function (m) {
        if (!m.pro) return true;
        var c = tr.filter(function (x) { return !x.usato && x.sim === m.pro.sim && x.q === m.pro.q && Math.abs(x.ts - m.pro.ts) <= 86400000; })
          .sort(function (x, y) { return Math.abs(x.ts - m.pro.ts) - Math.abs(y.ts - m.pro.ts); })[0];
        if (!c) return true;
        c.usato = true; interni++; return false;
      });
      e.interni = (e.interni || 0) + interni;
    });
    var resto = {}; tr.filter(function (x) { return !x.usato; }).forEach(function (x) { resto[x.sim] = (resto[x.sim] || 0n) + x.q; });
    var rk = Object.keys(resto).filter(function (k) { return resto[k] !== 0n; });
    if (rk.length) cb[0].avvisi.push("Passaggi tra Coinbase e Coinbase Pro senza la voce corrispondente nell'estratto Pro: " + rk.map(function (k) { return D.decStr(resto[k], 8) + " " + k; }).join(", ") + ".");
  }

  return { riconosci: riconosci, leggiFile: leggiFile, abbinaTrasferimenti: abbinaTrasferimenti, togliDoppioni: togliDoppioni, leggiScambiApp: leggiScambiApp, applicaScambi: applicaScambi, leggiRevolut: leggiRevolut, leggiRelai: leggiRelai, leggiBitBox: leggiBitBox, leggiEtherscan: leggiEtherscan, dataRevolut: dataRevolut, leggiCoinbasePro: leggiCoinbasePro, romaUTC: romaUTC, leggiBinance: leggiBinance, leggiCoinbase: leggiCoinbase, leggiNexo: leggiNexo, leggiYoung: leggiYoung, leggiLedger: leggiLedger, leggiKraken: leggiKraken, krakenSim: krakenSim, scartoDaNome: scartoDaNome, righeCsv: righeCsv };
});
