import React, { useState, useEffect } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { LocationData } from '../types';
import {
  MapPin,
  Navigation,
  X,
  Clock,
  Loader2,
  ExternalLink,
  Maximize2,
  StopCircle,
  Radio,
  ShieldCheck,
} from 'lucide-react';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';

const LIVE_DURATIONS = [
  { minutes: 15, label: '15 Min' },
  { minutes: 60, label: '1 Hour' },
  { minutes: 240, label: '4 Hours' },
  { minutes: 480, label: '8 Hours' },
];

const MapCanvasInner: React.FC<{
  lat: number;
  lng: number;
  heightClass: string;
  zoom?: number;
  label?: string;
  interactive?: boolean;
}> = ({ lat, lng, heightClass, zoom = 15, label, interactive = true }) => {
  const status = useApiLoadingStatus();
  const isError = status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE;

  if (isError) {
    return (
      <div
        className={`${heightClass} w-full rounded-xl bg-slate-100 dark:bg-[#1D2026] border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center p-3 text-center`}
      >
        <MapPin className="w-6 h-6 text-emerald-500 mb-1" />
        <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
        <p className="text-[10px] text-slate-500 dark:text-zinc-400">
          Map tiles unavailable · Tap &ldquo;Open in Maps&rdquo; below
        </p>
      </div>
    );
  }

  return (
    <div className={`${heightClass} w-full rounded-xl overflow-hidden relative`}>
      <GoogleMap
        center={{ lat, lng }}
        defaultZoom={zoom}
        mapId="DEMO_MAP_ID"
        gestureHandling={interactive ? 'greedy' : 'none'}
        disableDefaultUI={!interactive}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={{ lat, lng }} title={label || 'Shared Location'}>
          <Pin background="#0FA958" glyphColor="#ffffff" borderColor="#065F46" />
        </AdvancedMarker>
      </GoogleMap>
    </div>
  );
};

const DostMapView: React.FC<{
  lat: number;
  lng: number;
  heightClass: string;
  zoom?: number;
  label?: string;
  interactive?: boolean;
}> = ({ lat, lng, heightClass, zoom = 15, label, interactive = true }) => {
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (!MAPS_API_KEY || !isOnline) {
    return (
      <div
        className={`${heightClass} w-full rounded-xl bg-slate-100 dark:bg-[#1D2026] border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center p-3 text-center`}
      >
        <MapPin className="w-6 h-6 text-emerald-500 mb-1" />
        <p className="text-[11px] font-mono font-bold text-slate-700 dark:text-zinc-200">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
          {!isOnline ? 'Offline GPS pin saved' : 'GPS Coordinates Ready'}
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <MapCanvasInner
        lat={lat}
        lng={lng}
        heightClass={heightClass}
        zoom={zoom}
        label={label}
        interactive={interactive}
      />
    </APIProvider>
  );
};

interface LiveLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendLocation: (params: {
    lat: number;
    lng: number;
    accuracy?: number;
    isLive: boolean;
    durationMinutes?: number;
  }) => Promise<void>;
}

