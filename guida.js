/* CryptoMesTools · Copyright (C) 2026 Massimo Esposito · licenza GNU AGPL-3.0 (file LICENSE) */
/* CryptoMesTools · guida per il cliente (scheda «Guida» e stampa). */
window.KoinlyGuida = '' +
'<h2>Guida: come funziona CryptoMesTools</h2>' +
'<p class="lead">CryptoMesTools prepara i conteggi sulle cripto-attività per la dichiarazione dei redditi a partire dai report di Koinly, dai file delle piattaforme o dall\'analisi on-chain dei wallet: quadri RW e RT, imposta sul valore delle cripto-attività (IVACA), eventuali sanzioni con il ravvedimento, modello F24 e fascicolo fiscale.</p>' +

'<div class="banner beta-avviso"><strong>Versione beta</strong><p>Il programma è in fase di test: i conteggi vanno sempre verificati con lo studio.</p></div>' +
'<div class="banner"><strong>Riservatezza</strong><p>I file che caricate restano sul vostro computer: il programma li legge nel browser e non li salva né li invia in rete. Chiudendo la pagina i dati spariscono.</p></div>' +

'<div class="panel"><h3 style="margin-top:0">Prima di tutto: che cosa dovete fare</h3><p>All\'inizio della scheda «Caricamento file» scegliete il percorso. <b>Dichiarazione nei termini</b>: si prepara la dichiarazione dell\'anno con quadri RW e RT, imposta sulle cripto-attività e F24 di saldo; sanzioni e ravvedimento non compaiono, né a video né nel fascicolo. <b>Ravvedimento per gli anni passati</b>: per gli anni in cui le cripto non sono state dichiarate si calcolano anche sanzioni ridotte e interessi. Gli altri percorsi servono per rispondere all\'Agenzia delle Entrate o preparare il fascicolo per i controlli. Il percorso si può cambiare in ogni momento.</p></div>' +
'<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">1. Caricamento file: quali file servono</h3>' +
'<p>Tutti i file si caricano nella scheda «Caricamento file», dove per ciascuno è indicato che cosa contiene. I file di Koinly si scaricano dal vostro account, uno per ogni anno da esaminare. Prima di scaricarli verificate in Koinly che i wallet e gli exchange siano tutti collegati e che non ci siano avvisi di transazioni mancanti.</p>' +
'<table class="det"><thead><tr><th>File</th><th>Formato</th><th>Dove si usa</th><th>Che cosa contiene</th></tr></thead><tbody>' +
'<tr><td><b>Transazioni</b><br><span class="small">di solito «backup_transactions_koinly.csv» o «transaction history»</span></td><td>CSV</td><td>Quadri RW e RT</td><td>Tutte le operazioni di tutti gli anni (acquisti, vendite, scambi, trasferimenti, interessi): servono per vedere quando cambiano le quantità.</td></tr>' +
'<tr><td><b>Saldi a inizio anno</b><br><span class="small">«Beginning of year holdings»</span></td><td>CSV</td><td>Quadri RW e RT</td><td>Le cripto possedute al 1° gennaio, con quantità e valore.</td></tr>' +
'<tr><td><b>Saldi a fine anno</b><br><span class="small">«End of year holdings»</span></td><td>CSV (oppure il Complete tax report)</td><td>Quadri RW e RT</td><td>Le cripto possedute al 31 dicembre, con quantità e valore.</td></tr>' +
'<tr><td><b>Resoconto fiscale completo</b><br><span class="small">«Complete tax report»</span></td><td>PDF</td><td>Quadri RW, RT, F24 e sanzioni</td><td>Per l\'anno: corrispettivi delle vendite, costi di acquisto, plusvalenze, redditi e saldi di fine anno. Facoltativo.</td></tr>' +
'<tr><td><b>Altri report Koinly</b><br><span class="small">«Income report», «Expenses report», «Gifts, donations &amp; lost assets», «Other gains report»</span></td><td>CSV</td><td>Quadri RW, RT, F24 e sanzioni</td><td>Redditi (staking, ricompense), commissioni, cripto regalate o perse, profitti e perdite di derivati: riepiloghi per tipo, cripto e wallet. Dal 2023 i redditi dell\'Income report entrano nel quadro RT; i profitti e le perdite dell\'Other gains si riportano dove indica lo studio. Facoltativo.</td></tr>' +
'<tr><td><b>Dichiarazioni dei redditi</b><br><span class="small">Redditi PF, 730 o CU</span></td><td>PDF</td><td>Fascicolo risposta Agenzia delle Entrate</td><td>Servono a dimostrare la provenienza del denaro investito in cripto-attività: anche degli anni prima del primo acquisto. Indicate allo studio anche eredità, donazioni, vendite di immobili o altre entrate, con i documenti. Facoltativo.</td></tr>' +
'<tr><td><b>Rendiconti</b><br><span class="small">eToro: «Account statement», dal primo deposito; altri broker: modello CSV</span></td><td>PDF (eToro) o CSV</td><td>Quadri RW, RT, F24 e sanzioni</td><td>Posizioni chiuse, movimenti, dividendi e portafoglio: il programma calcola i quadri RT, RM e RW di ogni anno. Il rendiconto eToro si legge da solo; per gli altri broker (Trade Republic, Degiro, Interactive Brokers, Revolut…) si compila il modello CSV che si scarica dal riquadro, con l\'aiuto dello studio. Facoltativo, solo se avete conti presso broker esteri.</td></tr>' +
'<tr><td><b>Estratti conto bancari</b></td><td>PDF</td><td>Verifiche e riconciliazione, fascicolo per l\'Agenzia</td><td>Si leggono solo date, importi ed exchange dei bonifici verso o dalle piattaforme di cripto-attività; tutto il resto è scartato. Facoltativo.</td></tr>' +
'</tbody></table>' +
'<p class="small">Dove trovarli in Koinly: i report dei saldi e il Complete tax report sono nella sezione dei report fiscali (Tax reports), scegliendo l\'anno; il file delle transazioni si esporta dalla pagina delle transazioni (Transactions, comando di esportazione in CSV). I nomi dei menu possono cambiare con gli aggiornamenti di Koinly: in caso di dubbio chiedete allo studio.</p>' +
'<p class="small">Il file delle transazioni deve contenere tutta la storia, dal primo acquisto, non solo l\'anno in esame. Scegliete in Koinly la valuta euro.</p></div>' +

