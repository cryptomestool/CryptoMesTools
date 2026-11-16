/* Prove della lettura diretta dei CSV delle piattaforme con dati inventati: node test/piattaforme.test.js */
"use strict";
const assert = require("assert");
const P = require("../piattaforme.js");
const D = require("../detenzione.js");
let n = 0; const t = (nome, fn) => { fn(); n++; console.log("ok -", nome); };
const qn = (v) => D.decNum(v);
const voce = (m, lato) => m.voci.filter((v) => v.lato === lato)[0];

const BIN = "﻿User ID,Time,Account,Operation,Coin,Change,Remark\n" +
  "1,2021-03-01 12:00:00,Spot,Deposit,BTC,0.5,\n" +
  // stesso secondo, righe in ordine sparso: un solo scambio BTC→ETH con commissione in BNB
  "1,2021-03-02 10:00:00,Spot,Buy,ETH,1,\n1,2021-03-02 10:00:00,Spot,Fee,BNB,-0.01,\n1,2021-03-02 10:00:00,Spot,Sell,BTC,-0.02,\n1,2021-03-02 10:00:00,Spot,Buy,ETH,2,\n1,2021-03-02 10:00:00,Spot,Sell,BTC,-0.04,\n1,2021-03-02 10:00:00,Spot,Fee,ETH,-0.003,\n" +
  // Binance Convert con le due gambe a un secondo di distanza
  "1,2021-03-03 09:00:00,Spot,Binance Convert,USDT,100,\n1,2021-03-03 09:00:01,Spot,Binance Convert,ETH,-0.05,\n" +
  "1,2021-03-04 09:00:00,Spot,Buy,BTC,0.01,\n1,2021-03-04 09:00:00,Spot,Sell,EUR,-500,\n" +
  "1,2021-03-05 09:00:00,Spot,Simple Earn Flexible Interest,USDT,0.5,\n1,2021-03-05 09:10:00,Spot,Simple Earn Flexible Subscription,USDT,-50,\n" +
  "1,2021-03-06 09:00:00,Spot,Small Assets Exchange BNB,SOL,-0.004,SOL to BNB\n1,2021-03-06 09:00:00,Spot,Small Assets Exchange BNB,BNB,0.001,SOL to BNB\n" +
  "1,2021-03-07 09:00:00,Spot,Withdraw,BTC,-0.1005,Withdraw fee is included\n" +
  "1,2021-03-08 09:00:00,Spot,Tax Payment,BTC,-0.0001,\n" +
  "1,2021-03-09 09:00:00,Spot,Strana Operazione,BTC,0.0002,\n";
const DEP = "Time,Coin,Network,Amount,Address,TXID,Status\n2021-03-01 11:59:00,BTC,BTC,0.5,bc1qprova,hashdeposito,Completed\n";
const PRE = "Time,Coin,Network,Amount,Fee,Address,TXID,Status\n2021-03-07 09:00:30,BTC,BTC,0.1,0.0005,bc1qdest,hashprelievo,Completed\n";

t("riconoscimento dei formati", () => {
  assert.equal(P.riconosci(BIN), "binance");
  assert.equal(P.riconosci(DEP), "binance-depositi");
  assert.equal(P.riconosci(PRE), "binance-prelievi");
  assert.equal(P.riconosci("ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Notes\n"), "coinbase");
  assert.equal(P.riconosci("Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo\n"), "revolut-conto");
  assert.equal(P.scartoDaNome("Binance-Transaction-History-2026(UTC+2)-part1.csv"), 2);
});

