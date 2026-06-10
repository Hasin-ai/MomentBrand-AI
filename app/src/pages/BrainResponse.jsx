import React from "react";
import { API } from "../api/client";
import { AppShell, Badge, Btn, EmptyState, Gauge, Icon, SectionHead, Tag } from "../components/ui";
import { useStore } from "../store/store";

const INDEX_LABELS = {
  attention_capture: "Attention / stopping power",
  novelty_surprise: "Novelty / surprise",
  cognitive_load_informativeness: "Cognitive / information processing",
  hedonic_appeal: "Hedonic / liking appeal",
  affective_salience: "Emotional salience / arousal",
  desirability_reward: "Desire / purchase intent proxy",
  memory_encoding_potential: "Memory / brand recall",
  self_relevance_persuasion: "Self relevance / persuasion",
  social_sharing_potential: "Social sharing potential",
};

const REGION_LABELS = {
  visual_cortex: "Visual salience",
  anterior_cingulate: "Salience / arousal",
  prefrontal_control: "Cognitive control",
  temporal_semantic_social: "Semantic / social processing",
  dorsal_attention_parietal: "Visual attention",
  insula_salience: "Affective salience",
  motor_arousal_proxy: "Action readiness",
  ventral_visual_object_form: "Object / brand visual processing",
  posterior_cingulate_precuneus: "Context / self relevance",
  orbitofrontal_vmPFC: "Valuation / reward",
  parahippocampal_memory_proxy: "Scene memory",
  amygdala: "Affective salience region",
  hippocampus: "Memory region",
  ventral_striatum_nucleus_accumbens: "Reward / motivation region",
};

function pct(value){
  if(value === null || value === undefined || Number.isNaN(Number(value))) return "Unavailable";
  return `${Math.round(Number(value) * 10000) / 100}%`;
}

function scoreStrength(value){
  if(value === null || value === undefined || Number.isNaN(Number(value))) return "var(--ink-3)";
  if(value >= .4) return "var(--good)";
  if(value >= .25) return "var(--warn)";
  return "var(--neural)";
}

function responseFromAnalysis(analysis){
  return analysis?.brain_response || analysis?.response_json || analysis || null;
}

