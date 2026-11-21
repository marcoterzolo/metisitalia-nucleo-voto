/**
 * =============================================================================
 * js/AN05_blind.js - FIRMA CIECA lato browser (maschera / toglie la maschera)
 * -----------------------------------------------------------------------------
 * File volutamente breve e senza dipendenze, perche' un esperto di fiducia
 * dell'associazione possa leggerlo e verificare che il browser dell'elettore
 * NON mandi mai al server il gettone in chiaro insieme al suo link personale.
 * Corrisponde alla parte server in includes/AN05_blind.php.
 *
 * Schema (RSA-FDH, Chaum):
 *   t   gettone casuale di 32 byte (resta nel browser fino al voto anonimo)
 *   m   = FDH(t, ctx): MGF1-SHA256(t || ctx), k byte, bit piu' alto a 0
 *   r   maschera casuale, 1 < r < n, primo con n (resta SOLO nel browser)
 *   b   = m * r^e mod n          -> PRIMA richiesta, col link personale
 *   s'  = b^d mod n              <- risposta del server (firma alla cieca)
 *   s   = s' * r^-1 mod n        -> s = m^d: firma valida su m
 *   controllo locale: s^e mod n == m (se il server bara, ce ne accorgiamo)
 *   (t, s) + scelte              -> SECONDA richiesta, anonima
 * Il server vede b, che e' m moltiplicato per un numero casuale: senza r non
 * puo' risalire a m, quindi non puo' collegare (t, s) all'elettore.
 *
 * Requisiti: BigInt e crypto.subtle (tutti i browser moderni, solo https).
 * Numeri in esadecimale big-endian, come li produce il server (bin2hex).
 *
 * API (window.AN05B):
 *   supportato()                    true se il browser ha tutto il necessario
 *   gettone()                       Uint8Array(32) casuale
 *   fdh(t, ctx, k)                  Promise<BigInt> m
 *   maschera(m, pub)                {b: BigInt, r: BigInt}
 *   smaschera(sPrimo, r, pub)       BigInt s
 *   verifica(s, m, pub)             true se s^e mod n == m
 *   esa(x, k) / daEsa(h)            BigInt <-> esadecimale di k byte
 *   byteEsa(u8) / esaByte(h)        Uint8Array <-> esadecimale
 *   pub = {n: BigInt, e: BigInt, k: numero di byte} -> chiave(datiServer)
 *   impronta(datiServer)            Promise<"XXXX-XXXX-XXXX-XXXX"> impronta della chiave
 *                                   della votazione (08/11/2026, = AN05B_impronta_chiave)
 *   --- nucleo v1.4 (21/11/2026): firma anche su scelte e lista dei candidati ---
 *   sigillo(idWeb, lista)           Promise<esa 64> sigillo della lista [[id, nome], ...]
 *   breve(esa)                      "XXXX-XXXX-XXXX-XXXX"
 *   pub(t, ctx)                     Promise<Uint8Array(32)> p = SHA-256("MI-AN05-PUB|"+ctx+"|"+t)
 *   ctxScelte(idWeb, sig, ids)      "MI-AN05-SCHEDA-v2|" + id + "|" + sigillo + "|" + id scelti
 *   messaggio(t, ctx, idWeb, sig, ids, k)  Promise<BigInt> m = FDH(p, ctxScelte)
 *   verificaScheda(pEsa, sEsa, idWeb, sig, ids, pub)  Promise<bool> (riconteggio pubblico)
 * Stesse formule di includes/AN05_blind.php (AN05B_sigillo, AN05B_pub,
 * AN05B_ctx_scelte): il server firma alla cieca m, quindi la firma copre il
 * gettone, le scelte e i nomi dei candidati che l'elettore aveva davanti.
 * 21/11/2026 (nucleo v1.5, SCHEDA BIANCA): verificaScheda accetta anche zero scelte (scheda
 *  bianca: il messaggio firmato finisce con "|" e la firma copre il fatto che e' vuota).
 * =============================================================================
 */
