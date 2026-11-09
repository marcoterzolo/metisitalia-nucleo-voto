<?php
/**
 * =============================================================================
 * AN05_voto_firma.php - VOTO CON FIRMA CIECA, richiesta 1 di 2 (col link)
 * -----------------------------------------------------------------------------
 * Chiamata da js/AN05_voto.js per le votazioni con an05_blind_on = 1.
 * L'elettore si identifica con il token del suo link personale e manda il
 * gettone MASCHERATO b (vedi js/AN05_blind.js). Il server:
 *   1. in transazione (FOR UPDATE): votazione aperta e con firma cieca,
 *      elettore di quella votazione che non ha ancora votato;
 *   2. segna an04_date_vote = CURDATE() (solo il giorno) con rowCount = 1:
 *      un elettore ottiene UNA sola firma;
 *   3. firma b alla cieca con la chiave della votazione (s' = b^d mod n) e
 *      salva sha256(b) e s' accanto all'elettore (an04_blind_b/_s);
 *   4. COMMIT, risposta {ok, s, salvato}, poi email di conferma
 *      partecipazione (senza scelte, senza ricevuta), dopo aver chiuso la
 *      connessione col browser.
 * NON riceve le scelte e NON vede il gettone: quindi non puo' sapere quale
 * scheda arrivera' poi in AN05_voto_urna.php.
 *
 * RIPRESA: se l'elettore ha gia' votato e rimanda lo STESSO b (il browser lo
 * conserva finche' la scheda non e' nell'urna), riceve la stessa firma s'
 * (rete caduta o pagina chiusa dopo il passo 3). Un b diverso -> 409.
 * Salvare b e s' non rompe il segreto: senza la maschera r, nota solo al
 * browser, non si collegano al gettone ne' alla scheda.
 *
 * DELEGHE (07/11/2026, includes/AN05_deleghe.php, _sql/MI_fase34_deleghe.sql):
 * con il campo POST "delega" (id della delega) il DELEGATO, sempre col proprio
 * link, chiede la firma per la scheda del DELEGANTE. Nella stessa transazione:
 * delega della votazione, attiva, il cui delegato ha QUESTO link (FOR UPDATE);
 * poi tutto come sopra ma sulla riga del delegante (an04_date_vote, b, s');
 * la delega passa a "usata" (solo il giorno). Ripresa: delega gia' usata e
 * stesso b -> stessa firma. Al delegante va l'email "il tuo delegato ha
 * votato" invece della conferma di partecipazione. Senza "delega", chi ha una
 * delega in corso (richiesta o attiva) non puo' votare col proprio link (409,
 * codice "delegato"). L'urna resta identica: nessun legame scheda-persona.
 * VERIFICA AL PRIMO CLIC (07/11/2026): se la votazione la chiede e in questa
 * sessione non e' stata superata col link di chi vota -> 403 codice "accesso".
 *
 * Sicurezza: POST con CSRF (mi_session_start), token validato, b esadecimale
 * di esattamente k byte e < n (AN05B_firma), PDO preparate, nessun log di
 * token, b o firme. Errori: 409 gia' votato/chiusa, 422 dati non validi,
 * 500 interno.
 * NUCLEO 1.1 (09/11/2026): nome e cognome dell'elettore sono cifrati con la
 * chiave della votazione (includes/AN05_cripto.php): il riquadro "Su di te"
 * li decifra (AN05C_d) prima di mostrarli. Nient'altro e' cambiato.
 * =============================================================================
 */
require_once __DIR__ . '/includes/AN05_lib.php';
require_once __DIR__ . '/includes/AN05_blind.php';
require_once __DIR__ . '/includes/AN05_mail_voto.php';
require_once __DIR__ . '/includes/AN05_deleghe.php';
mi_session_start();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    mi_json_exit(405, ['ok' => false]);
}

$idWeb = (string)($_POST['an05_id_web'] ?? '');
$token = (string)($_POST['an04_id_web'] ?? '');
$bHex  = (string)($_POST['b'] ?? '');
if (!mi_valid_uuid($idWeb) || !mi_valid_uuid($token) || $bHex === '' || strlen($bHex) > 1024
    || strlen($bHex) % 2 !== 0 || !ctype_xdigit($bHex)) {
    mi_json_exit(422, ['ok' => false]);
}
// verifica al primo clic (07/11/2026, includes/AN05_impostazioni.php): sul link di chi vota
require_once __DIR__ . '/includes/AN05_impostazioni.php';
$gAcc = mi_pdo()->prepare('SELECT an05_id FROM an05_groups WHERE an05_id_web = ?');
$gAcc->execute([$idWeb]);
if (!AN05_imp_accesso_ok((int)$gAcc->fetchColumn(), $idWeb, $token)) {
    mi_json_exit(403, ['ok' => false, 'codice' => 'accesso']);
}
$b = hex2bin($bHex);
$bHash = hash('sha256', $b);
$delegaId = (int)($_POST['delega'] ?? 0);      // > 0: scheda del delegante votata dal delegato

