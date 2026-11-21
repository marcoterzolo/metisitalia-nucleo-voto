# Registro delle impronte del nucleo del voto

Ogni versione del **nucleo del voto** di [METIS Italia](https://www.metisitalia.it) con le impronte SHA-256 dei suoi 5 file.
La pagina pubblica [Verifica tu stesso](https://www.metisitalia.it/index.php?idPg=22) calcola le stesse impronte in tempo reale
sui file del server: devono coincidere con una versione di questo registro.

*Register of the fingerprints of the METIS Italia voting core. The public page "Check it yourself" computes the same
fingerprints live on the server files: they must match a version listed here.*

L'impronta del nucleo è l'impronta del file `vX.Y.sha256` della versione
(`sha256sum js/AN05_blind.js js/AN05_voto.js AN05_voto_firma.php AN05_voto_urna.php includes/AN05_blind.php | sha256sum`).

---

## Versione 1.5 — 21/11/2026

**Scheda bianca.** Si può confermare il voto senza scegliere nessun candidato. La scheda bianca viene firmata alla
cieca come tutte le altre: il messaggio firmato è lo stesso della versione 1.4 con l'elenco degli id scelti **vuoto**
(`"MI-AN05-SCHEDA-v2|" + id votazione + "|" + sigillo + "|"`), quindi la firma copre anche il fatto che la scheda è
vuota e nessuno può aggiungerle un candidato dopo. Nell'urna finisce una scheda senza scelte; l'elettore risulta
votante e riceve la ricevuta. Nessun altro cambiamento a firma, deposito anonimo, attesa casuale e ricevuta.
Cambiano `js/AN05_blind.js` (la verifica accetta zero scelte), `js/AN05_voto.js` («Conferma voto» attivo anche senza
scelte, con la domanda «Confermi la scheda bianca?»), `AN05_voto_urna.php` (accetta il campo `scelte` vuoto, ma
richiede che ci sia) e `includes/AN05_blind.php`.

*Blank ballot. The vote can be confirmed without choosing any candidate. The blank ballot is blind-signed like all the
others: the signed message is the same as in version 1.4 with an **empty** list of chosen ids, so the signature also
covers the fact that the ballot is empty and nobody can add a candidate to it later. The box receives a ballot with no
choices; the voter counts as having voted and gets the receipt.*

| File | SHA-256 |
|---|---|
| `js/AN05_blind.js` | `91d04144d652529804569b36d19a4fb678fa956db734b43f66c02787b68d629d` |
| `js/AN05_voto.js` | `7e97cfadcf5aab73170a870a1db4a44cddaeba883c05ac2e0e5508fbf2d03088` |
| `AN05_voto_firma.php` | `7ff0bd7c0bba21594360530605e40906b8c0cc3f633e8b675f449ffd30ae2650` |
| `AN05_voto_urna.php` | `204c0ca8c4400be1dcaaa30aa8c8754346d345ad6c86cefde9408ef7b9c14b8f` |
| `includes/AN05_blind.php` | `087d7124b3d2f42dbbdc3d6a42920e67bcf207e2ad42c6a012ef07c00535d057` |
| **Impronta del nucleo** | **`d2b92fa7558facaaefd2c069a7cd40827218153c0401e1cec2cd4310b7bef602`** |

Controllo automatico: `sha256sum -c v1.5.sha256`

Perizia indipendente: **in corso**.

---

## Versione 1.4 — 21/11/2026

**Firma anche sulle scelte.** Quando l'elettore conferma, il browser fa firmare alla cieca il gettone **insieme alle
scelte e al sigillo della lista dei candidati** (numeri e nomi). Ogni scheda dell'urna pubblica porta la sua firma e
chiunque le verifica tutte con la chiave pubblica della votazione ("Riconta" nella pagina dei risultati): una scelta
o un nome cambiati nel database dopo il voto fanno fallire la verifica. Il gettone resta segreto, la ricevuta non
cambia. Vale per le votazioni la cui chiave è creata dal 21/11/2026 (le precedenti restano con la firma sul solo
gettone). Cambiano `js/AN05_blind.js`, `js/AN05_voto.js`, `AN05_voto_urna.php` e `includes/AN05_blind.php`.

Formule (stesse in PHP e in JavaScript):
- sigillo = SHA-256(`"MI-AN05-CANDIDATI-v1|" + id votazione + "\n" + righe "id<TAB>nome"` dei candidati per id crescente)
- p = SHA-256(`"MI-AN05-PUB|" + contesto + "|" + gettone`) — pubblicato con la scheda, non rivela il gettone
- messaggio firmato = FDH(p, `"MI-AN05-SCHEDA-v2|" + id votazione + "|" + sigillo + "|" + id scelti in ordine crescente`)

*Signature on the choices too. When the voter confirms, the browser has the token blind-signed **together with the
choices and the seal of the candidate list** (numbers and names). Every ballot in the public box carries its signature
and anyone can check all of them with the public key of the election ("Recount" on the results page): a choice or a
name changed in the database after the vote makes the check fail. The token stays secret, the receipt does not change.
Applies to elections whose key is created from 21/11/2026.*

| File | SHA-256 |
|---|---|
| `js/AN05_blind.js` | `5441dfa8a8b614f4b9a26d77a4963ddc13e4785d41a6eb04ee53c35a757a2778` |
| `js/AN05_voto.js` | `ecd33e058f59d499fd1503e6407c2cd37f95dcf740a3ce2fdb5e94e8b938fb15` |
| `AN05_voto_firma.php` | `7ff0bd7c0bba21594360530605e40906b8c0cc3f633e8b675f449ffd30ae2650` |
| `AN05_voto_urna.php` | `ce8a89d39221378d51b6569f30c0e3aa737b34d918204e8d10de71c981da08d8` |
| `includes/AN05_blind.php` | `2a041ce0d512c191209f3b6e17d88ae53680afd3f387f0b62be2d1c18e16df06` |
| **Impronta del nucleo** | **`866cb0d07ad122a7bfde24e691e9719077646bca322dd0b0d9574018236b2312`** |

Controllo automatico: `sha256sum -c v1.4.sha256`

Perizia indipendente: **in corso**.

---

## Versione 1.3 — 21/11/2026

Chiusura definitiva: si vota fino all'ora di fine; per **1 minuto** (prima 15) l'urna accetta solo le schede già firmate
prima della chiusura, poi più nulla. Risultati, verbale, impronta dell'urna ed email di chiusura escono dopo quel minuto
("Scrutinio in corso"), quindi non cambiano più. Cambiano `AN05_voto_urna.php` (accetta fino a 60 secondi dopo la fine)
e `includes/AN05_blind.php` (`AN05B_scrutinio_sec` al posto di `AN05B_ritardo_max`). Firma cieca, deposito anonimo,
attesa casuale e ricevuta **invariate**.

*Final closing: voting is possible until the end time; for **1 minute** (previously 15) the ballot box accepts only
ballots already signed before closing, then nothing. Results, report, ballot box fingerprint and closing email are
released after that minute ("Counting in progress"), so they can no longer change. Blind signature, anonymous deposit,
random wait and receipt unchanged.*

| File | SHA-256 |
|---|---|
| `js/AN05_blind.js` | `8ecfe8d8b1d51c1aaba7b1021baa9a360bda79e4c8df58161d82e648318dab26` |
| `js/AN05_voto.js` | `19f9306ba8304297cb3dd66c35d75aa11598672f8efe9a58a6fee22252298396` |
| `AN05_voto_firma.php` | `7ff0bd7c0bba21594360530605e40906b8c0cc3f633e8b675f449ffd30ae2650` |
| `AN05_voto_urna.php` | `945f9c1b881d7835e23d95e4bc574184038a6f60633b9434267bf238e0ad0fb9` |
| `includes/AN05_blind.php` | `73b7a34f8ac266e849bfc5139c2b33d0c5ab319922c4d656251d857958eef8c7` |
| **Impronta del nucleo** | **`e3ccad15581119652fe9b145b49666aee09f9f73ebaf401fc5af14ff5632368a`** |

Controllo automatico: `sha256sum -c v1.3.sha256` (sui file della versione 1.3, nella cronologia dell'archivio)

Perizia indipendente: **in corso**.

---

## Versione 1.2 — 12/11/2026

Solo interfaccia della scheda (`js/AN05_voto.js`): dopo il proprio voto sparisce il modulo "Delega il tuo voto" e, dopo
la scheda votata per delega, il pulsante "Rifiuta" di quella delega; "Ti resta 1 scheda da votare" al singolare.
Firma cieca, deposito anonimo, attesa casuale, urna e ricevuta **invariate** (cambia solo quel file).

*Ballot interface only (`js/AN05_voto.js`): after one's own vote the "Delegate your vote" form disappears and, after the
ballot cast by proxy, the "Refuse" button of that proxy; singular "1 ballot left". Blind signature, anonymous deposit,
random wait, ballot box and receipt unchanged (only that file changed).*

| File | SHA-256 |
|---|---|
| `js/AN05_blind.js` | `8ecfe8d8b1d51c1aaba7b1021baa9a360bda79e4c8df58161d82e648318dab26` |
| `js/AN05_voto.js` | `19f9306ba8304297cb3dd66c35d75aa11598672f8efe9a58a6fee22252298396` |
| `AN05_voto_firma.php` | `7ff0bd7c0bba21594360530605e40906b8c0cc3f633e8b675f449ffd30ae2650` |
| `AN05_voto_urna.php` | `a4e98db625c2aa44c78b3f8dae273ec08e96ecaa635a419fe78c3ddedc876531` |
| `includes/AN05_blind.php` | `f8350ed80e3e1f10017c7f027235dabb79681ff14f02d4c7893c54c10dc04679` |
| **Impronta del nucleo** | **`980bc7694082b7bee11d078dd879157dfe71614b58c517bc887435ed7f02cd6c`** |

Controllo automatico: `sha256sum -c v1.2.sha256` (sui file della versione 1.2, nella cronologia dell'archivio)

Perizia indipendente: **in corso**.

---

## Versione 1.1 — 09/11/2026

Nome e cognome dell'elettore sono cifrati con la chiave della votazione: `AN05_voto_firma.php` li decifra prima di
mostrarli nel riquadro "Su di te". Firma cieca, urna anonima e ricevuta **invariate** (cambia solo quel file).

*Voter first and last name are encrypted with the election key: `AN05_voto_firma.php` decrypts them before showing them
in the "About you" box. Blind signature, anonymous ballot box and receipt unchanged (only that file changed).*

| File | SHA-256 |
|---|---|
| `js/AN05_blind.js` | `8ecfe8d8b1d51c1aaba7b1021baa9a360bda79e4c8df58161d82e648318dab26` |
| `js/AN05_voto.js` | `be40074f8abe90e0fe86334a5a5a77fd0dbd4b0527f8bc45f9d52cd65016b370` |
| `AN05_voto_firma.php` | `7ff0bd7c0bba21594360530605e40906b8c0cc3f633e8b675f449ffd30ae2650` |
| `AN05_voto_urna.php` | `a4e98db625c2aa44c78b3f8dae273ec08e96ecaa635a419fe78c3ddedc876531` |
| `includes/AN05_blind.php` | `f8350ed80e3e1f10017c7f027235dabb79681ff14f02d4c7893c54c10dc04679` |
| **Impronta del nucleo** | **`2c002f34578595611a3fa2339eed4dc61fe71b369307630917c5bd8f7b077c51`** |

Controllo automatico: `sha256sum -c v1.1.sha256` (sui file della versione 1.1, nella cronologia dell'archivio)

Perizia indipendente: **in corso**.

---

## Versione 1.0 — 08/11/2026

Prima versione pubblicata: firma cieca RSA-FDH con chiave per votazione, attesa casuale 5-20 s, urna anonima, deleghe,
impronta della chiave mostrata con la ricevuta.

| File | SHA-256 |
|---|---|
| `js/AN05_blind.js` | `8ecfe8d8b1d51c1aaba7b1021baa9a360bda79e4c8df58161d82e648318dab26` |
| `js/AN05_voto.js` | `be40074f8abe90e0fe86334a5a5a77fd0dbd4b0527f8bc45f9d52cd65016b370` |
| `AN05_voto_firma.php` | `715b75aa16a0882278a23eacdf3aeaa7ff18b4cdd07b018cc53d6ac6c31eef51` |
| `AN05_voto_urna.php` | `a4e98db625c2aa44c78b3f8dae273ec08e96ecaa635a419fe78c3ddedc876531` |
| `includes/AN05_blind.php` | `f8350ed80e3e1f10017c7f027235dabb79681ff14f02d4c7893c54c10dc04679` |
| **Impronta del nucleo** | **`7ca119fbb78ea40f267653d5debfcea951a924182dc1e2deaf2df7e4c37f9e83`** |

Controllo automatico: `sha256sum -c v1.0.sha256` (sui file della versione 1.0, nella cronologia dell'archivio)

Perizia indipendente: **in corso** (il collegamento al rapporto verrà aggiunto qui).
