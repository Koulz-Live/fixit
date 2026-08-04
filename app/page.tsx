"use client";

import { useMemo, useState } from "react";

type Domain = { key: string; name: string; kicker: string; color: string; items: string[] };

const domains: Domain[] = [
  { key: "B", name: "Business", kicker: "Strategy & value", color: "#e85d3f", items: ["Operating model", "Capability map", "Value streams", "Governance & KPIs"] },
  { key: "D", name: "Data", kicker: "Truth & knowledge", color: "#e7b252", items: ["Supabase PostgreSQL", "RLS & multi-tenancy", "BDAT context stores", "Audit & provenance"] },
  { key: "A", name: "Application", kicker: "Services & experience", color: "#4fae8c", items: ["React + TypeScript", "Node API facade", "RAG & SLM adapter", "Copilot MCP server"] },
  { key: "T", name: "Technology", kicker: "Platform & delivery", color: "#6f91d9", items: ["Managed serverless", "Vercel + Supabase", "GitHub CI/CD", "Observability"] },
];

const roadmap = [
  { phase: "01", name: "Architecture runway", weeks: "Weeks 1–3", status: "Foundation", note: "Repository, governance, identity and policy baseline" },
  { phase: "02", name: "Product platform", weeks: "Weeks 4–8", status: "Build", note: "API contracts, tenant controls and transaction boundaries" },
  { phase: "03", name: "Knowledge plane", weeks: "Weeks 9–12", status: "Enable", note: "BDAT RAG, retrieval policy and Copilot context" },
  { phase: "04", name: "Runtime assurance", weeks: "Weeks 13–16", status: "Prove", note: "Evidence, recovery, WAF/SIEM and production gates" },
];

const gates = [
  { id: "G1", name: "Architecture intent", owner: "Architecture Board", evidence: "Vision, scope and approved contract", state: "Ready" },
  { id: "G2", name: "Identity & tenancy", owner: "IAM / PAM Owner", evidence: "RLS, AAL and cross-tenant negative tests", state: "Required" },
  { id: "G3", name: "Transaction integrity", owner: "Engineering Lead", evidence: "Atomic state, idempotency and outbox tests", state: "Required" },
  { id: "G4", name: "AI context assurance", owner: "Knowledge Steward", evidence: "Approved sources, citations and retrieval evaluation", state: "Conditional" },
  { id: "G5", name: "Runtime evidence", owner: "Security Operations", evidence: "Telemetry, restore exercise and release evidence", state: "Required" },
];

const stack = [
  ["Experience", "React · TypeScript", "Accessible application shell, progressive enhancement and device-local L1 cache."],
  ["Service", "Node API facade", "Versioned contracts, controlled orchestration, stable errors and audit events."],
  ["Authority", "Supabase", "Authentication, PostgreSQL, RLS, Storage, Realtime and pgvector."],
  ["Knowledge", "RAG · MCP · SLM", "Permission-aware context, citations and provider-neutral model adaptation."],
  ["Delivery", "GitHub · Vercel", "Human-reviewed changes, evidence gates and managed serverless runtime."],
];

const principles = [
  ["P01", "Business outcome first", "Every choice traces to value, capability or measurable risk reduction."],
  ["P04", "One authoritative data plane", "Supabase PostgreSQL is truth; local caches remain disposable."],
  ["P08", "RAG before fine-tuning", "Improve retrieval and context engineering before changing model weights."],
  ["P09", "Human accountability for AI", "Named people approve material decisions, releases and outputs."],
  ["P18", "Tenant isolation is structural", "Keys, indexes, APIs, RLS and negative tests enforce tenant scope."],
  ["P25", "Readiness is evidence-based", "No production claim without current test, telemetry or restore evidence."],
];

const trust = [
  ["T", "Trace", "Link outcome, change and evidence"],
  ["R", "Risk", "Classify risk and treatment"],
  ["U", "Use", "Reuse approved building blocks"],
  ["S", "Secure", "Apply least privilege by design"],
  ["T", "Test", "Prove controls at the right tier"],
];

