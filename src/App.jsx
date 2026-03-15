import React, { useState, useMemo, useEffect } from "react";
import AttendanceRegister from "./AttendanceRegister.jsx";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://atqwdzanlfvxkzlmxtsz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cXdkemFubGZ2eGt6bG14dHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDc5ODAsImV4cCI6MjA4ODY4Mzk4MH0.eVpTMbk2G-CoZmSa4YAEl5MagTQB_JlYvA5zA05OA1M";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PAYMENT_URL = "https://pmny.in/xJuAmT6XgxX7";
const TRIAL_LIMIT = 2;
const COLORS = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16"];

function parseTime(t){if(!t)return 0;const[h,m]=t.split(":").map(Number);return h*60+m;}
function formatTime(mins){const h=Math.floor(mins/60),m=mins%60,ampm=h>=12?"PM":"AM",hh=h>12?h-12:h===0?12:h;return`${hh}:${m.toString().padStart(2,"0")} ${ampm}`;}

function generateSlots(start,end,period,teaStart,teaEnd,lunchStart,lunchEnd){
  const slots=[],endM=parseTime(end),teaS=parseTime(teaStart),teaE=parseTime(teaEnd),lunS=parseTime(lunchStart),lunE=parseTime(lunchEnd);
  let cur=parseTime(start),idx=0;
  while(cur<endM){
    if(cur===teaS){slots.push({start:teaS,end:teaE,label:`${formatTime(teaS)}–${formatTime(teaE)}`,type:"tea"});cur=teaE;continue;}
    if(cur===lunS){slots.push({start:lunS,end:lunE,label:`${formatTime(lunS)}–${formatTime(lunE)}`,type:"lunch"});cur=lunE;continue;}
    const nextBreak=[teaS,lunS,endM].filter(t=>t>cur).sort((a,b)=>a-b)[0];
    const slotEnd=Math.min(cur+period,nextBreak);
    if(slotEnd-cur<period*0.8){cur=nextBreak;continue;}
    slots.push({start:cur,end:slotEnd,label:`${formatTime(cur)}–${formatTime(slotEnd)}`,type:"class",index:idx++});
    cur=slotEnd;
  }
  return slots;
}

function parseCSV(text){
  const lines=text.trim().split("\n").filter(l=>l.trim());
  return lines.slice(1).map(l=>{
    const c=l.split(",").map(s=>s.trim());
    if(c.length<4)return null;
    return{faculty:c[0],subject:c[1],relevance:parseFloat(c[2])||1,hoursPerWeek:parseInt(c[3])||3,type:(c[4]||"T").toUpperCase()==="P"?"P":"T",consecutive:parseInt(c[5])||2,room:c[6]||""};
  }).filter(Boolean);
}

function generateTimetable(subjects,days,slots){
  const classSlots=slots.filter(s=>s.type==="class");
  const grid={};
  days.forEach(d=>{grid[d]={};classSlots.forEach(s=>{grid[d][s.index]=null;});});
  const sorted=[...subjects].sort((a,b)=>{if(a.type==="P"&&b.type!=="P")return -1;if(b.type==="P"&&a.type!=="P")return 1;return b.relevance-a.relevance;});
  sorted.filter(s=>s.type==="P").forEach(sub=>{
    let placed=0;
    for(const day of days){
      if(placed>=sub.hoursPerWeek)break;
      const indices=classSlots.map(s=>s.index);
      for(let i=0;i<=indices.length-sub.consecutive;i++){
        const block=indices.slice(i,i+sub.consecutive);
        if(block.every(idx=>!grid[day][idx])){block.forEach(idx=>{grid[day][idx]={...sub,isLab:true};});placed+=sub.consecutive;break;}
      }
    }
  });
  sorted.filter(s=>s.type==="T").forEach(sub=>{
    let placed=0;
    for(const day of days){
      for(const slot of classSlots){
        if(placed>=sub.hoursPerWeek)break;
        if(!grid[day][slot.index]){grid[day][slot.index]={...sub,isLab:false};placed++;}
      }
    }
  });
  return grid;
}

function detectConflicts(grid,days,slots){
  const conflicts=[];
  slots.filter(s=>s.type==="class").forEach(slot=>{
    const seen={};
    days.forEach(day=>{
      const cell=grid[day]?.[slot.index];
      if(cell){if(seen[cell.faculty])conflicts.push({slot:slot.label,faculty:cell.faculty,days:[seen[cell.faculty],day]});else seen[cell.faculty]=day;}
    });
  });
  return conflicts;
}

