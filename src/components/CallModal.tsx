import React, { useEffect, useRef } from 'react';
import { CallSession } from '../types';
import { webrtcService } from '../services/webrtcService';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  ShieldCheck,
} from 'lucide-react';

interface CallModalProps {
  session: CallSession | null;
  currentUserId?: string;
  onEndCall: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({ session, currentUserId, onEndCall }) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!session) return;
    const localStream = webrtcService.getLocalStream();
    const remoteStream = webrtcService.getRemoteStream();

    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [session, session?.status, session?.duration]);

  if (!session) return null;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isConnected = session.status === 'connected';
  const amICaller = !currentUserId || session.callerId === currentUserId;
  const peerName = amICaller ? session.receiverName : session.callerName;
  const peerPhoto = amICaller ? session.receiverPhoto : session.callerPhoto;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in select-none">
      {/* Hidden audio output for WebRTC voice/video audio track */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="relative w-full max-w-lg bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-between min-h-[560px] p-6">
        {/* Top Info Header */}
        <div className="w-full flex justify-between items-center z-20">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/80 px-3 py-1.5 rounded-full border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>WebRTC End-to-End Encrypted</span>
          </div>
          <span className="text-xs font-mono tracking-wider text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg">
            {isConnected ? formatDuration(session.duration) : session.status.toUpperCase()}
          </span>
        </div>

        {/* Center Display: Audio Calling vs Video Calling */}
        {session.type === 'audio' || !session.isVideoEnabled ? (
          <div className="flex flex-col items-center my-auto z-10 text-center">
            <div className="relative mb-6">
              <div
                className={`absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl ${
                  isConnected ? 'animate-pulse' : 'animate-ping'
                }`}
              />
              <img
                src={
                  peerPhoto ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(peerName)}`
                }
                alt={peerName}
                className="relative w-32 h-32 rounded-full object-cover border-4 border-emerald-500/80 shadow-2xl"
              />
            </div>
            <h2 className="text-2xl font-bold font-['Outfit'] text-white mb-1">{peerName}</h2>
            <p className="text-sm text-emerald-400 font-medium">
              {isConnected
                ? 'DOST HD Voice Call Connected'
                : session.status === 'calling'
                ? 'Calling...'
                : session.status === 'rejected'
                ? 'Call Declined'
                : session.status === 'missed'
                ? 'No Answer'
                : 'Connecting...'}
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center bg-slate-950">
            {/* Real Remote Video Feed */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!isConnected && (
              <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center text-center">
                <img
                  src={
                    peerPhoto ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(peerName)}`
                  }
                  alt={peerName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 mb-3"
                />
                <p className="text-lg font-bold text-white">{peerName}</p>
                <p className="text-xs text-emerald-400 mt-1">Ringing video call...</p>
              </div>
            )}

            <div className="absolute top-16 left-6 z-20 flex items-center gap-3">
              <span className="text-base font-semibold text-white drop-shadow">{peerName}</span>
            </div>

            {/* Picture-in-Picture Local Camera Feed */}
            <div className="absolute top-16 right-6 w-28 h-40 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xl bg-slate-950 z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              <span className="absolute bottom-1 right-2 text-[10px] text-white/90 bg-black/60 px-1 rounded">
                You
              </span>
            </div>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div className="w-full flex items-center justify-center gap-4 z-20 pt-4">
          <button
            onClick={() => webrtcService.toggleMute()}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              session.isMuted ? 'bg-rose-500 text-white' : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
            }`}
            title={session.isMuted ? 'Unmute' : 'Mute'}
          >
            {session.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {session.type === 'video' && (
            <button
              onClick={() => webrtcService.toggleVideo()}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                !session.isVideoEnabled ? 'bg-rose-500 text-white' : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
              }`}
              title={session.isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {session.isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
          )}

          <button
            onClick={() => webrtcService.toggleSpeaker()}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              session.isSpeakerOn ? 'bg-emerald-600/90 text-white' : 'bg-slate-800/90 text-slate-300'
            }`}
            title="Speaker"
          >
            {session.isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>

          <button
            onClick={onEndCall}
            className="w-16 h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transition-all cursor-pointer active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface IncomingCallModalProps {
  incomingCall: CallSession | null;
  onAccept: (call: CallSession) => void;
  onReject: (callId: string) => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onReject,
}) => {
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-emerald-500/30 text-center">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <div className="absolute -inset-3 bg-emerald-500/25 rounded-full animate-ping" />
          <img
            src={
              incomingCall.callerPhoto ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(incomingCall.callerName)}`
            }
            alt={incomingCall.callerName}
            className="relative w-24 h-24 rounded-full object-cover border-4 border-emerald-500"
          />
        </div>

        <h3 className="text-xl font-bold font-['Outfit'] mb-1">{incomingCall.callerName}</h3>
        <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-6">
          Incoming DOST {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
        </p>

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => onReject(incomingCall.id)}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg cursor-pointer transition-transform active:scale-95"
            title="Decline"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <button
            onClick={() => onAccept(incomingCall)}
            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg cursor-pointer transition-transform active:scale-95"
            title="Accept"
          >
            {incomingCall.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};
