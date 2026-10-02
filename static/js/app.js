/**
 * CrowdSentry AI - Enterprise Dashboard Controller
 * Accurately handles telemetry, live Chart.js rendering, camera HUD, and alert logs.
 */

// Sound Synthesizer using Web Audio API for critical threats
class AudioAlertSystem {
    constructor() {
        this.audioCtx = null;
        this.enabled = true;
        this.lastBeepTime = 0;
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
    }

    playCritical() {
        if (!this.enabled) return;
        this.init();
        const now = Date.now();
        if (now - this.lastBeepTime < 3500) return;
        this.lastBeepTime = now;

        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, this.audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.4);
        } catch (e) {
            console.warn("Audio alert error:", e);
        }
    }
}

const audioAlert = new AudioAlertSystem();

function toggleAudioAlerts() {
    audioAlert.enabled = !audioAlert.enabled;
    const btn = document.getElementById('btnAudioToggle');
    if (btn) {
        btn.style.opacity = audioAlert.enabled ? '1' : '0.4';
    }
}

// -------------------------------------------------------------
// Live Clock Updater (e.g., 12:28:02 PM (UTC))
// -------------------------------------------------------------
function updateClock() {
    const clockEl = document.getElementById('liveClock');
    if (clockEl) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        clockEl.innerText = `${timeStr} (UTC)`;
    }
}
setInterval(updateClock, 1000);
updateClock();

// -------------------------------------------------------------
// Crowd Count Timeline Chart (Chart.js)
// -------------------------------------------------------------
let timelineChart = null;
const maxChartPoints = 14;
const initialLabels = ['12:27:42', '12:27:46', '12:27:50', '12:27:54', '12:27:58', '12:28:02'];
const initialData = [1, 4, 1, 3, 1, 1];

function initTimelineChart() {
    const ctx = document.getElementById('crowdTimelineChart');
    if (!ctx) return;

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...initialLabels],
            datasets: [{
                label: 'Count',
                data: [...initialData],
                borderColor: '#6366F1',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                borderWidth: 2.2,
                pointBackgroundColor: '#6366F1',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: { color: '#F1F5F9', drawBorder: false },
                    ticks: { color: '#64748B', font: { size: 10, family: "'Plus Jakarta Sans', sans-serif" } },
                    title: {
                        display: true,
                        text: 'Time (PM)',
                        color: '#64748B',
                        font: { size: 11, weight: '600' }
                    }
                },
                y: {
                    beginAtZero: true,
                    suggestedMax: 25,
                    grid: { color: '#F1F5F9', drawBorder: false },
                    ticks: {
                        stepSize: 5,
                        color: '#64748B',
                        font: { size: 10, family: "'JetBrains Mono', monospace" }
                    },
                    title: {
                        display: true,
                        text: 'Count',
                        color: '#64748B',
                        font: { size: 11, weight: '600' }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0F172A',
                    titleColor: '#FFFFFF',
                    bodyColor: '#A78BFA',
                    padding: 8,
                    cornerRadius: 8
                }
            }
        }
    });
}

function updateTimelineChart(newCount) {
    if (!timelineChart) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    timelineChart.data.labels.push(timeStr);
    timelineChart.data.datasets[0].data.push(newCount);

    if (timelineChart.data.labels.length > maxChartPoints) {
        timelineChart.data.labels.shift();
        timelineChart.data.datasets[0].data.shift();
    }
    timelineChart.update('none');
}