// ── Auth Pages ──
function AuthPage({darkMode,onAuth}){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [institution,setInstitution]=useState("");
  const [role,setRole]=useState("Faculty");
  const [phone,setPhone]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  const bg=darkMode?"#0f172a":"#f1f5f9";
  const cardBg=darkMode?"#1e293b":"#fff";
  const border=darkMode?"#334155":"#e2e8f0";
  const text=darkMode?"#e2e8f0":"#1e293b";
  const muted=darkMode?"#94a3b8":"#64748b";
  const inputBg=darkMode?"#0f172a":"#f8fafc";

  async function handleSubmit(){
    setError("");setSuccess("");setLoading(true);
    try{
      if(mode==="login"){
        const{data,error:e}=await supabase.auth.signInWithPassword({email,password});
        if(e)throw e;
        onAuth(data.user);
      } else if(mode==="signup"){
        const{data,error:e}=await supabase.auth.signUp({email,password});
        if(e)throw e;
        if(data.user){
          await supabase.from("profiles").insert({id:data.user.id,name,institution,role,phone,subscription:"free",timetables_count:0});
          setSuccess("Account created! Please check your email to confirm, then log in.");
          setMode("login");
        }
      } else {
        const{error:e}=await supabase.auth.resetPasswordForEmail(email);
        if(e)throw e;
        setSuccess("Password reset email sent! Check your inbox.");
      }
    }catch(e){setError(e.message);}
    setLoading(false);
  }

  return(
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src="/logo.png" alt="Tymr" style={{height:64,width:64,borderRadius:16,objectFit:"cover",marginBottom:12}}/>
          <div style={{fontSize:32,fontWeight:900,background:"linear-gradient(90deg,#818cf8,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Tymr</div>
          <div style={{color:muted,fontSize:14,marginTop:4}}>Smart Academic Scheduling</div>
        </div>
        <div style={{background:cardBg,borderRadius:20,padding:32,border:`1px solid ${border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
          <h2 style={{fontWeight:800,fontSize:22,marginBottom:4,color:text}}>{mode==="login"?"Welcome Back 👋":mode==="signup"?"Create Account 🎓":"Reset Password 🔑"}</h2>
          <p style={{color:muted,fontSize:14,marginBottom:24}}>{mode==="login"?"Sign in to your Tymr account":mode==="signup"?"Join thousands of educators using Tymr":"Enter your email to reset password"}</p>
          {error&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid #ef4444",borderRadius:10,padding:"10px 14px",color:"#ef4444",fontSize:13,marginBottom:16}}>{error}</div>}
          {success&&<div style={{background:"rgba(16,185,129,0.1)",border:"1px solid #10b981",borderRadius:10,padding:"10px 14px",color:"#34d399",fontSize:13,marginBottom:16}}>{success}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {mode==="signup"&&(
              <>
                <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Full Name *</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Dr. John Smith" style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:10,padding:"10px 14px",color:text,fontSize:14,boxSizing:"border-box"}}/></div>
                <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Institution *</label>
                <input value={institution} onChange={e=>setInstitution(e.target.value)} placeholder="ABC College, Chennai" style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:10,padding:"10px 14px",color:text,fontSize:14,boxSizing:"border-box"}}/></div>
                <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Role *</label>
                <select value={role} onChange={e=>setRole(e.target.value)} style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:10,padding:"10px 14px",color:text,fontSize:14}}>
                  <option>HoD</option><option>Faculty</option><option>Admin</option><option>Student</option>
                </select></div>
                <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Phone</label>
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210" style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:10,padding:"10px 14px",color:text,fontSize:14,boxSizing:"border-box"}}/></div>
              </>
            )}
            <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Email *</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@institution.edu" style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:10,padding:"10px 14px",color:text,fontSize:14,boxSizing:"border-box"}}/></div>
            {mode!=="forgot"&&(
              <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Password *</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:10,padding:"10px 14px",color:text,fontSize:14,boxSizing:"border-box"}}/></div>
            )}
            <button onClick={handleSubmit} disabled={loading} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:4}}>
              {loading?"Please wait...":(mode==="login"?"Sign In →":mode==="signup"?"Create Account →":"Send Reset Email →")}
            </button>
          </div>
          <div style={{marginTop:20,textAlign:"center",fontSize:13,color:muted}}>
            {mode==="login"&&<><span>Don't have an account? </span><span onClick={()=>setMode("signup")} style={{color:"#818cf8",cursor:"pointer",fontWeight:600}}>Sign Up</span><span> • </span><span onClick={()=>setMode("forgot")} style={{color:"#818cf8",cursor:"pointer"}}>Forgot Password?</span></>}
            {mode==="signup"&&<><span>Already have an account? </span><span onClick={()=>setMode("login")} style={{color:"#818cf8",cursor:"pointer",fontWeight:600}}>Sign In</span></>}
            {mode==="forgot"&&<><span>Remember it? </span><span onClick={()=>setMode("login")} style={{color:"#818cf8",cursor:"pointer",fontWeight:600}}>Sign In</span></>}
          </div>
        </div>
        <p style={{textAlign:"center",color:muted,fontSize:12,marginTop:16}}>© 2025 Tymr • acadcoachingcenter@gmail.com</p>
      </div>
    </div>
  );
}

// ── Dashboard ──
function Dashboard({profile,timetablesCount,darkMode,onNavigate}){
  const cardBg=darkMode?"#1e293b":"#fff";
  const border=darkMode?"#334155":"#e2e8f0";
  const muted=darkMode?"#94a3b8":"#64748b";
  const subColor=profile?.subscription==="free"?"#64748b":profile?.subscription==="starter"?"#0ea5e9":profile?.subscription==="professional"?"#6366f1":"#8b5cf6";
  return(
    <div>
      <h2 style={{fontSize:24,fontWeight:800,marginBottom:4}}>👋 Welcome, {profile?.name||"User"}!</h2>
      <p style={{color:muted,marginBottom:24}}>{profile?.institution||"Your Institution"} • {profile?.role||"Faculty"}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginBottom:32}}>
        {[
          {icon:"📅",label:"Timetables",value:timetablesCount,color:"#6366f1",action:()=>onNavigate("timetable")},
          {icon:"📝",label:"Exam Schedules",value:"0",color:"#0ea5e9",action:()=>onNavigate("exam")},
          {icon:"✅",label:"Attendance",value:"—",color:"#10b981",action:()=>onNavigate("attendance")},
          {icon:"💳",label:"Plan",value:profile?.subscription||"Free",color:subColor,action:()=>window.open(PAYMENT_URL,"_blank")},
        ].map(s=>(
          <div key={s.label} onClick={s.action} style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:20,cursor:"pointer",transition:"transform 0.2s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="none"}>
            <div style={{fontSize:28,marginBottom:8}}>{s.icon}</div>
            <div style={{fontSize:28,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{color:muted,fontSize:13}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:24,maxWidth:500}}>
        <h3 style={{fontWeight:700,marginBottom:16}}>👤 Your Profile</h3>
        {[["Name",profile?.name],["Email",profile?.email],["Institution",profile?.institution],["Role",profile?.role],["Phone",profile?.phone],["Member Since",profile?.created_at?new Date(profile.created_at).toLocaleDateString():"—"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${border}`,fontSize:14}}>
            <span style={{color:muted}}>{k}</span>
            <span style={{fontWeight:600}}>{v||"—"}</span>
          </div>
        ))}
        <div style={{marginTop:16}}>
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:14}}>
            <span style={{color:muted}}>Subscription</span>
            <span style={{background:`${subColor}22`,color:subColor,borderRadius:20,padding:"2px 12px",fontWeight:700,fontSize:13,textTransform:"capitalize"}}>{profile?.subscription||"free"}</span>
          </div>
          <a href={PAYMENT_URL} target="_blank" rel="noreferrer" style={{display:"block",marginTop:12,textAlign:"center",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",borderRadius:10,padding:"10px",textDecoration:"none",fontWeight:600,fontSize:14}}>⬆ Upgrade Plan</a>
        </div>
      </div>
    </div>
  );
}

