/**
 * =============================================================================
 * docs/verifica.js - logica della VERIFICA INDIPENDENTE di un'urna (GitHub Pages)
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
 * Controlli, ognuno con esito si/no:
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
        it: { titolo: 'Verifica indipendente dell\'urna', sotto: 'METIS Italia · pagina pubblicata su GitHub, fuori dal nostro server',
            spiega: 'Questa pagina riconta l\'urna di una votazione chiusa e controlla le firme di tutte le schede. Il calcolo lo fa il tuo browser con un programma che non sta sul server di METIS: puoi leggerne il codice su GitHub.',
            lingua: 'Lingua', zona: 'Trascina qui il file dell\'urna (lo scarichi con «Scarica l\'urna» nella pagina dei risultati) oppure tocca per sceglierlo.',
            da: 'Dati letti da: ', dafile: 'file scelto da te', fonte_no: 'Indirizzo non accettato: i dati si leggono solo dal sito di METIS Italia. Scarica il file e trascinalo qui.',
            carica_no: 'Non riesco a leggere i dati dell\'urna. La votazione potrebbe non essere ancora chiusa, oppure avere meno di 5 schede.', formato_no: 'Il file non è un file dell\'urna di METIS Italia.',
            votazione: 'Votazione', chiusura: 'Chiusura', schede: 'Schede nell\'urna',
            sig_si: 'Sigillo della lista dei candidati ricalcolato: coincide.', sig_no: 'Sigillo della lista dei candidati ricalcolato: NON coincide.',
            fir_si: 'Firme verificate: tutte le %d schede hanno una firma valida su scelte e lista dei candidati.', fir_no: 'ATTENZIONE: %d schede su %d NON hanno una firma valida.',
            fir_v1: 'Votazione creata prima del 21/11/2026: le schede non hanno la firma sulle scelte.',
            cont_si: 'Riconteggio: coincide con i risultati pubblicati.', cont_no: 'Riconteggio: NON coincide con i risultati pubblicati.',
            cand: 'Candidato', pubb: 'Risultati', contati: 'Ricontati qui',
            vot: 'Schede contate: %d su %d votanti online (la differenza sono voti non completati).',
            imp_si: 'Impronta dell\'urna ricalcolata: coincide.', imp_no: 'Impronta dell\'urna ricalcolata: NON coincide.',
            chi_si: 'Impronta della chiave ricalcolata: coincide (confrontala con quella accanto alla tua ricevuta).', chi_no: 'Impronta della chiave ricalcolata: NON coincide.',
            reg_t: 'Registro pubblico su GitHub', reg_cerca: 'Leggo i timbri del registro...', reg_vuoto: 'Nessun timbro nel registro per questa votazione (votazioni chiuse prima del 21/11/2026 o registro non ancora attivo).',
            reg_err: 'Il registro su GitHub non risponde in questo momento: riprova più tardi.',
            reg_chiu_si: 'Timbro di chiusura: schede, impronta dell\'urna, impronta del file, sigillo e chiave coincidono con questo file.',
            reg_chiu_no: 'ATTENZIONE: il timbro di chiusura NON coincide con questo file (%s). L\'urna è stata cambiata dopo la chiusura, oppure il file non è quello originale.',
            reg_chiu_manca: 'Il timbro di chiusura non è ancora nel registro (arriva entro una decina di minuti dalla chiusura).',
            reg_int_si: 'Timbri durante il voto: %d, nessuno con più schede dell\'urna finale.',
            reg_int_no: 'ATTENZIONE: durante il voto erano già state timbrate %d schede, ma nell\'urna finale ce ne sono %d. Mancano schede.',
            reg_vedi: 'Vedi il registro su GitHub', come: 'Il codice di questa pagina è pubblico (cartella docs dell\'archivio metisitalia-nucleo-voto) e ogni sua modifica resta nello storico di GitHub. Il file AN05_blind.js che fa i calcoli deve avere la stessa impronta del nucleo del voto pubblicata in IMPRONTE.md:',
            impjs: 'Impronta di AN05_blind.js usato qui:', diversi: 'campi diversi: ' },
        en: { titolo: 'Independent ballot box check', sotto: 'METIS Italia · page published on GitHub, outside our server',
            spiega: 'This page recounts the ballot box of a closed election and checks the signatures of all ballots. The calculation is done by your browser with a program that is not on the METIS server: you can read its code on GitHub.',
            lingua: 'Language', zona: 'Drop the ballot box file here (download it with «Download the ballot box» on the results page) or tap to choose it.',
            da: 'Data read from: ', dafile: 'file you chose', fonte_no: 'Address not accepted: data are read only from the METIS Italia site. Download the file and drop it here.',
            carica_no: 'I cannot read the ballot box data. The election may not be closed yet, or may have fewer than 5 ballots.', formato_no: 'The file is not a METIS Italia ballot box file.',
            votazione: 'Election', chiusura: 'Closing', schede: 'Ballots in the box',
            sig_si: 'Candidate list seal recalculated: it matches.', sig_no: 'Candidate list seal recalculated: it does NOT match.',
            fir_si: 'Signatures checked: all %d ballots have a valid signature on choices and candidate list.', fir_no: 'WARNING: %d ballots out of %d do NOT have a valid signature.',
            fir_v1: 'Election created before 21/11/2026: ballots have no signature on the choices.',
            cont_si: 'Recount: it matches the published results.', cont_no: 'Recount: it does NOT match the published results.',
            cand: 'Candidate', pubb: 'Results', contati: 'Recounted here',
            vot: 'Ballots counted: %d of %d online voters (the difference are incomplete votes).',
            imp_si: 'Ballot box fingerprint recalculated: it matches.', imp_no: 'Ballot box fingerprint recalculated: it does NOT match.',
            chi_si: 'Key fingerprint recalculated: it matches (compare it with the one next to your receipt).', chi_no: 'Key fingerprint recalculated: it does NOT match.',
            reg_t: 'Public register on GitHub', reg_cerca: 'Reading the register stamps...', reg_vuoto: 'No stamp in the register for this election (elections closed before 21/11/2026 or register not active yet).',
            reg_err: 'The register on GitHub is not answering right now: try again later.',
            reg_chiu_si: 'Closing stamp: ballots, ballot box fingerprint, file fingerprint, seal and key match this file.',
            reg_chiu_no: 'WARNING: the closing stamp does NOT match this file (%s). The ballot box was changed after closing, or the file is not the original one.',
            reg_chiu_manca: 'The closing stamp is not in the register yet (it arrives within about ten minutes of closing).',
            reg_int_si: 'Stamps during the vote: %d, none with more ballots than the final box.',
            reg_int_no: 'WARNING: during the vote %d ballots had already been stamped, but the final box has %d. Ballots are missing.',
            reg_vedi: 'See the register on GitHub', come: 'The code of this page is public (docs folder of the metisitalia-nucleo-voto repository) and every change stays in the GitHub history. The AN05_blind.js file doing the calculations must have the same fingerprint as the voting core published in IMPRONTE.md:',
            impjs: 'Fingerprint of the AN05_blind.js used here:', diversi: 'different fields: ' },
        es: { titolo: 'Verificación independiente de la urna', sotto: 'METIS Italia · página publicada en GitHub, fuera de nuestro servidor',
            spiega: 'Esta página vuelve a contar la urna de una votación cerrada y comprueba las firmas de todas las papeletas. El cálculo lo hace tu navegador con un programa que no está en el servidor de METIS: puedes leer su código en GitHub.',
            lingua: 'Idioma', zona: 'Arrastra aquí el archivo de la urna (lo descargas con «Descargar la urna» en la página de resultados) o toca para elegirlo.',
            da: 'Datos leídos de: ', dafile: 'archivo elegido por ti', fonte_no: 'Dirección no aceptada: los datos se leen solo del sitio de METIS Italia. Descarga el archivo y arrástralo aquí.',
            carica_no: 'No puedo leer los datos de la urna. Puede que la votación aún no esté cerrada o que tenga menos de 5 papeletas.', formato_no: 'El archivo no es un archivo de urna de METIS Italia.',
            votazione: 'Votación', chiusura: 'Cierre', schede: 'Papeletas en la urna',
            sig_si: 'Sello de la lista de candidatos recalculado: coincide.', sig_no: 'Sello de la lista de candidatos recalculado: NO coincide.',
            fir_si: 'Firmas verificadas: las %d papeletas tienen una firma válida sobre las elecciones y la lista de candidatos.', fir_no: 'ATENCIÓN: %d papeletas de %d NO tienen una firma válida.',
            fir_v1: 'Votación creada antes del 21/11/2026: las papeletas no tienen la firma sobre las elecciones.',
            cont_si: 'Recuento: coincide con los resultados publicados.', cont_no: 'Recuento: NO coincide con los resultados publicados.',
            cand: 'Candidato', pubb: 'Resultados', contati: 'Recontados aquí',
            vot: 'Papeletas contadas: %d de %d votantes en línea (la diferencia son votos no completados).',
            imp_si: 'Huella de la urna recalculada: coincide.', imp_no: 'Huella de la urna recalculada: NO coincide.',
            chi_si: 'Huella de la clave recalculada: coincide (compárala con la que está junto a tu recibo).', chi_no: 'Huella de la clave recalculada: NO coincide.',
            reg_t: 'Registro público en GitHub', reg_cerca: 'Leyendo los sellos del registro...', reg_vuoto: 'Ningún sello en el registro para esta votación (votaciones cerradas antes del 21/11/2026 o registro aún no activo).',
            reg_err: 'El registro en GitHub no responde en este momento: inténtalo más tarde.',
            reg_chiu_si: 'Sello de cierre: papeletas, huella de la urna, huella del archivo, sello y clave coinciden con este archivo.',
            reg_chiu_no: 'ATENCIÓN: el sello de cierre NO coincide con este archivo (%s). La urna se cambió después del cierre o el archivo no es el original.',
            reg_chiu_manca: 'El sello de cierre aún no está en el registro (llega unos diez minutos después del cierre).',
            reg_int_si: 'Sellos durante la votación: %d, ninguno con más papeletas que la urna final.',
            reg_int_no: 'ATENCIÓN: durante la votación ya se habían sellado %d papeletas, pero en la urna final hay %d. Faltan papeletas.',
            reg_vedi: 'Ver el registro en GitHub', come: 'El código de esta página es público (carpeta docs del repositorio metisitalia-nucleo-voto) y cada cambio queda en el historial de GitHub. El archivo AN05_blind.js que hace los cálculos debe tener la misma huella que el núcleo del voto publicado en IMPRONTE.md:',
            impjs: 'Huella del AN05_blind.js usado aquí:', diversi: 'campos distintos: ' },
        de: { titolo: 'Unabhängige Prüfung der Wahlurne', sotto: 'METIS Italia · Seite auf GitHub veröffentlicht, außerhalb unseres Servers',
            spiega: 'Diese Seite zählt die Wahlurne einer beendeten Abstimmung nach und prüft die Signaturen aller Stimmzettel. Die Berechnung macht Ihr Browser mit einem Programm, das nicht auf dem METIS-Server liegt: Sie können seinen Code auf GitHub lesen.',
            lingua: 'Sprache', zona: 'Ziehen Sie die Datei der Wahlurne hierher (Sie laden sie mit „Wahlurne herunterladen“ auf der Ergebnisseite herunter) oder tippen Sie, um sie auszuwählen.',
            da: 'Daten gelesen von: ', dafile: 'von Ihnen gewählte Datei', fonte_no: 'Adresse nicht akzeptiert: Die Daten werden nur von der Website von METIS Italia gelesen. Laden Sie die Datei herunter und ziehen Sie sie hierher.',
            carica_no: 'Ich kann die Daten der Wahlurne nicht lesen. Die Abstimmung ist vielleicht noch nicht beendet oder hat weniger als 5 Stimmzettel.', formato_no: 'Die Datei ist keine Wahlurnen-Datei von METIS Italia.',
            votazione: 'Abstimmung', chiusura: 'Ende', schede: 'Stimmzettel in der Wahlurne',
            sig_si: 'Siegel der Kandidatenliste neu berechnet: stimmt überein.', sig_no: 'Siegel der Kandidatenliste neu berechnet: stimmt NICHT überein.',
            fir_si: 'Signaturen geprüft: Alle %d Stimmzettel haben eine gültige Signatur über Auswahl und Kandidatenliste.', fir_no: 'ACHTUNG: %d von %d Stimmzetteln haben KEINE gültige Signatur.',
            fir_v1: 'Vor dem 21.11.2026 erstellte Abstimmung: Die Stimmzettel haben keine Signatur über die Auswahl.',
            cont_si: 'Nachzählung: stimmt mit den veröffentlichten Ergebnissen überein.', cont_no: 'Nachzählung: stimmt NICHT mit den veröffentlichten Ergebnissen überein.',
            cand: 'Kandidat', pubb: 'Ergebnisse', contati: 'Hier nachgezählt',
            vot: 'Gezählte Stimmzettel: %d von %d Online-Wählern (die Differenz sind nicht abgeschlossene Stimmen).',
            imp_si: 'Fingerabdruck der Wahlurne neu berechnet: stimmt überein.', imp_no: 'Fingerabdruck der Wahlurne neu berechnet: stimmt NICHT überein.',
            chi_si: 'Fingerabdruck des Schlüssels neu berechnet: stimmt überein (vergleichen Sie ihn mit dem neben Ihrem Beleg).', chi_no: 'Fingerabdruck des Schlüssels neu berechnet: stimmt NICHT überein.',
            reg_t: 'Öffentliches Register auf GitHub', reg_cerca: 'Stempel des Registers werden gelesen...', reg_vuoto: 'Kein Stempel im Register für diese Abstimmung (vor dem 21.11.2026 beendete Abstimmungen oder Register noch nicht aktiv).',
            reg_err: 'Das Register auf GitHub antwortet gerade nicht: Versuchen Sie es später erneut.',
            reg_chiu_si: 'Stempel beim Ende: Stimmzettel, Fingerabdruck der Wahlurne, Fingerabdruck der Datei, Siegel und Schlüssel stimmen mit dieser Datei überein.',
            reg_chiu_no: 'ACHTUNG: Der Stempel beim Ende stimmt NICHT mit dieser Datei überein (%s). Die Wahlurne wurde nach dem Ende geändert oder die Datei ist nicht die originale.',
            reg_chiu_manca: 'Der Stempel beim Ende ist noch nicht im Register (er kommt etwa zehn Minuten nach dem Ende).',
            reg_int_si: 'Stempel während der Abstimmung: %d, keiner mit mehr Stimmzetteln als die endgültige Wahlurne.',
            reg_int_no: 'ACHTUNG: Während der Abstimmung waren bereits %d Stimmzettel gestempelt, in der endgültigen Wahlurne sind aber %d. Es fehlen Stimmzettel.',
            reg_vedi: 'Register auf GitHub ansehen', come: 'Der Code dieser Seite ist öffentlich (Ordner docs des Repositorys metisitalia-nucleo-voto) und jede Änderung bleibt in der GitHub-Historie. Die Datei AN05_blind.js, die rechnet, muss denselben Fingerabdruck haben wie der in IMPRONTE.md veröffentlichte Kern der Abstimmung:',
            impjs: 'Fingerabdruck der hier verwendeten AN05_blind.js:', diversi: 'abweichende Felder: ' },
        fr: { titolo: 'Vérification indépendante de l\'urne', sotto: 'METIS Italia · page publiée sur GitHub, en dehors de notre serveur',
            spiega: 'Cette page recompte l\'urne d\'un vote clos et vérifie les signatures de tous les bulletins. Le calcul est fait par votre navigateur avec un programme qui n\'est pas sur le serveur de METIS : vous pouvez en lire le code sur GitHub.',
            lingua: 'Langue', zona: 'Déposez ici le fichier de l\'urne (téléchargez-le avec « Télécharger l\'urne » sur la page des résultats) ou touchez pour le choisir.',
            da: 'Données lues depuis : ', dafile: 'fichier choisi par vous', fonte_no: 'Adresse non acceptée : les données ne sont lues que sur le site de METIS Italia. Téléchargez le fichier et déposez-le ici.',
            carica_no: 'Je n\'arrive pas à lire les données de l\'urne. Le vote n\'est peut-être pas encore clos, ou compte moins de 5 bulletins.', formato_no: 'Le fichier n\'est pas un fichier d\'urne de METIS Italia.',
            votazione: 'Vote', chiusura: 'Clôture', schede: 'Bulletins dans l\'urne',
            sig_si: 'Sceau de la liste des candidats recalculé : il correspond.', sig_no: 'Sceau de la liste des candidats recalculé : il NE correspond PAS.',
            fir_si: 'Signatures vérifiées : les %d bulletins ont une signature valable sur les choix et la liste des candidats.', fir_no: 'ATTENTION : %d bulletins sur %d N\'ONT PAS de signature valable.',
            fir_v1: 'Vote créé avant le 21/11/2026 : les bulletins n\'ont pas de signature sur les choix.',
            cont_si: 'Recomptage : il correspond aux résultats publiés.', cont_no: 'Recomptage : il NE correspond PAS aux résultats publiés.',
            cand: 'Candidat', pubb: 'Résultats', contati: 'Recomptés ici',
            vot: 'Bulletins comptés : %d sur %d votants en ligne (la différence correspond aux votes non terminés).',
            imp_si: 'Empreinte de l\'urne recalculée : elle correspond.', imp_no: 'Empreinte de l\'urne recalculée : elle NE correspond PAS.',
            chi_si: 'Empreinte de la clé recalculée : elle correspond (comparez-la avec celle à côté de votre reçu).', chi_no: 'Empreinte de la clé recalculée : elle NE correspond PAS.',
            reg_t: 'Registre public sur GitHub', reg_cerca: 'Lecture des tampons du registre...', reg_vuoto: 'Aucun tampon dans le registre pour ce vote (votes clos avant le 21/11/2026 ou registre pas encore actif).',
            reg_err: 'Le registre sur GitHub ne répond pas pour le moment : réessayez plus tard.',
            reg_chiu_si: 'Tampon de clôture : bulletins, empreinte de l\'urne, empreinte du fichier, sceau et clé correspondent à ce fichier.',
            reg_chiu_no: 'ATTENTION : le tampon de clôture NE correspond PAS à ce fichier (%s). L\'urne a été modifiée après la clôture, ou le fichier n\'est pas l\'original.',
            reg_chiu_manca: 'Le tampon de clôture n\'est pas encore dans le registre (il arrive une dizaine de minutes après la clôture).',
            reg_int_si: 'Tampons pendant le vote : %d, aucun avec plus de bulletins que l\'urne finale.',
            reg_int_no: 'ATTENTION : pendant le vote, %d bulletins avaient déjà été tamponnés, mais l\'urne finale en contient %d. Il manque des bulletins.',
            reg_vedi: 'Voir le registre sur GitHub', come: 'Le code de cette page est public (dossier docs du dépôt metisitalia-nucleo-voto) et chaque modification reste dans l\'historique de GitHub. Le fichier AN05_blind.js qui fait les calculs doit avoir la même empreinte que le noyau du vote publié dans IMPRONTE.md :',
            impjs: 'Empreinte du AN05_blind.js utilisé ici :', diversi: 'champs différents : ' }
    };
    var lang = parametri.get('lang') || (navigator.language || 'it').slice(0, 2);
    if (!TX[lang]) { lang = 'en'; }
    var T = TX[lang];

    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (txt !== undefined) { e.textContent = txt; } return e; }
    function fmt(s) { var a = Array.prototype.slice.call(arguments, 1), i = 0; return String(s).replace(/%[ds]/g, function () { return String(a[i++]); }); }
    async function sha(testo) { return B.byteEsa(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo)))); }

    function testi() {
        document.documentElement.lang = lang;
        ['titolo', 'sotto', 'spiega', 'lingua', 'zona', 'come', 'impjs'].forEach(function (k) {
            var e = document.getElementById('t_' + k); if (e) { e.textContent = T[k]; }
        });
        document.title = 'METIS Italia - ' + T.titolo;
        document.getElementById('lingua').value = lang;
    }

    var out = document.getElementById('risultato');
    function esito(box, ok, testo) { box.appendChild(el('div', 'esito ' + (ok === null ? 'info' : (ok ? 'si' : 'no')), testo)); }

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
    async function controllaRegistro(d, testoFile, nSchede, sig, impUrna) {
        var box = el('div', 'box');
        box.appendChild(el('h2', '', T.reg_t));
        var attesa = el('p', 'piccolo', T.reg_cerca);
        box.appendChild(attesa);
        out.appendChild(box);
        var codice = (await sha('MI-AN05-REGISTRO|' + d.votazione)).slice(0, 24);
        var file;
        try { file = await elencoRegistro(codice); } catch (e) { attesa.remove(); esito(box, null, T.reg_err); return; }
        attesa.remove();
        if (!file.length) { esito(box, null, T.reg_vuoto); return; }
        var chiusura = null, maxInt = 0, nInt = 0;
        for (var i = 0; i < file.length; i++) {
            var r = await fetch(file[i].download_url, { credentials: 'omit', cache: 'no-store' });
            if (!r.ok) { continue; }
            var c = campi(await r.text());
            if (c.codice !== codice) { continue; }
            if (file[i].name === 'chiusura.txt') { chiusura = c; } else { nInt++; maxInt = Math.max(maxInt, parseInt(c.schede, 10) || 0); }
        }
        if (nInt) {
            esito(box, maxInt <= nSchede, maxInt <= nSchede ? fmt(T.reg_int_si, nInt) : fmt(T.reg_int_no, maxInt, nSchede));
        }
        if (!chiusura) {
            esito(box, null, T.reg_chiu_manca);
        } else {
            var diversi = [];
            if (parseInt(chiusura.schede, 10) !== nSchede) { diversi.push('schede'); }
            if (chiusura.impronta_urna !== impUrna) { diversi.push('impronta_urna'); }
            if (chiusura.impronta_file_urna !== await sha(testoFile)) { diversi.push('impronta_file_urna'); }
            if (chiusura.sigillo_lista !== sig) { diversi.push('sigillo_lista'); }
            if (chiusura.impronta_chiave !== d.impronta_chiave) { diversi.push('impronta_chiave'); }
            esito(box, !diversi.length, diversi.length ? fmt(T.reg_chiu_no, T.diversi + diversi.join(', ')) : T.reg_chiu_si);
        }
        var a = el('a', '', T.reg_vedi);
        a.href = 'https://github.com/' + REPO + '/tree/main/' + codice;
        a.target = '_blank';
        a.rel = 'noopener';
        box.appendChild(el('p')).appendChild(a);
    }

    /* ---- verifica del file dell'urna ---- */
    async function verifica(testoFile, fonte) {
        out.textContent = '';
        document.getElementById('origine').textContent = T.da + fonte;
        var d;
        try { d = JSON.parse(testoFile); } catch (e) { d = null; }
        if (!d || d.formato !== 'MI-URNA-DATI-1' || !Array.isArray(d.schede) || !Array.isArray(d.candidati) || !d.chiave) {
            var b0 = el('div', 'box'); out.appendChild(b0); esito(b0, false, T.formato_no); return;
        }
        var box = el('div', 'box');
        out.appendChild(box);
        box.appendChild(el('h2', '', d.titolo || d.votazione));
        box.appendChild(el('p', 'piccolo', T.votazione + ': ' + d.votazione + ' · ' + T.chiusura + ': ' + d.chiusura + ' · ' + T.schede + ': ' + d.schede.length));

        // 1. sigillo
        var sig = await B.sigillo(d.votazione, d.candidati);
        esito(box, sig === d.sigillo, sig === d.sigillo ? T.sig_si : T.sig_no);

        // 2. firme
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
            esito(box, cattive === 0, cattive === 0 ? fmt(T.fir_si, d.schede.length) : fmt(T.fir_no, cattive, d.schede.length));
        } else {
            esito(box, null, T.fir_v1);
        }

        // 3. riconteggio
        var conta = {}, attesiR = {}, elenco = [];
        (d.risultati || []).forEach(function (r) { if (!(r[0] in attesiR)) { attesiR[r[0]] = 0; elenco.push(r[0]); } attesiR[r[0]] += parseInt(r[1], 10) || 0; });
        d.schede.forEach(function (s) { (s.scelte || []).forEach(function (n) { conta[n] = (conta[n] || 0) + 1; if (!(n in attesiR)) { attesiR[n] = 0; elenco.push(n); } }); });
        var contOk = elenco.every(function (n) { return (conta[n] || 0) === attesiR[n]; });
        esito(box, contOk, contOk ? T.cont_si : T.cont_no);
        var tab = el('table'), th = el('tr');
        [T.cand, T.pubb, T.contati].forEach(function (x) { th.appendChild(el('th', '', x)); });
        tab.appendChild(th);
        elenco.forEach(function (n) {
            var tr = el('tr');
            [n, String(attesiR[n]), String(conta[n] || 0)].forEach(function (x) { tr.appendChild(el('td', '', x)); });
            tab.appendChild(tr);
        });
        box.appendChild(tab);
        box.appendChild(el('p', 'piccolo', fmt(T.vot, d.schede.length, d.votanti_online)));

        // 4. impronte
        var impUrna = await sha('MI-URNA-v1|' + d.votazione + '|' + JSON.stringify(d.schede.map(function (s) { return s.scelte || []; })));
        esito(box, impUrna === d.impronta_urna, impUrna === d.impronta_urna ? T.imp_si : T.imp_no);
        var impChiave = await B.impronta(d.chiave);
        esito(box, impChiave === d.impronta_chiave, (impChiave === d.impronta_chiave ? T.chi_si : T.chi_no) + ' ' + impChiave);

        // 5. registro pubblico
        await controllaRegistro(d, testoFile, d.schede.length, sig, impUrna);
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
        if (!fonteAmmessa(url)) { out.textContent = ''; var b = el('div', 'box'); out.appendChild(b); esito(b, false, T.fonte_no); return; }
        try {
            var r = await fetch(url, { credentials: 'omit', cache: 'no-store' });
            if (!r.ok) { throw new Error(String(r.status)); }
            await verifica(await r.text(), url);
        } catch (e) { out.textContent = ''; var b2 = el('div', 'box'); out.appendChild(b2); esito(b2, false, T.carica_no); }
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