export const LiveLocationPickerModal: React.FC<LiveLocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSendLocation,
}) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [sending, setSending] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const fetchCurrentGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by this device or browser.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
        });
        setLoading(false);
      },
      (err) => {
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable GPS access in device or browser settings.'
            : 'Unable to fetch GPS location. Move near a window or turn on GPS.'
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  useEffect(() => {
    if (!isOpen) {
      setConsentGiven(false);
      return;
    }
    fetchCurrentGps();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async (isLive: boolean) => {
    if (!coords || sending) return;
    if (isLive && !consentGiven) return;
    setSending(true);
    try {
      await onSendLocation({
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        isLive,
        durationMinutes: isLive ? durationMinutes : undefined,
      });
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white dark:bg-[#25282F] text-slate-900 dark:text-zinc-100 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-['Outfit']">Share Location</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Current pin or live GPS tracking (15 min – 8 hrs)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {loading ? (
            <div className="h-52 rounded-2xl bg-slate-100 dark:bg-[#1E2126] flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <span>Detecting accurate GPS location...</span>
            </div>
          ) : errorMsg ? (
            <div className="h-44 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/25 flex flex-col items-center justify-center p-4 text-center gap-2">
              <MapPin className="w-6 h-6 text-rose-500" />
              <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{errorMsg}</p>
              <button
                type="button"
                onClick={fetchCurrentGps}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Retry GPS
              </button>
            </div>
          ) : coords ? (
            <div className="space-y-2">
              <DostMapView
                lat={coords.lat}
                lng={coords.lng}
                heightClass="h-48"
                label="Your Current Location"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 px-1">
                <span className="font-mono">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  {coords.accuracy ? ` (±${coords.accuracy}m)` : ''}
                </span>
                <button
                  type="button"
                  onClick={fetchCurrentGps}
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                >
                  Refresh GPS
                </button>
              </div>
            </div>
          ) : null}

          {/* Live Location Duration Selector */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1E2126] border border-slate-200/80 dark:border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-500" />
                <span>Live Location Duration</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                Powered by Google Maps
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {LIVE_DURATIONS.map((d) => {
                const active = durationMinutes === d.minutes;
                return (
                  <button
                    key={d.minutes}
                    type="button"
                    onClick={() => setDurationMinutes(d.minutes)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-[#262A31] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10 hover:border-emerald-500/50'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            <label className="flex items-start gap-2 pt-1 text-[11px] text-slate-600 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-emerald-600 shrink-0 cursor-pointer"
              />
              <span>
                I consent to share my real-time GPS updates with this chat for{' '}
                <strong>{LIVE_DURATIONS.find((x) => x.minutes === durationMinutes)?.label}</strong>.
                I can stop sharing at any time.
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={!coords || sending}
              onClick={() => void handleSend(false)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#31353E] hover:bg-slate-200 dark:hover:bg-[#3B404B] text-slate-800 dark:text-zinc-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <MapPin className="w-4 h-4 text-emerald-500" />
              <span>Send Current Pin</span>
            </button>
            <button
              type="button"
              disabled={!coords || !consentGiven || sending}
              onClick={() => void handleSend(true)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              <Navigation className="w-4 h-4" />
              <span>
                {sending
                  ? 'Starting...'
                  : `Share Live (${LIVE_DURATIONS.find((x) => x.minutes === durationMinutes)?.label})`}
              </span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-zinc-500 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>
              Includes Google Maps features · Subject to Google Maps End User Terms
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

interface LiveLocationMessageCardProps {
  location: LocationData;
  isMe: boolean;
  senderName: string;
  onStopSharing?: () => void;
}

export const LiveLocationMessageCard: React.FC<LiveLocationMessageCardProps> = ({
  location,
  isMe,
  senderName,
  onStopSharing,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const expiresMs = location.liveExpiresAt ? new Date(location.liveExpiresAt).getTime() : 0;
  const isLiveActive =
    Boolean(location.isLive) && !location.isStopped && expiresMs > nowMs;

  useEffect(() => {
    if (!location.isLive || location.isStopped) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(t);
  }, [location.isLive, location.isStopped]);

  const remainingMin = Math.max(1, Math.ceil((expiresMs - nowMs) / 60000));
  const remainingText =
    remainingMin >= 60
      ? `${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m left`
      : `${remainingMin}m left`;

  const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${location.lat},${location.lng}`
  )}`;

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        className="min-w-[240px] sm:min-w-[270px] space-y-2 mb-1"
      >
        <div className="relative">
          <DostMapView
            lat={location.lat}
            lng={location.lng}
            heightClass="h-40"
            zoom={15}
            label={senderName}
            interactive={false}
          />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/65 hover:bg-black/80 text-white backdrop-blur-xs cursor-pointer"
            title="Expand Interactive Map"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {location.isLive && (
            <div
              className={`absolute bottom-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-md ${
                isLiveActive
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-900/85 text-zinc-200'
              }`}
            >
              {isLiveActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>LIVE · {remainingText}</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  <span>Live sharing ended</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <div className="min-w-0">
            <p className="font-bold truncate flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>
                {location.isLive
                  ? isLiveActive
                    ? 'Live Location Active'
                    : 'Live Location Ended'
                  : 'Shared Location'}
              </span>
            </p>
            <p className="text-[10px] opacity-80 font-mono truncate">
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          </div>

          <a
            href={externalMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
              isMe
                ? 'bg-white/20 hover:bg-white/30 text-white'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span>Open</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {isMe && isLiveActive && onStopSharing && (
          <button
            type="button"
            onClick={onStopSharing}
            className="w-full py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <StopCircle className="w-3.5 h-3.5" />
            <span>Stop Sharing Live Location</span>
          </button>
        )}
      </div>

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-[#22252B] text-slate-900 dark:text-zinc-100 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10"
          >
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold font-['Outfit']">
                  {senderName} · {isLiveActive ? `Live Location (${remainingText})` : 'Location Pin'}
                </h4>
                <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3">
              <DostMapView
                lat={location.lat}
                lng={location.lng}
                heightClass="h-[60vh]"
                zoom={16}
                label={senderName}
                interactive
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
