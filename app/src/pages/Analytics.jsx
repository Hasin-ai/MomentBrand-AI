import React from "react";
import { DATA } from "../data/mockData";
import { API } from "../api/client";
import { useStore, navigate, matchCampaign, useCountUp, useInView, scoreColor, riskBadge } from "../store/store";
import { Icon, Btn, Badge, Tag, ScoreBar, Gauge, AppShell, Stepper, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /campaigns/:id/analytics  — Analytics Dashboard
   ============================================================ */
const CELL_COLOR={A:"#E5342A",D:"#1F7A4D",C:"#6D4AFF"};

function LineChart({series,cells,height=200}){
  const W=560,H=height,pad=28;
  const allPts=cells.flatMap(c=>series[c]);
  const max=Math.max(...allPts)*1.1, min=0;
  const n=series[cells[0]].length;
  const x=i=>pad+(i/(n-1))*(W-pad*2);
  const y=v=>H-pad-((v-min)/(max-min))*(H-pad*2);
  const [grow,setGrow]=React.useState(0);
  React.useEffect(()=>{ const t=setTimeout(()=>setGrow(1),80); return ()=>clearTimeout(t); },[]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {[0,.25,.5,.75,1].map((g,i)=>(
        <g key={i}>
          <line x1={pad} x2={W-pad} y1={pad+g*(H-pad*2)} y2={pad+g*(H-pad*2)} stroke="var(--line)" strokeWidth="1"/>
          <text x={4} y={pad+g*(H-pad*2)+3} fontSize="9" fill="var(--ink-3)" fontFamily="var(--mono)">{(max*(1-g)).toFixed(1)}</text>
        </g>
      ))}
      {[0,3,6,9,11].map(i=>(
        <text key={i} x={x(i)} y={H-8} fontSize="9" fill="var(--ink-3)" fontFamily="var(--mono)" textAnchor="middle">{i*6}h</text>
      ))}
      {cells.map(c=>{
        const pts=series[c].map((v,i)=>`${x(i)},${y(v)}`).join(" ");
        const len=900;
        return (
          <g key={c}>
            <polyline points={pts} fill="none" stroke={CELL_COLOR[c]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={len} strokeDashoffset={len-len*grow} style={{transition:"stroke-dashoffset 1.4s ease"}}/>
            <circle cx={x(n-1)} cy={y(series[c][n-1])} r="3.5" fill={CELL_COLOR[c]} opacity={grow}/>
          </g>
        );
      })}
    </svg>
  );
}

function MetricCell({label,value,prefix,suffix,decimals,best,delay}){
  const v=useCountUp(value,{duration:1100,decimals:decimals||0});
  return (
    <div className="card card-pad" style={{position:"relative"}}>
      {best && <span style={{position:"absolute",top:12,right:12}} className="badge badge-good"><Icon name="check" size={12}/>Best</span>}
      <div className="eyebrow" style={{marginBottom:10}}>{label}</div>
      <div className="kpi" style={{fontSize:30}}>{prefix}{v}{suffix}</div>
    </div>
  );
}

function VariantPerfRow({v,perf,maxConv}){
  return (
    <div className="card" style={{padding:"14px 16px",borderColor:perf.winner?"var(--good)":"var(--line)",borderWidth:perf.winner?1.5:1}}>
      <div className="row between wrap" style={{gap:12}}>
        <div className="row" style={{gap:11,minWidth:150}}>
          <span style={{width:32,height:32,borderRadius:9,background:v.grad,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontFamily:"var(--font-display)",flex:"0 0 32px"}}>{v.letter}</span>
          <div><div style={{fontWeight:700,fontSize:14}}>{v.angle}</div><div className="muted" style={{fontSize:11.5}}>{v.platform}</div></div>
          {perf.winner&&<Badge tone="good" icon="trophy">Winner</Badge>}
        </div>
        <div className="row" style={{gap:20,flexWrap:"wrap"}}>
          {[["CTR",perf.ctr+"%"],["CPC","$"+perf.cpc.toFixed(2)],["CPA","$"+perf.cpa.toFixed(2)],["ROAS",perf.roas+"×"],["Conv.",perf.conv]].map(([l,val])=>(
            <div key={l} style={{textAlign:"center",minWidth:46}}>
              <div className="kpi" style={{fontSize:16}}>{val}</div>
              <div className="eyebrow" style={{fontSize:9}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="scorebar" style={{marginTop:12}}><span style={{width:(perf.conv/maxConv*100)+"%",background:perf.winner?"var(--good)":CELL_COLOR[v.id]||"var(--ink-3)"}}/></div>
    </div>
  );
}

export default function Analytics({route}){
  const D=DATA, {state,set}=useStore();
  const cm=matchCampaign(route), campaignId=cm&&cm.id;
  const A=D.analytics;
  const cells=state.selectedVariants?.filter(c=>A.variants[c])||["A","D","C"];
  const maxConv=Math.max(...cells.map(c=>A.variants[c].conv));

  return (
    <AppShell route={route} title={state.campaignTitle||D.campaignTitle} crumb="Campaign · Analytics" wide
      actions={<><Tag icon="clock">{A.duration}</Tag><Btn variant="primary" size="sm" icon="trophy" onClick={()=>{set({winnerDeclared:false});navigate(`/campaigns/${campaignId}/winner`);}}>Declare winner</Btn></>}>
      <div style={{marginBottom:22}}><Stepper current="analytics" campaignId={campaignId}/></div>
      <SectionHead eyebrow="Step 8 · Measure"
        title="Live performance"
        desc="Real Meta Ads Insights, pulled after 72 hours. Which event worked, which audience, which emotion."
        right={<div className="row" style={{gap:8}}><span style={{width:8,height:8,borderRadius:8,background:"var(--good)"}} className="pulse-dot"/><span className="muted" style={{fontSize:13}}>Live</span></div>}/>

      {/* top KPIs */}
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:20}}>
        <MetricCell label="Total spend" value={A.spend} prefix="$"/>
        <MetricCell label="Impressions" value={A.impressions/1000} suffix="k" decimals={1}/>
        <MetricCell label="Reach" value={A.reach/1000} suffix="k" decimals={1}/>
        <MetricCell label="Best CPC" value={A.variants.A.cpc} prefix="$" decimals={2} best/>
        <MetricCell label="Best ROAS" value={A.variants.A.roas} suffix="×" decimals={1}/>
      </div>

      <div className="grid" style={{gridTemplateColumns:"1.5fr 1fr",gap:20,marginBottom:20,alignItems:"start"}}>
        {/* chart */}
        <div className="card card-pad">
          <div className="row between" style={{marginBottom:8}}>
            <div><div className="eyebrow" style={{marginBottom:4}}>CTR over time</div><h3 style={{fontSize:16}}>Variant performance · 72h</h3></div>
            <div className="row" style={{gap:14}}>
              {cells.map(c=>(
                <div key={c} className="row" style={{gap:6,fontSize:12}}><span style={{width:10,height:3,borderRadius:9,background:CELL_COLOR[c]}}/><span className="soft">{D.variants.find(v=>v.id===c).angle}</span></div>
              ))}
            </div>
          </div>
          <LineChart series={A.series} cells={cells}/>
        </div>

        {/* audience breakdown */}
        <div className="card card-pad">
          <div className="eyebrow" style={{marginBottom:16}}>Audience breakdown · CTR</div>
          <div className="col" style={{gap:15}}>
            {A.audienceBreakdown.map((a,i)=>(
              <div key={a.seg}>
                <div className="row between" style={{marginBottom:6,fontSize:13}}><span style={{fontWeight:600}}>{a.seg}</span><span className="mono soft">{a.ctr}% · {a.share}% of spend</span></div>
                <ScoreBar value={a.ctr*16} color={i<2?"var(--good)":"var(--ink-3)"} delay={i*100}/>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:"11px 13px",background:"var(--good-soft)",marginTop:18}}>
            <span style={{fontSize:12.5,color:"var(--ink-2)"}}><Icon name="spark" size={13} style={{color:"var(--good)",verticalAlign:"-2px",marginRight:6}}/>18–34 drives 79% of spend and the highest CTR — lean in here.</span>
          </div>
        </div>
      </div>

      {/* per-variant */}
      <div className="eyebrow" style={{margin:"4px 2px 12px"}}>By variant</div>
      <div className="col" style={{gap:10,marginBottom:20}}>
        {cells.map(c=><VariantPerfRow key={c} v={D.variants.find(v=>v.id===c)} perf={A.variants[c]} maxConv={maxConv}/>)}
      </div>

      <div className="card card-pad" style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:14,background:"var(--surface-warm)"}}>
        <div className="row" style={{gap:11}}><Icon name="trophy" style={{color:"var(--good)"}}/><span style={{fontWeight:600}}>Variant A is clearing the 95% threshold. Ready to call it.</span></div>
        <Btn variant="primary" iconRight="arrow" onClick={()=>{set({winnerDeclared:false});navigate(`/campaigns/${campaignId}/winner`);}}>Declare winner</Btn>
      </div>
    </AppShell>
  );
}
