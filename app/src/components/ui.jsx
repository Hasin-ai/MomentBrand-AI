/* ============================================================
   Shared UI: icons, primitives, AppShell (sidebar/topbar/stepper)
   ============================================================ */
import React, { useState as useStateU, useEffect as useEffectU } from "react";
import { navigate, scoreColor, useCountUp, useStore } from "../store/store";


/* ---------------- icons (stroke, currentColor) ---------------- */
const Ic = {
  dash:"M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  radar:"M12 3a9 9 0 1 0 9 9 M12 12l5-3 M12 12a3 3 0 1 0 3 3",
  brain:"M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 2V4z M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 2V4z",
  flask:"M9 3h6 M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3 M7 15h10",
  chart:"M4 4v16h16 M8 16v-5 M12 16V8 M16 16v-8",
  trophy:"M7 4h10v4a5 5 0 0 1-10 0V4z M5 5H3v2a3 3 0 0 0 3 3 M19 5h2v2a3 3 0 0 0-3 3 M9 16h6 M10 20h4 M12 14v2",
  spark:"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  bolt:"M13 2 4 14h7l-1 8 9-12h-7z",
  plus:"M12 5v14 M5 12h14",
  check:"M5 12l5 5 9-11",
  arrow:"M5 12h14 M13 6l6 6-6 6",
  back:"M19 12H5 M11 18l-6-6 6-6",
  cal:"M4 5h16v16H4z M4 9h16 M8 3v4 M16 3v4",
  shield:"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  layers:"M12 3l9 5-9 5-9-5z M3 13l9 5 9-5",
  target:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 12h.01",
  loop:"M21 12a9 9 0 1 1-3-6.7 M21 4v4h-4",
  edit:"M4 20h4L19 9l-4-4L4 16z M14 6l4 4",
  send:"M22 2 11 13 M22 2l-7 20-4-9-9-4z",
  flag:"M5 21V4 M5 4h11l-2 4 2 4H5",
  eye:"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  doc:"M6 2h8l4 4v16H6z M14 2v4h4 M9 13h6 M9 17h6",
  user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  fire:"M12 3c1 3-1 4-1 6a3 3 0 0 0 5 2c1 4-1 10-4 10s-7-3-7-8c0-3 2-4 3-6 1 2 2 2 3 1 1-1 2-3 1-5z",
  clock:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
};
export function Icon({name,size,style,cls,className}){
  const d = Ic[name]||"";
  return React.createElement("svg",{width:size||18,height:size||18,viewBox:"0 0 24 24",fill:"none",
    stroke:"currentColor","strokeWidth":1.7,"strokeLinecap":"round","strokeLinejoin":"round",style,className:cls||className},
    d.split(" M").map((seg,i)=>React.createElement("path",{key:i,d:(i?"M":"")+seg})));
}

/* ---------------- primitives ---------------- */
export function Btn({variant="primary",size,children,icon,iconRight,onClick,disabled,style,type}){
  const cls = `btn btn-${variant}${size?` btn-${size}`:""}`;
  return (
    <button type={type||"button"} className={cls} onClick={onClick} disabled={disabled} style={style}>
      {icon && <Icon name={icon}/>}
      {children}
      {iconRight && <Icon name={iconRight}/>}
    </button>
  );
}
export function Badge({tone="soft",children,icon}){
  return <span className={`badge badge-${tone}`}>{icon&&<Icon name={icon}/>}{children}</span>;
}
export function Tag({children,icon}){ return <span className="tag">{icon&&<Icon name={icon} size={13}/>}{children}</span>; }

export function ScoreBar({value,color,run=true,delay=0}){
  const [w,setW]=useStateU(run?0:value);
  useEffectU(()=>{ if(!run){setW(value);return;} const t=setTimeout(()=>setW(value),60+delay); return ()=>clearTimeout(t); },[value,run]);
  return <div className="scorebar"><span style={{width:w+"%",background:color||scoreColor(value)}}/></div>;
}

