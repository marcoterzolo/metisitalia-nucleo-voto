/**
 * =============================================================================
 * js/AN05_voto.js - logica della SCHEDA ELETTORE (ElectionDay.php)
 * -----------------------------------------------------------------------------
 * Legge la configurazione dagli attributi data-* di #AN05V_scheda
 * (stato, anteprima, max preferenze, id votazione, token elettore, testi i18n).
 *  - Card candidato = <button aria-pressed>: clic o Invio/Spazio per
 *    scegliere/togliere. Superato il massimo -> avviso SweetAlert2.
 *  - Barra fissa in basso: "Scelti X di N" + pulsante "Conferma voto"
 *    (attivo solo con almeno una scelta).
 *  - Conferma: riepilogo SweetAlert2 con i nomi scelti -> POST a
 *    an02_sendVote.php (token CSRF aggiunto da js/MI_csrf.js) ->
 *    schermata finale con il CODICE RICEVUTA (mostrato solo qui) e
 *    pulsante "Copia codice"; flash giallo sul codice.
 *  - Trasparenza: sotto la ricevuta due riquadri "Su di te" / "Nell'urna"
 *    riempiti con le righe realmente salvate (risposta di an02_sendVote.php,
 *    campo "salvato"), costruiti con textContent.
 *  - Errori: 409 (gia' votato / chiusa) e altri con messaggio chiaro.
 *  - Anteprima organizzatore: tutto funziona tranne l'invio.
 *  - Stato "non_iniziata": conto alla rovescia e ricarica all'apertura;
 *    pulsante "Aggiorna" (#AN05V_ricarica) collegato qui, non con onclick
 *    (la Content-Security-Policy blocca gli script nell'HTML).
 *  - Dopo il voto: riquadro col link pubblico AN05_verifica.php?v=... (senza
 *    ricevuta) e pulsante "Copia link" con flash giallo.
 *
 * FIRMA CIECA (data-blind presente, Fase 8) - al posto di an02_sendVote.php:
 *  1. gettone t casuale, m = FDH(t), maschera r -> b (js/AN05_blind.js);
 *  2. POST AN05_voto_firma.php con il link personale e b -> firma s';
 *     s = s' tolta la maschera, controllata nel browser (s^e = m);
 *  3. attesa casuale 5-20 s (finestra con conto alla rovescia: separa nel
 *     tempo le due richieste);
 *  4. POST AN05_voto_urna.php ANONIMA (credentials: 'omit': niente cookie,
 *     niente token del link, niente CSRF) con t, s e scelte -> ricevuta.
 *  Fino al deposito nell'urna, gettone, maschera, firma e scelte restano
 *  SOLO in questo browser (localStorage "AN05B_<votazione>") per la
 *  RIPRESA: se la pagina si chiude o la rete cade, riaprendo il link da
 *  questo dispositivo il voto si completa da solo (stessa firma, stessa
 *  ricevuta). Dopo il deposito i dati vengono cancellati. Nessun altro dato
 *  viene salvato nel browser.
 *
 * IMPRONTA DELLA CHIAVE (08/11/2026): con la ricevuta il browser mostra
 * l'impronta della chiave che ha usato (AN05B.impronta, testi T.impronta e
 * T.impronta_x): uguale per tutti, si confronta con risultati e verbale.
 *
 * DELEGHE (07/11/2026): data-schede = schede da votare con questo link
 * ([{k:'io'} e/o {k:<id delega>, nome}]). Con piu' schede (o solo deleghe)
 * sopra la griglia ci sono le linguette "La tua scheda" / "Per Mario Rossi":
 * una scheda alla volta, ognuna con il suo gettone, la sua firma (POST
 * "delega" = id ad AN05_voto_firma.php), il suo deposito anonimo e la sua
 * ricevuta. Ripresa separata per scheda: localStorage "AN05B_<votazione>"
 * per la propria, "AN05B_<votazione>_d<id>" per quelle dei deleganti
 * (data-usate = deleghe gia' usate, da completare se rimaste a meta').
 * Dopo ogni scheda: ricevuta + "Vota la prossima scheda" se ne restano.
 * Errori 409 con codice: "delegato" (ha delegato, non vota) e "delega"
 * (delega revocata o gia' usata).
 * 12/11/2026 (test sul live): dopo il voto proprio sparisce "Delega il tuo
 *   voto" (deleghePostVoto); dopo la scheda di una delega sparisce il suo
 *   "Rifiuta". "Vota la prossima scheda" ora sta subito sotto la ricevuta.
 * =============================================================================
 */
