/**
 * Real-Time Crowd Monitoring System - Frontend Controller
 */

// Sound Synthesizer using Web Audio API
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

    playWarning() {
        if (!this.enabled) return;
        this.init();
        const now = Date.now();
        if (now - this.lastBeepTime < 3500) return; // Prevent spam
        this.lastBeepTime = now;

        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.3);
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

    playCritical() {
        if (!this.enabled) return;
        this.init();
        const now = Date.now();
        if (now - this.lastBeepTime < 3500) return;
        this.lastBeepTime = now;

        try {
            // Dual frequency warble siren
            const osc1 = this.audioCtx.createOscillator();
            const osc2 = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc1.type = 'square';
            osc2.type = 'sawtooth';
            osc1.frequency.setValueAtTime(750, this.audioCtx.currentTime);
            osc1.frequency.setValueAtTime(950, this.audioCtx.currentTime + 0.2);
            osc2.frequency.setValueAtTime(750, this.audioCtx.currentTime);
            osc2.frequency.setValueAtTime(950, this.audioCtx.currentTime + 0.2);

            gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.6);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(this.audioCtx.currentTime + 0.6);
            osc2.stop(this.audioCtx.currentTime + 0.6);
        } catch (e) {
            console.warn("Audio critical siren error:", e);
        }
    }
}

const audioAlert = new AudioAlertSystem();

// Global Chart instance
let timelineChart = null;
const chartDataPoints = 20;
let chartLabels = [];
let chartData = [];

// Initialize Timeline Chart
function initChart() {
    const ctx = document.getElementById('crowdTimelineChart');
    if (!ctx) return;

    // Prefill dummy labels
    const now = new Date();
    for (let i = chartDataPoints - 1; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 1500);
        chartLabels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        chartData.push(0);
    }

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Crowd Count',
                data: chartData,
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointRadius: 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: { color: '#F1F5F9' },
                    ticks: { color: '#64748B', font: { size: 10 }, maxTicksLimit: 6 }
                },
                y: {
                    beginAtZero: true,
                    suggestedMax: 25,
                    grid: { color: '#F1F5F9' },
                    ticks: { color: '#64748B', font: { size: 11 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#FFFFFF',
                    titleColor: '#0F172A',
                    bodyColor: '#4F46E5',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    padding: 10,
                    boxPadding: 4,
                    usePointStyle: true
                }
            }
        }
    });
}

function updateChart(newCount) {
    if (!timelineChart) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    chartLabels.push(timeStr);
    chartData.push(newCount);

    if (chartLabels.length > chartDataPoints) {
        chartLabels.shift();
        chartData.shift();
    }

    timelineChart.update('none');
}

// Clock updater
function updateClock() {
    const clockEl = document.getElementById('liveClock');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString() + ' (UTC)';
    }
}
setInterval(updateClock, 1000);
updateClock();