t("Binance: scambi, commissioni, convert, proventi, prelievi con hash", () => {
  const r = P.leggiFile([{ nome: "Binance-Transaction-History-x(UTC+2)-part1-of1.csv", testo: BIN }, { nome: "dep(UTC+2).csv", testo: DEP }, { nome: "wd(UTC+2).csv", testo: PRE }]);
  const m = r.movimenti;
  const dep = m.filter((x) => x.tipo === "deposit" && !x.tag && x.voci[0].simbolo === "BTC" && qn(x.voci[0].q) === 0.5)[0];
  assert.equal(dep.txHash, "hashdeposito"); assert.equal(dep.txSrc, "bc1qprova");
  assert.equal(new Date(dep.ts).toISOString().slice(11, 19), "10:00:00"); // UTC+2 → UTC
  const sc = m.filter((x) => x.tipo === "trade" && voce(x, "a") && voce(x, "a").simbolo === "ETH" && voce(x, "da").simbolo === "BTC");
  assert.equal(sc.length, 1);
  assert.equal(qn(voce(sc[0], "a").q), 3); assert.equal(qn(voce(sc[0], "da").q), -0.06);
  assert.equal(voce(sc[0], "fee").simbolo, "ETH"); assert.equal(qn(voce(sc[0], "fee").q), -0.003);
  const bnb = m.filter((x) => x.tag === "cost" && x.voci[0].simbolo === "BNB")[0];
  assert.ok(bnb, "commissione in BNB come uscita di costo"); assert.equal(qn(bnb.voci[0].q), -0.01);
  const cv = m.filter((x) => x.tipo === "trade" && voce(x, "a") && voce(x, "a").simbolo === "USDT")[0];
  assert.ok(cv, "convert abbinato"); assert.equal(voce(cv, "da").simbolo, "ETH");
  const eur = m.filter((x) => x.tipo === "trade" && voce(x, "da").simbolo === "EUR")[0];
  assert.equal(eur.valore, 500); assert.equal(eur.fonteValore, "file (EUR)");
  assert.equal(m.filter((x) => x.tag === "lending_interest").length, 1);
  assert.ok(!m.some((x) => x.voci.some((v) => qn(v.q) === -50)), "Earn Subscription è interno");
  const small = m.filter((x) => x.tipo === "trade" && voce(x, "da").simbolo === "SOL")[0];
  assert.equal(voce(small, "a").simbolo, "BNB");
  const w = m.filter((x) => x.tipo === "withdrawal" && !x.tag)[0];
  assert.equal(qn(voce(w, "da").q), -0.1); assert.equal(qn(voce(w, "fee").q), -0.0005); assert.equal(w.txHash, "hashprelievo"); assert.equal(w.txDest, "bc1qdest");
  assert.equal(m.filter((x) => x.tag === "tax").length, 1);
  assert.equal(r.file[0].avvisi.length, 1, "operazione sconosciuta segnalata");
  // saldo finale di BTC: 0.5 - 0.06 + 0.01 - 0.1005 - 0.0001 + 0.0002
  let s = 0n; m.forEach((x) => x.voci.forEach((v) => { if (v.simbolo === "BTC") s += v.q; }));
  assert.equal(D.decStr(s), "0.3496");
});

t("Coinbase: acquisti dalle note, invii, trasferimenti verso Coinbase Pro segnalati", () => {
  const CB = "\nTransactions\nUser,Prova,abc\nID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes,Sender Address,Recipient Address\n" +
    "a1,2024-01-02 10:00:00 UTC,Advanced Trade Buy,USDC,104.86,USD,$0.99,$104.24,$104.24,$0.00,Bought 104.86 USDC for 100.05 EUR on USDC-EUR at 0.95 EUR/USDC,,\n" +
    "a2,2024-01-03 10:00:00 UTC,Advanced Trade Sell,ETH,-0.5,USD,$2000,-$1000,-$995,$5,Sold 0.5 ETH for 995 USDC on ETH-USDC at 2000 USDC/ETH,,\n" +
    "a3,2024-01-04 10:00:00 UTC,Send,BTC,-0.1,USD,$40000,-$4000,-$4000,$0.00,Sent 0.1 BTC,,bc1qdest\n" +
    "a4,2024-01-05 10:00:00 UTC,Pro Deposit,EUR,-300,USD,$1.1,-$330,-$330,$0.00,,,\n";
  const r = P.leggiCoinbase(CB);
  assert.equal(r.movimenti.length, 3);
  const b = r.movimenti[0]; assert.equal(voce(b, "da").simbolo, "EUR"); assert.equal(b.valore, 100.05);
  const s = r.movimenti[1]; assert.equal(voce(s, "a").simbolo, "USDC"); assert.equal(qn(voce(s, "a").q), 995); assert.equal(s.controvalore.valuta, "USD");
  assert.equal(r.movimenti[2].txDest, "bc1qdest");
  assert.ok(/Coinbase Pro/.test(r.avvisi[0]));
});

