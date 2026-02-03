"use client";
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';

// Tipo per i dettagli del fallimento
interface FailDetail {
  image: string;
  repNumber: number;
}

export default function WorkoutCanvas() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // UI STATE
  const [counter, setCounter] = useState(0);
  const [angle, setAngle] = useState(0);
  const [isParallel, setIsParallel] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const [failScreenshots, setFailScreenshots] = useState<FailDetail[]>([]);
  const [status, setStatus] = useState("READY");
  const [selectedImage, setSelectedImage] = useState<FailDetail | null>(null); // Per l'ingrandimento

  // LOGIC REFS
  const counterRef = useRef(0);
  const stageRef = useRef("up");
  const pathRef = useRef<{x: number, y: number, t: number}[]>([]);
  const startTimeRef = useRef<number>(0);
  const lowestYRef = useRef<number>(0);
  const reachedParallelRef = useRef(false);
  const bottomFrameRef = useRef<string | null>(null);
  const maxHipYRef = useRef<number>(0);

  const calculateAngle = (A: any, B: any, C: any) => {
    const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angleDeg = Math.abs((radians * 180.0) / Math.PI);
    if (angleDeg > 180.0) angleDeg = 360 - angleDeg;
    return Math.round(angleDeg);
  };

  useEffect(() => {
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
        if (!canvasRef.current || !webcamRef.current?.video) return;
        
        const video = webcamRef.current.video;
        const canvasElement = canvasRef.current;
        const canvasCtx = canvasElement.getContext("2d");
        
        if (canvasElement.width !== video.videoWidth) {
          canvasElement.width = video.videoWidth;
          canvasElement.height = video.videoHeight;
        }

        if (!canvasCtx) return;
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        canvasCtx.globalAlpha = 0.6;
        canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.globalAlpha = 1.0;

        if (results.poseLandmarks) {
          const landmarks = results.poseLandmarks;
          const hip = landmarks[23];
          const knee = landmarks[25];
          const ankle = landmarks[27];
          const wrist = landmarks[15];

          if (hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
            const currentAngle = calculateAngle(hip, knee, ankle);
            setAngle(currentAngle);
            const deepEnoughNow = hip.y > knee.y;
            setIsParallel(deepEnoughNow);

            if (currentAngle < 100 && stageRef.current === "up") {
              stageRef.current = "down";
              reachedParallelRef.current = false;
              maxHipYRef.current = 0;
              bottomFrameRef.current = null;
              lowestYRef.current = wrist.y;
              startTimeRef.current = Date.now();
              setStatus("ANALYZING DEPTH...");
            }

            if (stageRef.current === "down") {
              if (deepEnoughNow) reachedParallelRef.current = true;
              
              if (hip.y > maxHipYRef.current) {
                maxHipYRef.current = hip.y;
                bottomFrameRef.current = canvasElement.toDataURL("image/png");
              }

              if (wrist.y > lowestYRef.current) {
                lowestYRef.current = wrist.y;
                startTimeRef.current = Date.now();
              }
            }

            if (currentAngle > 160 && stageRef.current === "down") {
              const duration = (Date.now() - startTimeRef.current) / 1000;
              const distance = Math.abs(wrist.y - lowestYRef.current);
              const vbt = duration > 0 ? (distance / duration) * 10 : 0;
              setVelocity(parseFloat(vbt.toFixed(2)));

              if (reachedParallelRef.current) {
                setCounter(c => c + 1);
                counterRef.current += 1;
                setStatus("VALID REP ⚪");
              } else {
                setStatus("NO LIFT 🔴");
                if (bottomFrameRef.current) {
                  const newFail: FailDetail = {
                    image: bottomFrameRef.current,
                    repNumber: counterRef.current + 1 // Segnamo quale rep è fallita
                  };
                  setFailScreenshots(prev => [newFail, ...prev].slice(0, 6));
                }
              }
              stageRef.current = "up";
              pathRef.current = [];
            }

            // Path & Drawing
            if (wrist.visibility > 0.5) {
              pathRef.current.push({ x: wrist.x * canvasElement.width, y: wrist.y * canvasElement.height, t: Date.now() });
              if (pathRef.current.length > 50) pathRef.current.shift();
            }

            canvasCtx.strokeStyle = reachedParallelRef.current ? "#22C55E" : (stageRef.current === "down" ? "#3B82F6" : "#EF4444");
            canvasCtx.lineWidth = 6;
            canvasCtx.beginPath();
            canvasCtx.moveTo(hip.x * canvasElement.width, hip.y * canvasElement.height);
            canvasCtx.lineTo(knee.x * canvasElement.width, knee.y * canvasElement.height);
            canvasCtx.lineTo(ankle.x * canvasElement.width, ankle.y * canvasElement.height);
            canvasCtx.stroke();

            if (pathRef.current.length > 2) {
              canvasCtx.beginPath();
              canvasCtx.strokeStyle = "#FFFF00";
              canvasCtx.setLineDash([5, 5]);
              canvasCtx.moveTo(pathRef.current[0].x, pathRef.current[0].y);
              pathRef.current.forEach(p => canvasCtx.lineTo(p.x, p.y));
              canvasCtx.stroke();
              canvasCtx.setLineDash([]);
            }
          }
        }
        canvasCtx.restore();
      });

      const sendFrame = async () => {
        if (webcamRef.current?.video?.readyState === 4) {
          // @ts-ignore
          await pose.send({ image: webcamRef.current.video });
        }
        requestAnimationFrame(sendFrame);
      };
      sendFrame();
    };

    initPose();
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 bg-slate-950 min-h-screen text-white font-sans">
      
      {/* MODAL PER INGRANDIMENTO */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl w-full">
            <img src={selectedImage.image} className="w-full rounded-3xl border-4 border-red-600 shadow-2xl" />
            <div className="absolute top-4 left-4 bg-red-600 px-6 py-2 rounded-full font-black uppercase">
              REP {selectedImage.repNumber} - NO DEPTH
            </div>
            <p className="mt-4 text-center text-slate-400 font-bold">Clicca ovunque per chiudere</p>
          </div>
        </div>
      )}

      {/* DASHBOARD PRINCIPALE */}
      <div className="flex-1 flex flex-col items-center gap-6">
        <div className="grid grid-cols-4 gap-4 w-full bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-blue-400">Reps</p>
            <p className="text-6xl font-black">{counter}</p>
          </div>
          <div className="text-center border-x border-slate-800">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-blue-400">Velocity</p>
            <p className="text-6xl font-black">{velocity}</p>
          </div>
          <div className="text-center border-r border-slate-800">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-blue-400">Angle</p>
            <p className="text-6xl font-black">{angle}°</p>
          </div>
          <div className="flex flex-col justify-center items-center">
             <div className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest ${isParallel ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                {isParallel ? "DEPTH OK" : "LOW"}
             </div>
          </div>
        </div>

        <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-slate-800 bg-black shadow-2xl group">
          <Webcam ref={webcamRef} mirrored={false} className="w-full max-w-[720px] transition-opacity opacity-70 group-hover:opacity-100 duration-700" />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
          <div className={`absolute top-6 left-6 px-6 py-2 rounded-2xl font-black text-white shadow-2xl backdrop-blur-md border border-white/10 ${status.includes("VALID") ? "bg-green-600/80" : "bg-slate-800/80"}`}>
            {status}
          </div>
        </div>
        
        <button 
          onClick={() => { counterRef.current = 0; setCounter(0); setFailScreenshots([]); setVelocity(0); }}
          className="w-full max-w-[720px] py-4 bg-slate-900 hover:bg-red-950/30 text-slate-500 hover:text-red-500 font-bold rounded-2xl border border-slate-800 transition-all uppercase text-xs tracking-[0.2em]"
        >
          Reset Session
        </button>
      </div>

      {/* ANALISI ERRORI LATERALE */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-2">Bottom Replays</h3>
        <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
          {failScreenshots.length === 0 ? (
            <div className="h-32 rounded-[2rem] border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-700 text-[10px] uppercase font-bold text-center p-6">
              Nessun fallimento rilevato
            </div>
          ) : (
            failScreenshots.map((fail, i) => (
              <div 
                key={i} 
                onClick={() => setSelectedImage(fail)}
                className="relative rounded-[1.5rem] overflow-hidden border-2 border-red-900/30 bg-slate-900 cursor-zoom-in hover:border-red-600 transition-all group"
              >
                <img src={fail.image} alt="Errore" className="w-full opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 bg-red-600/90 p-2 text-[10px] font-black text-center text-white">
                  REP {fail.repNumber} - NO PARALLEL
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}