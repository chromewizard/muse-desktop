// ==UserScript==
// @name         Muse Desktop - Beacon Activity Inspector (Auto-Open, Toggle, State Indicator & Twirl)
// @namespace    https://github.com/chromewizard/muse-desktop
// @version      1.3.1
// @description  Opens Beacon's Activity Inspector drawer by default, adds a persistent top-right toolbar toggle that shows On/Off state, binds Cmd+Option+I, and makes the little Beacon avatar do an organic twirl when the drawer is closed with the X (so people learn that he is the handle that brings it back).
// @match        https://muse.ai/*
// @grant        none
// ==/UserScript==

/*
 * Runs in two places:
 *   1. Muse Standalone PWA Launcher (Chrome --app=https://muse.ai) via a userscript manager.
 *   2. The native macOS app (com.meta.endo), injected into Contents/Resources/hatch/index.html
 *      by v4.1.1-patch/patch-dmg.py (or v4.1.1-patch/inject-enhancements.py for an installed app).
 *
 * Hooks used (from the Hatch bundle):
 *   [data-testid="hatch-status-panel-close"]              the X in the drawer's top-right corner
 *   [data-hatch-avatar-host]                              the floating Beacon avatar (framer "spring" geometry)
 *   [data-hatch-avatar-host] [data-hatch-avatar-interaction]  the round 56px avatar inside it
 *   [data-hatch-avatar-display-stage="chat-nav"]          host attribute when the avatar sits top-center of the chat
 *   window event "hatch:open-approvals-panel"             the app's own "open the drawer" hook
 *   button[aria-label="Activity"]                         the drawer's Activity tab
 */

