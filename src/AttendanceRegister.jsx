import { useState, useCallback, useRef } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
// HD = Half Day (counts as 0.5 present)
const CYCLE = { "": "P", P: "A", A: "HD", HD: "H", H: "L", L: "" };
const PROG_YEARS = ["I Year","II Year","III Year","IV Year"];

const PRESET_HOLIDAYS = [
  { label: "New Year",           month: 0,  day: 1  },
  { label: "Pongal",             month: 0,  day: 14 },
  { label: "Republic Day",       month: 0,  day: 26 },
  { label: "Tamil New Year",     month: 3,  day: 14 },
  { label: "Independence Day",   month: 7,  day: 15 },
  { label: "Gandhi Jayanti",     month: 9,  day: 2  },
  { label: "Christmas",          month: 11, day: 25 },
];

const SAT_MODES = [
  { value: "all_off",  label: "All Saturdays off" },
  { value: "all_on",   label: "All Saturdays working" },
  { value: "alt_1off", label: "Alternate off (1st & 3rd off)" },
  { value: "alt_2off", label: "Alternate off (2nd & 4th off)" },
];

const makeId = () => `s${Date.now()}${Math.random().toString(36).slice(2,6)}`;
const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const getDow = (y, m, d) => new Date(y, m, d).getDay();
const isSunday   = (y, m, d) => getDow(y, m, d) === 0;
const isSaturday = (y, m, d) => getDow(y, m, d) === 6;
const aKey = (sid, d) => `${sid}_${d}`;

function saturdayOccurrence(y, m, d) {
  let count = 0;
  for (let i = 1; i <= d; i++) { if (getDow(y, m, i) === 6) count++; }
  return count;
}

