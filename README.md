# CryptoMesTools

Programma a codice aperto (open source), mantenuto con le donazioni in bitcoin su Lightning Network. Indirizzo per le donazioni e link al codice in `studio.js`.

> CryptoMesTools non è affiliato né approvato da Koinly. «Koinly» è un marchio dei rispettivi titolari, citato solo per indicare i report compatibili.

Web app statica per le cripto-attività a partire dai report Koinly. All'apertura si sceglie il percorso (dichiarazione nei termini, ravvedimento per gli anni passati, rispondere all'Agenzia delle Entrate, ravvedimento e risposta all'Agenzia, creare il fascicolo per i controlli): il programma mostra solo le schede e i file che servono e l'elenco dei documenti da produrre, con lo stato di ciascuno. Nella **dichiarazione nei termini** sanzioni e ravvedimento spariscono dalle schede e dal fascicolo: per ogni anno restano quadri, imposte da versare a saldo e F24 di saldo (codici 1727, 1715, 1100, senza 8945, 1945 e 8911); si inserisce da solo solo l'ultimo anno. Nel percorso «fascicolo» le risposte alle domande tipo, la dichiarazione sostitutiva, la provenienza dei fondi e la memoria si preparano in anticipo, prima di qualunque richiesta. Tutto gira nel browser: i file caricati non vengono salvati né inviati in rete (unica eccezione, facoltativa: lo scarico dei movimenti Kraken con la chiave API, descritto più sotto). È pensata per essere incorporata (iframe) nella pagina del sito dello studio; `_headers` consente l'incorporamento da studiomecommercialisti.it.

Schede: **Guida** · **Caricamento file** (con «Verifiche e riconciliazione»: operazioni da correggere, richiesta di chiarimenti al cliente, estratti conto) · **Quadri RW, RT, F24 e sanzioni** · **Fascicolo fiscale** · **Fascicolo risposta Agenzia delle Entrate** (questionario e pratica). Costi di carico e giorni di detenzione non hanno una scheda propria: lavorano sotto i quadri e si consultano nel «Dettaglio dei calcoli» in fondo alla scheda dei quadri. Le sezioni che seguono descrivono i criteri di calcolo.

## 1. Giorni di detenzione e IVACA

File richiesti (tutti obbligatori):

