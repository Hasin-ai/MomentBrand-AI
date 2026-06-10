import React from "react";
import { API } from "../api/client";
import { useStore, navigate, matchCampaign, scoreColor, riskBadge } from "../store/store";
import { Icon, Btn, Badge, Tag, ScoreBar, Gauge, AppShell, Stepper, SectionHead, EmptyState } from "../components/ui";
import { BrainAnalysisResults } from "./BrainResponse";

/* ============================================================
   Route: /campaigns/:id/scoring  — Creative Scoring + TRIBE v2
   ============================================================ */
const TRIBE_DIMS = [
  {key:"salience", name:"Visual Salience Index", region:"Visual / attention systems", why:"Scroll-stop proxy"},
  {key:"emotional", name:"Emotional Encoding", region:"Affective salience systems", why:"Emotion and liking proxy"},
  {key:"memory", name:"Memory Consolidation", region:"Memory encoding systems", why:"Brand recall proxy"},
  {key:"coherence", name:"Multimodal Coherence", region:"Copy / visual consistency", why:"Message clarity proxy"},
];

function responseFromAnalysis(analysis){
  return analysis?.brain_response || analysis?.response_json || analysis || null;
}

function value100(value){
  const n=Number(value);
  if(Number.isNaN(n)) return null;
  return Math.round(n<=1 ? n*100 : n);
}

function indexScore(response, labels){
  const rows=response?.neuromarketing_indices || [];
  const found=rows.find(row=>labels.includes(row.label));
  return value100(found?.score);
}

function analysisLetter(analysis){
  const source=analysis?.source_filename || "";
  const match=source.match(/variant[_-]?([A-Za-z0-9]+)[_-]/);
  return match ? match[1].toUpperCase() : "";
}

