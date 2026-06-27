import "./App.css";

export function App() {
  return (
    <main className="app-shell">
      <section className="status-panel" aria-labelledby="app-title">
        <p className="eyebrow">SYSTEM READY</p>
        <h1 id="app-title">Tactical Circuit</h1>
        <p className="description">Robot programming battle simulator</p>
      </section>
    </main>
  );
}
