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
 *   AN05B_ritardo_max()                secondi di tolleranza dopo la chiusura per
 *                                      le schede firmate prima della chiusura
 * =============================================================================
 */
require_once __DIR__ . '/security.php';

if (!function_exists('AN05B_pronto')) {

    define('AN05B_BITS', 2048);
    define('AN05B_TOKEN', 32);                  // byte del gettone
    define('AN05B_VERSION', 'MI-AN05-BLIND-v1');

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

    /** verifica: s^e mod n == FDH(t, ctx) */
    function AN05B_verifica(string $pemPub, string $t, string $ctx, string $s): bool
    {
        if (strlen($t) !== AN05B_TOKEN) {
            return false;
        }
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
        return hash_equals(AN05B_fdh($t, $ctx, strlen($n)), $x);
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

    /** le schede firmate prima della chiusura possono arrivare fino a 15 minuti dopo (ritardo casuale, rete lenta) */
    function AN05B_ritardo_max(): int
    {
        return 900;
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
