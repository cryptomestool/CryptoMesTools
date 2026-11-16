/* Prove di Kraken (ledger da CSV e da API) con dati inventati: node test/kraken.test.js */
"use strict";
const assert = require("assert");
const P = require("../piattaforme.js");
const KK = require("../kraken.js");
const D = require("../detenzione.js");
let n = 0; const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };
const qn = (v) => D.decNum(v);
const voce = (m, lato) => m.voci.filter((v) => v.lato === lato)[0];

const CSV = '"txid","refid","time","type","subtype","aclass","asset","wallet","amount","fee","balance"\n' +
  '"L1","R1","2021-03-01 10:00:00","deposit","","currency","ZEUR","spot / main",1000.0000,0.0000,1000.0000\n' +
  // scambio EUR → BTC: due gambe con lo stesso refid, commissione in euro
  '"L2","T1","2021-03-02 11:00:00.1234","trade","","currency","ZEUR","spot / main",-500.0000,1.3000,498.7000\n' +
  '"L3","T1","2021-03-02 11:00:00.1234","trade","","currency","XXBT","spot / main",0.0100000000,0.0000000000,0.0100000000\n' +
  // acquisto rapido (spend/receive) in USD
  '"L4","S1","2021-03-03 09:00:00","spend","","currency","ZUSD","spot / main",-100.0000,1.5000,0\n' +
  '"L5","S1","2021-03-03 09:00:00","receive","","currency","XETH","spot / main",0.0500000000,0,0.05\n' +
  // passaggio interno a staking: non conta
  '"L6","X1","2021-03-04 09:00:00","transfer","spottostaking","currency","XETH","spot / main",-0.0500000000,0,0\n' +
  '"L7","X2","2021-03-04 09:00:05","transfer","stakingfromspot","currency","ETH2.S","spot / main",0.0500000000,0,0.05\n' +
  '"L8","X3","2021-03-05 09:00:00","staking","","currency","ETH2.S","spot / main",0.0001000000,0,0.0501\n' +
  '"L9","E1","2021-03-06 09:00:00","earn","allocation","currency","DOT","earn / flexible",5,0,5\n' +
  '"L10","E2","2021-03-07 09:00:00","earn","reward","currency","DOT.F","earn / flexible",0.02,0,5.02\n' +
  // prelievo: quantità senza commissione, commissione a parte
  '"L11","W1","2021-03-08 09:00:00","withdrawal","","currency","XXBT","spot / main",-0.0050000000,0.0001000000,0.0049\n' +
  '"L12","M1","2021-03-09 09:00:00","margin","","currency","ZEUR","spot / main",-3.0000,0.0000,495.7\n' +
  '"L13","F1","2021-03-10 09:00:00","transfer","","currency","ETHW","spot / main",0.0500000000,0,0.05\n';

t("riconoscimento del ledger e dell'elenco «Trades»", () => {
  assert.equal(P.riconosci(CSV), "kraken");
  assert.equal(P.riconosci('"txid","ordertxid","pair","time","type","ordertype","price","cost","fee","vol","margin","misc","ledgers"\n'), "kraken-scambi");
  assert.equal(P.krakenSim("XXBT"), "BTC"); assert.equal(P.krakenSim("ETH2.S"), "ETH"); assert.equal(P.krakenSim("DOT.F"), "DOT"); assert.equal(P.krakenSim("USD.HOLD"), "USD"); assert.equal(P.krakenSim("ZETA"), "ZETA"); assert.equal(P.krakenSim("LUNA"), "LUNC"); assert.equal(P.krakenSim("LUNA2"), "LUNA");
});

