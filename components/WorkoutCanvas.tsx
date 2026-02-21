"use client";
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';

// --- TIPI E INTERFACCE ---
interface FailDetail { image: string; repNumber: number; exercise: string; }
interface RepData { repNumber: number; peakVelocity: number; fatigue: number; }
type Exercise = 'SQUAT' | 'DEADLIFT';
type Tab = 'UPLOAD' | 'LIVE' | 'HISTORY' | 'PROFILE';

interface SavedSession {
  id: string;
  date: string;
  exercise: Exercise;
  mode: string;
  reps: number;
  bestVelocity: number;
}

// --- COMPONENTE PRINCIPALE DELL'APP ---
export default function VBTApp() {
  const [activeTab, setActiveTab] = useState<Tab>('UPLOAD');
  const [activeSession, setActiveSession] = useState<{ mode: 'WEBCAM' | 'UPLOAD', exercise: Exercise, videoUrl?: string } | null>(null);
  const [savedHistory, setSavedHistory] = useState<SavedSession[]>([]);

  useEffect(() => {
    const localData = localStorage.getItem('vbt_history');
    if (localData) {
      setSavedHistory(JSON.parse(localData));
    }
  }, []);

  const handleSessionClose = (save: boolean, sessionResult?: { reps: number, bestVelocity: number }) => {
    if (save && sessionResult && sessionResult.reps > 0 && activeSession) {
      const newSession: SavedSession = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        exercise: activeSession.exercise,
        mode: activeSession.mode,
        reps: sessionResult.reps,
        bestVelocity: sessionResult.bestVelocity
      };
      
      const updatedHistory = [newSession, ...savedHistory];
      setSavedHistory(updatedHistory);
      localStorage.setItem('vbt_history', JSON.stringify(updatedHistory));
    }
    setActiveSession(null);
  };

  const clearHistory = () => {
    if(confirm("Vuoi davvero cancellare tutto lo storico?")) {
      setSavedHistory([]);
      localStorage.removeItem('vbt_history');
    }
  };

  // IL FIX E' QUI: `fixed inset-0` forza l'app a prendere il 100% dello schermo scavalcando Next.js
  return (
    <div className="fixed inset-0 flex flex-col bg-black text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden w-full h-full z-50">
      
      {/* AREA DINAMICA */}
      <div className="flex-1 relative overflow-y-auto w-full">
        {activeSession ? (
          <TrackerEngine session={activeSession} onClose={handleSessionClose} />
        ) : (
          <>
            {activeTab === 'UPLOAD' && <UploadTab onStartSession={(ex, url) => setActiveSession({ mode: 'UPLOAD', exercise: ex, videoUrl: url })} />}
            {activeTab === 'LIVE' && <LiveTab onStartSession={(ex) => setActiveSession({ mode: 'WEBCAM', exercise: ex })} />}
            {activeTab === 'HISTORY' && <HistoryTab history={savedHistory} onClear={clearHistory} />}
            {activeTab === 'PROFILE' && <ProfileTab history={savedHistory} />}
          </>
        )}
      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <div className="shrink-0 bg-slate-950 border-t border-slate-800/80 px-6 py-4 flex justify-between items-center z-50 pb-safe w-full">
        <div className="w-full max-w-md mx-auto flex justify-between items-center">
          <NavButton active={activeTab === 'UPLOAD'} onClick={() => {setActiveTab('UPLOAD'); setActiveSession(null);}} label="Video" icon={<FolderIcon />} />
          <NavButton active={activeTab === 'LIVE'} onClick={() => {setActiveTab('LIVE'); setActiveSession(null);}} label="Live" icon={<CameraIcon />} />
          <NavButton active={activeTab === 'HISTORY'} onClick={() => {setActiveTab('HISTORY'); setActiveSession(null);}} label="Dati" icon={<ChartIcon />} />
          <NavButton active={activeTab === 'PROFILE'} onClick={() => {setActiveTab('PROFILE'); setActiveSession(null);}} label="Profilo" icon={<UserIcon />} />
        </div>
      </div>

    </div>
  );
}

// ==========================================
// TABS INTERFACCIA
// ==========================================

