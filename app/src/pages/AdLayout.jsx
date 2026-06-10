import React from "react";
import { DATA } from "../data/mockData";
import { API } from "../api/client";
import { useStore, navigate, matchCampaign, useCountUp, useInView, scoreColor, riskBadge } from "../store/store";
import { Icon, Btn, Badge, Tag, ScoreBar, Gauge, AppShell, Stepper, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /campaigns/:id/layout — ad layout controls
   ============================================================ */
export default function AdLayout({route,campaignId}){
  const {set}=useStore();
  const [campaign,setCampaign]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState("");
  const [form,setForm]=React.useState({
    formats:["1:1"],
    layout_direction:"cultural moment",
    creative_density:"balanced",
    cta_style:"Join the moment",
    product_usage:"optional",
    brand_mark_placement:"top-left",
  });

  React.useEffect(()=>{
    let alive=true;
    API.getCampaign(campaignId).then(c=>{
      if(!alive) return;
      if(!c.context || !c.context.brief){ navigate(`/campaigns/${campaignId}/context`); return; }
      setCampaign(c); setForm(f=>({...f,...(c.layout||{})}));
      set({activeCampaignId:campaignId,campaignTitle:c.title||c.campaign_name,campaignContextSaved:true});
    }).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false));
    return ()=>{alive=false};
  },[campaignId]);

  const toggleFormat=(fmt)=>setForm(f=>{
    if(fmt==="all") return {...f,formats:["1:1","9:16","16:9"]};
    const next=f.formats.includes(fmt)?f.formats.filter(x=>x!==fmt):[...f.formats,fmt];
    return {...f,formats:next.length?next:[fmt]};
  });
  const update=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    setSaving(true); setError("");
    try{
      const c=await API.saveLayout(campaignId,form);
      set({campaignLayoutSaved:true,campaignConceptSaved:false,campaignTitle:c.title||c.campaign_name,activeCampaignId:campaignId,variantsGenerated:false});
      navigate(`/campaigns/${campaignId}/concept`);
    }catch(e){ setError(e.message); }
    finally{ setSaving(false); }
  };

  if(loading) return <AppShell route={route} title="Ad Layout" crumb="Campaign"><div className="card card-pad">Loading layout…</div></AppShell>;
  if(error && !campaign) return <AppShell route={route} title="Ad Layout" crumb="Campaign"><EmptyState title="Layout unavailable" msg={error}/></AppShell>;

  const choices=[
    ["product hero","Product hero","Put the pack/product at the center of the frame."],
    ["lifestyle moment","Lifestyle moment","Show the occasion and human context first."],
    ["text-first announcement","Text-first","Lead with a clear message and CTA."],
    ["offer card","Offer card","Make price, bundle, or promo the primary signal."],
    ["meme/reactive","Meme / reactive","Use social-native framing and faster humour."],
    ["cultural moment","Cultural moment","Use event cues carefully without protected marks."],
  ];

  return (
    <AppShell route={route} title={(campaign&&campaign.title)||"Ad Layout"} crumb="Campaign · Ad Layout"
      actions={<Btn variant="primary" size="sm" iconRight="arrow" disabled={saving} onClick={save}>{saving?"Saving...":"Save layout"}</Btn>}>
      <div style={{marginBottom:22}}><Stepper current="layout" campaignId={campaignId}/></div>
      <SectionHead eyebrow="Step 3 · Compose the ad" title="Choose the creative shape before generating"
        desc="These choices tell the Studio whether to lead with product, people, offer, or event context. You can regenerate later if the first direction is too narrow."/>
      {error && <div className="card card-pad" style={{marginBottom:16,background:"var(--risk-soft)",color:"var(--risk)"}}>{error}</div>}

      <div className="grid" style={{gridTemplateColumns:"1.5fr 1fr",gap:18,alignItems:"start"}}>
        <div className="col" style={{gap:16}}>
          <div className="card card-pad">
            <div className="row between wrap" style={{gap:10,marginBottom:14}}>
              <div>
                <div className="eyebrow" style={{marginBottom:4}}>Ad formats</div>
                <p className="muted" style={{fontSize:12.5}}>Pick where this concept needs to work. All formats creates more reusable directions.</p>
              </div>
              <Badge tone="soft">{form.formats.length} selected</Badge>
            </div>
            <div className="row wrap" style={{gap:10}}>
              {[["1:1","Square feed"],["9:16","Story / Reel"],["16:9","Landscape"],["all","All formats"]].map(([k,l])=>(
                <button key={k} className="tag" onClick={()=>toggleFormat(k)} style={{cursor:"pointer",fontWeight:700,...((k==="all"?form.formats.length===3:form.formats.includes(k))?{background:"var(--ink)",color:"var(--canvas)",borderColor:"var(--ink)"}:{})}}>{l}</button>
              ))}
            </div>
          </div>

          <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
            {choices.map(([k,title,desc])=>(
              <button key={k} className="card card-hover" onClick={()=>update("layout_direction",k)} style={{padding:"16px",textAlign:"left",borderColor:form.layout_direction===k?"var(--ink)":"var(--line)",boxShadow:form.layout_direction===k?"var(--shadow)":"var(--shadow-sm)"}}>
                <div className="row between" style={{marginBottom:8}}><h3 style={{fontSize:15}}>{title}</h3>{form.layout_direction===k&&<Icon name="check" size={16}/>}</div>
                <p className="muted" style={{fontSize:12.5,lineHeight:1.45}}>{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="card card-pad" style={{position:"sticky",top:84}}>
          <div className="eyebrow" style={{marginBottom:16}}>Creative controls</div>
          <div className="field" style={{marginBottom:14}}><span className="label">How much information?</span><select className="select" value={form.creative_density} onChange={e=>update("creative_density",e.target.value)}>{["minimal","balanced","high-information"].map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="field" style={{marginBottom:14}}><span className="label">Primary call to action</span><select className="select" value={form.cta_style} onChange={e=>update("cta_style",e.target.value)}>{["Join the moment","Shop now","Learn more","Order now","Grab the offer"].map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="field" style={{marginBottom:14}}><span className="label">Should the product appear?</span><select className="select" value={form.product_usage} onChange={e=>update("product_usage",e.target.value)}>{["required","optional","avoid"].map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="field"><span className="label">Brand mark placement</span><select className="select" value={form.brand_mark_placement} onChange={e=>update("brand_mark_placement",e.target.value)}>{["top-left","top-center","bottom-left","none"].map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="card" style={{padding:"11px 13px",background:"var(--canvas-2)",marginTop:16}}>
          <span style={{fontSize:12.5,color:"var(--ink-2)"}}>Next, confirm the ad concept strategy before production generation starts.</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