(function () {
    'use strict';

    /* pulsante "Aggiorna" della votazione non ancora aperta (niente onclick: CSP) */
    var ricarica = document.getElementById('AN05V_ricarica');
    if (ricarica) {
        ricarica.addEventListener('click', function () { window.location.reload(); });
    }

    var box = document.getElementById('AN05V_scheda');
    if (!box) { return; }

    var T = {};
    try { T = JSON.parse(box.getAttribute('data-i18n') || '{}'); } catch (e) { T = {}; }
    var stato     = box.getAttribute('data-stato');
    var anteprima = box.getAttribute('data-anteprima') === '1';
    var max       = parseInt(box.getAttribute('data-max'), 10) || 1;
    var an05      = box.getAttribute('data-an05');
    var an04      = box.getAttribute('data-an04');
    var B  = window.AN05B;      // js/AN05_blind.js (caricato solo con la firma cieca)
    var BL = null;
    try { BL = box.getAttribute('data-blind') ? JSON.parse(box.getAttribute('data-blind')) : null; } catch (e) { BL = null; }
    // deleghe: schede da votare con questo link, deleghe gia' usate (ripresa), voto proprio gia' dato
    var schede = [], usate = [];
    try { schede = JSON.parse(box.getAttribute('data-schede') || '[]') || []; } catch (e) { schede = []; }
    try { usate = JSON.parse(box.getAttribute('data-usate') || '[]') || []; } catch (e) { usate = []; }
    var ioVotato = box.getAttribute('data-io-votato') === '1';
    var cur = schede.length ? String(schede[0].k) : 'io';     // scheda in compilazione
    function nomeScheda(k) {
        for (var i = 0; i < schede.length; i++) { if (String(schede[i].k) === String(k)) { return schede[i].nome || ''; } }
        return '';
    }

    function fmt(s, n) { return String(s).replace('%d', n).replace('%s', n); }

    function flash(el) {
        el.classList.remove('AN05V_flash');
        void el.offsetWidth;
        el.classList.add('AN05V_flash');
    }

    /* ---------- link pubblico di verifica della ricevuta: "Copia link" ---------- */
    var vlBtn = document.getElementById('AN05V_verlink_copia');
    var vlUrl = document.getElementById('AN05V_verlink_url');
    if (vlBtn && vlUrl) {
        vlBtn.addEventListener('click', function () {
            var ok = function () { vlBtn.textContent = T.ver_copiato || 'OK'; flash(vlUrl); };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(vlUrl.value).then(ok, ok);
            } else {
                vlUrl.select();
                try { document.execCommand('copy'); } catch (e) { /* selezione lasciata all'utente */ }
                ok();
            }
        });
    }

    /* ---------- conto alla rovescia (votazione non ancora aperta) ---------- */
    if (stato === 'non_iniziata') {
        var cd = document.getElementById('AN05V_countdown');
        var inizio = parseInt(box.getAttribute('data-inizio'), 10) || 0;
        var delta = (parseInt(box.getAttribute('data-ora'), 10) || 0) * 1000 - Date.now();
        if (cd && inizio > 0) {
            var tick = function () {
                var s = Math.floor((inizio * 1000 - (Date.now() + delta)) / 1000);
                if (s <= 0) { window.location.reload(); return; }
                var g = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600),
                    m = Math.floor(s % 3600 / 60), x = s % 60;
                cd.textContent = (g ? g + T.g + ' ' : '') + h + T.h + ' ' + m + T.m + ' ' + x + T.s;
            };
            tick();
            setInterval(tick, 1000);
        }
        return;
    }
    if (stato === 'gia_votato' || stato === 'delegato') {
        if (BL && !BL.errore) { riprendiTutte(); }
        return;
    }
    if (stato !== 'aperta') { return; }

    /* ---------- scelta dei candidati ---------- */
    var griglia = document.getElementById('AN05V_griglia');
    var conta   = document.getElementById('AN05V_conta');
    var vota    = document.getElementById('AN05V_vota');
    var tplTxt  = document.getElementById('AN05V_tpl_scelti');
    var txtScelti = tplTxt ? tplTxt.innerHTML.replace(/&amp;/g, '&') : '%s / %d';

    function scelti() {
        return Array.prototype.slice.call(griglia.querySelectorAll('.AN05V_cand[aria-pressed="true"]'));
    }

    function aggiorna() {
        var n = scelti().length;
        conta.textContent = txtScelti.replace('%s', n).replace('%d', max);
        vota.disabled = n === 0;
        griglia.classList.toggle('AN05V_pieno', n >= max);
    }

    /* ---------- linguette delle schede (deleghe) ---------- */
    var linguette = document.getElementById('AN05V_linguette');
    var perBox = document.getElementById('AN05V_per');
    function scegliScheda(k) {
        cur = String(k);
        if (linguette) {
            Array.prototype.forEach.call(linguette.querySelectorAll('.AN05V_linguetta'), function (b) {
                b.setAttribute('aria-selected', b.getAttribute('data-k') === cur ? 'true' : 'false');
            });
        }
        if (perBox) {
            perBox.hidden = cur === 'io';
            perBox.textContent = cur === 'io' ? '' : fmt(T.per_banner, nomeScheda(cur));
            if (cur !== 'io') { flash(perBox); }
        }
        scelti().forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        aggiorna();
    }
    if (linguette) {
        linguette.addEventListener('click', function (ev) {
            var b = ev.target.closest('.AN05V_linguetta');
            if (b && !linguette.classList.contains('AN05V_bloccate')) { scegliScheda(b.getAttribute('data-k')); }
        });
    }

    griglia.addEventListener('click', function (ev) {
        var c = ev.target.closest('.AN05V_cand');
        if (!c) { return; }
        var on = c.getAttribute('aria-pressed') === 'true';
        if (!on && scelti().length >= max) {
            Swal.fire({ icon: 'info', text: fmt(T.max, max) });
            return;
        }
        c.setAttribute('aria-pressed', on ? 'false' : 'true');
        aggiorna();
        flash(conta);
    });

    /* ---------- conferma e invio ---------- */
    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    vota.addEventListener('click', function () {
        var sel = scelti();
        if (!sel.length) { Swal.fire({ icon: 'info', text: T.nessuno }); return; }
        var lista = sel.map(function (c) { return '<li>' + escHtml(c.getAttribute('data-nome')) + '</li>'; }).join('');
        Swal.fire({
            // titleText: il nome del delegante entra come testo, mai come HTML
            titleText: cur === 'io' ? T.conf_t : fmt(T.per_conf_t, nomeScheda(cur)),
            html: '<p>' + escHtml(T.conf_x) + '</p><ul class="AN05V_riep">' + lista + '</ul>' +
                  '<p class="AN05V_nota">' + escHtml(T.conf_nota) + '</p>',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: T.si,
            cancelButtonText: T.annulla,
            confirmButtonColor: '#28a745',
            reverseButtons: true,
            focusCancel: true
        }).then(function (r) {
            if (!(r && (r.isConfirmed || r.value))) { return; }
            if (anteprima) { Swal.fire({ icon: 'info', text: T.anteprima }); return; }
            var ids = sel.map(function (c) { return c.getAttribute('data-id'); });
            if (BL) { votaCieco(ids); } else { invia(ids); }
        });
    });

    function invia(ids) {
        vota.disabled = true;
        Swal.fire({ title: T.invio, allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        var fd = new FormData();
        fd.append('an05_id_web', an05);
        fd.append('an04_id_web', an04);
        fd.append('selectVote', ids.join(','));
        fetch('an02_sendVote.php', { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (res) {
                if (!res.ok) { throw res.status; }
                return res.json();
            })
            .then(function (j) {
                if (!j || !j.ok) { throw 0; }
                Swal.close();
                fatto(j.ricevuta || '', j.salvato || null);
            })
            .catch(function (cod) {
                Swal.fire({ icon: 'error', text: cod === 409 ? T.err_409 : T.err });
                vota.disabled = false;
            });
    }

    /* ======================= FIRMA CIECA ======================= */
    // (funzioni, non variabili: la ripresa nello stato "gia' votato" parte prima di questo punto del codice)
    // una chiave per scheda: la propria come prima, quelle dei deleganti con il suffisso _d<id>
    function chiaveLs(k) { return 'AN05B_' + an05 + (k && String(k) !== 'io' ? '_d' + k : ''); }
    function lsLeggi(k) { try { return JSON.parse(window.localStorage.getItem(chiaveLs(k)) || 'null'); } catch (e) { return null; } }
    function lsScrivi(k, v) { try { window.localStorage.setItem(chiaveLs(k), JSON.stringify(v)); } catch (e) { /* senza ripresa */ } }
    function lsCancella(k) { try { window.localStorage.removeItem(chiaveLs(k)); } catch (e) { /* niente */ } }

    function attendi(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

    function posta(url, dati, anonima) {
        var body = new URLSearchParams();
        Object.keys(dati).forEach(function (k) { body.append(k, dati[k]); });
        return fetch(url, {
            method: 'POST', body: body, cache: 'no-store',
            credentials: anonima ? 'omit' : 'same-origin',
            referrerPolicy: anonima ? 'no-referrer' : 'strict-origin-when-cross-origin'
        }).then(function (res) {
            if (!res.ok) {
                // 409 con codice (deleghe): "delegato" o "delega"; altrimenti il numero
                return res.json().catch(function () { return {}; }).then(function (j) {
                    throw (j && j.codice) ? 'c_' + j.codice : res.status;
                });
            }
            return res.json();
        });
    }

    // passo 2: firma alla cieca col link personale (anche per la ripresa: stesso b)
    async function chiediFirma(p, pub, k) {
        var dati = { an05_id_web: an05, an04_id_web: an04, b: B.esa(B.daEsa(p.b), pub.k) };
        if (k && String(k) !== 'io') { dati.delega = String(k); }      // scheda del delegante
        var j = await posta('AN05_voto_firma.php', dati, false);
        if (!j || !j.ok) { throw 0; }
        var m = await B.fdh(B.esaByte(p.t), BL.ctx, pub.k);
        var s = B.smaschera(B.daEsa(j.s), B.daEsa(p.r), pub);
        if (!B.verifica(s, m, pub)) { lsCancella(k); throw 'firma'; }
        p.s = B.esa(s, pub.k);
        p.elettore = j.elettore || null;
        lsScrivi(k, p);
        return p;
    }

    // passo 4: deposito anonimo, con qualche nuovo tentativo se la rete cade
    async function deposita(p) {
        var dati = { an05_id_web: an05, t: p.t, s: p.s, scelte: p.scelte.join(',') };
        for (var i = 0; i < 3; i++) {
            try {
                var j = await posta('AN05_voto_urna.php', dati, true);
                if (j && j.ok) { return j; }
                throw 0;
            } catch (cod) {
                if (cod === 409 || cod === 422 || i === 2) { throw cod === 409 || cod === 422 ? cod : 'urna'; }
                await attendi(2000 * (i + 1));
            }
        }
        throw 'urna';
    }

    // passo 3: attesa casuale 5-20 s con conto alla rovescia
    // (timer indipendente dalle callback di SweetAlert2: funziona con v9 e v10)
    function attesaCasuale() {
        var casuale = new Uint32Array(1);
        window.crypto.getRandomValues(casuale);
        var sec = 5 + (casuale[0] % 16);
        Swal.fire({
            title: T.dep_t, text: T.dep_x, footer: fmt(T.dep_s, sec),
            allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false
        });
        Swal.showLoading();
        return new Promise(function (ok) {
            var resta = sec;
            var it = setInterval(function () {
                resta--;
                var f = Swal.getFooter ? Swal.getFooter() : null;
                if (f) { f.textContent = fmt(T.dep_s, Math.max(resta, 0)); }
                if (resta <= 0) { clearInterval(it); ok(); }
            }, 1000);
        });
    }

    function attendiFinestra(titolo, testo) {
        Swal.fire({ title: titolo, text: testo || '', allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false });
        Swal.showLoading();
    }

    function concludi(p, j, k) {
        lsCancella(k);
        Swal.close();
        fatto(j.ricevuta || '', { elettore: p.elettore || {}, scheda: j.scheda || {} }, k);
    }

    function erroreCieco(cod) {
        var msg = cod === 'firma' ? T.err_firma : (cod === 409 ? T.err_409 : (cod === 'urna' ? T.err_urna : T.err));
        if (cod === 'c_accesso') { window.location.reload(); return; }   // verifica al primo clic scaduta: la pagina la richiede
        if (cod === 'c_delegato') { msg = T.err_delegato; }
        if (cod === 'c_delega') { msg = T.err_delega; }
        Swal.fire({ icon: 'error', text: msg });
        var bt = document.getElementById('AN05V_vota');
        if (bt) { bt.disabled = false; }
    }

    async function votaCieco(ids) {
        if (BL.errore) { Swal.fire({ icon: 'error', text: T.err_chiave }); return; }
        if (!window.AN05B || !B.supportato()) { Swal.fire({ icon: 'error', text: T.err_browser }); return; }
        vota.disabled = true;
        var k = cur;                           // la scheda resta quella anche se si cambia linguetta
        if (linguette) { linguette.classList.add('AN05V_bloccate'); }
        attendiFinestra(T.invio);
        try {
            var pub = B.chiave(BL);
            var t = B.gettone();
            var m = await B.fdh(t, BL.ctx, pub.k);
            var mk = B.maschera(m, pub);
            var p = { t: B.byteEsa(t), r: B.esa(mk.r, pub.k), b: B.esa(mk.b, pub.k), scelte: ids };
            lsScrivi(k, p);                    // salvato PRIMA di inviare: serve alla ripresa
            await chiediFirma(p, pub, k);
            await attesaCasuale();
            attendiFinestra(T.invio);
            concludi(p, await deposita(p), k);
        } catch (cod) {
            if (cod === 'c_delega' || cod === 'c_delegato') { lsCancella(k); }
            erroreCieco(cod);
        }
        if (linguette) { linguette.classList.remove('AN05V_bloccate'); }
    }

    // ripresa di un voto rimasto a meta' su questo dispositivo (k = 'io' o id della delega)
    async function riprendi(k, giaVotato) {
        var p = lsLeggi(k);
        if (!p || !p.t || !p.r || !p.b || !p.scelte) { return; }
        if (!giaVotato && !p.s) { lsCancella(k); return; }   // la firma non era mai stata data: si riparte da capo
        if (!window.AN05B || !B.supportato()) { return; }
        attendiFinestra(T.rip_t, T.rip_x);
        try {
            var pub = B.chiave(BL);
            if (!p.s) { await chiediFirma(p, pub, k); }
            concludi(p, await deposita(p), k);
        } catch (cod) {
            if (cod === 'c_delega') { lsCancella(k); return; }
            Swal.fire({ icon: 'error', text: cod === 'firma' ? T.err_firma : T.err_urna });
        }
    }

    // tutte le schede di questo link, una dopo l'altra (mai due finestre insieme)
    async function riprendiTutte() {
        await riprendi('io', ioVotato || stato === 'gia_votato');
        for (var i = 0; i < schede.length; i++) {
            if (String(schede[i].k) !== 'io') { await riprendi(String(schede[i].k), false); }
        }
        for (var u = 0; u < usate.length; u++) { await riprendi(String(usate[u]), true); }
    }

    /* riquadri di trasparenza: righe realmente salvate (da an02_sendVote.php) */
    function riga(dl, k, v, vuoto) {
        var dt = document.createElement('dt');
        dt.textContent = k;
        var dd = document.createElement('dd');
        dd.textContent = v;
        if (vuoto) { dd.className = 'AN05V_vuoto'; }
        dl.appendChild(dt);
        dl.appendChild(dd);
    }

    var trTitolo = null;
    function trasparenza(sv, k) {
        var box = document.getElementById('AN05V_trasp');
        if (!sv || !box) { return; }
        var el = document.getElementById('AN05V_tr_el');
        var sc = document.getElementById('AN05V_tr_sc');
        el.textContent = '';
        sc.textContent = '';
        var h4 = box.querySelector('.AN05V_trasp_box h4');
        if (h4) {
            if (!trTitolo) { trTitolo = h4.textContent; }   // (var dichiarata piu' sotto: puo' essere undefined nella ripresa)
            h4.textContent = (k && String(k) !== 'io') ? fmt(T.tr_per, nomeScheda(k)) : trTitolo;
        }
        var e = sv.elettore || {}, u = sv.scheda || {};
        riga(el, T.k_nome, e.nome || '-');
        riga(el, T.k_email, e.email ? T.k_email_v : '-');
        if (e.invito) { riga(el, T.k_invito, e.invito); }
        if (e.letta) { riga(el, T.k_letta, e.letta); }
        riga(el, T.k_votato, e.votato ? fmt(T.k_votato_v, e.votato) : '-');
        if (BL) { riga(el, T.k_cieca, T.k_cieca_v); }
        riga(el, T.k_scelte_te, T.k_scelte_te_v, true);
        riga(sc, T.k_nome_urna, T.k_nome_urna_v, true);
        riga(sc, T.k_scelte, (u.scelte || []).join(', ') || '-');
        riga(sc, T.k_giorno, u.giorno || '-');
        riga(sc, T.k_ora, T.k_ora_v, true);
        riga(sc, T.k_impronta, u.impronta || '-');
        box.hidden = false;
    }

    function fatto(ric, salvato, k) {
        var gr = document.getElementById('AN05V_griglia');
        if (gr) { gr.hidden = true; }
        var lg = document.getElementById('AN05V_linguette');
        if (lg) { lg.hidden = true; }
        var pb = document.getElementById('AN05V_per');
        if (pb) { pb.hidden = true; }
        var barra = document.getElementById('AN05V_barra');
        if (barra) { barra.hidden = true; }
        var gia = document.getElementById('AN05V_gia');
        if (gia) { gia.hidden = true; }
        var istr = box.querySelector('.AN05V_istruzioni');
        if (istr) { istr.hidden = true; }
        var ch = box.querySelector('.AN05V_chiude');
        if (ch) { ch.hidden = true; }
        var f = document.getElementById('AN05V_fatto');
        document.getElementById('AN05V_fatto_t').textContent = T.ok_t;
        document.getElementById('AN05V_fatto_ric_t').textContent = T.ric;
        document.getElementById('AN05V_fatto_nota').textContent = T.ric_nota;
        var r = document.getElementById('AN05V_ricevuta');
        r.textContent = ric;
        var cp = document.getElementById('AN05V_copia');
        cp.textContent = T.copia;
        cp.hidden = !ric;
        cp.onclick = function () {             // proprieta' (non addEventListener): una sola azione per ricevuta
            var ok = function () { cp.textContent = T.copiato; flash(r); };
            if (navigator.clipboard) {
                navigator.clipboard.writeText(ric).then(ok, ok);
            } else {
                ok();
            }
        };
        trasparenza(salvato, k);
        mostraImpronta();
        deleghePostVoto(k);
        restanti(k);
        f.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        flash(r);
    }

    /* (08/11/2026) impronta della chiave usata per la firma, calcolata QUI dalla chiave
       ricevuta: deve essere uguale a quella della pagina dei risultati e del verbale */
    function mostraImpronta() {
        var p = document.getElementById('AN05V_imp_chiave');
        if (!BL || BL.errore || !window.AN05B || !B.impronta) { return; }
        B.impronta(BL).then(function (imp) {
            if (!p) {
                p = document.createElement('p');
                p.id = 'AN05V_imp_chiave';
                p.className = 'AN05V_imp_chiave';
                var nota = document.getElementById('AN05V_fatto_nota');
                if (nota && nota.parentNode) { nota.parentNode.insertBefore(p, nota.nextSibling); }
            }
            p.textContent = '';
            p.appendChild(document.createTextNode((T.impronta || 'Impronta della chiave della votazione') + ': '));
            var c = document.createElement('code');
            c.textContent = imp;
            p.appendChild(c);
            if (T.impronta_x) {
                var sm = document.createElement('small');
                sm.textContent = ' ' + T.impronta_x;
                p.appendChild(sm);
            }
        }).catch(function () { /* niente impronta: il voto resta valido */ });
    }

    /* 12/11/2026: dopo il voto il riquadro deleghe si allinea senza ricaricare la pagina:
       - scheda propria (k assente o 'io'): via "Delega il tuo voto" (chi ha votato non puo' piu'
         delegare: prima il modulo restava e il server rispondeva con un errore);
       - scheda di una delega (k = id): via "Rifiuta" di quella delega, ormai usata.
       Se nel riquadro non resta nulla, si nasconde tutto. */
    function deleghePostVoto(k) {
        var sez = document.getElementById('AN05V_deleghe');
        if (!sez) { return; }
        if (k === undefined || k === null || String(k) === 'io') {
            var nuova = sez.querySelector('.AN05V_dg_nuova');
            if (nuova) { nuova.parentNode.removeChild(nuova); }
        } else {
            var id = String(k).replace(/[^0-9]/g, '');
            var bt = id ? sez.querySelector('.AN05V_dg_rifiuta[data-id="' + id + '"]') : null;
            if (bt) { bt.parentNode.removeChild(bt); }
        }
        if (!sez.querySelector('.AN05V_dg_mia, .AN05V_dg_nuova, .AN05V_dg_ricevute')) { sez.hidden = true; }
    }

    /* dopo una scheda: la si toglie dall'elenco e, se ne restano, "Vota la prossima scheda" */
    function restanti(k) {
        if (k === undefined) { return; }
        schede = schede.filter(function (x) { return String(x.k) !== String(k); });
        var lg = document.getElementById('AN05V_linguette');
        if (lg) {
            var b = lg.querySelector('.AN05V_linguetta[data-k="' + String(k).replace(/[^0-9a-z]/gi, '') + '"]');
            if (b) { b.parentNode.removeChild(b); }
        }
        var rest = document.getElementById('AN05V_restano');
        var pros = document.getElementById('AN05V_prossima');
        if (!rest || !pros) { return; }
        rest.hidden = pros.hidden = schede.length === 0;
        if (!schede.length) { return; }
        rest.textContent = schede.length === 1 && T.restano_1 ? T.restano_1 : fmt(T.restano, schede.length);
        pros.textContent = T.prossima;
        pros.onclick = riapri;
    }

    function riapri() {
        ['AN05V_fatto', 'AN05V_restano', 'AN05V_prossima'].forEach(function (id) {
            var x = document.getElementById(id);
            if (x) { x.hidden = true; }
        });
        var tr = document.getElementById('AN05V_trasp');
        if (tr) { tr.hidden = true; }
        ['AN05V_griglia', 'AN05V_barra', 'AN05V_linguette'].forEach(function (id) {
            var x = document.getElementById(id);
            if (x) { x.hidden = false; }
        });
        var istr = box.querySelector('.AN05V_istruzioni');
        if (istr) { istr.hidden = false; }
        var ch = box.querySelector('.AN05V_chiude');
        if (ch) { ch.hidden = false; }
        document.getElementById('AN05V_copia').textContent = T.copia;
        scegliScheda(schede[0].k);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (BL && !BL.errore) { riprendiTutte(); }
    if (schede.length) { scegliScheda(cur); }
    aggiorna();
}());
