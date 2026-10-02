import { useState, useEffect, useRef } from 'react';
import { 
  Upload, Search, AlertCircle, CheckCircle, X, AlertTriangle, 
  Download, UserCheck, Shield, Sparkles, Video
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface Detection {
  id: number;
  timestamp: string;
  confidence: number;
  location: string;
  x: number;
  y: number;
}

export function PersonIdentification() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [searchComplete, setSearchComplete] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [statusPoller, setStatusPoller] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceDetectionEnabled, setFaceDetectionEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLImageElement>(null);

  // Cleanup poller and blob URLs on unmount
  useEffect(() => {
    return () => {
      if (statusPoller) {
        clearInterval(statusPoller);
      }
      if (screenshotUrl) {
        URL.revokeObjectURL(screenshotUrl);
      }
    };
  }, [statusPoller, screenshotUrl]);

  // Start video stream when face detection is enabled
  useEffect(() => {
    if (faceDetectionEnabled && videoRef.current) {
      const videoUrl = `${API_ENDPOINTS.FACE_VIDEO}?t=${Date.now()}`;
      videoRef.current.src = videoUrl;
    }
  }, [faceDetectionEnabled]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setIsSearching(false);
        setDetections([]);
        setSearchComplete(false);
        setMatchFound(false);
        setScreenshotUrl(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = async () => {
    if (!uploadedImage || !uploadedFile) return;
    
    setIsSearching(true);
    setDetections([]);
    setSearchComplete(false);
    setMatchFound(false);
    setScreenshotUrl(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);
      const uploadResp = await fetch(API_ENDPOINTS.UPLOAD_FACE, {
        method: 'POST',
        body: formData,
      });
      if (!uploadResp.ok) {
        const errJson = await uploadResp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to upload face image');
      }

      const toggleResponse = await fetch(API_ENDPOINTS.TOGGLE_FACE_DETECTION);
      if (!toggleResponse.ok) throw new Error('Failed to start face detection');
      
      const toggleData = await toggleResponse.json();
      const isEnabled = toggleData.status?.includes('started') || toggleData.enabled;
      setFaceDetectionEnabled(isEnabled);

      if (isEnabled && videoRef.current) {
        videoRef.current.src = `${API_ENDPOINTS.FACE_VIDEO}?t=${Date.now()}`;
      }

      const pollId = window.setInterval(async () => {
        try {
          const res = await fetch(API_ENDPOINTS.FACE_MATCH_STATUS);
          if (!res.ok) return;
          const data = await res.json();
          if (data.match_found && data.screenshot_available) {
            setMatchFound(true);
            setSearchComplete(true);
            setIsSearching(false);

            const shotRes = await fetch(API_ENDPOINTS.FACE_SCREENSHOT);
            if (shotRes.ok) {
              const blob = await shotRes.blob();
              const url = URL.createObjectURL(blob);
              setScreenshotUrl(url);
            }

            clearInterval(pollId);
            setStatusPoller(null);
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 1500);

      setStatusPoller(pollId);

      setTimeout(() => {
        setIsSearching(false);
        setSearchComplete(true);
        clearInterval(pollId);
        setStatusPoller(null);
      }, 60000);
    } catch (err) {
      console.error('Error starting face detection:', err);
      setError((err as Error).message || 'Failed to start face detection. Ensure the Flask server is running.');
      setIsSearching(false);
    }
  };

  const clearUpload = async () => {
    if (faceDetectionEnabled) {
      try {
        await fetch(API_ENDPOINTS.TOGGLE_FACE_DETECTION);
        setFaceDetectionEnabled(false);
      } catch (err) {
        console.error('Error stopping face detection:', err);
      }
    }

    setUploadedImage(null);
    setUploadedFile(null);
    setIsSearching(false);
    setDetections([]);
    setSearchComplete(false);
    setMatchFound(false);
    if (statusPoller) {
      clearInterval(statusPoller);
      setStatusPoller(null);
    }
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoRef.current) videoRef.current.src = '';
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
      setScreenshotUrl(null);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Section Header */}
      <div className="pb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          Biometric Facial Analysis
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Target Person <span className="text-gradient-corporate">Identification</span>
        </h2>
        <p className="text-slate-500 text-sm sm:text-base mt-1.5 max-w-2xl leading-relaxed">
          Upload reference identity photographs to match, track, and alert across real-time video surveillance streams.
        </p>
      </div>

      {/* Error notice */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-sm shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload and Workflow Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Image Upload Card (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-corporate-card hover:shadow-corporate-hover transition-all duration-300">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Reference Photo Upload</h3>
              <p className="text-xs text-slate-400">Supported formats: JPG, PNG, WEBP (Max 10MB)</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
          </div>

          {!uploadedImage ? (
            <label className="flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-indigo-200/80 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-200 bg-slate-50/50 group">
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200 shadow-sm">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">Click to upload target portrait</p>
                <p className="text-xs text-slate-500">or drag and drop photograph here</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
              />
            </label>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-h-80 bg-slate-100 flex items-center justify-center">
              <img
                src={uploadedImage}
                alt="Target candidate"
                className="max-h-80 w-auto object-contain rounded-xl"
              />
              <button
                onClick={clearUpload}
                className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-full shadow-md border border-slate-200 transition-all hover:scale-105"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {uploadedImage && (
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="flex-1 py-3 px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-corporate-btn hover-lift disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Scanning Video Streams...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Initiate Facial Recognition Scan
                  </>
                )}
              </button>

              <button
                onClick={clearUpload}
                className="py-3 px-5 rounded-xl font-semibold text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all hover-lift"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Workflow Guidelines & Status (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* How It Works Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-corporate-card">
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              Operational Protocol
            </h4>
            <ol className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center shrink-0">1</span>
                <span>Upload high-resolution facial photo with clear frontal lighting.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center shrink-0">2</span>
                <span>Initiate identification to encode facial landmark vectors.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center shrink-0">3</span>
                <span>Real-time feeds are evaluated against the vector database.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center shrink-0">4</span>
                <span>Confirmed sightings generate automatic audit captures.</span>
              </li>
            </ol>
          </div>

          {/* Search Scanning Progress */}
          {isSearching && (
            <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-5 shadow-corporate-card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-corporate-btn">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <h5 className="font-bold text-indigo-950 text-sm">Deep Scan Active</h5>
                  <p className="text-xs text-indigo-700 mt-0.5">Iterating optical frames across active camera clusters...</p>
                </div>
              </div>
            </div>
          )}

          {/* Match Confirmation Result Card */}
          {searchComplete && (
            <div className={`rounded-2xl p-6 border shadow-corporate-card transition-all ${
              matchFound 
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-[0_4px_25px_-4px_rgba(16,185,129,0.2)]' 
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-start gap-3.5">
                {matchFound ? (
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1">
                  <h5 className="font-bold text-sm">
                    {matchFound ? 'CONFIRMED TARGET SIGHTING' : 'Search Concluded'}
                  </h5>
                  <p className="text-xs mt-1 text-slate-600 leading-relaxed">
                    {matchFound 
                      ? 'The target individual was positively matched with high confidence in the live surveillance stream.'
                      : 'No facial matches exceeding confidence criteria were observed in this evaluation window.'}
                  </p>

                  {matchFound && screenshotUrl && (
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = screenshotUrl;
                        link.download = 'confirmed_match_screenshot.jpg';
                        link.click();
                      }}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all hover-lift"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Evidence Snapshot
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Live Face Stream Card (When active or requested) */}
      {uploadedImage && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-corporate-card hover:shadow-corporate-hover transition-all duration-300">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Facial Landmark Surveillance Stream</h3>
            </div>
            {faceDetectionEnabled && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Analysis
              </span>
            )}
          </div>

          <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
            {faceDetectionEnabled ? (
              <img 
                ref={videoRef}
                src={`${API_ENDPOINTS.FACE_VIDEO}?t=${Date.now()}`}
                alt="Live face recognition feed"
                className="w-full h-full object-contain"
                onError={() => setError('Live facial detection feed offline. Verify camera connection.')}
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <UserCheck className="w-12 h-12 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium">Click &quot;Initiate Facial Recognition Scan&quot; to begin video analysis</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