t("ledger: scambi, acquisti rapidi, staking, interni, prelievi, margine", () => {
  const r = P.leggiKraken(CSV), m = r.movimenti;
  const sc = m.filter((x) => x.tipo === "trade" && voce(x, "a").simbolo === "BTC")[0];
  assert.equal(voce(sc, "da").simbolo, "EUR"); assert.equal(qn(voce(sc, "da").q), -500); assert.equal(qn(voce(sc, "a").q), 0.01);
  assert.equal(voce(sc, "fee").simbolo, "EUR"); assert.equal(qn(voce(sc, "fee").q), -1.3); assert.equal(sc.valore, 500);
  const ar = m.filter((x) => x.tipo === "trade" && voce(x, "a").simbolo === "ETH")[0];
  assert.deepEqual(ar.controvalore, { importo: 100, valuta: "USD" }); assert.equal(qn(voce(ar, "fee").q), -1.5);
  assert.equal(m.filter((x) => x.tag === "reward").length, 2);
  assert.equal(m.filter((x) => x.tag === "reward" && voce(x, "a").simbolo === "ETH").length, 1);
  assert.equal(r.interni, 3);
  const w = m.filter((x) => x.tipo === "withdrawal" && !x.tag)[0];
  assert.equal(qn(voce(w, "da").q), -0.005); assert.equal(qn(voce(w, "fee").q), -0.0001);
  assert.equal(m.filter((x) => x.tag === "airdrop").length, 1);
  assert.ok(r.avvisi.some((a) => /margine/.test(a)));
  assert.equal(m.length, 7);
  assert.equal(new Date(sc.ts).toISOString(), "2021-03-02T11:00:00.000Z");
});

const CSV2 = '"txid","refid","time","type","subtype","aclass","asset","wallet","amount","fee","balance"\n' +
  // il file parte con 5 SOL già sul conto
  '"A1","Q1","2024-01-02 10:00:00","earn","reward","currency","SOL","earn / liquid",0.1000,0.0250,5.0750\n' +
  // acquisto rapido con refid diversi per spend e receive
  '"A2","TSAAA1","2024-01-03 18:44:28","spend","","currency","ZEUR","spot / main",-200.0000,3.0000,100\n' +
  '"A3","TSBBB2","2024-01-03 18:44:28","receive","","currency","GALA","spot / main",9448.13,0,9448.13\n' +
  // prelievo annullato: stessa refid, segni opposti
  '"A4","FTX1","2024-01-31 15:02:38","withdrawal","","currency","GALA","spot / main",-200,80,9168.13\n' +
  '"A5","FTX1","2024-01-31 15:06:29","withdrawal","","currency","GALA","spot / main",200,-80,9448.13\n' +
  // residui: due cripto cedute per un solo EUR
  '"A6","DS1","2024-02-01 09:00:00","spend","dustsweeping","currency","ADA","spot / main",-0.5,0,0\n' +
  '"A7","DS1","2024-02-01 09:00:00","spend","dustsweeping","currency","DOT","spot / main",-0.1,0,0\n' +
  '"A8","DS1","2024-02-01 09:00:00","receive","dustsweeping","currency","ZEUR","spot / main",1.0000,0,101\n' +
  // delisting: USDT → USDC con refid diversi
  '"A9","TRM1","2025-03-31 16:33:09","transfer","delistingconversion","currency","USDT","earn / liquid",-0.4655,0,0\n' +
  '"A10","TRM2","2025-04-01 06:11:33","transfer","delistingconversion","currency","USDC","spot / main",0.4652,0,0.4652\n' +
  '"A11","FUT1","2025-05-01 10:00:00","transfer","spotfromfutures","currency","ETHW","spot / main",0.0000099,0,0.0000099\n' +
  '"A12","Unknown","2025-06-06 00:49:12","reward","welcomebonus","currency","XXBT","spot / main",0.0000946,0,0.0000946\n';