| File | Contenuto |
|---|---|
| Transazioni | CSV Koinly: `backup_transactions_koinly.csv` (date UTC, numeri 1234.56) oppure «transaction history» (anche con numeri in formato italiano) |
| Saldi a inizio anno | «Beginning of year holdings» CSV (o report di fine dell'anno precedente) |
| Saldi a fine anno | «End of year holdings» CSV o «Complete tax report» PDF |
| Altri report Koinly (facoltativi) | «Income report», «Expenses report», «Gifts, donations & lost assets», «Other gains report» in CSV. Dal 2023 i proventi dell'Income report entrano nel quadro RT delle cripto (escludibili per anno); l'Other gains si riporta a scelta nel quadro RT al 26% o nel quadro RM; gli altri sono riepiloghi informativi nella scheda dei quadri |

Criteri (regole dello studio):

- **Perimetro:** totale di tutti i wallet per cripto; escluse le valute tradizionali, incluse le stablecoin.
- **Saldi al 1/1:** presi dal report di inizio anno e confrontati con quelli ricostruiti dalle transazioni. Se il report è vuoto (solo «Totale 0») i saldi sono zero e la detenzione parte dal primo movimento del file delle transazioni, con il valore di quel giorno; se il report manca ma nel file non ci sono movimenti prima del 1/1, vale lo stesso.
- **Giorno detenuto:** conta se il saldo a inizio giornata è positivo o se nel giorno c'è un'entrata. Aritmetica esatta sui decimali.
- **Periodi:** ogni cambio di quantità apre un periodo. Un acquisto lo apre dal giorno stesso. Una vendita chiude il periodo nel giorno della vendita, con la quantità di prima e il valore a quella data; il residuo riparte dal giorno dopo.
- **Valori:** valore iniziale e finale sono quelli di inizio e fine detenzione di ogni periodo, non del 1/1 e del 31/12. Il valore iniziale di un periodo è il valore finale del precedente; il primo parte dal report di inizio anno. Prezzi dal controvalore in euro delle transazioni; dai report per i periodi che iniziano il 1/1 o finiscono il 31/12.
- **IVACA** (rigo RW col. 33) = valore finale × 0,20% × quota × giorni / 365, per periodo. Wallet privati: sempre dovuta. Piattaforme con la spunta «solo monitoraggio» (scheda Caricamento file): righi RW separati, ricostruiti dai soli movimenti di quelle piattaforme, con la col. 16 barrata e senza IVACA. Anno in corso: valore finale all'ultimo prezzo disponibile, segnalato come provvisorio.
- **Token sospetti** (spam, phishing, imitazioni di USDT/USDC con caratteri non latini, saldi mai positivi): esclusi dai totali, elencati e includibili.
- **Soglia delle valute (anni fino al 2022):** le cripto seguono il regime delle valute (art. 67 c. 1 lett. c-ter e c. 1-ter TUIR). La condizione è annuale: se in un qualunque momento dell'anno la giacenza complessiva di tutti i wallet e di tutte le cripto, valutata al prezzo del 1° gennaio dell'anno, supera 51.645,69 € per almeno 7 giorni lavorativi continui, tutte le cessioni dell'anno sono rilevanti, anche quelle fatte quando la giacenza era sotto la soglia; altrimenti nessuna. Per i giorni vale la quantità dei periodi di detenzione. Prezzi al 1/1 dal report di inizio anno; per le cripto che non vi compaiono, prezzo della prima transazione dell'anno o ultimo noto, segnalati come stimati. Giorni lavorativi: esclusi sabati, domeniche, festivi nazionali e Pasquetta. L'esito, il primo tratto sopra la soglia e, come informazione, la giacenza nell'istante di ogni cessione sono nella scheda dei giorni di detenzione e nel riepilogo degli anni.

Uscite: tabella a video con i periodi; Excel (fogli «Righi RW» e «Riepilogo per cripto», A4 orizzontale, imposta a formula); resoconto da stampare o salvare in PDF con tutti i periodi.

## 1-bis. Senza Koinly: piattaforme e blockchain

Nel riquadro «Senza Koinly» della scheda di caricamento le transazioni si ricostruiscono senza il file di Koinly, che sostituiscono:

- **CSV delle piattaforme** (`piattaforme.js`): Binance (Transaction History, con Deposit e Withdraw History per indirizzi e hash e il report fiscale per i valori in euro), Coinbase e Coinbase Pro, Nexo, Young Platform, Revolut (sezione Cripto e Revolut X), Kraken (Ledgers), Relai, Ledger Live, BitBoxApp, Etherscan. Più file della stessa piattaforma si uniscono e le righe ripetute contano una volta.
- **Kraken con la chiave API** (`kraken.js`): in alternativa al CSV «Ledgers», con una chiave di sola lettura del cliente (permesso «Query Ledger Entries»). La firma HMAC-SHA512 di ogni richiesta si calcola nel browser: la chiave privata non viene inviata né salvata. L'API privata di Kraken non accetta chiamate dalle pagine web (CORS), quindi le richieste già firmate passano da una funzione del sito (`netlify/functions/kraken.mjs`, indirizzo `/api/kraken`), che le inoltra ad api.kraken.com senza conservarle e accetta solo l'endpoint Ledgers e solo dalle pagine di CryptoMesTools. È l'unico caso in cui dati del cliente (la parte pubblica della chiave e i movimenti restituiti) transitano dal sito. I movimenti diventano un file «Kraken Ledgers (API)» con le colonne dell'esportazione, unito agli eventuali CSV «Ledgers» senza doppioni e salvabile per il fascicolo. CSV e API si possono usare insieme (per esempio CSV per gli anni passati e API fino a oggi, anche sovrapposti): una riga presente in entrambi conta una volta. La chiave è refid, asset, importo e commissione, non il txid (assente negli export più vecchi) né l'orario. Verifica su un ledger vero diviso in un CSV e in un download API sovrapposti: stesso risultato del file intero. Lettura del ledger: scambi e conversioni per refid; acquisti rapidi (spend/receive) per refid o, negli export recenti dove le due gambe hanno refid diversi, per orario (entro un minuto); residui (dust sweeping) con la cripto ricevuta divisa in parti uguali tra quelle cedute; staking, earn, dividendi e bonus come ricompense al netto della commissione trattenuta da Kraken; passaggi tra spot, staking ed earn come movimenti interni; passaggi con il conto Futures (esportazione separata) come entrate e uscite; depositi e prelievi annullati e stornati non contano; conversioni per delisting o migrazione del token (uscita di una cripto ed entrata di un'altra entro 48 ore) come permute; altri accrediti «transfer» come airdrop o fork da verificare; trading a margine escluso, con l'effetto sui saldi indicato. Se il file non parte dall'apertura del conto, i saldi già presenti prima della prima riga sono segnalati. Verifica su quattro ledger veri: i saldi ricostruiti coincidono con la colonna «balance» di Kraken per tutte le cripto.
- **Wallet Bitcoin dalla blockchain** (`onchain.js`): una riga per wallet, «nome; chiave pubblica estesa» (xpub, ypub, zpub; «Taproot» per BIP86) oppure «nome; indirizzi». Gli indirizzi si ricavano dalla chiave nel browser; a mempool.space arrivano solo gli indirizzi, uno al secondo circa, con attese crescenti se il servizio rallenta.
- **Trasferimenti tra wallet del cliente**: abbinati per hash della transazione o, senza hash, per cripto, quantità (fino all'1% in meno per la commissione di rete) e data entro 48 ore.
- **Prezzi in euro** (`prezzi.js`): dove il file non dà l'euro, prezzo di chiusura giornaliero (UTC) della coppia Binance in euro, o in USDT convertito al cambio BCE (api.frankfurter.dev); controvalori in dollari e stablecoin al cambio BCE del giorno. Ai servizi arrivano solo simboli e date. Terra Classic (LUNC, su Kraken «LUNA») usa la vecchia serie LUNA solo fino al crollo del 12/05/2022, mai i prezzi della nuova Terra. I valori sono stimati: si correggono nella scheda dei costi; le cripto senza prezzo sono elencate.
- **Saldi al 1/1 e al 31/12** ricostruiti dalle transazioni per ogni anno, dal primo movimento all'anno in corso, valutati con gli stessi prezzi; per l'anno in corso i saldi al 31/12 sono quelli di oggi all'ultimo prezzo disponibile, segnalati come provvisori (RW e IVACA da ricalcolare a fine anno). Se si caricano i report dei saldi Koinly, quelli della stessa data prevalgono.

## 2. Costi di carico (LIFO globale)

- **Partenza:** costi ricostruiti dall'origine, dalla prima transazione Koinly, non dai saldi di inizio anno.
- **Metodo:** una pila di strati per cripto, unica per tutti i wallet e tutti gli anni (LIFO globale).
- **Criteri:**
  - acquisto: costo pagato con le commissioni;
  - commissioni: oneri accessori in tutti gli anni, nel costo di ciò che si riceve o in riduzione del corrispettivo delle vendite contro valuta e contro stablecoin; quelle in cripto fino al 2022 sono cessioni al valore del momento, dal 2023 portano come onere il costo scaricato; le commissioni dei trasferimenti restano nel costo della cripto trasferita;
  - permuta: valore del momento;
  - interessi, reward e airdrop: valore del giorno;
  - trasferimenti tra wallet propri: nessun effetto, e quelli non abbinati da Koinly sono riconosciuti in automatico.
- **eToro e broker esteri:** lettura del rendiconto eToro in PDF (posizioni chiuse per categoria, trasferimenti al wallet cripto con il costo d'origine, dividendi, airdrop, portafoglio a inizio e fine anno per strumento, saldo); calcolo per anno dei quadri RT (sezione al 26%, minusvalenze riportate per quattro anni), RM (dividendi al lordo, per Stato) e RW (codici 1, 2, 9, 14/21 con IVAFE e IVACA) e dei codici F24; i valori RT e RM si riportano nella scheda dei quadri, dove si possono anche inserire a mano.
- **Altri broker esteri** (Trade Republic, Degiro, Interactive Brokers, Revolut e ogni altro intermediario): modello CSV generico da scaricare nel riquadro «Rendiconti», una riga per voce, importi in euro: cessioni (corrispettivo e costo), dividendi, proventi di OICR, interessi e altri redditi di capitale (lordo, ritenuta estera, Stato), posizioni e liquidità per il quadro RW (periodo nell'anno, valore iniziale e finale, Stato, codice RW facoltativo). I quadri RT al 26% (con le minusvalenze riportate per quattro anni), RM per tipo e Stato e RW con IVAFE e IVACA si calcolano con lo stesso motore di eToro (`estero.js`) e si riportano nella scheda dei quadri.
- **Operazioni da verificare e richiesta al cliente:**
  - ogni deposito o prelievo verso wallet non collegati riporta degli indizi: destinazione e hash assenti, probabile invio di prova, uscita di somme appena ricevute in prestito (anche se il prestito è in valuta e viene subito cambiato in stablecoin);
  - il pulsante «Richiesta di chiarimenti al cliente» stampa le operazioni filtrate non ancora corrette, con le domande e i documenti da chiedere.
- **Swap dal 2023** (regole dello studio, art. 67 c. 1 lett. c-sexies TUIR):
  - permute tra cripto, acquisti con stablecoin e scambi tra stablecoin non realizzano e trasferiscono il costo LIFO alla cripto ricevuta;
  - restano cessioni le vendite contro valuta e contro stablecoin;
  - prima del 2023 le permute sono al valore del momento;
  - la regola si può disattivare nella scheda per confronto.
- **Correzioni dello studio,** per riga del file e con il motivo:
  - deposito da wallet non collegato: costo documentato, rientro da wallet proprio o costo zero;
  - prelievo verso indirizzo non collegato: trasferimento a wallet proprio o cessione a terzi;
  - operazione senza controvalore: valore inserito a mano.
- **Salvataggio:** correzioni e attribuzioni si salvano e si ricaricano in un file JSON.
- **Uscite:** riscontro con i costi dei report Koinly; Excel (costi, strati, cessioni, correzioni) e PDF. Il quadro RT usa questi costi come fonte predefinita.
- **Conti correnti: estratti conto in PDF o movimenti in CSV ed Excel (.xlsx), anonimizzati alla lettura** (`banca.js`, riquadro in «Lavoro dello studio»):
  - si tengono solo data, importo, segno ed exchange dei movimenti con piattaforme di cripto-attività;
  - tutte le altre righe sono scartate e se ne conta solo il numero;
  - nomi, IBAN, indirizzi e causali non vengono mai conservati né mostrati;
  - i movimenti si riscontrano con versamenti, prelievi, acquisti e vendite in euro registrati in Koinly.
- **Confronto con Koinly, cessione per cessione:** si carica il «Complete tax report» in PDF, anche su più anni. Se ne legge l'elenco delle cessioni e si tengono quelle dell'anno. Ogni cessione si abbina alla ricostruita per cripto, data (±1 giorno, Koinly usa l'ora italiana) e quantità (±0,5%). La differenza di plusvalenza si scompone in:
  - operazioni che Koinly tassa ma che non rilevano;
  - differenze di corrispettivo e di costo;
  - cessioni presenti solo in Koinly;
  - cessioni presenti solo nella ricostruzione.

  Il confronto è anche nell'Excel e nella memoria.
- **Privacy nei report:** le descrizioni Koinly dei movimenti in euro, che possono contenere banca e IBAN del cliente, non vengono riportate.

## 3. Questionario dell'Agenzia delle Entrate

Elementi di risposta alle 8 domande tipo (art. 32 DPR 600/1973):

1. acquisti e intermediari;
2. movimenti in valuta sugli exchange;
3. wallet alle date, con tipologia, chiavi pubbliche e indirizzi;
4. elenco delle transazioni con TxHash;
5. saldi per wallet valorizzati;
6. cessioni, permute e proventi;
7. trasferimenti verso terzi;
8. rilevanza reddituale.

Inoltre:

- **Attribuzione** di ogni wallet o indirizzo («mio», «non mio», «piattaforma», «da chiarire»).
- **Dichiarazione sostitutiva di atto notorio** (art. 47 DPR 445/2000) sui soli wallet dichiarati «mio».
- **Verifica della provenienza dei fondi** (`provenienza.js`), nel questionario e nel fascicolo stampato, con semaforo per anno e complessivo: verde = provenienza dimostrata, giallo = compatibile ma con avvisi, rosso = non dimostrata. Si confronta in modo cumulato il denaro entrato nelle piattaforme (versamenti o acquisti in valuta, al netto dei rientri) con i redditi netti delle dichiarazioni dei redditi (Redditi PF, 730 o CU). Allegare il PDF è facoltativo: dal PDF si legge solo l'anno d'imposta e la dichiarazione entra tra gli allegati; anno, reddito complessivo e imposte si possono anche indicare a mano, senza file e con le altre fonti documentate (eredità, donazioni, vendite, TFR). Avvisi: impiego oltre il 70% dei redditi netti, dichiarazione dell'anno mancante, estratti conto mancanti o versamenti non ritrovati, depositi di cripto da wallet non collegati non documentati (rosso da 500 €) o caricati a costo zero. Le dichiarazioni sono elencate tra gli allegati della memoria.
- **Memoria finale:** fonti, metodo, correzioni con i motivi, differenze anno per anno rispetto ai report Koinly senza modifiche.

## 4. Sanzioni RW e RT

Per ogni anno da ravvedere:

- **Dati:** si carica il «Complete tax report» Koinly (PDF) o i saldi di fine anno (CSV). Il valore finale per l'RW e le plusvalenze nette si compilano da lì e sono modificabili. L'IVACA si prende dalla prima pagina per lo stesso anno.
- **Norma applicabile:** quella vigente quando la violazione è commessa. L'infedele dichiarazione si considera commessa alla scadenza della dichiarazione, l'omesso versamento alla scadenza del saldo. Per le violazioni dal 1/9/2024 vale il testo modificato dal D.Lgs. 87/2024.
- **RW:** 3% minimo (art. 5 c. 2 DL 167/1990) × frazione di ravvedimento (art. 13 D.Lgs. 472/1997).
- **IVACA e RT, dichiarazione presentata:** si integra. Sanzione per infedele: previgente 90%; dal 1/9/2024 50% con l'integrativa presentata prima di accessi, ispezioni e verifiche (art. 1 c. 2-bis D.Lgs. 471/1997), con il confronto con il 70% minimo 150 € dell'infedele contestata (c. 2). Si riduce con la frazione e assorbe l'omesso versamento. Interessi legali giorno per giorno dalla scadenza del saldo.
- **IVACA prima del 2023:** non dovuta; resta la sanzione per omesso monitoraggio RW.
- **Termine della dichiarazione non ancora scaduto:** solo omesso versamento del saldo (25% o 30%, ridotto).
- **Dichiarazione omessa** (nulla presentato, neanche per altri redditi): entro 90 giorni è tardiva (25 € più 258 € del quadro RW ridotti a 1/10, o a 1/9 secondo un'altra lettura). Oltre 90 giorni non è ravvedibile; versione principale la presentazione spontanea prima dei controlli: dal 1/9/2024 75% delle imposte (art. 1 c. 1-bis), fino al 31/8/2024 60% minimo 200 € se entro il termine della dichiarazione dell'anno successivo. Alternativa: contestazione al 120% definibile a 1/3.
- **Controlli in corso** (accesso, PVC, schema di atto, avviso): dal 1/9/2024 con accessi o verifiche il 50% del c. 2-bis non spetta e si parte dal 70% (c. 2); riduzioni 1/5 dopo il PVC, 1/6 dopo lo schema di atto senza PVC, 1/4 dopo lo schema preceduto da PVC; l'avviso preclude il ravvedimento (acquiescenza a 1/3). Minimo di 150 € ridotto quando la percentuale dà meno; riduzione di 1/3 (c. 4) e aumento per condotte fraudolente (c. 3) su richiesta.
- **Versioni e avvertenze:** fino al 31/8/2024 maggiorazione di 1/3 per redditi esteri come tesi prudenziale (per lo studio le cripto sono aterritoriali); caso dubbio dell'invio prima del 1/9/2024 con termine successivo; favor rei solo come tesi difensiva; cumulo giuridico dal 1/9/2024 non applicato (versione prudente); termine di accertamento (art. 43 DPR 600/1973, 5 o 7 anni) con avviso se scaduto o in scadenza entro 90 giorni; soglie penali (art. 4 e 5 D.Lgs. 74/2000).

Fonti in [docs/FONTI.md](docs/FONTI.md).

## 5. Quadri RW, RT e F24

Prospetti compilati secondo i modelli ministeriali, stampabili in PDF con l'intestazione dello studio:

- **Quadro RW:** un rigo per periodo di detenzione, cinque righi per modulo. Colonne: col. 1 titolo, col. 3 codice 21, col. 5 quota, col. 6 criterio 1, col. 7 e 8 valori in euro, col. 10 giorni, col. 33 e 34 imposta. Rigo RW8 con il totale esatto arrotondato all'euro. Le cripto con molti periodi (soglia modificabile) vanno in un rigo unico con valore medio ponderato e giorni complessivi. Il prospetto è disegnato come il modello Redditi PF (fascicolo 2): moduli di cinque righi RW1-RW5, ogni rigo con le caselle numerate (col. 1-8, 9-16 e 29-34, con le etichette del modello) e, subito sopra, la cripto, il periodo e la quantità a cui si riferisce (per esempio «Cripto BTC · 01/01/2024 – 10/03/2024 · 1 BTC»); in fondo il rigo RW8 con le sei caselle dell'imposta cripto-attività. Le colonne 17-21 (società, entità giuridiche, cointestatari) non servono alle cripto e non sono riportate.
- **Quadro RT:** sezione cripto-attività con i righi del modello dell'anno.

  | Anno | Modello | Righi | Franchigia di 2.000 € |
  |---|---|---|---|
  | 2023 | Redditi PF 2024 | RT31-RT39 | solo l'eccedenza (criterio dello studio) |
  | 2024 | Redditi PF 2025 | RT41, RT43-RT45, RT57, RT88-RT90 | solo l'eccedenza |
  | 2025 | Redditi PF 2026 | RT41 col. 3-4 | nessuna |

  Plusvalenza = corrispettivi − costi.
  Fino al 2022: con i costi ricostruiti vanno nella sezione dei redditi diversi al 26% (RT21-RT29, codice tributo 1100) tutte le cessioni dell'anno (anche le permute tra cripto) se la soglia delle valute è superata; se non è superata il quadro RT resta vuoto e le plusvalenze per le sanzioni sono zero.
- **Proventi da detenzione** (staking, reward, airdrop, interessi, cashback): dal 2023 sono redditi diversi dell'art. 67 c. 1 lett. c-sexies TUIR al ricevimento e si sommano ai corrispettivi del quadro RT a costo zero; le cripto ricevute entrano nei costi di carico con lo stesso valore. Fonte: «Income report» CSV dell'anno o, in mancanza, il riepilogo redditi del «Complete tax report». Escludibili anno per anno nella scheda Sanzioni. Fino al 2022 restano fuori dal quadro RT delle cripto.
- **Other gains** (derivati, futures, margin): non entrano nel quadro RT delle cripto. Lo studio sceglie per anno, secondo il tipo di reddito, se riportarli nel quadro RT al 26% (redditi diversi: profitti come corrispettivi, perdite come costi) o nel quadro RM (redditi di capitale: profitti al lordo, perdite non deducibili).
- **F24, sezione Erario:**

  | Codice | Uso | Fonte |
  |---|---|---|
  | 1727 | Imposta sulle cripto-attività, saldo (rateazione 0101) | Ris. 36/E/2023 e 10/E/2024 |
  | 1715 | Imposta sostitutiva RT dal 2023 | Ris. 36/E/2023 |
  | 1100 | Imposta sostitutiva RT fino al 2022 (regime delle valute, sezione al 26%) | sanzione e interessi restano 8945 e 1945: da verificare |
  | 8945 | Sanzione da ravvedimento | Ris. 12/E/2023; per l'IC per analogia |
  | 1945 | Interessi da ravvedimento | Ris. 12/E/2023; per l'IC per analogia |
  | 8911 | Sanzione RW e dichiarazione tardiva | |

  Anno di riferimento = anno d'imposta. Gli anni con dichiarazione omessa non vanno in F24.
- **Fascicolo finale: stampa** (ultima scheda di ogni percorso, dopo tutte le altre): riepilogo per anno a video, contenuto del fascicolo con quello che c'è e quello che manca, e il pulsante «Stampa fascicolo», che si trova solo qui (nelle altre schede c'è il rimando «Vai al fascicolo finale»). Gli anni con transazioni e saldi di inizio e fine anno entrano da soli. Il fascicolo per il contribuente contiene, nell'ordine: riepilogo di tutti gli anni (valore RW, IVACA, plusvalenze, riduzione delle sanzioni, imposte, sanzioni, interessi, totale); per ogni anno giorni di detenzione, quadro RW, soglia delle valute fino al 2022, quadro RT, quadri RT al 26% e RM degli altri redditi (broker esteri), sanzioni RW e RT e ravvedimento; il modello F24; **il lavoro svolto per il contribuente** (file ricevuti, operazioni, wallet, correzioni dello studio e, anno per anno, cripto detenute, token esclusi, righi RW, riscontro con il report di fine anno, soglia delle valute, quadro RT ed esito del ravvedimento); in fondo la **metodologia utilizzata per i calcoli** (dati usati, perimetro, saldi iniziali, giorni e periodi, RW e IVACA, costi LIFO, soglia delle valute, quadro RT, sanzioni e riduzioni anno per anno, prezzi e valori di mercato: valore medio rilevato da Koinly sulle piattaforme di scambio al momento di ogni operazione). Le imposte dei quadri RM e RT al 26% degli altri redditi non entrano nel calcolo delle sanzioni. La riduzione da ravvedimento di ogni anno (per esempio 1/6, art. 13 c. 1 lett. b-ter D.Lgs. 472/1997) è in evidenza anche a video. Sotto ogni sanzione c'è il calcolo esplicito: base (valore delle cripto non indicate in RW, dal report di fine anno, o imposta non versata) × aliquota (3% per il RW, 90% o 70%/50% per l'infedele, con l'eventuale minimo) = sanzione piena, poi ridotta con la frazione del ravvedimento (per esempio 100.000,00 € × 3% = 3.000,00 € → × 1/6 = 500,00 €).

## 7. Pratica con l'Agenzia delle Entrate

Scheda «Pratica AdE» (`pratica.js`): la sequenza della pratica, dall'invito o questionario (art. 32 DPR 600/1973, scheda «Questionario AdE») allo schema di atto (art. 6-bis L. 212/2000) e all'atto impositivo.

- **Lettura dello schema di atto in PDF:** Ufficio, PEC, numero, anno, invito precedente, funzionario referente; tabella «Componenti quadro RT» con la natura di ogni rilievo (vendite con carta, permute, permute in stablecoin, prelievi verso wallet non riconosciuti, proventi, minusvalenze, franchigia) e la data dell'operazione; prospetto «dichiarato / accertabile» (RT, RW), IVACA, sanzioni. Nome e codice fiscale del contribuente servono solo a proporre i dati del cliente e non sono conservati nei dati dell'atto.
- **Controlli sui numeri dello schema:** somma dei componenti e totale imponibile, segni stampati incoerenti, imposta = imponibile × aliquota, sanzione sulla base di imposta sostitutiva e IVACA arrotondate, franchigia per anno, sanzione RW rinviata ad atto separato.
- **Scadenze dalla data di notifica:** istanza di adesione (30 giorni) e osservazioni (60 giorni), prorogate al primo giorno lavorativo (sabato, domenica, festivi nazionali e Pasquetta).
- **Osservazioni con il metodo dello studio:** i dati restano quelli dell'Ufficio e si contestano solo profili di diritto, con colonne cumulative: permute in stablecoin non rilevanti (nessuna stablecoin era un e-money token prima di MiCAR; interrogazione 5-03682; niente sanzioni per obiettiva incertezza) e aliquota del 12,50% per il 2023 e il 2024 (art. 5 c. 2 D.Lgs. 461/1997). Se ci sono le transazioni, si affianca la ricostruzione dei costi dello stesso anno.
- **Uscite:** osservazioni in Word nello schema delle memorie dello studio (premesso che, presenta, espone, chiede, elenco dei documenti), prospetto Excel con le formule (allegato 1), stampa o PDF. Gli atti si salvano nel file di lavoro.
- **Atto di contestazione delle sanzioni RW (art. 16 D.Lgs. 472/1997):** lettura del provvedimento di determinazione delle sanzioni (violazioni per anno con il valore non dichiarato e le misure minima e massima, prospetto A o B, cumulo materiale e giuridico, sanzione determinata, definizione a un terzo con codice 9601, codice ufficio e codice atto); controlli dei calcoli (3% per anno, cumulo giuridico = più grave × 1,5 × 1,25 a confronto con il materiale, definizione non inferiore a un terzo dei minimi); termine di 60 giorni con la sospensione di agosto; ricalcolo con i valori RW ricostruiti; strade possibili (definizione, anche a rate per le violazioni dal 1/9/2024; deduzioni difensive; ricorso) e nota «valutazione e opzioni» in Word per il cliente.
- **Avviso di accertamento:** nella sequenza della pratica; la lettura automatica arriverà con un campione.

## 6. Guida

Scheda «Guida» per il cliente (`guida.js`): quali file Koinly scaricare, come usare le tre pagine, avvertenze. Si stampa o si salva in PDF con l'intestazione dello studio.

## File

| File | Contenuto |
|---|---|
| `index.html`, `ui.js`, `koinly.css` | Pagina e interfaccia |
| `piattaforme.js` | Lettura diretta dei CSV delle piattaforme e abbinamento dei trasferimenti tra wallet |
| `onchain.js` | Wallet Bitcoin dalla blockchain: indirizzi dalla chiave pubblica estesa, transazioni da mempool.space |
| `prezzi.js` | Prezzi in euro mancanti (Binance e cambio BCE) e saldi di inizio e fine anno ricostruiti |
| `lettura.js` | Lettura dei report di saldi Koinly (CSV e PDF, italiano e inglese) |
| `detenzione.js` | Transazioni, giorni di detenzione, periodi, token sospetti, riscontri |
| `ivaca.js` | Valori dei periodi e imposta |
| `banca.js` | Lettura anonimizzata degli estratti conto (PDF, CSV, Excel) e riscontro con Koinly |
| `etoro.js` | Lettura del rendiconto eToro in PDF e passaggio dei dati alla forma comune dei broker esteri |
| `estero.js` | Motore comune dei broker esteri (quadri RT al 26%, RM e RW con IVAFE e IVACA) e lettura del modello CSV generico |
| `report.js` | Lettura degli altri report Koinly (Income, Expenses, Gifts/Lost, Other gains) |
| `costi.js` | Costi di carico LIFO globali dall'origine, abbinamento dei trasferimenti, correzioni dello studio |
| `provenienza.js` | Verifica della provenienza dei fondi con semaforo; anno d'imposta delle dichiarazioni dei redditi |
| `pratica.js` | Pratica con l'Agenzia: lettura dello schema di atto, controlli, scenari delle osservazioni, scadenze, testo delle osservazioni |
| `questionario.js` | Elementi di risposta al questionario dell'Agenzia, wallet, chiavi pubbliche e indirizzi |
| `sanzioni.js` | Sanzioni, frazioni di ravvedimento, interessi legali, scadenze per anno |
| `studio.js` | Dati dello studio per la stampa |
| `guida.js` | Testo della guida per il cliente |
| `modelli.js` | Quadri RW e RT del modello Redditi PF e modello F24 |
| `xlsx-mini.js` | Scrittura dei file Excel senza librerie |
| `comune/` | Grafica, caratteri, pdf.js 3.11.174 e lettura dei PDF |
| `img/` | Icone e logo Studio ME, immagine di anteprima dei link, QR code delle donazioni |

## Prove

Sul Mac, senza Node, con JavaScriptCore del sistema (tutte le prove, o solo quelle indicate):

```bash
test/prove.sh
test/prove.sh costi etoro
```

Con Node ogni file si esegue anche da solo, per esempio `node test/costi.test.js`.

I dati delle prove sono inventati. I file reali dei clienti vanno solo nella cartella `campioni/`, esclusa da Git.

## Licenza

Copyright (C) 2026 Dott. Massimo Esposito. Il codice è rilasciato con licenza AGPL-3.0; nome, dati, testi e contenuti dello studio: tutti i diritti riservati al Dott. Massimo Esposito.

Questo programma è software libero: si può ridistribuire e modificare secondo i termini della **GNU Affero General Public License versione 3** (AGPL-3.0), pubblicata dalla Free Software Foundation. Il testo completo è nel file [LICENSE](LICENSE). Chi modifica il programma e lo rende disponibile ad altri, anche come servizio web, deve pubblicare il codice modificato con la stessa licenza.

Il programma è distribuito senza alcuna garanzia: i conteggi vanno sempre verificati da un professionista.

Esclusioni:

| Parte | Licenza |
|---|---|
| `comune/vendor/` (pdf.js) | Apache 2.0, dei rispettivi autori |
| `comune/fonts/` (Source Sans 3, Source Serif 4, IBM Plex Mono) | SIL Open Font License |
| Dati e recapiti dello studio in `studio.js`, logo e icone Studio ME, immagine di anteprima e QR code delle donazioni in `img/` | Non coperti dalla licenza e non riutilizzabili: chi riusa il programma deve inserire i propri |