function BarList({title,items,labelFor,valueFor,empty}){
  const clean = items
    .map(item=>({item,label:labelFor(item),value:valueFor(item)}))
    .filter(row=>row.value !== null && row.value !== undefined && !Number.isNaN(Number(row.value)))
    .sort((a,b)=>Number(b.value)-Number(a.value));

  return (
    <div className="card card-pad">
      <div className="row between" style={{marginBottom:16}}>
        <h3 style={{fontSize:18}}>{title}</h3>
        <Tag icon="chart">{clean.length} scores</Tag>
      </div>
      {clean.length === 0 ? (
        <p className="muted" style={{fontSize:13}}>{empty}</p>
      ) : (
        <div className="col" style={{gap:13}}>
          {clean.map(({item,label,value})=>(
            <div key={item.label || item.region || label}>
              <div className="row between" style={{gap:12,marginBottom:6}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13.5}}>{label}</div>
                  {(item.engagement_type || item.interpretation) && (
                    <div className="muted" style={{fontSize:11.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {item.engagement_type || item.interpretation}
                    </div>
                  )}
                </div>
                <span className="mono" style={{fontWeight:800,color:scoreStrength(Number(value)),whiteSpace:"nowrap"}}>{pct(value)}</span>
              </div>
              <div className="scorebar" style={{height:8}}>
                <span style={{width:`${Math.max(0, Math.min(100, Number(value)*100))}%`,background:scoreStrength(Number(value))}}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImagePanel({title,url}){
  if(!url) return null;
  return (
    <div className="card" style={{overflow:"hidden"}}>
      <div className="row between" style={{padding:"14px 16px",borderBottom:"1px solid var(--line)"}}>
        <h3 style={{fontSize:15}}>{title}</h3>
        <Badge tone="soft" icon="chart">API chart</Badge>
      </div>
      <div style={{padding:12,background:"var(--surface-warm)"}}>
        <img src={url} alt={title} style={{width:"100%",display:"block",borderRadius:10,border:"1px solid var(--line)",background:"#fff"}}/>
      </div>
    </div>
  );
}

function insightAction(label, score){
  const pctScore = Number(score || 0);
  const strength = pctScore >= .4 ? "strong" : pctScore >= .25 ? "moderate" : "early";
  const actions = {
    attention_capture: "Use it as a scroll-stop opener. Keep the visual focal point large and reduce competing copy.",
    novelty_surprise: "Use it when the campaign needs freshness. Pair the surprise with a clear brand cue so it is not just entertaining.",
    cognitive_load_informativeness: "Good for informative ads. If this is high, check that the offer is easy to understand in three seconds.",
    hedonic_appeal: "Useful for liking and positive brand feeling. Keep the sensory or lifestyle cue visible in every format.",
    affective_salience: "Strong emotional signal. Use this version when the event is about belonging, pride, celebration, or urgency.",
    desirability_reward: "Useful for purchase intent. Make the CTA and product benefit more prominent before a conversion test.",
    memory_encoding_potential: "Good recall signal. Keep the brand mark, product, and headline connected in the same visual area.",
    self_relevance_persuasion: "Use this when the ad speaks to a specific audience identity or occasion. Make the audience cue explicit.",
    social_sharing_potential: "Good for awareness and reactive campaigns. Test in Reels or Stories before using it as a conversion winner.",
  };
  return {strength, action: actions[label] || "Use this score as a directional signal and validate with a small ad test."};
}

function MarketingInsightCards({indices,overall}){
  const rows = [...indices]
    .filter(item=>item.score !== null && item.score !== undefined && !Number.isNaN(Number(item.score)))
    .sort((a,b)=>Number(b.score)-Number(a.score));
  if(rows.length===0) return null;
  const top = rows[0];
  const low = [...rows].reverse()[0];
  const topAction = insightAction(top.label, top.score);
  const lowAction = insightAction(low.label, low.score);
  const readiness = Number(overall || 0) >= .35
    ? "Use this ad as a serious A/B test candidate."
    : "Revise the ad before putting budget behind it.";
  return (
    <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
      <div className="card card-pad" style={{background:"var(--good-soft)"}}>
        <div className="eyebrow" style={{marginBottom:8,color:"var(--good)"}}>Strongest signal</div>
        <h3 style={{fontSize:17,marginBottom:7}}>{INDEX_LABELS[top.label] || top.label}</h3>
        <p style={{fontSize:13.5,lineHeight:1.5,color:"var(--ink-2)"}}>This is a {topAction.strength} signal. {topAction.action}</p>
      </div>
      <div className="card card-pad" style={{background:"var(--warn-soft)"}}>
        <div className="eyebrow" style={{marginBottom:8,color:"var(--warn)"}}>Improve next</div>
        <h3 style={{fontSize:17,marginBottom:7}}>{INDEX_LABELS[low.label] || low.label}</h3>
        <p style={{fontSize:13.5,lineHeight:1.5,color:"var(--ink-2)"}}>This is the weakest returned signal. {lowAction.action}</p>
      </div>
      <div className="card card-pad" style={{background:"var(--neural-soft)"}}>
        <div className="eyebrow" style={{marginBottom:8,color:"var(--neural)"}}>Marketing read</div>
        <h3 style={{fontSize:17,marginBottom:7}}>{readiness}</h3>
        <p style={{fontSize:13.5,lineHeight:1.5,color:"var(--ink-2)"}}>Treat these as predicted proxy signals, then validate the final 2-3 ads with a clean paid test.</p>
      </div>
    </div>
  );
}

export function BrainAnalysisResults({analysis}){
  const response = responseFromAnalysis(analysis);
  if(!response) return null;

  const neuro = response.neuromarketing_analysis || {};
  const summary = neuro.engagement_summary || {};
  const top = summary.top_engagement_type || (neuro.likely_engagement_types || [])[0] || {};
  const indices = response.neuromarketing_indices || [];
  const regions = response.brain_region_scores || [];
  const availableRegions = regions.filter(item=>item.available && item.activation !== null && item.activation !== undefined);
  const unavailableRegions = regions.filter(item=>!item.available || item.activation === null || item.activation === undefined);
  const overall = neuro.overall_ad_engagement_index;

  return (
    <div className="col" style={{gap:18}}>
      <div className="grid" style={{gridTemplateColumns:"minmax(220px,.7fr) 1.3fr",gap:18,alignItems:"stretch"}}>
        <div className="card card-pad" style={{display:"flex",alignItems:"center",gap:18}}>
          <Gauge value={Math.round((overall || 0) * 100)} size={126} label="overall" color="var(--neural)" run/>
          <div>
            <div className="eyebrow" style={{marginBottom:7}}>Predicted proxy score</div>
            <h3 style={{fontSize:20,marginBottom:8}}>{response.campaign_name || "Brain response analysis"}</h3>
            <Badge tone="neural">{response.model || "TRIBE v2"} · {response.model_status?.device || "device unknown"}</Badge>
          </div>
        </div>
        <div className="card card-pad">
          <div className="row between wrap" style={{gap:10,marginBottom:12}}>
            <div>
              <div className="eyebrow" style={{marginBottom:7}}>Top signal</div>
              <h3 style={{fontSize:20}}>{INDEX_LABELS[top.label] || top.engagement_type || top.label || "No dominant signal"}</h3>
            </div>
            {top.score !== undefined && <Badge tone="good">{pct(top.score)}</Badge>}
          </div>
          <p className="soft" style={{fontSize:14,lineHeight:1.55}}>
            {summary.strategic_read || "The response contains predicted neural-response proxy scores for ad review."}
          </p>
          <div className="row wrap" style={{gap:8,marginTop:14}}>
            <Tag icon="brain">{response.scoring_mode || "TRIBE scoring"}</Tag>
            <Tag icon="doc">{response.processed_as || "image stimulus"}</Tag>
            {response.image_info?.resized_for_inference && <Tag icon="layers">{response.image_info.inference_width}x{response.image_info.inference_height} inference</Tag>}
          </div>
        </div>
      </div>

      <MarketingInsightCards indices={indices} overall={overall}/>

      <div className="grid" style={{gridTemplateColumns:"1fr 1fr",gap:18,alignItems:"start"}}>
        <BarList
          title="Neuromarketing Scores"
          items={indices}
          labelFor={item=>INDEX_LABELS[item.label] || item.label}
          valueFor={item=>item.score}
          empty="No neuromarketing score array was returned."
        />
        <BarList
          title="Brain Region Activation"
          items={availableRegions}
          labelFor={item=>REGION_LABELS[item.region] || item.region}
          valueFor={item=>item.activation}
          empty="No available brain-region activation scores were returned."
        />
      </div>

      {unavailableRegions.length > 0 && (
        <div className="card card-pad" style={{background:"var(--surface-warm)"}}>
          <div className="eyebrow" style={{marginBottom:10}}>Unavailable regions</div>
          <div className="row wrap" style={{gap:8}}>
            {unavailableRegions.map(item=>(
              <Badge key={item.region} tone="soft">{REGION_LABELS[item.region] || item.region}</Badge>
            ))}
          </div>
          <p className="muted" style={{fontSize:12.5,marginTop:10}}>These regions were not available from this TRIBE output, so the UI does not invent scores for them.</p>
        </div>
      )}

      <div className="grid" style={{gridTemplateColumns:"1fr 1fr",gap:18}}>
        <ImagePanel title="Brain Activation Chart" url={response.brain_activation_image_url}/>
        <ImagePanel title="Neuromarketing Chart" url={response.neuromarketing_chart_url}/>
      </div>

      <div className="card card-pad" style={{background:"var(--warn-soft)"}}>
        <div className="row" style={{gap:9,marginBottom:8}}>
          <Icon name="shield" style={{color:"var(--warn)"}}/>
          <h3 style={{fontSize:16}}>Interpretation limits</h3>
        </div>
        <p style={{fontSize:13.5,lineHeight:1.55,color:"var(--ink-2)"}}>
          {response.warning || response.required_wording || "These are predicted neural-response proxy scores, not observed human fMRI or guaranteed campaign KPIs."}
        </p>
        {response.limitations?.length > 0 && (
          <div className="col" style={{gap:6,marginTop:12}}>
            {response.limitations.slice(0,4).map((item,i)=>(
              <div key={i} className="row" style={{gap:8,alignItems:"flex-start",fontSize:12.5,color:"var(--ink-2)"}}>
                <span className="mono" style={{color:"var(--warn)"}}>0{i+1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BrainAnalysisWorkspace({route,campaignId,campaignName,onSaved,embedded=false}){
  const [file,setFile]=React.useState(null);
  const [analysis,setAnalysis]=React.useState(null);
  const [loading,setLoading]=React.useState(Boolean(campaignId));
  const [submitting,setSubmitting]=React.useState(false);
  const [error,setError]=React.useState("");

  React.useEffect(()=>{
    if(!campaignId) return;
    let alive=true;
    setLoading(true); setError("");
    API.listCampaignBrainAnalyses(campaignId)
      .then(rows=>{
        if(!alive) return;
        if(rows && rows.length) setAnalysis(rows[0]);
      })
      .catch(e=>alive&&setError(e.message))
      .finally(()=>alive&&setLoading(false));
    return ()=>{alive=false};
  },[campaignId]);

  const submit=async()=>{
    if(!file){ setError("Choose an ad image before running brain-response analysis."); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("normalize_scores", "true");
    form.append("cleanup_all", "true");
    if(campaignId) form.append("campaign_id", campaignId);
    if(campaignName) form.append("campaign_name", campaignName);
    setSubmitting(true); setError("");
    try{
      const res = await API.analyzeBrainResponse(form);
      const saved = res.analysis || {id:res.analysis_id,response_json:res.brain_response};
      setAnalysis(saved);
      onSaved && onSaved(saved);
    }catch(e){
      setError(e.message);
    }finally{
      setSubmitting(false);
    }
  };

  return (
    <div className="col" style={{gap:18}}>
      <div className="card card-pad" style={{background:embedded?"var(--surface-warm)":"var(--surface)"}}>
        <div className="row between wrap" style={{gap:16,marginBottom:16}}>
          <div>
            <div className="eyebrow" style={{marginBottom:8}}>TRIBE v2 Brain Response</div>
            <h3 style={{fontSize:20}}>Analyze a finished ad image</h3>
            <p className="muted" style={{fontSize:13.5,marginTop:6,maxWidth:650}}>Upload one creative to estimate attention, emotional engagement, memory, desire, and share potential before choosing which 2-3 ads deserve a paid test.</p>
          </div>
          <Badge tone={analysis?"good":"neural"} icon={analysis?"check":"brain"}>{analysis?"Saved result":"Ready"}</Badge>
        </div>
        <div className="row wrap" style={{gap:10,alignItems:"center"}}>
          <input className="input" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onChange={e=>setFile(e.target.files?.[0]||null)} style={{maxWidth:360}}/>
          <Btn variant="primary" icon="brain" disabled={submitting} onClick={submit}>{submitting?"Analyzing...":"Analyze ad response"}</Btn>
          {file && <span className="muted" style={{fontSize:12.5}}>{file.name}</span>}
        </div>
        {error && <div className="card" style={{padding:"11px 13px",marginTop:14,background:"var(--risk-soft)",color:"var(--risk)",fontSize:13}}>{error}</div>}
      </div>

      {loading && <div className="card card-pad">Loading saved brain-response result...</div>}
      {!loading && analysis && <BrainAnalysisResults analysis={analysis}/>}
      {!loading && !analysis && !embedded && (
        <EmptyState title="No brain-response result yet" msg="Upload an ad image to turn predicted neural-response scores into practical creative guidance."/>
      )}
    </div>
  );
}

export default function BrainResponse({route}){
  const {state}=useStore();
  return (
    <AppShell route={route} title="Brain Response" crumb="Cresta workspace" wide
      actions={<Tag icon="brain">TRIBE v2 proxy analysis</Tag>}>
      <SectionHead eyebrow="Standalone analysis" title="Brain-response scoring"
        desc="Analyze any ad image without attaching it to a campaign. The result explains which creative signals are strongest and what to revise next."/>
      <BrainAnalysisWorkspace campaignName={state.campaignTitle || "Standalone ad analysis"}/>
    </AppShell>
  );
}
