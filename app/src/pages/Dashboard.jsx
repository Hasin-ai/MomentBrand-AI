import React from "react";
import { DATA } from "../data/mockData";
import { useStore, navigate, useCountUp } from "../store/store";
import { Icon, Btn, Badge, Tag, ScoreBar, AppShell, campaignFlow } from "../components/ui";

/* ============================================================
   Route: /dashboard
   ============================================================ */
function Kpi({label,value,suffix,prefix,icon,tone}){
  const v = useCountUp(value,{duration:1000});
  return (
    <div className="card card-pad card-hover">
      <div className="row between" style={{marginBottom:14}}>
        <span className="eyebrow">{label}</span>
        <span style={{display:"inline-flex",width:30,height:30,borderRadius:9,background:"var(--canvas-2)",color:"var(--ink-2)",alignItems:"center",justifyContent:"center"}}><Icon name={icon} size={16}/></span>
      </div>
      <div className="kpi" style={{fontSize:34,color:tone||"var(--ink)"}}>{prefix}{v}{suffix}</div>
    </div>
  );
}

function ActIcon({kind}){
  const map={win:["trophy","var(--good)","var(--good-soft)"],launch:["send","var(--info)","var(--info-soft)"],score:["target","var(--neural)","var(--neural-soft)"],event:["radar","var(--brand)","var(--brand-soft)"],brand:["brain","var(--warn)","var(--warn-soft)"]};
  const [ic,c,bg]=map[kind]||map.brand;
  return <span style={{display:"inline-flex",width:32,height:32,borderRadius:9,background:bg,color:c,alignItems:"center",justifyContent:"center",flex:"0 0 32px"}}><Icon name={ic} size={16}/></span>;
}

