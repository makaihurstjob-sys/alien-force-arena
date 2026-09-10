import { createRoot } from "react-dom/client";
import { useState } from "react";
import Classic from "../src/components/Classic";
import "../src/styles.css";

function App() {
  const [playing, setPlaying] = useState(false);
  if (playing) return <Classic menuHref="./" />;
  return (
    <main className="min-h-screen bg-background p-6 font-mono text-foreground flex items-center justify-center">
      <div className="max-w-lg space-y-6 text-center">
        <h1 className="text-3xl">Alien Force Classic</h1>
        <p>Navigate the grid, dodge enemies, and clear each wave.</p>
        <button className="border-2 bg-gray-300 px-8 py-4 text-black text-xl" onClick={() => setPlaying(true)}>Play Classic</button>
        <p className="text-sm">Arrows steer. Space fires. R reverses. P pauses.</p>
        <p className="text-sm">On your phone: D-pad to steer, A to fire, B to reverse, Start to pause.</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
