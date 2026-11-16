/* Prove dei prezzi in euro e dei saldi ricostruiti, con risposte dei servizi inventate: node test/prezzi.test.js */
"use strict";
const assert = require("assert");
const Z = require("../prezzi.js");
const D = require("../detenzione.js");
let n = 0; const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };
const ta = async (nome, fn) => { await fn(); n++; console.log("ok -", nome); };
const ms = (g) => Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10));
const k = (g, close) => [ms(g), "0", "0", "0", String(close)];

/* servizi finti: BTCEUR solo dal 2020-01-02, BTCUSDT sempre, ETHUSDT, XYZ inesistente; cambio BCE 1 € = 1,25 $ (0,80 € per dollaro) */
const chiamate = [];
function json(url) {
  chiamate.push(url);
  if (url.indexOf("frankfurter") >= 0) return Promise.resolve({ rates: { "2019-12-27": { USD: 1.25, GBP: 0.8 }, "2019-12-31": { USD: 1.25, GBP: 0.8 }, "2020-01-02": { USD: 1.25, GBP: 0.8 }, "2020-12-31": { USD: 1.25, GBP: 0.8 } } });
  const sym = /symbol=([A-Z]+)/.exec(url)[1];
  const serie = {
    BTCEUR: [k("2020-01-02", 6500), k("2020-01-03", 6600), k("2020-12-31", 23000)],
    BTCUSDT: [k("2019-12-31", 7200), k("2020-01-02", 7000), k("2020-01-03", 7100), k("2020-12-31", 29000)],
    ETHUSDT: [k("2019-12-31", 130), k("2020-01-03", 125), k("2020-12-31", 740)]
  };
  if (!serie[sym]) return Promise.resolve(null);
  const st = +/startTime=(\d+)/.exec(url)[1], en = +/endTime=(\d+)/.exec(url)[1];
  return Promise.resolve(serie[sym].filter((x) => x[0] >= st && x[0] <= en));
}
const q = (s) => D.dec(s);
const mov = [
  // acquisto BTC con EUR: valore già nel file
  { ts: ms("2020-01-02") + 3600e3, tipo: "trade", valore: 650, valoreFee: 0, voci: [{ simbolo: "EUR", q: q("-650"), lato: "da" }, { simbolo: "BTC", q: q("0.1"), lato: "a" }] },
  // permuta BTC → ETH senza valore, commissione in ETH
  { ts: ms("2020-01-03") + 3600e3, tipo: "trade", valore: 0, valoreFee: 0, voci: [{ simbolo: "BTC", q: q("-0.05"), lato: "da" }, { simbolo: "ETH", q: q("2.6"), lato: "a" }, { simbolo: "ETH", q: q("-0.01"), lato: "fee" }] },
  // vendita con controvalore in dollari
  { ts: ms("2020-01-03") + 7200e3, tipo: "trade", valore: 0, valoreFee: 0, controvalore: { importo: 125, valuta: "USD" }, voci: [{ simbolo: "ETH", q: q("-1"), lato: "da" }, { simbolo: "USD", q: q("125"), lato: "a" }] },
  // token senza prezzo
  { ts: ms("2020-01-03") + 9000e3, tipo: "deposit", valore: 0, valoreFee: 0, voci: [{ simbolo: "XYZ", q: q("10"), lato: "a" }] }
];

