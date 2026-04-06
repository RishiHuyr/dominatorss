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
        return seconds < 10 ? "just now" : Math.floor(seconds) + "s ago";
    };

    const repoInput = document.getElementById('repo-input');
    const generateBtn = document.getElementById('generate-insights-btn');
    const cacheTimeLabel = document.getElementById('cache-time');
    
    // Metrics DOM
    const prodLift = document.getElementById('productivity-lift');
    const dedupeAcc = document.getElementById('dedupe-accuracy');
    const sentimentLabel = document.getElementById('macro-sentiment');
    const keywordsBox = document.getElementById('keyword-hotspots');
    const activityBox = document.getElementById('activity-logs');

    const renderInsights = (data) => {
        // High Level Metrics
        prodLift.innerText = data.productivityLiftHrs ? data.productivityLiftHrs.toFixed(1) : "0";
        dedupeAcc.innerText = data.deduplicationAccuracy ? data.deduplicationAccuracy.toFixed(1) + "%" : "0%";
        sentimentLabel.innerText = data.macroSentiment || "Unknown";
        
        // Setup Date
        cacheTimeLabel.innerText = `Report generated ${timeAgo(data.generatedAt)}`;

        // Keywords Mapping
        if (data.keywordHotspots && data.keywordHotspots.length > 0) {
            keywordsBox.innerHTML = data.keywordHotspots.map(kw => {
                let colorClass = 'text-primary';
                let borderColor = 'border-white/5';
                let hoverClass = 'hover:bg-white/10';

                if (kw.type === 'negative') {
                    colorClass = 'text-error';
                    hoverClass = 'hover:bg-error/10 hover:border-error/30';
                } else if (kw.type === 'positive') {
                    colorClass = 'text-secondary';
                    hoverClass = 'hover:bg-secondary/10 hover:border-secondary/30';
                }

                return `
                <div class="p-4 sm:p-6 rounded-2xl bg-white/5 border ${borderColor} flex flex-col items-center ${hoverClass} transition-colors cursor-pointer group">
                    <span class="text-[10px] sm:text-xs uppercase tracking-widest text-on-surface-variant mb-1 sm:mb-2 font-bold group-hover:text-white transition-colors">${kw.keyword}</span>
                    <span class="text-xl sm:text-2xl font-bold font-headline ${colorClass}">${kw.trend}</span>
                </div>`;
            }).join('');
        }

        // Activity Logs
        if (data.activityLogs && data.activityLogs.length > 0) {
            activityBox.innerHTML = data.activityLogs.map(log => {
                
                let dotColorClass = 'bg-primary shadow-[0_0_8px_rgba(163,166,255,0.6)]';
                let tagColorClass = 'bg-primary/10 text-primary border-primary/20';
                let barColorClass = 'bg-primary';

                if (log.outcome === "High Prio") {
                    dotColorClass = 'bg-secondary shadow-[0_0_8px_rgba(162,142,252,0.6)]';
                    tagColorClass = 'bg-secondary/10 text-secondary border-secondary/20';
                    barColorClass = 'bg-secondary';
                } else if (log.outcome === "Flagged") {
                    dotColorClass = 'bg-error shadow-[0_0_8px_rgba(255,110,132,0.6)]';
                    tagColorClass = 'bg-error/10 text-error border-error/20 flex items-center justify-center gap-1"><span class="w-1.5 h-1.5 bg-error rounded-full animate-pulse"></span> Flagged';
                    barColorClass = 'bg-error';
                } else if (log.outcome.includes("Bug")) {
                    dotColorClass = 'bg-tertiary shadow-[0_0_8px_rgba(255,165,217,0.6)]';
                    tagColorClass = 'bg-tertiary/10 text-tertiary border-tertiary/20';
                    barColorClass = 'bg-tertiary';
                }

                return `
                <tr class="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 relative">
                    <td class="py-5 pl-2 flex items-center gap-3 font-medium">
                        <span class="w-2.5 h-2.5 rounded-full ${dotColorClass}"></span>
                        ${log.eventType}
                    </td>
                    <td class="py-5 text-on-surface font-bold">${log.target}</td>
                    <td class="py-5">
                        <div class="flex items-center gap-3">
                            <div class="w-20 h-1.5 bg-surface-container rounded-full overflow-hidden">
                                <div class="h-full ${barColorClass} rounded-full relative" style="width: ${log.confidence}%"></div>
                            </div>
                            <span class="font-bold text-xs">${log.confidence}%</span>
                        </div>
                    </td>
                    <td class="py-5 text-center">
                        <span class="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${tagColorClass}">${log.outcome}</span>
                    </td>
                    <td class="py-5 text-right text-on-surface-variant text-xs font-bold pr-2">${timeAgo(log.timestamp)}</td>
                </tr>`;
            }).join('');
        }
    };

    const fetchCachedInsights = async () => {
        const repoStr = repoInput.value.trim();
        if(!repoStr) return;
        
        try {
            const res = await fetch(`http://localhost:5000/api/insights/${repoStr}`);
            const data = await res.json();
            
            if (data.success && data.insights) {
                renderInsights(data.insights);
            } else {
                cacheTimeLabel.innerText = "No cache found. Click manually to generate.";
            }
        } catch(e) {
            console.error(e);
        }
    };

    generateBtn.addEventListener('click', async () => {
        const repoStr = repoInput.value.trim();
        if(!repoStr) return alert("Please enter repo slug");
        
        const [owner, repo] = repoStr.split('/');
        
        generateBtn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Synthesizing AI...`;
        generateBtn.disabled = true;
        cacheTimeLabel.innerText = "Running aggressive repository token map analysis...";

        try {
            const res = await fetch(`http://localhost:5000/api/insights/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo })
            });
            const data = await res.json();
            
            if(data.success) {
                renderInsights(data.insights);
            } else {
                alert("Error: " + data.error);
                cacheTimeLabel.innerText = "Generation failed.";
            }
        } catch(e) {
            console.error(e);
            cacheTimeLabel.innerText = "Error requesting AI reporting.";
        } finally {
            generateBtn.innerHTML = `<span class="material-symbols-outlined text-sm">auto_awesome</span> Generate AI Report`;
            generateBtn.disabled = false;
        }
    });

    // Run passive pull automatically
    fetchCachedInsights();
});
