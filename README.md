# 🏋️‍♂️ PowerLift AI - Real-Time Squat Analyzer

**PowerLift AI** è una Web App avanzata che utilizza la Computer Vision per analizzare la biomeccanica dello squat in tempo reale. Progettata specificamente per atleti di Powerlifting, l'app fornisce feedback istantanei sulla validità dell'alzata e sulla velocità di esecuzione.

## 🚀 Funzionalità Principali

* **Analisi AI della Profondità:** Calcola l'angolo del ginocchio e verifica la rottura del parallelo (Anca vs Ginocchio) secondo gli standard di gara.
* **VBT (Velocity Based Training):** Calcolo della velocità media della fase concentrica (m/s) per monitorare l'intensità dell'allenamento.
* **Bar Path Tracking:** Tracciamento della traiettoria del bilanciere tramite i landmark dei polsi.
* **Failure Analysis:** Cattura automatica dello screenshot al punto più basso raggiunto (Bottom Position) in caso di ripetizione non valida.
* **Session Archiving:** Download automatico degli errori con naming dinamico (`Rep X - No Parallel.png`) per l'analisi post-allenamento.

## 🛠 Tech Stack

* **Framework:** Next.js 15+ (App Router)
* **AI Engine:** MediaPipe Pose Detection
* **Frontend:** Tailwind CSS & Lucide Icons
* **Language:** TypeScript
* **Version Control:** Git

## 📦 Installazione

1. Clona la repository: `git clone https://github.com/tuo-username/fitness-ai.git`
2. Installa le dipendenze: `npm install`
3. Avvia lo sviluppo: `npm run dev`
4. Apri `http://localhost:3000` nel browser.

---
*Sviluppato da Flavio Visconti come progetto di Biomeccanica e AI.*