// ── Landing Page ──
function LandingPage({onEnter,onLogin,darkMode}){
  const bg=darkMode?"#0f0c29":"#f8fafc";
  const muted=darkMode?"#94a3b8":"#64748b";
  return(
    <div style={{fontFamily:"'Segoe UI',sans-serif",background:bg,minHeight:"100vh",color:darkMode?"#e2e8f0":"#1e293b"}}>
      <div style={{minHeight:"100vh",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",padding:"0 20px 60px"}}>
        <img src="/campus.jpg" alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(15,12,41,0.72),rgba(48,43,99,0.65),rgba(36,36,62,0.72))",zIndex:1}}/>
        <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 40px",borderBottom:"1px solid rgba(255,255,255,0.1)",position:"relative",zIndex:2}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/logo.png" alt="Tymr" style={{height:40,width:40,borderRadius:8,objectFit:"cover"}}/>
            <span style={{fontSize:24,fontWeight:800,background:"linear-gradient(90deg,#818cf8,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Tymr</span>
          </div>
          <button onClick={onLogin} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",cursor:"pointer",fontWeight:600}}>Sign In →</button>
        </nav>
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:2}}>
          <div style={{textAlign:"center",maxWidth:680}}>
            <div style={{display:"inline-block",background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:20,padding:"6px 16px",fontSize:13,marginBottom:24,color:"#a5b4fc"}}>🎓 Smart Academic Scheduling Platform</div>
            <h1 style={{fontSize:"clamp(36px,6vw,68px)",fontWeight:900,lineHeight:1.1,marginBottom:20,color:"#fff"}}>Build Perfect<br/><span style={{background:"linear-gradient(90deg,#818cf8,#c084fc,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Timetables Instantly</span></h1>
            <p style={{color:"#94a3b8",fontSize:18,marginBottom:40}}>Upload your faculty & subject CSV, configure your schedule, and generate conflict-free timetables in seconds.</p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={onLogin} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:12,padding:"16px 40px",fontSize:18,fontWeight:700,cursor:"pointer",boxShadow:"0 0 40px rgba(99,102,241,0.5)"}}>🚀 Get Started Free →</button>
              <button onClick={onEnter} style={{background:"rgba(255,255,255,0.1)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:12,padding:"16px 32px",fontSize:16,fontWeight:600,cursor:"pointer"}}>Try Without Login</button>
            </div>
            <p style={{color:"#475569",fontSize:12,marginTop:16}}>No credit card required • Free 14-day trial</p>
          </div>
        </div>
      </div>
      {/* Features */}
      <div style={{padding:"60px 20px",background:darkMode?"#0f172a":"#f1f5f9"}}>
        <h2 style={{textAlign:"center",fontSize:32,fontWeight:800,marginBottom:40}}>Powerful Features</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:20,maxWidth:1000,margin:"0 auto"}}>
          {[["📤","CSV Upload","Faculty, subject & relevance data"],["🧠","Smart Scheduling","Relevance-based slot assignment"],["🔬","Lab Support","Consecutive period scheduling"],["⚠️","Conflict Detection","Warns on faculty double-booking"],["↔️","Drag & Drop","Swap timetable cells easily"],["💾","Save/Reload","Store multiple timetables"],["📱","Mobile Ready","Works on all screen sizes"],["📥","Export","CSV & printable PDF output"]].map(([icon,title,desc])=>(
            <div key={title} style={{background:darkMode?"rgba(255,255,255,0.04)":"#fff",border:`1px solid ${darkMode?"rgba(255,255,255,0.08)":"#e2e8f0"}`,borderRadius:16,padding:24}}>
              <div style={{fontSize:28,marginBottom:10}}>{icon}</div>
              <div style={{fontWeight:700,marginBottom:6,fontSize:15}}>{title}</div>
              <div style={{color:muted,fontSize:13}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Pricing */}
      <div style={{padding:"60px 20px",background:darkMode?"#0f0c29":"#fff"}}>
        <h2 style={{textAlign:"center",fontSize:32,fontWeight:800,marginBottom:8}}>Simple Pricing</h2>
        <p style={{textAlign:"center",color:muted,marginBottom:40}}>Affordable plans for every institution</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:20,maxWidth:960,margin:"0 auto"}}>
          {[{name:"Free Trial",price:"₹0",period:"/14 days",color:"#64748b",features:["5 timetables","Basic attendance","2 exam schedules","Email support"]},{name:"Starter",price:"₹29",period:"/month",color:"#0ea5e9",features:["Unlimited timetables","Advanced attendance","10 exam schedules","5 users","CSV/PDF export"]},{name:"Professional",price:"₹49",period:"/month",color:"#6366f1",popular:true,features:["Everything in Starter","Unlimited exams","Advanced seating","20 users","Custom branding","Phone support"]},{name:"Enterprise",price:"₹99",period:"/month",color:"#8b5cf6",features:["Everything in Pro","Unlimited users","Dedicated manager","24/7 support","Training"]}].map(p=>(
            <div key={p.name} style={{background:p.popular?(darkMode?"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))":"linear-gradient(135deg,#eef2ff,#f5f3ff)"):(darkMode?"rgba(255,255,255,0.04)":"#f8fafc"),border:`2px solid ${p.popular?"#6366f1":(darkMode?"rgba(255,255,255,0.08)":"#e2e8f0")}`,borderRadius:16,padding:24,position:"relative"}}>
              {p.popular&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700,color:"#fff"}}>⭐ Most Popular</div>}
              <div style={{fontWeight:700,fontSize:18,marginBottom:8}}>{p.name}</div>
              <div style={{fontSize:32,fontWeight:900,color:p.color}}>{p.price}<span style={{fontSize:14,color:muted}}>{p.period}</span></div>
              <ul style={{listStyle:"none",padding:0,margin:"16px 0",color:muted,fontSize:13}}>{p.features.map(f=><li key={f} style={{padding:"3px 0"}}>✓ {f}</li>)}</ul>
              <a href={PAYMENT_URL} target="_blank" rel="noreferrer" style={{display:"block",textAlign:"center",background:`linear-gradient(135deg,${p.color},${p.color}aa)`,color:"#fff",borderRadius:8,padding:"10px",textDecoration:"none",fontWeight:600,fontSize:14}}>{p.price==="₹0"?"Get Started Free":"Subscribe Now"}</a>
            </div>
          ))}
        </div>
      </div>
      {/* Footer */}
      <footer style={{background:darkMode?"#020617":"#1e293b",color:"#94a3b8",padding:"40px 20px"}}>
        <div style={{maxWidth:960,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:32}}>
          <div><div style={{fontSize:22,fontWeight:800,background:"linear-gradient(90deg,#818cf8,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:12}}>Tymr</div><p style={{fontSize:14}}>Smart academic scheduling for modern institutions.</p></div>
          <div><div style={{fontWeight:700,marginBottom:12,color:"#e2e8f0"}}>Contact Us</div><div style={{fontSize:14,lineHeight:2}}>📞 +91 97908 18436<br/>✉️ acadcoachingcenter@gmail.com<br/>📍 DABC-BEGONIA, Mambakkam<br/>&nbsp;&nbsp;(Near VIT Chennai Campus)<br/>&nbsp;&nbsp;Chennai - TN - 600127</div></div>
          <div><div style={{fontWeight:700,marginBottom:12,color:"#e2e8f0"}}>Quick Links</div><div style={{fontSize:14,lineHeight:2,cursor:"pointer"}} onClick={onLogin}>Timetable Maker<br/>Exam Scheduler<br/>Attendance Tracker</div></div>
        </div>
        <div style={{textAlign:"center",fontSize:12,marginTop:32,color:"#334155"}}>© 2025 Tymr. All rights reserved.</div>
      </footer>
    </div>
  );
}

// ── Main App ──
export default function App(){
  const [page,setPage]=useState("landing");
  const [tab,setTab]=useState("dashboard");
  const [darkMode,setDarkMode]=useState(true);
  const [sideOpen,setSideOpen]=useState(false);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loadingAuth,setLoadingAuth]=useState(true);

  // Timetable state
  const [subjects,setSubjects]=useState([]);
  const [csvError,setCsvError]=useState("");
  const [config,setConfig]=useState({days:["Monday","Tuesday","Wednesday","Thursday","Friday"],start:"08:30",end:"16:00",period:55,includeSat:false,teaStart:"10:20",teaEnd:"10:40",lunchStart:"12:30",lunchEnd:"13:15"});
  const [timetable,setTimetable]=useState(null);
  const [generated,setGenerated]=useState(false);
  const [conflicts,setConflicts]=useState([]);
  const [dragCell,setDragCell]=useState(null);
  const [savedTimetables,setSavedTimetables]=useState([]);
  const [saveName,setSaveName]=useState("");
  const [facultyView,setFacultyView]=useState(null);
  const [trialCount,setTrialCount]=useState(0);

  // Exam state
  const [exams,setExams]=useState([]);
  const [examForm,setExamForm]=useState({title:"",date:"",time:"09:00",duration:3,hall:"Hall A",rows:10,cols:10,seating:"alternate"});
  const [viewExam,setViewExam]=useState(null);

  const slots=useMemo(()=>generateSlots(config.start,config.end,config.period,config.teaStart,config.teaEnd,config.lunchStart,config.lunchEnd),[config]);
  const subjectColors=useMemo(()=>{const map={};subjects.forEach((s,i)=>{map[s.subject]=COLORS[i%COLORS.length];});return map;},[subjects]);

  const bg=darkMode?"#0f172a":"#f1f5f9";
  const sideBg=darkMode?"#1e293b":"#fff";
  const cardBg=darkMode?"#1e293b":"#fff";
  const border=darkMode?"#334155":"#e2e8f0";
  const text=darkMode?"#e2e8f0":"#1e293b";
  const muted=darkMode?"#94a3b8":"#64748b";
  const inputBg=darkMode?"#0f172a":"#f8fafc";

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){setUser(session.user);fetchProfile(session.user.id);setPage("app");}
      setLoadingAuth(false);
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      if(session?.user){setUser(session.user);fetchProfile(session.user.id);setPage("app");}
      else{setUser(null);setProfile(null);}
    });
    return()=>subscription.unsubscribe();
  },[]);

  async function fetchProfile(uid){
    const{data}=await supabase.from("profiles").select("*").eq("id",uid).single();
    if(data)setProfile({...data,email:user?.email});
  }

  async function handleSignOut(){
    await supabase.auth.signOut();
    setUser(null);setProfile(null);setPage("landing");setTab("dashboard");
  }

  function handleCSV(e){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{const p=parseCSV(ev.target.result);if(!p.length){setCsvError("No valid rows.");return;}setSubjects(p);setCsvError("");setGenerated(false);setTimetable(null);}catch{setCsvError("Failed to parse CSV.");}};
    reader.readAsText(file);
  }

  function downloadTemplate(){
    const csv="Faculty Name,Subject Name,Relevance Score,Hours Per Week,Type (T/P),Consecutive Periods (Lab only),Room/Hall\nDr. Smith,Mathematics,5,4,T,,Room 101\nProf. Jones,Physics Lab,4,3,P,3,Lab A\n";
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="tymr_template.csv";a.click();
  }

  async function handleGenerate(){
    if(!subjects.length)return;
    if(!user&&trialCount>=2)return;
    const days=config.includeSat?[...config.days.filter(d=>d!=="Saturday"),"Saturday"]:config.days.filter(d=>d!=="Saturday");
    const grid=generateTimetable(subjects,days,slots);
    setConflicts(detectConflicts(grid,days,slots));
    setTimetable({grid,days,slots});
    setGenerated(true);
    if(!user)setTrialCount(c=>c+1);
    if(user){
      await supabase.from("profiles").update({timetables_count:(profile?.timetables_count||0)+1}).eq("id",user.id);
      setProfile(p=>({...p,timetables_count:(p?.timetables_count||0)+1}));
    }
  }

  function handleDragStart(day,slotIdx){setDragCell({day,slotIdx});}
  function handleDrop(day,slotIdx){
    if(!dragCell||!timetable)return;
    if(dragCell.day===day&&dragCell.slotIdx===slotIdx){setDragCell(null);return;}
    const newGrid={...timetable.grid};
    Object.keys(newGrid).forEach(d=>{newGrid[d]={...newGrid[d]};});
    const tmp=newGrid[dragCell.day][dragCell.slotIdx];
    newGrid[dragCell.day][dragCell.slotIdx]=newGrid[day][slotIdx];
    newGrid[day][slotIdx]=tmp;
    setTimetable({...timetable,grid:newGrid});
    setConflicts(detectConflicts(newGrid,timetable.days,timetable.slots));
    setDragCell(null);
  }

  function saveTimetable(){
    if(!timetable||!saveName.trim())return;
    setSavedTimetables(prev=>[...prev.filter(t=>t.name!==saveName),{name:saveName,timetable,subjects,config,date:new Date().toLocaleDateString()}]);
    setSaveName("");
  }

  function downloadCSV(){
    if(!timetable)return;
    const{grid,days,slots:sl}=timetable;
    const rows=days.map(d=>[d,...sl.map(s=>s.type==="tea"?"Tea Break":s.type==="lunch"?"Lunch Break":grid[d][s.index]?`"${grid[d][s.index].subject}(${grid[d][s.index].faculty})"`:""  )].join(","));
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([["Day",...sl.map(s=>s.label)].join(",")+"\n"+rows.join("\n")],{type:"text/csv"}));a.download="tymr_timetable.csv";a.click();
  }

  function downloadPDF(){
    if(!timetable)return;
    const{grid,days,slots:sl}=timetable;
    let html=`<html><head><style>body{font-family:Arial;font-size:11px;margin:20px}h2{color:#4f46e5;text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:center}th{background:#4f46e5;color:#fff}.tea{background:#fef3c7}.lunch{background:#d1fae5}.lab{background:#ede9fe}</style></head><body><h2>Tymr Timetable</h2><table><tr><th>Day</th>${sl.map(s=>`<th>${s.label}</th>`).join("")}</tr>`;
    days.forEach(d=>{html+=`<tr><td><b>${d}</b></td>`;sl.forEach(s=>{if(s.type==="tea")html+=`<td class="tea">☕ Tea</td>`;else if(s.type==="lunch")html+=`<td class="lunch">🍽 Lunch</td>`;else{const c=grid[d][s.index];html+=c?`<td class="${c.isLab?"lab":""}">${c.subject}<br/><small>${c.faculty}</small></td>`:`<td>—</td>`;}});html+=`</tr>`;});
    html+=`</table></body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
  }

  function shareWhatsApp(){
    if(!timetable)return;
    window.open(`https://wa.me/?text=${encodeURIComponent(`📅 *Tymr Timetable*\nDays: ${timetable.days.join(", ")}\nGenerated via tymr-two.vercel.app`)}`,"_blank");
  }

  function addExam(){
    if(!examForm.title||!examForm.date)return;
    const rolls=[];
    for(let r=1;r<=examForm.rows;r++)for(let c=1;c<=examForm.cols;c++)rolls.push(`R${String(r).padStart(2,"0")}C${String(c).padStart(2,"0")}`);
    setExams(prev=>[...prev,{...examForm,id:Date.now(),rolls}]);
    setExamForm({title:"",date:"",time:"09:00",duration:3,hall:"Hall A",rows:10,cols:10,seating:"alternate"});
  }

  if(loadingAuth)return<div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",color:"#818cf8",fontSize:18,fontFamily:"sans-serif"}}>Loading Tymr...</div>;
  if(page==="landing")return<LandingPage onEnter={()=>setPage("app")} onLogin={()=>setPage("auth")} darkMode={darkMode}/>;
  if(page==="auth")return<AuthPage darkMode={darkMode} onAuth={u=>{setUser(u);fetchProfile(u.id);setPage("app");setTab("dashboard");}}/>;

  const navItems=[{id:"dashboard",label:"🏠 Dashboard"},{id:"timetable",label:"📅 Timetable"},{id:"exam",label:"📝 Exam Schedule"},{id:"attendance",label:"✅ Attendance"}];
  const uniqueFaculty=[...new Set(subjects.map(s=>s.faculty))];

  return(
    <div style={{fontFamily:"'Segoe UI',sans-serif",minHeight:"100vh",background:bg,color:text,display:"flex",flexWrap:"wrap"}}>
      {sideOpen&&<div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:40}}/>}
      <button onClick={()=>setSideOpen(s=>!s)} style={{position:"fixed",top:12,left:12,zIndex:60,background:sideBg,border:`1px solid ${border}`,borderRadius:8,width:40,height:40,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:5,padding:8,boxShadow:"0 2px 8px rgba(0,0,0,0.3)"}}>
        <span style={{width:20,height:2,background:text,borderRadius:2,transition:"all 0.3s",transform:sideOpen?"rotate(45deg) translate(5px,5px)":"none"}}/>
        <span style={{width:20,height:2,background:text,borderRadius:2,transition:"all 0.3s",opacity:sideOpen?0:1}}/>
        <span style={{width:20,height:2,background:text,borderRadius:2,transition:"all 0.3s",transform:sideOpen?"rotate(-45deg) translate(5px,-5px)":"none"}}/>
      </button>
      <aside style={{position:"fixed",top:0,left:sideOpen?0:-240,width:220,background:sideBg,borderRight:`1px solid ${border}`,padding:"24px 0",display:"flex",flexDirection:"column",height:"100vh",zIndex:50,transition:"left 0.3s ease",overflowY:"auto"}}>
        <div onClick={()=>setPage("landing")} style={{padding:"0 20px 24px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          <img src="/logo.png" alt="Tymr" style={{height:36,width:36,borderRadius:8,objectFit:"cover"}}/>
          <span style={{fontSize:20,fontWeight:800,background:"linear-gradient(90deg,#818cf8,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Tymr</span>
        </div>
        {user&&profile&&(
          <div style={{padding:"0 20px 16px",borderBottom:`1px solid ${border}`,marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:14,color:text}}>{profile.name||user.email}</div>
            <div style={{fontSize:12,color:muted}}>{profile.role||"User"}</div>
            <div style={{fontSize:11,color:muted,marginTop:2}}>{profile.institution}</div>
          </div>
        )}
        {navItems.map(n=>(
          <div key={n.id} onClick={()=>{setTab(n.id);setSideOpen(false);}} style={{padding:"12px 20px",cursor:"pointer",background:tab===n.id?(darkMode?"rgba(99,102,241,0.15)":"#eef2ff"):"transparent",borderLeft:tab===n.id?"3px solid #6366f1":"3px solid transparent",color:tab===n.id?"#818cf8":muted,fontWeight:tab===n.id?600:400}}>{n.label}</div>
        ))}
        <div style={{marginTop:"auto",padding:"16px 20px",borderTop:`1px solid ${border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:13,color:muted}}>{darkMode?"🌙 Dark":"☀️ Light"}</span>
            <div onClick={()=>setDarkMode(d=>!d)} style={{width:44,height:24,background:darkMode?"#6366f1":"#cbd5e1",borderRadius:12,cursor:"pointer",position:"relative"}}>
              <div style={{position:"absolute",top:3,left:darkMode?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.3s"}}/>
            </div>
          </div>
          {user?(
            <button onClick={handleSignOut} style={{width:"100%",background:"rgba(239,68,68,0.1)",color:"#ef4444",border:"1px solid #ef4444",borderRadius:8,padding:"8px",cursor:"pointer",fontSize:13,fontWeight:600}}>Sign Out</button>
          ):(
            <button onClick={()=>setPage("auth")} style={{width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",fontSize:13,fontWeight:600}}>Sign In / Register</button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,padding:"24px 24px 24px 68px",overflowY:"auto",minWidth:0,width:"100%"}}>
        {tab==="dashboard"&&<Dashboard profile={profile?{...profile,email:user?.email}:null} timetablesCount={profile?.timetables_count||savedTimetables.length} darkMode={darkMode} onNavigate={setTab}/>}

        {tab==="timetable"&&(
          <div>
            <h2 style={{fontSize:24,fontWeight:800,marginBottom:4}}>📅 Timetable Maker</h2>
            <p style={{color:muted,marginBottom:24}}>Upload CSV, configure schedule, generate & save.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20,marginBottom:24}}>
              <div style={{background:cardBg,borderRadius:16,padding:24,border:`1px solid ${border}`}}>
                <h3 style={{fontWeight:700,marginBottom:16}}>1. Upload CSV</h3>
                <button onClick={downloadTemplate} style={{background:"rgba(99,102,241,0.15)",color:"#818cf8",border:"1px solid #6366f1",borderRadius:8,padding:"8px 16px",cursor:"pointer",marginBottom:12,fontSize:13,fontWeight:600}}>⬇ Download Template</button>
                <div style={{border:`2px dashed ${border}`,borderRadius:12,padding:20,textAlign:"center"}}>
                  <input type="file" accept=".csv" onChange={handleCSV} style={{display:"none"}} id="csvInput"/>
                  <label htmlFor="csvInput" style={{cursor:"pointer",color:"#6366f1",fontWeight:600}}>📂 Click to Upload CSV</label>
                </div>
                {csvError&&<div style={{color:"#ef4444",fontSize:13,marginTop:8}}>{csvError}</div>}
                {subjects.length>0&&<div style={{color:"#10b981",fontSize:13,fontWeight:600,marginTop:12}}>✓ {subjects.length} subjects loaded</div>}
              </div>
              <div style={{background:cardBg,borderRadius:16,padding:24,border:`1px solid ${border}`}}>
                <h3 style={{fontWeight:700,marginBottom:16}}>2. Configure Schedule</h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["Start","start","time"],["End","end","time"],["Period (mins)","period","number"]].map(([lbl,key,type])=>(
                    <div key={key}><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>{lbl}</label>
                    <input type={type} value={config[key]} onChange={e=>setConfig(c=>({...c,[key]:type==="number"?parseInt(e.target.value)||1:e.target.value}))} style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:8,padding:"8px 10px",color:text,fontSize:13,boxSizing:"border-box"}}/></div>
                  ))}
                  <div style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" id="sat" checked={config.includeSat} onChange={e=>setConfig(c=>({...c,includeSat:e.target.checked}))}/><label htmlFor="sat" style={{fontSize:13,cursor:"pointer"}}>Include Saturday</label></div>
                </div>
                {[{key:"tea",label:"☕ Tea Break",s:"teaStart",e:"teaEnd",color:"#fbbf24"},{key:"lunch",label:"🍽 Lunch Break",s:"lunchStart",e:"lunchEnd",color:"#34d399"}].map(b=>(
                  <div key={b.key} style={{marginTop:10,background:inputBg,borderRadius:10,padding:12}}>
                    <div style={{fontSize:12,color:b.color,fontWeight:600,marginBottom:8}}>{b.label}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {[["From",b.s],["To",b.e]].map(([lbl,k])=>(
                        <div key={k}><label style={{fontSize:11,color:muted,display:"block",marginBottom:3}}>{lbl}</label>
                        <input type="time" value={config[k]} onChange={e=>setConfig(c=>({...c,[k]:e.target.value}))} style={{width:"100%",background:cardBg,border:`1px solid ${border}`,borderRadius:8,padding:"7px 10px",color:text,fontSize:13,boxSizing:"border-box"}}/></div>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:muted,marginTop:4}}>Duration: {parseTime(config[b.e])-parseTime(config[b.s])} mins</div>
                  </div>
                ))}
              </div>
            </div>

            {!user&&trialCount>=2?(
              <div style={{background:darkMode?"rgba(15,12,41,0.97)":"#f1f5f9",border:"2px solid #6366f1",borderRadius:16,padding:40,textAlign:"center",marginBottom:24}}>
                <div style={{fontSize:48,marginBottom:12}}>🔒</div>
                <h3 style={{fontWeight:800,fontSize:22,marginBottom:8}}>Trial Limit Reached</h3>
                <p style={{color:muted,marginBottom:28}}>Sign up free to unlock unlimited timetable generation!</p>
                <button onClick={()=>setPage("auth")} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:12,padding:"14px 40px",fontSize:16,fontWeight:700,cursor:"pointer"}}>🚀 Sign Up Free →</button>
              </div>
            ):(
              <>
                {!user&&<div style={{marginBottom:12,fontSize:13,color:"#a5b4fc"}}>🎯 Free Trials: <strong>{2-trialCount}</strong>/2 remaining — <span onClick={()=>setPage("auth")} style={{color:"#34d399",cursor:"pointer",fontWeight:600}}>Sign up for unlimited →</span></div>}
                <button onClick={handleGenerate} disabled={!subjects.length} style={{background:subjects.length?"linear-gradient(135deg,#6366f1,#8b5cf6)":"#334155",color:"#fff",border:"none",borderRadius:12,padding:"14px 32px",fontSize:16,fontWeight:700,cursor:subjects.length?"pointer":"not-allowed",marginBottom:24}}>
                  ⚡ Generate Timetable
                </button>
              </>
            )}

            {conflicts.length>0&&(
              <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid #ef4444",borderRadius:12,padding:16,marginBottom:20}}>
                <div style={{fontWeight:700,color:"#ef4444",marginBottom:8}}>⚠️ {conflicts.length} Conflict{conflicts.length>1?"s":""} Detected</div>
                {conflicts.map((c,i)=><div key={i} style={{fontSize:13,color:muted,marginBottom:4}}>• <strong>{c.faculty}</strong> double-booked at <strong>{c.slot}</strong> on {c.days.join(" & ")}</div>)}
              </div>
            )}

            {generated&&timetable&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <h3 style={{fontWeight:700}}>Generated Timetable <span style={{fontSize:13,color:muted,fontWeight:400}}>(drag to swap)</span></h3>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button onClick={shareWhatsApp} style={{background:"#25D366",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:600,fontSize:13}}>📲 WhatsApp</button>
                    <button onClick={downloadCSV} style={{background:"#0ea5e9",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:600,fontSize:13}}>⬇ CSV</button>
                    <button onClick={downloadPDF} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:600,fontSize:13}}>🖨 Print</button>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                  <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Name this timetable..." style={{background:inputBg,border:`1px solid ${border}`,borderRadius:8,padding:"8px 12px",color:text,fontSize:13,flex:1,minWidth:160}}/>
                  <button onClick={saveTimetable} disabled={!saveName.trim()} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:600,fontSize:13}}>💾 Save</button>
                </div>
                {uniqueFaculty.length>0&&(
                  <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <label style={{fontSize:13,color:muted}}>🧑‍🏫 Faculty Print:</label>
                    <select value={facultyView||""} onChange={e=>setFacultyView(e.target.value)} style={{background:inputBg,border:`1px solid ${border}`,borderRadius:8,padding:"6px 10px",color:text,fontSize:13}}>
                      <option value="">Select...</option>
                      {uniqueFaculty.map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                    {facultyView&&<button onClick={()=>{
                      const{grid,days,slots:sl}=timetable;
                      let html=`<html><head><style>body{font-family:Arial;font-size:12px;margin:20px}h2{color:#4f46e5}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:center}th{background:#4f46e5;color:#fff}.active{background:#ede9fe;font-weight:bold}</style></head><body><h2>Tymr – ${facultyView}</h2><table><tr><th>Day</th>${sl.filter(s=>s.type==="class").map(s=>`<th>${s.label}</th>`).join("")}</tr>`;
                      days.forEach(d=>{html+=`<tr><td><b>${d.slice(0,3)}</b></td>`;sl.filter(s=>s.type==="class").forEach(s=>{const c=grid[d][s.index];html+=c&&c.faculty===facultyView?`<td class="active">${c.subject}</td>`:`<td>—</td>`;});html+=`</tr>`;});
                      html+=`</table></body></html>`;
                      const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
                    }} style={{background:"#8b5cf6",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:600}}>🖨 Print</button>}
                  </div>
                )}
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",fontSize:12,minWidth:600}}>
                    <thead>
                      <tr>
                        <th style={{background:darkMode?"#1e293b":"#e2e8f0",border:`1px solid ${border}`,padding:"10px 14px",textAlign:"left",minWidth:80}}>Day</th>
                        {timetable.slots.map((s,i)=><th key={i} style={{background:s.type==="tea"?"#78350f44":s.type==="lunch"?"#14532d44":(darkMode?"#1e3a5f":"#eff6ff"),border:`1px solid ${border}`,padding:"8px 10px",minWidth:90,whiteSpace:"nowrap",color:s.type==="tea"?"#fbbf24":s.type==="lunch"?"#34d399":(darkMode?"#93c5fd":"#1d4ed8"),fontSize:11}}>{s.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {timetable.days.map(day=>(
                        <tr key={day}>
                          <td style={{background:darkMode?"#1e293b":"#f8fafc",border:`1px solid ${border}`,padding:"8px 14px",fontWeight:600,fontSize:12}}>{day.slice(0,3)}</td>
                          {timetable.slots.map((s,i)=>{
                            if(s.type==="tea")return<td key={i} style={{background:"#78350f33",border:`1px solid ${border}`,padding:8,textAlign:"center",color:"#fbbf24",fontSize:11}}>☕ Tea</td>;
                            if(s.type==="lunch")return<td key={i} style={{background:"#14532d33",border:`1px solid ${border}`,padding:8,textAlign:"center",color:"#34d399",fontSize:11}}>🍽 Lunch</td>;
                            const cell=timetable.grid[day][s.index];
                            const isConflict=conflicts.some(c=>c.slot===s.label&&c.days.includes(day));
                            return(
                              <td key={i} draggable onDragStart={()=>handleDragStart(day,s.index)} onDragOver={e=>e.preventDefault()} onDrop={()=>handleDrop(day,s.index)}
                                style={{border:`1px solid ${isConflict?"#ef4444":border}`,padding:"6px 8px",background:cell?(subjectColors[cell.subject]+"22"):"transparent",textAlign:"center",cursor:"grab",outline:isConflict?"2px solid #ef4444":"none",minWidth:90}}>
                                {cell?(<><div style={{fontWeight:700,color:subjectColors[cell.subject],fontSize:11}}>{cell.subject}</div><div style={{color:muted,fontSize:10}}>{cell.faculty}</div>{cell.room&&<div style={{color:muted,fontSize:9}}>[{cell.room}]</div>}{cell.isLab&&<div style={{color:"#a78bfa",fontSize:9}}>🔬 Lab</div>}</>):<span style={{color:darkMode?"#334155":"#cbd5e1",fontSize:16}}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{marginTop:16,display:"flex",flexWrap:"wrap",gap:8}}>
                  {subjects.map(s=><div key={s.subject} style={{display:"flex",alignItems:"center",gap:6,background:cardBg,border:`1px solid ${border}`,borderRadius:20,padding:"4px 12px",fontSize:12}}><div style={{width:8,height:8,borderRadius:"50%",background:subjectColors[s.subject]}}/>{s.subject}{s.type==="P"&&<span style={{color:"#a78bfa",fontSize:10}}>(Lab)</span>}</div>)}
                </div>
              </div>
            )}
            {savedTimetables.length>0&&(
              <div style={{marginTop:32}}>
                <h3 style={{fontWeight:700,marginBottom:12}}>💾 Saved Timetables</h3>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
                  {savedTimetables.map((t,i)=>(
                    <div key={i} style={{background:cardBg,border:`1px solid ${border}`,borderRadius:12,padding:16}}>
                      <div style={{fontWeight:700,marginBottom:4}}>{t.name}</div>
                      <div style={{color:muted,fontSize:12,marginBottom:12}}>Saved {t.date}</div>
                      <button onClick={()=>{setTimetable(t.timetable);setSubjects(t.subjects);setConfig(t.config);setGenerated(true);setConflicts(detectConflicts(t.timetable.grid,t.timetable.days,t.timetable.slots));}} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:600}}>📂 Load</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="exam"&&!viewExam&&(
          <div>
            <h2 style={{fontSize:24,fontWeight:800,marginBottom:4}}>📝 Exam Schedule</h2>
            <p style={{color:muted,marginBottom:24}}>Create exam timetables with seating arrangements.</p>
            <div style={{background:cardBg,borderRadius:16,padding:24,border:`1px solid ${border}`,marginBottom:24,maxWidth:700}}>
              <h3 style={{fontWeight:700,marginBottom:16}}>Create New Exam</h3>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[["Exam Title","title","text"],["Date","date","date"],["Time","time","time"],["Duration (hrs)","duration","number"],["Exam Hall","hall","text"]].map(([lbl,key,type])=>(
                  <div key={key}><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>{lbl}</label>
                  <input type={type} value={examForm[key]} onChange={e=>setExamForm(f=>({...f,[key]:e.target.value}))} style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:8,padding:"8px 10px",color:text,fontSize:13,boxSizing:"border-box"}}/></div>
                ))}
                <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Seating</label>
                <select value={examForm.seating} onChange={e=>setExamForm(f=>({...f,seating:e.target.value}))} style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:8,padding:"8px 10px",color:text,fontSize:13}}>
                  <option value="alternate">Alternate</option><option value="consecutive">Consecutive</option><option value="random">Random</option>
                </select></div>
                <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Rows</label><input type="number" min={1} max={20} value={examForm.rows} onChange={e=>setExamForm(f=>({...f,rows:parseInt(e.target.value)||1}))} style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:8,padding:"8px 10px",color:text,fontSize:13,boxSizing:"border-box"}}/></div>
                <div><label style={{fontSize:12,color:muted,display:"block",marginBottom:4}}>Columns</label><input type="number" min={1} max={20} value={examForm.cols} onChange={e=>setExamForm(f=>({...f,cols:parseInt(e.target.value)||1}))} style={{width:"100%",background:inputBg,border:`1px solid ${border}`,borderRadius:8,padding:"8px 10px",color:text,fontSize:13,boxSizing:"border-box"}}/></div>
              </div>
              <button onClick={addExam} style={{marginTop:16,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:10,padding:"12px 28px",fontWeight:700,cursor:"pointer"}}>+ Add Exam</button>
            </div>
            {exams.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
              {exams.map(ex=><div key={ex.id} style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:20}}>
                <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{ex.title}</div>
                <div style={{color:muted,fontSize:13,lineHeight:1.8}}>📅 {ex.date} at {ex.time}<br/>⏱ {ex.duration} hr(s) | 🏛 {ex.hall}<br/>🪑 {ex.rows}×{ex.cols} | {ex.seating}</div>
                <button onClick={()=>setViewExam(ex)} style={{marginTop:12,background:"rgba(99,102,241,0.15)",color:"#818cf8",border:"1px solid #6366f1",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:600}}>View Seating →</button>
              </div>)}
            </div>}
          </div>
        )}

        {tab==="exam"&&viewExam&&(
          <div>
            <button onClick={()=>setViewExam(null)} style={{background:cardBg,color:text,border:`1px solid ${border}`,borderRadius:8,padding:"8px 16px",cursor:"pointer",marginBottom:20,fontWeight:600}}>← Back</button>
            <div style={{background:cardBg,borderRadius:16,padding:24,border:`1px solid ${border}`,maxWidth:900}}>
              <h2 style={{fontWeight:800,marginBottom:4}}>{viewExam.title}</h2>
              <p style={{color:muted,fontSize:14,marginBottom:20}}>📅 {viewExam.date} | ⏰ {viewExam.time} | ⏱ {viewExam.duration} hr(s) | 🏛 {viewExam.hall}</p>
              <div style={{background:inputBg,borderRadius:8,padding:8,textAlign:"center",color:muted,fontSize:12,marginBottom:16,letterSpacing:4}}>── FRONT / STAGE ──</div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",margin:"0 auto"}}>
                  <tbody>{Array.from({length:viewExam.rows},(_,r)=><tr key={r}>{Array.from({length:viewExam.cols},(_,c)=>{const idx=r*viewExam.cols+c;const occ=viewExam.seating==="consecutive"?true:viewExam.seating==="alternate"?(r+c)%2===0:Math.random()>0.3;return<td key={c} style={{border:`1px solid ${border}`,width:60,height:38,textAlign:"center",fontSize:10,background:occ?"rgba(99,102,241,0.2)":inputBg,color:occ?"#818cf8":muted,borderRadius:4}}>{occ?viewExam.rolls[idx]:"—"}</td>;})}</tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab==="attendance"&&<AttendanceRegister darkMode={darkMode}/>}
      </main>
    </div>
  );
}