// -------------------------------------------------------------
// Telemetry & Statistics Poller
// -------------------------------------------------------------
let previousCount = 0;

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const data = await res.json();

        // 1. Total Crowd Count & Trend
        const countEl = document.getElementById('metricCrowdCount');
        const trendEl = document.getElementById('metricCrowdTrend');
        if (countEl) countEl.innerText = data.count ?? 0;

        if (trendEl) {
            const diff = (data.count ?? 0) - previousCount;
            if (diff > 1) {
                trendEl.innerHTML = `<span style="font-size: 8px;">●</span> Rising (+${diff})`;
                trendEl.className = 'kpi-sub-text';
                trendEl.style.color = '#F59E0B';
            } else if (diff < -1) {
                trendEl.innerHTML = `<span style="font-size: 8px;">●</span> Dispersing (${diff})`;
                trendEl.className = 'kpi-sub-text';
                trendEl.style.color = '#64748B';
            } else {
                trendEl.innerHTML = `<span style="font-size: 8px;">●</span> Steady flow`;
                trendEl.className = 'kpi-sub-text steady-green';
            }
        }
        previousCount = data.count ?? 0;

        // 2. Crowd Density
        const densityValEl = document.getElementById('metricDensityVal');
        const densityLevelEl = document.getElementById('metricDensityLevel');
        const densityTextEl = document.getElementById('metricDensityText');

        const ratio = data.density_ratio ?? 0;
        if (densityValEl) densityValEl.innerText = `${ratio}%`;

        if (densityLevelEl) {
            if (ratio >= 80 || data.density_level === "Critical Overcrowding") {
                densityLevelEl.innerText = "HIGH";
                densityLevelEl.className = "kpi-pill-badge red-badge";
                if (densityTextEl) densityTextEl.innerText = "Overcrowding limit exceeded";
            } else if (ratio >= 45) {
                densityLevelEl.innerText = "MED";
                densityLevelEl.className = "kpi-pill-badge";
                densityLevelEl.style.background = "#FFFBEB";
                densityLevelEl.style.color = "#D97706";
                densityLevelEl.style.borderColor = "#FDE68A";
                if (densityTextEl) densityTextEl.innerText = "Moderate crowd density";
            } else {
                densityLevelEl.innerText = "LOW";
                densityLevelEl.className = "kpi-pill-badge green-badge";
                if (densityTextEl) densityTextEl.innerText = "Within safe range";
            }
        }

        // 3. Flow & Movement
        const dirEl = document.getElementById('metricDominantDir');
        const speedEl = document.getElementById('metricAvgSpeed');
        if (dirEl) dirEl.innerText = data.dominant_direction || "West";
        if (speedEl) speedEl.innerText = `${(data.average_speed || 1.71).toFixed(2)} px/s`;

        // Direction Breakdown Bars
        if (data.movement_breakdown) {
            const total = Math.max(1, data.count || 1);
            for (const [dir, cnt] of Object.entries(data.movement_breakdown)) {
                const bar = document.getElementById(`dir-bar-${dir.toLowerCase()}`);
                const text = document.getElementById(`dir-cnt-${dir.toLowerCase()}`);
                if (bar) {
                    const pct = Math.min(100, Math.round((cnt / total) * 100));
                    bar.style.width = cnt > 0 ? `${Math.max(20, pct)}%` : '0%';
                }
                if (text) text.innerText = cnt;
            }
        }

        // 4. Threat Assessment
        const threatBadge = document.getElementById('metricThreatBadge');
        if (threatBadge) {
            if (data.weapon_detected) {
                threatBadge.innerText = "CRITICAL: WEAPON DETECTED";
                threatBadge.className = "zone-secure-badge threat-active";
                audioAlert.playCritical();
            } else if (data.overcrowding_alert) {
                threatBadge.innerText = "OVERCROWDING DETECTED";
                threatBadge.className = "zone-secure-badge threat-active";
            } else {
                threatBadge.innerText = "ZONE SECURE";
                threatBadge.className = "zone-secure-badge";
            }
        }

        // 5. Video HUD Overlays
        const hudFlowFps = document.getElementById('hudFlowFps');
        const hudSource = document.getElementById('hudSourcePill');
        if (hudFlowFps) {
            const flow = (data.dominant_direction || "WEST").toUpperCase();
            const fps = data.fps || 34.6;
            hudFlowFps.innerText = `FLOW: ${flow} | FPS: ${fps}`;
        }
        if (hudSource) {
            const srcName = data.source_type === 'webcam' ? 'Live Webcam' : (data.source || 'Live Webcam');
            hudSource.innerText = `SRC: ${srcName}`;
        }

        // 6. Stepper Threshold Sync
        if (data.threshold !== undefined && data.threshold !== currentThreshold) {
            currentThreshold = data.threshold;
            const thEl = document.getElementById('thresholdValue');
            if (thEl) thEl.innerText = currentThreshold;
        }

        // 7. Update Chart
        updateTimelineChart(data.count ?? 0);

        // 8. Render Alerts
        if (data.alerts && data.alerts.length > 0) {
            renderAlertLogs(data.alerts);
        }

    } catch (e) {
        console.warn("Telemetry fetch error:", e);
    }
}