// Polling telemetry stats
let previousCount = 0;

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const data = await res.json();

        // 1. Crowd Count Hero Metric
        const countEl = document.getElementById('metricCrowdCount');
        const countTrendEl = document.getElementById('metricCrowdTrend');
        if (countEl) countEl.innerText = data.count;

        if (countTrendEl) {
            const diff = data.count - previousCount;
            if (diff > 2) {
                countTrendEl.innerText = `Rising flow (+${diff})`;
            } else if (diff < -2) {
                countTrendEl.innerText = `Dispersing flow (${diff})`;
            } else {
                countTrendEl.innerText = "Steady flow";
            }
        }
        previousCount = data.count;

        // 2. Crowd Density Metric
        const densityLevelEl = document.getElementById('metricDensityLevel');
        const densityBarEl = document.getElementById('metricDensityBar');
        const densityValEl = document.getElementById('metricDensityVal');
        
        if (densityLevelEl) {
            let label = "LOW";
            let badgeClass = "badge-low";
            if (data.density_ratio >= 85 || data.density_level === "Critical Overcrowded") {
                label = "HIGH";
                badgeClass = "badge-high";
            } else if (data.density_ratio >= 45 || data.density_level === "Moderate" || data.density_level === "High") {
                label = "MEDIUM";
                badgeClass = "badge-medium";
            }
            densityLevelEl.innerText = label;
            densityLevelEl.className = `kpi-badge ${badgeClass}`;
        }
        if (densityBarEl) densityBarEl.style.width = `${Math.min(100, data.density_ratio)}%`;
        if (densityValEl) densityValEl.innerText = `${data.density_ratio}%`;

        // 3. Movement Direction & Speed
        const dirEl = document.getElementById('metricDominantDir');
        const speedEl = document.getElementById('metricAvgSpeed');

        if (dirEl) dirEl.innerText = data.dominant_direction;
        if (speedEl) speedEl.innerText = `${data.average_speed} px/s`;

        // Update direction breakdown bars
        if (data.movement_breakdown) {
            for (const [dir, cnt] of Object.entries(data.movement_breakdown)) {
                const bar = document.getElementById(`dir-bar-${dir.toLowerCase()}`);
                const text = document.getElementById(`dir-cnt-${dir.toLowerCase()}`);
                if (bar) {
                    const pct = data.count > 0 ? (cnt / data.count) * 100 : 0;
                    bar.style.width = `${Math.min(100, Math.round(pct))}%`;
                }
                if (text) text.innerText = cnt;
            }
        }

        // 4. Security & Anomaly Threat Status
        const threatBadgeEl = document.getElementById('metricThreatBadge');
        const alertBannerEl = document.getElementById('globalAlertBanner');
        const alertTitleEl = document.getElementById('alertBannerTitle');
        const alertDescEl = document.getElementById('alertBannerDesc');

        if (data.weapon_detected) {
            if (threatBadgeEl) {
                threatBadgeEl.innerText = "CRITICAL: WEAPON DETECTED";
                threatBadgeEl.className = "threat-status-badge danger";
            }
            if (alertBannerEl) {
                alertBannerEl.className = "alert-banner critical";
                alertTitleEl.innerText = "CRITICAL SECURITY ALERT";
                alertDescEl.innerText = "Weapon or hazardous object identified in monitored zone!";
            }
            audioAlert.playCritical();
        } else if (data.overcrowding_alert) {
            if (threatBadgeEl) {
                threatBadgeEl.innerText = "WARNING: OVERCROWDED";
                threatBadgeEl.className = "threat-status-badge danger";
            }
            if (alertBannerEl) {
                alertBannerEl.className = "alert-banner warning";
                alertTitleEl.innerText = "OVERCROWDING ANOMALY DETECTED";
                alertDescEl.innerText = `Occupancy exceeded safe limit (${data.count} / ${data.threshold})`;
            }
            audioAlert.playWarning();
        } else {
            if (threatBadgeEl) {
                threatBadgeEl.innerText = "ZONE SECURE";
                threatBadgeEl.className = "threat-status-badge safe";
            }
            if (alertBannerEl) {
                alertBannerEl.className = "alert-banner";
            }
        }

        // 5. FPS & Source Pill
        const fpsEl = document.getElementById('liveFps');
        const sourcePillEl = document.getElementById('hudSourcePill');
        if (fpsEl) fpsEl.innerText = `FPS: ${data.fps}`;
        if (sourcePillEl) sourcePillEl.innerText = `SRC: ${data.source}`;

        // Sync stepper threshold if server returned a different value
        if (data.threshold !== undefined && data.threshold !== currentThreshold) {
            updateThresholdDisplay(data.threshold);
        }

        // 6. Update Timeline Chart
        updateChart(data.count);

        // 7. Render Alerts Log Table
        renderAlertLogs(data.alerts || []);

    } catch (err) {
        console.warn("Telemetry fetch error:", err);
    }
}