t("Nexo: interessi, scambi, prelievi; EURX e USDX tornano EUR e USD", () => {
  const NX = "Transaction,Type,Credit Line,Input Currency,Input Amount,Output Currency,Output Amount,USD Equivalent,Fee,Fee Currency,Details,Date / Time (UTC)\n" +
    'N1,Deposit To Exchange,,EUR,500,EURX,500,$550,-,-,"approved / EUR Top Up",2025-01-01 10:00:00\n' +
    'N2,Exchange Deposited On,,EUR,-500,EURX,500,$550,-,-,"approved / EUR to EURX",2025-01-01 10:00:01\n' +
    'N3,Exchange,,EURX,-100,BTC,0.001,$110,-,-,"approved / Exchange EURX to Bitcoin",2025-01-02 10:00:00\n' +
    'N4,Interest,,BTC,0.00000052,BTC,0.00000052,$0.04,-,-,"approved / BTC Interest Earned",2025-01-03 05:00:00\n' +
    'N5,Withdrawal,,BTC,-0.0005,BTC,0.00049,$50,0.00001,BTC,"approved / BTC withdrawal",2025-01-04 05:00:00\n' +
    'N6,Locking Term Deposit,,BTC,-0.0004,BTC,0.0004,$40,-,-,"approved / Transfer",2025-01-05 05:00:00\n';
  const r = P.leggiNexo(NX);
  let saldo = {}; r.movimenti.forEach((m) => m.voci.forEach((v) => { saldo[v.simbolo] = (saldo[v.simbolo] || 0n) + v.q; }));
  assert.equal(D.decStr(saldo.EUR), "400"); assert.equal(D.decStr(saldo.BTC), "0.00050052");
  assert.equal(r.movimenti.filter((m) => m.tag === "lending_interest").length, 1);
  assert.equal(r.interni, 1);
});

t("Young Platform: ordini, ordini annullati, RFQ, risparmio interno, file doppio", () => {
  const YP = "id,credit,debit,currency,date,tx_type\n" +
    "1,100,0,EUR,2025-07-10T14:04:56.807Z,DEPOSIT\n" +
    "2,0,20,EUR,2025-07-10T14:05:45.47Z,ORDER_PLACEMENT\n3,0.0002,0,BTC,2025-07-10T14:05:45.497Z,ORDER_MATCHED\n" +
    "4,0,10,EUR,2025-07-11T10:00:00Z,ORDER_PLACEMENT\n5,10,0,EUR,2025-07-11T10:05:00Z,ORDER_CANCELLED\n" +
    "6,0.0002,0,BTC,2025-07-12T10:00:00Z,SAVINGS\n7,0,0.0002,BTC,2025-07-12T10:00:00Z,SAVINGS\n" +
    "8,0,15,EUR,2025-07-13T10:00:00.1Z,RFQ\n9,0.004,0,ETH,2025-07-13T10:00:00.1Z,RFQ\n";
  const r = P.leggiFile([{ nome: "a.csv", testo: YP }, { nome: "b.csv", testo: YP }]);
  assert.ok(/Stesso contenuto/.test(r.file[0].errore));
  const m = r.movimenti;
  assert.equal(m.filter((x) => x.tipo === "trade").length, 2);
  let saldo = {}; m.forEach((x) => x.voci.forEach((v) => { saldo[v.simbolo] = (saldo[v.simbolo] || 0n) + v.q; }));
  assert.equal(D.decStr(saldo.EUR), "65"); assert.equal(D.decStr(saldo.BTC), "0.0002"); assert.equal(D.decStr(saldo.ETH), "0.004");
});

t("Revolut: estratto del conto in euro riconosciuto e spiegato", () => {
  const r = P.leggiFile([{ nome: "rev.csv", testo: "Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo\nCambia valuta,Attuale,2025-02-25 06:47:29,2025-02-25 06:47:29,Transfer to Revolut Digital Assets Europe Ltd,-500.00,0.00,EUR,COMPLETATO,93.01\n" }]);
  assert.ok(/sezione Cripto/.test(r.file[0].errore));
});

t("Ledger Live: entrate, uscite con commissione, controvalore in euro", () => {
  const LL = "Operation Date,Currency Ticker,Operation Type,Operation Amount,Operation Fees,Operation Hash,Account Name,Account xpub,Countervalue Ticker,Countervalue at Operation Date,Countervalue at CSV Export\n" +
    "2023-05-01T10:00:00.000Z,BTC,IN,0.1,,h1,Bitcoin 1,xpub,EUR,2500,3000\n" +
    "2023-06-01T10:00:00.000Z,BTC,OUT,0.05,0.0001,h2,Bitcoin 1,xpub,EUR,1300,1500\n";
  const r = P.leggiLedger(LL);
  assert.equal(r.movimenti.length, 2);
  assert.equal(r.movimenti[0].valore, 2500); assert.equal(r.movimenti[0].walletA, "Ledger · Bitcoin 1");
  const o = r.movimenti[1]; assert.equal(D.decStr(-voce(o, "da").q - voce(o, "fee").q), "0.05");
});

