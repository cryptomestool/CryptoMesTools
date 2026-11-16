/* Prove di lettura, giorni di detenzione e IVACA con dati inventati: node test/detenzione.test.js */
"use strict";
const assert = require("assert");
const L = require("../lettura.js"), D = require("../detenzione.js"), I = require("../ivaca.js");
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= (tol || 0.01), (msg || "") + " atteso " + b + ", ottenuto " + a);
let n = 0; const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };

// backup Koinly: 1 BTC dal 2024; vendita di 0,4 BTC il 10/03/2025; acquisto di 2 ETH il 01/06/2025; token spam con lettera cirillica
const TX = [
  "ID (read-only),Parent ID (read-only),Date (UTC),Type,Tag,From Wallet (read-only),From Wallet ID,From Amount,From Currency,To Wallet (read-only),To Wallet ID,To Amount,To Currency,Fee Amount,Fee Currency,Net Worth Amount,Net Worth Currency,Fee Worth Amount,Fee Worth Currency,Net Value (read-only),Fee Value (read-only),Value Currency (read-only),Deleted",
  "1,,2024-05-01 10:00:00,trade,,W,1,30000.0,EUR;11,W,1,1.0,BTC;1,0.0,,,,,,30000.0,0.0,EUR;11,false",
  "2,,2025-03-10 09:00:00,trade,,W,1,0.4,BTC;1,W,1,24000.0,EUR;11,0.0,,,,,,24000.0,0.0,EUR;11,false",
  "3,,2025-06-01 12:00:00,trade,,W,1,5000.0,EUR;11,W,1,2.0,ETH;3,0.0,,,,,,5000.0,0.0,EUR;11,false",
  "4,,2025-07-01 12:00:00,withdrawal,,W,1,5000.0,USDС;999,,,0.0,,0.0,,,,,,0.0,0.0,EUR;11,false",
  "5,,2025-08-01 12:00:00,transfer,,W,1,1.0,ETH;3,W2,2,1.0,ETH;3,0.0,,,,,,2600.0,0.0,EUR;11,false",
  "6,,2024-12-31 23:30:00,trade,,W,1,10.0,EUR;11,W,1,10.0,USDT;8,0.0,,,,,,10.0,0.0,EUR;11,false",
  "7,,2025-01-02 00:30:00,trade,,W,1,10.0,USDT;8,W,1,10.0,EUR;11,0.0,,,,,,10.0,0.0,EUR;11,false",
  "8,,2025-02-01 08:00:00,trade,,W,1,1.0,EUR;11,W,1,1.0,XRP;2,0.0,,,,,,1.0,0.0,EUR;11,true"
].join("\n");
const INIZIO = 'Saldi al 2025-01-01 00:00\n\nAttivo,Quantità,Costo (EUR),Valore (EUR),Descrizione\nBTC (Bitcoin),"1,00000000","30.000,00","90.000,00","@ 90.000,00 € per BTC"\nUSDT (Tether),"10,00000000","10,00","9,60","@ 0,96 € per USDT"\nTotale,-,"30.010,00","90.009,60",-\n';
const FINE = 'Saldi al 31/12/2025 23:59\n\nAttivo,Quantità,Costo (EUR),Valore (EUR),Descrizione\nBTC (Bitcoin),0.60000000,"18,000.00","54,000.00","@ €90,000.00 per BTC"\nETH (Ethereum),2.00000000,"5,000.00","6,000.00","@ €3,000.00 per ETH"\nTotale,-,"23,000.00","60,000.00",-\n';

const dati = D.leggiTransazioni(TX);
const ini = L.leggiCsv(INIZIO), fin = L.leggiCsv(FINE);
const iniz = {}; ini.saldi.forEach((s) => { iniz[s.simbolo] = s.quantitaTesto; });
const c = D.calcola(dati, 2025, { iniziali: iniz });
const riga = (s) => c.righe.find((r) => r.simbolo === s && !r.spam);

