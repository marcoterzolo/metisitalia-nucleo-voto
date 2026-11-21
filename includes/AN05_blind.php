<?php
/**
 * =============================================================================
 * includes/AN05_blind.php - FIRMA CIECA (blind signature RSA, Chaum)
 * -----------------------------------------------------------------------------
 * Scopo: rendere IMPOSSIBILE (non solo "non salvato") il collegamento fra
 * elettore e scheda, anche per chi gestisce server e database.
 *
 * Schema (RSA-FDH, Full Domain Hash):
 *   n, e, d   chiave RSA 2048 bit DEDICATA a una sola votazione
 *   t         gettone casuale di 32 byte, generato nel browser dell'elettore
 *   ctx       "MI-AN05-BLIND-v1|" + an05_id_web  (lega il gettone alla votazione)
 *   m         = FDH(t, ctx) = MGF1-SHA256(t || ctx) lungo k byte, bit alto a 0
 *               (cosi' m < n sempre)
 *   r         numero casuale del browser, primo con n (la "maschera")
 *   b         = m * r^e mod n         -> inviato al server con il link personale
 *   s'        = b^d mod n             -> firma del server (non vede m ne' t)
 *   s         = s' * r^-1 mod n = m^d -> il browser toglie la maschera
 *   verifica:   s^e mod n == FDH(t, ctx)
 * La scheda arriva poi con (t, s) in una richiesta anonima: il server vede
 * una firma valida ma non puo' collegarla a b (r e' noto solo al browser).
 *
 * Operazioni RSA "grezze" con OpenSSL e OPENSSL_NO_PADDING:
 *   openssl_private_encrypt(x) = x^d mod n   (firma)
 *   openssl_public_decrypt(x)  = x^e mod n   (verifica)
 * Nessuna estensione gmp/bcmath ne' libreria esterna: funziona su Aruba.
 *
 * Sicurezza:
 *  - chiave diversa per ogni votazione, usata SOLO per questa firma;
 *  - privata salvata CIFRATA (PKCS#8 AES-256) con la frase MI_BLIND_SECRET
 *    definita in includes/env.php: chi legge solo il DB non puo' firmare;
 *  - il firmatario accetta solo valori di esattamente k byte e < n;
 *  - nessun log di b, s, t o della chiave.
 * Il giro di firma "una per elettore" e i gettoni spesi sono gestiti dal
 * flusso di voto (secondo giro); qui ci sono solo le primitive.
 *
 * Funzioni:
 *   AN05B_pronto(): ?string            null se l'ambiente va bene, altrimenti motivo
 *   AN05B_ctx($an05_id_web)            contesto della votazione
 *   AN05B_genera(): array              ['priv' => PEM cifrato, 'pub' => PEM]
 *   AN05B_privata($pemCifrato)         chiave privata OpenSSL (o eccezione)
 *   AN05B_pubblica_dati($pemPub)       ['n' => hex, 'e' => hex, 'k' => byte]
 *   AN05B_fdh($t, $ctx, $k)            m in binario (k byte)
 *   AN05B_firma($priv, $b)             s' in binario (o eccezione)
 *   AN05B_verifica($pemPub, $t, $ctx, $s): bool
 *   AN05B_hash_gettone($t, $ctx)       sha256 esadecimale (per i gettoni spesi)
 *   AN05B_chiavi_votazione($an05_id)   crea (una volta) e restituisce la pubblica
 *   AN05B_chiavi_votazione_in_tx(...)  idem, dentro una transazione gia' aperta
 *   AN05B_dati_browser($id, $idWeb)    {n, e, k, ctx} per js/AN05_blind.js
 *   AN05B_privata_votazione($an05_id)  chiave privata della votazione
 *   AN05B_impronta_chiave($dati)       impronta XXXX-XXXX-XXXX-XXXX della chiave della
 *                                      votazione (08/11/2026, uguale per tutti)
 *   AN05B_attiva($blindOn): bool       votazione con firma cieca E ambiente pronto
 *   AN05B_ricevuta($t, $ctx)           codice ricevuta XXXX-XXXX-XXXX derivato dal
 *                                      gettone (stesso gettone = stessa ricevuta:
 *                                      serve alla ripresa se la risposta va persa)
 *   AN05B_scrutinio_sec()              secondi dopo la fine in cui l'urna accetta
 *                                      ancora le schede gia' firmate (nucleo v1.3)
 *   --- nucleo v1.4 (21/11/2026): firma anche su scelte e lista dei candidati ---
 *   AN05B_firma_v($an05_id): int       1 = firma sul solo gettone, 2 = anche scelte
 *   AN05B_nome($nome, $cognome)        nome del candidato in forma canonica
 *   AN05B_sigillo($idWeb, $lista)      SIGILLO della lista dei candidati (64 esa)
 *   AN05B_breve($esa)                  XXXX-XXXX-XXXX-XXXX (primi 16 caratteri)
 *   AN05B_pub($t, $ctx)                parte PUBBLICA del gettone p (32 byte)
 *   AN05B_ctx_scelte($idWeb, $sig, $ids) messaggio firmato con le scelte
 *   AN05B_verifica_scheda($pemPub, $p, $idWeb, $sig, $ids, $s): bool
 *
 * FIRMA SULLE SCELTE (versione 2, nucleo v1.4, 21/11/2026). Prima (versione 1)
 * il server firmava alla cieca solo m = FDH(t, ctx): la firma provava il diritto
 * di voto ma non le scelte, e chi poteva scrivere nel database poteva cambiare
 * le scelte di una scheda o scambiare i nomi di due candidati senza rompere
 * nulla. Con la versione 2 il browser, quando l'elettore conferma, calcola:
 *   sigillo = SHA-256("MI-AN05-CANDIDATI-v1|" + id votazione + "\n" + righe)
 *             righe = "id<TAB>nome" di tutti i candidati per id crescente, una per
 *             riga ("\n"); nome = AN05B_nome (cosi' come mostrato sulla scheda)
 *   p       = SHA-256("MI-AN05-PUB|" + ctx + "|" + t)   (32 byte, pubblicabile:
 *             da p non si ricava t, quindi nemmeno la ricevuta)
 *   ctx2    = "MI-AN05-SCHEDA-v2|" + id votazione + "|" + sigillo + "|" + id scelti
 *             in ordine crescente separati da virgola
 *   m       = FDH(p, ctx2)   -> mascherato e firmato alla cieca come prima
 * L'urna verifica s^e = FDH(p, ctx2) ricalcolando il sigillo dalla lista del
 * database: se scelte o nomi sono stati cambiati dopo la firma, la scheda e'
 * rifiutata. Ogni scheda nell'urna pubblica porta p e s: chiunque, con la
 * chiave pubblica della votazione e la lista dei candidati pubblicata con il
 * suo sigillo, verifica TUTTE le firme (js/AN05_risultati.js, "Riconta").
 * Il gettone t resta segreto (gettoni spesi e ricevuta come prima).
 * Le votazioni la cui chiave esisteva prima del 21/11/2026 restano in
 * versione 1 (colonna an05_groups.an05_firma_v, _sql/MI_fase46_firma_scelte.sql).
 *
 * Chiusura (nucleo v1.3, collaudo del 21/11/2026, M1): si vota fino all'ora di
 * fine (le firme si rilasciano fino a quel momento, AN05_voto_firma.php). Le
 * schede firmate prima della fine sono ancora "in viaggio" per l'attesa
 * casuale di 5-20 s: l'urna le accetta per AN05B_scrutinio_sec() secondi dopo
 * la fine e poi piu' nulla. Risultati, verbale, impronta dell'urna e avviso di
 * chiusura si pubblicano SOLO dopo quel minuto (AN05_scrutinio_pronto() in
 * includes/AN05_lib.php), quindi non possono piu' cambiare dopo l'uscita.
 * Dopo la fine non si puo' iniziare un voto: nell'urna entrano solo firme
 * rilasciate prima della chiusura. Prima (v1.0-v1.2) l'urna accettava schede
 * per 15 minuti mentre i risultati erano gia' pubblici (AN05B_ritardo_max, tolta).
 * =============================================================================
 */