t("Coinbase Pro: scambi con commissione, trasferimenti interni abbinati, salti di saldo segnalati", () => {
  const CB = "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes,Sender Address,Recipient Address\n" +
    "c1,2020-04-18 16:30:00 UTC,Deposit,EUR,1000,USD,$1.1,$1100,$1100,$0,Deposit from banca,,\n" +
    "c2,2020-04-18 16:33:10 UTC,Pro Deposit,EUR,-1000,USD,$1.1,-$1100,-$1100,$0,,,\n";
  const PRO = "portfolio,type,time,amount,balance,amount/balance unit,transfer id,trade id,order id\n" +
    "default,deposit,2020-04-18T16:33:14.088Z,1000,1000,EUR,t1,,\n" +
    "default,match,2020-04-18T16:50:02.165Z,0.05,0.05,BTC,,100,o1\n" +
    "default,match,2020-04-18T16:50:02.165Z,-400,600,EUR,,100,o1\n" +
    "default,fee,2020-04-18T16:50:02.165Z,-2,598,EUR,,100,o1\n" +
    // riga mancante: il saldo BTC passa da 0.05 a 0.15 con un'entrata di 0.05
    "default,match,2020-05-02T10:00:00.000Z,0.05,0.15,BTC,,101,o2\n" +
    "default,match,2020-05-02T10:00:00.000Z,-400,198,EUR,,101,o2\n";
  const r = P.leggiFile([{ nome: "cb.csv", testo: CB }, { nome: "pro.csv", testo: PRO }]);
  const m = r.movimenti;
  assert.equal(m.filter((x) => x.tipo === "deposit").length, 1, "deposito Pro abbinato al Pro Deposit di Coinbase: interno");
  const sc = m.filter((x) => x.tipo === "trade");
  assert.equal(sc.length, 2); assert.equal(qn(voce(sc[0], "fee").q), -2); assert.equal(sc[0].valore, 400);
  const pro = r.file.filter((e) => e.piattaforma === "Coinbase Pro")[0];
  assert.ok(pro.avvisi.some((a) => /salta in 1 punti/.test(a) && /2020-05 BTC \+0.05/.test(a)), pro.avvisi.join(" / "));
});

t("Binance: storico senza fuso nel nome unito a uno con «(UTC+2)», valori in euro dal report fiscale", () => {
  const H = "User ID,Time,Account,Operation,Coin,Change,Remark\n1,2025-01-01 15:20:03,Spot,Binance Convert,USDC,-1000,\n1,2025-01-01 15:20:03,Spot,Binance Convert,ETH,0.29831362,\n1,2025-01-03 10:00:00,Spot,Deposit,BTC,0.1,\n";
  const H2 = "User ID,Time,Account,Operation,Coin,Change,Remark\n1,2025-01-03 10:00:00,Spot,Deposit,BTC,0.1,\n1,2025-01-01 15:20:03,Spot,Binance Convert,ETH,0.29831362,\n1,2025-01-01 15:20:03,Spot,Binance Convert,USDC,-1000,\n";
  const FIS = "id,datetime_tz_CET,type,label,market_model_type,order_type,sent_amount,sent_currency,sent_value_EUR,sent_address,received_amount,received_currency,received_value_EUR,received_address,fee_amount,fee_currency,fee_value_EUR\n" +
    "x1,2025-01-01-14:20:03,Trade,,CONVERT,,1000,USDC,962.93,,0.29831362,ETH,958.63,,0,,0\n";
  const r = P.leggiFile([{ nome: "Binance-Transaction-History-1(UTC+2)-part1.csv", testo: H }, { nome: "binance-rinominato.csv", testo: H2 }, { nome: "fiscale.csv", testo: FIS }]);
  const m = r.movimenti;
  assert.equal(m.length, 2, "le righe del secondo file non si raddoppiano");
  const b = r.file.filter((e) => e.piattaforma === "Binance")[0];
  assert.ok(b.avvisi.some((a) => /ricavato UTC\+2/.test(a)), b.avvisi.join(" / "));
  const cv = m.filter((x) => x.tipo === "trade")[0];
  assert.equal(cv.valore, 958.63); assert.equal(cv.fonteValore, "report fiscale Binance");
  assert.equal(new Date(P.romaUTC("2025-07-01-14:20:03")).toISOString().slice(11, 16), "12:20", "ora legale");
  assert.equal(new Date(P.romaUTC("2025-01-01-14:20:03")).toISOString().slice(11, 16), "13:20", "ora solare");
});

