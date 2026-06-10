import React from "react";
import { DATA } from "../data/mockData";
import { API } from "../api/client";
import { useStore, navigate, matchCampaign, useCountUp, useInView, scoreColor, riskBadge } from "../store/store";
import { Icon, Btn, Badge, Tag, ScoreBar, Gauge, AppShell, Stepper, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /campaigns/:id/experiment  — Experiment Builder
   ============================================================ */
function CellChip({v,selected,onToggle}){
  return (
    <button onClick={onToggle} className="card" style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:11,cursor:"pointer",textAlign:"left",
      borderColor:selected?"var(--ink)":"var(--line)",background:selected?"var(--surface)":"var(--surface-warm)",
      boxShadow:selected?"var(--shadow)":"none",transition:".15s",width:"100%"}}>
      <span style={{width:32,height:32,borderRadius:9,background:v.grad,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font-display)",fontWeight:800,flex:"0 0 32px"}}>{v.letter}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13.5}}>{v.angle}</div>
        <div className="muted" style={{fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v.headline}</div>
      </div>
      <span style={{width:20,height:20,borderRadius:6,border:`1.5px solid ${selected?"var(--ink)":"var(--line-2)"}`,background:selected?"var(--ink)":"transparent",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flex:"0 0 20px"}}>{selected&&<Icon name="check" size={13}/>}</span>
    </button>
  );
}

function variantId(v){
  return v?.letter || v?.id;
}

export default function Experiment({route}){
  const D=DATA, {state,set}=useStore();
  const cm=matchCampaign(route), campaignId=cm&&cm.id;
  const E=D.experiment;
  const [cells,setCells]=React.useState(state.selectedVariants||E.cells);
  const [budget,setBudget]=React.useState(E.budget);
  const [days,setDays]=React.useState(E.days);
  const [variable,setVariable]=React.useState(E.variable);
  const [hypo,setHypo]=React.useState(E.hypothesis);
  const [launching,setLaunching]=React.useState(false);
  const [launchStep,setLaunchStep]=React.useState(0);
  const [variants,setVariants]=React.useState(D.variants);
  const [loadError,setLoadError]=React.useState("");

  React.useEffect(()=>{
    if(!campaignId){ setVariants(D.variants); return; }
    let alive=true;
    setLoadError("");
    API.listVariants(campaignId)
      .then(rows=>{ if(alive && rows && rows.length) setVariants(rows); })
      .catch(e=>alive&&setLoadError(`Using demo variants in the experiment builder: ${e.message}`));
    return ()=>{alive=false};
  },[campaignId]);

  const toggle=(id)=>setCells(c=>c.includes(id)?c.filter(x=>x!==id):c.length<5?[...c,id]:c);
  const valid=cells.length>=2 && cells.length<=5;
  const sample=Math.round(budget*days*6.8);
  const displayVariants=variants.length?variants:D.variants;

  const LAUNCH=["Creating campaign on Meta…","Building "+cells.length+" ad sets (one per cell)…","Uploading generated creatives…","Setting audience & budget split…","Starting the A/B test…"];

  const launch=()=>{
    set({selectedVariants:cells, experimentConfigured:true});
    setLaunching(true); setLaunchStep(0);
    let s=0;
    const t=setInterval(()=>{
      s++; setLaunchStep(s);
      if(s>=LAUNCH.length){ clearInterval(t);
        setTimeout(()=>{ set({launched:true}); navigate(`/campaigns/${campaignId}/analytics`); },600);
      }
    },560);
  };

  return (
    <AppShell route={route} title={state.campaignTitle||D.campaignTitle} crumb="Campaign · Experiment Builder"
      actions={<Tag icon="flask">Meta · split test</Tag>} wide>
      <div style={{marginBottom:22}}><Stepper current="experiment" campaignId={campaignId}/></div>
      <SectionHead eyebrow="Step 7 · Test cleanly"
        title="Experiment Builder"
        desc="One hypothesis. One variable. A defined stopping rule. The platform won’t let you run a messy test."/>
      {loadError && <div className="card card-pad" style={{marginBottom:16,background:"var(--warn-soft)",color:"var(--warn)"}}>{loadError}</div>}

      {launching ? (
        <div className="card card-pad pop" style={{maxWidth:580,margin:"0 auto"}}>
          <div className="row" style={{gap:12,marginBottom:20}}>
            <Icon name="send" className="spin" style={{color:"var(--info)"}}/>
            <span style={{fontWeight:700,fontSize:16}}>Launching on Meta…</span>
          </div>
          <div className="col" style={{gap:11}}>
            {LAUNCH.map((s,i)=>{
              const st=i<launchStep?"done":i===launchStep?"active":"todo";
              return (
                <div key={i} className="row" style={{gap:12,opacity:st==="todo"?.4:1,transition:".3s"}}>
                  <span style={{width:22,height:22,borderRadius:99,flex:"0 0 22px",display:"flex",alignItems:"center",justifyContent:"center",background:st==="done"?"var(--good)":st==="active"?"var(--ink)":"var(--canvas-2)",color:st==="todo"?"var(--ink-3)":"#fff"}}>{st==="done"?<Icon name="check" size={13}/>:st==="active"?<Icon name="loop" size={12} className="spin"/>:i+1}</span>
                  <span style={{fontSize:14,color:st==="todo"?"var(--ink-3)":"var(--ink-2)",fontWeight:st==="active"?600:400}}>{s}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div className="grid" style={{gridTemplateColumns:"1.5fr 1fr",gap:20,alignItems:"start"}}>
        <div className="col" style={{gap:16}}>
          {/* hypothesis */}
          <div className="card card-pad">
            <div className="row" style={{gap:9,marginBottom:13}}><span style={{width:26,height:26,borderRadius:8,background:"var(--ink)",color:"var(--canvas)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flex:"0 0 26px"}}>1</span><h3 style={{fontSize:16}}>State your hypothesis</h3></div>
            <textarea className="textarea" value={hypo} onChange={e=>setHypo(e.target.value)}/>
          </div>

          {/* variable */}
          <div className="card card-pad">
            <div className="row" style={{gap:9,marginBottom:13}}><span style={{width:26,height:26,borderRadius:8,background:"var(--ink)",color:"var(--canvas)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flex:"0 0 26px"}}>2</span><h3 style={{fontSize:16}}>Isolate one variable</h3></div>
            <div className="row wrap" style={{gap:9}}>
              {[["creative","Creative"],["copy","Copy"],["audience","Audience"],["placement","Placement"]].map(([k,l])=>(
                <button key={k} className="tag" onClick={()=>setVariable(k)} style={{cursor:"pointer",fontWeight:600,...(variable===k?{background:"var(--ink)",color:"var(--canvas)",borderColor:"var(--ink)"}:{})}}>{l}</button>
              ))}
            </div>
            <p className="muted" style={{fontSize:12.5,marginTop:11}}><Icon name="check" size={13} style={{color:"var(--good)",verticalAlign:"-2px",marginRight:5}}/>Only the <b>{variable}</b> changes between cells — everything else is held constant. Clean read guaranteed.</p>
          </div>

          {/* cells */}
          <div className="card card-pad">
            <div className="row between" style={{marginBottom:13}}>
              <div className="row" style={{gap:9}}><span style={{width:26,height:26,borderRadius:8,background:"var(--ink)",color:"var(--canvas)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flex:"0 0 26px"}}>3</span><h3 style={{fontSize:16}}>Pick treatment cells</h3></div>
              <Badge tone={valid?"good":"warn"}>{cells.length} / 5 cells</Badge>
            </div>
            <div className="col" style={{gap:9}}>
              {displayVariants.map(v=><CellChip key={variantId(v)} v={v} selected={cells.includes(variantId(v))} onToggle={()=>toggle(variantId(v))}/>)}
            </div>
            <p className="muted" style={{fontSize:12,marginTop:11}}>Meta supports 2–5 cells per creative split test. Variant B is selectable but carries an IP flag.</p>
          </div>
        </div>

        {/* config sidebar */}
        <div className="col" style={{gap:16}}>
          <div className="card card-pad" style={{position:"sticky",top:84}}>
            <div className="eyebrow" style={{marginBottom:16}}>Test configuration</div>

            <div className="field" style={{marginBottom:18}}>
              <div className="row between"><span className="label">Daily budget</span><span className="mono" style={{fontWeight:700}}>${budget}/day</span></div>
              <input type="range" min="30" max="300" step="10" value={budget} onChange={e=>setBudget(+e.target.value)} style={{accentColor:"var(--ink)",width:"100%"}}/>
            </div>
            <div className="field" style={{marginBottom:18}}>
              <div className="row between"><span className="label">Duration</span><span className="mono" style={{fontWeight:700}}>{days} days</span></div>
              <input type="range" min="1" max="7" step="1" value={days} onChange={e=>setDays(+e.target.value)} style={{accentColor:"var(--ink)",width:"100%"}}/>
            </div>

            <div className="divider" style={{margin:"4px 0 16px"}}/>

            <div className="col" style={{gap:12}}>
              <div className="row between"><span className="soft" style={{fontSize:13}}>Audience</span><span style={{fontSize:13,fontWeight:600,textAlign:"right",maxWidth:160}}>{E.audience}</span></div>
              <div className="row between"><span className="soft" style={{fontSize:13}}>Est. sample size</span><span className="mono" style={{fontWeight:700}}>{sample.toLocaleString()}</span></div>
              <div className="row between"><span className="soft" style={{fontSize:13}}>Total spend</span><span className="mono" style={{fontWeight:700}}>${(budget*days).toLocaleString()}</span></div>
              <div className="row between"><span className="soft" style={{fontSize:13}}>Stopping rule</span><span style={{fontSize:13,fontWeight:600}}>{E.stopRule}</span></div>
            </div>

            <div className="card" style={{padding:"11px 13px",background:"var(--canvas-2)",marginTop:16}}>
              <div className="row" style={{gap:8}}><Icon name="check" size={15} style={{color:"var(--good)"}}/><span style={{fontSize:12.5,fontWeight:600}}>Powered to detect a ~12% CPC lift at 95%.</span></div>
            </div>

            <Btn variant="brand" size="lg" icon="send" style={{width:"100%",marginTop:18}} disabled={!valid} onClick={launch}>Launch A/{cells.length>2?"B/C":"B"} test on Meta</Btn>
            <p className="muted" style={{fontSize:11.5,textAlign:"center",marginTop:10}}>Creatives upload automatically · auto-pause on underperformance</p>
          </div>
        </div>
      </div>
      )}
    </AppShell>
  );
}