function UploadTab({ onStartSession }: { onStartSession: (ex: Exercise, url: string) => void }) {
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedEx) {
      const url = URL.createObjectURL(file);
      onStartSession(selectedEx, url);
    }
  };

  return (
    <div className="p-6 pt-12 flex flex-col min-h-full animate-fade-in w-full max-w-xl mx-auto">
      <h1 className="text-3xl font-black mb-2">Analisi Video</h1>
      <p className="text-slate-400 text-sm mb-10">Seleziona l'esercizio e carica un video dalla tua galleria.</p>

      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4">1. Scegli Esercizio</h3>
      <div className="grid grid-cols-2 gap-4 mb-10">
        <button onClick={() => setSelectedEx('SQUAT')} className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${selectedEx === 'SQUAT' ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
          <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center shadow-inner"><SquatIcon /></div>
          <span className="font-black tracking-widest uppercase text-xs">Squat</span>
        </button>
        <button onClick={() => setSelectedEx('DEADLIFT')} className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${selectedEx === 'DEADLIFT' ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
          <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center shadow-inner"><DeadliftIcon /></div>
          <span className="font-black tracking-widest uppercase text-xs">Deadlift</span>
        </button>
      </div>

      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4">2. Carica Video</h3>
      <label className={`flex-1 min-h-[150px] w-full border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all ${selectedEx ? 'border-indigo-500/50 bg-indigo-950/10 cursor-pointer hover:bg-indigo-900/20 text-indigo-400' : 'border-slate-800 bg-slate-900/50 cursor-not-allowed text-slate-600'}`}>
        <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center"><UploadIcon /></div>
        <span className="font-bold text-sm tracking-widest uppercase">{selectedEx ? "Seleziona File" : "Scegli prima l'esercizio"}</span>
        <input type="file" accept="video/*" onChange={handleFile} disabled={!selectedEx} className="hidden" />
      </label>
    </div>
  );
}

function LiveTab({ onStartSession }: { onStartSession: (ex: Exercise) => void }) {
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);

  return (
    <div className="p-6 pt-12 flex flex-col min-h-full animate-fade-in w-full max-w-xl mx-auto">
      <h1 className="text-3xl font-black mb-2">Live Tracking</h1>
      <p className="text-slate-400 text-sm mb-10">Tracciamento in tempo reale con fotocamera e sensore BLE.</p>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <button onClick={() => setSelectedEx('SQUAT')} className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${selectedEx === 'SQUAT' ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
          <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center shadow-inner"><SquatIcon /></div>
          <span className="font-black tracking-widest uppercase text-xs">Squat</span>
        </button>
        <button onClick={() => setSelectedEx('DEADLIFT')} className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${selectedEx === 'DEADLIFT' ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
          <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center shadow-inner"><DeadliftIcon /></div>
          <span className="font-black tracking-widest uppercase text-xs">Deadlift</span>
        </button>
      </div>

      <div className="mt-auto">
        <button 
          disabled={!selectedEx} 
          onClick={() => selectedEx && onStartSession(selectedEx)}
          className={`w-full py-5 rounded-3xl font-black text-sm tracking-widest uppercase shadow-2xl transition-all ${selectedEx ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
        >
          {selectedEx ? "Avvia Fotocamera" : "Scegli Esercizio"}
        </button>
      </div>
    </div>
  );
}

function HistoryTab({ history, onClear }: { history: SavedSession[], onClear: () => void }) {
  return (
    <div className="p-6 pt-12 animate-fade-in flex flex-col min-h-full w-full max-w-xl mx-auto">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-black mb-2">Storico</h1>
          <p className="text-slate-400 text-sm">Le tue sessioni supervisionate.</p>
        </div>
        {history.length > 0 && (
          <button onClick={onClear} className="text-[10px] text-red-500 uppercase tracking-widest font-black bg-red-500/10 px-3 py-2 rounded-lg hover:bg-red-500/20">
            Svuota
          </button>
        )}
      </div>
      
      <div className="flex flex-col gap-4">
        {history.length === 0 ? (
          <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-[2rem] p-10 flex flex-col items-center justify-center text-center text-slate-500">
            <ChartIcon />
            <p className="mt-4 font-bold text-sm">Nessun dato registrato</p>
            <p className="text-xs mt-1">Completa una sessione per vederla qui.</p>
          </div>
        ) : (
          history.map(session => (
            <div key={session.id} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex justify-between items-center group hover:border-indigo-500/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${session.exercise === 'SQUAT' ? 'bg-indigo-900/50 text-indigo-400' : 'bg-purple-900/50 text-purple-400'}`}>
                  {session.exercise === 'SQUAT' ? <SquatIcon /> : <DeadliftIcon />}
                </div>
                <div>
                  <p className="font-black tracking-widest uppercase text-[10px] mb-1 text-slate-400">{session.exercise} • {session.mode}</p>
                  <p className="font-bold text-lg leading-none">{session.reps} Reps <span className="text-green-400 text-sm ml-2">Best: {session.bestVelocity} m/s</span></p>
                </div>
              </div>
              <div className="text-slate-500 text-[10px] font-bold text-right">
                {session.date.split(', ')[0]}<br/>{session.date.split(', ')[1]}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProfileTab({ history }: { history: SavedSession[] }) {
  const totalReps = history.reduce((sum, session) => sum + session.reps, 0);
  const bestOverall = history.length > 0 ? Math.max(...history.map(s => s.bestVelocity)) : 0;

  return (
    <div className="p-6 pt-12 animate-fade-in flex flex-col h-full w-full max-w-xl mx-auto">
      <h1 className="text-3xl font-black mb-8">Profilo</h1>
      
      <div className="flex items-center gap-6 mb-10 bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-2xl font-black shadow-lg text-white z-10">
          FV
        </div>
        <div className="z-10">
          <p className="text-xs text-slate-500 font-black tracking-widest uppercase mb-1">Atleta VBT</p>
          <p className="text-2xl font-black text-white">@flaviovisconti</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 text-center flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Reps Totali</p>
            <p className="text-4xl font-black mt-2 text-indigo-400">{totalReps}</p>
         </div>
         <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 text-center flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Velocità Max Assoluta</p>
            <p className="text-3xl font-black mt-2 text-green-400">{bestOverall.toFixed(2)} <span className="text-sm">m/s</span></p>
         </div>
         <div className="col-span-2 bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Stato Hardware BLE</p>
              <p className="text-xs font-bold mt-1 text-slate-300">Nessun sensore collegato</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-slate-700"></div>
         </div>
      </div>
    </div>
  );
}

// ==========================================
// TRACKER ENGINE (IL CORE)
// ==========================================

function TrackerEngine({ session, onClose }: { session: { mode: string, exercise: string, videoUrl?: string }, onClose: (save: boolean, result?: any) => void }) {
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [counter, setCounter] = useState(0);
  const [angle, setAngle] = useState(0);
  const [camVelocity, setCamVelocity] = useState(0); 
  const [repHistory, setRepHistory] = useState<RepData[]>([]);
  const [status, setStatus] = useState("ATTENDERE...");
  
  const [isBleConnected, setIsBleConnected] = useState(false);
  const [bleVelocity, setBleVelocity] = useState(0); 

  const [showEndDialog, setShowEndDialog] = useState(false);

  const counterRef = useRef(0);
  const stageRef = useRef<"up" | "down">("up");
  const hasReachedDepth = useRef(false);
  const prevBarRef = useRef({ x: 0, y: 0, t: 0 });
  const currentMaxCamVelRef = useRef(0);
  const bleVelocityRef = useRef(0);
  const currentMaxBleVelRef = useRef(0);
  const lastBleTimeRef = useRef(0);

  const triggerSaveOptions = () => {
    setShowEndDialog(true);
  };

  const handleReplay = () => {
    setShowEndDialog(false);
    setCounter(0);
    setRepHistory([]);
    setCamVelocity(0);
    setBleVelocity(0);
    counterRef.current = 0;
    currentMaxCamVelRef.current = 0;
    currentMaxBleVelRef.current = 0;
    bleVelocityRef.current = 0;
    stageRef.current = "up";
    hasReachedDepth.current = false;
    
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  const connectBluetooth = async () => {
    try {
      setStatus("RICERCA BLE...");
      // @ts-ignore
      const device = await navigator.bluetooth.requestDevice({ filters: [{ name: 'VBT-Barbell' }], optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b'] });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
      const characteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

      characteristic.addEventListener('characteristicvaluechanged', (e: any) => {
        const value = new TextDecoder().decode(e.target.value);
        const rawAccel = parseFloat(value);
        const now = Date.now();
        if (lastBleTimeRef.current === 0) { lastBleTimeRef.current = now; return; }
        const dt = (now - lastBleTimeRef.current) / 1000;
        lastBleTimeRef.current = now;
        
        const netAccel = Math.abs(rawAccel) - 9.81; 
        if (Math.abs(netAccel) > 0.3) {
          bleVelocityRef.current += netAccel * dt;
          const currentV = Number(Math.abs(bleVelocityRef.current).toFixed(2));
          setBleVelocity(currentV);
          if (currentV > currentMaxBleVelRef.current) currentMaxBleVelRef.current = currentV;
        } else {
          bleVelocityRef.current *= 0.8; 
          if (Math.abs(bleVelocityRef.current) < 0.1) { bleVelocityRef.current = 0; setBleVelocity(0); }
        }
      });
      await characteristic.startNotifications();
      setIsBleConnected(true);
      setStatus("SENSORE ATTIVO");
    } catch (error) {
      console.error(error);
      setStatus("BLE FALLITO");
    }
  };

  const calculateAngle = (A: any, B: any, C: any) => {
    const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angleDeg = Math.abs((radians * 180.0) / Math.PI);
    return Math.round(angleDeg > 180.0 ? 360 - angleDeg : angleDeg);
  };

  useEffect(() => {
    let isActive = true;
    let pose: any = null;

    const loadMediaPipe = async () => {
      // @ts-ignore
      if (window.Pose) return;
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js";
        script.crossOrigin = "anonymous";
        script.onload = resolve;
        document.body.appendChild(script);
      });
    };

    const initPose = async () => {
      setStatus("INIZIALIZZAZIONE IA...");
      await loadMediaPipe();
      if (!isActive) return;

      // @ts-ignore
      if (!window.poseInstance) {
        // @ts-ignore
        window.poseInstance = new window.Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
        // @ts-ignore
        window.poseInstance.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });
      } else {
        // @ts-ignore
        window.poseInstance.reset();
      }

      // @ts-ignore
      pose = window.poseInstance;
      setStatus("SISTEMA PRONTO");

      pose.onResults((results: any) => {
        if (!isActive || !canvasRef.current) return;
        const canvasElement = canvasRef.current;
        const canvasCtx = canvasElement.getContext("2d");
        const sourceElement = session.mode === 'WEBCAM' ? webcamRef.current?.video : videoRef.current;
        
        if (!sourceElement || !canvasCtx || sourceElement.readyState < 2) return;

        if (canvasElement.width !== sourceElement.videoWidth) {
          canvasElement.width = sourceElement.videoWidth;
          canvasElement.height = sourceElement.videoHeight;
        }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        if (results.poseLandmarks) {
          const l = results.poseLandmarks;
          const isLeft = l[11].visibility > l[12].visibility;
          const side = isLeft ? {s: l[11], h: l[23], k: l[25], a: l[27], w: l[15]} : {s: l[12], h: l[24], k: l[26], a: l[28], w: l[16]};

          const hX = side.h.x * canvasElement.width; const hY = side.h.y * canvasElement.height;
          const kX = side.k.x * canvasElement.width; const kY = side.k.y * canvasElement.height;
          const aX = side.a.x * canvasElement.width; const aY = side.a.y * canvasElement.height;

          const curAngle = calculateAngle(side.h, side.k, side.a);
          setAngle(curAngle);

          let skeletonColor = "#6366f1"; 
          
          if (side.h.visibility > 0.5) {
            if (session.exercise === 'SQUAT') {
              if (curAngle < 160) {
                 if (stageRef.current === "up" && curAngle < 140) {
                    stageRef.current = "down"; hasReachedDepth.current = false;
                    currentMaxCamVelRef.current = 0; currentMaxBleVelRef.current = 0;
                 }
                 if (curAngle <= 90) hasReachedDepth.current = true;
                 skeletonColor = hasReachedDepth.current ? "#22c55e" : "#ef4444";
              }
              if (curAngle > 160 && stageRef.current === "down") {
                stageRef.current = "up";
                if (hasReachedDepth.current) {
                  counterRef.current += 1; setCounter(counterRef.current);
                  const peakV = isBleConnected ? Number(currentMaxBleVelRef.current.toFixed(2)) : Number(currentMaxCamVelRef.current.toFixed(2));
                  setRepHistory(prev => {
                    const currentBest = prev.length > 0 ? Math.max(...prev.map(r => r.peakVelocity), peakV) : peakV;
                    const loss = peakV >= currentBest ? 0 : Math.round((1 - peakV / currentBest) * 100);
                    return [...prev, { repNumber: counterRef.current, peakVelocity: peakV, fatigue: loss }];
                  });
                }
              }
            } else {
              const kneeY = kY; const barY = side.w.y * canvasElement.height; const ankleY = aY;
              if (barY < kneeY && stageRef.current === "up") { stageRef.current = "down"; currentMaxCamVelRef.current = 0; currentMaxBleVelRef.current = 0; }
              if (barY > ankleY - 30 && stageRef.current === "down") {
                stageRef.current = "up"; counterRef.current += 1; setCounter(counterRef.current);
                const peakV = isBleConnected ? Number(currentMaxBleVelRef.current.toFixed(2)) : Number(currentMaxCamVelRef.current.toFixed(2));
                setRepHistory(prev => {
                  const currentBest = prev.length > 0 ? Math.max(...prev.map(r => r.peakVelocity), peakV) : peakV;
                  const loss = peakV >= currentBest ? 0 : Math.round((1 - peakV / currentBest) * 100);
                  return [...prev, { repNumber: counterRef.current, peakVelocity: peakV, fatigue: loss }];
                });
              }
              if (stageRef.current === "down") skeletonColor = "#22c55e";
            }
          }

          const now = Date.now();
          const rawBarX = side.w.x * canvasElement.width; const rawBarY = side.s.y * canvasElement.height; 
          if (prevBarRef.current.t > 0) {
            const torsoDist = Math.sqrt(Math.pow(hX - side.s.x * canvasElement.width, 2) + Math.pow(hY - side.s.y * canvasElement.height, 2));
            const dt = (now - prevBarRef.current.t) / 1000;
            const v = Math.abs(((rawBarY - prevBarRef.current.y) * (0.5 / (torsoDist || 100))) / dt);
            if (v < 5 && dt > 0.05) { 
              setCamVelocity(Number(v.toFixed(2)));
              if (v > currentMaxCamVelRef.current) currentMaxCamVelRef.current = v;
            }
          }
          prevBarRef.current = { x: rawBarX, y: rawBarY, t: now };

          canvasCtx.lineWidth = 6; canvasCtx.lineCap = "round"; canvasCtx.strokeStyle = skeletonColor;
          canvasCtx.beginPath(); canvasCtx.moveTo(hX, hY); canvasCtx.lineTo(kX, kY); canvasCtx.lineTo(aX, aY); canvasCtx.stroke();
        }
        canvasCtx.restore();
      });

      const sendFrame = async () => {
        if (!isActive) return;
        const source = session.mode === 'WEBCAM' ? webcamRef.current?.video : videoRef.current;
        if (source && source.readyState >= 2) {
          try {
            // @ts-ignore
            await pose.send({ image: source });
          } catch (e) {
            console.error("Attesa frame...", e);
          }
        }
        if (isActive) requestAnimationFrame(sendFrame);
      };
      
      sendFrame();
    };
    
    initPose();
    return () => { isActive = false; };
  }, [session.mode, session.exercise, isBleConnected]);

  const currentLoss = repHistory.length > 0 ? repHistory[repHistory.length-1].fatigue : 0;

  return (
    <div className="absolute inset-0 bg-black flex flex-col font-sans text-white z-40 w-full">
      
      {/* HEADER DELLA SESSIONE */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <button onClick={triggerSaveOptions} className="pointer-events-auto bg-white/10 backdrop-blur-md p-3 rounded-full hover:bg-white/30 transition-all shadow-lg flex items-center justify-center">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <div className="flex flex-col items-end">
          <span className="px-3 py-1 bg-black/50 backdrop-blur-md rounded-lg font-black text-[10px] tracking-widest uppercase border border-white/10 mb-2">{status}</span>
          <button onClick={connectBluetooth} className={`pointer-events-auto px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all ${isBleConnected ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-blue-600 hover:text-white'}`}>
            {isBleConnected ? 'BLE OK' : 'CONNETTI BLE'}
          </button>
        </div>
      </div>

      {/* VIDEO AREA */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center w-full">
        {session.mode === 'WEBCAM' ? (
          <Webcam ref={webcamRef} mirrored={false} className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <video 
            ref={videoRef} 
            src={session.videoUrl || ""} 
            muted 
            playsInline 
            autoPlay 
            onEnded={() => setShowEndDialog(true)}
            className="absolute inset-0 w-full h-full object-contain" 
          />
        )}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
      </div>

      {/* HUD INFERIORE */}
      <div className="bg-slate-950 border-t border-slate-800 p-6 pb-8 z-40 relative shrink-0 w-full">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between items-center mb-6">
             <div>
               <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">{session.exercise} REPS</p>
               <p className="text-5xl font-black">{counter}</p>
             </div>
             <div className="text-right">
               <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">ANGOLO</p>
               <p className="text-4xl font-black text-indigo-400">{angle}°</p>
             </div>
          </div>
          
          <div className="flex gap-4">
             <div className="flex-1 bg-slate-900 rounded-3xl p-4 border border-slate-800 flex flex-col justify-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2">
                 {isBleConnected && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
               </div>
               <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">Velocità ({isBleConnected ? 'BLE' : 'CAM'})</p>
               <p className={`text-4xl font-black tabular-nums ${isBleConnected ? 'text-blue-400' : 'text-green-400'}`}>{isBleConnected ? bleVelocity : camVelocity}</p>
             </div>
             <div className={`w-28 rounded-3xl p-4 border flex flex-col items-center justify-center transition-colors ${currentLoss > 20 ? 'bg-red-950/40 border-red-500/50' : 'bg-slate-900 border-slate-800'}`}>
               <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">LOSS</p>
               <p className={`text-3xl font-black ${currentLoss > 20 ? 'text-red-400' : 'text-white'}`}>{currentLoss}%</p>
             </div>
          </div>
        </div>
      </div>

      {/* OVERLAY DI FINE ALLENAMENTO */}
      {showEndDialog && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-[2rem] p-8 w-full max-w-sm flex flex-col gap-4 shadow-2xl text-center">
            <h2 className="text-xl font-black mb-2 uppercase tracking-widest">Allenamento Terminato</h2>
            <p className="text-sm text-slate-400 mb-6">Hai completato {counter} ripetizioni in questa sessione.</p>
            
            <button 
              onClick={() => {
                const bestV = repHistory.length > 0 ? Math.max(...repHistory.map(r => r.peakVelocity)) : 0;
                onClose(true, { reps: counter, bestVelocity: bestV });
              }}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl tracking-widest uppercase hover:bg-indigo-500 transition-all shadow-lg"
            >
              ESCI E SALVA SESSIONE
            </button>
            
            <button 
              onClick={() => onClose(false)}
              className="w-full py-4 bg-slate-800 text-slate-300 font-black rounded-2xl tracking-widest uppercase hover:bg-slate-700 transition-all"
            >
              ESCI SENZA SALVARE
            </button>

            {session.mode === 'UPLOAD' && (
              <button 
                onClick={handleReplay}
                className="mt-4 text-[10px] text-slate-500 font-black tracking-widest uppercase hover:text-white transition-colors"
              >
                Riguarda Video
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ==========================================
// ICONE SVG
// ==========================================
const FolderIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>;
const CameraIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>;
const ChartIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>;
const UserIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>;
const SquatIcon = () => <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5h12M6 5v4M18 5v4M4 9h16M10 9v10M14 9v10M8 19h8"/></svg>;
const DeadliftIcon = () => <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17h16M7 17v-4M17 17v-4M2 13h20M10 13V5M14 13V5M8 5h8"/></svg>;
const UploadIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>;

function NavButton({ active, onClick, label, icon }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
      {icon}
      <span className="text-[9px] font-black tracking-widest uppercase">{label}</span>
    </button>
  );
}