/* radial gauge for composite score */
export function Gauge({value,size=132,label,color,run=true}){
  const shown = useCountUp(value,{run,duration:1300});
  const r=(size-16)/2, c=2*Math.PI*r, off=c-(value/100)*c;
  return (
    <div style={{position:"relative",width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--canvas-2)" strokeWidth="9"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color||"var(--neural)"} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={run?off:off}
          style={{transition:"stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div className="kpi" style={{fontSize:size*.28,color:color||"var(--neural)"}}>{shown}</div>
        {label&&<div className="eyebrow" style={{marginTop:2}}>{label}</div>}
      </div>
    </div>
  );
}

export function Logo({size=20,light}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:9,fontFamily:"var(--font-display)",fontWeight:800,fontSize:size,letterSpacing:"-.02em",color:light?"var(--canvas)":"var(--ink)"}}>
      <span style={{display:"inline-flex",width:size*1.32,height:size*1.32,borderRadius:size*.34,background:"var(--ink)",color:"var(--canvas)",alignItems:"center",justifyContent:"center",fontSize:size*.8}}>◴</span>
      MomentBrand<span style={{color:"var(--brand)"}}>.</span>
    </div>
  );
}

/* ---------------- app shell ---------------- */
function buildNav(activeCampaignId, campaignTitle){
  const nav=[
    {sec:"Workspace"},
    {label:"Dashboard", icon:"dash", path:"/dashboard"},
    {label:"Event Radar", icon:"radar", path:"/events"},
    {label:"Brand Brain", icon:"brain", path:"/brand/setup"},
    {label:"Brain Response", icon:"target", path:"/brain-response"},
  ];
  if(activeCampaignId){
    nav.push(
      {sec:"Campaign · "+(campaignTitle||"Active campaign")},
      {label:"Context", icon:"doc", path:`/campaigns/${activeCampaignId}/context`},
      {label:"Ad Layout", icon:"layers", path:`/campaigns/${activeCampaignId}/layout`},
      {label:"Ad Concept", icon:"edit", path:`/campaigns/${activeCampaignId}/concept`},
      {label:"Ad Generation", icon:"spark", path:`/campaigns/${activeCampaignId}/studio`},
      {label:"Scoring", icon:"target", path:`/campaigns/${activeCampaignId}/scoring`},
      {label:"Experiment", icon:"flask", path:`/campaigns/${activeCampaignId}/experiment`},
      {label:"Analytics", icon:"chart", path:`/campaigns/${activeCampaignId}/analytics`},
      {label:"Winner", icon:"trophy", path:`/campaigns/${activeCampaignId}/winner`},
    );
  }
  return nav;
}