'<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">2. Come ragiona il programma (criteri di calcolo)</h3>' +
'<p>I calcoli lavorano da soli sotto i quadri; il dettaglio si apre in fondo alla scheda dei quadri («Dettaglio dei calcoli»).</p><ul>' +
'<li><b>Costi di carico: LIFO globale.</b> I costi d\'acquisto di ogni cripto si ricostruiscono dall\'origine, dalla prima operazione: una pila unica per tutti i wallet e tutti gli anni, e ogni cessione scarica per prima la quantità acquistata più di recente. Le commissioni sono oneri accessori; dal 2023 le permute tra cripto non realizzano plusvalenze.</li>' +
'<li><b>Giorni di detenzione e periodi.</b> Ogni cambio di quantità apre un periodo, con valore iniziale e finale: da qui i righi del quadro RW e l\'imposta sul valore (IVACA, 0,20% in proporzione ai giorni, dal 2023; non si versa fino a 12 €).</li>' +
'<li><b>IVACA o solo monitoraggio.</b> Le cripto sui wallet privati pagano sempre l\'IVACA. Per ogni piattaforma, nella scheda «Caricamento file», lo studio indica se il quadro RW è di solo monitoraggio: i righi di quella piattaforma hanno la col. 16 barrata e l\'IVACA non si paga. Per l\'anno in corso il valore finale è all\'ultimo prezzo disponibile, provvisorio fino al 31 dicembre.</li>' +
'<li><b>Soglia delle valute (fino al 2022).</b> Le plusvalenze sono tassate solo se la giacenza ha superato 51.645,69 € per 7 giorni lavorativi continui.</li>' +
'<li><b>Riscontri.</b> Le quantità ricostruite si confrontano con i saldi al 1° gennaio e al 31 dicembre; differenze o saldi negativi indicano operazioni mancanti, da chiarire prima di usare i risultati.</li></ul></div>' +

