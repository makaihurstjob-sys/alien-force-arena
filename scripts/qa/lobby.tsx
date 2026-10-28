import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { useOnlinePowerDuel } from "../../src/game/classic/useOnlinePowerDuel";
import { OnlineArcadeDuel } from "../../src/components/OnlineArcadeDuel";
import HangarLobby from "../../src/components/HangarLobby";
import Classic from "../../src/components/Classic";
import TouchJoystick from "../../src/components/TouchJoystick";
import "../../src/styles.css";
const params = new URLSearchParams(location.search);
const ids = ["a", "b", "c", "d"];
const player = params.get("player") ?? "a";
const room = {
  id: "qa-squad",
  code: "TEST12",
  host_id: "a",
  status: "open",
  phase: "lobby",
  members: ids.map((id, index) => ({
    player_id: id,
    display_name: ["Alice", "Bob", "Carol", "Dan"][index]!,
    ready: true,
    is_ready: true,
    team: index % 2,
  })),
};
function App() {
  const [direction, setDirection] = useState<string | null>(null);
  const duel = useOnlinePowerDuel(params.has("match") ? room : null, player);
  const started = useRef(false);
  useEffect(() => {
    if (player === "a" && duel.canStart && !started.current) {
      started.current = true;
      duel.start();
    }
  }, [duel.canStart]);
  (window as any).__qa = { duel, direction };
  if (params.has("adventure")) return <Classic />;
  if (params.has("joystick"))
    return (
      <>
        <TouchJoystick onChange={setDirection} />
        <output>{direction ?? "idle"}</output>
      </>
    );
  if (duel.view)
    return (
      <OnlineArcadeDuel
        duel={duel}
        player={player}
        onLeave={() => {}}
        onReturn={() => {}}
        busy={false}
      />
    );
  return (
    <div className="mobile-main-menu">
      <div className="is-hangar" style={{ padding: 24 }}>
        <HangarLobby
          room={room}
          player={player}
          mode="arcade"
          busy={false}
          connected
          unavailable={false}
          readinessAvailable
          selfReady
          allReady
          status="Ready when you are"
          invite={`${location.origin}/#room=TEST12`}
          onLeave={() => {}}
          onReady={() => {}}
          onStart={() => {}}
        />
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
