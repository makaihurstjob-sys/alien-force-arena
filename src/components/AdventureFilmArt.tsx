import { useId } from "react";
import type { StoryBeat } from "./adventure-story";

function Craft({ color = "#dceef6", damaged = false }: { color?: string; damaged?: boolean }) {
  return (
    <g className={damaged ? "film-craft damaged" : "film-craft"}>
      <ellipse cx="0" cy="67" rx="107" ry="13" fill="#020812" opacity=".65" />
      <g className="film-thruster">
        <path d="M-72 43 -56 101 -41 43M41 43 56 101 72 43" fill="#62eaff" opacity=".7" />
        <path d="M-65 43 -56 77 -48 43M48 43 56 77 65 43" fill="white" />
      </g>
      <path
        d="M0-99 31-29 106 39 106 62 40 43 23 61-23 61-40 43-106 62-106 39-31-29Z"
        fill={damaged ? "#465467" : color}
        stroke="#b1d4e6"
        strokeWidth="2"
      />
      <path d="M0-83 17-22 0 17-17-22Z" fill="#143b53" stroke="#74e8ff" strokeWidth="3" />
      <path d="m-30-18-58 53 48-10 18-29M30-18l58 53-48-10-18-29" fill="#38536c" />
      <path d="M-19 26H19L13 57H-13Z" fill="#607a8a" />
      <path d="M0-78V-36M-73 39l-18 10M73 39l18 10" stroke="#ecfcff" strokeWidth="3" />
      <path d="M-68 32h24v18h-24zM44 32h24v18H44z" fill="#102333" stroke="#668fa7" />
      {damaged && (
        <g stroke="#fba06b" strokeWidth="2">
          <path d="m-41-10 18 21-12 7 25 26M43 16 28 33l14 10" />
          <g className="film-smoke">
            <circle cx="-53" cy="-20" r="20" fill="#8b9aa7" opacity=".35" />
            <circle cx="-43" cy="-45" r="29" fill="#7a8e9f" opacity=".2" />
          </g>
        </g>
      )}
    </g>
  );
}
function Pilot({ portrait = false }: { portrait?: boolean }) {
  return (
    <g className={portrait ? "film-portrait" : "film-walking-pilot"}>
      <path
        d="M-24 18-35 60-24 67-10 30M24 18 35 60 24 67 10 30"
        fill="#d17b47"
        stroke="#f1b07a"
        strokeWidth="2"
      />
      <path d="M-20 13Q0 2 20 13L24 60H-24Z" fill="#c66d3f" stroke="#f4ab70" strokeWidth="2" />
      <path d="M-13 17h26v31h-26z" fill="#203a4d" />
      <path d="M-9 23H9M-9 30H5" stroke="#71e1e5" strokeWidth="3" />
      <path
        className="pilot-leg-left"
        d="M-17 59-19 94h13L-2 59"
        fill="#617a8f"
        stroke="#b1c3d4"
        strokeWidth="2"
      />
      <path
        className="pilot-leg-right"
        d="M3 59 7 94h13L18 59"
        fill="#617a8f"
        stroke="#b1c3d4"
        strokeWidth="2"
      />
      <path d="M-21 91H-5v8h-20zM6 91h16l5 8H6z" fill="#14283b" />
      <rect
        x="-23"
        y="-38"
        width="46"
        height="48"
        rx="20"
        fill="#dce8eb"
        stroke="#7899ac"
        strokeWidth="3"
      />
      <path d="M-17-23Q0-38 17-23V-6Q0 4-17-6Z" fill="#0d263f" stroke="#70dfe7" strokeWidth="2" />
      <path d="m-12-21 18-6M-12-14 9-21" stroke="#b9f7ff" opacity=".65" strokeWidth="3" />
      <rect x="-27" y="-20" width="7" height="19" rx="3" fill="#42647a" />
      <rect x="20" y="-20" width="7" height="19" rx="3" fill="#42647a" />
    </g>
  );
}
export default function AdventureFilmArt({
  art,
  color,
  previousColor,
}: {
  art: StoryBeat["art"];
  color: string;
  previousColor?: string | undefined;
}) {
  const id = useId().replace(/:/g, "");
  const hangar = ["boarding", "launch", "escape", "reserve"].includes(art);
  return (
    <svg className={`film-illustration art-${art}`} viewBox="0 0 960 440" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-space`}>
          <stop stopColor="#28475b" />
          <stop offset="1" stopColor="#060c1c" />
        </radialGradient>
        <radialGradient id={`${id}-planet`} cx="30%" cy="25%">
          <stop stopColor="#72d4ca" />
          <stop offset=".45" stopColor="#295f7d" />
          <stop offset="1" stopColor="#07142d" />
        </radialGradient>
        <linearGradient id={`${id}-glass`} x2="1" y2="1">
          <stop stopColor="#75e5f5" stopOpacity=".18" />
          <stop offset="1" stopColor="#061226" stopOpacity=".8" />
        </linearGradient>
        <pattern id={`${id}-floor`} width="90" height="50" patternUnits="userSpaceOnUse">
          <path d="M0 0H90V50" fill="none" stroke="#3d687c" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="960" height="440" fill={`url(#${id}-space)`} />
      <g className="film-starfield">
        {Array.from({ length: 66 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 137 + 23) % 960}
            cy={(i * 71 + 11) % 440}
            r={i % 5 === 0 ? 1.7 : 0.8}
            fill="#c9ecff"
            opacity={0.25 + (i % 4) * 0.15}
          />
        ))}
      </g>
      {hangar ? (
        <>
          <path d="M0 0H960V335H0Z" fill="#0b1a2c" />
          <path
            d="M80 25H880V295H80Z"
            fill={`url(#${id}-glass)`}
            stroke="#4b6b82"
            strokeWidth="4"
          />
          <g stroke="#2d465c" strokeWidth="10">
            <path d="M80 25 0 0M880 25 960 0M80 295 0 340M880 295 960 340M240 25V295M720 25V295" />
          </g>
          <path d="M0 335H960V440H0Z" fill="#102337" />
          <path d="M0 335H960V440H0Z" fill={`url(#${id}-floor)`} />
          <ellipse cx="480" cy="356" rx="210" ry="28" fill="none" stroke="#72ead5" opacity=".5" />
          <path d="M130 320h130M700 320h130" stroke="#80f4e3" strokeWidth="4" />
          <g
            className="film-docked-craft"
            transform={
              art === "reserve" || art === "escape"
                ? "translate(310 250) scale(.8)"
                : "translate(525 250) scale(1.1)"
            }
          >
            <Craft color={previousColor ?? color} damaged={art === "reserve" || art === "escape"} />
          </g>
          {(art === "reserve" || art === "escape") && (
            <g transform="translate(735 250) scale(.8)" className="film-reserve-craft">
              <Craft color={color} />
            </g>
          )}
          <g className="film-pilot-route">
            <g transform="translate(140 285) scale(.65)">
              <Pilot />
            </g>
          </g>
          {art === "launch" && (
            <path
              className="film-launch-trail"
              d="M470 350v80M580 350v80"
              stroke="#a8f6ff"
              strokeWidth="12"
              opacity=".5"
            />
          )}
        </>
      ) : (
        <>
          <g className="film-world">
            <circle
              cx="280"
              cy="265"
              r="181"
              fill={`url(#${id}-planet)`}
              stroke="#6edcdb"
              strokeOpacity=".4"
              strokeWidth="3"
            />
            <path
              d="m164 175 50-35 56 21 16 42-35 17-10 37-42-19-10-31ZM305 273l59-23 47 26-12 48-37 19-14 49-33-28Z"
              fill="#62b6a5"
              opacity=".3"
            />
            <ellipse
              cx="280"
              cy="265"
              rx="231"
              ry="45"
              transform="rotate(-20 280 265)"
              fill="none"
              stroke="#7ac5d8"
              opacity=".18"
              strokeWidth="13"
            />
          </g>
          {art === "gate" ? (
            <>
              <g className="film-transit-craft" transform="translate(220 260) scale(.8)">
                <Craft color={previousColor ?? color} />
              </g>
              <g transform="translate(725 200)">
                <ellipse rx="68" ry="134" fill="#3defce" opacity=".1" />
                <ellipse rx="68" ry="134" fill="none" stroke="#9afbe4" strokeWidth="8" />
                <ellipse rx="49" ry="110" fill="none" stroke="#64d0e3" strokeWidth="2" />
              </g>
            </>
          ) : (
            <>
              <g className="film-blockade">
                {Array.from({ length: 7 }, (_, i) => (
                  <g
                    key={i}
                    transform={`translate(${125 + i * 108} ${70 + (i % 2) * 35}) scale(.24)`}
                  >
                    <Craft color="#ce6e69" />
                  </g>
                ))}
              </g>
              <path
                d="M580 420 621 87 813 64 893 420Z"
                fill={`url(#${id}-glass)`}
                stroke="#6c93aa"
                strokeWidth="3"
              />
              <g transform="translate(728 266) scale(2.1)">
                <Pilot portrait />
              </g>
              <path d="M526 408H934L960 440H498Z" fill="#172d42" stroke="#5d8b9e" strokeWidth="3" />
              <path d="M592 422h55m18 0h25m137 0h55" stroke="#77eddc" strokeWidth="4" />
            </>
          )}
        </>
      )}
      <path
        d="M18 50V18H50M910 18h32v32M18 390v32h32m860 0h32v-32"
        fill="none"
        stroke="#9ac4d0"
        opacity=".45"
      />
      <text x="38" y="402" fill="#98bacb" fontSize="10" letterSpacing="3">
        {hangar ? "LAST LIGHT / RESCUE HANGAR" : "SENTINEL NETWORK / DISTRESS SIGNAL"}
      </text>
    </svg>
  );
}
