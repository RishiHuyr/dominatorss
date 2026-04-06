document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE MANAGER ---
    let aiState = {
        triageThreshold: 85,
        autoCategorization: true,
        sentimentAnalysis: true,
        connectedRepos: [],
        githubConnected: false,
        githubUser: null
    };

    // --- DOM REFERENCES ---
    const slider = document.getElementById('triage-slider');
    const thresholdVal = document.getElementById('threshold-val');
    const toggleCat = document.getElementById('toggle-categorization');
    const toggleSent = document.getElementById('toggle-sentiment');
    const githubCard = document.getElementById('github-integration-card');
    const suggestionsBox = document.getElementById('ai-smart-suggestions');
    const toastContainer = document.getElementById('toast-container');

    // --- UTILITIES ---
    const showToast = (msg) => {
        const t = document.createElement('div');
        t.className = 'bg-surface-container-highest border border-white/10 text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-3 animate-[fade-in_0.3s_ease-out]';
        t.innerHTML = `<span class="material-symbols-outlined text-primary text-lg">check_circle</span> ${msg}`;
        toastContainer.appendChild(t);
        setTimeout(() => {
            t.classList.add('opacity-0', 'transition-opacity', 'duration-300');
            setTimeout(() => t.remove(), 300);
        }, 3000);
    };

    let debounceTimer;
    const syncBackend = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch('http://localhost:5000/api/settings/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(aiState)
                });
                if(res.ok) {
                    showToast('AI heuristic logic updated system-wide.');
                    evaluateSmartSuggestions();
                }
            } catch(e) {
                console.error(e);
                showToast('Failed to sync. Connection error.');
            }
        }, 500);
    };

    // --- SMART SUGGESTIONS ---
    const evaluateSmartSuggestions = () => {
        let recs = [];
        if (aiState.triageThreshold > 90) {
            recs.push({
                icon: 'warning',
                color: 'text-error',
                bg: 'bg-error/10',
                border: 'border-error/20',
                title: "Strict Priority Tuning",
                body: "Your threshold is exceedingly high. You might miss critical blocking issues. Consider lowering below 90%."
            });
        }
        if (!aiState.sentimentAnalysis) {
            recs.push({
                icon: 'psychology',
                color: 'text-tertiary',
                bg: 'bg-tertiary/10',
                border: 'border-tertiary/20',
                title: "Sentiment Optimization Off",
                body: "Turning off sentiment mapping means community frustration cannot dynamically escalate Sev-2 to Sev-1. Turn it back on for intelligent velocity."
            });
        }

        if (recs.length === 0) {
            suggestionsBox.innerHTML = '';
            return;
        }

        suggestionsBox.innerHTML = `
            <div class="flex items-center gap-2 mb-4">
                <span class="material-symbols-outlined text-sm text-primary">auto_awesome</span>
                <h4 class="font-bold text-on-surface">AI Optimizer</h4>
            </div>
            ${recs.map(r => `
                <div class="glass-card p-4 rounded-xl border ${r.border} ${r.bg} flex items-start gap-4">
                    <span class="material-symbols-outlined ${r.color} mt-1">${r.icon}</span>
                    <div>
                        <h5 class="font-bold text-sm text-white">${r.title}</h5>
                        <p class="text-xs text-on-surface-variant mt-1">${r.body}</p>
                    </div>
                </div>
            `).join('')}
        `;
    };

    // --- RENDERERS ---
    const renderToggles = () => {
        const updateToggle = (el, active) => {
            const btn = el.querySelector('button');
            const circle = el.querySelector('.toggle-circle');
            if (active) {
                btn.classList.add('bg-primary');
                btn.classList.remove('bg-surface-container-highest');
                circle.classList.add('right-1');
                circle.classList.remove('left-1');
                circle.classList.add('bg-white');
                circle.classList.remove('bg-on-surface-variant');
            } else {
                btn.classList.remove('bg-primary');
                btn.classList.add('bg-surface-container-highest');
                circle.classList.remove('right-1');
                circle.classList.add('left-1');
                circle.classList.remove('bg-white');
                circle.classList.add('bg-on-surface-variant');
            }
        };
        updateToggle(toggleCat, aiState.autoCategorization);
        updateToggle(toggleSent, aiState.sentimentAnalysis);
    };

    const renderGithubCard = () => {
        if (!aiState.githubConnected) {
            githubCard.innerHTML = `
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center p-2 shadow-inner border border-white/5">
                        <svg viewBox="0 0 24 24" class="w-8 h-8 text-on-surface-variant" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                    </div>
                    <div>
                        <h4 class="font-bold font-headline text-lg">GitHub</h4>
                        <span class="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1">Disconnected</span>
                    </div>
                </div>
                <p class="text-xs text-on-surface-variant mb-6 line-clamp-2">Authorize GitHub to pull real-time tickets globally across the UI.</p>
                <button id="btn-connect-gh" class="w-full py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-dim transition-all shadow-[0_0_15px_rgba(163,166,255,0.4)]">Connect via OAuth 2.0</button>
            `;
            
            document.getElementById('btn-connect-gh').addEventListener('click', () => {
                window.location.href = 'http://localhost:5000/auth/github';
            });

        } else {
            const user = aiState.githubUser || {};
            githubCard.innerHTML = `
                <div class="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[40px] pointer-events-none"></div>
                <div class="flex items-center gap-4 mb-4 relative z-10">
                    <img src="${user.avatar || ''}" class="w-12 h-12 rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(163,166,255,0.2)]" />
                    <div>
                        <h4 class="font-bold font-headline text-lg text-white">GitHub Connection</h4>
                        <span class="text-[10px] text-primary uppercase font-bold tracking-widest flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> Connected as: ${user.username || 'Neural User'}
                        </span>
                    </div>
                </div>
                <p class="text-xs text-on-surface-variant mb-4 relative z-10">Neural link active. Your repositories are now accessible for AI triage.</p>
                
                <div class="flex flex-col gap-2 relative z-10">
                    <button id="btn-switch-gh" class="w-full py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold hover:bg-indigo-500/20 transition-all uppercase tracking-widest">
                        Switch GitHub Account
                    </button>
                    <button id="btn-disconnect-gh" class="w-full py-1.5 rounded-lg bg-white/5 border border-white/10 text-on-surface-variant/60 text-[9px] font-bold hover:text-error hover:bg-error/5 transition-all">
                        Disconnect Entirely
                    </button>
                </div>
            `;

            document.getElementById('btn-disconnect-gh').addEventListener('click', async () => {
                try {
                    const resp = await fetch('http://localhost:5000/auth/logout', { method: 'POST' });
                    if(resp.ok) {
                        aiState.githubConnected = false;
                        aiState.githubUser = null;
                        showToast('GitHub synchronization severed.');
                        renderToggles();
                        renderGithubCard();
                    }
                } catch(e) { showToast('Sync error.'); }
            });

            document.getElementById('btn-switch-gh').addEventListener('click', async () => {
                console.log("[Settings] Switching GitHub accounts. Purging current session first.");
                try {
                    // 1. Terminate current session
                    await fetch('http://localhost:5000/auth/logout', { method: 'POST' });
                    // 2. Redirect to fresh auth flow with account chooser
                    window.location.href = 'http://localhost:5000/auth/github';
                } catch(e) { showToast('Switching failed.'); }
            });
        }
    };

    // --- EVENT LISTENERS ---

    slider.addEventListener('input', (e) => {
        thresholdVal.innerText = e.target.value;
        aiState.triageThreshold = parseInt(e.target.value, 10);
        syncBackend();
    });

    toggleCat.addEventListener('click', () => {
        aiState.autoCategorization = !aiState.autoCategorization;
        renderToggles();
        syncBackend();
    });

    toggleSent.addEventListener('click', () => {
        aiState.sentimentAnalysis = !aiState.sentimentAnalysis;
        renderToggles();
        syncBackend();
    });

    // --- INITIALIZATION ---
    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('oauth') === 'success') {
            showToast(`Neuro-link established. Welcome, ${urlParams.get('login')}!`);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.get('oauth') === 'error') {
            const msg = urlParams.get('msg') || 'Authentication failed';
            showToast(`❌ OAuth Error: ${msg}`);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        try {
            // 1. Fetch AI Settings
            const res = await fetch('http://localhost:5000/api/settings');
            const data = await res.json();
            if(data.success && data.settings) {
                aiState.triageThreshold = data.settings.triageThreshold;
                aiState.autoCategorization = data.settings.autoCategorization;
                aiState.sentimentAnalysis = data.settings.sentimentAnalysis;
            }

            // 2. Fetch connection status (Real OAuth)
            const authRes = await fetch('http://localhost:5000/auth/status');
            const authData = await authRes.json();
            if (authData.connected) {
                aiState.githubConnected = true;
                aiState.githubUser = {
                    username: authData.username,
                    avatar: authData.avatar
                };
            }
        } catch(e) { console.warn("Using default UI states. API unreachable."); }
        
        // Hydrate UI completely from AI State rules
        slider.value = aiState.triageThreshold;
        thresholdVal.innerText = aiState.triageThreshold;
        
        renderToggles();
        renderGithubCard();
        evaluateSmartSuggestions();
    };

    init();
});
