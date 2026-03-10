import { useState, useMemo } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
const DAYS_ALL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const REGISTER_URL = "https://docs.google.com/forms/d/e/1FAIpQLSer19EGyzUkcciNvr0bLgCv1YV104nFslyncd6N-SPAkbmxHQ/viewform?usp=header";
const COLORS = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16"];

function parseTime(t) {
  const [h,m] = t.split(":").map(Number);
  return h * 60 + m;
}
function formatTime(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${m.toString().padStart(2,"0")} ${ampm}`;
}
function generateSlots(start, end, period, teaStart, teaEnd, lunchStart, lunchEnd) {
  const slots = [];
  let cur = parseTime(start);
  const endM = parseTime(end);
  const teaS = parseTime(teaStart), teaE = parseTime(teaEnd);
  const lunS = parseTime(lunchStart), lunE = parseTime(lunchEnd);
  let idx = 0;
  while (cur < endM) {
    // Insert tea break
    if (cur === teaS) {
      slots.push({ start: teaS, end: teaE, label: `${formatTime(teaS)}–${formatTime(teaE)}`, type: "tea" });
      cur = teaE; continue;
    }
    // Insert lunch break
    if (cur === lunS) {
      slots.push({ start: lunS, end: lunE, label: `${formatTime(lunS)}–${formatTime(lunE)}`, type: "lunch" });
      cur = lunE; continue;
    }
    // Class period — stop before next break or end
    const nextBreak = [teaS, lunS, endM].filter(t => t > cur).sort((a,b)=>a-b)[0];
    const slotEnd = Math.min(cur + period, nextBreak);
    if (slotEnd - cur < period * 0.8) { cur = nextBreak; continue; } // skip tiny leftover
    slots.push({ start: cur, end: slotEnd, label: `${formatTime(cur)}–${formatTime(slotEnd)}`, type: "class", index: idx++ });
    cur = slotEnd;
  }
  return slots;
}

function parseCSV(text) {
  const lines = text.trim().split("\n").filter(l => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(s => s.trim());
    if (cols.length < 4) continue;
    rows.push({
      faculty: cols[0], subject: cols[1],
      relevance: parseFloat(cols[2]) || 1,
      hoursPerWeek: parseInt(cols[3]) || 3,
      type: (cols[4] || "T").toUpperCase() === "P" ? "P" : "T",
      consecutive: parseInt(cols[5]) || 2,
    });
  }
  return rows;
}

function generateTimetable(subjects, days, slots) {
  const classSlots = slots.filter(s => s.type === "class");
  const grid = {};
  days.forEach(d => { grid[d] = {}; classSlots.forEach(s => { grid[d][s.index] = null; }); });

  // Sort: labs first, then by relevance desc
  const sorted = [...subjects].sort((a,b) => {
    if (a.type === "P" && b.type !== "P") return -1;
    if (b.type === "P" && a.type !== "P") return 1;
    return b.relevance - a.relevance;
  });

  const remaining = sorted.map(s => ({ ...s, left: s.hoursPerWeek }));

  // Assign labs (consecutive)
  remaining.filter(s => s.type === "P").forEach(sub => {
    let placed = 0;
    for (const day of days) {
      if (placed >= sub.left) break;
      const indices = classSlots.map(s => s.index);
      for (let i = 0; i <= indices.length - sub.consecutive; i++) {
        const block = indices.slice(i, i + sub.consecutive);
        if (block.every(idx => !grid[day][idx])) {
          block.forEach(idx => { grid[day][idx] = { ...sub, isLab: true }; });
          placed += sub.consecutive;
          break;
        }
      }
    }
  });

  // Assign theory
  remaining.filter(s => s.type === "T").forEach(sub => {
    let placed = 0;
    for (const day of days) {
      for (const slot of classSlots) {
        if (placed >= sub.left) break;
        if (!grid[day][slot.index]) {
          grid[day][slot.index] = { ...sub, isLab: false };
          placed++;
        }
      }
    }
  });

  return grid;
}

// ── sub-components ────────────────────────────────────────────────────────────
function LandingPage({ onEnter }) {
  return (
    <div style={{ fontFamily: "'Segoe UI',sans-serif", background: "#0f0c29", minHeight: "100vh", color: "#fff" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)", padding: "0 20px 60px" }}>
        <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 40px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
          <img src="/logo.png" alt="Tymr" style={{ height:40, width:40, borderRadius:8, objectFit:"cover" }} />
          <div style={{ display:"flex", gap:10 }}>
            <a href={REGISTER_URL} target="_blank" rel="noreferrer" style={{ background:"transparent", color:"#a5b4fc", border:"1px solid #6366f1", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontWeight:600, textDecoration:"none", fontSize:14 }}>Register</a>
            <button onClick={onEnter} style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", cursor:"pointer", fontWeight:600 }}>Launch App →</button>
          </div>
        </nav>
        <div style={{ textAlign:"center", padding:"80px 20px 40px" }}>
          <div style={{ display:"inline-block", background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", borderRadius:20, padding:"6px 16px", fontSize:13, marginBottom:20, color:"#a5b4fc" }}>🎓 Smart Academic Scheduling</div>
          <h1 style={{ fontSize:"clamp(36px,6vw,72px)", fontWeight:900, lineHeight:1.1, marginBottom:20 }}>
            Build Perfect<br/>
            <span style={{ background:"linear-gradient(90deg,#818cf8,#c084fc,#f472b6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Timetables Instantly</span>
          </h1>
          <p style={{ color:"#94a3b8", fontSize:18, maxWidth:520, margin:"0 auto 40px" }}>Upload your faculty & subject CSV, configure your schedule, and generate a professional timetable in seconds.</p>
          <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
            <a href={REGISTER_URL} target="_blank" rel="noreferrer" style={{ background:"transparent", color:"#a5b4fc", border:"2px solid #6366f1", borderRadius:12, padding:"16px 32px", fontSize:18, fontWeight:700, textDecoration:"none" }}>Register Free →</a>
            <button onClick={onEnter} style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:12, padding:"16px 40px", fontSize:18, fontWeight:700, cursor:"pointer", boxShadow:"0 0 40px rgba(99,102,241,0.4)" }}>Launch App →</button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding:"60px 20px", background:"#0f172a" }}>
        <h2 style={{ textAlign:"center", fontSize:32, fontWeight:800, marginBottom:40 }}>Powerful Features</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:20, maxWidth:1000, margin:"0 auto" }}>
          {[
            ["📤","CSV Upload","Upload faculty, subject & relevance data easily"],
            ["🧠","Smart Scheduling","AI-like relevance-based slot assignment"],
            ["🔬","Lab Support","Consecutive period scheduling for practicals"],
            ["📥","Export","Download timetable as CSV or printable PDF"],
            ["☕","Break Management","Auto-insert tea & lunch breaks"],
            ["📅","Flexible Days","Mon–Sat with custom start/end times"],
          ].map(([icon,title,desc]) => (
            <div key={title} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>{icon}</div>
              <div style={{ fontWeight:700, marginBottom:8 }}>{title}</div>
              <div style={{ color:"#94a3b8", fontSize:14 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ padding:"60px 20px", background:"#0f0c29" }}>
        <h2 style={{ textAlign:"center", fontSize:32, fontWeight:800, marginBottom:8 }}>Simple Pricing</h2>
        <p style={{ textAlign:"center", color:"#94a3b8", marginBottom:40 }}>Choose a plan that works for you</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:20, maxWidth:960, margin:"0 auto" }}>
          {[
            { name:"Free Trial", price:"₹0", period:"/14 days", color:"#64748b", features:["5 timetables","Basic attendance","2 exam schedules","Email support"] },
            { name:"Starter", price:"₹99", period:"/month", color:"#0ea5e9", features:["Unlimited timetables","Advanced attendance","10 exam schedules","Priority email","5 users","CSV/PDF export"] },
            { name:"Professional", price:"₹299", period:"/month", color:"#6366f1", popular:true, features:["Everything in Starter","Unlimited exams","Advanced seating","20 users","Custom branding","Analytics & reports","API access","Phone support"] },
            { name:"Enterprise", price:"₹499", period:"/month", color:"#8b5cf6", features:["Everything in Pro","Unlimited users","Dedicated manager","Custom integrations","On-premise option","24/7 support","Training"] },
          ].map(p => (
            <div key={p.name} style={{ background: p.popular ? "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))" : "rgba(255,255,255,0.04)", border:`2px solid ${p.popular ? "#6366f1" : "rgba(255,255,255,0.08)"}`, borderRadius:16, padding:24, position:"relative" }}>
              {p.popular && <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:20, padding:"4px 14px", fontSize:12, fontWeight:700 }}>⭐ Most Popular</div>}
              <div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>{p.name}</div>
              <div style={{ fontSize:32, fontWeight:900, color:p.color }}>{p.price}<span style={{ fontSize:14, color:"#94a3b8" }}>{p.period}</span></div>
              <ul style={{ listStyle:"none", padding:0, margin:"16px 0", color:"#94a3b8", fontSize:14 }}>
                {p.features.map(f => <li key={f} style={{ padding:"4px 0" }}>✓ {f}</li>)}
              </ul>
              <a href={REGISTER_URL} target="_blank" rel="noreferrer" style={{ display:"block", textAlign:"center", background:`linear-gradient(135deg,${p.color},${p.color}aa)`, color:"#fff", borderRadius:8, padding:"10px", textDecoration:"none", fontWeight:600, fontSize:14 }}>{p.price==="₹0"?"Register Free":"Subscribe Now"}</a>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background:"#020617", padding:"40px 20px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth:960, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:32 }}>
          <div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <img src="/logo.png" alt="Tymr" style={{ height:48, width:48, borderRadius:10, objectFit:"cover" }} />
              <div style={{ fontSize:24, fontWeight:800, background:"linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Tymr</div>
            </div>
            <p style={{ color:"#64748b", fontSize:14 }}>Smart academic scheduling for modern institutions.</p>
          </div>
          <div>
            <div style={{ fontWeight:700, marginBottom:12 }}>Contact Us</div>
            <div style={{ color:"#94a3b8", fontSize:14, lineHeight:2 }}>
              📞 +91 97908 18436<br/>
              ✉️ support@tymr.in<br/>
              📍 Chennai, Tamil Nadu, India
            </div>
          </div>
          <div>
            <div style={{ fontWeight:700, marginBottom:12 }}>Quick Links</div>
            <div style={{ color:"#94a3b8", fontSize:14, lineHeight:2, cursor:"pointer" }}>
              <div onClick={onEnter}>Timetable Maker</div>
              <div>Exam Scheduler</div>
              <div>Attendance Tracker</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign:"center", color:"#334155", fontSize:12, marginTop:32 }}>© 2025 Tymr. All rights reserved.</div>
      </footer>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("landing");
  const [tab, setTab] = useState("timetable");

  // Timetable state
  const [subjects, setSubjects] = useState([]);
  const [csvError, setCsvError] = useState("");
  const [config, setConfig] = useState({ days: ["Monday","Tuesday","Wednesday","Thursday","Friday"], start:"08:30", end:"16:00", period:50, teaAfter:2, lunchAfter:2, includeSat:false, teaStart:"10:20", teaEnd:"10:40", lunchStart:"12:30", lunchEnd:"13:15" });
  const [timetable, setTimetable] = useState(null);
  const [generated, setGenerated] = useState(false);

  // Exam state
  const [exams, setExams] = useState([]);
  const [examForm, setExamForm] = useState({ title:"", date:"", time:"09:00", duration:3, hall:"Hall A", rows:10, cols:10, seating:"alternate" });
  const [viewExam, setViewExam] = useState(null);

  const slots = useMemo(() => generateSlots(config.start, config.end, config.period, config.teaStart, config.teaEnd, config.lunchStart, config.lunchEnd), [config]);
  const classSlots = slots.filter(s => s.type === "class");

  const subjectColors = useMemo(() => {
    const map = {};
    subjects.forEach((s, i) => { map[s.subject] = COLORS[i % COLORS.length]; });
    return map;
  }, [subjects]);

  function handleCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (!parsed.length) { setCsvError("No valid rows found. Check your CSV format."); return; }
        setSubjects(parsed); setCsvError(""); setGenerated(false); setTimetable(null);
      } catch { setCsvError("Failed to parse CSV."); }
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = "Faculty Name,Subject Name,Relevance Score,Hours Per Week,Type (T/P),Consecutive Periods (Lab only)\nDr. Smith,Mathematics,5,4,T,\nProf. Jones,Physics Lab,4,3,P,3\nDr. Patel,Chemistry,3,3,T,\n";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = "tymr_template.csv"; a.click();
  }

  function handleGenerate() {
    if (!subjects.length) return;
    const days = config.includeSat ? [...config.days.filter(d => d!=="Saturday"), "Saturday"] : config.days.filter(d => d!=="Saturday");
    const grid = generateTimetable(subjects, days, slots);
    setTimetable({ grid, days, slots });
    setGenerated(true);
  }

  function downloadCSV() {
    if (!timetable) return;
    const { grid, days, slots } = timetable;
    const classS = slots.filter(s => s.type === "class");
    const header = ["Day", ...slots.map(s => s.label)].join(",");
    const rows = days.map(d => {
      const cells = slots.map(s => {
        if (s.type === "tea") return "☕ Tea Break";
        if (s.type === "lunch") return "🍽 Lunch Break";
        const c = grid[d][s.index];
        return c ? `"${c.subject} (${c.faculty})"` : "";
      });
      return [d, ...cells].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = "tymr_timetable.csv"; a.click();
  }

  function downloadPDF() {
    if (!timetable) return;
    const { grid, days, slots } = timetable;
    let html = `<html><head><style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:20px}
      h2{color:#4f46e5;text-align:center}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:center}
      th{background:#4f46e5;color:#fff}
      .tea{background:#fef3c7}.lunch{background:#d1fae5}.lab{background:#ede9fe}.empty{color:#999}
    </style></head><body><h2>Tymr – Generated Timetable</h2><table>
    <tr><th>Day</th>${slots.map(s=>`<th>${s.label}</th>`).join("")}</tr>`;
    days.forEach(d => {
      html += `<tr><td><b>${d}</b></td>`;
      slots.forEach(s => {
        if (s.type==="tea") html += `<td class="tea">☕ Tea</td>`;
        else if (s.type==="lunch") html += `<td class="lunch">🍽 Lunch</td>`;
        else { const c = grid[d][s.index]; html += c ? `<td class="${c.isLab?"lab":""}">${c.subject}<br/><small>${c.faculty}</small></td>` : `<td class="empty">—</td>`; }
      });
      html += `</tr>`;
    });
    html += `</table></body></html>`;
    const w = window.open("","_blank"); w.document.write(html); w.document.close(); w.print();
  }

  function addExam() {
    if (!examForm.title || !examForm.date) return;
    const rolls = [];
    for (let r = 1; r <= examForm.rows; r++) for (let c = 1; c <= examForm.cols; c++) rolls.push(`R${String(r).padStart(2,"0")}C${String(c).padStart(2,"0")}`);
    setExams(prev => [...prev, { ...examForm, id: Date.now(), rolls }]);
    setExamForm({ title:"", date:"", time:"09:00", duration:3, hall:"Hall A", rows:10, cols:10, seating:"alternate" });
  }

  if (page === "landing") return <LandingPage onEnter={() => setPage("app")} />;

  // ── App Shell ──
  const navItems = [
    { id:"timetable", label:"📅 Timetable" },
    { id:"exam", label:"📝 Exam Schedule" },
    { id:"attendance", label:"✅ Attendance" },
  ];

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", minHeight:"100vh", background:"#0f172a", color:"#e2e8f0", display:"flex" }}>
      {/* Sidebar */}
      <aside style={{ width:220, background:"#1e293b", borderRight:"1px solid #334155", padding:"24px 0", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div onClick={() => setPage("landing")} style={{ padding:"0 20px 24px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
          <img src="/logo.png" alt="Tymr" style={{ height:36, width:36, borderRadius:8, objectFit:"cover" }} />
          <span style={{ fontSize:20, fontWeight:800, background:"linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Tymr</span>
        </div>
        {navItems.map(n => (
          <div key={n.id} onClick={() => setTab(n.id)} style={{ padding:"12px 20px", cursor:"pointer", background: tab===n.id ? "rgba(99,102,241,0.15)" : "transparent", borderLeft: tab===n.id ? "3px solid #6366f1" : "3px solid transparent", color: tab===n.id ? "#818cf8" : "#94a3b8", fontWeight: tab===n.id ? 600 : 400 }}>{n.label}</div>
        ))}
        <div style={{ marginTop:"auto", padding:"16px 20px", borderTop:"1px solid #334155" }}>
          <div style={{ fontSize:12, color:"#64748b" }}>Free Trial</div>
          <a href="https://pmny.in/xJuAmT6XgxX7" target="_blank" rel="noreferrer" style={{ display:"block", marginTop:8, textAlign:"center", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", borderRadius:8, padding:"8px", textDecoration:"none", fontSize:13, fontWeight:600 }}>Upgrade →</a>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, padding:24, overflowY:"auto" }}>

        {/* ── TIMETABLE TAB ── */}
        {tab === "timetable" && (
          <div>
            <h2 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>📅 Timetable Maker</h2>
            <p style={{ color:"#64748b", marginBottom:24 }}>Upload your CSV, configure schedule, and generate.</p>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:20, marginBottom:24 }}>
              {/* Upload */}
              <div style={{ background:"#1e293b", borderRadius:16, padding:24, border:"1px solid #334155" }}>
                <h3 style={{ fontWeight:700, marginBottom:16 }}>1. Upload CSV</h3>
                <button onClick={downloadTemplate} style={{ background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid #6366f1", borderRadius:8, padding:"8px 16px", cursor:"pointer", marginBottom:12, fontSize:13, fontWeight:600 }}>⬇ Download Template</button>
                <div style={{ border:"2px dashed #334155", borderRadius:12, padding:20, textAlign:"center" }}>
                  <input type="file" accept=".csv" onChange={handleCSV} style={{ display:"none" }} id="csvInput" />
                  <label htmlFor="csvInput" style={{ cursor:"pointer", color:"#6366f1", fontWeight:600 }}>📂 Click to Upload CSV</label>
                </div>
                {csvError && <div style={{ color:"#ef4444", fontSize:13, marginTop:8 }}>{csvError}</div>}
                {subjects.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ color:"#10b981", fontSize:13, fontWeight:600, marginBottom:8 }}>✓ {subjects.length} subjects loaded</div>
                    <div style={{ maxHeight:140, overflowY:"auto" }}>
                      {subjects.map((s,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0", borderBottom:"1px solid #1e293b", fontSize:13 }}>
                          <div style={{ width:10, height:10, borderRadius:"50%", background:subjectColors[s.subject], flexShrink:0 }} />
                          <span style={{ flex:1 }}>{s.subject}</span>
                          <span style={{ color:"#64748b" }}>{s.faculty}</span>
                          <span style={{ background: s.type==="P" ? "#ede9fe22" : "#dbeafe22", color: s.type==="P" ? "#a78bfa" : "#60a5fa", borderRadius:4, padding:"1px 6px", fontSize:11 }}>{s.type==="P"?"Lab":"Theory"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Config */}
              <div style={{ background:"#1e293b", borderRadius:16, padding:24, border:"1px solid #334155" }}>
                <h3 style={{ fontWeight:700, marginBottom:16 }}>2. Configure Schedule</h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {[["Start Time","start","time"],["End Time","end","time"],["Period (mins)","period","number"]].map(([label,key,type]) => (
                    <div key={key}>
                      <label style={{ fontSize:12, color:"#94a3b8", display:"block", marginBottom:4 }}>{label}</label>
                      <input type={type} value={config[key]} onChange={e => setConfig(c => ({ ...c, [key]: type==="number" ? parseInt(e.target.value)||1 : e.target.value }))}
                        style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                    </div>
                  ))}
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input type="checkbox" id="sat" checked={config.includeSat} onChange={e => setConfig(c => ({ ...c, includeSat: e.target.checked }))} />
                    <label htmlFor="sat" style={{ fontSize:13, cursor:"pointer" }}>Include Saturday</label>
                  </div>
                </div>
                {/* Break times */}
                <div style={{ marginTop:12, background:"#0f172a", borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:12, color:"#fbbf24", fontWeight:600, marginBottom:8 }}>☕ Tea Break</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[["From","teaStart"],["To","teaEnd"]].map(([lbl,key]) => (
                      <div key={key}>
                        <label style={{ fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 }}>{lbl}</label>
                        <input type="time" value={config[key]} onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                          style={{ width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:8, padding:"7px 10px", color:"#e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>
                    Duration: {Math.round((parseTime(config.teaEnd) - parseTime(config.teaStart)))} mins
                  </div>
                </div>
                <div style={{ marginTop:10, background:"#0f172a", borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:12, color:"#34d399", fontWeight:600, marginBottom:8 }}>🍽 Lunch Break</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[["From","lunchStart"],["To","lunchEnd"]].map(([lbl,key]) => (
                      <div key={key}>
                        <label style={{ fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 }}>{lbl}</label>
                        <input type="time" value={config[key]} onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                          style={{ width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:8, padding:"7px 10px", color:"#e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>
                    Duration: {Math.round((parseTime(config.lunchEnd) - parseTime(config.lunchStart)))} mins
                  </div>
                </div>
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:12, color:"#94a3b8", marginBottom:6 }}>Schedule Preview ({slots.length} slots)</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {slots.map((s,i) => (
                      <span key={i} style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background: s.type==="tea"?"#78350f33": s.type==="lunch"?"#14532d33":"#1e3a5f", color: s.type==="tea"?"#fbbf24": s.type==="lunch"?"#34d399":"#93c5fd" }}>{s.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button onClick={handleGenerate} disabled={!subjects.length} style={{ background: subjects.length ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#334155", color:"#fff", border:"none", borderRadius:12, padding:"14px 32px", fontSize:16, fontWeight:700, cursor: subjects.length ? "pointer" : "not-allowed", marginBottom:24 }}>
              ⚡ Generate Timetable
            </button>

            {/* Grid */}
            {generated && timetable && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <h3 style={{ fontWeight:700 }}>Generated Timetable</h3>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={downloadCSV} style={{ background:"#0ea5e9", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:600, fontSize:13 }}>⬇ CSV</button>
                    <button onClick={downloadPDF} style={{ background:"#6366f1", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:600, fontSize:13 }}>🖨 Print/PDF</button>
                  </div>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ borderCollapse:"collapse", fontSize:12, minWidth:600 }}>
                    <thead>
                      <tr>
                        <th style={{ background:"#1e293b", border:"1px solid #334155", padding:"10px 14px", textAlign:"left", minWidth:90 }}>Day</th>
                        {timetable.slots.map((s,i) => (
                          <th key={i} style={{ background: s.type==="tea"?"#78350f44": s.type==="lunch"?"#14532d44":"#1e3a5f", border:"1px solid #334155", padding:"8px 10px", minWidth:100, whiteSpace:"nowrap", color: s.type==="tea"?"#fbbf24": s.type==="lunch"?"#34d399":"#93c5fd" }}>{s.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timetable.days.map(day => (
                        <tr key={day}>
                          <td style={{ background:"#1e293b", border:"1px solid #334155", padding:"8px 14px", fontWeight:600 }}>{day.slice(0,3)}</td>
                          {timetable.slots.map((s,i) => {
                            if (s.type==="tea") return <td key={i} style={{ background:"#78350f33", border:"1px solid #334155", padding:8, textAlign:"center", color:"#fbbf24", fontSize:11 }}>☕ Tea</td>;
                            if (s.type==="lunch") return <td key={i} style={{ background:"#14532d33", border:"1px solid #334155", padding:8, textAlign:"center", color:"#34d399", fontSize:11 }}>🍽 Lunch</td>;
                            const cell = timetable.grid[day][s.index];
                            if (!cell) return <td key={i} style={{ border:"1px solid #334155", padding:8, textAlign:"center", color:"#334155" }}>—</td>;
                            const bg = subjectColors[cell.subject] + "22";
                            const fg = subjectColors[cell.subject];
                            return (
                              <td key={i} style={{ border:"1px solid #334155", padding:"6px 8px", background:bg, textAlign:"center" }}>
                                <div style={{ fontWeight:700, color:fg, fontSize:11 }}>{cell.subject}</div>
                                <div style={{ color:"#94a3b8", fontSize:10 }}>{cell.faculty}</div>
                                {cell.isLab && <div style={{ color:"#a78bfa", fontSize:9 }}>🔬 Lab</div>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Legend */}
                <div style={{ marginTop:16, display:"flex", flexWrap:"wrap", gap:8 }}>
                  {subjects.map(s => (
                    <div key={s.subject} style={{ display:"flex", alignItems:"center", gap:6, background:"#1e293b", borderRadius:20, padding:"4px 12px", fontSize:12 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:subjectColors[s.subject] }} />
                      {s.subject} {s.type==="P"&&<span style={{ color:"#a78bfa", fontSize:10 }}>(Lab)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EXAM TAB ── */}
        {tab === "exam" && !viewExam && (
          <div>
            <h2 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>📝 Exam Schedule</h2>
            <p style={{ color:"#64748b", marginBottom:24 }}>Create exam timetables with seating arrangements.</p>
            <div style={{ background:"#1e293b", borderRadius:16, padding:24, border:"1px solid #334155", marginBottom:24, maxWidth:700 }}>
              <h3 style={{ fontWeight:700, marginBottom:16 }}>Create New Exam</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[["Exam Title","title","text"],["Date","date","date"],["Time","time","time"],["Duration (hrs)","duration","number"],["Exam Hall","hall","text"]].map(([lbl,key,type]) => (
                  <div key={key}>
                    <label style={{ fontSize:12, color:"#94a3b8", display:"block", marginBottom:4 }}>{lbl}</label>
                    <input type={type} value={examForm[key]} onChange={e => setExamForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:12, color:"#94a3b8", display:"block", marginBottom:4 }}>Seating</label>
                  <select value={examForm.seating} onChange={e => setExamForm(f => ({ ...f, seating: e.target.value }))}
                    style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13 }}>
                    <option value="alternate">Alternate</option>
                    <option value="consecutive">Consecutive</option>
                    <option value="random">Random</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#94a3b8", display:"block", marginBottom:4 }}>Rows</label>
                  <input type="number" min={1} max={20} value={examForm.rows} onChange={e => setExamForm(f => ({ ...f, rows: parseInt(e.target.value)||1 }))}
                    style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#94a3b8", display:"block", marginBottom:4 }}>Columns</label>
                  <input type="number" min={1} max={20} value={examForm.cols} onChange={e => setExamForm(f => ({ ...f, cols: parseInt(e.target.value)||1 }))}
                    style={{ width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                </div>
              </div>
              <button onClick={addExam} style={{ marginTop:16, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:10, padding:"12px 28px", fontWeight:700, cursor:"pointer" }}>+ Add Exam</button>
            </div>

            {exams.length > 0 && (
              <div>
                <h3 style={{ fontWeight:700, marginBottom:12 }}>Scheduled Exams</h3>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
                  {exams.map(ex => (
                    <div key={ex.id} style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:16, padding:20 }}>
                      <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>{ex.title}</div>
                      <div style={{ color:"#94a3b8", fontSize:13, lineHeight:1.8 }}>
                        📅 {ex.date} at {ex.time}<br/>
                        ⏱ {ex.duration} hr(s) | 🏛 {ex.hall}<br/>
                        🪑 {ex.rows}×{ex.cols} grid | {ex.seating}
                      </div>
                      <button onClick={() => setViewExam(ex)} style={{ marginTop:12, background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid #6366f1", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:600 }}>View Seating →</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Seating View */}
        {tab === "exam" && viewExam && (
          <div>
            <button onClick={() => setViewExam(null)} style={{ background:"#334155", color:"#e2e8f0", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", marginBottom:20, fontWeight:600 }}>← Back</button>
            <div style={{ background:"#1e293b", borderRadius:16, padding:24, border:"1px solid #334155", maxWidth:900 }}>
              <h2 style={{ fontWeight:800, marginBottom:4 }}>{viewExam.title}</h2>
              <p style={{ color:"#94a3b8", fontSize:14, marginBottom:20 }}>📅 {viewExam.date} | ⏰ {viewExam.time} | ⏱ {viewExam.duration} hr(s) | 🏛 {viewExam.hall}</p>
              <div style={{ background:"#0f172a", borderRadius:8, padding:"8px", textAlign:"center", color:"#64748b", fontSize:12, marginBottom:16, letterSpacing:4 }}>── FRONT / STAGE ──</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ borderCollapse:"collapse", margin:"0 auto" }}>
                  <tbody>
                    {Array.from({ length: viewExam.rows }, (_, r) => (
                      <tr key={r}>
                        {Array.from({ length: viewExam.cols }, (_, c) => {
                          const idx = r * viewExam.cols + c;
                          let occupied = false;
                          if (viewExam.seating === "consecutive") occupied = true;
                          else if (viewExam.seating === "alternate") occupied = (r + c) % 2 === 0;
                          else occupied = Math.random() > 0.3;
                          const rollNo = viewExam.rolls[idx] || "";
                          return (
                            <td key={c} style={{ border:"1px solid #334155", width:64, height:40, textAlign:"center", fontSize:10, background: occupied ? "rgba(99,102,241,0.2)" : "#0f172a", color: occupied ? "#818cf8" : "#334155", borderRadius:4 }}>
                              {occupied ? rollNo : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:16, display:"flex", gap:16, fontSize:13 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:14, height:14, background:"rgba(99,102,241,0.2)", border:"1px solid #6366f1", borderRadius:2 }} /> Occupied</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:14, height:14, background:"#0f172a", border:"1px solid #334155", borderRadius:2 }} /> Empty</div>
              </div>
            </div>
          </div>
        )}

        {/* ── ATTENDANCE TAB ── */}
        {tab === "attendance" && (
          <div>
            <h2 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>✅ Attendance</h2>
            <p style={{ color:"#64748b", marginBottom:32 }}>Track student attendance per class.</p>
            <div style={{ background:"#1e293b", borderRadius:16, padding:40, border:"1px solid #334155", textAlign:"center", maxWidth:500 }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🚧</div>
              <div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Coming Soon</div>
              <p style={{ color:"#64748b" }}>Full attendance tracking with per-subject, per-student records and export functionality will be available in the Professional plan.</p>
              <a href="https://pmny.in/xJuAmT6XgxX7" target="_blank" rel="noreferrer" style={{ display:"inline-block", marginTop:20, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", borderRadius:10, padding:"12px 28px", textDecoration:"none", fontWeight:700 }}>Upgrade to Unlock →</a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}