t("Revolut: acquisti dall'app e da Revolut X, vendite, invii con commissione trattenuta in cripto", () => {
  const RV = "\uFEFFSymbol;Type;Quantity;Price;Value;Fees;Date\n" +
    "BTC;Acquisto;0,01;50.000,00 €;500,00 €;7,50 €;25 feb 2025, 06:47:29\n" +
    "BTC;Invio;0,004;50.000,00 €;200,00 €;5,00 €;26 feb 2025, 07:08:30\n" +
    "EUR;Ricezione;;;100,00 €;0,00 €;17 apr 2025, 14:39:21\n" +
    "BTC;Acquista - Revolut X;0,001;60.000,00 €;60,00 €;0,05 €;17 apr 2025, 14:39:22\n" +
    "BTC;Vendi - Revolut X;0,002;70.000,00 €;140,00 €;0,10 €;4 ott 2025, 23:47:21\n";
  assert.equal(P.riconosci(RV), "revolut");
  const r = P.leggiRevolut(RV);
  let saldo = {}; r.movimenti.forEach((m) => m.voci.forEach((v) => { saldo[v.simbolo] = (saldo[v.simbolo] || 0n) + v.q; }));
  // BTC: 0.01 − 0.004 − 5/50000 (commissione) + 0.001 − 0.002
  assert.equal(D.decStr(saldo.BTC), "0.0049");
  // EUR: +500 −500 (acquisto dall'app) +100 −60 (Revolut X) +139.90 (vendita netta)
  assert.equal(D.decStr(saldo.EUR), "179.9");
  assert.equal(new Date(r.movimenti[0].ts).toISOString().slice(11, 19), "05:47:29", "ora italiana → UTC");
});

t("Relai: bonifico, acquisto con commissione, invio dei BTC all'indirizzo del cliente", () => {
  const RL = "Date,Transaction Type,BTC Amount,BTC Price,Currency Pair,Fiat Amount (excl. fees),Fiat Currency,Fee,Fee Currency,Destination,Operation ID,Counterparty\n" +
    "2023-12-28T16:35:48Z,Buy,0.01780297,38729.49,BTC/EUR,689.50,EUR,10.50,EUR,bc1qprova,op1,Relai Switzerland\n";
  const r = P.leggiFile([{ nome: "relai.csv", testo: RL }]);
  assert.equal(r.movimenti.length, 3);
  const w = r.movimenti.filter((m) => m.tipo === "withdrawal")[0];
  assert.equal(w.txDest, "bc1qprova"); assert.equal(qn(voce(w, "da").q), -0.01780297);
  const tr = r.movimenti.filter((m) => m.tipo === "trade")[0];
  assert.equal(tr.valore, 689.5); assert.equal(qn(voce(tr, "fee").q), -10.5);
});

t("BitBoxApp ed Etherscan: satoshi, commissioni, indirizzo del cliente ricavato dal file", () => {
  const BB = "Time,Type,Amount,Unit,Fee,Fee Unit,Address,Transaction ID,Historical value,Historical value currency,Note\n" +
    "2026-08-19T10:52:13+02:00,received,1164617,satoshi,,,bc1qa,h1,749.07,USD,\n2026-08-20T10:00:00+02:00,sent,14900,satoshi,142,satoshi,3Pdest,h2,12.48,USD,prova\n";
  const b = P.leggiFile([{ nome: "Transazioni_BitBox02_N1_export.csv", testo: BB }]);
  assert.equal(b.file[0].piattaforma, "BitBox02 n.1");
  let s = 0n; b.movimenti.forEach((m) => m.voci.forEach((v) => { s += v.q; }));
  assert.equal(D.decStr(s), "0.01149575");
  const ES = '"Transaction Hash","Blockno","UnixTimestamp","DateTime (UTC)","From","To","ContractAddress","Value_IN(ETH)","Value_OUT(ETH)","CurrentValue","TxnFee(ETH)","TxnFee(USD)","Historical $Price/Eth","Status","ErrCode","Method"\n' +
    '"0x1","1","1","2026-10-03 18:17:11","0xaaa","0xmio","","0.5","0","1","0.00001","0.03","2686","","","Transfer"\n' +
    '"0x2","2","2","2026-10-04 18:17:11","0xmio","0xbbb","","0","0.2","1","0.0001","0.3","2686","","","Transfer"\n' +
    '"0x3","3","3","2026-10-05 18:17:11","0xmio","0xccc","","0","0.1","1","0.0002","0.6","2686","Error(0)","out of gas","Transfer"\n';
  const e = P.leggiEtherscan(ES, "x.csv");
  assert.equal(e.indirizzo, "0xmio");
  let se = 0n; e.movimenti.forEach((m) => m.voci.forEach((v) => { se += v.q; }));
  assert.equal(D.decStr(se), "0.2997", "la transazione non riuscita costa solo la commissione");
});

