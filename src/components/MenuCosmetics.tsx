import type { CSSProperties } from "react";
import { ShipIcon } from "./ShipIcon";
import "./menu-cosmetics.css";

const colors = [
  { name: "Mint", color: "#69f0af" }, { name: "Solar", color: "#ffd166" },
  { name: "Crimson", color: "#ff647c" }, { name: "Glacier", color: "#6ad9ff" },
  { name: "Violet", color: "#bc95ff" }, { name: "Ember", color: "#ff995d" },
  { name: "Rose", color: "#ff9cda" }, { name: "Pearl", color: "#edf6ff" },
];

function Trail({ color }: { color: string }) {
  return <div className="cosmetic-trail" style={{ "--trail-color": color } as CSSProperties} aria-hidden="true">
    <span /><span /><span /><ShipIcon size={54} />
  </div>;
}

export function ShopScreen() {
  return <section className="menu-cosmetics shop-screen" aria-labelledby="shop-heading">
    <header className="cosmetics-heading"><h2 id="shop-heading">Shop</h2><p>Ship colors & flight trails</p></header>
    <div className="shop-construction">
      <div className="shop-catalog" inert aria-hidden="true">
        <h3>Ship colors</h3>
        <div className="cosmetics-grid">{colors.map(item => <article className="cosmetic-card" key={item.name} style={{ "--cosmetic-color": item.color } as CSSProperties}>
          <div className="cosmetic-preview"><ShipIcon size={96} color={item.color} /></div>
          <h4>{item.name}</h4><span>Available to buy soon</span>
        </article>)}</div>
        <h3>Flight trails</h3>
        <div className="cosmetics-grid">{colors.map(item => <article className="cosmetic-card" key={item.name} style={{ "--cosmetic-color": item.color } as CSSProperties}>
          <div className="cosmetic-preview"><Trail color={item.color} /></div>
          <h4>{item.name} trail</h4><span>Available to buy soon</span>
        </article>)}</div>
      </div>
      <div className="construction-notice" role="status" aria-label="Shop under construction. Ship colors and flight trails will be available to buy soon.">
        <div className="construction-tape-secondary" aria-hidden="true" />
        <div className="construction-tape">Under Construction</div>
        <p>New ship colors and trails coming soon</p>
      </div>
    </div>
  </section>;
}

export function LoadoutScreen() {
  return <section className="menu-cosmetics loadout-screen" aria-labelledby="loadout-heading">
    <header className="cosmetics-heading"><h2 id="loadout-heading">Loadout</h2><p>Your ship. Your style.</p></header>
    <div className="loadout-layout">
      <div className="loadout-showcase"><span>Current ship</span><ShipIcon size={220} /><h3>Classic ship</h3><span className="cosmetic-equipped">Equipped</span></div>
      <div className="loadout-inventory">
        <h3>Ship</h3><article className="loadout-item"><ShipIcon size={64} /><div><h4>Classic ship</h4><p>Original colors</p></div><span className="cosmetic-equipped">Equipped</span></article>
        <h3>Trail</h3><article className="loadout-item"><span className="loadout-default-trail" aria-hidden="true">—</span><div><h4>Default</h4><p>No cosmetic trail</p></div><span className="cosmetic-equipped">Equipped</span></article>
        <p className="loadout-coming-soon">More ship colors and trails are coming soon to the Shop.</p>
      </div>
    </div>
  </section>;
}
