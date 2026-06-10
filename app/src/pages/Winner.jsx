import React from "react";
import { DATA } from "../data/mockData";
import { API } from "../api/client";
import { useStore, navigate, matchCampaign, useCountUp, useInView, scoreColor, riskBadge } from "../store/store";
import { Icon, Btn, Badge, Tag, ScoreBar, Gauge, AppShell, Stepper, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /campaigns/:id/winner  — Winner + Learning Loop
   ============================================================ */
export default function Winner({route}){
  const D=DATA, {state,set,hardReset}=useStore();
  const cm=matchCampaign(route), campaignId=cm&&cm.id;
  const W=D.winner;
  const declared=state.winnerDeclared;
  const [reveal,setReveal]=React.useState(declared);
  const v=D.variants.find(x=>x.id===W.cell);
  const perf=D.analytics.variants[W.cell];

  React.useEffect(()=>{ if(!declared){ const t=setTimeout(()=>{setReveal(true); set({winnerDeclared:true});},400); return ()=>clearTimeout(t);} },[]);

  const saveLearning=()=>set({learningSaved:true});

  return (
    <AppShell route={route} title={state.campaignTitle||D.campaignTitle} crumb="Campaign · Winner" wide
      actions={<Btn variant="soft" size="sm" icon="loop" onClick={()=>{hardReset();navigate("/events");}}>Start new campaign</Btn>}>
      <div style={{marginBottom:22}}><Stepper current="winner" campaignId={campaignId}/></div>

      {/* hero winner */}
      <div className="card" style={{overflow:"hidden",marginBottom:20,opacity:reveal?1:0,transform:reveal?"none":"scale(.97)",transition:".6s cubic-bezier(.2,.9,.3,1.2)"}}>
        <div style={{background:"var(--ink)",color:"var(--canvas)",padding:"30px 32px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(560px 280px at 78% -20%,rgba(31,122,77,.45),transparent 60%)"}}/>
          <div className="row between wrap" style={{gap:20,position:"relative"}}>
            <div style={{maxWidth:540}}>
              <div className="row" style={{gap:9,marginBottom:14}}><Icon name="trophy" style={{color:"#FFD15C"}}/><span className="eyebrow" style={{color:"rgba(244,240,231,.7)"}}>Step 9 · Winner declared</span></div>
              <h2 className="display" style={{fontSize:34,color:"var(--canvas)",marginBottom:10}}>Variant {W.cell} — {v.angle}</h2>
              <p style={{color:"rgba(244,240,231,.78)",fontSize:15,lineHeight:1.55}}>{W.summary}</p>
            </div>
            <div className="row" style={{gap:26}}>
              <div style={{textAlign:"center"}}>
                <div className="kpi" style={{fontSize:44,color:"#FF8A7A"}}>{W.cpcDelta}%</div>
                <div className="eyebrow" style={{color:"rgba(244,240,231,.6)"}}>CPC</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div className="kpi" style={{fontSize:44,color:"#9BE3B6"}}>+{W.intentDelta}%</div>
                <div className="eyebrow" style={{color:"rgba(244,240,231,.6)"}}>Purchase intent</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div className="kpi" style={{fontSize:44,color:"#FFD15C"}}>{W.roas}×</div>
                <div className="eyebrow" style={{color:"rgba(244,240,231,.6)"}}>ROAS</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{padding:"18px 22px"}} className="row between wrap">
          <div className="row" style={{gap:14}}>
            <span style={{width:46,height:46,borderRadius:12,background:v.grad,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontFamily:"var(--font-display)",fontSize:20,flex:"0 0 46px"}}>{v.letter}</span>
            <div><div style={{fontWeight:700}}>“{v.headline}”</div><div className="muted" style={{fontSize:13}}>{v.platform} · {v.audienceSeg}</div></div>
          </div>
          <Btn variant="brand" icon="bolt">Scale budget to winner</Btn>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:"1.4fr 1fr",gap:20,alignItems:"start"}}>
        {/* learnings */}
        <div className="card card-pad">
          <div className="row between" style={{marginBottom:16}}>
            <div className="row" style={{gap:9}}><Icon name="loop" style={{color:"var(--brand)"}}/><h3 style={{fontSize:17}}>What we learned</h3></div>
            <Badge tone="soft">4 insights</Badge>
          </div>
          <div className="col" style={{gap:11}}>
            {W.learnings.map((l,i)=>(
              <div key={i} className="row" style={{gap:12,padding:"12px 14px",background:"var(--surface-warm)",borderRadius:12,
                opacity:reveal?1:0,transform:reveal?"none":"translateX(-10px)",transition:`.5s ${0.3+i*.1}s ease`}}>
                <span style={{width:24,height:24,borderRadius:99,background:"var(--ink)",color:"var(--canvas)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flex:"0 0 24px"}}>{i+1}</span>
                <span style={{fontSize:14,lineHeight:1.5,color:"var(--ink-2)"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* learning loop + next test */}
        <div className="col" style={{gap:16}}>
          <div className="card card-pad">
            <div className="eyebrow" style={{marginBottom:13}}>Learning Loop · Brand Brain update</div>
            {state.learningSaved ? (
              <div className="pop">
                <div className="row" style={{gap:10,marginBottom:10}}><span style={{width:34,height:34,borderRadius:10,background:"var(--good)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flex:"0 0 34px"}}><Icon name="check"/></span><div><div style={{fontWeight:700}}>Saved to Cresta’s Brand Brain</div><div className="muted" style={{fontSize:12.5}}>Every future campaign starts smarter</div></div></div>
                <div className="card" style={{padding:"12px 14px",background:"var(--good-soft)",fontSize:13,color:"var(--ink-2)",lineHeight:1.5,fontStyle:"italic"}}>
                  “For Cresta, football watch-party ads using friendship language outperform victory/competition language among 18–34 users. Optimal publish window: ~90 min before kickoff.”
                </div>
              </div>
            ):(
              <>
                <p className="soft" style={{fontSize:13.5,lineHeight:1.55,marginBottom:16}}>Write these results back to the Brand Brain so the next campaign inherits them automatically — the institutional memory compounds.</p>
                <Btn variant="primary" icon="brain" style={{width:"100%"}} onClick={saveLearning}>Save learnings to Brand Brain</Btn>
              </>
            )}
          </div>

          <div className="card card-pad" style={{background:"var(--surface-warm)"}}>
            <div className="row" style={{gap:9,marginBottom:11}}><Icon name="target" style={{color:"var(--neural)"}}/><h3 style={{fontSize:15}}>What to test next</h3></div>
            <p className="soft" style={{fontSize:14,lineHeight:1.55,marginBottom:16}}>{W.nextTest}</p>
            <Btn variant="soft" iconRight="arrow" style={{width:"100%"}} onClick={()=>{hardReset();navigate("/events");}}>Start the next test</Btn>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