t("trasferimenti: abbinamento per hash e per quantità e data", () => {
  const BIN = "User ID,UTC_Time,Account,Operation,Coin,Change,Remark\n1,2024-01-01 10:00:00,Spot,Withdraw,BTC,-0.1005,\n1,2024-02-01 10:00:00,Spot,Withdraw,ETH,-1,\n";
  const PRE = "Date(UTC),Coin,Network,Amount,Fee,Address,TXID,Status\n2024-01-01 10:00:10,BTC,BTC,0.1,0.0005,bc1qmio,AbCdEf0123456789abcdef0123456789abcdef0123456789abcdef0123456789,Completed\n";
  const r = P.leggiFile([{ nome: "b.csv", testo: BIN }, { nome: "w.csv", testo: PRE }]);
  const onchain = [
    { riga: 0, ts: Date.UTC(2024, 0, 1, 10, 20), tipo: "deposit", tag: "", valore: 0, voci: [{ valuta: "BTC", simbolo: "BTC", q: D.dec("0.1"), lato: "a" }], walletA: "Ledger", walletDa: "", txHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", piattaforma: "Ledger", descrizione: "" },
    { riga: 0, ts: Date.UTC(2024, 1, 1, 12, 0), tipo: "deposit", tag: "", valore: 0, voci: [{ valuta: "ETH", simbolo: "ETH", q: D.dec("0.998"), lato: "a" }], walletA: "SafePal", walletDa: "", txHash: "", piattaforma: "SafePal", descrizione: "" }
  ];
  const ab = P.abbinaTrasferimenti(r.movimenti.concat(onchain));
  assert.equal(ab.perHash, 1); assert.equal(ab.perImporto, 1);
  assert.equal(ab.movimenti.length, 2);
  ab.movimenti.forEach((m) => assert.equal(m.tipo, "transfer"));
  const eth = ab.movimenti.filter((m) => m.voci[0].simbolo === "ETH")[0];
  assert.equal(eth.walletA, "SafePal"); assert.equal(D.decStr(voce(eth, "fee").q), "-0.002");
});

t("scambi nell'app SafePal: uscita BTC e entrata USDC su blockchain diverse diventano una permuta", () => {
  const SC = "Portafoglio,N.,Data e ora,Anno,Ceduto (quantità),Ceduto (moneta),Ricevuto (quantità),Ricevuto (moneta),Tipo,Esito / note\n" +
    "SafePal 2 - prova,1,15/03/2024 10:00,2024,0.1,BTC,6500,USDC,Cripto → stablecoin,Riuscito\n" +
    "SafePal 2 - prova,2,16/03/2024 10:00,2024,1,ETH,3000,USDC,Cripto → stablecoin,Non riuscito\n";
  assert.equal(P.riconosci(SC), "scambi-app");
  const sc = P.leggiScambiApp(SC);
  assert.equal(sc.length, 1); assert.equal(new Date(sc[0].ts).toISOString().slice(11, 16), "09:00");
  const v = (sim, q, lato) => ({ valuta: sim, simbolo: sim, q: D.dec(q), lato });
  const mov = [
    { ts: Date.UTC(2024, 2, 15, 9, 5), tipo: "withdrawal", tag: "", voci: [v("BTC", "-0.1", "da"), v("BTC", "-0.0001", "fee")], walletDa: "SafePal 2 NativeSegWit", walletA: "", txHash: "b1", descrizione: "" },
    { ts: Date.UTC(2024, 2, 15, 9, 40), tipo: "deposit", tag: "", voci: [v("USDC", "6490", "a")], walletDa: "", walletA: "SafePal 2 ETH", txHash: "e1", descrizione: "" },
    { ts: Date.UTC(2024, 2, 15, 9, 40), tipo: "deposit", tag: "", voci: [v("USDC", "6490", "a")], walletDa: "", walletA: "Tangem ETH", txHash: "e2", descrizione: "" }
  ];
  const r = P.applicaScambi(mov, sc);
  assert.equal(r.abbinati, 1); assert.equal(r.movimenti.length, 2);
  const t0 = r.movimenti.filter((m) => m.tipo === "trade")[0];
  assert.equal(t0.walletA, "SafePal 2 ETH"); assert.equal(voce(t0, "a").simbolo, "USDC"); assert.equal(D.decStr(voce(t0, "fee").q), "-0.0001");
});

t("Crypto.com: scambi, interni, ordini limite, residui, doppioni tra esportazioni, carta già presente", () => {
  const H = "Timestamp (UTC),Transaction Description,Currency,Amount,To Currency,To Amount,Native Currency,Native Amount,Native Amount (in USD),Transaction Kind,Transaction Hash\n";
  const a = H + "2020-10-02 10:51:52,CRO -> ADA,CRO,-1000.0,ADA,1601.0,USD,144.76,144.76,crypto_exchange,\n" +
    "2020-10-02 10:19:31,Buy CRO,CRO,1000.0,,,USD,147.14,147.14,crypto_purchase,\n";
  const b = H + "2020-10-02 10:51:52,CRO > ADA,CRO,-1000.0,ADA,1601.0,USD,144.76,144.76,crypto_exchange,\n" +
    "2025-03-02 16:53:51,Sell ADA,ADA,-1601.0,EUR,1800,USD,1900,1900,trading.limit_order.cash_account.sell_lock,\n" +
    "2025-03-02 22:54:57,Sell ADA,ADA,1601.0,EUR,1800,USD,1900,1900,trading.limit_order.cash_account.sell_unlock,\n" +
    "2025-03-03 00:01:02,Sold ADA,ADA,-1601.0,EUR,1700,USD,1800,1800,trading.limit_order.cash_account.sell_commit,\n" +
    "2025-04-01 10:00:00,Crypto Earn Allocation,EUR,0,,,USD,0,0,crypto_earn_program_created,\n" +
    "2025-04-18 11:45:00,Convert Dust,CRO,0.04,,,USD,0.01,0.01,dust_conversion_credited,\n2025-04-18 11:45:00,Convert Dust,ADA,-0.001,,,USD,0.01,0.01,dust_conversion_debited,\n2025-04-18 11:44:59,Convert Dust,DOGE,-0.007,,,USD,0.01,0.01,dust_conversion_debited,\n" +
    "2025-05-01 10:00:00,Card Cashback,CRO,2.0,,,USD,0.2,0.2,referral_card_cashback,\n";
  const card = H + "2025-03-03 00:01:30,ADA -> EUR,EUR,1700,ADA,1601.0,EUR,1700,1800,,\n2025-03-04 10:00:00,Netflix.Com,EUR,-6.99,,,EUR,-6.99,-7.5,,\n";
  const r = P.leggiFile([{ nome: "crypto_transactions_record_a.csv", testo: a }, { nome: "crypto_transactions_record_b.csv", testo: b }, { nome: "card_transactions_record_c.csv", testo: card }]).file.filter((e) => e.piattaforma === "Crypto.com")[0];
  const m = r.movimenti;
  assert.equal(m.filter((x) => x.tipo === "trade" && voce(x, "a").simbolo === "ADA").length, 1); // CRO -> ADA una volta sola
  const vendite = m.filter((x) => x.tipo === "trade" && voce(x, "da").simbolo === "ADA" && voce(x, "a").simbolo === "EUR");
  assert.equal(vendite.length, 1); assert.equal(vendite[0].valore, 1700); // solo l'ordine eseguito, la carta non lo raddoppia
  assert.equal(m.filter((x) => /residui/.test(x.descrizione)).length, 2);
  assert.equal(m.filter((x) => x.tag === "cashback").length, 1);
  assert.ok(r.avvisi.some((x) => /presenti in più esportazioni/.test(x)));
});
console.log(n + " prove superate");
