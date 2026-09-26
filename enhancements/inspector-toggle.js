// ==UserScript==
// @name         Muse Desktop - Beacon Activity Inspector Toggle
// @namespace    https://github.com/chromewizard/muse-desktop
// @version      1.1
// @description  Adds a persistent top-right toolbar toggle & Cmd+Option+I shortcut for Beacon's Agent Activity/Inspector panel.
// @match        https://muse.ai/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function findBeaconPill() {
        // Look for the Beacon header element (avatar + name)
        const headerButtons = document.querySelectorAll('header button, [role="banner"] button, div[role="button"]');
        for (const btn of headerButtons) {
            if (btn.textContent.includes('Beacon') || btn.querySelector('img[alt*="Beacon"]')) {
                return btn;
            }
        }
        return null;
    }

    function toggleInspector() {
        const pill = findBeaconPill();
        if (pill) {
            pill.click();
        } else {
            console.log('[Muse Desktop] Beacon avatar header button not found in current view.');
        }
    }

    function injectToggleToolbarButton() {
        if (document.getElementById('muse-inspector-toggle-btn')) return;

        // Locate the header container (near the Invite button)
        const inviteBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Invite'));
        if (!inviteBtn || !inviteBtn.parentElement) return;

        const container = inviteBtn.parentElement;
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'muse-inspector-toggle-btn';
        toggleBtn.title = 'Toggle Beacon Activity Inspector (Cmd + Option + I)';
        toggleBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M15 3v18"/>
                <path d="m8 9 3 3-3 3"/>
            </svg>
            <span style="font-size: 13px; font-weight: 500; margin-left: 6px;">Inspector</span>
        `;
        toggleBtn.style.cssText = `
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            margin-right: 8px;
            border-radius: 9999px;
            background: rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(0, 0, 0, 0.1);
            color: inherit;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
        `;
        toggleBtn.onmouseenter = () => toggleBtn.style.background = 'rgba(0, 0, 0, 0.1)';
        toggleBtn.onmouseleave = () => toggleBtn.style.background = 'rgba(0, 0, 0, 0.05)';
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            toggleInspector();
        };

        container.insertBefore(toggleBtn, inviteBtn);
    }

    // Keyboard shortcut: Cmd + Option + I
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyI') {
            e.preventDefault();
            toggleInspector();
        }
    });

    // Observe DOM changes to inject button when header mounts
    const observer = new MutationObserver(() => injectToggleToolbarButton());
    observer.observe(document.body, { childList: true, subtree: true });
    injectToggleToolbarButton();
})();
