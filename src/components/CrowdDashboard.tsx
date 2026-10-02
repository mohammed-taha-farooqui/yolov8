import { useState, useEffect, useRef } from 'react';  
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Users, TrendingUp, TrendingDown, Activity, AlertTriangle, 
  ShieldAlert, Camera, Maximize2, Video, Upload, Play, Shield
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface CrowdDataPoint {
  time: string;
  count: number;
  timestamp: number;
}

interface AlertEvent {
  id: number;
  timestamp: string;
  type: string;
  message: string;
  severity: string;
}

export function CrowdDashboard() {
  const [currentCount, setCurrentCount] = useState(0);
  const [crowdData, setCrowdData] = useState<CrowdDataPoint[]>([]);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [weaponDetected, setWeaponDetected] = useState(false);
  const [overcrowded, setOvercrowded] = useState(false);
  const [dominantDir, setDominantDir] = useState('Stationary');
  const [avgSpeed, setAvgSpeed] = useState('0.0');
  const [densityRatio, setDensityRatio] = useState(0);
  const [activeSource, setActiveSource] = useState<'sample' | 'webcam' | 'upload'>('sample');
  const [sourceName, setSourceName] = useState('video_3.mp4');
  const [fps, setFps] = useState('0.0');
  const [threshold, setThreshold] = useState(20);
  const [movementBreakdown, setMovementBreakdown] = useState<Record<string, number>>({
    North: 0,
    East: 0,
    South: 0,
    West: 0,
    Stationary: 0
  });
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLImageElement>(null);
  const videoViewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize video stream
  useEffect(() => {
    fetch(API_ENDPOINTS.START_CROWD_COUNT)
      .catch(err => console.error('Error starting crowd count:', err));

    if (videoRef.current) {
      videoRef.current.src = `${API_ENDPOINTS.VIDEO_STREAM}?t=${Date.now()}`;
    }
  }, []);

  // Polling telemetry stats
  useEffect(() => {
    const fetchCrowdData = async () => {
      try {
        setError(null);
        const statsResponse = await fetch('/api/stats');
        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          const count = stats.count || 0;
          setCurrentCount(count);
          setWeaponDetected(stats.weapon_detected || false);
          setOvercrowded(stats.overcrowding_alert || false);
          setDominantDir(stats.dominant_direction || 'Stationary');
          setAvgSpeed(String(stats.average_speed || '0.0'));
          setDensityRatio(stats.density_ratio || 0);
          setFps(String(stats.fps || '0.0'));
          setSourceName(stats.source || 'video_3.mp4');
          if (stats.threshold) setThreshold(stats.threshold);
          if (stats.movement_breakdown) setMovementBreakdown(stats.movement_breakdown);
          if (stats.alerts) setAlerts(stats.alerts);

          setCrowdData(prevData => {
            const newTimestamp = Date.now();
            const newTime = new Date(newTimestamp).toLocaleTimeString('en-US', { 
              hour12: false
            });

            if (prevData.length > 0) {
              const lastCount = prevData[prevData.length - 1].count;
              if (count > lastCount + 2) setTrend('up');
              else if (count < lastCount - 2) setTrend('down');
              else setTrend('stable');
            }

            const newDataPoint: CrowdDataPoint = {
              time: newTime,
              count: count,
              timestamp: newTimestamp
            };

            return [...prevData, newDataPoint].slice(-25);
          });
        }
      } catch (err) {
        console.warn('Telemetry fetch notice:', err);
      }
    };

    fetchCrowdData();
    const interval = setInterval(fetchCrowdData, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Input Source Switching
  const handleSetSource = async (type: 'sample' | 'webcam') => {
    setActiveSource(type);
    try {
      await fetch('/api/set_source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type })
      });
      if (videoRef.current) {
        videoRef.current.src = `${API_ENDPOINTS.VIDEO_STREAM}?t=${Date.now()}`;
      }
    } catch (e) {
      console.error('Source switch error:', e);
    }
  };

  // 4. Stepper: Detection Limit (People) [ - ] [ 20 ] [ + ]
  const handleStepThreshold = async (delta: number) => {
    const minVal = 5;
    const maxVal = 60;
    const nextVal = Math.max(minVal, Math.min(maxVal, threshold + delta));
    if (nextVal !== threshold) {
      setThreshold(nextVal);
      try {
        await fetch('/api/set_threshold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threshold: nextVal })
        });
      } catch (e) {
        console.error('Threshold set error:', e);
      }
    }
  };

  // Video Upload
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('video', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setActiveSource('upload');
        if (videoRef.current) {
          videoRef.current.src = `${API_ENDPOINTS.VIDEO_STREAM}?t=${Date.now()}`;
        }
      }
    } catch (err) {
      alert('Upload error: ' + err);
    }
  };

  // Clear Alert Log
  const handleClearAlerts = async () => {
    try {
      await fetch('/api/clear_alerts', { method: 'POST' });
      setAlerts([]);
    } catch (err) {
      console.error('Clear alerts error:', err);
    }
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    const el = videoViewportRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(console.warn);
    } else {
      document.exitFullscreen?.().catch(console.warn);
    }
  };

  // Snapshot
  const handleCaptureSnapshot = () => {
    const img = videoRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 720;
    canvas.height = img.naturalHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg');
    a.download = `surveillance_snapshot_${Date.now()}.jpg`;
    a.click();
  };

  // Density badge determination
  let densityLabel = 'LOW';
  let densityBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (densityRatio >= 85 || currentCount >= threshold) {
    densityLabel = 'HIGH';
    densityBadgeStyle = 'bg-red-50 text-red-700 border-red-200';
  } else if (densityRatio >= 45) {
    densityLabel = 'MEDIUM';
    densityBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  // Trend text
  let trendText = 'Steady flow';
  if (trend === 'up') trendText = 'Rising flow';
  if (trend === 'down') trendText = 'Dispersing flow';

  return (
    <div className="space-y-6">

      {/* Critical Threat Alert Banner */}
      {weaponDetected && (
        <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-red-500/10 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-red-900 tracking-tight">CRITICAL SECURITY ALERT: WEAPON DETECTED</div>
              <div className="text-xs text-red-700 font-medium">Potential weapon identified in monitored surveillance zone.</div>
            </div>
          </div>
          <button 
            onClick={handleClearAlerts}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Acknowledge & Dismiss
          </button>
        </div>
      )}

      {/* 3. CONTROL PANEL & 4. DETECTION LIMIT STEPPER */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        {/* Input Source Buttons */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Input Source:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSetSource('webcam')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeSource === 'webcam'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-slate-500" />
              Live Webcam
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeSource === 'upload'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Upload Video
            </button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".mp4,.avi,.mov,.mkv,.webm" 
              className="hidden" 
              onChange={handleUploadFile}
            />

            <button
              onClick={() => handleSetSource('sample')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeSource === 'sample'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <Play className="w-3.5 h-3.5 text-slate-500" />
              Sample Feed
            </button>
          </div>
        </div>

        {/* 4. Numeric Stepper: Detection Limit (People) [ - ] [ 20 ] [ + ] */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Detection Limit (People):</span>
          <div className="inline-flex items-center bg-slate-50 border border-slate-300 rounded-lg overflow-hidden shadow-inner">
            <button
              onClick={() => handleStepThreshold(-1)}
              className="w-9 h-8 bg-white hover:bg-indigo-50 text-slate-800 hover:text-indigo-600 font-bold text-base flex items-center justify-center transition-colors active:bg-indigo-100"
              title="Decrease limit"
            >
              −
            </button>
            <span className="w-12 text-center font-mono font-extrabold text-sm text-indigo-600 bg-slate-50 border-x border-slate-200">
              {threshold}
            </span>
            <button
              onClick={() => handleStepThreshold(1)}
              className="w-9 h-8 bg-white hover:bg-indigo-50 text-slate-800 hover:text-indigo-600 font-bold text-base flex items-center justify-center transition-colors active:bg-indigo-100"
              title="Increase limit"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================
           5. 4 KPI CARDS
           ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* CARD 1: Total Crowd Count */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Crowd Count</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none mb-1.5">
            {currentCount}
          </div>
          <div className="text-xs font-medium text-slate-500">
            {trendText}
          </div>
        </div>

        {/* CARD 2: Crowd Density */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Crowd Density</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${densityBadgeStyle}`}>
              {densityLabel}
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none mb-1.5">
            {densityRatio}%
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div 
              className="bg-gradient-to-r from-indigo-600 to-violet-600 h-full rounded-full transition-all duration-400"
              style={{ width: `${Math.min(100, densityRatio)}%` }}
            />
          </div>
        </div>

        {/* CARD 3: Flow & Movement */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Flow & Movement</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1.5 truncate">
            {dominantDir}
          </div>
          <div className="text-xs text-slate-500">
            Average Velocity: <strong className="font-mono text-slate-700">{avgSpeed} px/s</strong>
          </div>
        </div>

        {/* CARD 4: Threat Assessment */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Threat Assessment</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mb-2">
            {weaponDetected ? (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-50 text-red-700 border border-red-300 animate-pulse">
                CRITICAL: WEAPON
              </span>
            ) : overcrowded ? (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-300">
                WARNING: OVERCROWDED
              </span>
            ) : (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300">
                ZONE SECURE
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            AI Object & Threat Scanner
          </div>
        </div>

      </div>

      {/* ============================================================
           6. MAIN CONTENT TWO-COLUMN LAYOUT
           LEFT COLUMN: Timeline & Movement (48%)
           RIGHT COLUMN: Live Surveillance Feed & Security Log (52%)
           ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ==========================================================
             LEFT COLUMN (5 of 12 cols = approx 45-50%)
             ========================================================== */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* 9. CROWD COUNT TIMELINE */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Crowd Count Timeline</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  LIVE
                </span>
              </div>
              <span className="text-xs text-slate-400">1.0s telemetry interval</span>
            </div>

            <div className="h-[210px] w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={crowdData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="indigoTimeline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94A3B8"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis 
                    stroke="#94A3B8"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#FFFFFF', 
                      border: '1px solid #E2E8F0',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.12)',
                      fontSize: '0.75rem',
                      color: '#0F172A'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#4F46E5" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#indigoTimeline)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 10. DIRECTIONAL MOVEMENT PATTERNS */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Directional Movement Patterns</h3>
              <span className="text-xs text-slate-400 font-semibold">FLOW VECTORS</span>
            </div>

            <div className="space-y-3 pt-1">
              {[
                { label: 'North', arrow: '↑', key: 'North' },
                { label: 'East', arrow: '→', key: 'East' },
                { label: 'South', arrow: '↓', key: 'South' },
                { label: 'West', arrow: '←', key: 'West' },
                { label: 'Stationary', arrow: '•', key: 'Stationary' },
              ].map(({ label, arrow, key }) => {
                const count = movementBreakdown[key] || 0;
                const pct = currentCount > 0 ? (count / currentCount) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3 text-xs">
                    <div className="w-24 flex items-center gap-1.5 font-semibold text-slate-600">
                      <span className="text-indigo-600 font-bold">{arrow}</span>
                      <span>{label}</span>
                    </div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round(pct))}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono font-bold text-slate-800">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ==========================================================
             RIGHT COLUMN (6 of 12 cols = approx 50-55%)
             Live Surveillance Feed + Alert Log Directly Below
             ========================================================== */}
        <div className="lg:col-span-6 space-y-6">

          {/* 7. LIVE SURVEILLANCE FEED (Top of Right Column) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Live Surveillance Feed</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCaptureSnapshot}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Capture snapshot"
                >
                  <Camera className="w-3 h-3" />
                  Snapshot
                </button>
                <button
                  onClick={handleToggleFullscreen}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-3 h-3" />
                  Fullscreen
                </button>
              </div>
            </div>

            {/* Video Viewport */}
            <div 
              ref={videoViewportRef}
              className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden shadow-inner flex items-center justify-center"
            >
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-white/10">
                  SRC: {sourceName}
                </span>
                <span className="bg-slate-900/80 backdrop-blur-md text-emerald-400 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-white/10">
                  FPS: {fps}
                </span>
              </div>

              <img 
                ref={videoRef}
                src={`${API_ENDPOINTS.VIDEO_STREAM}?t=${Date.now()}`}
                alt="Live crowd feed"
                className="w-full h-full object-contain"
                onError={() => setError('Live video stream disconnected.')}
              />
            </div>
          </div>

          {/* 8. LIVE ANOMALY & SECURITY ALERT LOG (Directly Below Video Feed) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Live Anomaly & Security Alert Log</h3>
              <button
                onClick={handleClearAlerts}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                Clear Log
              </button>
            </div>

            <div className="overflow-x-auto max-h-[220px]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-50">
                    <th className="py-2 px-3">TIME</th>
                    <th className="py-2 px-3">ANOMALY TYPE</th>
                    <th className="py-2 px-3">EVENT DETAILS</th>
                    <th className="py-2 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No active security alerts logged
                      </td>
                    </tr>
                  ) : (
                    alerts.map((a) => {
                      const sev = a.severity || 'info';
                      const badgeClass = sev === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                                         sev === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                         sev === 'safe' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                         'bg-blue-50 text-blue-700 border-blue-200';
                      return (
                        <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-slate-500">{a.timestamp}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{a.type}</td>
                          <td className="py-2 px-3 text-slate-600">{a.message}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeClass}`}>
                              {sev.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
