document.addEventListener('DOMContentLoaded', () => {
    const timeAgo = (dateStr) => {
        const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return "just now";
    };

    const repoInput = document.getElementById('global-repo-input');
    const analyzeBtn = document.getElementById('global-analyze-btn');
    const statusText = document.getElementById('global-status-text');
    const repoSuggestions = document.getElementById('repo-suggestions');
    const repoListItems = document.getElementById('repo-list-items');
    
    // Nav Profile Elements
    const navUsername = document.getElementById('nav-username');
    const navStatus = document.getElementById('nav-status');
    const navAvatar = document.getElementById('nav-avatar');

    const liveStream = document.getElementById('live-stream-container');
    const statTotal = document.getElementById('metric-total-issues');
    const statHighPrio = document.getElementById('metric-high-priority');
    const statDuplicates = document.getElementById('metric-duplicates');

    let userRepos = [];
    let isConnected = false;

    const fetchAndRenderRawIssues = async (repoSlug) => {
        liveStream.innerHTML = `
            <div class="glass-card p-4 md:p-5 rounded-2xl border border-white/5 flex items-start gap-4 md:gap-5 justify-center">
                <span class="material-symbols-outlined animate-spin text-primary">sync</span>
                <span class="text-sm text-on-surface-variant font-bold">Bridging GitHub API...</span>
            </div>`;
            
        try {
            const res = await fetch(`http://localhost:5000/api/github/issues/${repoSlug}`);
            const data = await res.json();
            
            // The backend returns an array directly now, or an error object
            if (Array.isArray(data) && data.length > 0) {
                // Instantly mapped visual rendering of raw tickets!
                liveStream.innerHTML = data.map(issue => `
                    <div class="glass-card p-4 md:p-5 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors relative group w-full mb-4">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-on-surface-variant border border-white/10">RAW Sync</span>
                            <span class="text-sm font-bold opacity-70">#${issue.number}</span>
                            <span class="text-xs text-on-surface-variant ml-auto text-right w-full block">${timeAgo(issue.created_at || issue.createdAt || new Date())}</span>
                        </div>
                        <h5 class="font-headline font-bold mb-2 truncate">${issue.title}</h5>
                        <p class="text-sm text-on-surface-variant line-clamp-2">${issue.body || 'No description available.'}</p>
                    </div>
                `).join('');
                statTotal.innerText = data.length;
                return true;
            } else {
                liveStream.innerHTML = `<p class="text-sm text-on-surface-variant text-center my-10">No active issues found in ${repoSlug}</p>`;
                return false;
            }
        } catch(e) {
            console.error(e);
            liveStream.innerHTML = `<p class="text-sm text-error text-center my-10">Raw Github Fetch Failed: ${e.message}</p>`;
            return false;
        }
    };

    analyzeBtn.addEventListener('click', async () => {
        const repoStr = repoInput.value.trim();
        if(!repoStr.includes('/')) return alert('Please enter owner/repo manually');
        
        const [owner, repo] = repoStr.split('/');
        
        analyzeBtn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Processing Architecture...`;
        analyzeBtn.disabled = true;
        
        // 1. Initial UI Overrides
        statusText.innerText = `[1/3] Injecting raw active issues directly from Github REST...`;
        statTotal.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">refresh</span>`;
        statHighPrio.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">refresh</span>`;
        statDuplicates.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">refresh</span>`;
        
        // --- ASYNC PIPELINE ---
        
        const validSync = await fetchAndRenderRawIssues(repoStr);
        if(!validSync) {
            analyzeBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">bolt</span> Analyze Repository`;
            analyzeBtn.disabled = false;
            statusText.innerText = "Aborted due to Github API error or empty repository.";
            return;
        }

        try {
            // Priority 1: Duplicate Scan (Blocks the others to safely record accurate duplication math metrics)
            statusText.innerText = `[2/3] Analyzing vector similarities across the system...`;
            
            const dupRes = await fetch(`http://localhost:5000/api/duplicate/detect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo })
            });

            if (dupRes.ok) {
                // It successfully scanned.
                const dbRes = await fetch(`http://localhost:5000/api/duplicate/clusters/${owner}/${repo}`);
                const dbData = await dbRes.json();
                statDuplicates.innerText = dbData.clusters ? dbData.clusters.length : '0';
            } else {
                statDuplicates.innerText = '!';
            }

            // Priority 2: Concurrent Insights + Priority Scanning
            statusText.innerText = `[3/3] Triggering parallel LLM heuristics...`;
            
            const [prioRes, insightsRes] = await Promise.allSettled([
                fetch(`http://localhost:5000/api/priority/scan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ owner, repo })
                }),
                fetch(`http://localhost:5000/api/insights/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ owner, repo })
                })
            ]);

            if (prioRes.status === 'fulfilled' && prioRes.value.ok) {
                // Priority scan finished, fetch exact Sev-1 figures
                const prioDataRes = await fetch(`http://localhost:5000/api/priority/metrics/${owner}/${repo}`);
                const prioData = await prioDataRes.json();
                statHighPrio.innerText = (prioData.distribution && prioData.distribution['Sev-1']) ? prioData.distribution['Sev-1'] : '0';
            } else {
                statHighPrio.innerText = '!';
                console.error("Priority LLM pipeline failed");
            }
            
            if (insightsRes.status === 'rejected' || !insightsRes.value.ok) {
                console.error("Insights LLM pipeline failed");
            }

            statusText.innerHTML = `<span class="text-primary tracking-widest text-xs uppercase font-bold">All 3 AI Oracles complete logic cycle. Systems synced.</span>`;

        } catch(e) {
            console.error('Fatal Pipeline Execution Error:', e);
            statusText.innerHTML = `<span class="text-error tracking-widest text-xs uppercase font-bold">Pipeline degraded: ${e.message}</span>`;
        } finally {
            analyzeBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">check_circle</span> Analysis Complete`;
            setTimeout(() => {
                analyzeBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">bolt</span> Analyze Repository`;
                analyzeBtn.disabled = false;
            }, 3000);
        }
    });
    // --- AUTH & REPO LOGIC ---
    const checkAuthStatus = async () => {
        try {
            const res = await fetch('http://localhost:5000/auth/status');
            const data = await res.json();
            if (data.connected) {
                isConnected = true;
                navUsername.innerText = data.username;
                navStatus.innerText = "Linked ✅";
                navAvatar.src = data.avatar;
                fetchUserRepos();
            }
        } catch(e) { console.warn("Auth check failed", e); }
    };

    const fetchUserRepos = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/github/repos');
            userRepos = await res.json();
            renderRepoSuggestions();
        } catch(e) { console.warn("Repo fetch failed", e); }
    };

    const renderRepoSuggestions = (filter = "") => {
        const filtered = userRepos.filter(r => r.full_name.toLowerCase().includes(filter.toLowerCase()));
        if (filtered.length === 0 || filter === "") {
            // If empty filter, show first 5
            repoListItems.innerHTML = userRepos.slice(0, 5).map(r => `
                <div class="repo-item px-4 py-3 hover:bg-white/5 cursor-pointer flex flex-col gap-0.5 border-b border-white/5 last:border-0" data-full-name="${r.full_name}">
                    <span class="text-sm font-bold text-white">${r.full_name}</span>
                    <span class="text-[10px] text-on-surface-variant truncate">${r.description || 'No description'}</span>
                </div>
            `).join('');
        } else {
            repoListItems.innerHTML = filtered.map(r => `
                <div class="repo-item px-4 py-3 hover:bg-white/5 cursor-pointer flex flex-col gap-0.5 border-b border-white/5 last:border-0" data-full-name="${r.full_name}">
                    <span class="text-sm font-bold text-white">${r.full_name}</span>
                    <span class="text-[10px] text-on-surface-variant truncate">${r.description || 'No description'}</span>
                </div>
            `).join('');
        }

        document.querySelectorAll('.repo-item').forEach(item => {
            item.addEventListener('click', () => {
                repoInput.value = item.getAttribute('data-full-name');
                repoSuggestions.classList.add('hidden');
            });
        });
    };

    repoInput.addEventListener('focus', () => {
        if (isConnected && userRepos.length > 0) {
            repoSuggestions.classList.remove('hidden');
        }
    });

    repoInput.addEventListener('input', (e) => {
        if (isConnected) {
            renderRepoSuggestions(e.target.value);
            repoSuggestions.classList.remove('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!repoInput.contains(e.target) && !repoSuggestions.contains(e.target)) {
            repoSuggestions.classList.add('hidden');
        }
    });

    checkAuthStatus();
});