export default function AttendanceRegister({ darkMode }) {
  const now = new Date();
  const [org, setOrg]           = useState("ACAD Online Coaching Center");
  const [course, setCourse]     = useState("Biology");
  const [cls, setCls]           = useState("Class XII - A");
  const [progYear, setProgYear] = useState("I Year");
  const [month, setMonth]       = useState(now.getMonth());
  const [year, setYear]         = useState(now.getFullYear());
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [newName, setNewName]   = useState("");
  const [newRoll, setNewRoll]   = useState("");
  const [holidays, setHolidays] = useState([]);
  const [satMode, setSatMode]   = useState("all_off");
  const [showHolPanel, setShowHolPanel] = useState(false);
  const [newHolDay, setNewHolDay]       = useState("");
  const [newHolLabel, setNewHolLabel]   = useState("");
  const [ctx, setCtx] = useState({ visible: false, x: 0, y: 0, sid: "", day: 0 });
  const fileRef = useRef(null);

  const cardBg  = darkMode ? "#1e293b" : "#fff";
  const border  = darkMode ? "#334155" : "#e2e8f0";
  const text    = darkMode ? "#e2e8f0" : "#1e293b";
  const muted   = darkMode ? "#94a3b8" : "#64748b";
  const inputBg = darkMode ? "#0f172a" : "#f8fafc";

  const days   = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);

  const holidayMap = Object.fromEntries(holidays.map(h => [h.day, h.label]));

  const isSatOff = (d) => {
    if (!isSaturday(year, month, d)) return false;
    const occ = saturdayOccurrence(year, month, d);
    if (satMode === "all_off")  return true;
    if (satMode === "all_on")   return false;
    if (satMode === "alt_1off") return occ % 2 === 1;
    if (satMode === "alt_2off") return occ % 2 === 0;
    return false;
  };

  const isBlocked = (d) => isSunday(year, month, d) || isSatOff(d) || !!holidayMap[d];

  const blockedStyle = (d) => {
    if (isSunday(year, month, d)) return { bg: darkMode ? "#1a1a2e" : "#f5f0e8", color: "#ef4444", tag: "Sun" };
    if (isSatOff(d))              return { bg: darkMode ? "#1c1830" : "#f0eef8", color: "#8b5cf6", tag: "Sat" };
    if (holidayMap[d])            return { bg: darkMode ? "#0f2010" : "#edfbf0", color: "#10b981", tag: "Hol" };
    return null;
  };

  const workingDays = dayArr.filter(d => !isBlocked(d)).length;

  const getStatus = useCallback((sid, d) => attendance[aKey(sid, d)] || "", [attendance]);

  const cycleCell = (sid, d) => {
    if (isBlocked(d)) return;
    setAttendance(prev => ({ ...prev, [aKey(sid, d)]: CYCLE[getStatus(sid, d)] }));
  };

  const markCell = (val) => {
    if (ctx.sid) setAttendance(prev => ({ ...prev, [aKey(ctx.sid, ctx.day)]: val }));
    setCtx(c => ({ ...c, visible: false }));
  };

  const openCtx = (e, sid, day) => {
    e.preventDefault();
    if (isBlocked(day)) return;
    setCtx({ visible: true, x: Math.min(e.clientX, window.innerWidth - 170), y: Math.min(e.clientY, window.innerHeight - 210), sid, day });
  };

  const addStudent = () => {
    const name = newName.trim(); if (!name) return;
    setStudents(prev => [...prev, { id: makeId(), name, rollNo: newRoll.trim() }]);
    setNewName(""); setNewRoll("");
  };

  const bulkAdd = () => {
    const raw = window.prompt("Paste student names — one per line\n(Optional prefix: '01 Arun Kumar'):");
    if (!raw) return;
    const added = raw.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^(\d+)\s+(.+)$/);
      return m ? { id: makeId(), rollNo: m[1], name: m[2] } : { id: makeId(), rollNo: "", name: l };
    });
    setStudents(prev => [...prev, ...added]);
  };

  const removeStudent = (id) => {
    if (!window.confirm("Remove this student?")) return;
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const addHoliday = () => {
    const d = parseInt(newHolDay);
    const label = newHolLabel.trim();
    if (!d || d < 1 || d > days || !label) return;
    if (holidays.find(h => h.day === d)) { alert(`Day ${d} already has a holiday.`); return; }
    setHolidays(prev => [...prev, { day: d, label }].sort((a, b) => a.day - b.day));
    setNewHolDay(""); setNewHolLabel("");
  };

  const removeHoliday = (day) => setHolidays(prev => prev.filter(h => h.day !== day));

  const addPreset = (preset) => {
    if (preset.month !== month) { alert(`${preset.label} falls in ${MONTHS[preset.month]}, not ${MONTHS[month]}.`); return; }
    if (holidays.find(h => h.day === preset.day)) { alert(`Day ${preset.day} already marked.`); return; }
    setHolidays(prev => [...prev, { day: preset.day, label: preset.label }].sort((a, b) => a.day - b.day));
  };

  // ── Stats: HD counts as 0.5 ───────────────────────────────────────────────
  const statsFor = (s) => {
    let P = 0, A = 0, HD = 0, L = 0, H = 0;
    dayArr.forEach(d => {
      const st = getStatus(s.id, d);
      if (st === "P")  P++;
      else if (st === "A")  A++;
      else if (st === "HD") HD++;
      else if (st === "L")  L++;
      else if (st === "H")  H++;
    });
    // Attended = full present + half-day as 0.5
    const attended = P + HD * 0.5;
    const denom = dayArr.filter(d => !isBlocked(d) && getStatus(s.id, d) !== "H").length || 1;
    const pct = Math.round((attended / denom) * 100);
    return { P, A, HD, L, H, attended, pct };
  };

  const saveData = () => {
    const blob = new Blob([JSON.stringify({ org, course, cls, progYear, month, year, students, attendance, holidays, satMode }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `attendance_${MONTHS[month]}_${year}.json`; a.click();
  };

  const handleLoad = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        setOrg(d.org || ""); setCourse(d.course || ""); setCls(d.cls || "");
        setProgYear(d.progYear || "I Year"); setMonth(d.month ?? 0); setYear(d.year ?? 2025);
        setStudents(d.students || []); setAttendance(d.attendance || {});
        setHolidays(d.holidays || []); setSatMode(d.satMode || "all_off");
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  // ── Cell colour map ───────────────────────────────────────────────────────
  const cellStyle = (status, blocked) => {
    if (blocked) return { background: "transparent", color: "transparent" };
    if (status === "P")  return { background: darkMode ? "#14291a" : "#eaf3de", color: "#3B6D11" };
    if (status === "A")  return { background: darkMode ? "#2a1010" : "#fcebeb", color: "#A32D2D" };
    if (status === "HD") return { background: darkMode ? "#1a1f08" : "#fefce8", color: "#ca8a04" };
    if (status === "H")  return { background: darkMode ? "#2a1f08" : "#faeeda", color: "#854F0B" };
    if (status === "L")  return { background: darkMode ? "#0d1e2e" : "#e6f1fb", color: "#185FA5" };
    return { background: "transparent", color: "transparent" };
  };

  const pctColor = (pct) => pct >= 75 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";

  let totalP = 0, totalA = 0, totalHD = 0;
  students.forEach(s => { const { P, A, HD } = statsFor(s); totalP += P; totalA += A; totalHD += HD; });

  const btnBase = { border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 };
  const monthPresets = PRESET_HOLIDAYS.filter(p => p.month === month);

  return (
    <div onClick={() => ctx.visible && setCtx(c => ({ ...c, visible: false }))}>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>✅ Attendance Register</h2>
      <p style={{ color: muted, marginBottom: 24 }}>Traditional attendance register — P / A / HD / H / L marking with auto % calculation.</p>

      {/* Config */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 16, color: text }}>Register Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
          {[["Organisation", org, setOrg],["Course / Subject", course, setCourse],["Class / Section", cls, setCls]].map(([lbl, val, setter]) => (
            <div key={lbl}>
              <label style={{ fontSize: 12, color: muted, display: "block", marginBottom: 4 }}>{lbl}</label>
              <input value={val} onChange={e => setter(e.target.value)}
                style={{ width: "100%", background: inputBg, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: text, fontSize: 13, boxSizing: "border-box" }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, color: muted, display: "block", marginBottom: 4 }}>Year of Programme</label>
            <select value={progYear} onChange={e => setProgYear(e.target.value)}
              style={{ width: "100%", background: inputBg, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: text, fontSize: 13 }}>
              {PROG_YEARS.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: muted, display: "block", marginBottom: 4 }}>Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              style={{ width: "100%", background: inputBg, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: text, fontSize: 13 }}>
              {MONTHS.map((mn, i) => <option key={mn} value={i}>{mn}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: muted, display: "block", marginBottom: 4 }}>Year</label>
            <input type="number" value={year} min={2000} max={2100} onChange={e => setYear(Number(e.target.value))}
              style={{ width: "100%", background: inputBg, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: text, fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: muted, display: "block", marginBottom: 8 }}>Saturday Policy</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SAT_MODES.map(sm => (
              <button key={sm.value} onClick={() => setSatMode(sm.value)}
                style={{ ...btnBase, padding: "6px 12px", fontSize: 12,
                  background: satMode === sm.value ? "#8b5cf6" : inputBg,
                  color: satMode === sm.value ? "#fff" : muted,
                  border: `1px solid ${satMode === sm.value ? "#8b5cf6" : border}` }}>
                {sm.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={saveData} style={{ ...btnBase, background: "#10b981", color: "#fff" }}>💾 Save JSON</button>
          <button onClick={() => fileRef.current?.click()} style={{ ...btnBase, background: inputBg, color: text, border: `1px solid ${border}` }}>📂 Load JSON</button>
          <button onClick={() => window.print()} style={{ ...btnBase, background: "#6366f1", color: "#fff" }}>🖨 Print / PDF</button>
          <button onClick={() => setShowHolPanel(p => !p)}
            style={{ ...btnBase, background: showHolPanel ? "#10b981" : "rgba(16,185,129,0.12)", color: showHolPanel ? "#fff" : "#10b981", border: "1px solid #10b98144" }}>
            🎉 Manage Holidays {holidays.length > 0 && `(${holidays.length})`}
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleLoad} />
        </div>
      </div>

      {/* Holiday panel */}
      {showHolPanel && (
        <div style={{ background: cardBg, border: "1px solid #10b98144", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 14, color: text, fontSize: 15 }}>🎉 Holiday Manager — {MONTHS[month]} {year}</h3>
          {monthPresets.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Quick-add presets for {MONTHS[month]}:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {monthPresets.map(p => (
                  <button key={p.label} onClick={() => addPreset(p)}
                    style={{ ...btnBase, padding: "5px 12px", fontSize: 12, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid #10b98144" }}>
                    + {p.label} (day {p.day})
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 4 }}>Day (1–{days})</label>
              <input type="number" value={newHolDay} onChange={e => setNewHolDay(e.target.value)} min={1} max={days}
                placeholder="e.g. 14" onKeyDown={e => e.key === "Enter" && addHoliday()}
                style={{ width: 80, background: inputBg, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 10px", color: text, fontSize: 13 }} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 4 }}>Holiday Name</label>
              <input value={newHolLabel} onChange={e => setNewHolLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addHoliday()}
                placeholder="Diwali, Eid, Pongal, College Day…"
                style={{ width: "100%", background: inputBg, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 10px", color: text, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <button onClick={addHoliday} style={{ ...btnBase, background: "#10b981", color: "#fff" }}>+ Add</button>
          </div>
          {holidays.length === 0 ? (
            <div style={{ fontSize: 13, color: muted, fontStyle: "italic" }}>No holidays added for {MONTHS[month]} yet.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {holidays.map(h => (
                <div key={h.day} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid #10b98144", borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>
                  <span style={{ color: "#10b981", fontWeight: 700 }}>{h.day}</span>
                  <span style={{ color: text }}>{h.label}</span>
                  <span style={{ color: muted, fontSize: 9 }}>({DAY_NAMES[getDow(year, month, h.day)]})</span>
                  <button onClick={() => removeHoliday(h.day)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 13, padding: "0 2px" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                    onMouseLeave={e => e.currentTarget.style.color = muted}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 13, color: muted }}>
        <span><strong style={{ color: text }}>{students.length}</strong> students</span>
        <span><strong style={{ color: text }}>{workingDays}</strong> working days</span>
        <span><strong style={{ color: "#8b5cf6" }}>{holidays.length}</strong> public holidays</span>
        <span style={{ color: "#10b981" }}><strong>{totalP}</strong> present</span>
        <span style={{ color: "#ca8a04" }}><strong>{totalHD}</strong> half-day</span>
        <span style={{ color: "#ef4444" }}><strong>{totalA}</strong> absent</span>
      </div>

      {/* Register table */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${border}`, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: text }}>{org}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", justifyContent: "center", marginTop: 6, fontSize: 12, color: muted }}>
            <span><b style={{ color: text }}>Course:</b> {course}</span>
            <span><b style={{ color: text }}>Class:</b> {cls}</span>
            <span><b style={{ color: text }}>Programme Year:</b> {progYear}</span>
            <span><b style={{ color: text }}>Month:</b> {MONTHS[month]} {year}</span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11, fontFamily: "'Courier New', monospace", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ background: inputBg, border: `1px solid ${border}`, padding: "6px 4px", width: 28, color: muted, fontSize: 10 }}>#</th>
                <th style={{ background: inputBg, border: `1px solid ${border}`, padding: "6px 4px", width: 44, color: muted, fontSize: 10 }}>Roll</th>
                <th style={{ background: inputBg, border: `1px solid ${border}`, padding: "6px 8px", minWidth: 130, textAlign: "left", color: muted, fontSize: 10 }}>Student Name</th>
                {dayArr.map(d => {
                  const blocked = isBlocked(d);
                  const bs = blockedStyle(d);
                  return (
                    <th key={d} title={holidayMap[d] || (isSatOff(d) ? "Saturday Off" : isSunday(year,month,d) ? "Sunday" : "")}
                      style={{ background: blocked ? bs?.bg : inputBg, border: `1px solid ${border}`, padding: "4px 2px", width: 26 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: blocked ? bs?.color : text }}>{d}</span>
                        <span style={{ fontSize: 8, textTransform: "uppercase", color: blocked ? bs?.color : muted }}>
                          {blocked ? bs?.tag : DAY_NAMES[getDow(year, month, d)]}
                        </span>
                      </div>
                    </th>
                  );
                })}
                {["P","HD","A","L","H","Days","%"].map(h => (
                  <th key={h} style={{ background: inputBg, border: `1px solid ${border}`, padding: "6px 4px", minWidth: 34, color: muted, fontSize: 10 }}
                    title={h === "HD" ? "Half Day (counts as 0.5)" : ""}>
                    {h}
                  </th>
                ))}
                <th style={{ background: inputBg, border: `1px solid ${border}`, width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={days + 11} style={{ textAlign: "center", padding: 32, color: muted, fontSize: 13 }}>No students yet — add them below</td></tr>
              ) : students.map((s, idx) => {
                const { P, A, HD, L, H, attended, pct } = statsFor(s);
                return (
                  <tr key={s.id}>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 2px", textAlign: "center", fontSize: 10, color: muted }}>{idx + 1}</td>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 4px", textAlign: "center", fontSize: 10, color: muted }}>{s.rollNo}</td>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 8px", fontSize: 11, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: text }} title={s.name}>{s.name}</td>
                    {dayArr.map(d => {
                      const blocked = isBlocked(d);
                      const bs = blockedStyle(d);
                      const st = getStatus(s.id, d);
                      const cs = cellStyle(st, blocked);
                      return (
                        <td key={d}
                          title={blocked ? (holidayMap[d] || (isSatOff(d) ? "Saturday Off" : "Sunday")) : st === "HD" ? "Half Day" : ""}
                          onClick={() => cycleCell(s.id, d)}
                          onContextMenu={e => openCtx(e, s.id, d)}
                          style={{ border: `1px solid ${border}`, width: 26, height: 26, textAlign: "center",
                            cursor: blocked ? "default" : "pointer",
                            background: blocked ? bs?.bg : cs.background }}
                          onMouseEnter={e => { if (!blocked) e.currentTarget.style.filter = "brightness(0.9)"; }}
                          onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
                          <span style={{ fontSize: blocked ? 8 : st === "HD" ? 9 : 11, fontWeight: 600, color: blocked ? bs?.color : cs.color }}>
                            {blocked ? bs?.tag : st}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ border: `1px solid ${border}`, padding: "3px 4px", textAlign: "center", fontSize: 11, color: "#10b981" }}>{P}</td>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 4px", textAlign: "center", fontSize: 11, color: "#ca8a04" }}>{HD}</td>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 4px", textAlign: "center", fontSize: 11, color: "#ef4444" }}>{A}</td>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 4px", textAlign: "center", fontSize: 11, color: "#0ea5e9" }}>{L}</td>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 4px", textAlign: "center", fontSize: 11, color: "#f59e0b" }}>{H}</td>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 4px", textAlign: "center", fontSize: 11, color: text }}>{attended % 1 === 0 ? attended : attended.toFixed(1)}</td>
                    <td style={{ border: `1px solid ${border}`, padding: "3px 4px", textAlign: "center", fontSize: 11, fontWeight: 700, color: pctColor(pct) }}>{pct}%</td>
                    <td style={{ border: `1px solid ${border}`, padding: "0 2px", textAlign: "center" }}>
                      <button onClick={() => removeStudent(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = muted}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add student */}
        <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderTop: `1px solid ${border}`, background: inputBg, flexWrap: "wrap", alignItems: "center" }}>
          <input value={newRoll} onChange={e => setNewRoll(e.target.value)} onKeyDown={e => e.key === "Enter" && addStudent()}
            placeholder="Roll No." style={{ width: 72, background: cardBg, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 10px", color: text, fontSize: 13 }} />
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addStudent()}
            placeholder="Student name — press Enter to add…" style={{ flex: 1, minWidth: 180, background: cardBg, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 10px", color: text, fontSize: 13 }} />
          <button onClick={addStudent} style={{ ...btnBase, background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff" }}>+ Add</button>
          <button onClick={bulkAdd} style={{ ...btnBase, background: inputBg, color: muted, border: `1px solid ${border}` }}>Bulk Add</button>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "8px 16px", borderTop: `1px solid ${border}`, fontSize: 11, color: muted, alignItems: "center" }}>
          {[
            ["#3B6D11","#eaf3de","P = Present"],
            ["#ca8a04","#fefce8","HD = Half Day (0.5)"],
            ["#A32D2D","#fcebeb","A = Absent"],
            ["#185FA5","#e6f1fb","L = Leave"],
            ["#854F0B","#faeeda","H = Holiday (student)"],
          ].map(([tc, bg, lbl]) => (
            <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `1px solid ${tc}44`, display: "inline-block" }} />{lbl}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#edfbf0", border: "1px solid #10b98144", display: "inline-block" }} />Hol = Public Holiday
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f0eef8", border: "1px solid #8b5cf644", display: "inline-block" }} />Sat = Saturday Off
          </span>
          <span style={{ marginLeft: "auto", fontSize: 10 }}>Left-click to cycle · Right-click for menu</span>
        </div>
      </div>

      {/* Context menu */}
      {ctx.visible && (
        <div style={{ position: "fixed", top: ctx.y, left: ctx.x, background: cardBg, border: `1px solid ${border}`, borderRadius: 10, zIndex: 9999, minWidth: 160, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
          onClick={e => e.stopPropagation()}>
          {[
            ["P",  "Present",   "#3B6D11"],
            ["HD", "Half Day",  "#ca8a04"],
            ["A",  "Absent",    "#A32D2D"],
            ["H",  "Holiday",   "#854F0B"],
            ["L",  "Leave",     "#185FA5"],
          ].map(([val, label, color]) => (
            <div key={val} onClick={() => markCell(val)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", fontSize: 13, color: text }}
              onMouseEnter={e => e.currentTarget.style.background = inputBg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color, fontWeight: 700, minWidth: 20 }}>{val}</span>
              <span>{label}</span>
              {val === "HD" && <span style={{ fontSize: 10, color: muted, marginLeft: "auto" }}>= 0.5</span>}
            </div>
          ))}
          <div style={{ height: "0.5px", background: border }} />
          <div onClick={() => markCell("")}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", fontSize: 13, color: muted }}
            onMouseEnter={e => e.currentTarget.style.background = inputBg}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ minWidth: 20 }}>—</span><span>Clear</span>
          </div>
        </div>
      )}
    </div>
  );
}
