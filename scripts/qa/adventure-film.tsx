import { createRoot } from "react-dom/client";
import { useState } from "react";
import AdventureCinematic from "../../src/components/AdventureCinematic";
import type { FilmScene } from "../../src/components/adventure-story";
function Preview() {
  const [scene, setScene] = useState<FilmScene | null>(
    location.search.includes("transfer") ? "transfer" : "origin",
  );
  return scene ? (
    <AdventureCinematic
      key={scene}
      scene={scene}
      level={scene === "transfer" ? 21 : 1}
      color="#95dcff"
      previousColor="#e8f5ff"
      onFinish={() => setScene(scene === "origin" ? "boarding" : null)}
    />
  ) : (
    <p>Mission ready</p>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
