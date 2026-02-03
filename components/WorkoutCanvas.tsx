"use client";
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';

export default function WorkoutCanvas() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // STATO PER LA UI
  const [displayCounter, setDisplayCounter] = useState(0);
  const [displayAngle, setDisplayAngle] = useState(0);
  const [status, setStatus] = useState("IN ATTESA");

  // RIFERIMENTI PER LA LOGICA (Evitano doppi conteggi e crash)
  const counterRef = useRef(0);
  const stageRef = useRef("up");

  const calculateAngle = (A: any, B: any, C: any) => {
    const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return Math.round(angle);
  };

  useEffect(() => {
    let pose: any = null;

    const initPose = async () => {
      // Carichiamo lo script solo se non esiste
      if (!document.getElementById("mediapipe-pose-script")) {
        const script = document.createElement("script");
        script.id = "mediapipe-pose-script";
        script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js";
        script.async = true;
        document.body.appendChild(script);
        await new Promise((res) => (script.onload = res));
      }

      // @ts-ignore - Usiamo un'istanza globale per evitare RuntimeError Wasm
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
          const hip = landmarks[23];
          const knee = landmarks[25];
          const ankle = landmarks[27];

          if (hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
            const currentAngle = calculateAngle(hip, knee, ankle);
            setDisplayAngle(currentAngle);

            // LOGICA SQUAT CORRETTO (Diventa verde sotto i 95 gradi)
            const isSquatting = currentAngle < 95;

            // Logica Conteggio
            if (isSquatting && stageRef.current === "up") {
              stageRef.current = "down";
              setStatus("SQUAT OK! SALI");
            }

            if (currentAngle > 160 && stageRef.current === "down") {
              stageRef.current = "up";
              counterRef.current += 1;
              setDisplayCounter(counterRef.current);
              setStatus("GRANDE! +1");
            }

            // DISEGNO DINAMICO
            // Il colore cambia in base a quanto sei sceso
            const color = isSquatting ? "#22C55E" : "#3B82F6"; // Verde se ok, Blu se alto
            
            canvasCtx.strokeStyle = color;
            canvasCtx.lineWidth = 8;
            canvasCtx.lineCap = "round";
            canvasCtx.beginPath();
            canvasCtx.moveTo(hip.x * canvasElement.width, hip.y * canvasElement.height);
            canvasCtx.lineTo(knee.x * canvasElement.width, knee.y * canvasElement.height);
            canvasCtx.lineTo(ankle.x * canvasElement.width, ankle.y * canvasElement.height);
            canvasCtx.stroke();

            // Puntini sulle articolazioni
            [hip, knee, ankle].forEach(pt => {
              canvasCtx.beginPath();
              canvasCtx.arc(pt.x * canvasElement.width, pt.y * canvasElement.height, 6, 0, 2*Math.PI);
              canvasCtx.fillStyle = "white";
              canvasCtx.fill();
            });
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
    <div className="flex flex-col items-center gap-6 p-8 bg-slate-900 rounded-[3rem] shadow-2xl border-4 border-slate-800">
      {/* HEADER: Reps e Gradi */}
      <div className="flex gap-16 text-white text-center">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ripetizioni</p>
          <p className="text-8xl font-black text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]">{displayCounter}</p>
        </div>
        <div className="border-l border-slate-800 pl-16">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Angolo</p>
          <p className={`text-8xl font-black transition-colors ${displayAngle < 95 ? 'text-green-400' : 'text-white'}`}>
            {displayAngle}°
          </p>
        </div>
      </div>
      
      {/* VIDEO E CANVAS */}
      <div className="relative rounded-3xl overflow-hidden border-8 border-slate-950 bg-black shadow-inner">
        <Webcam 
          ref={webcamRef} 
          mirrored={false} 
          className="w-full max-w-[640px] h-auto opacity-60" 
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
        
        {/* Badge Stato */}
        <div className={`absolute top-6 left-6 px-6 py-2 rounded-full font-black text-white shadow-xl transition-all duration-300 ${displayAngle < 95 ? "bg-green-500 scale-110" : "bg-blue-600"}`}>
          {status}
        </div>
      </div>

      {/* FOOTER: Controlli */}
      <div className="flex gap-4 w-full">
        <button 
          onClick={() => { counterRef.current = 0; setDisplayCounter(0); }}
          className="flex-1 py-4 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 font-bold rounded-2xl transition-all uppercase tracking-widest text-sm border border-slate-700"
        >
          Reset Sessione
        </button>
      </div>
    </div>
  );
}