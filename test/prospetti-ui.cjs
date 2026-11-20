/* Prove di regressione dell'interfaccia, con dati e risposte di rete simulati.
   Esecuzione: node test/prospetti-ui.cjs */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const moduli = [
  "lettura", "detenzione", "prezzi", "piattaforme", "onchain", "kraken", "ivaca",
  "banca", "costi", "pratica", "provenienza", "questionario", "sanzioni", "modelli",
  "estero", "etoro", "xlsx-mini", "docx-mini", "report", "ui"
];
const codice = moduli.map(nome => [nome, readFileSync(path.join(__dirname, "..", nome + ".js"), "utf8")]);
const csv = [
  "User ID,Time,Account,Operation,Coin,Change,Remark",
  "1,2025-01-15 12:00:00,Spot,Buy,BTC,1,",
  "1,2025-01-15 12:00:00,Spot,Sell,EUR,-30000,"
].join("\n");

async function attendi(condizione) {
  for (let i = 0; i < 120; i++) {
    if (condizione()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail("La scheda non ha completato l'operazione");
}

function applicazione({ prezzi = true, primaDeiPrezzi } = {}) {
  const eventi = {}, elementi = {}, stampe = [];
  function elemento() {
    return {
      innerHTML: "", open: false,
      addEventListener(tipo, fn) { eventi[tipo] = fn; },
      querySelector() { return null; },
      showModal() { this.open = true; },
      close() { this.open = false; }
    };
  }
  for (const id of ["app", "steps", "ricomincia"]) elementi[id] = elemento();
  const adesso = Date.parse("2026-11-19T12:00:00Z");
  class DataProva extends Date {
    constructor(...args) { super(...(args.length ? args : [adesso])); }
    static now() { return adesso; }
  }
  async function richiesta(url) {
    const u = new URL(url);
    const risposta = (body, status = 200) => ({ status, ok: status === 200, json: async () => body });
    if (u.hostname === "api.frankfurter.dev") {
      if (primaDeiPrezzi) await primaDeiPrezzi();
      return risposta({ rates: {} });
    }
    if (prezzi && u.hostname === "api.binance.com" && u.searchParams.get("symbol") === "BTCEUR") {
      const fine = Math.min(adesso, +u.searchParams.get("endTime"));
      const serie = [];
      for (let giorno = +u.searchParams.get("startTime"); giorno <= fine && serie.length < 1000; giorno += 86400000) {
        serie.push([giorno, "0", "0", "0", "50000"]);
      }
      return risposta(serie);
    }
    return risposta(null, 400);
  }
  const valoriLocali = new Map();
  const body = {
    appendChild(el) { elementi[el.id] = el; return el; },
    classList: { add() {}, remove() {} }
  };
  const finestra = {
    Date: DataProva, fetch: richiesta, setTimeout, setInterval, clearInterval,
    scrollTo() {}, addEventListener() {},
    print() { stampe.push(elementi.resoconto.innerHTML); },
    localStorage: { getItem: chiave => valoriLocali.get(chiave), setItem: (chiave, valore) => valoriLocali.set(chiave, valore) },
    document: { getElementById: id => elementi[id] || null, createElement: elemento, body }
  };
  finestra.window = finestra;
  finestra.self = finestra;
  const ambiente = vm.createContext(finestra);
  for (const [nome, file] of codice) vm.runInContext(file, ambiente, { filename: nome + ".js" });
  function invia(tipo, attributo, valore, files = [], id = "") {
    const target = {
      id, files,
      matches: selettore => !!attributo && selettore === "[" + attributo + "]",
      closest(selettore) { return this.matches(selettore) ? this : null; },
      getAttribute: nome => nome === attributo ? valore : null
    };
    eventi[tipo]({ target });
  }
  function clic(attributo, valore) { invia("click", attributo, valore); }
  function pulsante(id) { invia("click", "", "", [], id); }
  async function carica(testo = csv) {
    clic("data-percorso", "ordinaria");
    invia("change", "data-dedicato", "binance", [{ name: "prova-binance.csv", text: async () => testo }]);
    await attendi(() => elementi.app.innerHTML.includes("prova-binance.csv"));
  }
  function avviaCalcolo() { clic("data-calcola", ""); }
  async function calcola() {
    avviaCalcolo();
    await attendi(() => elementi.flashRicostruzione?.open || elementi.calcoloInCorso?.innerHTML.includes("Calcolo non riuscito"));
  }
  return { clic, pulsante, carica, calcola, avviaCalcolo, elementi, stampe, html: () => elementi.app.innerHTML };
}

test("l'ordinaria stampa RW e F24 per l'ultimo anno chiuso", async () => {
  const app = applicazione();
  await app.carica();
  await app.calcola();
  app.clic("data-tab", "4");
  app.pulsante("stampaRW");
  app.pulsante("stampaF24");
  assert.equal(app.stampe.length, 2);
  assert.match(app.stampe[0], /Quadro RW cripto-attività · anno 2025/);
  assert.match(app.stampe[1], /1727[\s\S]*?<td[^>]*>2025<\/td>/);
  assert.doesNotMatch(app.stampe[1], /<td[^>]*>2026<\/td>/);
});

test("rimuovere l'unico CSV invalida subito RW, F24 e fascicolo, anche dopo un ricalcolo fallito", async () => {
  const app = applicazione();
  await app.carica();
  await app.calcola();
  app.clic("data-toglipiatt", "0");
  app.clic("data-tab", "4");
  assert.match(app.html(), /I dati importati sono cambiati/);
  assert.doesNotMatch(app.html(), /id="stampa(?:RW|RT|F24)"/);
  app.clic("data-tab", "1");
  app.avviaCalcolo();
  await attendi(() => app.elementi.calcoloInCorso?.innerHTML.includes("Nessun movimento"));
  app.clic("data-tab", "8");
  assert.doesNotMatch(app.html(), /id="stampaCompleta"/);
  for (const id of ["stampaRW", "stampaRT", "stampaF24", "stampaCompleta"]) app.pulsante(id);
  assert.equal(app.stampe.length, 0);
  await app.carica();
  app.avviaCalcolo();
  await attendi(() => !app.elementi.calcoloInCorso.open);
  app.clic("data-tab", "4");
  assert.match(app.html(), /id="stampaRW"/);
  assert.match(app.html(), /id="stampaF24"/);
});

test("prezzi di chiusura assenti bloccano la stampa di RW e F24, con una spiegazione", async () => {
  const app = applicazione({ prezzi: false });
  await app.carica();
  await app.calcola();
  app.clic("data-tab", "4");
  assert.match(app.html(), /Mancano prezzi per il 2025/);
  assert.doesNotMatch(app.html(), /id="stampa(?:RW|RT|F24)"/);
  app.clic("data-tab", "8");
  assert.match(app.html(), /Mancano prezzi per il 2025/);
  assert.doesNotMatch(app.html(), /id="stampaCompleta"/);
  for (const id of ["stampaRW", "stampaF24", "stampaCompleta"]) app.pulsante(id);
  assert.equal(app.stampe.length, 0);
});

test("un risultato in corso viene scartato se nel frattempo cambia la fonte", async () => {
  let rispondi, iniziata = false;
  const attesa = new Promise(resolve => { rispondi = resolve; });
  const app = applicazione({ primaDeiPrezzi() { iniziata = true; return attesa; } });
  await app.carica();
  app.avviaCalcolo();
  await attendi(() => iniziata);
  app.clic("data-toglipiatt", "0");
  rispondi();
  await attendi(() => app.elementi.calcoloInCorso?.innerHTML.includes("I dati sono cambiati durante il calcolo"));
  app.clic("data-tab", "4");
  assert.doesNotMatch(app.html(), /id="stampa(?:RW|RT|F24)"/);
});
