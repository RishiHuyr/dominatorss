document.addEventListener('DOMContentLoaded', () => {
    // Connect to websocket backend
    const socket = io('http://localhost:5000');
    
    const repoInput = document.getElementById('repo-input');
    const scanBtn = document.getElementById('scan-btn');
    const scanStatus = document.getElementById('scan-status');
    const clustersContainer = document.getElementById('clusters-container');

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

    scanBtn.addEventListener('click', async () => {
        const repoStr = repoInput.value.trim();
        if (!repoStr.includes('/')) {
            alert('Invalid repository format. Please use owner/repo');
            return;
        }

        const [owner, repo] = repoStr.split('/');
        
        scanBtn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Scanning...`;
        scanBtn.disabled = true;
        scanStatus.innerText = "Extracting embeddings for the latest 50 issues via OpenAI...";
        clustersContainer.innerHTML = '';

        try {
            const res = await fetch(`http://localhost:5000/api/detect-duplicates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Server error');

            scanStatus.innerText = `Scan complete. Processed ${data.processedCount} new embeddings. Found ${data.clusters.length} active clusters.`;
            renderClusters(data.clusters);
        } catch (e) {
            console.error(e);
            scanStatus.innerText = `Error: ${e.message}`;
            alert('Detection failed: ' + e.message);
        } finally {
            scanBtn.innerHTML = `<span class="material-symbols-outlined text-sm">search</span> Detect Duplicates`;
            scanBtn.disabled = false;
        }
    });

    const renderClusters = (clusters) => {
        if (clusters.length === 0) {
            clustersContainer.innerHTML = `
            <div class="glass-card p-12 text-center rounded-[2rem] border border-white/5 grayscale">
                <span class="material-symbols-outlined text-5xl text-on-surface-variant mb-4">check_circle</span>
                <h3 class="text-xl font-headline font-bold text-on-surface">No duplicates found</h3>
                <p class="text-sm text-on-surface-variant">The repository looks perfectly clean among the latest issues!</p>
            </div>`;
            return;
        }

        clustersContainer.innerHTML = clusters.map((cluster, index) => {

            // Canonical HTML
            const canonical = cluster.canonicalObj;
            let canonicalHtml = `
            <div class="col-span-1 md:col-span-2 lg:col-span-1 glass-row rounded-xl p-5 border-2 border-primary border-t-[4px] relative">
                <div class="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold uppercase tracking-wider">Canonical</div>
                <div class="flex justify-between items-start mb-3 mt-2">
                    <span class="text-sm font-bold opacity-70">#${canonical.number}</span>
                    <span class="text-xs text-on-surface-variant flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white/20"></span> ${timeAgo(canonical.createdAt)}</span>
                </div>
                <h4 class="font-headline font-bold text-base mb-2 hover:text-primary transition-colors cursor-pointer truncate" title="${canonical.title}">${canonical.title}</h4>
                <p class="text-xs text-on-surface-variant line-clamp-3">${canonical.body}</p>
                <div class="mt-4 flex items-center gap-2">
                    ${canonical.labels.map(l => `<span class="px-2 py-1 rounded bg-secondary/20 text-secondary text-[10px] font-bold">${l}</span>`).join('')}
                </div>
            </div>`;

            // Duplicates HTML
            let duplicatesHtml = cluster.duplicatesObjs.map((dup, d_idx) => {
                const confData = cluster.duplicates.find(d => d.issueId === dup.id);
                // Don't render if it was marked as ignored
                if(confData.status === 'ignored') return '';

                let matchPercent = Math.round(confData.similarityScore * 100);
                
                return `
                <div class="glass-row rounded-xl p-5 border border-white/5 opacity-80 hover:opacity-100 relative ${confData.status === 'merged' ? 'grayscale opacity-50' : ''}" id="dup-card-${dup.id.replace(/[^a-zA-Z0-9]/g, '-')}">
                    ${confData.status === 'active' ? `
                    <button onclick="handleIgnore('${cluster.clusterId}', '${dup.id}')" class="absolute top-4 right-4 text-on-surface-variant hover:text-error transition-colors" title="Not a duplicate">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>` : `<span class="absolute top-4 right-4 text-xs font-bold text-tertiary">MERGED</span>`}
                    
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-sm font-bold opacity-70">#${dup.number}</span>
                        <span class="text-xs text-on-surface-variant mr-6">${timeAgo(dup.createdAt)}</span>
                    </div>
                    <h4 class="font-headline font-bold text-base mb-2 hover:text-primary transition-colors cursor-pointer truncate" title="${dup.title}">${dup.title}</h4>
                    <p class="text-xs text-on-surface-variant line-clamp-3">${dup.body}</p>
                    <div class="mt-4 pt-4 border-t border-white/5 mx-auto text-center">
                        <span class="text-primary text-xs font-bold flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-[10px]">auto_awesome</span> ${matchPercent}% Match
                        </span>
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="glass-card rounded-[2rem] border border-white/5 p-6 md:p-8" id="cluster-container-${cluster.clusterId}">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(255,165,217,0.15)]">
                            <span class="material-symbols-outlined text-tertiary">difference</span>
                        </div>
                        <div>
                            <h3 class="text-xl font-headline font-bold text-on-surface">Cluster ${index+1}: ${cluster.name}</h3>
                            <p class="text-sm text-on-surface-variant">${cluster.duplicatesObjs.length + 1} issues detected • ${cluster.confidence}% Auto-confidence</p>
                        </div>
                    </div>
                    
                    <div class="w-full sm:w-auto flex gap-3">
                        <button onclick="handleMergeAll('${cluster.clusterId}')" class="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-on-primary font-bold shadow-[0_0_20px_rgba(163,166,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">call_merge</span> Merge All
                        </button>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${canonicalHtml}
                    ${duplicatesHtml}
                </div>
            </div>`;
        }).join('');
    };

    // Global Handlers
    window.handleMergeAll = async (clusterId) => {
        try {
            document.getElementById(`cluster-container-${clusterId}`).style.opacity = '0.5';
            await fetch('http://localhost:5000/api/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clusterId })
            });
            // Update visually over sockets
        } catch(e) {
            console.error(e);
            alert("Merge failed");
            document.getElementById(`cluster-container-${clusterId}`).style.opacity = '1';
        }
    };

    window.handleIgnore = async (clusterId, issueId) => {
        try {
            document.getElementById(`dup-card-${issueId.replace(/[^a-zA-Z0-9]/g, '-')}`).style.opacity = '0.5';
            await fetch('http://localhost:5000/api/ignore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clusterId, issueId })
            });
            document.getElementById(`dup-card-${issueId.replace(/[^a-zA-Z0-9]/g, '-')}`).remove();
        } catch (e) {
            console.error(e);
            alert("Remove failed");
        }
    };

    socket.on('cluster_resolved', (data) => {
        const clusterBox = document.getElementById(`cluster-container-${data.clusterId}`);
        if(clusterBox) {
            clusterBox.classList.add('grayscale');
            clusterBox.style.opacity = '0.5';
            const btn = clusterBox.querySelector('button');
            if(btn) {
                btn.innerHTML = `<span class="material-symbols-outlined text-sm">check</span> Merged`;
                btn.disabled = true;
                btn.classList.add('bg-tertiary');
            }
        }
    });
});