// Render alert events log (TIME | ANOMALY TYPE | EVENT DETAILS | STATUS)
function renderAlertLogs(alerts) {
    const tbody = document.getElementById('alertLogTableBody');
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No active security alerts logged</td></tr>`;
        return;
    }

    let html = '';
    for (const a of alerts) {
        const severityClass = (a.severity || 'info').toLowerCase();
        let statusLabel = 'INFO';
        if (severityClass === 'critical') statusLabel = 'CRITICAL';
        else if (severityClass === 'warning') statusLabel = 'WARNING';
        else if (severityClass === 'safe') statusLabel = 'SAFE';

        html += `
            <tr>
                <td class="mono" style="color: var(--text-muted); font-size: 0.775rem;">${a.timestamp}</td>
                <td style="font-weight: 700; color: var(--text-main);">${a.type}</td>
                <td style="color: var(--text-muted); font-size: 0.8rem;">${a.message}</td>
                <td><span class="status-cell-badge ${severityClass}">${statusLabel}</span></td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

// Source Switching
async function setVideoSource(type, sourceName = '') {
    try {
        const res = await fetch('/api/set_source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type, source: sourceName })
        });
        const data = await res.json();
        if (res.ok) {
            document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active-source'));
            if (type === 'sample') document.getElementById('btnSourceSample')?.classList.add('active-source');
            if (type === 'webcam') document.getElementById('btnSourceWebcam')?.classList.add('active-source');
            if (type === 'uploaded') document.getElementById('btnSourceUpload')?.classList.add('active-source');

            restartVideoStream();
        } else {
            alert("Failed to switch source: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        alert("Error switching video source: " + e);
    }
}

// Restart Video Stream
function restartVideoStream() {
    const img = document.getElementById('videoStreamPlayer');
    if (img) {
        img.src = '/video?' + new Date().getTime();
    }
}

// 4. Numeric Stepper: Detection Limit (People) [ - ] [ 20 ] [ + ]
let currentThreshold = 20;

function stepThreshold(delta) {
    const minVal = 5;
    const maxVal = 60;
    const newVal = Math.max(minVal, Math.min(maxVal, currentThreshold + delta));
    if (newVal !== currentThreshold) {
        currentThreshold = newVal;
        updateThresholdDisplay(newVal);
        fetch('/api/set_threshold', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threshold: newVal })
        }).catch(err => console.error("Error setting threshold:", err));
    }
}

function updateThresholdDisplay(val) {
    currentThreshold = val;
    const el = document.getElementById('thresholdValue');
    if (el) el.innerText = val;
}

// Fullscreen toggle for Video Feed
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

// Simulation Anomaly Buttons
async function triggerSimulation(type) {
    try {
        await fetch('/api/test_alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type })
        });
        fetchStats();
    } catch (e) {
        console.error("Simulation error:", e);
    }
}

// Clear Alerts
async function clearAlerts() {
    try {
        await fetch('/api/clear_alerts', { method: 'POST' });
        fetchStats();
    } catch (e) {
        console.error("Clear alerts error:", e);
    }
}

// Toggle Overlays
async function toggleOverlay(overlayName) {
    try {
        await fetch('/api/toggle_overlay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ overlay: overlayName })
        });
    } catch (e) {
        console.error("Toggle overlay error:", e);
    }
}

// Modal handling
function openUploadModal() {
    document.getElementById('uploadModal')?.classList.add('open');
}

function closeUploadModal() {
    document.getElementById('uploadModal')?.classList.remove('open');
}

// Video Upload Handler
function setupUploadHandlers() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('videoFileInput');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    });
}

async function uploadFile(file) {
    const statusText = document.getElementById('uploadStatusText');
    if (statusText) statusText.innerText = `Uploading ${file.name}...`;

    const formData = new FormData();
    formData.append('video', file);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            if (statusText) statusText.innerText = "Upload successful! Feed activated.";
            setTimeout(() => {
                closeUploadModal();
                restartVideoStream();
            }, 800);
        } else {
            alert("Upload failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        alert("Upload error: " + err);
    }
}

// Snapshot Capture
function captureSnapshot() {
    const img = document.getElementById('videoStreamPlayer');
    if (!img) return;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 720;
    canvas.height = img.naturalHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg');
    a.download = `crowd_monitoring_${Date.now()}.jpg`;
    a.click();
}

// Toggle Audio Alerts Button
function toggleAudioAlerts() {
    audioAlert.enabled = !audioAlert.enabled;
    const btn = document.getElementById('btnAudioToggle');
    if (btn) {
        if (audioAlert.enabled) {
            btn.classList.add('active');
            btn.innerHTML = `🔊 Audio: ON`;
        } else {
            btn.classList.remove('active');
            btn.innerHTML = `🔇 Audio: MUTED`;
        }
    }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    setupUploadHandlers();

    // Start background telemetry polling
    setInterval(fetchStats, 1000);
    fetchStats();
});