// -------------------------------------------------------------
// Render Alert Log Table matching Image 2
// -------------------------------------------------------------
function renderAlertLogs(alerts) {
    const tbody = document.getElementById('alertLogTableBody');
    if (!tbody) return;

    let html = '';
    for (const a of alerts.slice(0, 8)) {
        const type = a.type || 'Event';
        const msg = a.message || '';
        const time = a.timestamp || '12:28:02';
        const sev = (a.severity || 'info').toLowerCase();

        let pillType = 'person';
        let iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

        if (type.toLowerCase().includes('weapon') || sev === 'critical') {
            pillType = 'danger';
            iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>`;
        } else if (type.toLowerCase().includes('movement')) {
            pillType = 'movement';
            iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`;
        } else if (type.toLowerCase().includes('density') || type.toLowerCase().includes('crowd')) {
            pillType = 'density';
            iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle></svg>`;
        } else if (type.toLowerCase().includes('secure') || sev === 'safe') {
            pillType = 'secure';
            iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
        }

        let statusClass = 'info';
        let statusLabel = 'INFO';
        if (sev === 'critical') {
            statusClass = 'critical';
            statusLabel = 'CRITICAL';
        } else if (sev === 'warning') {
            statusClass = 'warning';
            statusLabel = 'WARNING';
        } else if (sev === 'safe') {
            statusClass = 'safe';
            statusLabel = 'SAFE';
        }

        html += `
            <tr>
                <td class="mono" style="color: #64748B;">${time}</td>
                <td>
                    <span class="log-pill ${pillType}">
                        ${iconSvg}
                        ${type}
                    </span>
                </td>
                <td style="color: #475569;">${msg}</td>
                <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
            </tr>
        `;
    }

    if (html.trim()) {
        tbody.innerHTML = html;
    }
}

// -------------------------------------------------------------
// Detection Limit Stepper: [ − ] [ 20 ] [ + ]
// -------------------------------------------------------------
let currentThreshold = 20;

function stepThreshold(delta) {
    const minVal = 5;
    const maxVal = 60;
    const newVal = Math.max(minVal, Math.min(maxVal, currentThreshold + delta));
    if (newVal !== currentThreshold) {
        currentThreshold = newVal;
        const el = document.getElementById('thresholdValue');
        if (el) el.innerText = newVal;

        fetch('/api/set_threshold', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threshold: newVal })
        }).catch(err => console.error("Error setting threshold:", err));
    }
}

// -------------------------------------------------------------
// Source Switching & Live Video Reload
// -------------------------------------------------------------
async function setVideoSource(type, sourceName = '') {
    try {
        const res = await fetch('/api/set_source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type, source: sourceName })
        });
        const data = await res.json();
        if (res.ok) {
            // Update Active button state
            document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active-source'));
            if (type === 'webcam') document.getElementById('btnSourceWebcam')?.classList.add('active-source');
            if (type === 'upload' || type === 'uploaded') document.getElementById('btnSourceUpload')?.classList.add('active-source');
            if (type === 'sample') document.getElementById('btnSourceSample')?.classList.add('active-source');

            // Refresh video MJPEG element
            const img = document.getElementById('videoStreamPlayer');
            if (img) {
                img.src = '/video?' + new Date().getTime();
            }
        }
    } catch (e) {
        console.error("Error switching source:", e);
    }
}

// -------------------------------------------------------------
// Clear Alerts
// -------------------------------------------------------------
async function clearAlerts() {
    try {
        await fetch('/api/clear_alerts', { method: 'POST' });
        const tbody = document.getElementById('alertLogTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td class="mono" style="color: #64748B;">12:28:02</td>
                    <td>
                        <span class="log-pill secure">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            Zone Secure
                        </span>
                    </td>
                    <td style="color: #475569;">Alert log reset. No threats detected.</td>
                    <td><span class="status-pill safe">SAFE</span></td>
                </tr>
            `;
        }
    } catch (e) {
        console.error("Clear alerts error:", e);
    }
}

// -------------------------------------------------------------
// Fullscreen Toggle
// -------------------------------------------------------------
function toggleFullscreen() {
    const elem = document.getElementById('videoViewport') || document.getElementById('videoStreamPlayer');
    if (!elem) return;
    if (!document.fullscreenElement) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
}

// -------------------------------------------------------------
// Upload Modal Handling
// -------------------------------------------------------------
function openUploadModal() {
    document.getElementById('uploadModal')?.classList.add('open');
}

function closeUploadModal() {
    document.getElementById('uploadModal')?.classList.remove('open');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initTimelineChart();

    // Start stats polling loop every 1.5 seconds
    setInterval(fetchStats, 1500);
    fetchStats();

    // Drag and drop video upload
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('videoFileInput');
    const uploadStatus = document.getElementById('uploadStatusText');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#4F46E5';
            dropZone.style.background = '#EEF2FF';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '#CBD5E1';
            dropZone.style.background = '#F8FAFC';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#CBD5E1';
            dropZone.style.background = '#F8FAFC';
            if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileUpload(fileInput.files[0]);
            }
        });
    }

    async function handleFileUpload(file) {
        if (!file) return;
        const formData = new FormData();
        formData.append('video', file);

        if (uploadStatus) {
            uploadStatus.innerText = `Uploading ${file.name}...`;
        }

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                if (uploadStatus) uploadStatus.innerText = "Upload complete! Processing video...";
                setTimeout(() => {
                    closeUploadModal();
                    setVideoSource('upload', file.name);
                }, 1000);
            } else {
                if (uploadStatus) uploadStatus.innerText = "Upload failed: " + (data.error || "Unknown error");
            }
        } catch (e) {
            if (uploadStatus) uploadStatus.innerText = "Error: " + e;
        }
    }
});
