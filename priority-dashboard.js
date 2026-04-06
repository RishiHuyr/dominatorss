document.addEventListener('DOMContentLoaded', () => {
    // Basic TimeFormatter
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

    const socket = io('http://localhost:5000');
    
    const repoInput = document.getElementById('repo-input');
    const scanBtn = document.getElementById('scan-btn');
    const scanStatus = document.getElementById('scan-status');
    const issuesList = document.getElementById('issues-list');

    // Metrics bindings
    const strainIndex = document.getElementById('strain-index');
    const sev1Count = document.getElementById('sev1-count');
    const sev2Count = document.getElementById('sev2-count');
    const sev3Count = document.getElementById('sev3-count');
    const sev1Bar = document.getElementById('sev1-bar');
    const sev2Bar = document.getElementById('sev2-bar');
    const sev3Bar = document.getElementById('sev3-bar');

    const updateDisplay = async () => {
        const repoStr = repoInput.value.trim();
        if (!repoStr.includes('/')) return;
        
        try {
            // 1. Fetch Metrics
            const metricsRes = await fetch(`http://localhost:5000/api/priority/metrics/${repoStr}`);
            const metrics = await metricsRes.json();
            
            if (metrics.success) {
                strainIndex.innerText = metrics.strainIndex;
                sev1Count.innerText = metrics.distribution['Sev-1'] || 0;
                sev2Count.innerText = metrics.distribution['Sev-2'] || 0;
                sev3Count.innerText = metrics.distribution['Sev-3'] || 0;
                
                const tot = metrics.total || 1;
                sev1Bar.style.width = `${((metrics.distribution['Sev-1']||0)/tot)*100}%`;
                sev2Bar.style.width = `${((metrics.distribution['Sev-2']||0)/tot)*100}%`;
                sev3Bar.style.width = `${((metrics.distribution['Sev-3']||0)/tot)*100}%`;
            }

            // 2. Fetch List
            const listRes = await fetch(`http://localhost:5000/api/priority/list/${repoStr}`);
            const listData = await listRes.json();

            if (listData.success && listData.issues.length > 0) {
                issuesList.innerHTML = listData.issues.map(issue => {
                    let borderCol, bgCol, textCol, badgeCol, shadowCol;

                    if (issue.severity === 'Sev-1') {
                        borderCol = 'border-error'; bgCol = 'bg-error/5'; textCol = 'text-error'; badgeCol = 'bg-error text-white'; shadowCol = 'shadow-[0_0_15px_rgba(255,110,132,0.4)]';
                    } else if (issue.severity === 'Sev-2') {
                        borderCol = 'border-[#ffa5d9]'; bgCol = 'bg-[#ffa5d9]/5'; textCol = 'text-[#ffa5d9]'; badgeCol = 'bg-[#ffa5d9] text-[#701455]'; shadowCol = '';
                    } else {
                        borderCol = 'border-primary'; bgCol = 'bg-primary/5'; textCol = 'text-primary'; badgeCol = 'bg-primary text-on-primary'; shadowCol = '';
                    }

                    return `
                    <div class="glass-row p-6 rounded-2xl border-l-[4px] ${borderCol} ${bgCol} relative overflow-hidden group hover:opacity-80 transition-opacity">
                        ${issue.severity === 'Sev-1' ? `<div class="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-error/10 to-transparent pointer-events-none"></div>` : ''}
                        
                        <div class="flex justify-between items-start mb-2 group" title="${issue.reason || 'AI Priority Assessment'}">
                            <div class="flex items-center gap-3">
                                <span class="${badgeCol} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${shadowCol}">${issue.severity}</span>
                                <span class="text-sm font-bold opacity-70">#${issue.number}</span>
                                <span class="text-xs ${textCol} opacity-80 border border-${borderCol}/30 px-1.5 py-0.5 rounded">Score: ${issue.score}</span>
                            </div>
                            <span class="text-xs text-on-surface-variant">${timeAgo(issue.createdAt)}</span>
                        </div>
                        <h4 class="text-lg font-headline font-bold mb-3 mt-1 truncate" title="${issue.title}">${issue.title}</h4>
                        <p class="text-sm text-on-surface-variant mb-4 leading-relaxed line-clamp-2">${issue.body || 'No description provided.'}</p>
                        
                        <div class="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-4 mt-2">
                            <div class="flex gap-2">
                                <span class="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-on-surface-variant flex items-center gap-1 group-hover:text-white transition-colors cursor-help" title="AI Sentiment">
                                    <span class="material-symbols-outlined text-[12px]">${issue.sentimentTag.toLowerCase().includes('anger') ? 'sentiment_very_dissatisfied' : 'psychology'}</span> ${issue.sentimentTag}
                                </span>
                                <span class="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[12px]">${issue.trend === 'Escalating' ? 'trending_up' : 'trending_flat'}</span> ${issue.trend}
                                </span>
                            </div>
                            <button onclick="alert('Routing Issue API not fully mocked yet.')" class="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/10 transition-colors">Review Logs</button>
                        </div>
                    </div>`;
                }).join('');
            }
        } catch(e) {
            console.error(e);
        }
    };

    scanBtn.addEventListener('click', async () => {
        const repoStr = repoInput.value.trim();
        if (!repoStr.includes('/')) { alert("Use format owner/repo"); return; }
        
        const [owner, repo] = repoStr.split('/');
        
        scanBtn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Processing...`;
        scanBtn.disabled = true;
        scanStatus.innerText = "Querying live github issues & applying heuristic AI scaling...";

        try {
            const res = await fetch(`http://localhost:5000/api/priority/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo })
            });
            const data = await res.json();
            
            if (res.ok) {
                scanStatus.innerText = `Scan processed ${data.processedCount} new issues immediately. UI rendering...`;
                updateDisplay();
            } else {
                throw new Error(data.error);
            }
        } catch(e) {
            scanStatus.innerText = `Error: ${e.message}`;
        } finally {
            scanBtn.innerHTML = `<span class="material-symbols-outlined text-sm">priority_high</span> Analyze Priority`;
            scanBtn.disabled = false;
        }
    });

    socket.on('priority_update', (data) => {
        if(repoInput.value.trim() === data.repo) {
            updateDisplay();
        }
    });

    // Initial silent load if any data exists
    updateDisplay();
});