export function Sidebar({route}){
  const {state}=useStore();
  const NAV=buildNav(state.activeCampaignId,state.campaignTitle);
  const brandName = state.brandName || "Brand Brain";
  const brandCategory = state.brandCategory || "Not connected";
  const brandColor = state.brandColor || "var(--ink)";
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || "B";
  return (
    <aside className="sidebar">
      <div style={{padding:"4px 8px 14px"}}><Logo size={18}/></div>
      <div className="brandswitch" onClick={()=>navigate("/brand/setup")}>
        <div className="brandmark" style={{background:brandColor}}>{brandInitial}</div>
        <div style={{lineHeight:1.15,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13.5}}>{brandName}</div>
          <div className="muted" style={{fontSize:11.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{brandCategory}</div>
        </div>
        <Icon name="layers" size={15} style={{marginLeft:"auto",opacity:.5}}/>
      </div>
      <div style={{overflowY:"auto",margin:"0 -6px",padding:"0 6px"}}>
      {NAV.map((n,i)=> n.sec
        ? <div key={i} className="navsec">{n.sec}</div>
        : <a key={i} className={`navitem${route.startsWith(n.path)?" active":""}`} href={"#"+n.path}>
            <Icon name={n.icon}/>{n.label}
          </a>
      )}
      </div>
      <div style={{marginTop:"auto",padding:"12px 10px 4px"}}>
        <div className="card" style={{padding:"12px 13px",background:"var(--surface-warm)"}}>
          <div className="row between" style={{marginBottom:7}}>
            <span className="eyebrow">Plan</span><Badge tone="ink">Growth</Badge>
          </div>
          <div className="muted" style={{fontSize:12}}>Unlimited campaigns · Meta API · A/B testing</div>
        </div>
      </div>
    </aside>
  );
}

export function Topbar({title,crumb,actions}){
  return (
    <header className="topbar">
      <div style={{minWidth:0,display:"flex",flexDirection:"column",justifyContent:"center"}}>
        {crumb && <div className="eyebrow" style={{marginBottom:2,whiteSpace:"nowrap"}}>{crumb}</div>}
        <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:18,letterSpacing:"-.02em",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
      </div>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>{actions}</div>
    </header>
  );
}

/* campaign flow stepper */
export function campaignFlow(campaignId){
  const id=campaignId||"";
  return [
    {step:"context", label:"Context", path:`/campaigns/${id}/context`},
    {step:"layout", label:"Layout", path:`/campaigns/${id}/layout`},
    {step:"concept", label:"Concept", path:`/campaigns/${id}/concept`},
    {step:"studio", label:"Generate", path:`/campaigns/${id}/studio`},
    {step:"scoring", label:"Score", path:`/campaigns/${id}/scoring`},
    {step:"experiment", label:"Experiment", path:`/campaigns/${id}/experiment`},
    {step:"analytics", label:"Measure", path:`/campaigns/${id}/analytics`},
    {step:"winner", label:"Winner", path:`/campaigns/${id}/winner`},
  ];
}
export function Stepper({current,campaignId}){
  const {state}=useStore();
  const flow=campaignFlow(campaignId||state.activeCampaignId);
  const reached = (step)=>{
    const flags={context:state.campaignContextSaved,layout:state.campaignLayoutSaved,concept:state.campaignConceptSaved,studio:state.variantsGenerated,scoring:state.scored,experiment:state.experimentConfigured,analytics:state.launched,winner:state.winnerDeclared};
    return flags[step];
  };
  return (
    <div className="stepper">
      {flow.map((f,i)=>{
        const isCur=f.step===current;
        const done=reached(f.step) && !isCur;
        const clickable=done||isCur||i===0||reached(flow[Math.max(0,i-1)].step);
        return (
          <React.Fragment key={f.step}>
            {i>0 && <span className="step-line"/>}
            <div className={`step ${isCur?"current":done?"done":""} ${clickable?"clickable":""}`}
                 onClick={()=>clickable&&navigate(f.path)}>
              <span className="scircle">{done?<Icon name="check" size={13}/>:i+1}</span>{f.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function EmptyState({title,msg,cta,to}){
  return (
    <div className="card" style={{padding:"52px 28px",textAlign:"center",maxWidth:560,margin:"32px auto",background:"var(--surface-warm)"}}>
      <div style={{display:"inline-flex",width:54,height:54,borderRadius:16,background:"var(--canvas-2)",color:"var(--ink-2)",alignItems:"center",justifyContent:"center",marginBottom:18}}><Icon name="flag" size={24}/></div>
      <h3 style={{fontSize:20,marginBottom:10}}>{title}</h3>
      {msg&&<p className="soft" style={{fontSize:14.5,lineHeight:1.55,marginBottom:cta?22:0}}>{msg}</p>}
      {cta&&<Btn variant="primary" iconRight="arrow" onClick={()=>navigate(to)}>{cta}</Btn>}
    </div>
  );
}

/* full app frame */
export function AppShell({route,title,crumb,actions,children,wide}){
  return (
    <div className="shell">
      <Sidebar route={route}/>
      <div className="main">
        <Topbar title={title} crumb={crumb} actions={actions}/>
        <div className={`page${wide?" page-wide":""} route-enter`} key={route}>{children}</div>
      </div>
    </div>
  );
}

/* simple section heading */
export function SectionHead({eyebrow,title,desc,right}){
  return (
    <div className="row between wrap" style={{gap:16,alignItems:"flex-end",marginBottom:18}}>
      <div style={{maxWidth:680}}>
        {eyebrow && <div className="eyebrow" style={{marginBottom:8}}>{eyebrow}</div>}
        <h2 style={{fontSize:26,marginBottom:desc?8:0}}>{title}</h2>
        {desc && <p className="soft" style={{fontSize:15,lineHeight:1.5}}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}
