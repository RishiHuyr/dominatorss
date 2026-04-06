/**
 * triage.js — Global Triage Pipeline Controller
 * Injected into all pages. Handles the "Triage Now" button sidebar CTA.
 */
(function () {
    // Inject modal markup once
    const modalHTML = `
    <div id="triage-modal" class="fixed inset-0 z-[500] bg-surface/90 backdrop-blur-lg hidden items-center justify-center p-4">
        <div class="w-full max-w-md glass-card rounded-3xl border border-white/10 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative">
            <!-- Header -->
            <div class="flex items-center gap-3 mb-6">
                <div id="triage-icon-wrap" class="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                    <span id="triage-icon" class="material-symbols-outlined text-2xl text-primary" style="font-variation-settings:'FILL' 1">bolt</span>
                </div>
                <div>
                    <h3 class="font-headline font-bold text-xl text-on-surface">AI Triage Engine</h3>
                    <p id="triage-subtitle" class="text-xs text-on-surface-variant">Configure and launch</p>
                </div>
            </div>

            <!-- Repo Input (shown on idle) -->
            <div id="triage-input-section">
                <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Target Repository</label>
                <input id="triage-repo-input" type="text" value="microsoft/vscode"
                    placeholder="owner/repo"
                    class="w-full bg-surface-container-high border border-white/10 rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary text-white mb-6 outline-none" />
                <button id="triage-launch-btn"
                    class="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary-dim text-white font-bold shadow-[0_0_20px_rgba(163,166,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-lg">bolt</span> Launch Triage
                </button>
                <button id="triage-close-btn" class="w-full py-2 mt-3 text-xs text-on-surface-variant hover:text-white transition-colors">Cancel</button>
            </div>

            <!-- Live Progress (shown during run) -->
            <div id="triage-progress-section" class="hidden">
                <div class="space-y-3" id="triage-steps">
                    <div id="step-fetch"   class="triage-step flex items-center gap-3 text-sm text-on-surface-variant opacity-40">
                        <span class="material-symbols-outlined text-base step-icon">radio_button_unchecked</span>
                        <span class="step-label">Scanning GitHub issues...</span>
                    </div>
                    <div id="step-duplicates" class="triage-step flex items-center gap-3 text-sm text-on-surface-variant opacity-40">
                        <span class="material-symbols-outlined text-base step-icon">radio_button_unchecked</span>
                        <span class="step-label">Detecting semantic duplicates...</span>
                    </div>
                    <div id="step-priority" class="triage-step flex items-center gap-3 text-sm text-on-surface-variant opacity-40">
                        <span class="material-symbols-outlined text-base step-icon">radio_button_unchecked</span>
                        <span class="step-label">Scoring issue priorities...</span>
                    </div>
                    <div id="step-insights" class="triage-step flex items-center gap-3 text-sm text-on-surface-variant opacity-40">
                        <span class="material-symbols-outlined text-base step-icon">radio_button_unchecked</span>
                        <span class="step-label">Generating AI insights...</span>
                    </div>
                </div>
                <p id="triage-live-msg" class="text-xs text-on-surface-variant mt-5 italic">Initializing pipeline...</p>
            </div>

            <!-- Results (shown on complete) -->
            <div id="triage-results-section" class="hidden space-y-4">
                <div class="grid grid-cols-3 gap-3 text-center">
                    <div class="bg-white/5 border border-white/5 rounded-xl p-3">
                        <div id="res-issues" class="text-2xl font-bold font-headline text-primary">--</div>
                        <div class="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">Issues</div>
                    </div>
                    <div class="bg-white/5 border border-white/5 rounded-xl p-3">
                        <div id="res-dups" class="text-2xl font-bold font-headline text-secondary">--</div>
                        <div class="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">Duplicates</div>
                    </div>
                    <div class="bg-white/5 border border-white/5 rounded-xl p-3">
                        <div id="res-critical" class="text-2xl font-bold font-headline text-error">--</div>
                        <div class="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">Critical</div>
                    </div>
                </div>
                <button id="triage-done-btn"
                    class="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-colors">
                    Close Panel
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal         = document.getElementById('triage-modal');
    const inputSection  = document.getElementById('triage-input-section');
    const progressSection = document.getElementById('triage-progress-section');
    const resultsSection  = document.getElementById('triage-results-section');
    const launchBtn     = document.getElementById('triage-launch-btn');
    const closeBtn      = document.getElementById('triage-close-btn');
    const doneBtn       = document.getElementById('triage-done-btn');
    const repoInput     = document.getElementById('triage-repo-input');
    const liveMsg       = document.getElementById('triage-live-msg');
    const triageIcon    = document.getElementById('triage-icon');
    const subtitle      = document.getElementById('triage-subtitle');

    // Restore reading repo from wherever the dashboard may have set it
    const savedRepo = localStorage.getItem('lastTriageRepo') || 'microsoft/vscode';
    repoInput.value = savedRepo;

    const stepMap = {
        fetch:      document.getElementById('step-fetch'),
        duplicates: document.getElementById('step-duplicates'),
        priority:   document.getElementById('step-priority'),
        insights:   document.getElementById('step-insights'),
    };

    const activateStep = (key, done = false) => {
        const el = stepMap[key];
        if (!el) return;
        const icon = el.querySelector('.step-icon');
        el.classList.remove('opacity-40');
        el.classList.add('text-white');
        if (done) {
            icon.innerText = 'check_circle';
            icon.classList.add('text-primary');
        } else {
            icon.innerText = 'sync';
            icon.classList.add('animate-spin', 'text-secondary');
        }
    };

    const completeStep = (key) => {
        const el = stepMap[key];
        if (!el) return;
        const icon = el.querySelector('.step-icon');
        icon.innerText = 'check_circle';
        icon.classList.remove('animate-spin', 'text-secondary');
        icon.classList.add('text-primary');
    };

    const resetModal = () => {
        Object.values(stepMap).forEach(el => {
            const icon = el.querySelector('.step-icon');
            icon.innerText = 'radio_button_unchecked';
            icon.className = 'material-symbols-outlined text-base step-icon';
            el.classList.add('opacity-40');
            el.classList.remove('text-white');
        });
        liveMsg.innerText = 'Initializing pipeline...';
        triageIcon.innerText = 'bolt';
        subtitle.innerText = 'Configure and launch';
        inputSection.classList.remove('hidden');
        progressSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
    };

    // Wire all "Triage Now" buttons in the sidebar
    document.querySelectorAll('[data-triage-trigger], .triage-now-btn').forEach(btn => {
        btn.addEventListener('click', () => openModal());
    });

    // Also wire by text content match for the existing buttons
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.trim() === 'Triage Now') {
            btn.addEventListener('click', () => openModal());
        }
    });

    const openModal = () => {
        resetModal();
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });

    doneBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        // Reload page to reflect fresh DB data
        window.location.reload();
    });

    // Socket.io progress listener
    let socket;
    try {
        socket = io('http://localhost:5000');
        socket.on('triage_progress', (data) => {
            liveMsg.innerText = data.msg;

            if (data.step === 'fetch')      activateStep('fetch', !!data.issuesCount);
            if (data.step === 'duplicates') { completeStep('fetch'); activateStep('duplicates', !!data.dupCount); }
            if (data.step === 'priority')   { completeStep('duplicates'); activateStep('priority', !!data.criticalCount); }
            if (data.step === 'insights')   { completeStep('priority'); activateStep('insights'); }

            if (data.step === 'complete') {
                completeStep('insights');
                setTimeout(() => showResults(data), 600);
            }
            if (data.step === 'error') {
                liveMsg.innerHTML = `<span class="text-error">${data.msg}</span>`;
                launchBtn.disabled = false;
            }
        });
    } catch(e) {
        console.warn('Socket.io not available, falling back to HTTP response only.');
    }

    const showResults = (data) => {
        progressSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        triageIcon.innerText = 'check_circle';
        triageIcon.classList.add('text-primary');
        subtitle.innerText = 'Pipeline complete';
        document.getElementById('res-issues').innerText = data.issuesCount || 0;
        document.getElementById('res-dups').innerText = data.dupCount || 0;
        document.getElementById('res-critical').innerText = data.criticalCount || 0;
    };

    launchBtn.addEventListener('click', async () => {
        const repoStr = repoInput.value.trim();
        if (!repoStr.includes('/')) return alert('Please enter owner/repo');

        const [owner, repo] = repoStr.split('/');
        localStorage.setItem('lastTriageRepo', repoStr);

        // Transition to progress view
        inputSection.classList.add('hidden');
        progressSection.classList.remove('hidden');
        activateStep('fetch');
        subtitle.innerText = 'Processing...';

        try {
            const res = await fetch('http://localhost:5000/api/triage/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo })
            });
            const data = await res.json();
            if (data.success && !socket) {
                // Fallback if Socket.io unavailable
                showResults(data.results);
            }
        } catch (e) {
            liveMsg.innerHTML = `<span class="text-error">Connection error: ${e.message}</span>`;
        }
    });

})();
