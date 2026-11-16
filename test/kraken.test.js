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
  assert.equal(P.krakenSim("XXBT"), "BTC"); assert.equal(P.krakenSim("ETH2.S"), "ETH"); assert.equal(P.krakenSim("DOT.F"), "DOT"); assert.equal(P.krakenSim("USD.HOLD"), "USD"); assert.equal(P.krakenSim("ZETA"), "ZETA");
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

t("chiave: controlli prima della richiesta", () => {
  assert.ok(KK.controllaChiave("", ""));
  assert.ok(KK.controllaChiave("abc", "corta"));
});

console.log(n + " prove superate");