'<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">3. Caricamento file e verifiche</h3>' +
'<p>Oltre ai file di Koinly, si possono caricare i file esportati dalle piattaforme e indicare i wallet per l\'analisi on-chain: le transazioni si ricostruiscono anche senza Koinly. In fondo alla scheda, <b>Verifiche e riconciliazione</b> elenca le operazioni da chiarire (depositi e prelievi verso wallet non collegati, operazioni senza valore in euro), le correzioni dello studio e il riscontro con gli estratti conto; da qui si stampa la richiesta di chiarimenti.</p></div>' +

'<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">4. Quadri RW, RT, F24 e sanzioni</h3>' +
'<p>Il programma prepara i prospetti compilati come nei modelli ufficiali: il quadro RW con un rigo per ogni periodo di detenzione, il quadro RT con i righi dell\'anno e il modello F24 con i codici tributo. Se avete caricato il rendiconto eToro o il modello dei broker esteri, trovate anche i quadri RT, RM e RW calcolati per ogni anno.</p>' +
'<p>Nella dichiarazione nei termini la scheda si chiama «Quadri RW, RT e F24»: per ogni anno da dichiarare valore RW, IVACA, plusvalenze e imposte da versare a saldo, senza sanzioni.</p>' +
'<p>Nel ravvedimento, nella stessa scheda, le <b>sanzioni</b> per gli anni passati in cui le cripto non sono state indicate (quadro RW per il possesso, quadro RT per le plusvalenze, eventualmente RM):</p><ol>' +
'<li>Indicate la data in cui pensate di pagare: la riduzione delle sanzioni (ravvedimento) dipende da quanto tempo è passato.</li>' +
'<li>Gli anni con transazioni e saldi si inseriscono da soli; valore delle cripto, corrispettivi e costi si possono correggere.</li>' +
'<li>Scegliete se la dichiarazione di quell\'anno è stata presentata (senza le cripto) oppure non è stata presentata affatto.</li>' +
'<li>Il programma calcola imposte, sanzioni ridotte e interessi. Se la dichiarazione non è stata presentata il ravvedimento non è possibile: il programma lo segnala e mostra gli importi solo come confronto. In questo caso non pagate nulla da soli e parlatene con lo studio.</li></ol></div>' +

'<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">5. Fascicolo fiscale</h3>' +
'<p>Riepilogo per anno e per quadro (RW, IVACA, RT) con imposte, sanzioni e interessi, poi gli anni nel dettaglio, il modello F24, il lavoro svolto e la metodologia: si stampa o si salva in PDF.</p></div>' +

'<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">6. Fascicolo risposta Agenzia delle Entrate</h3>' +
'<p>Fase successiva, solo se arriva una richiesta dell\'Agenzia: risposte alle domande tipo, wallet e indirizzi del contribuente (con indirizzi e chiavi pubbliche completi), provenienza dei fondi, dichiarazione sostitutiva e memoria tecnica, anche in Word; lettura dello schema di atto e osservazioni.</p></div>' +

'<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">7. Da sapere</h3><ul>' +
'<li>I risultati dipendono dai dati di Koinly: se in Koinly mancano operazioni o prezzi, anche i conteggi saranno incompleti.</li>' +
'<li>Il programma somma tutti i wallet per ciascuna cripto. Nella dichiarazione va compilato un rigo per ogni portafoglio: lo studio ripartisce i valori.</li>' +
'<li>Le stablecoin (USDT, USDC…) sono cripto-attività e sono comprese; gli euro e le altre valute sui conti degli exchange no.</li>' +
'<li>I conteggi sono una stima da verificare con lo studio: non sostituiscono il parere del professionista e non vanno usati per versare imposte o sanzioni senza averne parlato.</li>' +
'<li>CryptoMesTools non è affiliato né approvato da Koinly: «Koinly» è un marchio dei rispettivi titolari, citato solo per indicare i report compatibili.</li></ul></div>';
