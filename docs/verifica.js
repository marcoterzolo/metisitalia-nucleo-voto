/**
 * =============================================================================
 * docs/verifica.js - logica della VERIFICA INDIPENDENTE di una votazione (GitHub Pages)
 * -----------------------------------------------------------------------------
 * Tutto avviene nel browser di chi usa la pagina: nessun dato viene inviato o
 * salvato. Funzioni di calcolo da AN05_blind.js (copia del nucleo del voto):
 * sigillo, firma (verificaScheda), impronta della chiave.
 *
 * Ingresso: file dell'urna (formato MI-URNA-DATI-1, AN05_urna_dati.php del sito)
 *  - trascinato o scelto dal disco (modo piu' indipendente);
 *  - oppure letto dall'indirizzo dopo il # (link "Verifica fuori dal nostro
 *    sito"), SOLO da www.metisitalia.it / metisitalia.it (in prova anche
 *    127.0.0.1 / localhost quando la pagina stessa gira in locale).
 * Controlli (INVARIATI rispetto alla versione precedente):
 *  1. sigillo della lista ricalcolato = sigillo del file;
 *  2. (firma versione 2) ogni scheda: nomi = nomi dei suoi id nella lista e
 *     firma valida su p + sigillo ricalcolato + id scelti;
 *  3. riconteggio dei nomi = risultati pubblicati; schede rispetto ai votanti;
 *  4. impronta dell'urna (MI-URNA-v1) e impronta della chiave ricalcolate;
 *  5. registro pubblico su GitHub (cartella = SHA-256("MI-AN05-REGISTRO|" + id
 *     votazione), 24 caratteri): timbro di chiusura con stesse schede, stessa
 *     impronta dell'urna, stessa impronta del FILE (bytes ricevuti), stesso
 *     sigillo e chiave; nessun timbro intermedio con piu' schede di quante ne
 *     abbia l'urna finale (schede cancellate). Registro diverso solo in prova
 *     locale con ?reg=<indirizzo> (ignorato fuori da localhost).
 * 21/11/2026 (notte): PRESENTAZIONE per persone non tecniche, come le email di
 *  esito: i controlli raccolgono gli esiti (ok / ko / att / info) e la pagina
 *  mostra il VERDETTO in cima (tutto in ordine / qualcosa non torna / confronto
 *  non ancora possibile), poi i capitoli: cosa ha controllato, cosa e'
 *  risultato (una frase semplice per controllo), cosa fare (se serve), il
 *  riconteggio candidato per candidato, il dettaglio dei codici (nome comune +
 *  nome tecnico, Identico / Diverso dall'originale = timbro di chiusura) e il
 *  link alle copie su GitHub.
 * Testi in 5 lingue (TX), inseriti sempre con textContent.
 * =============================================================================
 */