t("ledger reale: ricompense nette, refid diversi, storni, residui, delisting, Futures, saldo iniziale", () => {
  const r = P.leggiKraken(CSV2), m = r.movimenti;
  const rw = m.filter((x) => x.tag === "reward")[0]; assert.equal(qn(voce(rw, "a").q), 0.075);
  const ar = m.filter((x) => x.tipo === "trade" && voce(x, "a").simbolo === "GALA")[0];
  assert.equal(voce(ar, "da").simbolo, "EUR"); assert.equal(qn(voce(ar, "fee").q), -3); assert.equal(ar.valore, 200);
  assert.equal(m.filter((x) => voce(x, "da") && voce(x, "da").simbolo === "GALA").length, 0); // prelievo annullato
  const ds = m.filter((x) => /dust/.test(x.descrizione));
  assert.equal(ds.length, 2); assert.equal(qn(voce(ds[0], "a").q) + qn(voce(ds[1], "a").q), 1);
  const dl = m.filter((x) => x.tipo === "trade" && voce(x, "a").simbolo === "USDC")[0]; assert.equal(voce(dl, "da").simbolo, "USDT");
  assert.ok(m.some((x) => x.tipo === "deposit" && /Futures/.test(x.descrizione)));
  assert.ok(m.some((x) => x.tag === "cashback" && voce(x, "a").simbolo === "BTC"));
  assert.equal(qn(r.saldiIniziali.SOL), 5);
  assert.ok(r.avvisi.some((a) => /non parte dall'apertura/.test(a)));
  assert.ok(r.avvisi.some((a) => /annullati/.test(a)));
});

t("API: ledger convertito nel CSV «Ledgers», unito al CSV senza doppioni", () => {
  const api = { L1: { refid: "R1", time: 1614592800.0, type: "deposit", subtype: "", aclass: "currency", asset: "ZEUR", amount: "1000.0000", fee: "0.0000", balance: "1000.0000" },
    L99: { refid: "T9", time: 1614700000.5, type: "trade", subtype: "", aclass: "currency", asset: "ZEUR", amount: "-10.0000", fee: "0.0300", balance: "1" },
    L98: { refid: "T9", time: 1614700000.5, type: "trade", subtype: "", aclass: "currency", asset: "XXBT", amount: "0.0002", fee: "0", balance: "1" } };
  const csv = KK.versoCsv(api);
  assert.equal(csv.split("\n")[0], "txid,refid,time,type,subtype,aclass,asset,wallet,amount,fee,balance");
  assert.ok(/^L1,R1,2021-03-01 10:00:00,deposit/m.test(csv));
  assert.equal(P.riconosci(csv), "kraken");
  const r = P.leggiFile([{ nome: "ledgers.csv", testo: CSV }, { nome: "Kraken Ledgers (API).csv", testo: csv }]);
  const k = r.file.filter((e) => e.piattaforma === "Kraken")[0];
  assert.equal(k.righe, 15); // 13 + 2 nuove: L1 conta una volta
  assert.equal(k.movimenti.filter((x) => x.tipo === "deposit" && !x.tag && voce(x, "a").simbolo === "EUR").length, 1);
});

t("CSV e API insieme: le righe in comune contano una volta anche senza txid e con numeri scritti diversamente", () => {
  // CSV vecchio senza colonna txid, fino a marzo 2021
  const vecchio = '"refid","time","type","subtype","aclass","asset","amount","fee","balance"\n' +
    '"R1","2021-03-01 10:00:00","deposit","","currency","ZEUR",1000.0000,0.0000,1000.0000\n' +
    '"T1","2021-03-02 11:00:00.1234","trade","","currency","ZEUR",-500.0000,1.3000,498.7000\n' +
    '"T1","2021-03-02 11:00:00.1234","trade","","currency","XXBT",0.0100000000,0.0000000000,0.0100000000\n';
  // API: le stesse due righe dello scambio più una nuova
  const api = KK.versoCsv({ L2: { refid: "T1", time: 1614682800.1234, type: "trade", subtype: "", aclass: "currency", asset: "ZEUR", amount: "-500", fee: "1.3", balance: "498.7" },
    L3: { refid: "T1", time: 1614682800.1234, type: "trade", subtype: "", aclass: "currency", asset: "XXBT", amount: "0.01", fee: "0", balance: "0.01" },
    L4: { refid: "W1", time: 1614769200, type: "withdrawal", subtype: "", aclass: "currency", asset: "XXBT", amount: "-0.005", fee: "0.0001", balance: "0.0049" } });
  const r = P.leggiFile([{ nome: "vecchio.csv", testo: vecchio }, { nome: "api.csv", testo: api }]).file[0];
  assert.equal(r.righe, 4);
  assert.equal(r.movimenti.filter((x) => x.tipo === "trade").length, 1);
  assert.equal(r.movimenti.length, 3);
  assert.ok(/4 diverse/.test(r.avvisi[0]));
});

t("chiave: controlli prima della richiesta", () => {
  assert.ok(KK.controllaChiave("", ""));
  assert.ok(KK.controllaChiave("abc", "corta"));
});

console.log(n + " prove superate");