(function (w) {
    'use strict';

    // --- conversioni ------------------------------------------------------
    function daEsa(h) { return BigInt('0x' + (h || '0')); }
    function esa(x, k) {
        var h = x.toString(16);
        while (h.length < k * 2) { h = '0' + h; }
        return h;
    }
    function byteEsa(u8) {
        return Array.prototype.map.call(u8, function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('');
    }
    function esaByte(h) {
        var out = new Uint8Array(h.length / 2);
        for (var i = 0; i < out.length; i++) { out[i] = parseInt(h.substr(i * 2, 2), 16); }
        return out;
    }
    function chiave(d) { return { n: daEsa(d.n), e: daEsa(d.e), k: d.k }; }

    // --- aritmetica modulare --------------------------------------------
    function potMod(b, e, n) {                       // b^e mod n (quadra e moltiplica)
        var r = 1n;
        b %= n;
        while (e > 0n) {
            if (e & 1n) { r = (r * b) % n; }
            b = (b * b) % n;
            e >>= 1n;
        }
        return r;
    }
    function invMod(a, n) {                          // a^-1 mod n (Euclide esteso)
        var t = 0n, nt = 1n, r = n, nr = a % n, q, tmp;
        while (nr !== 0n) {
            q = r / nr;
            tmp = t - q * nt; t = nt; nt = tmp;
            tmp = r - q * nr; r = nr; nr = tmp;
        }
        if (r !== 1n) { throw new Error('maschera non invertibile'); }
        return t < 0n ? t + n : t;
    }
    function mcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

    // --- casualita' -------------------------------------------------------
    function casuali(len) { var u = new Uint8Array(len); w.crypto.getRandomValues(u); return u; }
    function gettone() { return casuali(32); }

    // --- hash: MGF1-SHA256 (RFC 8017) e Full Domain Hash -------------------
    async function mgf1(seed, len) {
        var out = new Uint8Array(len), pos = 0, i = 0;
        while (pos < len) {
            var buf = new Uint8Array(seed.length + 4);
            buf.set(seed, 0);
            buf.set([(i >>> 24) & 255, (i >>> 16) & 255, (i >>> 8) & 255, i & 255], seed.length);
            var h = new Uint8Array(await w.crypto.subtle.digest('SHA-256', buf));
            out.set(h.subarray(0, Math.min(32, len - pos)), pos);
            pos += 32; i++;
        }
        return out;
    }
    async function fdh(t, ctx, k) {
        var c = new TextEncoder().encode(ctx);
        var seed = new Uint8Array(t.length + c.length);
        seed.set(t, 0); seed.set(c, t.length);
        var m = await mgf1(seed, k);
        m[0] &= 0x7F;                                // m < n
        return daEsa(byteEsa(m));
    }

    // --- maschera / togli maschera / verifica -----------------------------
    function maschera(m, pub) {
        var r;
        do { r = daEsa(byteEsa(casuali(pub.k))) % pub.n; } while (r < 2n || mcd(r, pub.n) !== 1n);
        return { b: (m * potMod(r, pub.e, pub.n)) % pub.n, r: r };
    }
    function smaschera(sPrimo, r, pub) {
        if (sPrimo <= 0n || sPrimo >= pub.n) { throw new Error('firma fuori intervallo'); }
        return (sPrimo * invMod(r, pub.n)) % pub.n;
    }
    function verifica(s, m, pub) { return s > 0n && s < pub.n && potMod(s, pub.e, pub.n) === m; }

    // --- impronta della chiave (08/11/2026): stessa formula di AN05B_impronta_chiave ---
    // SHA-256("MI-AN05-CHIAVE|" + ctx + "|" + n + "|" + e), 16 caratteri a gruppi di 4
    async function impronta(d) {
        var h = new Uint8Array(await w.crypto.subtle.digest('SHA-256',
            new TextEncoder().encode('MI-AN05-CHIAVE|' + d.ctx + '|' + d.n + '|' + d.e)));
        var x = byteEsa(h).slice(0, 16).toUpperCase();
        return x.match(/.{4}/g).join('-');
    }

    // --- nucleo v1.4: firma sulle scelte (stesse formule di includes/AN05_blind.php) ---
    async function sha256(u8) { return new Uint8Array(await w.crypto.subtle.digest('SHA-256', u8)); }
    function unisci(a, b) { var u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u; }
    async function sigillo(idWeb, lista) {
        var l = lista.slice().sort(function (x, y) { return Number(x[0]) - Number(y[0]); });
        var righe = l.map(function (c) { return String(parseInt(c[0], 10)) + '\t' + String(c[1]); });
        return byteEsa(await sha256(new TextEncoder().encode('MI-AN05-CANDIDATI-v1|' + idWeb + '\n' + righe.join('\n'))));
    }
    function breve(h) { return String(h).slice(0, 16).toUpperCase().match(/.{4}/g).join('-'); }
    async function pub(t, ctx) { return sha256(unisci(new TextEncoder().encode('MI-AN05-PUB|' + ctx + '|'), t)); }
    function ctxScelte(idWeb, sig, ids) {
        var v = [];
        ids.forEach(function (x) { x = parseInt(x, 10); if (v.indexOf(x) < 0) { v.push(x); } });
        v.sort(function (a, b) { return a - b; });
        return 'MI-AN05-SCHEDA-v2|' + idWeb + '|' + sig + '|' + v.join(',');
    }
    async function messaggio(t, ctx, idWeb, sig, ids, k) { return fdh(await pub(t, ctx), ctxScelte(idWeb, sig, ids), k); }
    async function verificaScheda(pEsa, sEsa, idWeb, sig, ids, chiavePub) {
        if (!/^[0-9a-f]{64}$/.test(pEsa) || !/^[0-9a-f]+$/.test(sEsa)) { return false; }   // ids vuoto = scheda bianca (v1.5)
        var m = await fdh(esaByte(pEsa), ctxScelte(idWeb, sig, ids), chiavePub.k);
        return verifica(daEsa(sEsa), m, chiavePub);
    }

    function supportato() {
        return typeof BigInt === 'function' && !!(w.crypto && w.crypto.subtle && w.crypto.getRandomValues && w.TextEncoder);
    }

    w.AN05B = {
        supportato: supportato, gettone: gettone, fdh: fdh, maschera: maschera, smaschera: smaschera,
        verifica: verifica, esa: esa, daEsa: daEsa, byteEsa: byteEsa, esaByte: esaByte, chiave: chiave,
        impronta: impronta, sigillo: sigillo, breve: breve, pub: pub, ctxScelte: ctxScelte,
        messaggio: messaggio, verificaScheda: verificaScheda
    };
}(typeof window !== 'undefined' ? window : globalThis));
