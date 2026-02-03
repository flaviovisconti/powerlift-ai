"use client";
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';

export default function WorkoutCanvas() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // UI STATE
  const [counter, setCounter] = useState(0);
  const [angle, setAngle] = useState(0);
  const [isParallel, setIsParallel] = useState(false);
  const [status, setStatus] = useState("READY");

  // LOGIC REFS (Per evitare crash Wasm e lag)
  const counterRef = useRef(0);
  const stageRef = useRef("up");
  const pathRef = useRef<{x: number, y: number}[]>([]); // Memorizza la traiettoria

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

        if (results.poseLandmarks) {
          const landmarks = results.poseLandmarks;
          
          // Punti: Anca(23), Ginocchio(25), Caviglia(27), Polso(15 - Bar Path)
          const hip = landmarks[23];
          const knee = landmarks[25];
          const ankle = landmarks[27];
          const wrist = landmarks[15];

          if (hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
            const currentAngle = calculateAngle(hip, knee, ankle);
            setAngle(currentAngle);

            // 1. CHECK PROFONDITÀ (Powerlifting Standard)
            // Nel web le Y aumentano verso il basso: se hip.y > knee.y sei "sotto il parallelo"
            const deepEnough = hip.y > knee.y;
            setIsParallel(deepEnough);

            // 2. LOGICA CONTEGGIO
            if (currentAngle < 100 && stageRef.current === "up") {
              stageRef.current = "down";
            }
            if (currentAngle > 160 && stageRef.current === "down") {
              stageRef.current = "up";
              counterRef.current += 1;
              setCounter(counterRef.current);
              pathRef.current = []; // Resetta il path per la prossima rep (opzionale)
            }

            // 3. BAR PATH TRACKING
            if (wrist.visibility > 0.5) {
              pathRef.current.push({
                x: wrist.x * canvasElement.width,
                y: wrist.y * canvasElement.height
              });
              // Teniamo solo gli ultimi 100 punti per non appesantire
              if (pathRef.current.length > 100) pathRef.current.shift();
            }

            // --- DISEGNO ---
            // Disegna Bar Path (Linea Gialla)
            if (pathRef.current.length > 2) {
              canvasCtx.beginPath();
              canvasCtx.strokeStyle = "#FFFF00";
              canvasCtx.lineWidth = 3;
              canvasCtx.setLineDash([5, 5]); // Linea tratteggiata
              canvasCtx.moveTo(pathRef.current[0].x, pathRef.current[0].y);
              pathRef.current.forEach(p => canvasCtx.lineTo(p.x, p.y));
              canvasCtx.stroke();
              canvasCtx.setLineDash([]); // Reset tratteggio
            }

            // Disegna Scheletro (Verde se valido, Rosso se alto)
            canvasCtx.strokeStyle = deepEnough ? "#22C55E" : "#EF4444";
            canvasCtx.lineWidth = 6;
            canvasCtx.beginPath();
            canvasCtx.moveTo(hip.x * canvasElement.width, hip.y * canvasElement.height);
            canvasCtx.lineTo(knee.x * canvasElement.width, knee.y * canvasElement.height);
            canvasCtx.lineTo(ankle.x * canvasElement.width, ankle.y * canvasElement.height);
            canvasCtx.stroke();
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
    <div className="flex flex-col items-center gap-6 p-6 bg-black rounded-[2.5rem] border-2 border-slate-800 shadow-2xl">
      {/* POWERLIFTING DASHBOARD */}
      <div className="grid grid-cols-3 gap-8 w-full px-4 py-2">
        <div className="text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Repetitions</p>
          <p className="text-6xl font-black text-white">{counter}</p>
        </div>
        <div className="text-center border-x border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Knee Angle</p>
          <p className={`text-6xl font-black ${isParallel ? 'text-green-500' : 'text-red-500'}`}>{angle}°</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Depth</p>
          <p className={`text-2xl mt-4 font-bold ${isParallel ? 'text-green-500' : 'text-slate-700'}`}>
            {isParallel ? "GOOD" : "LOW DEPTH"}
          </p>
        </div>
      </div>
      
      {/* CAMERA VIEW */}
      <div className="relative rounded-3xl overflow-hidden border-4 border-slate-900 bg-slate-950 shadow-2xl">
        <Webcam ref={webcamRef} mirrored={false} className="w-full max-w-[640px] opacity-60" />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
        
        {/* Trajectory Label */}
        <div className="absolute bottom-4 right-4 bg-yellow-500/20 border border-yellow-500/50 px-3 py-1 rounded text-[10px] text-yellow-500 font-bold uppercase">
          Bar Path Active
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex gap-4 w-full px-4">
        <button 
          onClick={() => { counterRef.current = 0; setCounter(0); pathRef.current = []; }}
          className="flex-1 py-4 bg-slate-900 text-slate-400 text-xs font-black rounded-2xl border border-slate-800 hover:bg-red-950/20 hover:text-red-500 transition-all uppercase tracking-widest"
        >
          Reset Session
        </button>
      </div>
    </div>
  );
}