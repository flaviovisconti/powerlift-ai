"use client";
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';

interface FailDetail { image: string; repNumber: number; exercise: string; }
interface RepData { repNumber: number; peakVelocity: number; fatigue: number; }
type Exercise = 'SQUAT' | 'DEADLIFT';

export default function WorkoutCanvas() {
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [exercise, setExercise] = useState<Exercise>('SQUAT');
  const [sourceMode, setSourceMode] = useState<'WEBCAM' | 'UPLOAD'>('WEBCAM');
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(0);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  
  // Stati UI Base
  const [counter, setCounter] = useState(0);
  const [angle, setAngle] = useState(0);
  const [velocity, setVelocity] = useState(0); // Velocità da fotocamera
  const [repHistory, setRepHistory] = useState<RepData[]>([]);
  const [status, setStatus] = useState("PRONTO");
  const [failScreenshots, setFailScreenshots] = useState<FailDetail[]>([]);
  const [selectedImage, setSelectedImage] = useState<FailDetail | null>(null);

  // --- STATI BLUETOOTH ---
  const [isBleConnected, setIsBleConnected] = useState(false);
  const [bleAccel, setBleAccel] = useState(0); // Accelerazione in tempo reale dal sensore

  // Refs per calcoli fotocamera
  const counterRef = useRef(0);
  const stageRef = useRef<"up" | "down">("up");
  const hasReachedDepth = useRef(false);
  const pathRef = useRef<{x: number, y: number}[]>([]);
  const prevBarRef = useRef({ x: 0, y: 0, t: 0 });
  const currentMaxVelRef = useRef(0);

  // --- LOGICA CONNESSIONE BLUETOOTH ---
  const connectBluetooth = async () => {
    try {
      setStatus("RICERCA DISPOSITIVO...");
      // @ts-ignore - Web Bluetooth API
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'VBT-Barbell' }],
        optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
      const characteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

      // Resta in ascolto dei dati in arrivo
      characteristic.addEventListener('characteristicvaluechanged', handleBleData);
      await characteristic.startNotifications();

      setIsBleConnected(true);
      setStatus("✅ SENSORE CONNESSO");
      
      // Gestione disconnessione
      device.addEventListener('gattserverdisconnected', () => {
        setIsBleConnected(false);
        setStatus("⚠️ SENSORE DISCONNESSO");
      });

    } catch (error) {
      console.error("Errore Bluetooth:", error);
      setStatus("CONNESSIONE ANNULLATA");
    }
  };

  // Callback che scatta ogni volta che l'ESP32 invia un numero
  const handleBleData = (event: any) => {
    const value = new TextDecoder().decode(event.target.value);
    const rawAccel = parseFloat(value);
    setBleAccel(rawAccel);
    
    // NOTA: Qui in futuro aggiungeremo la formula di integrazione per calcolare
    // la velocità super precisa dall'accelerazione netta.
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setSourceMode('UPLOAD');
      setIsVideoEnded(false);
      setVideoKey(prev => prev + 1);
      handleReset();
    }
  };

  const handleReset = () => {
    counterRef.current = 0;
    setCounter(0);
    setVelocity(0);
    setRepHistory([]);
    setFailScreenshots([]);
    pathRef.current = [];
    stageRef.current = "up";
    setStatus(isBleConnected ? "✅ SENSORE CONNESSO" : "PRONTO");
  };

  const handleReplay = () => {
    handleReset();
    setIsVideoEnded(false);
    setVideoKey(prev => prev + 1);
  };

  const calculateAngle = (A: any, B: any, C: any) => {
    const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angleDeg = Math.abs((radians * 180.0) / Math.PI);
    if (angleDeg > 180.0) angleDeg = 360 - angleDeg;
    return Math.round(angleDeg);
  };

  useEffect(() => {
    let isActive = true;
    let pose: any = null;

    const initPose = async () => {
      if (!document.getElementById("mediapipe-pose-script")) {
        const script = document.createElement("script");
        script.id = "mediapipe-pose-script";
        script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js";
        script.async = true;
        document.body.appendChild(script);
        await new Promise((res) => (script.onload = res));
      }

      // @ts-ignore
      if (!window.poseInstance) {
        // @ts-ignore
        window.poseInstance = new window.Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        // @ts-ignore
        window.poseInstance.setOptions({
          modelComplexity: 1, 
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      // @ts-ignore
      pose = window.poseInstance;
      pose.onResults((results: any) => {
        if (!isActive || !canvasRef.current) return;
        const canvasElement = canvasRef.current;
        const canvasCtx = canvasElement.getContext("2d");
        const sourceElement = sourceMode === 'WEBCAM' ? webcamRef.current?.video : videoRef.current;
        
        if (!sourceElement || !canvasCtx || sourceElement.readyState < 2) return;

        if (canvasElement.width !== sourceElement.videoWidth) {
          canvasElement.width = sourceElement.videoWidth;
          canvasElement.height = sourceElement.videoHeight;
        }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(sourceElement, 0, 0, canvasElement.width, canvasElement.height);

        if (results.poseLandmarks) {
          const l = results.poseLandmarks;
          const isLeft = l[11].visibility > l[12].visibility;
          const side = isLeft ? 
            {s: l[11], h: l[23], k: l[25], a: l[27], w: l[15], e: l[13]} : 
            {s: l[12], h: l[24], k: l[26], a: l[28], w: l[16], e: l[14]};

          const hX = side.h.x * canvasElement.width;
          const hY = side.h.y * canvasElement.height;
          const kX = side.k.x * canvasElement.width;
          const kY = side.k.y * canvasElement.height;
          const aX = side.a.x * canvasElement.width;
          const aY = side.a.y * canvasElement.height;

          const curAngle = calculateAngle(side.h, side.k, side.a);
          setAngle(curAngle);

          let skeletonColor = "#6366f1"; 
          
          if (side.h.visibility > 0.5) {
            if (exercise === 'SQUAT') {
              if (curAngle < 160) {
                 if (stageRef.current === "up" && curAngle < 140) {
                    stageRef.current = "down";
                    hasReachedDepth.current = false;
                    currentMaxVelRef.current = 0;
                    pathRef.current = [];
                 }
                 if (curAngle <= 90) hasReachedDepth.current = true;
                 
                 skeletonColor = hasReachedDepth.current ? "#22c55e" : "#ef4444";
              }
              if (curAngle > 160 && stageRef.current === "down") {
                stageRef.current = "up";
                if (hasReachedDepth.current) {
                  counterRef.current += 1;
                  setCounter(counterRef.current);
                  
                  const peakV = Number(currentMaxVelRef.current.toFixed(2));
                  setRepHistory(prev => {
                    const currentBest = prev.length > 0 ? Math.max(...prev.map(r => r.peakVelocity), peakV) : peakV;
                    const loss = peakV >= currentBest ? 0 : Math.round((1 - peakV / currentBest) * 100);
                    return [...prev, { repNumber: counterRef.current, peakVelocity: peakV, fatigue: loss }];
                  });
                } else {
                  const imageData = canvasElement.toDataURL("image/png");
                  setFailScreenshots(prev => [...prev, { image: imageData, repNumber: counterRef.current + 1, exercise }]);
                }
              }
            } else {
              const kneeY = kY;
              const barY = isLeft ? side.w.y * canvasElement.height : side.w.y * canvasElement.height;
              const ankleY = aY;

              if (barY < kneeY && stageRef.current === "up") {
                stageRef.current = "down";
                currentMaxVelRef.current = 0;
                pathRef.current = [];
              }
              if (barY > ankleY - 30 && stageRef.current === "down") {
                stageRef.current = "up";
                counterRef.current += 1;
                setCounter(counterRef.current);
                const peakV = Number(currentMaxVelRef.current.toFixed(2));
                setRepHistory(prev => {
                  const currentBest = prev.length > 0 ? Math.max(...prev.map(r => r.peakVelocity), peakV) : peakV;
                  const loss = peakV >= currentBest ? 0 : Math.round((1 - peakV / currentBest) * 100);
                  return [...prev, { repNumber: counterRef.current, peakVelocity: peakV, fatigue: loss }];
                });
              }
              if (stageRef.current === "down") skeletonColor = "#22c55e";
            }
          }

          // CALCOLO VELOCITÀ DA WEBCAM (Fallback/Confronto)
          const now = Date.now();
          const rawBarX = side.w.x * canvasElement.width;
          const rawBarY = side.s.y * canvasElement.height; 
          
          if (prevBarRef.current.t > 0) {
            const torsoDist = Math.sqrt(Math.pow(hX - side.s.x * canvasElement.width, 2) + Math.pow(hY - side.s.y * canvasElement.height, 2));
            const metersPerPixel = 0.5 / (torsoDist || 100);
            
            const dy = (rawBarY - prevBarRef.current.y) * metersPerPixel;
            const dt = (now - prevBarRef.current.t) / 1000;
            const v = Math.abs(dy / dt);
            
            if (v < 5 && dt > 0.05) { 
              setVelocity(Number(v.toFixed(2)));
              if (v > currentMaxVelRef.current) currentMaxVelRef.current = v;
            }
          }
          prevBarRef.current = { x: rawBarX, y: rawBarY, t: now };

          // Disegno
          canvasCtx.lineWidth = 6;
          canvasCtx.lineCap = "round";
          canvasCtx.strokeStyle = skeletonColor;
          canvasCtx.beginPath();
          canvasCtx.moveTo(hX, hY);
          canvasCtx.lineTo(kX, kY);
          canvasCtx.lineTo(aX, aY);
          canvasCtx.stroke();

          if (stageRef.current === "down" && exercise === 'SQUAT') {
             pathRef.current.push({x: rawBarX, y: rawBarY});
          }
          if (pathRef.current.length > 2) {
            canvasCtx.strokeStyle = "rgba(0, 255, 255, 0.5)";
            canvasCtx.lineWidth = 4;
            canvasCtx.beginPath();
            canvasCtx.moveTo(pathRef.current[0].x, pathRef.current[0].y);
            pathRef.current.forEach(p => canvasCtx.lineTo(p.x, p.y));
            canvasCtx.stroke();
          }

        }
        canvasCtx.restore();
      });

      const sendFrame = async () => {
        if (!isActive) return;
        const source = sourceMode === 'WEBCAM' ? webcamRef.current?.video : videoRef.current;
        if (source && sourceMode === 'UPLOAD' && source.ended) { setIsVideoEnded(true); return; }
        if (source && source.readyState >= 2) {
          // @ts-ignore
          await pose.send({ image: source });
        }
        requestAnimationFrame(sendFrame);
      };
      sendFrame();
    };
    initPose();
    return () => { isActive = false; };
  }, [exercise, sourceMode, videoSrc, videoKey]);

  const generateChartPath = () => {
    if (repHistory.length < 2) return "";
    const w = 680; const h = 150;
    const spacing = w / (repHistory.length - 1);
    return repHistory.map((r, i) => `${i === 0 ? 'M' : 'L'} ${i * spacing} ${h - Math.min((r.peakVelocity / 1.5) * h, h)}`).join(" ");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 bg-slate-950 min-h-screen text-white font-sans">
      <div className="flex-1 flex flex-col items-center gap-6">
        
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-full max-w-[720px]">
          <button onClick={() => {setExercise('SQUAT'); handleReset();}} className={`flex-1 py-2.5 rounded-xl font-bold transition-all ${exercise === 'SQUAT' ? 'bg-indigo-600 shadow-lg' : 'text-slate-500'}`}>SQUAT</button>
          <button onClick={() => {setExercise('DEADLIFT'); handleReset();}} className={`flex-1 py-2.5 rounded-xl font-bold transition-all ${exercise === 'DEADLIFT' ? 'bg-indigo-600 shadow-lg' : 'text-slate-500'}`}>DEADLIFT</button>
        </div>

        {/* DASHBOARD CON DATI BLUETOOTH */}
        <div className="grid grid-cols-4 gap-4 w-full max-w-[720px] bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 rounded-l-[2rem]"></div>
          <div className="text-center"><p className="text-[10px] text-slate-500 uppercase font-black">Reps</p><p className="text-5xl font-black">{counter}</p></div>
          
          <div className="text-center border-x border-slate-800 flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 uppercase font-black">m/s (Cam)</p>
            <p className="text-5xl font-black text-green-400 tabular-nums">{velocity}</p>
            {/* Dato live dal sensore hardware */}
            {isBleConnected && (
              <div className="mt-1 flex items-center justify-center gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">BLE: {bleAccel.toFixed(2)} g</p>
              </div>
            )}
          </div>

          <div className="text-center border-r border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-black">Loss %</p>
            <p className={`text-5xl font-black ${repHistory.length > 0 && repHistory[repHistory.length-1].fatigue > 20 ? 'text-red-500' : 'text-white'}`}>{repHistory.length > 0 ? repHistory[repHistory.length-1].fatigue : 0}%</p>
          </div>
          <div className="text-center"><p className="text-[10px] text-slate-500 uppercase font-black">Angle</p><p className="text-5xl font-black text-indigo-400">{angle}°</p></div>
        </div>

        <div className="relative rounded-[3rem] overflow-hidden border-4 border-slate-900 bg-black shadow-2xl group">
          {sourceMode === 'WEBCAM' ? (
            <Webcam ref={webcamRef} mirrored={false} className="w-full max-w-[720px] h-auto" />
          ) : (
            <video key={videoKey} ref={videoRef} src={videoSrc || ""} muted playsInline autoPlay className="w-full max-w-[720px] h-auto" />
          )}
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
          <div className="absolute bottom-6 left-6 px-4 py-2 bg-black/60 rounded-xl border border-white/10 font-bold text-xs uppercase tracking-widest">{status}</div>
        </div>

        <div className="w-full max-w-[720px] bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 px-2">VBT Trend</h4>
          </div>
          <div className="relative h-[150px] w-full px-4">
            {repHistory.length < 2 ? (
              <div className="absolute inset-0 flex items-center justify-center border border-dashed border-slate-700 rounded-2xl text-slate-600 text-[10px] font-bold uppercase tracking-widest">Dati insufficienti...</div>
            ) : (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 680 150">
                <path d={generateChartPath()} fill="none" stroke="#00FFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]" />
                {repHistory.map((r, i) => {
                  const x = i * (680 / (repHistory.length - 1));
                  const y = 150 - Math.min((r.peakVelocity / 1.5) * 150, 150);
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r="6" fill="#00FFFF" />
                      <text x={x} y={y - 15} textAnchor="middle" className="fill-green-400 text-[11px] font-black">{r.peakVelocity}</text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* COMANDI INFERIORI (Con Tasto Bluetooth) */}
        <div className="flex gap-4 w-full max-w-[720px]">
          <button 
            onClick={() => setSourceMode(prev => prev === 'WEBCAM' ? 'UPLOAD' : 'WEBCAM')} 
            className="flex-1 py-4 bg-slate-900 text-slate-400 font-bold rounded-2xl border border-slate-800 text-xs tracking-widest uppercase hover:bg-slate-800 transition-all"
          >
            {sourceMode === 'WEBCAM' ? "USA VIDEO" : "USA WEBCAM"}
          </button>
          
          {/* IL TASTO MAGICO BLUETOOTH */}
          <button 
            onClick={connectBluetooth} 
            className={`flex-1 py-4 font-bold rounded-2xl border text-xs tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2
              ${isBleConnected 
                ? 'bg-blue-900/20 text-blue-400 border-blue-500/30 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/30' 
                : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'}`}
          >
            {isBleConnected ? (
              <><span>BLE ATTIVO</span></>
            ) : (
              "CONNETTI SENSORE"
            )}
          </button>

          <button onClick={handleReset} className="flex-1 py-4 bg-slate-900 text-red-500 font-bold rounded-2xl border border-slate-800 text-xs tracking-widest uppercase hover:bg-red-950/20 transition-all">RESET</button>
        </div>
      </div>
      
      {/* Log anomalie nascosto qui per brevità */}
    </div>
  );
}