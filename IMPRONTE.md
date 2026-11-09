# Registro delle impronte del nucleo del voto

Ogni versione del **nucleo del voto** di [METIS Italia](https://www.metisitalia.it) con le impronte SHA-256 dei suoi 5 file.
La pagina pubblica [Verifica tu stesso](https://www.metisitalia.it/index.php?idPg=22) calcola le stesse impronte in tempo reale
sui file del server: devono coincidere con una versione di questo registro.

*Register of the fingerprints of the METIS Italia voting core. The public page "Check it yourself" computes the same
fingerprints live on the server files: they must match a version listed here.*

L'impronta del nucleo è l'impronta del file `vX.Y.sha256` della versione
(`sha256sum js/AN05_blind.js js/AN05_voto.js AN05_voto_firma.php AN05_voto_urna.php includes/AN05_blind.php | sha256sum`).

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

Controllo automatico: `sha256sum -c v1.1.sha256`

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