function scoreFromAnalysis(v,analysis){
  const response=responseFromAnalysis(analysis);
  const overall=value100(response?.neuromarketing_analysis?.overall_ad_engagement_index) || value100(analysis?.overall_score) || 0;
  const salience=indexScore(response,["attention_capture","novelty_surprise"]) || overall;
  const emotional=indexScore(response,["affective_salience","hedonic_appeal","desirability_reward"]) || overall;
  const memory=indexScore(response,["memory_encoding_potential"]) || overall;
  const coherence=indexScore(response,["cognitive_load_informativeness","self_relevance_persuasion","social_sharing_potential"]) || overall;
  const risk=v?.risk || "low";
  const brandBase=risk==="high" ? 68 : risk==="medium" ? 80 : 90;
  const brandFit=Math.max(40,Math.min(100,Math.round((brandBase+coherence)/2)));
  const eventFit=Math.max(40,Math.min(100,Math.round((salience+emotional)/2)));
  const action=risk==="high" ? "Revise — IP risk" : overall>=75 ? "Launch" : overall>=60 ? "Small-scale test" : "Revise";
  return {
    brandFit,
    eventFit,
    risk,
    action,
    analysis,
    tribe:{
      composite:overall,
      salience,
      emotional,
      memory,
      coherence,
      label:overall>=85?"High salience":overall>=70?"Promising signal":overall>=55?"Needs refinement":"Weak signal",
    },
  };
}
function ScoringRow({v,sc,active,onClick}){
  const [badgeClass,riskLabel]=riskBadge(sc.risk);
  const actionTone = sc.action.startsWith("Launch")?"good":sc.action.startsWith("Revise")?"risk":"warn";
  const image=variantImage(v);
  return (
    <div className={`card card-hover`} onClick={onClick} style={{padding:"14px 16px",cursor:"pointer",borderColor:active?"var(--ink)":"var(--line)",boxShadow:active?"var(--shadow)":"var(--shadow-sm)"}}>
      <div className="row between wrap" style={{gap:12}}>
        <div className="row" style={{gap:12,minWidth:160}}>
          {image
            ? <img src={image} alt={`Variant ${v.letter}`} style={{width:48,height:48,borderRadius:10,objectFit:"cover",flex:"0 0 48px",border:"1px solid var(--line)"}}/>
            : <span style={{width:34,height:34,borderRadius:10,background:v.grad,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font-display)",fontWeight:800,flex:"0 0 34px"}}>{v.letter}</span>}
          <div><div style={{fontWeight:700,fontSize:14.5}}>{v.angle}</div><div className="muted" style={{fontSize:12}}>{v.emotion}</div></div>
        </div>
        <div className="row" style={{gap:18,flexWrap:"wrap",alignItems:"center"}}>
          {[["Brand",sc.brandFit],["Event",sc.eventFit]].map(([l,val])=>(
            <div key={l} style={{textAlign:"center",minWidth:46}}>
              <div className="kpi" style={{fontSize:18,color:scoreColor(val)}}>{val}</div>
              <div className="eyebrow" style={{fontSize:9.5}}>{l}</div>
            </div>
          ))}
          <div style={{textAlign:"center",minWidth:54,padding:"0 6px",borderLeft:"1px solid var(--line)",borderRight:"1px solid var(--line)"}}>
            <div className="kpi" style={{fontSize:20,color:"var(--neural)"}}>{sc.tribe.composite}</div>
            <div className="eyebrow" style={{fontSize:9.5,color:"var(--neural)"}}>TRIBE</div>
          </div>
          <span className={`badge ${badgeClass}`}><Icon name={sc.risk==="low"?"shield":"flag"} size={12}/>{riskLabel}</span>
          <span className={`badge badge-${actionTone}`} style={{minWidth:96,justifyContent:"center"}}>{sc.action}</span>
        </div>
      </div>
    </div>
  );
}

function variantKey(v){
  return v?.letter || v?.id;
}

function variantImage(v){
  return v?.ad_image_url || v?.adImageUrl || "";
}

function ComparisonSummary({variants,scoreFor,onSelect}){
  const top = [...variants]
    .sort((a,b)=>scoreFor(b).tribe.composite-scoreFor(a).tribe.composite)
    .slice(0,3);
  if(top.length===0) return null;
  const bestAttention = [...top].sort((a,b)=>scoreFor(b).tribe.salience-scoreFor(a).tribe.salience)[0];
  const bestEmotion = [...top].sort((a,b)=>scoreFor(b).tribe.emotional-scoreFor(a).tribe.emotional)[0];
  const bestMemory = [...top].sort((a,b)=>scoreFor(b).tribe.memory-scoreFor(a).tribe.memory)[0];
  const launchable = top.filter(v=>scoreFor(v).risk!=="high");
  return (
    <div className="card card-pad" style={{background:"var(--surface-warm)",marginBottom:18}}>
      <div className="row between wrap" style={{gap:14,marginBottom:14}}>
        <div>
          <div className="eyebrow" style={{marginBottom:6}}>Recommended comparison set</div>
          <h3 style={{fontSize:18}}>Compare {top.map(v=>`Variant ${variantKey(v)}`).join(", ")} first</h3>
        </div>
        <Badge tone="neural" icon="brain">2-3 ad read</Badge>
      </div>
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        {[
          ["Attention",bestAttention,"Most likely to stop the scroll."],
          ["Emotion",bestEmotion,"Strongest emotional engagement signal."],
          ["Memory",bestMemory,"Best predicted brand recall."],
        ].map(([label,v,copy])=>(
          <button key={label} className="card" onClick={()=>onSelect(variantKey(v))} style={{padding:"12px 13px",textAlign:"left",borderColor:"var(--line)",background:"var(--surface)"}}>
            <div className="row between" style={{marginBottom:8}}>
              <span className="eyebrow">{label}</span>
              <span className="mono" style={{fontWeight:800,color:"var(--neural)"}}>{variantKey(v)}</span>
            </div>
            <div style={{fontWeight:700,fontSize:13.5,marginBottom:4}}>{v.angle}</div>
            <p className="muted" style={{fontSize:12.5,lineHeight:1.4}}>{copy}</p>
          </button>
        ))}
      </div>
      <p className="soft" style={{fontSize:13.5,lineHeight:1.55,marginTop:14}}>
        Launchable set: {launchable.length ? launchable.map(v=>`Variant ${variantKey(v)}`).join(", ") : "none yet"}. High-risk variants should be rewritten before any paid test.
      </p>
    </div>
  );
}

function TribePanel({v,sc}){
  const image=variantImage(v);
  return (
    <div className="card" style={{overflow:"hidden",position:"sticky",top:84}}>
      {image && <img src={image} alt={`Generated ad variant ${v.letter}`} style={{width:"100%",aspectRatio:"1 / 1",objectFit:"cover",display:"block",borderBottom:"1px solid var(--line)"}}/>}
      <div style={{padding:"16px 18px",borderBottom:"1px solid var(--line)",background:"linear-gradient(180deg,var(--neural-soft),transparent)"}}>
        <div className="row between">
          <div className="row" style={{gap:9}}><Icon name="brain" style={{color:"var(--neural)"}}/><span className="eyebrow" style={{color:"var(--neural)"}}>TRIBE v2 Brain Score</span></div>
          <Badge tone="neural">Variant {v.letter}</Badge>
        </div>
      </div>
      <div style={{padding:"20px 18px"}}>
        <div className="row" style={{gap:18,marginBottom:18}}>
          <Gauge value={sc.tribe.composite} size={120} label="composite" color="var(--neural)" run key={v.id}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{v.angle}</div>
            <Badge tone="neural">{sc.tribe.label}</Badge>
            <p className="muted" style={{fontSize:12.5,marginTop:10,lineHeight:1.5}}>Predicted neural encoding across four dimensions — a pre-spend signal, always validated with a real Meta A/B test.</p>
          </div>
        </div>
        <div className="col" style={{gap:14}}>
          {TRIBE_DIMS.map((d,i)=>{
            const val=sc.tribe[d.key];
            return (
              <div key={d.key}>
                <div className="row between" style={{marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:600}}>{d.name}</span>
                  <span className="mono" style={{fontWeight:700,color:"var(--neural)"}}>{val}</span>
                </div>
                <ScoreBar value={val} color="var(--neural)" delay={i*120} key={v.id+d.key}/>
                <div className="muted" style={{fontSize:11,marginTop:4}}>{d.region} · {d.why}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Scoring({route}){
  const {state,set}=useStore();
  const cm=matchCampaign(route), campaignId=cm&&cm.id;
  const [phase,setPhase]=React.useState("idle");
  const [sel,setSel]=React.useState("");
  const [progress,setProgress]=React.useState(0);
  const [variants,setVariants]=React.useState([]);
  const [analyses,setAnalyses]=React.useState([]);
  const [loading,setLoading]=React.useState(Boolean(campaignId));
  const [apiError,setApiError]=React.useState("");
  const [campaignTitle,setCampaignTitle]=React.useState(state.campaignTitle||"Campaign");

  React.useEffect(()=>{
    if(!campaignId){
      setApiError("Open a real campaign before comparing ads.");
      setVariants([]);
      setLoading(false);
      return;
    }
    let alive=true;
    setLoading(true); setApiError("");
    API.getCampaign(campaignId)
      .then(async campaign=>{
        if(!alive) return;
        setCampaignTitle(campaign.title||campaign.campaign_name||"Campaign");
        set({
          activeCampaignId:campaignId,
          campaignTitle:campaign.title||campaign.campaign_name,
          campaignContextSaved:Boolean(campaign.context?.brief),
          campaignLayoutSaved:Boolean(campaign.layout && Object.keys(campaign.layout).length),
          campaignConceptSaved:Boolean(campaign.concept?.creative_intent),
        });
        const rows=await API.listVariants(campaignId);
        const savedAnalyses=await API.listCampaignBrainAnalyses(campaignId);
        if(!alive) return;
        const allRows = rows || [];
        const next = allRows.filter(v=>variantImage(v));
        const savedRows=savedAnalyses || [];
        const variantLetters=new Set(next.map(v=>String(variantKey(v) || "").toUpperCase()));
        const mappedRows=savedRows.filter(row=>variantLetters.has(analysisLetter(row)));
        setVariants(next);
        setAnalyses(savedRows);
        setSel(variantKey(next[0]) || "");
        set({variantsGenerated:next.length>0});
        setPhase(mappedRows.length ? "done" : "idle");
        if(mappedRows.length) set({scored:true});
        if(!next.length && allRows.length){
          setApiError("Ad concepts exist, but no final generated ad images are available yet. Open Ad Generation and run image generation first.");
        }else if(!next.length){
          setApiError("No generated ads are available for this campaign yet. Open Ad Generation first.");
        }
      })
      .catch(e=>{
        if(!alive) return;
        setApiError(e.message);
        setVariants([]);
        setSel("");
      })
      .finally(()=>alive&&setLoading(false));
    return ()=>{alive=false};
  },[campaignId, set]);

  const analysisFor=React.useCallback((v)=>{
    const letter=String(variantKey(v) || "").toUpperCase();
    return analyses.find(row=>analysisLetter(row)===letter) || null;
  },[analyses]);

  const scoreFor=React.useCallback((v)=>{
    return scoreFromAnalysis(v, analysisFor(v));
  },[analysisFor]);

  const run=async()=>{
    setPhase("scoring"); setProgress(0);
    const t=setInterval(()=>{
      setProgress(p=>{
        if(p>=92) return p;
        return p+3;
      });
    },180);
    setApiError("");
    try{
      const result=await API.analyzeCampaignGeneratedAds(campaignId);
      clearInterval(t);
      setProgress(100);
      const rows=result.analyses || await API.listCampaignBrainAnalyses(campaignId);
      setAnalyses(rows || []);
      const variantLetters=new Set(variants.map(v=>String(variantKey(v) || "").toUpperCase()));
      const mappedRows=(rows || []).filter(row=>variantLetters.has(analysisLetter(row)));
      setPhase(mappedRows.length ? "done" : "idle");
      set({scored:mappedRows.length>0});
      if(result.failed_count){
        setApiError(`${result.failed_count} ad analysis ${result.failed_count===1?"failed":"runs failed"}. Check the TRIBE API configuration for details.`);
      }
    }catch(e){
      clearInterval(t);
      setPhase("idle");
      setApiError(e.message);
    }
  };

  const currentVariants=variants;
  const v=currentVariants.find(x=>variantKey(x)===sel) || currentVariants[0];
  const sc=v ? scoreFor(v) : null;
  const actions = phase==="done"
    ? <Btn variant="primary" size="sm" iconRight="arrow" onClick={()=>{set({experimentConfigured:false});navigate(`/campaigns/${campaignId}/experiment`);}}>Build experiment</Btn>
    : <Tag icon="layers">{loading?"Loading variants":`${currentVariants.length} variants queued`}</Tag>;
  const analyzedCount = currentVariants.filter(v=>analysisFor(v)).length;
  const avgBrain = analyses.length
    ? Math.round(analyses.reduce((sum,row)=>sum+(value100(row.overall_score) || value100(responseFromAnalysis(row)?.neuromarketing_analysis?.overall_ad_engagement_index) || 0),0)/analyses.length)
    : 0;

  return (
    <AppShell route={route} title={campaignTitle} crumb="Campaign · Scoring" actions={actions} wide>
      <div style={{marginBottom:22}}><Stepper current="scoring" campaignId={campaignId}/></div>
      <SectionHead eyebrow="Step 6 · Pre-score"
        title="Compare which ads are worth testing"
        desc="Use this screen to narrow generated ads down to the strongest 2-3 by attention, emotion, memory, event fit, and launch risk."/>

      {apiError && <div className="card card-pad" style={{marginBottom:16,background:"var(--warn-soft)",color:"var(--warn)"}}>{apiError}</div>}

      {loading && <div className="card card-pad" style={{marginBottom:20}}>Loading generated campaign variants...</div>}

      {!loading && currentVariants.length===0 && (
        <EmptyState
          title="No production ads to compare"
          msg={apiError || "Generate production ads before scoring."}
          cta="Open Ad Generation"
          to={`/campaigns/${campaignId}/studio`}
        />
      )}

      {currentVariants.length>0 && phase==="idle" && (
        <div className="card" style={{padding:"50px 32px",textAlign:"center",background:"var(--surface-warm)"}}>
          <div style={{display:"inline-flex",width:60,height:60,borderRadius:18,background:"var(--neural)",color:"#fff",alignItems:"center",justifyContent:"center",marginBottom:18}}><Icon name="target" size={28}/></div>
          <h3 style={{fontSize:22,marginBottom:10}}>Run brain analysis for generated ads</h3>
          <p className="soft" style={{fontSize:15,maxWidth:540,margin:"0 auto 24px",lineHeight:1.55}}>The backend will send each generated ad image to TRIBE v2, save the results in PostgreSQL, then rank attention, emotion, memory, coherence, brand fit, event fit, and launch risk.</p>
          <Btn variant="primary" size="lg" icon="brain" onClick={run}>Run brain analysis</Btn>
        </div>
      )}

      {currentVariants.length>0 && phase==="scoring" && (
        <div className="card card-pad pop" style={{maxWidth:560,margin:"0 auto",textAlign:"center"}}>
          <Icon name="brain" size={40} className="pulse-dot" style={{color:"var(--neural)",marginBottom:14}}/>
          <h3 style={{fontSize:19,marginBottom:8}}>Predicting neural encoding…</h3>
          <p className="muted" style={{fontSize:13.5,marginBottom:20}}>Estimating visual salience, emotional encoding, memory consolidation and multimodal coherence across all variants.</p>
          <div className="scorebar" style={{height:9}}><span style={{width:progress+"%",background:"var(--neural)"}}/></div>
          <div className="mono muted" style={{fontSize:12,marginTop:10}}>{progress}%</div>
        </div>
      )}

      {currentVariants.length>0 && phase==="done" && sc && (
        <div className="grid" style={{gridTemplateColumns:"1.4fr 1fr",gap:20,alignItems:"start"}}>
          <div className="col" style={{gap:10}}>
            <ComparisonSummary variants={currentVariants} scoreFor={scoreFor} onSelect={setSel}/>
            <div className="row between" style={{padding:"0 2px 4px"}}>
              <span className="eyebrow">Ranked variants · click to inspect</span>
              <span className="muted" style={{fontSize:12}}>{analyzedCount}/{currentVariants.length} analyzed · avg TRIBE {avgBrain || "n/a"}</span>
            </div>
            {[...currentVariants].sort((a,b)=>scoreFor(b).tribe.composite-scoreFor(a).tribe.composite)
              .map(vv=><ScoringRow key={variantKey(vv)} v={vv} sc={scoreFor(vv)} active={variantKey(vv)===sel} onClick={()=>setSel(variantKey(vv))}/>)}
            <div className="card card-pad" style={{background:"var(--surface-warm)",marginTop:6}}>
              <div className="row" style={{gap:10,marginBottom:6}}><Icon name="spark" size={16} style={{color:"var(--neural)"}}/><span style={{fontWeight:700,fontSize:14}}>Engine recommendation</span></div>
              <p className="soft" style={{fontSize:13.5,lineHeight:1.5}}>Prioritize the highest-scoring launchable ads for a clean 2-3 cell comparison. Keep one emotionally engaging option, one attention-grabbing option, and one offer or clarity-led option if risk stays low.</p>
            </div>
          </div>
          <div className="col" style={{gap:18}}>
            <TribePanel v={v} sc={sc}/>
            {sc.analysis && <BrainAnalysisResults analysis={sc.analysis}/>}
          </div>
        </div>
      )}
    </AppShell>
  );
}
