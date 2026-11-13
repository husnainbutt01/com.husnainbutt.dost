import {
  collection,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { sounds } from '../utils/soundEffects';
import { CallSession } from '../types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private ringInterval: number | null = null;
  private callTimerInterval: number | null = null;
  private currentSession: CallSession | null = null;
  private onStateChangeCallback: ((session: CallSession | null) => void) | null = null;
  private onIncomingCallCallback: ((session: CallSession | null) => void) | null = null;
  private callDocUnsub: (() => void) | null = null;
  private candidatesUnsub: (() => void) | null = null;
  private incomingUnsub: (() => void) | null = null;

  init(
    onStateChange: (session: CallSession | null) => void,
    onIncomingCall?: (session: CallSession | null) => void
  ) {
    this.onStateChangeCallback = onStateChange;
    if (onIncomingCall) {
      this.onIncomingCallCallback = onIncomingCall;
    }
  }

  listenForIncomingCalls(userId: string) {
    if (this.incomingUnsub) {
      this.incomingUnsub();
      this.incomingUnsub = null;
    }

    try {
      const q = query(
        collection(db, 'calls'),
        where('receiverId', '==', userId),
        where('status', '==', 'calling')
      );
      this.incomingUnsub = onSnapshot(q, (snapshot) => {
        const incomingDocs = snapshot.docs.map(d => d.data() as CallSession);
        // Only ring if not already in an active call
        if (incomingDocs.length > 0 && !this.currentSession) {
          const latest = incomingDocs.sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )[0];
          // Ignore stale calls older than 60s
          const ageMs = Date.now() - new Date(latest.createdAt || 0).getTime();
          if (ageMs < 60000) {
            sounds.playRingPulse();
            this.onIncomingCallCallback?.(latest);
          }
        } else if (incomingDocs.length === 0) {
          this.onIncomingCallCallback?.(null);
        }
      }, (err) => {
        console.warn('Incoming calls listener:', err.message);
      });
    } catch {}
  }

  stopListeningForIncomingCalls() {
    if (this.incomingUnsub) {
      this.incomingUnsub();
      this.incomingUnsub = null;
    }
  }

  getCurrentSession(): CallSession | null {
    return this.currentSession;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private setupPeerConnection(callId: string, role: 'caller' | 'callee') {
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    this.peerConnection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
      this.notify();
    };

    const candidatesColName = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
    const candidatesCol = collection(db, 'calls', callId, candidatesColName);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(candidatesCol, event.candidate.toJSON()).catch(() => {});
      }
    };
  }

  async startCall(params: {
    receiverId: string;
    receiverName: string;
    receiverPhoto?: string;
    type: 'audio' | 'video';
    callerId: string;
    callerName: string;
    callerPhoto?: string;
  }): Promise<CallSession> {
    const callId = `call_${Date.now()}`;
    const now = new Date().toISOString();

    // Acquire local audio / video
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: params.type === 'video',
        }).catch(() => null);
      }
    } catch {}

    this.setupPeerConnection(callId, 'caller');

    let offerPayload: { type: string; sdp: string } | undefined;
    try {
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      offerPayload = { type: offer.type, sdp: offer.sdp || '' };
    } catch {}

    const session: CallSession = {
      id: callId,
      callerId: params.callerId,
      callerName: params.callerName,
      callerPhoto: params.callerPhoto || '',
      receiverId: params.receiverId,
      receiverName: params.receiverName,
      receiverPhoto: params.receiverPhoto || '',
      type: params.type,
      status: 'calling',
      offer: offerPayload,
      isMuted: false,
      isVideoEnabled: params.type === 'video',
      isSpeakerOn: true,
      duration: 0,
      createdAt: now,
    };

    this.currentSession = session;
    this.notify();

    // Create Firestore signaling document
    try {
      await setDoc(doc(db, 'calls', callId), session);
    } catch (err) {
      console.warn('Firestore call signaling error:', err);
    }

    // Play dialing ring tone
    sounds.playRingPulse();
    this.ringInterval = window.setInterval(() => {
      if (this.currentSession && (this.currentSession.status === 'calling' || this.currentSession.status === 'ringing')) {
        sounds.playRingPulse();
      }
    }, 3000);

    // Listen for callee's SDP answer and call status updates
    this.callDocUnsub = onSnapshot(doc(db, 'calls', callId), async (snap) => {
      const data = snap.data() as CallSession | undefined;
      if (!data) return;

      if (data.answer && this.peerConnection && !this.peerConnection.currentRemoteDescription) {
        try {
          const answerDesc = new RTCSessionDescription(data.answer as RTCSessionDescriptionInit);
          await this.peerConnection.setRemoteDescription(answerDesc);
        } catch {}
      }

      if (data.status === 'connected' && this.currentSession?.status !== 'connected') {
        this.onCallConnected();
      } else if (data.status === 'rejected' || data.status === 'ended' || data.status === 'missed') {
        this.cleanupCallLocally(data.status);
      }
    });

    // Listen for callee ICE candidates
    this.candidatesUnsub = onSnapshot(collection(db, 'calls', callId, 'calleeCandidates'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added' && this.peerConnection) {
          const cand = new RTCIceCandidate(change.doc.data());
          this.peerConnection.addIceCandidate(cand).catch(() => {});
        }
      });
    });

    return session;
  }

  async answerCall(incomingSession: CallSession) {
    this.onIncomingCallCallback?.(null);

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: incomingSession.type === 'video',
        }).catch(() => null);
      }
    } catch {}

    this.currentSession = {
      ...incomingSession,
      status: 'connected',
      isMuted: false,
      isVideoEnabled: incomingSession.type === 'video',
      isSpeakerOn: true,
      startTime: Date.now(),
      duration: 0,
    };

    this.setupPeerConnection(incomingSession.id, 'callee');

    try {
      if (incomingSession.offer && this.peerConnection) {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(incomingSession.offer as RTCSessionDescriptionInit)
        );
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        await updateDoc(doc(db, 'calls', incomingSession.id), {
          answer: { type: answer.type, sdp: answer.sdp || '' },
          status: 'connected',
        });
      } else {
        await updateDoc(doc(db, 'calls', incomingSession.id), {
          status: 'connected',
        });
      }
    } catch {}

    this.onCallConnected();

    // Listen for caller ICE candidates
    this.candidatesUnsub = onSnapshot(collection(db, 'calls', incomingSession.id, 'callerCandidates'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added' && this.peerConnection) {
          const cand = new RTCIceCandidate(change.doc.data());
          this.peerConnection.addIceCandidate(cand).catch(() => {});
        }
      });
    });

    // Listen for remote hangup
    this.callDocUnsub = onSnapshot(doc(db, 'calls', incomingSession.id), (snap) => {
      const data = snap.data() as CallSession | undefined;
      if (data && (data.status === 'ended' || data.status === 'rejected')) {
        this.cleanupCallLocally(data.status);
      }
    });
  }

  async rejectCall(callId: string) {
    this.onIncomingCallCallback?.(null);
    sounds.playCallEnded();
    try {
      await updateDoc(doc(db, 'calls', callId), {
        status: 'rejected',
        endedAt: new Date().toISOString(),
      });
    } catch {}
  }

  private onCallConnected() {
    if (!this.currentSession) return;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    this.currentSession = {
      ...this.currentSession,
      status: 'connected',
      startTime: Date.now(),
    };
    sounds.playCallConnected();
    this.notify();

    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
    this.callTimerInterval = window.setInterval(() => {
      if (this.currentSession && this.currentSession.status === 'connected' && this.currentSession.startTime) {
        const elapsed = Math.floor((Date.now() - this.currentSession.startTime) / 1000);
        this.currentSession = {
          ...this.currentSession,
          duration: elapsed,
        };
        this.notify();
      }
    }, 1000);
  }

  toggleMute(): boolean {
    if (!this.currentSession) return false;
    const nextState = !this.currentSession.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !nextState;
      });
    }
    this.currentSession = { ...this.currentSession, isMuted: nextState };
    this.notify();
    return nextState;
  }

  toggleVideo(): boolean {
    if (!this.currentSession) return false;
    const nextState = !this.currentSession.isVideoEnabled;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = nextState;
      });
    }
    this.currentSession = { ...this.currentSession, isVideoEnabled: nextState };
    this.notify();
    return nextState;
  }

  toggleSpeaker(): boolean {
    if (!this.currentSession) return false;
    const nextState = !this.currentSession.isSpeakerOn;
    this.currentSession = { ...this.currentSession, isSpeakerOn: nextState };
    this.notify();
    return nextState;
  }

  async endCall() {
    const active = this.currentSession;
    if (active) {
      const finalStatus = active.status === 'calling' ? 'missed' : 'ended';
      try {
        await updateDoc(doc(db, 'calls', active.id), {
          status: finalStatus,
          duration: active.duration || 0,
          endedAt: new Date().toISOString(),
        });
      } catch {}
      this.cleanupCallLocally(finalStatus);
    }
  }

  private cleanupCallLocally(finalStatus: CallSession['status']) {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }
    if (this.callDocUnsub) {
      this.callDocUnsub();
      this.callDocUnsub = null;
    }
    if (this.candidatesUnsub) {
      this.candidatesUnsub();
      this.candidatesUnsub = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;

    if (this.currentSession) {
      sounds.playCallEnded();
      this.currentSession = {
        ...this.currentSession,
        status: finalStatus,
      };
      this.notify();

      setTimeout(() => {
        this.currentSession = null;
        this.notify();
      }, 900);
    }
  }

  private notify() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.currentSession ? { ...this.currentSession } : null);
    }
  }
}

export const webrtcService = new WebRTCService();
