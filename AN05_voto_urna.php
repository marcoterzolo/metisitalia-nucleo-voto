<?php
/**
 * =============================================================================
 * AN05_voto_urna.php - VOTO CON FIRMA CIECA, richiesta 2 di 2 (ANONIMA)
 * -----------------------------------------------------------------------------
 * Chiamata da js/AN05_voto.js qualche secondo dopo AN05_voto_firma.php, con
 * fetch(credentials: 'omit'): nessun cookie, nessuna sessione, nessun token
 * del link personale, nessun token CSRF (js/MI_csrf.js non lo aggiunge alle
 * richieste anonime). Questo endpoint NON avvia la sessione.
 * L'autorizzazione e' la firma: solo chi ha ottenuto una firma col proprio
 * link (una per elettore) puo' depositare una scheda; non serve CSRF perche'
 * non c'e' alcuna credenziale "ambientale" da sfruttare.
 *
 * POST: an05_id_web, t (gettone, 64 esa), s (firma, esadecimale), scelte (id
 *       candidati separati da virgola).
 * In UNA transazione:
 *   1. votazione con firma cieca, aperta: accettata fino a
 *      AN05B_scrutinio_sec() secondi (1 minuto) dopo la fine, solo per le
 *      schede firmate prima della chiusura (dopo la fine non si firma piu');
 *      risultati e impronta escono solo dopo quel minuto (nucleo v1.3,
 *      21/11/2026; prima si accettava fino a 15 minuti dopo con i risultati
 *      gia' pubblici);
 *   2. firma valida per QUESTA votazione: versione 1 sul solo gettone
 *      (AN05B_verifica); versione 2 (nucleo v1.4, 21/11/2026, an05_firma_v = 2)
 *      su gettone + sigillo della lista dei candidati + scelte
 *      (AN05B_verifica_scheda, sigillo ricalcolato dalla lista del database con
 *      AN05_cand_lista): scelte o nomi cambiati dopo la firma = scheda rifiutata;
 *   3. gettone non ancora usato: INSERT in op12_gettoni_spesi (chiave primaria
 *      = sha256 del gettone). Se e' gia' usato e' una RIPRESA (risposta persa):
 *      si restituisce la stessa ricevuta, derivata dal gettone, senza
 *      toccare nulla;
 *   4. preferenze <= massimo, candidati tutti della votazione;
 *   5. contatori in chiaro + copia AES (come il flusso attuale) e scheda
 *      anonima in op11_schede (chiave casuale, hash della ricevuta, scelte,
 *      solo il giorno; in versione 2 anche p = parte pubblica del gettone e la
 *      firma s, pubblicate con l'urna per la verifica di tutti).
 * Risposta {ok, ricevuta, scheda}: "scheda" e' la riga riletta dall'urna per
 * il riquadro di trasparenza "Nell'urna".
 * Nessun log di gettoni, firme, scelte o indirizzi.
 * Errori: 409 chiusa/non valida, 422 dati non validi, 500 interno.
 * 21/11/2026 (nucleo v1.5, SCHEDA BIANCA): accettata la scheda con zero scelte (campo "scelte"
 *  presente ma vuoto): nessun voto ai candidati, scheda nell'urna con op11_scelte vuoto,
 *  gettone speso e ricevuta come sempre. La firma (v2) copre anche il fatto che e' vuota.
 * =============================================================================
 */
require_once __DIR__ . '/includes/AN05_lib.php';
require_once __DIR__ . '/includes/AN05_blind.php';

header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    mi_json_exit(405, ['ok' => false]);
}

$idWeb = (string)($_POST['an05_id_web'] ?? '');
$tHex  = (string)($_POST['t'] ?? '');
$sHex  = (string)($_POST['s'] ?? '');
$sel = array_values(array_unique(array_filter(
    array_map('intval', explode(',', (string)($_POST['scelte'] ?? ''))),
    static function ($v) { return $v > 0; }
)));
if (!mi_valid_uuid($idWeb) || strlen($tHex) !== AN05B_TOKEN * 2 || !ctype_xdigit($tHex)
    || $sHex === '' || strlen($sHex) > 1024 || strlen($sHex) % 2 !== 0 || !ctype_xdigit($sHex) || !isset($_POST['scelte'])) {
    mi_json_exit(422, ['ok' => false]);
}
$t = hex2bin($tHex);
$s = hex2bin($sHex);
$ctx = AN05B_ctx($idWeb);
$ricevuta = AN05B_ricevuta($t, $ctx);

