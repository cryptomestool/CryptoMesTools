/* Prove della lettura on-chain: vettori ufficiali BIP44/49/84/86 (frase «abandon … about») e transazioni inventate: node test/onchain.test.js */
"use strict";
const assert = require("assert");
const O = require("../onchain.js");
const D = require("../detenzione.js");
let n = 0; const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };

t("hash: SHA-256, SHA-512, RIPEMD-160 di «abc»", () => {
  assert.equal(O.hex(O.sha256(O.utf8("abc"))), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(O.hex(O.sha512(O.utf8("abc"))).slice(0, 32), "ddaf35a193617abacc417349ae204131");
  assert.equal(O.hex(O.ripemd160(O.utf8("abc"))), "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc");
});

t("BIP44 (xpub, legacy): primo indirizzo di ricezione", () => {
  const x = "xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj";
  assert.equal(O.deriva(x, O.tipoIndirizzo("xpub", "Legacy (BIP44)"), 0, 0), "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA");
});
t("BIP49 (ypub, segwit annidato): primo indirizzo di ricezione", () => {
  const y = "ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP";
  assert.equal(O.deriva(y, O.tipoIndirizzo("ypub"), 0, 0), "37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf");
});
t("BIP84 (zpub, native segwit): ricezione e resto", () => {
  const z = "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";
  assert.equal(O.deriva(z, "p2wpkh", 0, 0), "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
  assert.equal(O.deriva(z, "p2wpkh", 0, 1), "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g");
  assert.equal(O.deriva(z, "p2wpkh", 1, 0), "bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el");
});
t("BIP86 (xpub, Taproot): primo indirizzo di ricezione", () => {
  const x = "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ";
  assert.equal(O.deriva(x, O.tipoIndirizzo("xpub", "Taproot (BIP86)"), 0, 0), "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr");
});

t("elenco chiavi del cliente", () => {
  const L = O.leggiElencoChiavi("﻿Portafoglio;Tipo;Chiave pubblica estesa (sola lettura)\nProva;Native SegWit (BIP84);zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs\n");
  assert.equal(L.length, 1); assert.equal(L[0].wallet, "Prova");
  const u = O.chiaviUniche(L.concat([{ wallet: "Doppia", tipo: "Native SegWit", chiave: L[0].chiave }]));
  assert.equal(u.chiavi.length, 1); assert.equal(u.scartate[0].ugualeA, "Prova");
});

t("transazioni → movimenti: ricezione, invio con resto e commissione, invio a sé stesso", () => {
  const miei = { A1: "0/0", A2: "1/0", A3: "0/1" };
  const tx = [
    { txid: "t1", fee: 200, status: { confirmed: true, block_time: 1700000000, block_height: 1 }, vin: [{ prevout: { scriptpubkey_address: "EST", value: 100200 } }], vout: [{ scriptpubkey_address: "A1", value: 100000 }] },
    { txid: "t2", fee: 300, status: { confirmed: true, block_time: 1700100000, block_height: 2 }, vin: [{ prevout: { scriptpubkey_address: "A1", value: 100000 } }], vout: [{ scriptpubkey_address: "DEST", value: 60000 }, { scriptpubkey_address: "A2", value: 39700 }] },
    { txid: "t3", fee: 150, status: { confirmed: true, block_time: 1700200000, block_height: 3 }, vin: [{ prevout: { scriptpubkey_address: "A2", value: 39700 } }], vout: [{ scriptpubkey_address: "A3", value: 39550 }] },
    { txid: "t4", fee: 100, status: { confirmed: false }, vin: [], vout: [{ scriptpubkey_address: "A3", value: 5 }] }
  ];
  const m = O.movimenti(tx, miei, "Wallet prova");
  assert.equal(m.length, 3);
  assert.equal(m[0].tipo, "deposit"); assert.equal(D.decStr(m[0].voci[0].q), "0.001"); assert.equal(m[0].txSrc, "EST");
  assert.equal(m[1].tipo, "withdrawal"); assert.equal(D.decStr(m[1].voci[0].q), "-0.0006"); assert.equal(D.decStr(m[1].voci[1].q), "-0.000003"); assert.equal(m[1].txDest, "DEST"); assert.equal(m[1].txHash, "t2");
  assert.equal(m[2].tag, "cost"); assert.equal(D.decStr(m[2].voci[0].q), "-0.0000015");
  let s = 0n; m.forEach((x) => x.voci.forEach((v) => { s += v.q; }));
  assert.equal(D.decStr(s), "0.0003955");
});

t("Ethereum: ETH, token, scambio, transazione non riuscita, spam", () => {
  const mio = "0xabc";
  const dati = { indirizzo: mio, rete: O.RETI.ethereum,
    normali: [
      { hash: "h1", timeStamp: "1700000000", from: "0xest", to: mio, value: "1000000000000000000", gasUsed: "21000", gasPrice: "10", isError: "0" },
      { hash: "h2", timeStamp: "1700000100", from: mio, to: "0xuniswap", value: "500000000000000000", gasUsed: "100000", gasPrice: "1000000000", isError: "0", functionName: "swap" },
      { hash: "h3", timeStamp: "1700000200", from: mio, to: "0xdest", value: "100000000000000000", gasUsed: "21000", gasPrice: "1000000000", isError: "1" }
    ],
    token: [
      { hash: "h2", timeStamp: "1700000100", from: "0xuniswap", to: mio, value: "1000000000", tokenDecimal: "6", tokenSymbol: "USDC", tokenName: "USD Coin" },
      { hash: "h4", timeStamp: "1700000300", from: "0xspam", to: mio, value: "1000", tokenDecimal: "0", tokenSymbol: "VISIT AAPER.SITE", tokenName: "x" },
      { hash: "h5", timeStamp: "1700000400", from: "0xspam", to: mio, value: "5000000000", tokenDecimal: "6", tokenSymbol: "US\u13A0C", tokenName: "USD Coin" }
    ],
    interne: [] };
  const r = O.movimentiEvm(dati, "SafePal ETH");
  assert.equal(Object.keys(r.spam).length, 2);
  const m = r.movimenti;
  assert.equal(m.length, 3);
  assert.equal(m[0].tipo, "deposit"); assert.equal(D.decStr(m[0].voci[0].q), "1");
  assert.equal(m[1].tipo, "trade"); assert.equal(m[1].voci[1].simbolo, "USDC"); assert.equal(D.decStr(m[1].voci[1].q), "1000"); assert.equal(D.decStr(m[1].voci[2].q), "-0.0001");
  assert.equal(m[2].tag, "cost"); assert.ok(/non riuscita/.test(m[2].descrizione)); assert.equal(D.decStr(m[2].voci[0].q), "-0.000021");
});

t("riconoscimento di chiavi e indirizzi per la scelta della blockchain", () => {
  assert.equal(O.riconosciChiave("zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs"), "bitcoin-chiave");
  assert.equal(O.riconosciChiave("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"), "bitcoin-indirizzo");
  assert.equal(O.riconosciChiave("1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA"), "bitcoin-indirizzo");
  assert.equal(O.riconosciChiave("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), "evm");
  assert.equal(O.riconosciChiave("0x123"), "");
  assert.ok(O.RETI.optimism && O.RETI.avalanche && O.RETI.zksync && !O.RETI.gnosis);
});
let errEvm = null;
O.leggiEvm("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "ethereum", { attesa: 1, json: () => Promise.resolve({ status: "0", message: "NOTOK", result: "Max rate limit reached" }) })
  .then(() => { errEvm = "nessun errore"; }, (e) => { errEvm = e.message; })
  .then(() => {
    t("esploratore EVM: un errore del servizio non diventa «nessuna transazione»", () => { assert.equal(errEvm, "Ethereum: Max rate limit reached"); });
    return O.leggiEvm("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "base", { json: () => Promise.resolve({ status: "0", message: "No transactions found", result: [] }) });
  })
  .then((r) => {
    t("esploratore EVM: indirizzo senza transazioni", () => { assert.equal(r.normali.length + r.token.length + r.interne.length, 0); });
    console.log(n + " prove superate");
  })
  .catch((e) => console.log("ERRORE", e && e.stack || e));