(function () {
    'use strict';

    if (window.__museInspectorEnhancement) return; // idempotent (userscript + injected copy)
    window.__museInspectorEnhancement = { version: '1.3.1' };

    const SEL = {
        closeBtn: '[data-testid="hatch-status-panel-close"]',
        avatarHost: '[data-hatch-avatar-host]',
        avatar: '[data-hatch-avatar-host] [data-hatch-avatar-interaction]',
        activityTab: 'button[aria-label="Activity"]',
    };
    const TOGGLE_ID = 'muse-inspector-toggle-btn';
    const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------------ */
    /*  Styles: twirl keyframes, toolbar pill, avatar hover affordance      */
    /* ------------------------------------------------------------------ */
    function injectStyles() {
        if (document.getElementById('muse-inspector-enhancement-css')) return;
        const css = document.createElement('style');
        css.id = 'muse-inspector-enhancement-css';
        css.textContent = `
            /* --- Beacon twirl: a ball turning, not a card flipping.
                   Under his face sits a fuzzy sphere (his onesie, limb-shaded). The face and the
                   back of his hood are pushed out from that sphere's surface and rotate around it,
                   so the silhouette stays round the whole way and the edge-on moment shows the side
                   of his head instead of a paper edge. One animation on the avatar drives the turn
                   angle (--muse-theta), the lift off the sphere (--muse-lift) and the hop/tilt/squash;
                   each layer just reads the two variables. Timing is per segment: ease-in wind-up,
                   linear through the spin, ease-out into the landing bounce. --- */
            @property --muse-theta { syntax: '<angle>';  inherits: true; initial-value: 0deg; }
            @property --muse-lift  { syntax: '<length>'; inherits: true; initial-value: 0px; }
            @keyframes muse-beacon-turn {
                0%   { --muse-theta: 0deg;   --muse-lift: 0px;  transform: translateY(0)      rotate(0deg)    scale(1, 1);       animation-timing-function: ease-in-out; }
                10%  { --muse-theta: -22deg; --muse-lift: 7px;  transform: translateY(1px)    rotate(3deg)    scale(1.05, 0.95); animation-timing-function: ease-in; }
                24%  { --muse-theta: 50deg;  --muse-lift: 12px; transform: translateY(-7px)   rotate(-3deg)   scale(0.96, 1.06); animation-timing-function: linear; }
                52%  { --muse-theta: 200deg; --muse-lift: 12px; transform: translateY(-11px)  rotate(2deg)    scale(1, 1);       animation-timing-function: linear; }
                76%  { --muse-theta: 335deg; --muse-lift: 12px; transform: translateY(-4px)   rotate(-2deg)   scale(1, 1);       animation-timing-function: ease-out; }
                86%  { --muse-theta: 372deg; --muse-lift: 5px;  transform: translateY(1.5px)  rotate(1.5deg)  scale(1.06, 0.94); animation-timing-function: ease-in-out; }
                94%  { --muse-theta: 355deg; --muse-lift: 1px;  transform: translateY(-0.5px) rotate(-0.5deg) scale(0.99, 1.01); animation-timing-function: ease-out; }
                100% { --muse-theta: 360deg; --muse-lift: 0px;  transform: translateY(0)      rotate(0deg)    scale(1, 1); }
            }
            /* a replaced (custom) avatar gets only this plain hop — the onesie sphere is Beacon-specific */
            @keyframes muse-beacon-hop {
                0%   { transform: translateY(0)    rotate(0deg)    scale(1, 1);       animation-timing-function: ease-in; }
                18%  { transform: translateY(1px)  rotate(2deg)    scale(1.04, 0.96); animation-timing-function: ease-out; }
                50%  { transform: translateY(-8px) rotate(-2deg)   scale(0.98, 1.03); animation-timing-function: ease-in; }
                80%  { transform: translateY(1px)  rotate(1deg)    scale(1.03, 0.97); animation-timing-function: ease-out; }
                100% { transform: translateY(0)    rotate(0deg)    scale(1, 1); }
            }
            .muse-beacon-hopping { animation: muse-beacon-hop 620ms both !important; transform-origin: 50% 60% !important; will-change: transform; }
            /* the name tag under the avatar bobs when he lands, like it is attached to him */
            @keyframes muse-beacon-tag-bob {
                0%   { transform: translateY(0); }
                35%  { transform: translateY(2px); }
                65%  { transform: translateY(-2px); }
                100% { transform: translateY(0); }
            }
            .muse-beacon-twirling {
                animation: muse-beacon-turn 1700ms both !important;
                perspective: 240px !important;
                transform-style: preserve-3d !important;
                transform-origin: 50% 60% !important;
                filter: none !important;                 /* a filter would flatten the 3D context */
                will-change: transform;
            }
            .muse-beacon-front {
                transform: rotateY(var(--muse-theta)) translateZ(var(--muse-lift)) !important;
                backface-visibility: hidden !important; -webkit-backface-visibility: hidden !important;
                will-change: transform;
            }
            .muse-beacon-ball, .muse-beacon-backface {
                position: absolute; inset: 0; border-radius: 9999px; overflow: hidden; pointer-events: none;
                background: linear-gradient(160deg, #efe6d8 0%, #d9c9b3 55%, #c2ad93 100%);
            }
            .muse-beacon-ball canvas, .muse-beacon-backface canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
            .muse-beacon-ball {
                transform: translateZ(-0.5px);           /* the sphere: sits just behind the resting face */
            }
            .muse-beacon-ball .muse-beacon-shade {
                position: absolute; inset: 0; border-radius: 9999px;
                background:
                    radial-gradient(70% 70% at 36% 28%, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 55%),
                    radial-gradient(72% 72% at 50% 50%, rgba(0, 0, 0, 0) 58%, rgba(0, 0, 0, 0.30) 100%);
            }
            .muse-beacon-backface {
                transform: rotateY(calc(var(--muse-theta) + 180deg)) translateZ(var(--muse-lift));
                backface-visibility: hidden; -webkit-backface-visibility: hidden;
                will-change: transform;
            }
            .muse-beacon-backface .muse-beacon-hood {
                position: absolute; inset: 0; border-radius: 9999px;
                background:
                    radial-gradient(60% 70% at 50% 35%, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0) 60%),
                    linear-gradient(90deg, rgba(0, 0, 0, 0) 46%, rgba(0, 0, 0, 0.09) 50%, rgba(0, 0, 0, 0) 54%),
                    radial-gradient(75% 75% at 50% 50%, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 0.18) 100%);
            }
            .muse-beacon-tag-bob {
                animation: muse-beacon-tag-bob 420ms 1340ms ease-out both !important;
                will-change: transform;
            }
            /* reduced motion: a soft pulse instead of the spin */
            @keyframes muse-beacon-pulse {
                0%, 100% { opacity: 1; }
                50%      { opacity: 0.55; }
            }
            .muse-beacon-pulse {
                animation: muse-beacon-pulse 600ms ease-in-out both !important;
            }

            /* --- Discoverability: when the avatar is a real button, say so on hover --- */
            ${SEL.avatar}[role="button"] {
                cursor: pointer !important;
                transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms ease !important;
            }
            ${SEL.avatar}[role="button"]:hover {
                transform: translateY(-2px) scale(1.06) !important;
                filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.18));
            }

            /* --- Toolbar pill with On/Off state --- */
            #${TOGGLE_ID} {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                height: 36px;
                padding: 0 12px 0 10px;
                margin-right: 8px;
                border-radius: 9999px;
                border: 1px solid rgba(0, 0, 0, 0.10);
                background: rgba(255, 255, 255, 0.85);
                color: inherit;
                font: inherit;
                font-size: 13px;
                font-weight: 500;
                line-height: 1;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
                transition: background 150ms ease, border-color 150ms ease, transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
                -webkit-user-select: none; user-select: none;
            }
            #${TOGGLE_ID}:hover { background: rgba(255, 255, 255, 1); border-color: rgba(0, 0, 0, 0.18); }
            #${TOGGLE_ID}:active { transform: scale(0.97); }
            #${TOGGLE_ID}:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
            #${TOGGLE_ID} svg { width: 16px; height: 16px; flex: none; }
            #${TOGGLE_ID} .muse-state {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 3px 7px 3px 5px; border-radius: 9999px;
                font-size: 11px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
                background: rgba(0, 0, 0, 0.06); color: rgba(0, 0, 0, 0.55);
                transition: background 200ms ease, color 200ms ease;
            }
            #${TOGGLE_ID} .muse-dot {
                width: 7px; height: 7px; border-radius: 50%;
                background: rgba(0, 0, 0, 0.28);
                transition: background 200ms ease, box-shadow 200ms ease;
            }
            #${TOGGLE_ID}[aria-pressed="true"] { border-color: rgba(34, 197, 94, 0.45); }
            #${TOGGLE_ID}[aria-pressed="true"] .muse-state { background: rgba(34, 197, 94, 0.14); color: #15803d; }
            #${TOGGLE_ID}[aria-pressed="true"] .muse-dot { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.22); }
            @keyframes muse-dot-pop { 0% { transform: scale(1); } 40% { transform: scale(1.7); } 100% { transform: scale(1); } }
            #${TOGGLE_ID} .muse-dot.pop { animation: muse-dot-pop 360ms cubic-bezier(0.22, 1, 0.36, 1); }

            html.dark #${TOGGLE_ID} {
                background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.14); box-shadow: none;
            }
            html.dark #${TOGGLE_ID}:hover { background: rgba(255, 255, 255, 0.14); }
            html.dark #${TOGGLE_ID} .muse-state { background: rgba(255, 255, 255, 0.10); color: rgba(255, 255, 255, 0.7); }
            html.dark #${TOGGLE_ID} .muse-dot { background: rgba(255, 255, 255, 0.35); }
            html.dark #${TOGGLE_ID}[aria-pressed="true"] .muse-state { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
        `;
        (document.head || document.documentElement).appendChild(css);
    }

    /* ------------------------------------------------------------------ */
    /*  Panel state & control                                               */
    /* ------------------------------------------------------------------ */
    function isInspectorOpen() {
        return !!document.querySelector(SEL.closeBtn);
    }

    function avatarButton() {
        const el = document.querySelector(SEL.avatar);
        return el && el.getAttribute('role') === 'button' ? el : null;
    }

    function openInspector() {
        if (isInspectorOpen()) return;
        const btn = avatarButton();
        if (btn) { btn.click(); return; }          // the app's own toggle (keeps the last tab)
        // Fallback: the app's public hook opens to Approvals; hop to Activity so tool calls show first.
        window.dispatchEvent(new CustomEvent('hatch:open-approvals-panel'));
        setTimeout(() => {
            const tab = document.querySelector(SEL.activityTab);
            if (tab && tab.getAttribute('aria-pressed') !== 'true') tab.click();
        }, 60);
    }

    function closeInspector() {
        const x = document.querySelector(SEL.closeBtn);
        if (x) x.click();
    }

    function toggleInspector() {
        isInspectorOpen() ? closeInspector() : openInspector();
    }

    /* ------------------------------------------------------------------ */
    /*  The twirl                                                           */
    /* ------------------------------------------------------------------ */
    let twirlTimer = null;

    // A fabric texture for the sphere and for the back of his hood: sampled from the live avatar
    // media (the lower-middle of the frame is onesie, below the face) onto a small canvas.
    // Returns null if the media cannot be read (e.g. cross-origin) -> the CSS gradient shows instead.
    function fabricCanvas(front, size) {
        try {
            const m = front.querySelector('video, img');
            const W = m && (m.videoWidth || m.naturalWidth), H = m && (m.videoHeight || m.naturalHeight);
            if (!m || !(W > 0) || !(H > 0)) return null;
            const dpr = Math.min(window.devicePixelRatio || 1, 3);
            const c = document.createElement('canvas');
            c.width = Math.max(2, Math.round(size * dpr)); c.height = c.width;
            const ctx = c.getContext('2d');
            const sw = W * 0.42, sh = H * 0.42, sx = (W - sw) / 2, sy = H * 0.50;
            ctx.drawImage(m, sx, sy, sw, sh, 0, 0, c.width, c.height);
            ctx.getImageData(0, 0, 1, 1); // throws on a tainted canvas
            return c;
        } catch (e) { return null; }
    }

    // The onesie-sphere twirl is built for Beacon's own look. Users can replace the avatar, and a
    // photo or another character would get a fake fuzzy back, so the special move is gated:
    //   1. the stock avatar renders from the app's built-in media (/avatars/hatch*.mp4|jpg) -> yes
    //   2. otherwise the pixels under the face must read as Beacon's fabric: light, warm, low-detail
    // Anything else gets a plain hop (still says "I'm the handle", nothing fabricated).
    function isStockBeacon(front) {
        const m = front.querySelector('video, img');
        const src = (m && (m.currentSrc || m.src)) || '';
        if (/\/avatars\/hatch[a-z_]*\.(mp4|jpg)(\?|#|$)/i.test(src)) return true;
        const c = fabricCanvas(front, 16);
        if (!c) return false;
        try {
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0, r = 0, g = 0, b = 0, l2 = 0, lsum = 0;
            for (let i = 0; i < d.length; i += 4) { const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; r += d[i]; g += d[i + 1]; b += d[i + 2]; lsum += L; l2 += L * L; n++; }
            r /= n; g /= n; b /= n; const lm = lsum / n, sd = Math.sqrt(Math.max(0, l2 / n - lm * lm));
            const warm = r >= g - 4 && g >= b - 4, light = lm > 150 && lm < 248, muted = (Math.max(r, g, b) - Math.min(r, g, b)) < 70, smooth = sd < 30;
            return warm && light && muted && smooth;
        } catch (e) { return false; }
    }

    function runHop(avatar, tag) {
        avatar.classList.remove('muse-beacon-hopping'); void avatar.offsetWidth;
        avatar.classList.add('muse-beacon-hopping');
        avatar.addEventListener('animationend', (e) => { if (e.animationName === 'muse-beacon-hop') avatar.classList.remove('muse-beacon-hopping'); }, { once: true });
        if (tag) {
            tag.classList.remove('muse-beacon-tag-bob'); void tag.offsetWidth;
            tag.style.animationDelay = '260ms';
            tag.classList.add('muse-beacon-tag-bob');
            tag.addEventListener('animationend', () => { tag.classList.remove('muse-beacon-tag-bob'); tag.style.animationDelay = ''; }, { once: true });
        }
    }

    function makeLayer(className, texture, overlayClass) {
        const el = document.createElement('div');
        el.className = className;
        el.setAttribute('aria-hidden', 'true');
        if (texture) el.appendChild(texture);
        const overlay = document.createElement('div');
        overlay.className = overlayClass;
        el.appendChild(overlay);
        return el;
    }

    function runTwirl() {
        const avatar = document.querySelector(SEL.avatar);
        if (!avatar) return;
        // The "front" is the media container inside the avatar (React owns it; we only add a class).
        // The sphere and the back of his hood are our own nodes, appended beside it. The avatar itself
        // carries the one animation that drives the turn angle, the lift and the hop.
        const front = avatar.firstElementChild || avatar;
        const host = avatar.closest(SEL.avatarHost);
        const tag = host && Array.from(host.querySelectorAll('span')).find(s => s.children.length === 0 && s.textContent.trim().length > 0);

        if (reducedMotion()) {
            front.classList.remove('muse-beacon-pulse'); void front.offsetWidth;
            front.classList.add('muse-beacon-pulse');
            front.addEventListener('animationend', () => front.classList.remove('muse-beacon-pulse'), { once: true });
            return;
        }

        if (!isStockBeacon(front)) { runHop(avatar, tag); return; }   // replaced avatar: plain hop only

        // restart cleanly if a twirl is already mid-flight
        avatar.querySelectorAll('.muse-beacon-ball, .muse-beacon-backface').forEach(n => n.remove());
        avatar.classList.remove('muse-beacon-twirling'); void avatar.offsetWidth;

        const size = front.getBoundingClientRect().width || 56;
        const ball = makeLayer('muse-beacon-ball', fabricCanvas(front, size), 'muse-beacon-shade');
        const back = makeLayer('muse-beacon-backface', fabricCanvas(front, size), 'muse-beacon-hood');
        avatar.appendChild(ball);
        avatar.appendChild(back);

        front.classList.add('muse-beacon-front');
        avatar.classList.add('muse-beacon-twirling');

        let done = false;
        const cleanup = () => {
            if (done) return; done = true;
            avatar.classList.remove('muse-beacon-twirling');
            front.classList.remove('muse-beacon-front');
            ball.remove(); back.remove();
        };
        avatar.addEventListener('animationend', (e) => { if (e.animationName === 'muse-beacon-turn') cleanup(); });
        setTimeout(cleanup, 2600); // safety net if the node is re-rendered mid-spin

        if (tag) {
            tag.classList.remove('muse-beacon-tag-bob'); void tag.offsetWidth;
            tag.classList.add('muse-beacon-tag-bob');
            tag.addEventListener('animationend', () => tag.classList.remove('muse-beacon-tag-bob'), { once: true });
        }
    }

    // After a close, the avatar springs from the drawer back to the top-center of the chat.
    // Wait for it to land (position stable for a few frames), then twirl. Falls back to a
    // fixed delay if it never settles (e.g. mid-scroll).
    function twirlWhenLanded() {
        clearTimeout(twirlTimer);
        const started = performance.now();
        let last = null, stableFrames = 0;
        const tick = () => {
            const host = document.querySelector(SEL.avatarHost);
            const elapsed = performance.now() - started;
            if (host && host.getAttribute('data-hatch-avatar-display-stage') === 'chat-nav' && !isInspectorOpen()) {
                const r = host.getBoundingClientRect();
                const key = Math.round(r.left) + ',' + Math.round(r.top);
                stableFrames = key === last ? stableFrames + 1 : 0;
                last = key;
                if (stableFrames >= 4 && elapsed >= 120) { runTwirl(); return; }
            }
            if (elapsed > 1600) { if (host && !isInspectorOpen()) runTwirl(); return; }
            twirlTimer = setTimeout(tick, 40);
        };
        tick();
    }

    /* ------------------------------------------------------------------ */
    /*  Toolbar pill (state indicator + toggle)                             */
    /* ------------------------------------------------------------------ */
    function injectToggleToolbarButton() {
        if (document.getElementById(TOGGLE_ID)) return;
        const inviteBtn = Array.from(document.querySelectorAll('button')).find(b => /\bInvite\b/.test(b.textContent));
        if (!inviteBtn || !inviteBtn.parentElement) return;

        const btn = document.createElement('button');
        btn.id = TOGGLE_ID;
        btn.type = 'button';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('data-muse-enhancement', 'inspector-toggle');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="3" rx="4"/>
                <path d="M15 3v18"/>
                <path d="m8 9 3 3-3 3"/>
            </svg>
            <span>Inspector</span>
            <span class="muse-state"><span class="muse-dot"></span><span class="muse-state-text">Off</span></span>`;
        btn.addEventListener('click', (e) => { e.preventDefault(); toggleInspector(); });
        inviteBtn.parentElement.insertBefore(btn, inviteBtn);
        syncToggleState(true);
    }

    let lastKnownOpen = null;
    function syncToggleState(silent) {
        const open = isInspectorOpen();
        const btn = document.getElementById(TOGGLE_ID);
        if (btn) {
            btn.setAttribute('aria-pressed', open ? 'true' : 'false');
            btn.title = (open ? 'Hide' : 'Show') + " Beacon's Activity Inspector (⌘⌥I)";
            btn.setAttribute('aria-label', btn.title);
            const text = btn.querySelector('.muse-state-text');
            if (text) text.textContent = open ? 'On' : 'Off';
            const dot = btn.querySelector('.muse-dot');
            if (dot && !silent && open !== lastKnownOpen && lastKnownOpen !== null) {
                dot.classList.remove('pop'); void dot.offsetWidth; dot.classList.add('pop');
            }
        }
        // Tooltip on the little guy himself, whenever he is actually clickable.
        const av = avatarButton();
        if (av) av.title = "Beacon — click to " + (open ? 'hide' : 'show') + " his activity";

        if (lastKnownOpen === true && open === false) twirlWhenLanded();   // the X (or ⌘⌥I) just closed it
        lastKnownOpen = open;
    }

    /* ------------------------------------------------------------------ */
    /*  Keyboard shortcut: Cmd/Ctrl + Option + I                            */
    /* ------------------------------------------------------------------ */
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.altKey && (e.code === 'KeyI' || e.key === 'i' || e.key === 'I' || e.key === 'ı')) {
            e.preventDefault();
            toggleInspector();
        }
    }, true);

    /* ------------------------------------------------------------------ */
    /*  Auto-open once on startup (default ON)                              */
    /* ------------------------------------------------------------------ */
    let autoOpened = false;
    const bootAt = performance.now();
    function autoOpenOnStartup() {
        if (autoOpened) return;
        if (isInspectorOpen()) { autoOpened = true; return; }
        // The app must be far enough along to have its header (Invite) or the avatar mounted.
        const ready = document.querySelector(SEL.avatarHost) || Array.from(document.querySelectorAll('button')).some(b => /\bInvite\b/.test(b.textContent));
        if (!ready) return;
        autoOpened = true;
        openInspector();
        // If the app was not quite ready and ignored us, try once more shortly after.
        setTimeout(() => { if (!isInspectorOpen() && performance.now() - bootAt < 30000) openInspector(); }, 1200);
        console.log('[Muse Desktop] Beacon Activity Inspector opened by default.');
    }

    /* ------------------------------------------------------------------ */
    /*  Wiring                                                              */
    /* ------------------------------------------------------------------ */
    let raf = 0;
    function onMutation() {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            injectStyles();
            injectToggleToolbarButton();
            syncToggleState(false);
            autoOpenOnStartup();
        });
    }

    function start() {
        injectStyles();
        new MutationObserver(onMutation).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-testid', 'role', 'data-hatch-avatar-display-stage'] });
        onMutation();
        setTimeout(onMutation, 500);
        setTimeout(onMutation, 2000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();

    // Small public surface for testing / the in-app console.
    window.__museInspectorEnhancement.toggle = toggleInspector;
    window.__museInspectorEnhancement.open = openInspector;
    window.__museInspectorEnhancement.close = closeInspector;
    window.__museInspectorEnhancement.twirl = runTwirl;
    window.__museInspectorEnhancement.isOpen = isInspectorOpen;
    window.__museInspectorEnhancement.isStockBeacon = () => { const a = document.querySelector(SEL.avatar); return !!a && isStockBeacon(a.firstElementChild || a); };
})();
