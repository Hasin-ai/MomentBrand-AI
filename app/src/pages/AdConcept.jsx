import React from "react";
import { API } from "../api/client";
import { useStore, navigate } from "../store/store";
import { Icon, Btn, Badge, AppShell, Stepper, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /campaigns/:id/concept - ad concept strategy
   ============================================================ */
const DIRECTIONS = [
  ["event_led", "Event-led", "Lead with the cultural or calendar moment, then connect it to the brand."],
  ["product_led", "Product-led", "Make the product, offer, or use case the first thing people understand."],
  ["audience_led", "Audience-led", "Start from the people, occasion, and emotional job this ad should serve."],
  ["offer_led", "Offer-led", "Put the promotion, bundle, launch hook, or CTA at the center."],
];

function defaultIntent(campaign){
  const eventName = campaign?.event?.title || "the selected event";
  const context = campaign?.context || {};
  const layout = campaign?.layout || {};
  const offer = context.product_offer ? ` Highlight ${context.product_offer}.` : "";
  return `Create a ${layout.layout_direction || "campaign"} ad concept for ${eventName} that feels timely, brand-safe, and easy to act on.${offer}`;
}

function SummaryRow({label, children}){
  return (
    <div style={{padding:"11px 0",borderBottom:"1px solid var(--line)"}}>
      <div className="eyebrow" style={{marginBottom:5}}>{label}</div>
      <div className="soft" style={{fontSize:13.5,lineHeight:1.5}}>{children || "Not specified"}</div>
    </div>
  );
}

export default function AdConcept({route,campaignId}){
  const {set}=useStore();
  const [campaign,setCampaign]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState("");
  const [form,setForm]=React.useState({
    concept_direction:"event_led",
    creative_intent:"",
    must_include:"",
    avoid:"",
    variant_count:5,
  });

  React.useEffect(()=>{
    let alive=true;
    setLoading(true); setError("");
    API.getCampaign(campaignId).then(c=>{
      if(!alive) return;
      if(!c.context || !c.context.brief){ navigate(`/campaigns/${campaignId}/context`); return; }
      if(!c.layout || !Object.keys(c.layout).length){ navigate(`/campaigns/${campaignId}/layout`); return; }
      const concept = c.concept || {};
      setCampaign(c);
      setForm(f=>({
        ...f,
        ...concept,
        creative_intent:concept.creative_intent || defaultIntent(c),
        must_include:concept.must_include || c.context?.product_offer || "",
        avoid:concept.avoid || c.context?.safety_notes || "",
        variant_count:concept.variant_count || 5,
      }));
      set({
        activeCampaignId:campaignId,
        campaignTitle:c.title||c.campaign_name,
        campaignContextSaved:true,
        campaignLayoutSaved:true,
        campaignConceptSaved:Boolean(concept.creative_intent),
        variantsGenerated:(c.variants||[]).length>0,
      });
    }).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false));
    return ()=>{alive=false};
  },[campaignId, set]);

  const update=(key,value)=>setForm(f=>({...f,[key]:value}));
  const canSave = form.creative_intent.trim().length >= 12 && !saving;
  const save=async()=>{
    setSaving(true); setError("");
    try{
      const payload = {
        ...form,
        variant_count:Number(form.variant_count) || 5,
      };
      const c=await API.saveConcept(campaignId,payload);
      set({
        campaignConceptSaved:true,
        variantsGenerated:false,
        scored:false,
        campaignTitle:c.title||c.campaign_name,
        activeCampaignId:campaignId,
      });
      navigate(`/campaigns/${campaignId}/studio`);
    }catch(e){
      setError(e.message);
    }finally{
      setSaving(false);
    }
  };

  if(loading) return <AppShell route={route} title="Ad Concept" crumb="Campaign"><div className="card card-pad">Loading concept inputs...</div></AppShell>;
  if(error && !campaign) return <AppShell route={route} title="Ad Concept" crumb="Campaign"><EmptyState title="Concept unavailable" msg={error}/></AppShell>;

  const context = campaign?.context || {};
  const layout = campaign?.layout || {};
  const images = Array.isArray(context.image_context_images) ? context.image_context_images : [];
  const direction = DIRECTIONS.find(([key])=>key===form.concept_direction);

  return (
    <AppShell route={route} title={(campaign&&campaign.title)||"Ad Concept"} crumb="Campaign · Ad Concept"
      actions={<Btn variant="primary" size="sm" iconRight="arrow" disabled={!canSave} onClick={save}>{saving?"Saving...":"Save concept"}</Btn>} wide>
      <div style={{marginBottom:22}}><Stepper current="concept" campaignId={campaignId}/></div>
      <SectionHead eyebrow="Step 4 · Decide the creative strategy"
        title="Confirm the ad concept before generation"
        desc="This step tells production generation what the ads should optimize for, so Studio does not create generic variations."/>

      {error && <div className="card card-pad" style={{marginBottom:16,background:"var(--risk-soft)",color:"var(--risk)"}}>{error}</div>}

      <div className="grid" style={{gridTemplateColumns:"1.45fr 1fr",gap:18,alignItems:"start"}}>
        <div className="col" style={{gap:16}}>
          <div className="card card-pad">
            <div className="row between wrap" style={{gap:12,marginBottom:14}}>
              <div>
                <div className="eyebrow" style={{marginBottom:6}}>Concept direction</div>
                <h3 style={{fontSize:19}}>Choose what the ads should lead with</h3>
              </div>
              <Badge tone="info" icon="spark">{direction?.[1] || "Event-led"}</Badge>
            </div>
            <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12}}>
              {DIRECTIONS.map(([key,title,desc])=>(
                <button key={key} className="card card-hover" onClick={()=>update("concept_direction",key)}
                  style={{padding:"16px",textAlign:"left",borderColor:form.concept_direction===key?"var(--ink)":"var(--line)",boxShadow:form.concept_direction===key?"var(--shadow)":"var(--shadow-sm)"}}>
                  <div className="row between" style={{marginBottom:8}}>
                    <h3 style={{fontSize:15}}>{title}</h3>
                    {form.concept_direction===key&&<Icon name="check" size={16}/>}
                  </div>
                  <p className="muted" style={{fontSize:12.5,lineHeight:1.45}}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="field" style={{marginBottom:16}}>
              <div className="row between">
                <span className="label">Creative intent</span>
                <span className="muted mono" style={{fontSize:11}}>{form.creative_intent.trim().length} characters</span>
              </div>
              <textarea className="textarea" style={{minHeight:126}} value={form.creative_intent} onChange={e=>update("creative_intent",e.target.value)}/>
              <p className="muted" style={{fontSize:12.5}}>Write the plain-English idea Studio should follow when generating production ads.</p>
            </div>
            <div className="grid" style={{gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div className="field">
                <span className="label">Must include</span>
                <textarea className="textarea" style={{minHeight:86}} value={form.must_include||""} onChange={e=>update("must_include",e.target.value)} placeholder="Product, offer, visual cue, claim, or audience detail"/>
              </div>
              <div className="field">
                <span className="label">Avoid</span>
                <textarea className="textarea" style={{minHeight:86}} value={form.avoid||""} onChange={e=>update("avoid",e.target.value)} placeholder="Official event marks, sensitive terms, claims, or visual references to avoid"/>
              </div>
            </div>
            <div className="field" style={{marginTop:16,maxWidth:260}}>
              <span className="label">Number of ad concepts</span>
              <select className="select" value={form.variant_count} onChange={e=>update("variant_count",Number(e.target.value))}>
                {[3,4,5].map(n=><option key={n} value={n}>{n} production ads</option>)}
              </select>
            </div>
            {!canSave && <p className="muted" style={{fontSize:12.5,marginTop:12}}>Add a clear creative intent before opening Ad Generation.</p>}
          </div>
        </div>

        <div className="card card-pad" style={{position:"sticky",top:84}}>
          <div className="eyebrow" style={{marginBottom:14}}>Generation inputs</div>
          <SummaryRow label="Event">{campaign?.event?.title || "No event attached"}</SummaryRow>
          <SummaryRow label="Brief">{context.brief}</SummaryRow>
          <SummaryRow label="Audience">{context.audience_segment}</SummaryRow>
          <SummaryRow label="Layout">{layout.layout_direction} · {layout.creative_density}</SummaryRow>
          <SummaryRow label="CTA">{layout.cta_style}</SummaryRow>
          <SummaryRow label="Image context">
            {images.length ? `${images.length} reference image${images.length===1?"":"s"} attached${context.image_context_notes ? ` - ${context.image_context_notes}` : ""}` : "No image references attached"}
          </SummaryRow>
          {images.length>0 && (
            <div className="grid" style={{gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:14}}>
              {images.map((img,idx)=>(
                <div key={`${img.url}-${idx}`} style={{aspectRatio:"1/1",borderRadius:10,overflow:"hidden",background:"var(--canvas-2)",border:"1px solid var(--line)"}}>
                  <img src={img.url} alt={img.filename||`Reference ${idx+1}`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                </div>
              ))}
            </div>
          )}
          <div style={{padding:"11px 13px",background:"var(--canvas-2)",borderRadius:10,marginTop:16}}>
            <div className="row" style={{gap:9}}>
              <Icon name="spark" size={15} style={{color:"var(--brand)",flex:"0 0 15px",marginTop:1}}/>
              <span style={{fontSize:12.5,color:"var(--ink-2)"}}>Saving this concept clears old generated ads so the next Studio output matches the approved strategy.</span>
            </div>
          </div>
          <div style={{marginTop:16}}>
            <Btn variant="primary" iconRight="arrow" disabled={!canSave} onClick={save} style={{width:"100%",justifyContent:"center"}}>{saving?"Saving...":"Save and open Ad Generation"}</Btn>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