$pdo = mi_pdo();
$ripresa = false;
$tokenLink = $token;                            // link di chi sta votando (delegato o elettore)
$delega = null;
try {
    $pdo->beginTransaction();
    if ($delegaId > 0) {
        $gid = $pdo->prepare('SELECT an05_id FROM an05_groups WHERE an05_id_web = ? AND an05_is_deteled = 0');
        $gid->execute([$idWeb]);
        $delega = AN05_dg_per_voto($pdo, (int)$gid->fetchColumn(), $tokenLink, $delegaId);
        if (!$delega) {
            $pdo->rollBack();
            mi_json_exit(409, ['ok' => false, 'codice' => 'delega']);
        }
        $token = (string)$delega['delegante_token'];   // da qui si lavora sulla riga del delegante
    }
    $st = $pdo->prepare(
        'SELECT an05_id, an05_blind_on, an04_id, an04_date_vote, an04_blind_b, an04_blind_s
           FROM an05_groups
          INNER JOIN an04_voters ON an04_an05_id = an05_id
          WHERE an05_id_web = ? AND an04_password = ? AND an05_is_deteled = 0
            AND NOW() >= an05_star_date AND NOW() <= an05_end_date
          FOR UPDATE'
    );
    $st->execute([$idWeb, $token]);
    $r = $st->fetch();
    if (!$r || !AN05B_attiva($r['an05_blind_on'])) {
        $pdo->rollBack();
        mi_json_exit(409, ['ok' => false]);
    }
    $an05_id = (int)$r['an05_id'];
    if (!$delega && $r['an04_date_vote'] === null && AN05_dg_blocca_voto($pdo, $an05_id, (int)$r['an04_id'])) {
        $pdo->rollBack();                        // ha delegato: vota il delegato
        mi_json_exit(409, ['ok' => false, 'codice' => 'delegato']);
    }
    if ($delega && $r['an04_date_vote'] !== null && $delega['AN05_OP13_Stato'] !== 'usata') {
        $pdo->rollBack();                        // il delegante risulta gia' votante: niente seconda firma
        mi_json_exit(409, ['ok' => false]);
    }

    if ($r['an04_date_vote'] !== null) {
        // ripresa: stesso valore mascherato -> stessa firma
        if (!empty($r['an04_blind_b']) && hash_equals((string)$r['an04_blind_b'], $bHash) && !empty($r['an04_blind_s'])) {
            $pdo->commit();
            $ripresa = true;
            $sHex = (string)$r['an04_blind_s'];
        } else {
            $pdo->rollBack();
            mi_json_exit(409, ['ok' => false]);
        }
    } else {
        AN05B_chiavi_votazione_in_tx($an05_id);
        try {
            $s = AN05B_firma(AN05B_privata_votazione($an05_id), $b);
        } catch (InvalidArgumentException $ex) {
            $pdo->rollBack();
            mi_json_exit(422, ['ok' => false]);
        }
        $sHex = bin2hex($s);
        $up = $pdo->prepare(
            'UPDATE an04_voters SET an04_date_vote = CURDATE(), an04_blind_b = ?, an04_blind_s = ?
              WHERE an04_password = ? AND an04_an05_id = ? AND an04_date_vote IS NULL'
        );
        $up->execute([$bHash, $sHex, $token, $an05_id]);
        if ($up->rowCount() !== 1) {
            $pdo->rollBack();
            mi_json_exit(409, ['ok' => false]);
        }
        if ($delega && !AN05_dg_segna_usata($pdo, (int)$delega['AN05_OP13_ID'])) {
            $pdo->rollBack();
            mi_json_exit(409, ['ok' => false, 'codice' => 'delega']);
        }
        $pdo->commit();
    }
} catch (Throwable $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[AN05_voto_firma] errore interno');
    mi_json_exit(500, ['ok' => false]);
}

// riga elettore realmente salvata (trasparenza: riquadro "Su di te")
$salvato = null;
try {
    $st = $pdo->prepare(
        'SELECT an04_firstname, an04_lastname, an04_email IS NOT NULL AND an04_email <> \'\' AS ha_email,
                an04_date_send_email, an04_date_read_email, an04_date_vote
           FROM an04_voters WHERE an04_password = ? AND an04_an05_id = ?'
    );
    $st->execute([$token, $an05_id]);
    $e = $st->fetch() ?: [];
    $d = static function ($v) { return ($v === null || $v === '') ? null : date('d/m/Y', strtotime((string)$v)); };
    $salvato = [
        'nome'   => trim(AN05C_d($an05_id, 'an04_firstname', $e['an04_firstname'] ?? '') . ' ' . AN05C_d($an05_id, 'an04_lastname', $e['an04_lastname'] ?? '')),
        'email'  => !empty($e['ha_email']),
        'invito' => $d($e['an04_date_send_email'] ?? null),
        'letta'  => $d($e['an04_date_read_email'] ?? null),
        'votato' => $d($e['an04_date_vote'] ?? null),
    ];
} catch (Throwable $ex) {
    $salvato = null;
}

// risposta al browser, poi (a connessione chiusa) l'email di conferma
$json = json_encode(['ok' => true, 's' => $sHex, 'ripresa' => $ripresa, 'elettore' => $salvato], JSON_UNESCAPED_UNICODE);
ignore_user_abort(true);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Content-Length: ' . strlen($json));
header('Connection: close');
echo $json;
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    @ob_flush();
    flush();
}
if (!$ripresa) {
    if ($delega) {
        AN05_dg_mail('usata', $an05_id, (int)$delega['AN05_OP13_ID']);   // al delegante
    } else {
        AN05_mail_conferma($an05_id, $token, AN05_lingua($idWeb));
    }
}