export default function Dashboard({route}){
  const D=DATA, {state}=useStore();
  const topEvent=D.events[0];
  const cid=state.activeCampaignId;
  const campaignTitle=state.campaignTitle||D.campaignTitle;
  const actions=<Btn variant="primary" size="sm" icon="plus" onClick={()=>navigate("/events")}>New campaign</Btn>;
  return (
    <AppShell route={route} title="Dashboard" crumb="Cresta workspace" actions={actions}>
      {/* greeting */}
      <div className="row between wrap" style={{gap:16,marginBottom:24}}>
        <div>
          <h2 style={{fontSize:28,marginBottom:6}}>Good afternoon, Cresta team 👋</h2>
          <p className="soft" style={{fontSize:15}}>One live moment, one test running. Here’s where things stand.</p>
        </div>
        <Tag icon="clock">Tuesday · 3:42pm</Tag>
      </div>

      {/* kpis */}
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginBottom:22}}>
        <Kpi label="Active campaigns" value={D.dashboard.activeCampaigns} icon="layers"/>
        <Kpi label="Live A/B tests" value={D.dashboard.liveTests} icon="flask"/>
        <Kpi label="Creatives generated" value={D.dashboard.creativesGenerated} icon="spark"/>
        <Kpi label="Avg brain score" value={D.dashboard.avgBrainScore} icon="brain" tone="var(--neural)"/>
      </div>

      <div className="grid" style={{gridTemplateColumns:"1.55fr 1fr",gap:16,alignItems:"start"}}>
        {/* active campaign card */}
        <div className="col" style={{gap:16}}>
          <div className="card" style={{overflow:"hidden"}}>
            <div style={{padding:"20px 22px",borderBottom:"1px solid var(--line)"}} className="row between">
              <div>
                <div className="eyebrow" style={{marginBottom:7}}>Active campaign</div>
                <h3 style={{fontSize:20}}>{cid?campaignTitle:"No active campaign"}</h3>
              </div>
              {state.winnerDeclared
                ? <Badge tone="good" icon="trophy">Winner declared</Badge>
                : <Badge tone="info" icon="bolt">Test live</Badge>}
            </div>
            <div style={{padding:"18px 22px"}}>
              <div className="row wrap" style={{gap:8,marginBottom:18}}>
                <Tag icon="radar">{cid?"Accepted event":"Choose an event"}</Tag>
                <Tag icon="spark">5 variants</Tag>
                <Tag icon="flask">A/B/C live</Tag>
                <Tag icon="clock">72h window</Tag>
              </div>
              {/* mini flow progress */}
              <div className="row wrap" style={{gap:0,marginBottom:20}}>
                {campaignFlow(cid||"demo").map((f,i)=>{
                  const flags={context:state.campaignContextSaved,layout:state.campaignLayoutSaved,concept:state.campaignConceptSaved,studio:state.variantsGenerated,scoring:state.scored,experiment:state.experimentConfigured,analytics:state.launched,winner:state.winnerDeclared};
                  const done=flags[f.step];
                  return (
                    <React.Fragment key={f.step}>
                      {i>0&&<div style={{flex:"1 1 14px",height:2,background:done?"var(--good)":"var(--line-2)",minWidth:14}}/>}
                      <div className="row" style={{gap:7}}>
                        <span style={{width:22,height:22,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:done?"var(--good)":"var(--canvas-2)",color:done?"#fff":"var(--ink-3)",fontSize:11}}>{done?<Icon name="check" size={12}/>:i+1}</span>
                        <span style={{fontSize:12.5,fontWeight:600,color:done?"var(--ink-2)":"var(--ink-3)"}}>{f.label}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="row wrap" style={{gap:10}}>
                <Btn variant="primary" iconRight="arrow" onClick={()=>navigate(!cid?"/events":state.winnerDeclared?`/campaigns/${cid}/winner`:state.launched?`/campaigns/${cid}/analytics`:state.campaignConceptSaved?`/campaigns/${cid}/studio`:state.campaignLayoutSaved?`/campaigns/${cid}/concept`:state.campaignContextSaved?`/campaigns/${cid}/layout`:`/campaigns/${cid}/context`)}>
                  {!cid?"Find event":state.winnerDeclared?"View winner":state.launched?"View live results":"Continue campaign"}
                </Btn>
                <Btn variant="soft" icon="chart" disabled={!cid} onClick={()=>navigate(`/campaigns/${cid}/analytics`)}>Analytics</Btn>
              </div>
            </div>
          </div>

          {/* top opportunity */}
          <div className="card card-pad card-hover" style={{cursor:"pointer"}} onClick={()=>navigate("/events")}>
            <div className="row between" style={{marginBottom:4}}>
              <div className="eyebrow">Next opportunity</div>
              <span className="badge badge-good">{topEvent.relevance} relevance</span>
            </div>
            <div className="row between" style={{marginTop:10}}>
              <div className="row" style={{gap:13}}>
                <span style={{fontSize:30}}>{D.events[1].emoji}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:16}}>{D.events[1].title}</div>
                  <div className="muted" style={{fontSize:13}}>{D.events[1].window} · {D.events[1].trend}</div>
                </div>
              </div>
              <Icon name="arrow" style={{color:"var(--ink-3)"}}/>
            </div>
          </div>
        </div>

        {/* activity + brand brain */}
        <div className="col" style={{gap:16}}>
          <div className="card card-pad">
            <div className="row between" style={{marginBottom:14}}>
              <span className="eyebrow">Brand Brain</span>
              <Badge tone="good" icon="check">{D.brand.completeness}% complete</Badge>
            </div>
            <div className="row" style={{gap:11,marginBottom:14}}>
              <div className="brandmark" style={{background:D.brand.color,width:40,height:40,borderRadius:11}}>C</div>
              <div><div style={{fontWeight:700}}>{D.brand.name}</div><div className="muted" style={{fontSize:12.5}}>{D.brand.voice.slice(0,3).join(" · ")}</div></div>
            </div>
            <ScoreBar value={D.brand.completeness} color="var(--good)"/>
            <Btn variant="soft" size="sm" icon="edit" style={{marginTop:14,width:"100%"}} onClick={()=>navigate("/brand/setup")}>Manage Brand Brain</Btn>
          </div>

          <div className="card card-pad">
            <div className="eyebrow" style={{marginBottom:14}}>Recent activity</div>
            <div className="col" style={{gap:2}}>
              {D.dashboard.recentActivity.map((a,i)=>(
                <div key={i} className="row" style={{gap:12,padding:"9px 0",borderBottom:i<D.dashboard.recentActivity.length-1?"1px solid var(--line)":"none"}}>
                  <ActIcon kind={a.kind}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,lineHeight:1.4}}>{a.txt}</div>
                    <div className="muted mono" style={{fontSize:11}}>{a.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