require_once __DIR__ . '/security.php';

if (!function_exists('AN05B_pronto')) {

    define('AN05B_BITS', 2048);
    define('AN05B_TOKEN', 32);                  // byte del gettone
    define('AN05B_VERSION', 'MI-AN05-BLIND-v1');
    define('AN05B_SCHEDA', 'MI-AN05-SCHEDA-v2');      // nucleo v1.4: firma anche sulle scelte

    function AN05B_pronto(): ?string
    {
        if (!extension_loaded('openssl')) {
            return 'openssl';
        }
        if (!defined('OPENSSL_NO_PADDING')) {
            return 'no_padding';
        }
        if (!defined('MI_BLIND_SECRET') || !is_string(MI_BLIND_SECRET) || strlen(MI_BLIND_SECRET) < 32) {
            return 'segreto';
        }
        return null;
    }

    function AN05B_ctx(string $an05_id_web): string
    {
        return AN05B_VERSION . '|' . $an05_id_web;
    }

    function AN05B_genera(): array
    {
        if (($m = AN05B_pronto()) !== null) {
            throw new RuntimeException('AN05B ambiente: ' . $m);
        }
        $cfg = ['private_key_bits' => AN05B_BITS, 'private_key_type' => OPENSSL_KEYTYPE_RSA];
        $key = openssl_pkey_new($cfg);
        if ($key === false) {
            throw new RuntimeException('AN05B generazione chiave non riuscita');
        }
        $priv = '';
        $ok = openssl_pkey_export($key, $priv, MI_BLIND_SECRET, $cfg + ['encrypt_key_cipher' => OPENSSL_CIPHER_AES_256_CBC]);
        $det = openssl_pkey_get_details($key);
        if (!$ok || $det === false || ($det['rsa']['e'] ?? '') === '') {
            throw new RuntimeException('AN05B esportazione chiave non riuscita');
        }
        return ['priv' => $priv, 'pub' => $det['key']];
    }

    function AN05B_privata(string $pemCifrato)
    {
        if (($m = AN05B_pronto()) !== null) {
            throw new RuntimeException('AN05B ambiente: ' . $m);
        }
        $k = openssl_pkey_get_private($pemCifrato, MI_BLIND_SECRET);
        if ($k === false) {
            throw new RuntimeException('AN05B chiave privata non leggibile');
        }
        return $k;
    }

    /** n ed e in esadecimale (big-endian) e lunghezza k in byte, per il browser */
    function AN05B_pubblica_dati(string $pemPub): array
    {
        $det = openssl_pkey_get_details(openssl_pkey_get_public($pemPub));
        $n = ltrim($det['rsa']['n'], "\0");
        return ['n' => bin2hex($n), 'e' => bin2hex($det['rsa']['e']), 'k' => strlen($n)];
    }

    /** MGF1 con SHA-256 (RFC 8017, B.2.1) */
    function AN05B_mgf1(string $seed, int $len): string
    {
        $out = '';
        for ($i = 0; strlen($out) < $len; $i++) {
            $out .= hash('sha256', $seed . pack('N', $i), true);
        }
        return substr($out, 0, $len);
    }

    /** Full Domain Hash: k byte, bit piu' alto a 0 (quindi m < n, n ha il bit alto a 1) */
    function AN05B_fdh(string $t, string $ctx, int $k): string
    {
        $m = AN05B_mgf1($t . $ctx, $k);
        $m[0] = chr(ord($m[0]) & 0x7F);
        return $m;
    }

    /** n in binario (k byte) dalla chiave */
    function AN05B_modulo($key): string
    {
        $det = openssl_pkey_get_details($key);
        return ltrim($det['rsa']['n'], "\0");
    }

    /** valore binario accettabile: esattamente k byte, diverso da 0, minore di n */
    function AN05B_valido(string $x, string $n): bool
    {
        return strlen($x) === strlen($n) && strcmp($x, $n) < 0 && trim($x, "\0") !== '';
    }

    /** firma cieca: s' = b^d mod n */
    function AN05B_firma($priv, string $b): string
    {
        $n = AN05B_modulo($priv);
        if (!AN05B_valido($b, $n)) {
            throw new InvalidArgumentException('AN05B valore da firmare non valido');
        }
        $s = '';
        if (!openssl_private_encrypt($b, $s, $priv, OPENSSL_NO_PADDING)) {
            throw new RuntimeException('AN05B firma non riuscita');
        }
        return str_pad($s, strlen($n), "\0", STR_PAD_LEFT);
    }

    /** verifica: s^e mod n == FDH(t, ctx) (versione 1, firma sul solo gettone) */
    function AN05B_verifica(string $pemPub, string $t, string $ctx, string $s): bool
    {
        if (strlen($t) !== AN05B_TOKEN) {
            return false;
        }
        return AN05B_verifica_msg($pemPub, $t, $ctx, $s);
    }

    /** verifica generica: s^e mod n == FDH(seme, contesto) */
    function AN05B_verifica_msg(string $pemPub, string $seme, string $ctx, string $s): bool
    {
        $pub = openssl_pkey_get_public($pemPub);
        if ($pub === false) {
            return false;
        }
        $n = AN05B_modulo($pub);
        if (!AN05B_valido($s, $n)) {
            return false;
        }
        $x = '';
        if (!openssl_public_decrypt($s, $x, $pub, OPENSSL_NO_PADDING)) {
            return false;
        }
        $x = str_pad($x, strlen($n), "\0", STR_PAD_LEFT);
        return hash_equals(AN05B_fdh($seme, $ctx, strlen($n)), $x);
    }

    /* ------------------- nucleo v1.4: firma sulle scelte ------------------- */

    /** versione della firma della votazione: 2 = anche scelte e lista (colonna mancante = 1) */
    function AN05B_firma_v(int $an05_id): int
    {
        try {
            $st = mi_pdo()->prepare('SELECT an05_firma_v FROM an05_groups WHERE an05_id = ?');
            $st->execute([$an05_id]);
            return (int)$st->fetchColumn() === 2 ? 2 : 1;
        } catch (Throwable $ex) {
            return 1;                    // SQL fase46 non ancora eseguito
        }
    }

    /** nome del candidato come appare su scheda, urna e sigillo (niente tab/a capo) */
    function AN05B_nome(string $nome, string $cognome): string
    {
        return trim(str_replace(["\t", "\r", "\n"], ' ', $nome . ' ' . $cognome));
    }

    /** sigillo della lista: $lista = [[id, nome canonico], ...] (qualsiasi ordine) */
    function AN05B_sigillo(string $an05_id_web, array $lista): string
    {
        usort($lista, static function ($a, $b) { return (int)$a[0] <=> (int)$b[0]; });
        $righe = [];
        foreach ($lista as $c) {
            $righe[] = (int)$c[0] . "\t" . (string)$c[1];
        }
        return hash('sha256', 'MI-AN05-CANDIDATI-v1|' . $an05_id_web . "\n" . implode("\n", $righe));
    }

    /** XXXX-XXXX-XXXX-XXXX da un'impronta esadecimale */
    function AN05B_breve(string $esa): string
    {
        return implode('-', str_split(strtoupper(substr($esa, 0, 16)), 4));
    }

    /** parte pubblica del gettone: p = SHA-256("MI-AN05-PUB|" + ctx + "|" + t), 32 byte */
    function AN05B_pub(string $t, string $ctx): string
    {
        return hash('sha256', 'MI-AN05-PUB|' . $ctx . '|' . $t, true);
    }

    /** contesto firmato insieme a p: votazione, sigillo della lista, id scelti in ordine */
    function AN05B_ctx_scelte(string $an05_id_web, string $sigillo, array $ids): string
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        sort($ids, SORT_NUMERIC);
        return AN05B_SCHEDA . '|' . $an05_id_web . '|' . $sigillo . '|' . implode(',', $ids);
    }

    /** verifica di una scheda versione 2 (p binario 32 byte, s binario) */
    function AN05B_verifica_scheda(string $pemPub, string $p, string $an05_id_web, string $sigillo, array $ids, string $s): bool
    {
        if (strlen($p) !== 32 || !$ids) {
            return false;
        }
        return AN05B_verifica_msg($pemPub, $p, AN05B_ctx_scelte($an05_id_web, $sigillo, $ids), $s);
    }

    function AN05B_hash_gettone(string $t, string $ctx): string
    {
        return hash('sha256', $ctx . '|' . $t);
    }

    /**
     * Chiave pubblica della votazione; la crea alla prima richiesta
     * (transazione + FOR UPDATE: mai due chiavi per la stessa votazione).
     */
    function AN05B_chiavi_votazione(int $an05_id): string
    {
        $pdo = mi_pdo();
        $pdo->beginTransaction();
        try {
            $pub = AN05B_chiavi_votazione_in_tx($an05_id);
            $pdo->commit();
            return $pub;
        } catch (Throwable $ex) {
            $pdo->rollBack();
            throw $ex;
        }
    }

    /** come sopra ma dentro una transazione gia' aperta dal chiamante (riga an05 bloccata FOR UPDATE) */
    function AN05B_chiavi_votazione_in_tx(int $an05_id): string
    {
        $pdo = mi_pdo();
        $st = $pdo->prepare('SELECT an05_blind_pub FROM an05_groups WHERE an05_id = ? FOR UPDATE');
        $st->execute([$an05_id]);
        $pub = $st->fetchColumn();
        if ($pub === false) {
            throw new RuntimeException('AN05B votazione inesistente');
        }
        if ($pub === null || $pub === '') {
            $k = AN05B_genera();
            $pdo->prepare('UPDATE an05_groups SET an05_blind_pub = ?, an05_blind_priv = ? WHERE an05_id = ?')
                ->execute([$k['pub'], $k['priv'], $an05_id]);
            $pub = $k['pub'];
        }
        return (string)$pub;
    }

    /** chiave pubblica della votazione in formato per il browser, con il contesto */
    function AN05B_dati_browser(int $an05_id, string $an05_id_web): array
    {
        return AN05B_pubblica_dati(AN05B_chiavi_votazione($an05_id)) + ['ctx' => AN05B_ctx($an05_id_web)];
    }

    /**
     * (08/11/2026) IMPRONTA DELLA CHIAVE della votazione, uguale per TUTTI gli
     * elettori: SHA-256 di "MI-AN05-CHIAVE|" + ctx + "|" + n + "|" + e (n ed e in
     * esadecimale minuscolo come in AN05B_pubblica_dati), primi 16 caratteri
     * esadecimali maiuscoli a gruppi di 4 (XXXX-XXXX-XXXX-XXXX). Il browser la
     * calcola dalla chiave che usa davvero (js/AN05_blind.js, impronta) e la
     * mostra con la ricevuta; risultati e verbale mostrano quella del server: se
     * coincidono, nessun elettore ha ricevuto una chiave "personale" con cui
     * riconoscerlo.
     */
    function AN05B_impronta_chiave(array $dati): string
    {
        $h = strtoupper(substr(hash('sha256', 'MI-AN05-CHIAVE|' . $dati['ctx'] . '|' . $dati['n'] . '|' . $dati['e']), 0, 16));
        return implode('-', str_split($h, 4));
    }

    function AN05B_attiva($blindOn): bool
    {
        return (int)$blindOn === 1 && AN05B_pronto() === null;
    }

    function AN05B_ricevuta(string $t, string $ctx): string
    {
        $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $h = hash('sha256', 'MI-AN05-RICEVUTA|' . $ctx . '|' . $t, true);
        $out = '';
        for ($i = 0; $i < 12; $i++) {
            if ($i > 0 && $i % 4 === 0) {
                $out .= '-';
            }
            $out .= $alfabeto[ord($h[$i]) % 32];
        }
        return $out;
    }

    /**
     * Secondi dopo l'ora di fine in cui l'urna accetta ancora le schede firmate
     * prima della fine (attesa casuale 5-20 s + rete lenta). Risultati, verbale e
     * impronta escono solo dopo questo intervallo (AN05_scrutinio_pronto).
     */
    function AN05B_scrutinio_sec(): int
    {
        return 60;
    }

    function AN05B_privata_votazione(int $an05_id)
    {
        $st = mi_pdo()->prepare('SELECT an05_blind_priv FROM an05_groups WHERE an05_id = ?');
        $st->execute([$an05_id]);
        $pem = $st->fetchColumn();
        if (!is_string($pem) || $pem === '') {
            throw new RuntimeException('AN05B chiave della votazione assente');
        }
        return AN05B_privata($pem);
    }
}