export default function Home() {
  const [activeDomain, setActiveDomain] = useState(0);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<"overview" | "principles" | "controls" | "roadmap">("overview");
  const filtered = useMemo(() => principles.filter((p) => p.join(" ").toLowerCase().includes(query.toLowerCase())), [query]);
  const domain = domains[activeDomain];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Architecture office home"><span className="brandmark">EA</span><span>Architecture Office</span></a>
        <nav aria-label="Primary navigation">
          {(["overview", "principles", "controls", "roadmap"] as const).map((item) => <button key={item} className={panel === item ? "nav-active" : ""} onClick={() => setPanel(item)}>{item}</button>)}
        </nav>
        <a className="access-link" href="/marketplace">Open marketplace ↗</a>
        <div className="version"><span /> Enterprise baseline · v1.2</div>
      </header>

      <section id="top" className="hero">
        <div className="hero-copy">
          <div className="eyebrow">TOGAF-aligned reference architecture</div>
          <h1>Build digital products<br />that are <em>ready to govern.</em></h1>
          <p>A reusable enterprise foundation for secure greenfield delivery, trusted AI context and evidence-led execution.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => { setPanel("overview"); document.getElementById("architecture")?.scrollIntoView({ behavior: "smooth" }); }}>Explore the architecture <span>↘</span></button>
            <button className="secondary" onClick={() => { setPanel("roadmap"); document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" }); }}>View execution plan</button>
          </div>
          <div className="hero-metrics">
            <div><strong>25</strong><span>architecture principles</span></div>
            <div><strong>38</strong><span>acceptance criteria</span></div>
            <div><strong>4</strong><span>separated BDAT domains</span></div>
          </div>
        </div>
        <div className="hero-visual" aria-label="TRUST-BDAT architecture model">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="core"><span>TRUST</span><strong>BDAT</strong><small>governed delivery core</small></div>
          {domains.map((d, i) => <button key={d.key} onClick={() => setActiveDomain(i)} className={`satellite sat-${i} ${activeDomain === i ? "selected" : ""}`} style={{ "--accent": d.color } as React.CSSProperties}><b>{d.key}</b><span>{d.name}</span></button>)}
          <div className="signal signal-a" /><div className="signal signal-b" /><div className="signal signal-c" />
        </div>
      </section>

      <section id="workspace" className="workspace">
        <div className="section-head">
          <div><span className="eyebrow">Architecture workspace</span><h2>{panel === "overview" ? "One foundation. Four connected domains." : panel === "principles" ? "Principles that shape every decision." : panel === "controls" ? "Release confidence comes from evidence." : "A practical path to governed production."}</h2></div>
          <p>{panel === "overview" ? "Select a domain to inspect its foundational building blocks and authority boundaries." : panel === "principles" ? "Search the core principles distilled from the enterprise reference." : panel === "controls" ? "Inspect the enterprise gates, accountable owners and evidence expected before production." : "Sequence capability, control and evidence so delivery can move with confidence."}</p>
        </div>

        {panel === "overview" && <div id="architecture" className="architecture-grid">
          <div className="domain-tabs" role="tablist" aria-label="Architecture domains">
            {domains.map((d, i) => <button role="tab" aria-selected={activeDomain === i} key={d.key} onClick={() => setActiveDomain(i)} className={activeDomain === i ? "active" : ""}><span style={{ background: d.color }}>{d.key}</span><div><strong>{d.name}</strong><small>{d.kicker}</small></div><i>0{i + 1}</i></button>)}
          </div>
          <div className="domain-detail" style={{ "--domain": domain.color } as React.CSSProperties}>
            <div className="detail-top"><span>{domain.key}</span><div><small>TOGAF DOMAIN</small><h3>{domain.name} architecture</h3></div><b>0{activeDomain + 1} / 04</b></div>
            <div className="building-blocks">{domain.items.map((item, i) => <div key={item}><span>0{i + 1}</span><strong>{item}</strong><i>↗</i></div>)}</div>
            <div className="authority"><span>AUTHORITATIVE RULE</span><p>{activeDomain === 1 ? "PostgreSQL holds enterprise truth. IndexedDB is a scoped, expiring L1 cache—not a shadow system of record." : activeDomain === 2 ? "Clients never make privileged policy decisions. Material actions cross a versioned, authorised API boundary." : activeDomain === 0 ? "Named humans remain accountable for business outcomes, material decisions and AI-assisted work." : "Managed services are the default. Runtime claims require current operational evidence."}</p></div>
          </div>
        </div>}

        {panel === "principles" && <div className="principles-panel">
          <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search architecture principles…" /></label>
          <div className="principle-list">{filtered.map(([id, name, text]) => <article key={id}><span>{id}</span><h3>{name}</h3><p>{text}</p><i>↗</i></article>)}</div>
        </div>}

        {panel === "controls" && <div className="controls-panel">
          <div className="readiness-strip">
            <div><span>CONTROL POSTURE</span><strong>Evidence-led</strong></div>
            <div><span>RELEASE GATES</span><strong>5</strong></div>
            <div><span>ACCEPTANCE TESTS</span><strong>38</strong></div>
            <div><span>ACCOUNTABILITY</span><strong>Human</strong></div>
          </div>
          <div className="gate-table">
            <div className="gate-row gate-header"><span>Gate</span><span>Control area</span><span>Accountable owner</span><span>Minimum evidence</span><span>Status</span></div>
            {gates.map((g) => <article className="gate-row" key={g.id}><span>{g.id}</span><strong>{g.name}</strong><span>{g.owner}</span><p>{g.evidence}</p><i className={`state-${g.state.toLowerCase()}`}>{g.state}</i></article>)}
          </div>
          <div className="risk-callout"><span>Release blocker rule</span><p>A critical or high finding, expired risk acceptance, unapproved deviation or untested recovery dependency prevents a production-readiness claim.</p><b>RB-01</b></div>
        </div>}

        {panel === "roadmap" && <div className="roadmap-panel">{roadmap.map((r, i) => <article key={r.phase}><div className="phase-no">{r.phase}</div><div><span>{r.status}</span><h3>{r.name}</h3><p>{r.note}</p></div><strong>{r.weeks}</strong><div className="roadline"><i style={{ width: `${25 * (i + 1)}%` }} /></div></article>)}</div>}
      </section>

      <section className="stack-section">
        <div className="stack-intro"><span className="eyebrow">Approved technology baseline</span><h2>Clear boundaries.<br />Portable building blocks.</h2><p>The stack is opinionated where consistency matters and adaptable where evidence supports a better choice.</p></div>
        <div className="stack-list">{stack.map(([layer, tech, note], i) => <article key={layer}><span>0{i + 1}</span><div><small>{layer}</small><h3>{tech}</h3></div><p>{note}</p><i>↗</i></article>)}</div>
        <div className="constraint-band"><span>MANAGED-SERVICE FIRST</span><i /><span>NO DJANGO</span><i /><span>NO CONTAINERS</span><i /><span>API-FIRST</span><i /><span>DENY BY DEFAULT</span></div>
      </section>

      <section className="guardrail">
        <div className="guardrail-copy"><span className="eyebrow light">Secure engineering guardrail</span><h2>TRUST is how change moves.<br />BDAT is where impact lands.</h2><p>Every material change connects intent, risk, architecture, controls, tests and named human approval in one traceable delivery record.</p><button onClick={() => setPanel("principles")}>Review the guardrails <span>→</span></button></div>
        <div className="trust-stack">{trust.map(([letter, title, note], i) => <div key={`${letter}${i}`}><b>{letter}</b><span><strong>{title}</strong><small>{note}</small></span><i>0{i + 1}</i></div>)}</div>
      </section>

      <section className="decision">
        <span>Architecture decision</span><blockquote>“AI assists. Named humans approve material decisions, releases and authoritative outputs.”</blockquote><div><span>Governed by design</span><i /><span>Evidence by default</span><i /><span>Responsible stewardship</span></div>
      </section>

      <footer><div className="brand"><span className="brandmark">EA</span><span>Enterprise Greenfield<br />Reference Architecture</span></div><p>Internal architecture reference · Draft for Architecture Board approval</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