t("Lettura: formato backup, righe cancellate escluse, report di inizio (italiano) e fine anno (inglese)", () => {
  assert.equal(dati.formato, "backup"); assert.equal(dati.cancellate, 1); assert.equal(dati.movimenti.length, 7);
  assert.equal(ini.tipoSaldi, "inizio"); assert.equal(ini.anno, 2025); assert.equal(ini.formato, "it"); assert.equal(ini.saldi[0].quantitaTesto, "1.00000000");
  assert.equal(fin.tipoSaldi, "fine"); assert.equal(fin.formato, "en"); near(fin.valoreCripto, 60000);
});
t("Vendita: il periodo si chiude nel giorno della vendita, il residuo parte dal giorno dopo", () => {
  const b = riga("BTC");
  assert.equal(b.giorni, 365); assert.equal(b.periodi.length, 2);
  assert.deepEqual([b.periodi[0].dal, b.periodi[0].al, b.periodi[0].giorni, b.periodi[0].quantita], ["2025-01-01", "2025-03-10", 69, "1"]);
  assert.deepEqual([b.periodi[1].dal, b.periodi[1].al, b.periodi[1].giorni, b.periodi[1].quantita], ["2025-03-11", "2025-12-31", 296, "0.6"]);
  near(b.periodi[0].valore, 60000); // prezzo del giorno di vendita: 24.000 / 0,4
});
t("Acquisto: il periodo parte dal giorno dell'acquisto; i trasferimenti tra wallet non cambiano la quantità", () => {
  const e = riga("ETH");
  assert.equal(e.giorni, 214); assert.equal(e.periodi.length, 1); assert.equal(e.periodi[0].dal, "2025-06-01"); assert.equal(e.finale, "2");
});
t("Saldi al 1/1 dal report e confronto con quelli ricostruiti; quantità al 31/12 uguali al report", () => {
  assert.equal(c.saldiInizialiDaReport, true); assert.equal(c.differenzeIniziali.length, 0);
  assert.equal(D.confronta(c, fin.saldi).length, 0);
});
t("Token spam con caratteri non latini: escluso e segnalato", () => {
  const s = c.righe.find((r) => r.spam);
  assert.ok(s && /USD/.test(s.nome)); assert.equal(c.spam, 1); assert.equal(c.anomalie, 0);
});
t("Fuso orario: un movimento alle 00:30 UTC del 2/1 resta il 2/1; alle 23:30 UTC del 31/12 in Italia è già il 1/1", () => {
  const u = D.calcola(dati, 2025, { fuso: "UTC" }).righe.find((r) => r.simbolo === "USDT");
  assert.equal(u.giorni, 2); // 1/1 e 2/1 (venduto il 2/1)
  const r = D.calcola(dati, 2025, { fuso: "Europe/Rome" }).righe.find((x) => x.simbolo === "USDT");
  assert.equal(r.iniziale, "0"); assert.equal(r.giorni, 2); // comprato il 1/1 ora italiana, venduto il 2/1
});
t("IVACA per periodi: valore finale × 0,20% × quota × giorni / 365, valori dei report al 1/1 e al 31/12", () => {
  const iv = I.calcola(c, { quota: 1, saldiInizio: ini.saldi, saldiFine: fin.saldi });
  const b = iv.righe.find((r) => r.nome === "BTC"), e = iv.righe.find((r) => r.nome === "ETH");
  near(b.periodi[0].valoreIniziale, 90000); assert.equal(b.periodi[0].fonteIniziale, "report");
  near(b.periodi[1].valore, 54000); assert.equal(b.periodi[1].fonteFinale, "report");
  near(b.periodi[1].valoreIniziale, b.periodi[0].valore); assert.equal(b.periodi[1].fonteIniziale, "precedente");
  near(b.ivaca, 60000 * 0.002 * 69 / 365 + 54000 * 0.002 * 296 / 365);
  near(e.ivaca, 6000 * 0.002 * 214 / 365);
  const met = I.calcola(c, { quota: 0.5, saldiInizio: ini.saldi, saldiFine: fin.saldi });
  near(met.totali.ivaca, iv.totali.ivaca / 2);
  assert.ok(!iv.righe.find((r) => r.spam).incluso);
});
t("Report di inizio anno vuoto (solo «Totale 0»): saldi a zero, detenzione dal primo movimento dell'anno", () => {
  const vuoto = L.leggiCsv("Saldi al 2020-01-01 00:00\n\nAttivo,Quantità,Costo (EUR),Valore (EUR),Descrizione\nTotale,-,0.0,0.0,-\n");
  assert.equal(vuoto.errore, undefined); assert.equal(vuoto.tipoSaldi, "inizio"); assert.equal(vuoto.anno, 2020); assert.equal(vuoto.saldi.length, 0);
  assert.ok(/zero/.test(vuoto.avvisi.join(" ")));
  const tx = D.leggiTransazioni([
    "Date,Type,Tag,Sending Wallet,Sent Amount,Sent Currency,Sent Cost Basis,Receiving Wallet,Received Amount,Received Currency,Received Cost Basis,Fee Amount,Fee Currency,Gain (EUR),Net Value (EUR),Fee Value (EUR),TxSrc,TxDest,TxHash,Description",
    '2020-04-15 06:39:51 UTC,fiat_deposit,"","","","","",W,"1000,00",EUR,"","","","","1000,00","","","","",',
    '2020-04-16 10:00:00 UTC,buy,"",W,"1000,00",EUR,"",W,"0,15",BTC,"","","","","1000,00","","","","",'].join("\n"));
  const z = D.calcola(tx, 2020, { iniziali: {} });
  assert.ok(z.saldiInizialiZero); assert.equal(z.primoMovimento, "2020-04-16"); assert.equal(z.differenzeIniziali.length, 0);
  const b = z.righe.find((r) => r.simbolo === "BTC");
  assert.equal(b.inizialeN, 0); assert.equal(b.periodi.length, 1); assert.equal(b.periodi[0].dal, "2020-04-16"); assert.equal(b.giorni, 260);
  near(b.periodi[0].valoreIniziale, 1000);
  const v = I.calcola(z, { saldiInizio: vuoto.saldi, saldiFine: [] });
  assert.equal(v.righe[0].periodi[0].fonteIniziale, "transazione");
  assert.ok(!c.saldiInizialiZero);
});
t("Soglia delle valute fino al 2022: 51.645,69 € per 7 giorni lavorativi continui, prezzi al 1° gennaio", () => {
  const H = "Date,Type,Tag,Sending Wallet,Sent Amount,Sent Currency,Sent Cost Basis,Receiving Wallet,Received Amount,Received Currency,Received Cost Basis,Fee Amount,Fee Currency,Gain (EUR),Net Value (EUR),Fee Value (EUR),TxSrc,TxDest,TxHash,Description";
  const r = (d, sa, sc, ra, rc, v) => d + " 10:00:00 UTC,trade,,W," + sa + "," + sc + ",,W," + ra + "," + rc + ",,,,," + v + ",,,,,";
  // 1 BTC al 1/1/2021 (report: 25.000 €), altro 1 BTC comprato lunedì 1/3 a 40.000 € (vale comunque il prezzo del report),
  // 10 ETH comprati il 1/3 a 1.300 € (non nel report: prezzo della prima transazione). Giacenza al prezzo del 1/1: 2×25.000 + 10×1.300 = 63.000
  const tx = D.leggiTransazioni([H, r("2020-06-01", "9000", "EUR", "1", "BTC", "9000"), r("2021-03-01", "40000", "EUR", "1", "BTC", "40000"),
    r("2021-03-01", "13000", "EUR", "10", "ETH", "13000"), r("2021-03-05", "1", "ETH", "1500", "EUR", "1500"), r("2021-03-09", "2", "BTC", "100000", "EUR", "100000")].join("\n"));
  const iniz = L.leggiCsv('Saldi al 2021-01-01 00:00\n\nAttivo,Quantità,Costo (EUR),Valore (EUR),Descrizione\nBTC (Bitcoin),1.00000000,"9,000.00","25,000.00",-\nTotale,-,"9,000.00","25,000.00",-\n');
  const c21 = D.calcola(tx, 2021, { iniziali: { BTC: "1" } });
  const v = D.sogliaValute(c21, { saldiInizio: iniz.saldi });
  // lun 1/3 - mar 9/3 (giorno della vendita, con la quantità di prima): 7 giorni lavorativi
  assert.ok(v.applicabile); assert.ok(v.superata); assert.equal(v.dal, "2021-03-01"); assert.equal(v.al, "2021-03-09"); assert.equal(v.giorniConsecutiviMax, 7);
  near(v.valoreMax, 63000); assert.equal(v.stimati, 1);
  assert.equal(v.prezzi.find((p) => p.nome === "BTC").fonte, "report"); near(v.prezzi.find((p) => p.nome === "ETH").prezzo, 1300);
  // con la soglia un po' più alta, o 8 giorni richiesti, non è superata
  assert.ok(!D.sogliaValute(c21, { saldiInizio: iniz.saldi, giorni: 8 }).superata);
  // soglia non superata: nessuna cessione rilevante
  { const C0 = require("../costi.js"), ces0 = C0.calcola(tx, { anno: 2021 }).cessioni.filter((z) => C0.rilevante(z.tipo, 2021));
    assert.equal(D.sogliaValute(c21, { saldiInizio: iniz.saldi, dati: tx, cessioni: ces0, giorni: 8 }).cessioni.rilevanti, 0); }
  assert.ok(!D.sogliaValute(c21, { saldiInizio: iniz.saldi, soglia: 63000 }).superata);
  // festivi: Pasquetta 2022 (18/4) e 25/4 non sono lavorativi; sabato e domenica nemmeno
  assert.ok(!D.lavorativo("2022-04-18")); assert.ok(!D.lavorativo("2022-04-25")); assert.ok(!D.lavorativo("2022-04-23")); assert.ok(D.lavorativo("2022-04-19"));
  assert.ok(!D.sogliaValute(c, {}).applicabile);
  // condizione annuale: la soglia è superata (7 giorni lavorativi dal 1/3 al 9/3), quindi sono rilevanti tutte le cessioni dell'anno,
  // anche quella di venerdì 5/3 quando i giorni sopra la soglia erano solo 5. Giacenza nell'istante e giorni restano come informazione.
  const C = require("../costi.js");
  const ces = C.calcola(tx, { anno: 2021 }).cessioni.filter((z) => C.rilevante(z.tipo, 2021));
  const w = D.sogliaValute(c21, { saldiInizio: iniz.saldi, dati: tx, cessioni: ces });
  assert.equal(w.cessioni.totale, 2); assert.equal(w.cessioni.rilevanti, 2);
  const eth = w.cessioni.cessioni.find((z) => z.cripto === "ETH"), btc = w.cessioni.cessioni.find((z) => z.cripto === "BTC");
  near(eth.giacenza, 63000); assert.equal(eth.giorniSopra, 5); assert.ok(eth.rilevante);
  near(btc.giacenza, 61700); assert.equal(btc.giorniSopra, 7); assert.ok(btc.rilevante);
});
console.log("\n" + n + " prove superate");
