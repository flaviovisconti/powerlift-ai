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
  
  const [counter, setCounter] = useState(0);
  const [angle, setAngle] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [repHistory, setRepHistory] = useState<RepData[]>([]);
  const [status, setStatus] = useState("PRONTO");
  const [failScreenshots, setFailScreenshots] = useState<FailDetail[]>([]);
  const [selectedImage, setSelectedImage] = useState<FailDetail | null>(null);

  const counterRef = useRef(0);
  const stageRef = useRef<"up" | "down">("up");
  const hasReachedDepth = useRef(false);
  const pathRef = useRef<{x: number, y: number}[]>([]);
  const lastPathsRef = useRef<{x: number, y: number}[][]>([]);
  const prevBarRef = useRef({ x: 0, y: 0, t: 0 });
  const currentMaxVelRef = useRef(0);

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
          modelComplexity: 2, 
          smoothLandmarks: true,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
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

          const now = Date.now();
          let rawX, rawY;
          if (exercise === 'SQUAT') {
            rawX = side.w.x * canvasElement.width;
            rawY = side.s.y * canvasElement.height;
          } else {
            const vDirX = side.w.x - side.e.x;
            const vDirY = side.w.y - side.e.y;
            rawX = (side.w.x + vDirX * 0.35) * canvasElement.width;
            rawY = (side.w.y + vDirY * 0.35) * canvasElement.height;
          }

          const barX = prevBarRef.current.x === 0 ? rawX : prevBarRef.current.x * 0.2 + rawX * 0.8;
          const barY = prevBarRef.current.y === 0 ? rawY : prevBarRef.current.y * 0.2 + rawY * 0.8;

          const pixelDist = Math.sqrt(Math.pow(side.h.x - side.s.x, 2) + Math.pow(side.h.y - side.s.y, 2)) * canvasElement.height;
          const metersPerPixel = 0.5 / (pixelDist || 1);
          
          if (prevBarRef.current.t > 0) {
            const dy = (barY - prevBarRef.current.y) * metersPerPixel;
            const dt = (now - prevBarRef.current.t) / 1000;
            const v = Math.abs(dy / dt);
            if (v < 4) {
              setVelocity(Number(v.toFixed(2)));
              if (v > currentMaxVelRef.current) currentMaxVelRef.current = v;
            }
          }
          prevBarRef.current = { x: barX, y: barY, t: now };

          const curAngle = calculateAngle(side.h, side.k, side.a);
          setAngle(curAngle);

          let skeletonColor = "#6366f1"; 

          if (side.h.visibility > 0.5) {
            if (exercise === 'SQUAT') {
              if (curAngle < 115) { 
                if (stageRef.current === "up") {
                  stageRef.current = "down";
                  hasReachedDepth.current = false;
                  currentMaxVelRef.current = 0;
                  pathRef.current = [];
                }
                if (curAngle <= 90) hasReachedDepth.current = true;
                skeletonColor = hasReachedDepth.current ? "#22c55e" : "#ef4444";
                setStatus(hasReachedDepth.current ? "PROFONDITÀ OK" : "SCENDI...");
              }
              if (curAngle > 160 && stageRef.current === "down") {
                stageRef.current = "up";
                if (hasReachedDepth.current) {
                  counterRef.current += 1;
                  setCounter(counterRef.current);
                  
                  const peakV = Number(currentMaxVelRef.current.toFixed(2));
                  setRepHistory(prev => {
                    const firstVel = prev.length > 0 ? prev[0].peakVelocity : peakV;
                    const fatigueLoss = prev.length > 0 ? Math.round((1 - peakV / firstVel) * 100) : 0;
                    return [...prev, { repNumber: counterRef.current, peakVelocity: peakV, fatigue: fatigueLoss }];
                  });
                  setStatus("SQUAT VALIDO");
                } else {
                  setStatus("FAIL: NO DEPTH");
                  const imageData = canvasElement.toDataURL("image/png");
                  setFailScreenshots(prev => [...prev, { image: imageData, repNumber: counterRef.current + 1, exercise }]);
                }
                lastPathsRef.current.push([...pathRef.current]);
              }
              if (stageRef.current === "down") pathRef.current.push({x: barX, y: barY});
            } else {
              // DEADLIFT
              const kneeY = side.k.y * canvasElement.height;
              const ankleY = side.a.y * canvasElement.height;
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
                  const firstVel = prev.length > 0 ? prev[0].peakVelocity : peakV;
                  const fatigueLoss = prev.length > 0 ? Math.round((1 - peakV / firstVel) * 100) : 0;
                  return [...prev, { repNumber: counterRef.current, peakVelocity: peakV, fatigue: fatigueLoss }];
                });
                lastPathsRef.current.push([...pathRef.current]);
                setStatus("DEADLIFT OK");
              }
              if (stageRef.current === "down") {
                pathRef.current.push({x: barX, y: barY});
                skeletonColor = "#22c55e";
              }
            }
          }

          canvasCtx.lineWidth = 2;
          canvasCtx.strokeStyle = "rgba(148, 163, 184, 0.3)";
          lastPathsRef.current.forEach(p => {
            canvasCtx.beginPath();
            canvasCtx.moveTo(p[0].x, p[0].y);
            p.forEach(pt => canvasCtx.lineTo(pt.x, pt.y));
            canvasCtx.stroke();
          });
          if (pathRef.current.length > 2) {
            canvasCtx.strokeStyle = "#00FFFF";
            canvasCtx.lineWidth = 5;
            canvasCtx.beginPath();
            canvasCtx.moveTo(pathRef.current[0].x, pathRef.current[0].y);
            pathRef.current.forEach(pt => canvasCtx.lineTo(pt.x, pt.y));
            canvasCtx.stroke();
          }
          canvasCtx.strokeStyle = skeletonColor;
          canvasCtx.lineWidth = 6;
          canvasCtx.beginPath();
          canvasCtx.moveTo(side.h.x * canvasElement.width, side.h.y * canvasElement.height);
          canvasCtx.lineTo(side.k.x * canvasElement.width, side.k.y * canvasElement.height);
          canvasCtx.lineTo(side.a.x * canvasElement.width, side.a.y * canvasElement.height);
          canvasCtx.stroke();
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

  function handleReset() {
    counterRef.current = 0;
    setCounter(0);
    setVelocity(0);
    setRepHistory([]);
    setFailScreenshots([]);
    pathRef.current = [];
    lastPathsRef.current = [];
    stageRef.current = "up";
    setStatus("PRONTO");
  }

  const generateChartPath = () => {
    if (repHistory.length < 2) return "";
    const width = 680; 
    const height = 150;
    const spacing = width / (repHistory.length - 1);
    return repHistory.map((rep, i) => {
      const x = i * spacing;
      const y = height - Math.min((rep.peakVelocity / 1.5) * height, height);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(" ");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 bg-slate-950 min-h-screen text-white font-sans">
      <div className="flex-1 flex flex-col items-center gap-6">
        {/* SELETTORE ESERCIZIO */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-full max-w-[720px]">
          <button onClick={() => {setExercise('SQUAT'); handleReset();}} className={`flex-1 py-2.5 rounded-xl font-bold transition-all ${exercise === 'SQUAT' ? 'bg-indigo-600' : 'text-slate-500'}`}>SQUAT</button>
          <button onClick={() => {setExercise('DEADLIFT'); handleReset();}} className={`flex-1 py-2.5 rounded-xl font-bold transition-all ${exercise === 'DEADLIFT' ? 'bg-indigo-600' : 'text-slate-500'}`}>DEADLIFT</button>
        </div>

        {/* DASHBOARD PRINCIPALE */}
        <div className="grid grid-cols-4 gap-4 w-full max-w-[720px] bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <div className="text-center"><p className="text-[10px] text-slate-500 uppercase font-black">Reps</p><p className="text-5xl font-black">{counter}</p></div>
          <div className="text-center border-x border-slate-800"><p className="text-[10px] text-slate-500 uppercase font-black">m/s</p><p className="text-5xl font-black text-green-400 tabular-nums">{velocity}</p></div>
          <div className="text-center border-r border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-black">Loss %</p>
            <p className={`text-5xl font-black tabular-nums ${repHistory.length > 0 && repHistory[repHistory.length-1].fatigue > 20 ? 'text-red-500' : 'text-white'}`}>
              {repHistory.length > 0 ? repHistory[repHistory.length-1].fatigue : 0}%
            </p>
          </div>
          <div className="text-center"><p className="text-[10px] text-slate-500 uppercase font-black">Angle</p><p className="text-5xl font-black text-indigo-400 tabular-nums">{angle}°</p></div>
        </div>

        {/* MONITOR */}
        <div className="relative rounded-[3rem] overflow-hidden border-4 border-slate-900 bg-black shadow-2xl">
          {sourceMode === 'WEBCAM' ? (
            <Webcam ref={webcamRef} mirrored={false} className="w-full max-w-[720px] h-auto opacity-90" />
          ) : (
            <video key={videoKey} ref={videoRef} src={videoSrc || ""} muted playsInline autoPlay className="w-full max-w-[720px] h-auto opacity-90" />
          )}
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
          {isVideoEnded && sourceMode === 'UPLOAD' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md">
              <button onClick={handleReplay} className="px-10 py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl uppercase tracking-widest">REPLAY</button>
            </div>
          )}
        </div>

        {/* GRAFICO VBT CON RETTA */}
        <div className="w-full max-w-[720px] bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-8 px-2">VBT Trend Line (m/s)</h4>
          <div className="relative h-[150px] w-full px-4">
            {repHistory.length < 2 ? (
              <div className="absolute inset-0 flex items-center justify-center border border-dashed border-slate-700 rounded-2xl text-slate-600 text-[10px] font-bold uppercase tracking-widest">Dati insufficienti per la retta...</div>
            ) : (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 680 150">
                <path d={generateChartPath()} fill="none" stroke="#00FFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]" />
                {repHistory.map((rep, i) => {
                  const spacing = 680 / (repHistory.length - 1);
                  const x = i * spacing;
                  const y = 150 - Math.min((rep.peakVelocity / 1.5) * 150, 150);
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r="6" fill="#00FFFF" />
                      <text x={x} y={y - 15} textAnchor="middle" className="fill-green-400 text-[12px] font-black">{rep.peakVelocity}</text>
                      <text x={x} y={170} textAnchor="middle" className="fill-slate-500 text-[10px] font-bold">R{rep.repNumber} ({rep.fatigue}%)</text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* CONTROLLI INFERIORI */}
        <div className="flex gap-4 w-full max-w-[720px]">
          <button onClick={() => setSourceMode(prev => prev === 'WEBCAM' ? 'UPLOAD' : 'WEBCAM')} className="flex-1 py-4 bg-slate-900 text-slate-400 font-bold rounded-2xl border border-slate-800 text-xs tracking-widest uppercase hover:bg-slate-800 transition-all">FONTE</button>
          {sourceMode === 'UPLOAD' && (
            <label className="flex-1 py-4 bg-indigo-900/20 text-indigo-400 font-bold rounded-2xl border border-indigo-500/30 text-center cursor-pointer text-xs tracking-widest uppercase hover:bg-indigo-900/40 transition-all">CARICA FILE<input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" /></label>
          )}
          <button onClick={handleReset} className="flex-1 py-4 bg-slate-900 text-red-500 font-bold rounded-2xl border border-slate-800 text-xs tracking-widest uppercase hover:bg-red-950/20 transition-all">RESET</button>
        </div>
      </div>

      {/* ANOMALIES LOG */}
      <div className="w-full lg:w-80 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-6 flex flex-col gap-4 shadow-2xl overflow-hidden">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2 px-2">Anomalies Log</h3>
        <div className="flex flex-col gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
          {failScreenshots.length === 0 ? <p className="text-[10px] text-slate-600 italic px-2">Tutto regolare.</p> : 
            failScreenshots.map((fail, i) => (
              <div key={i} onClick={() => setSelectedImage(fail)} className="group relative rounded-2xl overflow-hidden border-2 border-red-500/30 cursor-pointer hover:border-red-500 transition-all shadow-lg transform hover:-translate-y-1">
                <img src={fail.image} className="w-full h-auto opacity-70 group-hover:opacity-100" />
                <div className="absolute bottom-0 left-0 right-0 bg-red-600/90 py-1.5 px-3 text-[9px] font-black uppercase tracking-widest flex justify-between">
                  <span>Rep #{fail.repNumber}</span>
                  <span>{fail.exercise}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-10" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage.image} className="max-w-full max-h-full rounded-[2.5rem] border-2 border-white/10 shadow-2xl" />
        </div>
      )}
    </div>
  );
}