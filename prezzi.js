/* CryptoMesTools · Copyright (C) 2026 Massimo Esposito · licenza GNU AGPL-3.0 (file LICENSE) */
/* CryptoMesTools · prezzi in euro per le transazioni lette senza Koinly (piattaforme e blockchain).
   - Cripto: prezzo di chiusura giornaliero (UTC) delle coppie Binance in euro (es. BTCEUR); dove la coppia in euro manca
     o non copre quel giorno, la coppia in USDT convertita in euro al cambio BCE del giorno (USDT considerato pari al dollaro).
     Per le cripto che Binance non quota (es. CRO), la chiusura in dollari di Crypto.com Exchange al cambio BCE.
   - Valute tradizionali e stablecoin legate al dollaro: cambio di riferimento BCE (api.frankfurter.dev); nei giorni senza
     fixing (fine settimana, festivi) vale l'ultimo cambio disponibile.
   - Ai servizi arrivano solo il simbolo della cripto o della valuta e l'intervallo di date: mai quantità, indirizzi o dati del cliente.
   - I valori ricavati così sono stimati e segnalati come tali; restano correggibili a mano nella scheda dei costi.
   - Saldi al 1/1 e al 31/12 ricostruiti dalle transazioni, nel formato dei report Koinly, valutati con gli stessi prezzi. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./detenzione.js"));
  else root.KoinlyPrezzi = factory(root.KoinlyDetenzione);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";
  var BINANCE = "https://api.binance.com/api/v3/klines", BCE = "https://api.frankfurter.dev/v1/", CDC = "https://api.crypto.com/exchange/v1/public/get-candlestick";
  var FIAT_BCE = ["USD", "GBP", "CHF", "JPY", "CAD", "AUD"], USD_STABLE = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP", "FDUSD", "PYUSD", "PAX", "GUSD", "UST", "USDE"];
  var EUR_STABLE = ["EURC", "EURT", "EURI", "EURS", "AEUR"];
  var GIORNO = 86400000;
  /* token che valgono come un'altra cripto (versioni «wrapped» o ponte delle reti EVM) e nomi precedenti (POL era MATIC fino al 2024) */
  var SINONIMI = { WETH: "ETH", WBTC: "BTC", BTCB: "BTC", CBBTC: "BTC", WAVAX: "AVAX", WMATIC: "MATIC", WPOL: "POL", WBNB: "BNB", STETH: "ETH", WSTETH: "ETH", "USDC.E": "USDC", USDBC: "USDC", "USDT.E": "USDT", "DAI.E": "DAI", "WETH.E": "ETH" };
  /* nome precedente della stessa cripto per i giorni non coperti: POL era MATIC fino al 2024; LUNC (Terra Classic) era LUNA fino
     al crollo del maggio 2022, poi la coppia LUNA di Binance è passata alla nuova Terra: la vecchia serie vale solo fino al 12/05/2022 */
  var RIPIEGO = { POL: { s: "MATIC" }, LUNC: { s: "LUNA", fino: "2022-05-12" } };
  function norm(s) { s = String(s || "").toUpperCase().trim(); return SINONIMI[s] || s; }

  function giorno(ts) { return new Date(ts).toISOString().slice(0, 10); }
  function ms(g) { return Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10)); }
  function prima(g) { return giorno(ms(g) - GIORNO); }

  /* opz.json(url) → Promise del JSON, oppure null se il servizio risponde «simbolo inesistente» (iniettabile per le prove);
     opz.avanzamento(testo) facoltativo */
  function crea(opz) {
    opz = opz || {};
    var json = opz.json, cambi = {}, serie = {}, fonti = {}, mancanti = {};

    async function caricaCambi(da, a) {
      var r = await json(BCE + prima(prima(prima(da))) + ".." + a + "?base=EUR&symbols=" + FIAT_BCE.join(","));
      if (r && r.rates) Object.keys(r.rates).forEach(function (g) { cambi[g] = r.rates[g]; });
    }
    async function caricaSerie(coppia, da, a) {
      var out = {}, t = ms(da), fine = ms(a) + GIORNO - 1;
      while (t <= fine) {
        var r = await json(BINANCE + "?symbol=" + coppia + "&interval=1d&startTime=" + t + "&endTime=" + fine + "&limit=1000");
        if (!r) return null; // coppia inesistente
        if (!r.length) break;
        r.forEach(function (k) { out[giorno(k[0])] = parseFloat(k[4]); });
        t = r[r.length - 1][0] + GIORNO;
        if (r.length < 1000) break;
      }
      return out;
    }

    /* seconda fonte per le cripto che Binance non quota (es. CRO): chiusure giornaliere in dollari di Crypto.com Exchange,
       lette a ritroso a blocchi di 300 giorni; null se la coppia non esiste */
    async function caricaSerieCdc(sim, da, a) {
      var out = {}, inizio = ms(da), fine = ms(a) + GIORNO - 1;
      for (var giri = 0; giri < 40 && fine >= inizio; giri++) {
        var r = await json(CDC + "?instrument_name=" + sim + "_USD&timeframe=1D&start_ts=" + inizio + "&end_ts=" + fine + "&count=300");
        if (!r || r.code || !r.result) return giri ? out : null;
        var d = r.result.data || []; if (!d.length) break;
        d.forEach(function (k) { out[giorno(k.t)] = parseFloat(k.c); });
        var primo = Math.min.apply(null, d.map(function (k) { return k.t; }));
        if (d.length < 300) break;
        fine = primo - 1;
      }
      return out;
    }

    /* richieste: elenco di { simbolo, giorno: "AAAA-MM-GG" } */
    async function prepara(richieste) {
      var perSimbolo = {}, min = null, max = null;
      richieste.forEach(function (x) {
        var s = norm(x.simbolo); if (!s || s === "EUR") return;
        var p = perSimbolo[s] || (perSimbolo[s] = { da: x.giorno, a: x.giorno });
        if (x.giorno < p.da) p.da = x.giorno; if (x.giorno > p.a) p.a = x.giorno;
        if (!min || x.giorno < min) min = x.giorno; if (!max || x.giorno > max) max = x.giorno;
      });
      if (!min) return;
      if (opz.avanzamento) opz.avanzamento("cambi BCE");
      await caricaCambi(min, max);
      var simboli = Object.keys(perSimbolo).filter(function (s) { return FIAT_BCE.indexOf(s) < 0 && USD_STABLE.indexOf(s) < 0 && EUR_STABLE.indexOf(s) < 0; });
      for (var i = 0; i < simboli.length; i++) {
        var s = simboli[i], p = perSimbolo[s];
        if (serie[s] && serie[s].da <= p.da && serie[s].a >= p.a) continue;
        if (opz.avanzamento) opz.avanzamento("prezzi " + s + " (" + (i + 1) + " di " + simboli.length + ")");
        var eur = null, usdt = null;
        try { eur = await caricaSerie(s + "EUR", p.da, p.a); } catch (e) { eur = null; }
        // la coppia in USDT serve se quella in euro manca o non copre tutto l'intervallo
        var giorniEur = eur ? Object.keys(eur).sort() : [];
        if (!giorniEur.length || giorniEur[0] > p.da || giorniEur[giorniEur.length - 1] < p.a) { try { usdt = await caricaSerie(s + "USDT", p.da, p.a); } catch (e) { usdt = null; } }
        // nome precedente della stessa cripto per i giorni non coperti (es. POL → MATIC)
        if (RIPIEGO[s]) {
          var pr = function (serieDa) { return serieDa ? Object.keys(serieDa).sort()[0] : null; }, inizio = [pr(eur), pr(usdt)].filter(Boolean).sort()[0];
          if (!inizio || inizio > p.da) {
            var rp = RIPIEGO[s], vecchia = null, fino = rp.fino && rp.fino < p.a ? rp.fino : p.a; if (p.da <= fino) { try { vecchia = await caricaSerie(rp.s + "USDT", p.da, fino); } catch (e) { vecchia = null; } }
            if (vecchia) { usdt = usdt || {}; Object.keys(vecchia).forEach(function (g) { if (g <= fino && usdt[g] == null && !(eur && eur[g] != null)) usdt[g] = vecchia[g]; }); }
          }
        }
        var usd = null;
        if (!giorniEur.length && !(usdt && Object.keys(usdt).length)) {
          if (opz.avanzamento) opz.avanzamento("prezzi " + s + " su Crypto.com Exchange");
          try { usd = await caricaSerieCdc(s, p.da, p.a); } catch (e) { usd = null; }
          if (usd && !Object.keys(usd).length) usd = null;
        }
        serie[s] = { da: p.da, a: p.a, eur: eur || {}, usdt: usdt || {}, usd: usd || {} };
        if (!giorniEur.length && !(usdt && Object.keys(usdt).length) && !usd) mancanti[s] = true;
      }
    }

    /* euro per una unità della valuta nel giorno, dal cambio BCE (ultimo fixing disponibile) */
    function cambio(valuta, g) {
      for (var i = 0; i < 10; i++) { var c = cambi[g]; if (c && c[valuta]) return 1 / c[valuta]; g = prima(g); }
      return null;
    }
    /* { eur, fonte } oppure null */
    function prezzo(simbolo, g) {
      var s = norm(simbolo);
      if (s === "EUR" || EUR_STABLE.indexOf(s) >= 0) return { eur: 1, fonte: s === "EUR" ? "euro" : "stablecoin in euro (1 €)" };
      if (FIAT_BCE.indexOf(s) >= 0) { var c = cambio(s, g); return c ? { eur: c, fonte: "cambio BCE" } : null; }
      if (USD_STABLE.indexOf(s) >= 0) { var u = cambio("USD", g); return u ? { eur: u, fonte: "stablecoin al cambio BCE del dollaro" } : null; }
      var x = serie[s]; if (!x) return null;
      var nota = s !== String(simbolo || "").toUpperCase().trim() ? " (come " + s + ")" : "";
      if (x.eur[g] != null) return { eur: x.eur[g], fonte: "Binance " + s + "/EUR" + nota };
      if (x.usdt[g] != null) { var cu = cambio("USD", g); if (cu) return { eur: x.usdt[g] * cu, fonte: "Binance " + s + "/USDT al cambio BCE" + nota }; }
      if (x.usd && x.usd[g] != null) { var cd = cambio("USD", g); if (cd) return { eur: x.usd[g] * cd, fonte: "Crypto.com Exchange " + s + "/USD al cambio BCE" + nota }; }
      return null;
    }
    return { prepara: prepara, prezzo: prezzo, cambio: cambio, mancanti: function () { return Object.keys(mancanti); } };
  }

  /* giorni per cui servono i prezzi: ogni movimento senza valore in euro e la fine di ogni anno (saldi) */
  function richieste(mov, anni, oggi) {
    var out = [], adesso = oggi || giorno(Date.now()), entro = function (g) { return g > adesso ? adesso : g; };
    mov.forEach(function (m) {
      var g = giorno(m.ts);
      if (m.controvalore && m.controvalore.valuta && m.controvalore.valuta !== "EUR") out.push({ simbolo: m.controvalore.valuta, giorno: g });
      m.voci.forEach(function (v) { if (!m.valore || (v.lato === "fee" && !m.valoreFee)) out.push({ simbolo: v.simbolo, giorno: g }); });
    });
    var simboli = {}; mov.forEach(function (m) { m.voci.forEach(function (v) { simboli[v.simbolo] = 1; }); });
    (anni || []).forEach(function (a) { Object.keys(simboli).forEach(function (s) { out.push({ simbolo: s, giorno: entro((a - 1) + "-12-31") }, { simbolo: s, giorno: entro(a + "-12-31") }); }); });
    return out;
  }

  /* valore in euro dei movimenti che non lo hanno: controvalore in valuta → cambio BCE; altrimenti la gamba in valuta o
     stablecoin, poi quella ceduta, poi quella ricevuta, al prezzo del giorno. Commissione: quantità × prezzo del giorno. */
  function completaValori(mov, P) {
    var stimati = 0, senza = 0, abs = function (q) { return Math.abs(D.decNum(q)); };
    mov.forEach(function (m) {
      var g = giorno(m.ts);
      if (!m.valore) {
        var cv = m.controvalore, fatto = false;
        if (cv && cv.importo) {
          var c = cv.valuta === "EUR" ? { eur: 1, fonte: "euro" } : P.prezzo(cv.valuta, g);
          if (c) { m.valore = cv.importo * c.eur; m.fonteValore = "controvalore in " + cv.valuta + (cv.valuta === "EUR" ? "" : " al cambio BCE"); fatto = true; }
        }
        if (!fatto) {
          var voci = m.voci.filter(function (v) { return v.lato !== "fee"; });
          var peso = function (v) { var s = norm(v.simbolo); return D.FIAT.indexOf(s) >= 0 || FIAT_BCE.indexOf(s) >= 0 ? 0 : USD_STABLE.indexOf(s) >= 0 || EUR_STABLE.indexOf(s) >= 0 ? 1 : v.lato === "da" ? 2 : 3; };
          voci.slice().sort(function (x, y) { return peso(x) - peso(y); }).some(function (v) {
            var p = P.prezzo(v.simbolo, g); if (!p) return false;
            m.valore = abs(v.q) * p.eur; m.fonteValore = "stimato: " + p.fonte; fatto = true; return true;
          });
        }
        if (fatto) { m.valoreStimato = true; stimati++; } else if (m.voci.some(function (v) { return v.lato !== "fee"; })) senza++;
      }
      if (!m.valoreFee) {
        var f = m.voci.filter(function (v) { return v.lato === "fee"; })[0];
        if (f) { var pf = P.prezzo(f.simbolo, g); if (pf) m.valoreFee = abs(f.q) * pf.eur; }
      }
    });
    return { stimati: stimati, senzaValore: senza };
  }

  /* saldi al 1/1 e al 31/12 di ogni anno ricostruiti dalle transazioni, nel formato dei report Koinly (lettura.js) */
  function saldiRicostruiti(mov, anni, P, oggi) {
    var out = [], adesso = oggi || giorno(Date.now());
    // prezzo del giorno o, se manca (anno in corso, giorno senza chiusura), dei giorni precedenti fino a una settimana
    var prezzoEntro = function (s, g) { for (var i = 0; i < 8; i++) { var p = P.prezzo(s, g); if (p) return Object.assign({ giorno: g }, p); g = giorno(ms(g) - GIORNO); } return null; };
    anni.forEach(function (a) {
      [["inizio", Date.UTC(a, 0, 1), (a - 1) + "-12-31", a + "-01-01"], ["fine", Date.UTC(a + 1, 0, 1), a + "-12-31", a + "-12-31"]].forEach(function (x) {
        var q = {};
        mov.forEach(function (m) { if (m.ts < x[1]) m.voci.forEach(function (v) { q[v.simbolo] = (q[v.simbolo] || 0n) + v.q; }); });
        var futuro = x[2] > adesso, gp = futuro ? adesso : x[2], usato = null;
        var avvisi = [], saldi = Object.keys(q).sort().filter(function (s) { return q[s] > 0n && D.FIAT.indexOf(s) < 0; }).map(function (s) {
          var p = prezzoEntro(s, gp), n = D.decNum(q[s]); if (p && (!usato || p.giorno < usato)) usato = p.giorno;
          if (!p) avvisi.push(s + ": prezzo al " + gp.split("-").reverse().join("/") + " non trovato, valore zero da completare");
          return { attivo: s, simbolo: s, tipo: USD_STABLE.indexOf(norm(s)) >= 0 || EUR_STABLE.indexOf(norm(s)) >= 0 ? "stablecoin" : "cripto", quantita: n, quantitaTesto: D.decStr(q[s]), costo: null, valore: p ? n * p.eur : 0, descrizione: p ? p.fonte : "prezzo mancante" };
        });
        var negativi = Object.keys(q).filter(function (s) { return q[s] < 0n && D.FIAT.indexOf(s) < 0; });
        if (negativi.length) avvisi.push("Saldi negativi (mancano movimenti in entrata): " + negativi.join(", ") + ".");
        var tot = saldi.reduce(function (s, z) { return s + z.valore; }, 0);
        out.push({ data: x[3], slot: x[0], r: { fonte: "ricostruito", anno: a, tipoSaldi: x[0], dataSaldi: x[3], annoSolare: true, inizioAnno: x[0] === "inizio", fineAnno: x[0] === "fine",
          saldi: saldi, valoreCripto: tot, valoreFiat: 0, valoreTotale: tot, avvisi: [futuro
            ? "Anno in corso: saldi ricostruiti dalle transazioni fino a oggi, valutati all'ultimo prezzo disponibile (" + (usato || gp).split("-").reverse().join("/") + "). Valore provvisorio, da aggiornare con il prezzo del " + x[2].split("-").reverse().join("/") + "."
            : "Saldi ricostruiti dalle transazioni, prezzi di chiusura del " + x[2].split("-").reverse().join("/") + " (stimati)."].concat(avvisi), plusvalenze: null, redditi: null, provvisorio: futuro || undefined, dataPrezzi: usato || gp } });
      });
    });
    return out;
  }

  return { crea: crea, richieste: richieste, completaValori: completaValori, saldiRicostruiti: saldiRicostruiti, giorno: giorno, USD_STABLE: USD_STABLE };
});