$AES_key = (string)@file_get_contents(__DIR__ . '/php/AES.pem');
$pdo = mi_pdo();
$ripresa = false;
try {
    $pdo->beginTransaction();
    $st = $pdo->prepare(
        'SELECT an05_id, an05_max_preference, an05_blind_on, an05_blind_pub
           FROM an05_groups
          WHERE an05_id_web = ? AND an05_is_deteled = 0
            AND NOW() >= an05_star_date
            AND NOW() <= DATE_ADD(an05_end_date, INTERVAL ? SECOND)
          FOR UPDATE'
    );
    $st->execute([$idWeb, AN05B_scrutinio_sec()]);
    $g = $st->fetch();
    if (!$g || !AN05B_attiva($g['an05_blind_on']) || empty($g['an05_blind_pub'])) {
        $pdo->rollBack();
        mi_json_exit(409, ['ok' => false]);
    }
    $an05_id = (int)$g['an05_id'];
    // nucleo v1.4: versione 2 = la firma copre anche scelte e lista dei candidati
    $firmaV = AN05B_firma_v($an05_id);
    $pPub = $firmaV === 2 ? AN05B_pub($t, $ctx) : '';
    $firmaOk = $firmaV === 2
        ? AN05B_verifica_scheda((string)$g['an05_blind_pub'], $pPub, $idWeb, AN05B_sigillo($idWeb, AN05_cand_lista($an05_id)), $sel, $s)
        : AN05B_verifica((string)$g['an05_blind_pub'], $t, $ctx, $s);
    if (!$firmaOk) {
        $pdo->rollBack();
        mi_json_exit(409, ['ok' => false]);
    }
    $max = (int)$g['an05_max_preference'];

    // gettone gia' usato? -> ripresa, nessuna modifica
    $hash = AN05B_hash_gettone($t, $ctx);
    $chk = $pdo->prepare('SELECT 1 FROM op12_gettoni_spesi WHERE op12_hash = ?');
    $chk->execute([$hash]);
    if ($chk->fetchColumn()) {
        $pdo->commit();
        $ripresa = true;
    } else {
        if ($max > 0 && count($sel) > $max) {
            $pdo->rollBack();
            mi_json_exit(422, ['ok' => false]);
        }
        if ($sel) {                            // nucleo v1.5: nessuna scelta = scheda bianca
            $in = implode(',', array_fill(0, count($sel), '?'));
            $c = $pdo->prepare("SELECT COUNT(*) FROM an02_candidates WHERE an02_an05_id = ? AND an02_id IN ($in)");
            $c->execute(array_merge([$an05_id], $sel));
            if ((int)$c->fetchColumn() !== count($sel)) {
                $pdo->rollBack();
                mi_json_exit(422, ['ok' => false]);
            }
        }

        $pdo->prepare('INSERT INTO op12_gettoni_spesi (op12_hash, op12_an05_id) VALUES (?, ?)')
            ->execute([$hash, $an05_id]);

        $up = $pdo->prepare(
            'UPDATE an02_candidates
                SET an02_votes        = COALESCE(an02_votes, 0) + 1,
                    an02_vote_crypt   = AES_ENCRYPT(COALESCE(AES_DECRYPT(an02_vote_crypt, ?), 0) + 1, ?),
                    an02_vote_control = AES_DECRYPT(an02_vote_crypt, ?)
              WHERE an02_id = ? AND an02_an05_id = ?'
        );
        foreach ($sel as $cid) {
            $up->execute([$AES_key, $AES_key, $AES_key, $cid, $an05_id]);
        }

        $scelte = $sel;
        sort($scelte, SORT_NUMERIC);
        if ($firmaV === 2) {
            // p e firma pubblicati con l'urna: chiunque verifica che scelte e nomi sono quelli firmati
            $pdo->prepare(
                'INSERT INTO op11_schede (op11_id, op11_an05_id, op11_ricevuta_hash, op11_scelte, op11_p, op11_firma, op11_data)
                 VALUES (?, ?, ?, ?, ?, ?, CURDATE())'
            )->execute([bin2hex(random_bytes(16)), $an05_id, mi_receipt_hash($an05_id, $ricevuta), implode(',', $scelte),
                        bin2hex($pPub), bin2hex($s)]);
        } else {
            $pdo->prepare(
                'INSERT INTO op11_schede (op11_id, op11_an05_id, op11_ricevuta_hash, op11_scelte, op11_data)
                 VALUES (?, ?, ?, ?, CURDATE())'
            )->execute([bin2hex(random_bytes(16)), $an05_id, mi_receipt_hash($an05_id, $ricevuta), implode(',', $scelte)]);
        }

        $pdo->commit();
    }
} catch (Throwable $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[AN05_voto_urna] errore interno');
    mi_json_exit(500, ['ok' => false]);
}

// scheda realmente salvata (trasparenza: riquadro "Nell'urna")
$scheda = null;
try {
    $st = $pdo->prepare('SELECT op11_scelte, op11_data, op11_ricevuta_hash FROM op11_schede WHERE op11_ricevuta_hash = ? AND op11_an05_id = ?');
    $st->execute([mi_receipt_hash($an05_id, $ricevuta), $an05_id]);
    $sc = $st->fetch() ?: [];
    $nomi = [];
    if (!empty($sc['op11_scelte'])) {
        // 21/11/2026: nomi dalla lista decifrata (nomi dei candidati cifrati, AN05_cand_lista)
        $ids = array_map('intval', explode(',', (string)$sc['op11_scelte']));
        foreach (AN05_cand_lista($an05_id) as $c) {
            if (in_array((int)$c[0], $ids, true)) {
                $nomi[] = $c[1];
            }
        }
        sort($nomi);
    }
    $scheda = [
        'scelte'   => $nomi,
        'giorno'   => empty($sc['op11_data']) ? null : date('d/m/Y', strtotime((string)$sc['op11_data'])),
        'impronta' => substr((string)($sc['op11_ricevuta_hash'] ?? ''), 0, 16) . '...',
    ];
} catch (Throwable $ex) {
    $scheda = null;
}

mi_json_exit(200, ['ok' => true, 'ricevuta' => $ricevuta, 'ripresa' => $ripresa, 'scheda' => $scheda]);