(async () => {
  const P = Z.crea({ json });
  await P.prepara(Z.richieste(mov, [2020]));

  t("prezzi: coppia in euro, poi USDT al cambio BCE; valute e stablecoin al cambio", () => {
    assert.deepEqual(P.prezzo("BTC", "2020-01-02"), { eur: 6500, fonte: "Binance BTC/EUR" });
    assert.equal(P.prezzo("BTC", "2019-12-31").eur, 7200 * 0.8); // prima della coppia in euro
    assert.equal(P.prezzo("ETH", "2020-01-03").eur, 100);
    assert.equal(P.prezzo("USDT", "2020-01-03").eur, 0.8); // fixing del giorno prima
    assert.equal(P.prezzo("EUR", "2020-01-03").eur, 1);
    assert.equal(P.prezzo("XYZ", "2020-01-03"), null);
    assert.deepEqual(P.mancanti(), ["XYZ"]);
  });
  t("ai servizi arrivano solo simboli e date", () => {
    chiamate.forEach((u) => assert.ok(!/0\.1|650|2\.6/.test(u.replace(/startTime=\d+|endTime=\d+/g, "")), u));
  });
  t("valori dei movimenti: gamba ceduta, controvalore in dollari, commissione, senza prezzo", () => {
    const r = Z.completaValori(mov, P);
    assert.equal(mov[0].valore, 650); assert.ok(!mov[0].valoreStimato);
    assert.equal(mov[1].valore, 0.05 * 6600); assert.equal(mov[1].fonteValore, "stimato: Binance BTC/EUR");
    assert.ok(Math.abs(mov[1].valoreFee - 0.01 * 100) < 1e-9);
    assert.equal(mov[2].valore, 100); assert.equal(mov[2].fonteValore, "controvalore in USD al cambio BCE");
    assert.equal(mov[3].valore, 0);
    assert.deepEqual(r, { stimati: 2, senzaValore: 1 });
  });
  t("saldi ricostruiti al 1/1 e al 31/12, nel formato dei report", () => {
    const s = Z.saldiRicostruiti(mov, [2020], P);
    assert.equal(s.length, 2);
    const ini = s[0], fin = s[1];
    assert.equal(ini.data, "2020-01-01"); assert.equal(ini.slot, "inizio"); assert.equal(ini.r.saldi.length, 0);
    assert.equal(fin.data, "2020-12-31"); assert.equal(fin.r.tipoSaldi, "fine");
    const btc = fin.r.saldi.filter((x) => x.simbolo === "BTC")[0], eth = fin.r.saldi.filter((x) => x.simbolo === "ETH")[0];
    assert.equal(btc.quantitaTesto, "0.05"); assert.equal(btc.valore, 0.05 * 23000);
    assert.equal(eth.quantitaTesto, "1.59"); assert.ok(Math.abs(eth.valore - 1.59 * 740 * 0.8) < 1e-9);
    assert.ok(fin.r.saldi.every((x) => x.simbolo !== "USD"));
    assert.ok(fin.r.avvisi.some((a) => /XYZ: prezzo/.test(a)));
  });
  t("anno in corso: saldi al 31/12 futuro valutati all'ultimo prezzo disponibile, segnalati come provvisori", () => {
    const s = Z.saldiRicostruiti(mov, [2020], P, "2020-01-04");
    const fin = s[1].r, btc = fin.saldi.filter((x) => x.simbolo === "BTC")[0];
    assert.equal(fin.provvisorio, true); assert.equal(fin.dataPrezzi, "2020-01-03");
    assert.equal(btc.valore, 0.05 * 6600);
    assert.ok(/Anno in corso/.test(fin.avvisi[0]));
    const r = Z.richieste(mov, [2020], "2020-01-04");
    assert.ok(r.every((x) => x.giorno <= "2020-01-04"));
  });
  // sinonimi e nome precedente: WETH vale ETH; POL prima del 2024 usa la serie MATIC
  const json2 = (url) => {
    if (url.indexOf("frankfurter") >= 0) return Promise.resolve({ rates: { "2023-06-01": { USD: 1.25 }, "2024-10-01": { USD: 1.25 } } });
    const sym = /symbol=([A-Z]+)/.exec(url)[1];
    const serie = { ETHEUR: [k("2023-06-01", 1700)], POLUSDT: [k("2024-10-01", 0.4)], MATICUSDT: [k("2023-06-01", 0.9)] };
    if (!serie[sym]) return Promise.resolve(null);
    const st = +/startTime=(\d+)/.exec(url)[1], en = +/endTime=(\d+)/.exec(url)[1];
    return Promise.resolve(serie[sym].filter((x) => x[0] >= st && x[0] <= en));
  };
  const P2 = Z.crea({ json: json2 });
  await P2.prepara([{ simbolo: "WETH", giorno: "2023-06-01" }, { simbolo: "POL", giorno: "2023-06-01" }, { simbolo: "POL", giorno: "2024-10-01" }, { simbolo: "USDC.e", giorno: "2023-06-01" }]);
  t("sinonimi (WETH come ETH, USDC.e come USDC) e POL con la serie MATIC prima del cambio di nome", () => {
    assert.deepEqual(P2.prezzo("WETH", "2023-06-01"), { eur: 1700, fonte: "Binance ETH/EUR (come ETH)" });
    assert.equal(P2.prezzo("USDC.e", "2023-06-01").eur, 0.8);
    assert.equal(P2.prezzo("POL", "2023-06-01").eur, 0.9 * 0.8);
    assert.equal(P2.prezzo("POL", "2024-10-01").eur, 0.4 * 0.8);
  });
  console.log(n + " prove superate");
})().catch((e) => { console.log("ERRORE", e && e.stack || e); });