(function () {
    'use strict';
    var B = window.AN05B;
    var REPO = 'marcoterzolo/metisitalia-registro-urne';
    var LOCALE = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
    var parametri = new URLSearchParams(location.search);

    var TX = {
 "it": {
  "titolo": "Verifica indipendente della votazione",
  "sotto": "METIS Italia · pagina pubblicata su GitHub, fuori dal nostro sito",
  "spiega": "Questa pagina controlla, sul tuo dispositivo e senza passare dal sito di METIS Italia, che una votazione chiusa non sia stata modificata.",
  "lingua": "Lingua",
  "zona": "Trascina qui il file dell'urna (lo scarichi con «Scarica l'urna» nella pagina dei risultati) oppure tocca qui per sceglierlo.",
  "da": "Dati letti da: ",
  "dafile": "file scelto da te",
  "fonte_no": "Indirizzo non accettato: i dati si leggono solo dal sito di METIS Italia. Scarica il file e trascinalo qui.",
  "carica_no": "Non riesco a leggere i dati della votazione. Potrebbe non essere ancora chiusa, oppure avere meno di 5 schede (in quel caso, per proteggere il segreto del voto, le schede non vengono pubblicate).",
  "formato_no": "Il file non è un file dell'urna di METIS Italia.",
  "votazione": "Votazione",
  "chiusura": "Chiusa il",
  "schede": "Schede nell'urna",
  "corso": "Controllo in corso...",
  "v_ok": "Tutto in ordine: la votazione non è stata modificata dopo la chiusura.",
  "v_ko": "Attenzione: qualcosa non torna. I dati di questa votazione risultano modificati.",
  "v_att": "Le schede sono in ordine, ma il confronto con la copia salvata alla chiusura non è ancora possibile.",
  "c1_t": "Cosa ha controllato questa pagina",
  "c1": "Il tuo dispositivo ha letto tutte le schede anonime della votazione, ha controllato una per una le loro firme, le ha ricontate e ha confrontato tutto con la copia che METIS Italia ha salvato su GitHub alla chiusura, un archivio pubblico che nessuno può più modificare, nemmeno noi.",
  "c2_t": "Cosa è risultato",
  "r_fir_ok": "Tutte le %d schede hanno una firma valida: nessuna scelta e nessun nome sono stati cambiati dopo il voto.",
  "r_fir_ko": "%d schede su %d NON hanno una firma valida: scelte o nomi risultano cambiati dopo il voto.",
  "r_fir_v1": "Questa votazione è stata creata prima del 21/11/2026: le schede non hanno la firma sulle scelte, quindi questo controllo non è disponibile.",
  "r_cont_ok": "Ricontando le schede si ottengono esattamente i risultati pubblicati.",
  "r_cont_ko": "Ricontando le schede NON si ottengono i risultati pubblicati.",
  "r_sig_ok": "L'elenco dei candidati è identico a quello su cui si è votato.",
  "r_sig_ko": "L'elenco dei candidati NON è identico a quello su cui si è votato.",
  "r_chiu_ok": "Schede, candidati e chiave sono identici alla copia salvata su GitHub alla chiusura.",
  "r_chiu_ko": "I dati NON sono identici alla copia salvata su GitHub alla chiusura. Diversi: %s.",
  "r_chiu_manca": "La copia salvata alla chiusura non è ancora su GitHub: arriva di solito entro 10 minuti dalla chiusura.",
  "r_reg_vuoto": "Per questa votazione non ci sono copie su GitHub (votazioni chiuse prima del 21/11/2026).",
  "r_reg_err": "GitHub non risponde in questo momento: il confronto con la copia salvata non è stato possibile.",
  "r_int_ok": "Durante il voto il numero di schede è stato salvato %d volte: nessuna scheda è sparita.",
  "r_int_ko": "Durante il voto erano già state salvate %d schede, ma ora nell'urna ce ne sono %d: mancano delle schede.",
  "r_chiave_ok": "La chiave delle firme è la stessa per tutti gli elettori. Puoi confrontarla con quella accanto alla tua ricevuta: %s",
  "r_chiave_ko": "La chiave delle firme NON corrisponde a quella indicata nel file.",
  "r_imp_ko": "Il riassunto delle schede NON corrisponde a quello indicato nel file.",
  "d_schede": "numero di schede",
  "d_urna": "riassunto delle schede",
  "d_file": "file dell'urna",
  "d_sig": "elenco dei candidati",
  "d_chiave": "chiave delle firme",
  "c3_t": "Cosa fare",
  "c3_ko": "Conserva questa pagina (anche con uno screenshot) e avvisa subito l'organizzatore della votazione e l'assistenza di METIS Italia.",
  "c3_att": "Riprova più tardi: il confronto con la copia salvata si potrà fare appena sarà disponibile.",
  "c4_t": "Il riconteggio, candidato per candidato",
  "cand": "Candidato",
  "pubb": "Risultati pubblicati",
  "contati": "Ricontati qui",
  "vot": "Schede contate: %d su %d votanti online (l'eventuale differenza sono voti iniziati ma non completati).",
  "c5_t": "Dettaglio dei codici",
  "c5": "Sono i riassunti usati per il confronto. Non serve capirli: servono a dimostrare che nulla è cambiato.",
  "n_urna": "Riassunto delle schede",
  "n_sig": "Riassunto dell'elenco dei candidati",
  "n_chiave": "Chiave delle firme",
  "tec_urna": "impronta dell'urna",
  "tec_sig": "sigillo della lista",
  "tec_chiave": "impronta della chiave",
  "x_urna": "Riassume tutte le schede in un unico codice. Se cambiasse anche un solo voto, il codice sarebbe diverso.",
  "x_sig": "Riassume i nomi dei candidati. Se qualcuno cambiasse un nome dopo il voto, il codice sarebbe diverso.",
  "x_chiave": "Identifica la chiave con cui sono state firmate le schede, la stessa per tutti gli elettori.",
  "es_ok": "Identico all'originale",
  "es_ko": "Diverso dall'originale",
  "es_att": "Da controllare",
  "orig": "Valore salvato alla chiusura",
  "reg_vedi": "Vedi le copie salvate su GitHub",
  "c6_t": "Come funziona questa pagina",
  "come": "Questa pagina e il programma che fa i calcoli sono pubblici su GitHub (cartella docs dell'archivio metisitalia-nucleo-voto) e ogni loro modifica resta nello storico. Il programma che controlla le firme deve essere identico a quello usato per votare: il suo codice qui sotto deve coincidere con quello pubblicato nel file IMPRONTE.md.",
  "impjs": "Codice del programma usato qui:"
 },
 "en": {
  "titolo": "Independent check of the election",
  "sotto": "METIS Italia · page published on GitHub, outside our site",
  "spiega": "This page checks, on your device and without going through the METIS Italia site, that a closed election has not been changed.",
  "lingua": "Language",
  "zona": "Drop the ballot box file here (download it with «Download the ballot box» on the results page) or tap here to choose it.",
  "da": "Data read from: ",
  "dafile": "file you chose",
  "fonte_no": "Address not accepted: data are read only from the METIS Italia site. Download the file and drop it here.",
  "carica_no": "I cannot read the election data. It may not be closed yet, or may have fewer than 5 ballots (in that case, to protect the secrecy of the vote, the ballots are not published).",
  "formato_no": "The file is not a METIS Italia ballot box file.",
  "votazione": "Election",
  "chiusura": "Closed on",
  "schede": "Ballots in the box",
  "corso": "Checking...",
  "v_ok": "All in order: the election has not been changed after closing.",
  "v_ko": "Warning: something does not add up. The data of this election appear to have been changed.",
  "v_att": "The ballots are in order, but the comparison with the copy saved at closing is not possible yet.",
  "c1_t": "What this page checked",
  "c1": "Your device read all the anonymous ballots of the election, checked their signatures one by one, recounted them and compared everything with the copy that METIS Italia saved on GitHub at closing, a public archive that nobody can change any more, not even us.",
  "c2_t": "What we found",
  "r_fir_ok": "All %d ballots have a valid signature: no choice and no name has been changed after the vote.",
  "r_fir_ko": "%d ballots out of %d do NOT have a valid signature: choices or names appear to have been changed after the vote.",
  "r_fir_v1": "This election was created before 21/11/2026: the ballots have no signature on the choices, so this check is not available.",
  "r_cont_ok": "Recounting the ballots gives exactly the published results.",
  "r_cont_ko": "Recounting the ballots does NOT give the published results.",
  "r_sig_ok": "The candidate list is identical to the one people voted on.",
  "r_sig_ko": "The candidate list is NOT identical to the one people voted on.",
  "r_chiu_ok": "Ballots, candidates and key are identical to the copy saved on GitHub at closing.",
  "r_chiu_ko": "The data are NOT identical to the copy saved on GitHub at closing. Different: %s.",
  "r_chiu_manca": "The copy saved at closing is not on GitHub yet: it usually arrives within 10 minutes of closing.",
  "r_reg_vuoto": "There are no copies on GitHub for this election (elections closed before 21/11/2026).",
  "r_reg_err": "GitHub is not answering right now: the comparison with the saved copy was not possible.",
  "r_int_ok": "During the vote the number of ballots was saved %d times: no ballot has disappeared.",
  "r_int_ko": "During the vote %d ballots had already been saved, but now the box contains %d: ballots are missing.",
  "r_chiave_ok": "The signing key is the same for all voters. You can compare it with the one next to your receipt: %s",
  "r_chiave_ko": "The signing key does NOT match the one stated in the file.",
  "r_imp_ko": "The summary of the ballots does NOT match the one stated in the file.",
  "d_schede": "number of ballots",
  "d_urna": "summary of the ballots",
  "d_file": "ballot box file",
  "d_sig": "candidate list",
  "d_chiave": "signing key",
  "c3_t": "What to do",
  "c3_ko": "Keep this page (a screenshot is fine) and tell the election organiser and METIS Italia support straight away.",
  "c3_att": "Try again later: the comparison with the saved copy will be possible as soon as it is available.",
  "c4_t": "The recount, candidate by candidate",
  "cand": "Candidate",
  "pubb": "Published results",
  "contati": "Recounted here",
  "vot": "Ballots counted: %d of %d online voters (any difference is votes started but not completed).",
  "c5_t": "Details of the codes",
  "c5": "They are the summaries used for the comparison. You do not need to understand them: they prove that nothing has changed.",
  "n_urna": "Summary of the ballots",
  "n_sig": "Summary of the candidate list",
  "n_chiave": "Signing key",
  "tec_urna": "ballot box fingerprint",
  "tec_sig": "list seal",
  "tec_chiave": "key fingerprint",
  "x_urna": "Sums up all the ballots in a single code. If even one vote changed, the code would be different.",
  "x_sig": "Sums up the candidates' names. If someone changed a name after the vote, the code would be different.",
  "x_chiave": "Identifies the key used to sign the ballots, the same for every voter.",
  "es_ok": "Identical to the original",
  "es_ko": "Different from the original",
  "es_att": "To be checked",
  "orig": "Value saved at closing",
  "reg_vedi": "See the copies saved on GitHub",
  "c6_t": "How this page works",
  "come": "This page and the program doing the calculations are public on GitHub (docs folder of the metisitalia-nucleo-voto repository) and every change stays in the history. The program checking the signatures must be identical to the one used for voting: its code below must match the one published in the IMPRONTE.md file.",
  "impjs": "Code of the program used here:"
 },
 "es": {
  "titolo": "Verificación independiente de la votación",
  "sotto": "METIS Italia · página publicada en GitHub, fuera de nuestro sitio",
  "spiega": "Esta página comprueba, en tu dispositivo y sin pasar por el sitio de METIS Italia, que una votación cerrada no se ha modificado.",
  "lingua": "Idioma",
  "zona": "Arrastra aquí el archivo de la urna (lo descargas con «Descargar la urna» en la página de resultados) o toca aquí para elegirlo.",
  "da": "Datos leídos de: ",
  "dafile": "archivo elegido por ti",
  "fonte_no": "Dirección no aceptada: los datos se leen solo del sitio de METIS Italia. Descarga el archivo y arrástralo aquí.",
  "carica_no": "No puedo leer los datos de la votación. Puede que aún no esté cerrada o que tenga menos de 5 papeletas (en ese caso, para proteger el secreto del voto, las papeletas no se publican).",
  "formato_no": "El archivo no es un archivo de urna de METIS Italia.",
  "votazione": "Votación",
  "chiusura": "Cerrada el",
  "schede": "Papeletas en la urna",
  "corso": "Comprobando...",
  "v_ok": "Todo en orden: la votación no se ha modificado después del cierre.",
  "v_ko": "Atención: algo no cuadra. Los datos de esta votación parecen modificados.",
  "v_att": "Las papeletas están en orden, pero la comparación con la copia guardada al cierre aún no es posible.",
  "c1_t": "Qué ha comprobado esta página",
  "c1": "Tu dispositivo ha leído todas las papeletas anónimas de la votación, ha comprobado sus firmas una por una, las ha vuelto a contar y lo ha comparado todo con la copia que METIS Italia guardó en GitHub al cierre, un archivo público que ya nadie puede modificar, ni siquiera nosotros.",
  "c2_t": "Qué ha resultado",
  "r_fir_ok": "Las %d papeletas tienen una firma válida: ninguna elección ni ningún nombre se han cambiado después del voto.",
  "r_fir_ko": "%d papeletas de %d NO tienen una firma válida: las elecciones o los nombres parecen cambiados después del voto.",
  "r_fir_v1": "Esta votación se creó antes del 21/11/2026: las papeletas no tienen la firma sobre las elecciones, así que este control no está disponible.",
  "r_cont_ok": "Al volver a contar las papeletas se obtienen exactamente los resultados publicados.",
  "r_cont_ko": "Al volver a contar las papeletas NO se obtienen los resultados publicados.",
  "r_sig_ok": "La lista de candidatos es idéntica a aquella sobre la que se votó.",
  "r_sig_ko": "La lista de candidatos NO es idéntica a aquella sobre la que se votó.",
  "r_chiu_ok": "Papeletas, candidatos y clave son idénticos a la copia guardada en GitHub al cierre.",
  "r_chiu_ko": "Los datos NO son idénticos a la copia guardada en GitHub al cierre. Distintos: %s.",
  "r_chiu_manca": "La copia guardada al cierre aún no está en GitHub: suele llegar en los 10 minutos siguientes al cierre.",
  "r_reg_vuoto": "Para esta votación no hay copias en GitHub (votaciones cerradas antes del 21/11/2026).",
  "r_reg_err": "GitHub no responde en este momento: no ha sido posible la comparación con la copia guardada.",
  "r_int_ok": "Durante la votación el número de papeletas se guardó %d veces: no ha desaparecido ninguna papeleta.",
  "r_int_ko": "Durante la votación ya se habían guardado %d papeletas, pero ahora en la urna hay %d: faltan papeletas.",
  "r_chiave_ok": "La clave de las firmas es la misma para todos los votantes. Puedes compararla con la que aparece junto a tu recibo: %s",
  "r_chiave_ko": "La clave de las firmas NO corresponde a la indicada en el archivo.",
  "r_imp_ko": "El resumen de las papeletas NO corresponde al indicado en el archivo.",
  "d_schede": "número de papeletas",
  "d_urna": "resumen de las papeletas",
  "d_file": "archivo de la urna",
  "d_sig": "lista de candidatos",
  "d_chiave": "clave de las firmas",
  "c3_t": "Qué hacer",
  "c3_ko": "Conserva esta página (también con una captura de pantalla) y avisa enseguida al organizador de la votación y al soporte de METIS Italia.",
  "c3_att": "Vuelve a intentarlo más tarde: la comparación con la copia guardada será posible en cuanto esté disponible.",
  "c4_t": "El recuento, candidato por candidato",
  "cand": "Candidato",
  "pubb": "Resultados publicados",
  "contati": "Recontados aquí",
  "vot": "Papeletas contadas: %d de %d votantes en línea (la posible diferencia son votos iniciados pero no completados).",
  "c5_t": "Detalle de los códigos",
  "c5": "Son los resúmenes usados para la comparación. No hace falta entenderlos: sirven para demostrar que nada ha cambiado.",
  "n_urna": "Resumen de las papeletas",
  "n_sig": "Resumen de la lista de candidatos",
  "n_chiave": "Clave de las firmas",
  "tec_urna": "huella de la urna",
  "tec_sig": "sello de la lista",
  "tec_chiave": "huella de la clave",
  "x_urna": "Resume todas las papeletas en un único código. Si cambiara un solo voto, el código sería distinto.",
  "x_sig": "Resume los nombres de los candidatos. Si alguien cambiara un nombre después del voto, el código sería distinto.",
  "x_chiave": "Identifica la clave con la que se firmaron las papeletas, la misma para todos los votantes.",
  "es_ok": "Idéntico al original",
  "es_ko": "Distinto del original",
  "es_att": "Por comprobar",
  "orig": "Valor guardado al cierre",
  "reg_vedi": "Ver las copias guardadas en GitHub",
  "c6_t": "Cómo funciona esta página",
  "come": "Esta página y el programa que hace los cálculos son públicos en GitHub (carpeta docs del repositorio metisitalia-nucleo-voto) y cada cambio queda en el historial. El programa que comprueba las firmas debe ser idéntico al usado para votar: su código de abajo debe coincidir con el publicado en el archivo IMPRONTE.md.",
  "impjs": "Código del programa usado aquí:"
 },
 "de": {
  "titolo": "Unabhängige Prüfung der Abstimmung",
  "sotto": "METIS Italia · Seite auf GitHub veröffentlicht, außerhalb unserer Website",
  "spiega": "Diese Seite prüft auf Ihrem Gerät und ohne Umweg über die Website von METIS Italia, dass eine beendete Abstimmung nicht verändert wurde.",
  "lingua": "Sprache",
  "zona": "Ziehen Sie die Datei der Wahlurne hierher (Sie laden sie mit „Wahlurne herunterladen“ auf der Ergebnisseite herunter) oder tippen Sie hier, um sie auszuwählen.",
  "da": "Daten gelesen von: ",
  "dafile": "von Ihnen gewählte Datei",
  "fonte_no": "Adresse nicht akzeptiert: Die Daten werden nur von der Website von METIS Italia gelesen. Laden Sie die Datei herunter und ziehen Sie sie hierher.",
  "carica_no": "Die Daten der Abstimmung können nicht gelesen werden. Sie ist vielleicht noch nicht beendet oder hat weniger als 5 Stimmzettel (dann werden die Stimmzettel zum Schutz des Wahlgeheimnisses nicht veröffentlicht).",
  "formato_no": "Die Datei ist keine Wahlurnen-Datei von METIS Italia.",
  "votazione": "Abstimmung",
  "chiusura": "Beendet am",
  "schede": "Stimmzettel in der Wahlurne",
  "corso": "Prüfung läuft...",
  "v_ok": "Alles in Ordnung: Die Abstimmung wurde nach dem Ende nicht verändert.",
  "v_ko": "Achtung: Etwas stimmt nicht. Die Daten dieser Abstimmung scheinen verändert worden zu sein.",
  "v_att": "Die Stimmzettel sind in Ordnung, aber der Vergleich mit der beim Ende gespeicherten Kopie ist noch nicht möglich.",
  "c1_t": "Was diese Seite geprüft hat",
  "c1": "Ihr Gerät hat alle anonymen Stimmzettel der Abstimmung gelesen, ihre Signaturen einzeln geprüft, sie nachgezählt und alles mit der Kopie verglichen, die METIS Italia beim Ende auf GitHub gespeichert hat, einem öffentlichen Archiv, das niemand mehr ändern kann, auch wir nicht.",
  "c2_t": "Was sich ergeben hat",
  "r_fir_ok": "Alle %d Stimmzettel haben eine gültige Signatur: Keine Auswahl und kein Name wurde nach der Abstimmung geändert.",
  "r_fir_ko": "%d von %d Stimmzetteln haben KEINE gültige Signatur: Auswahl oder Namen wurden offenbar nach der Abstimmung geändert.",
  "r_fir_v1": "Diese Abstimmung wurde vor dem 21.11.2026 erstellt: Die Stimmzettel haben keine Signatur über die Auswahl, diese Prüfung ist daher nicht verfügbar.",
  "r_cont_ok": "Die Nachzählung der Stimmzettel ergibt genau die veröffentlichten Ergebnisse.",
  "r_cont_ko": "Die Nachzählung der Stimmzettel ergibt NICHT die veröffentlichten Ergebnisse.",
  "r_sig_ok": "Die Kandidatenliste ist identisch mit der, über die abgestimmt wurde.",
  "r_sig_ko": "Die Kandidatenliste ist NICHT identisch mit der, über die abgestimmt wurde.",
  "r_chiu_ok": "Stimmzettel, Kandidaten und Schlüssel sind identisch mit der beim Ende auf GitHub gespeicherten Kopie.",
  "r_chiu_ko": "Die Daten sind NICHT identisch mit der beim Ende auf GitHub gespeicherten Kopie. Abweichend: %s.",
  "r_chiu_manca": "Die beim Ende gespeicherte Kopie ist noch nicht auf GitHub: Sie kommt meist innerhalb von 10 Minuten nach dem Ende.",
  "r_reg_vuoto": "Für diese Abstimmung gibt es keine Kopien auf GitHub (vor dem 21.11.2026 beendete Abstimmungen).",
  "r_reg_err": "GitHub antwortet gerade nicht: Der Vergleich mit der gespeicherten Kopie war nicht möglich.",
  "r_int_ok": "Während der Abstimmung wurde die Zahl der Stimmzettel %d-mal gespeichert: Kein Stimmzettel ist verschwunden.",
  "r_int_ko": "Während der Abstimmung waren bereits %d Stimmzettel gespeichert, jetzt sind aber %d in der Wahlurne: Es fehlen Stimmzettel.",
  "r_chiave_ok": "Der Signaturschlüssel ist für alle Wahlberechtigten derselbe. Sie können ihn mit dem neben Ihrem Beleg vergleichen: %s",
  "r_chiave_ko": "Der Signaturschlüssel stimmt NICHT mit dem in der Datei angegebenen überein.",
  "r_imp_ko": "Die Zusammenfassung der Stimmzettel stimmt NICHT mit der in der Datei angegebenen überein.",
  "d_schede": "Zahl der Stimmzettel",
  "d_urna": "Zusammenfassung der Stimmzettel",
  "d_file": "Datei der Wahlurne",
  "d_sig": "Kandidatenliste",
  "d_chiave": "Signaturschlüssel",
  "c3_t": "Was zu tun ist",
  "c3_ko": "Bewahren Sie diese Seite auf (auch als Bildschirmfoto) und informieren Sie sofort den Organisator der Abstimmung und den Support von METIS Italia.",
  "c3_att": "Versuchen Sie es später erneut: Der Vergleich mit der gespeicherten Kopie ist möglich, sobald sie verfügbar ist.",
  "c4_t": "Die Nachzählung, Kandidat für Kandidat",
  "cand": "Kandidat",
  "pubb": "Veröffentlichte Ergebnisse",
  "contati": "Hier nachgezählt",
  "vot": "Gezählte Stimmzettel: %d von %d Online-Wählern (eine eventuelle Differenz sind begonnene, aber nicht abgeschlossene Stimmen).",
  "c5_t": "Einzelheiten der Codes",
  "c5": "Es sind die für den Vergleich verwendeten Zusammenfassungen. Sie müssen sie nicht verstehen: Sie beweisen, dass sich nichts geändert hat.",
  "n_urna": "Zusammenfassung der Stimmzettel",
  "n_sig": "Zusammenfassung der Kandidatenliste",
  "n_chiave": "Signaturschlüssel",
  "tec_urna": "Fingerabdruck der Wahlurne",
  "tec_sig": "Siegel der Liste",
  "tec_chiave": "Fingerabdruck des Schlüssels",
  "x_urna": "Fasst alle Stimmzettel in einem einzigen Code zusammen. Würde sich auch nur eine Stimme ändern, wäre der Code anders.",
  "x_sig": "Fasst die Namen der Kandidaten zusammen. Würde jemand nach der Abstimmung einen Namen ändern, wäre der Code anders.",
  "x_chiave": "Kennzeichnet den Schlüssel, mit dem die Stimmzettel signiert wurden, für alle Wahlberechtigten derselbe.",
  "es_ok": "Identisch mit dem Original",
  "es_ko": "Anders als das Original",
  "es_att": "Zu prüfen",
  "orig": "Beim Ende gespeicherter Wert",
  "reg_vedi": "Die auf GitHub gespeicherten Kopien ansehen",
  "c6_t": "Wie diese Seite funktioniert",
  "come": "Diese Seite und das Programm, das die Berechnungen durchführt, sind auf GitHub öffentlich (Ordner docs des Repositorys metisitalia-nucleo-voto) und jede Änderung bleibt in der Historie. Das Programm, das die Signaturen prüft, muss mit dem für die Abstimmung verwendeten identisch sein: Sein Code unten muss mit dem in der Datei IMPRONTE.md veröffentlichten übereinstimmen.",
  "impjs": "Code des hier verwendeten Programms:"
 },
 "fr": {
  "titolo": "Vérification indépendante du vote",
  "sotto": "METIS Italia · page publiée sur GitHub, en dehors de notre site",
  "spiega": "Cette page vérifie, sur votre appareil et sans passer par le site de METIS Italia, qu'un vote clos n'a pas été modifié.",
  "lingua": "Langue",
  "zona": "Déposez ici le fichier de l'urne (téléchargez-le avec « Télécharger l'urne » sur la page des résultats) ou touchez ici pour le choisir.",
  "da": "Données lues depuis : ",
  "dafile": "fichier choisi par vous",
  "fonte_no": "Adresse non acceptée : les données ne sont lues que sur le site de METIS Italia. Téléchargez le fichier et déposez-le ici.",
  "carica_no": "Impossible de lire les données du vote. Il n'est peut-être pas encore clos, ou compte moins de 5 bulletins (dans ce cas, pour protéger le secret du vote, les bulletins ne sont pas publiés).",
  "formato_no": "Le fichier n'est pas un fichier d'urne de METIS Italia.",
  "votazione": "Vote",
  "chiusura": "Clos le",
  "schede": "Bulletins dans l'urne",
  "corso": "Vérification en cours...",
  "v_ok": "Tout est en ordre : le vote n'a pas été modifié après la clôture.",
  "v_ko": "Attention : quelque chose ne va pas. Les données de ce vote semblent avoir été modifiées.",
  "v_att": "Les bulletins sont en ordre, mais la comparaison avec la copie enregistrée à la clôture n'est pas encore possible.",
  "c1_t": "Ce que cette page a vérifié",
  "c1": "Votre appareil a lu tous les bulletins anonymes du vote, a vérifié leurs signatures une par une, les a recomptés et a tout comparé avec la copie que METIS Italia a enregistrée sur GitHub à la clôture, une archive publique que plus personne ne peut modifier, pas même nous.",
  "c2_t": "Ce qui en ressort",
  "r_fir_ok": "Les %d bulletins ont une signature valable : aucun choix et aucun nom n'ont été modifiés après le vote.",
  "r_fir_ko": "%d bulletins sur %d N'ONT PAS de signature valable : les choix ou les noms semblent modifiés après le vote.",
  "r_fir_v1": "Ce vote a été créé avant le 21/11/2026 : les bulletins n'ont pas de signature sur les choix, ce contrôle n'est donc pas disponible.",
  "r_cont_ok": "En recomptant les bulletins, on obtient exactement les résultats publiés.",
  "r_cont_ko": "En recomptant les bulletins, on N'obtient PAS les résultats publiés.",
  "r_sig_ok": "La liste des candidats est identique à celle sur laquelle on a voté.",
  "r_sig_ko": "La liste des candidats N'est PAS identique à celle sur laquelle on a voté.",
  "r_chiu_ok": "Bulletins, candidats et clé sont identiques à la copie enregistrée sur GitHub à la clôture.",
  "r_chiu_ko": "Les données NE sont PAS identiques à la copie enregistrée sur GitHub à la clôture. Différents : %s.",
  "r_chiu_manca": "La copie enregistrée à la clôture n'est pas encore sur GitHub : elle arrive en général dans les 10 minutes suivant la clôture.",
  "r_reg_vuoto": "Il n'y a pas de copies sur GitHub pour ce vote (votes clos avant le 21/11/2026).",
  "r_reg_err": "GitHub ne répond pas pour le moment : la comparaison avec la copie enregistrée n'a pas été possible.",
  "r_int_ok": "Pendant le vote, le nombre de bulletins a été enregistré %d fois : aucun bulletin n'a disparu.",
  "r_int_ko": "Pendant le vote, %d bulletins avaient déjà été enregistrés, mais l'urne en contient maintenant %d : il manque des bulletins.",
  "r_chiave_ok": "La clé des signatures est la même pour tous les électeurs. Vous pouvez la comparer avec celle à côté de votre reçu : %s",
  "r_chiave_ko": "La clé des signatures NE correspond PAS à celle indiquée dans le fichier.",
  "r_imp_ko": "Le résumé des bulletins NE correspond PAS à celui indiqué dans le fichier.",
  "d_schede": "nombre de bulletins",
  "d_urna": "résumé des bulletins",
  "d_file": "fichier de l'urne",
  "d_sig": "liste des candidats",
  "d_chiave": "clé des signatures",
  "c3_t": "Que faire",
  "c3_ko": "Conservez cette page (une capture d'écran suffit) et prévenez tout de suite l'organisateur du vote et l'assistance de METIS Italia.",
  "c3_att": "Réessayez plus tard : la comparaison avec la copie enregistrée sera possible dès qu'elle sera disponible.",
  "c4_t": "Le recomptage, candidat par candidat",
  "cand": "Candidat",
  "pubb": "Résultats publiés",
  "contati": "Recomptés ici",
  "vot": "Bulletins comptés : %d sur %d votants en ligne (une éventuelle différence correspond à des votes commencés mais non terminés).",
  "c5_t": "Détail des codes",
  "c5": "Ce sont les résumés utilisés pour la comparaison. Inutile de les comprendre : ils prouvent que rien n'a changé.",
  "n_urna": "Résumé des bulletins",
  "n_sig": "Résumé de la liste des candidats",
  "n_chiave": "Clé des signatures",
  "tec_urna": "empreinte de l'urne",
  "tec_sig": "sceau de la liste",
  "tec_chiave": "empreinte de la clé",
  "x_urna": "Résume tous les bulletins en un seul code. Si un seul vote changeait, le code serait différent.",
  "x_sig": "Résume les noms des candidats. Si quelqu'un modifiait un nom après le vote, le code serait différent.",
  "x_chiave": "Identifie la clé avec laquelle les bulletins ont été signés, la même pour tous les électeurs.",
  "es_ok": "Identique à l'original",
  "es_ko": "Différent de l'original",
  "es_att": "À vérifier",
  "orig": "Valeur enregistrée à la clôture",
  "reg_vedi": "Voir les copies enregistrées sur GitHub",
  "c6_t": "Comment fonctionne cette page",
  "come": "Cette page et le programme qui fait les calculs sont publics sur GitHub (dossier docs du dépôt metisitalia-nucleo-voto) et chaque modification reste dans l'historique. Le programme qui vérifie les signatures doit être identique à celui utilisé pour voter : son code ci-dessous doit correspondre à celui publié dans le fichier IMPRONTE.md.",
  "impjs": "Code du programme utilisé ici :"
 }
};
    var lang = parametri.get('lang') || (navigator.language || 'it').slice(0, 2);
    if (!TX[lang]) { lang = 'en'; }
    var T = TX[lang];

    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (txt !== undefined) { e.textContent = txt; } return e; }
    function fmt(s) { var a = Array.prototype.slice.call(arguments, 1), i = 0; return String(s).replace(/%[ds]/g, function () { return String(a[i++]); }); }
    async function sha(testo) { return B.byteEsa(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo)))); }
    /* "2026-11-21 22:00:00" -> 21/11/2026 22:00 (in tedesco 21.11.2026 22:00) */
    function data(t) {
        var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(t || ''));
        if (!m) { return String(t || ''); }
        var sep = lang === 'de' ? '.' : '/';
        return m[3] + sep + m[2] + sep + m[1] + ' ' + m[4] + ':' + m[5];
    }
    var ICONE = { ok: '✔', ko: '✘', att: '⚠', info: '•' };

    function testi() {
        document.documentElement.lang = lang;
        ['titolo', 'sotto', 'spiega', 'lingua', 'zona', 'come', 'impjs', 'c6_t'].forEach(function (k) {
            var e = document.getElementById('t_' + k); if (e) { e.textContent = T[k]; }
        });
        document.title = 'METIS Italia - ' + T.titolo;
        document.getElementById('lingua').value = lang;
    }

    var out = document.getElementById('risultato');
    function messaggio(tipo, testo) {
        out.textContent = '';
        var b = el('div', 'box'), i = el('div', 'box_in');
        var v = el('div', 'verdetto v_' + tipo);
        v.appendChild(el('span', 'ic', ICONE[tipo] || ''));
        v.appendChild(el('span', '', testo));
        i.appendChild(v); b.appendChild(i); out.appendChild(b);
    }

    /* ---- registro pubblico su GitHub ---- */
    function campi(testo) {
        var o = {};
        String(testo).split('\n').forEach(function (r) { var i = r.indexOf(': '); if (i > 0) { o[r.slice(0, i)] = r.slice(i + 2).trim(); } });
        return o;
    }
    async function elencoRegistro(codice) {
        var reg = LOCALE ? parametri.get('reg') : null;
        var url = reg ? reg.replace(/\/$/, '') + '/' + codice + '/_elenco.json'
                      : 'https://api.github.com/repos/' + REPO + '/contents/' + codice;
        var r = await fetch(url, { credentials: 'omit', cache: 'no-store' });
        if (r.status === 404) { return []; }
        if (!r.ok) { throw new Error('registro'); }
        var l = await r.json();
        return Array.isArray(l) ? l.filter(function (f) { return /^[A-Za-z0-9._-]+\.txt$/.test(f.name || ''); }) : [];
    }
    /* esiti del registro: {stato: ok|ko|manca|vuoto|err, chiusura, diversi[], nInt, maxInt, url} */
    async function leggiRegistro(d, testoFile, nSchede, sig, impUrna) {
        var codice = (await sha('MI-AN05-REGISTRO|' + d.votazione)).slice(0, 24);
        var r0 = { url: 'https://github.com/' + REPO + '/tree/main/' + codice, nInt: 0, maxInt: 0, diversi: [], chiusura: null };
        var file;
        try { file = await elencoRegistro(codice); } catch (e) { r0.stato = 'err'; return r0; }
        if (!file.length) { r0.stato = 'vuoto'; return r0; }
        for (var i = 0; i < file.length; i++) {
            var r = await fetch(file[i].download_url, { credentials: 'omit', cache: 'no-store' });
            if (!r.ok) { continue; }
            var c = campi(await r.text());
            if (c.codice !== codice) { continue; }
            if (file[i].name === 'chiusura.txt') { r0.chiusura = c; } else { r0.nInt++; r0.maxInt = Math.max(r0.maxInt, parseInt(c.schede, 10) || 0); }
        }
        if (!r0.chiusura) { r0.stato = 'manca'; return r0; }
        var ch = r0.chiusura;
        if (parseInt(ch.schede, 10) !== nSchede) { r0.diversi.push(T.d_schede); }
        if (ch.impronta_urna !== impUrna) { r0.diversi.push(T.d_urna); }
        if (ch.impronta_file_urna !== await sha(testoFile)) { r0.diversi.push(T.d_file); }
        if (ch.sigillo_lista !== sig) { r0.diversi.push(T.d_sig); }
        if (ch.impronta_chiave !== d.impronta_chiave) { r0.diversi.push(T.d_chiave); }
        r0.stato = r0.diversi.length ? 'ko' : 'ok';
        return r0;
    }

    /* ---- verifica del file dell'urna ---- */
    async function verifica(testoFile, fonte) {
        document.getElementById('origine').textContent = T.da + fonte;
        var d;
        try { d = JSON.parse(testoFile); } catch (e) { d = null; }
        if (!d || d.formato !== 'MI-URNA-DATI-1' || !Array.isArray(d.schede) || !Array.isArray(d.candidati) || !d.chiave) {
            messaggio('ko', T.formato_no); return;
        }
        messaggio('corso', T.corso);
        var righe = [];             // [tipo, testo]

        // 1. firme di tutte le schede
        var sig = await B.sigillo(d.votazione, d.candidati);
        var nomi = {};
        d.candidati.forEach(function (c) { nomi[String(c[0])] = String(c[1]); });
        if (d.firma_v === 2) {
            var chiave = B.chiave(d.chiave), cattive = 0;
            for (var i = 0; i < d.schede.length; i++) {
                var s = d.schede[i], ids = (s.ids || []).map(String);
                var attesi = ids.map(function (x) { return nomi[x]; }).filter(function (x) { return x !== undefined; });
                var ok = attesi.slice().sort().join('\n') === (s.scelte || []).slice().sort().join('\n')
                    && await B.verificaScheda(String(s.p || ''), String(s.s || ''), d.votazione, sig, ids, chiave);
                if (!ok) { cattive++; }
            }
            righe.push(cattive === 0 ? ['ok', fmt(T.r_fir_ok, d.schede.length)] : ['ko', fmt(T.r_fir_ko, cattive, d.schede.length)]);
        } else {
            righe.push(['info', T.r_fir_v1]);
        }

        // 2. riconteggio
        var conta = {}, attesiR = {}, elenco = [];
        (d.risultati || []).forEach(function (r) { if (!(r[0] in attesiR)) { attesiR[r[0]] = 0; elenco.push(r[0]); } attesiR[r[0]] += parseInt(r[1], 10) || 0; });
        d.schede.forEach(function (s) { (s.scelte || []).forEach(function (n) { conta[n] = (conta[n] || 0) + 1; if (!(n in attesiR)) { attesiR[n] = 0; elenco.push(n); } }); });
        var contOk = elenco.every(function (n) { return (conta[n] || 0) === attesiR[n]; });
        righe.push(contOk ? ['ok', T.r_cont_ok] : ['ko', T.r_cont_ko]);

        // 3. elenco dei candidati (sigillo)
        righe.push(sig === d.sigillo ? ['ok', T.r_sig_ok] : ['ko', T.r_sig_ko]);

        // 4. impronte dell'urna e della chiave rispetto al file
        var impUrna = await sha('MI-URNA-v1|' + d.votazione + '|' + JSON.stringify(d.schede.map(function (s) { return s.scelte || []; })));
        if (impUrna !== d.impronta_urna) { righe.push(['ko', T.r_imp_ko]); }
        var impChiave = await B.impronta(d.chiave);

        // 5. copie salvate su GitHub
        var reg = await leggiRegistro(d, testoFile, d.schede.length, sig, impUrna);
        if (reg.nInt) {
            righe.push(reg.maxInt <= d.schede.length ? ['ok', fmt(T.r_int_ok, reg.nInt)] : ['ko', fmt(T.r_int_ko, reg.maxInt, d.schede.length)]);
        }
        righe.push({ ok: ['ok', T.r_chiu_ok], ko: ['ko', fmt(T.r_chiu_ko, reg.diversi.join(', '))], manca: ['att', T.r_chiu_manca],
                     vuoto: ['att', T.r_reg_vuoto], err: ['att', T.r_reg_err] }[reg.stato]);
        righe.push(impChiave === d.impronta_chiave ? ['ok', fmt(T.r_chiave_ok, impChiave)] : ['ko', T.r_chiave_ko]);

        // verdetto
        var ko = righe.some(function (r) { return r[0] === 'ko'; });
        var att = !ko && righe.some(function (r) { return r[0] === 'att'; });
        var tipo = ko ? 'ko' : (att ? 'att' : 'ok');
        disegna(d, tipo, righe, elenco, attesiR, conta, reg, { urna: impUrna, sigillo: sig, chiave: impChiave });
    }

    function disegna(d, tipo, righe, elenco, attesiR, conta, reg, cod) {
        out.textContent = '';
        var box = el('div', 'box');
        var testa = el('div', 'testa');
        testa.appendChild(el('div', 'etichetta', T.titolo));
        testa.appendChild(el('h2', '', d.titolo || d.votazione));
        testa.appendChild(el('div', 'sotto', T.chiusura + ' ' + data(d.chiusura) + ' · ' + T.schede + ': ' + d.schede.length));
        box.appendChild(testa);
        var ib = el('div', 'box_in');
        box.appendChild(ib);
        out.appendChild(box);

        // verdetto
        var v = el('div', 'verdetto v_' + tipo);
        v.appendChild(el('span', 'ic', tipo === 'ko' ? '✘ ⚠' : ICONE[tipo]));
        v.appendChild(el('span', '', T['v_' + tipo]));
        ib.appendChild(v);

        // cosa ha controllato
        ib.appendChild(el('div', 'sez', T.c1_t));
        ib.appendChild(el('p', '', T.c1));

        // cosa e' risultato
        ib.appendChild(el('div', 'sez', T.c2_t));
        var ul = el('ul', 'righe');
        righe.forEach(function (r) {
            var li = el('li', 'r_' + r[0]);
            li.appendChild(el('span', 'ic', ICONE[r[0]]));
            li.appendChild(el('span', '', r[1]));
            ul.appendChild(li);
        });
        ib.appendChild(ul);

        // cosa fare
        if (tipo !== 'ok') {
            ib.appendChild(el('div', 'sez', T.c3_t));
            ib.appendChild(el('p', '', tipo === 'ko' ? T.c3_ko : T.c3_att));
        }

        // riconteggio
        ib.appendChild(el('div', 'sez', T.c4_t));
        var tab = el('table'), th = el('tr');
        th.appendChild(el('th', '', T.cand)); th.appendChild(el('th', 'n', T.pubb)); th.appendChild(el('th', 'n', T.contati));
        tab.appendChild(th);
        elenco.forEach(function (n) {
            var tr = el('tr');
            tr.appendChild(el('td', '', n));
            tr.appendChild(el('td', 'n', String(attesiR[n])));
            tr.appendChild(el('td', 'n', String(conta[n] || 0)));
            tab.appendChild(tr);
        });
        ib.appendChild(tab);
        ib.appendChild(el('p', 'piccolo', fmt(T.vot, d.schede.length, d.votanti_online)));

        // dettaglio dei codici, confrontati con la copia salvata alla chiusura
        ib.appendChild(el('div', 'sez', T.c5_t));
        ib.appendChild(el('p', 'piccolo', T.c5));
        var ch = reg.chiusura;
        [['urna', cod.urna, ch && ch.impronta_urna], ['sig', cod.sigillo, ch && ch.sigillo_lista], ['chiave', cod.chiave, ch && ch.impronta_chiave]]
            .forEach(function (x) {
                var es = !ch ? 'att' : (String(x[1]).toLowerCase() === String(x[2] || '').toLowerCase() ? 'ok' : 'ko');
                var c = el('div', 'codice');
                var nome = el('div');
                nome.appendChild(el('b', '', T['n_' + x[0]]));
                nome.appendChild(document.createTextNode(' '));
                nome.appendChild(el('span', 'tec', '(' + T['tec_' + x[0]] + ')'));
                c.appendChild(nome);
                c.appendChild(el('span', 'pill p_' + es, (es === 'ok' ? '✔ ' + T.es_ok : (es === 'ko' ? '✘ ' + T.es_ko : '⚠ ' + T.es_att))));
                c.appendChild(el('div', 'valore' + (es === 'ok' ? ' val_ok' : (es === 'ko' ? ' val_ko' : '')), x[1]));
                if (es === 'ko') { c.appendChild(el('div', 'orig', T.orig + ': ' + (x[2] || '-'))); }
                c.appendChild(el('div', 'spieg', T['x_' + x[0]]));
                ib.appendChild(c);
            });
        var p = el('p');
        var a = el('a', 'btn', T.reg_vedi + ' ›');
        a.href = reg.url; a.target = '_blank'; a.rel = 'noopener';
        p.appendChild(a);
        ib.appendChild(p);
    }

    /* ---- ingressi: file trascinato o scelto, indirizzo dopo il # ---- */
    function fonteAmmessa(url) {
        try {
            var u = new URL(url);
            if (u.protocol === 'https:' && /^(www\.)?metisitalia\.it$/.test(u.hostname) && u.pathname === '/AN05_urna_dati.php') { return true; }
            return LOCALE && /^(127\.0\.0\.1|localhost)$/.test(u.hostname) && /\/AN05_urna_dati\.php$/.test(u.pathname);
        } catch (e) { return false; }
    }
    async function daIndirizzo(url) {
        if (!fonteAmmessa(url)) { messaggio('ko', T.fonte_no); return; }
        try {
            var r = await fetch(url, { credentials: 'omit', cache: 'no-store' });
            if (!r.ok) { throw new Error(String(r.status)); }
            await verifica(await r.text(), url);
        } catch (e) { messaggio('att', T.carica_no); }
    }
    function daFile(f) {
        var lettore = new FileReader();
        lettore.onload = function () { verifica(String(lettore.result), T.dafile + ' (' + f.name + ')'); };
        lettore.readAsText(f);
    }

    var zona = document.getElementById('zona'), input = document.getElementById('file');
    zona.addEventListener('click', function () { input.click(); });
    zona.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { if (input.files[0]) { daFile(input.files[0]); } });
    zona.addEventListener('dragover', function (e) { e.preventDefault(); zona.classList.add('sopra'); });
    zona.addEventListener('dragleave', function () { zona.classList.remove('sopra'); });
    zona.addEventListener('drop', function (e) { e.preventDefault(); zona.classList.remove('sopra'); if (e.dataTransfer.files[0]) { daFile(e.dataTransfer.files[0]); } });
    document.getElementById('lingua').addEventListener('change', function () {
        lang = this.value; T = TX[lang]; testi();
        if (location.hash.length > 1) { daIndirizzo(decodeURIComponent(location.hash.slice(1))); }
    });

    testi();
    fetch('AN05_blind.js', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(sha)
        .then(function (h) { document.getElementById('impjs').textContent = h; }).catch(function () { /* niente */ });
    if (location.hash.length > 1) { daIndirizzo(decodeURIComponent(location.hash.slice(1))); }
}());
