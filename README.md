# METIS Italia — nucleo del voto segreto

Questo archivio pubblica il **codice dei 5 file che decidono il segreto del voto** nelle votazioni online di
[METIS Italia](https://www.metisitalia.it) e il **registro delle loro impronte** ([IMPRONTE.md](IMPRONTE.md)).
Serve a una cosa sola: permettere a chiunque (elettori, organizzatori, periti) di **controllare** che il sistema
non sa e non può sapere cosa ha votato ciascuno, senza doversi fidare della nostra parola.

*English: this repository publishes the source of the 5 files that guarantee ballot secrecy in METIS Italia online
elections, and the register of their SHA-256 fingerprints, so that anyone can verify the system cannot link voters
to their ballots.*

## Come funziona, in breve

Firma cieca (Chaum, RSA-FDH):

1. Il browser dell'elettore crea un gettone casuale, lo "maschera" con un numero che resta solo nel browser e lo
   manda al server insieme al link personale (`AN05_voto_firma.php`). Il server firma alla cieca, una sola volta per
   elettore: vede chi è, ma non vede né il gettone né le scelte.
2. Il browser toglie la maschera, controlla la firma e, dopo un'attesa casuale di 5-20 secondi, invia scelte, gettone
   e firma in una richiesta **anonima** (`AN05_voto_urna.php`, senza cookie e senza link personale).
3. L'urna accetta la scheda perché la firma è valida, ma non può collegarla alla prima richiesta.
4. Ogni votazione ha la sua chiave; l'impronta della chiave è mostrata a ogni elettore con la ricevuta e stampata nei
   risultati e nel verbale: se è uguale per tutti, nessuno ha ricevuto una chiave "personale".

| File | Cosa fa |
|---|---|
| `js/AN05_blind.js` | gettone, maschera, firma, verifica, impronta della chiave (nel browser) |
| `js/AN05_voto.js` | scheda: firma col link, attesa casuale, invio anonimo, ripresa, ricevuta |
| `AN05_voto_firma.php` | firma alla cieca, una per elettore (o per delega) |
| `AN05_voto_urna.php` | urna anonima: verifica firma, gettone non riusabile, nessun log |
| `includes/AN05_blind.php` | primitive RSA-FDH (MGF1-SHA256), chiavi per votazione, codice ricevuta |

Gli altri file del sito (pagine, area riservata, deleghe, impostazioni) non toccano il segreto del voto e non sono qui.
Chiavi, password e configurazione non sono mai in questo archivio.

## Come verificare

1. **Il JavaScript che usi davvero**: scarica `https://www.metisitalia.it/js/AN05_blind.js` e
   `https://www.metisitalia.it/js/AN05_voto.js`, calcolane l'impronta e confrontala con [IMPRONTE.md](IMPRONTE.md).
   - Windows: `certutil -hashfile AN05_blind.js SHA256`
   - Mac: `shasum -a 256 AN05_blind.js`
   - Linux: `sha256sum AN05_blind.js`
2. **Questo archivio**: `sha256sum -c v1.1.sha256` controlla i file di questa cartella (versione attuale; le precedenti sono in IMPRONTE.md).
3. **Il sito**: la pagina [Verifica tu stesso](https://www.metisitalia.it/index.php?idPg=22) mostra le impronte dei
   file in uso sul server, la struttura reale dell'urna e cosa controllare con gli strumenti del browser (F12).
4. **I file PHP sul server** li può confrontare solo chi ha accesso al server: è il compito della perizia
   indipendente, il cui rapporto sarà collegato in [IMPRONTE.md](IMPRONTE.md).

## Limiti dichiarati

- Il server web registra IP e ora di ogni richiesta (come ogni sito). Attesa casuale e richiesta anonima rendono
  molto difficile collegare le due richieste, ma con pochissimi votanti e accesso a quei registri non è impossibile
  in teoria.
- Le votazioni create prima dell'introduzione della firma cieca usano il vecchio sistema e non sono coperte da questo
  nucleo.

## Licenza

Codice pubblicato **solo per consentirne la lettura e la verifica**. Tutti i diritti riservati © METIS Italia.
Segnalazioni di sicurezza: dalla pagina Contatti del sito.
