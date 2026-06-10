import React from "react";
import { API } from "../api/client";
import { useStore, navigate } from "../store/store";
import { Icon, Btn, Badge, Tag, AppShell, Stepper, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /campaigns/:id/studio - ad generation
   ============================================================ */
const GEN_STEPS=[
  "Reading the approved brief, layout, image context, and ad concept...",
  "Preparing the ad concept variants for production...",
  "Writing Cloudflare-safe visual prompts with no text or logos...",
  "Generating text-free backgrounds with Cloudflare Flux...",
  "Composing readable ad copy and CTA with the renderer...",
  "Saving final ad images and checking asset status...",
];

function assetUrl(v){
  return v?.ad_image_url || v?.adImageUrl || "";
}

function backgroundUrl(v){
  return v?.background_image_url || v?.backgroundImageUrl || "";
}

function hasAssetState(variants){
  return (variants||[]).some(v=>assetUrl(v) || v.asset_status==="generated" || v.asset_status==="partial" || v.asset_status==="failed");
}

function displayableVariants(variants){
  return (variants||[]).filter(v=>assetUrl(v) || v.asset_status==="generated" || v.asset_status==="partial" || v.asset_status==="failed");
}

function errorMessage(error){
  if(!error) return "Image generation failed. Check Cloudflare setup and retry.";
  if(typeof error === "string") return error;
  return error.message || error.detail || JSON.stringify(error);
}

function VariantCard({v,i,revealed,onRetry}){
  const ipBad=v.ip==="flag" || v.risk==="high";
  const finalImage=assetUrl(v);
  const bgImage=backgroundUrl(v);
  const failed=v.asset_status==="failed";
  const generated=Boolean(finalImage);
  return (
    <div className="card" style={{overflow:"hidden",display:"flex",flexDirection:"column",
      opacity:revealed?1:0,transform:revealed?"none":"translateY(18px)",
      transition:`.55s ${i*0.04}s cubic-bezier(.2,.8,.2,1)`}}>
      <div style={{height:generated?260:150,background:v.grad||"linear-gradient(135deg,#E5342A,#17150F)",position:"relative",overflow:"hidden"}}>
        {generated && <img src={finalImage} alt={`Generated ad variant ${v.letter}`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
        {!generated && bgImage && <img src={bgImage} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",filter:"saturate(.9)",opacity:.78}}/>}
        {!generated && (
          <div style={{position:"absolute",inset:0,padding:"14px 16px",display:"flex",flexDirection:"column",justifyContent:"space-between",background:"linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.48))"}}>
            <div className="row between">
              <span className="badge" style={{background:"rgba(255,255,255,.92)",color:"var(--ink)"}}>Variant {v.letter}</span>
              <span className="badge" style={{background:"rgba(23,21,15,.38)",color:"#fff",backdropFilter:"blur(4px)"}}>{failed?"Asset failed":"Concept ready"}</span>
            </div>
            <div className="row between" style={{alignItems:"flex-end"}}>
              <span style={{color:"#fff",fontFamily:"var(--font-display)",fontWeight:800,fontSize:15,opacity:.94}}>{v.emotion}</span>
              {ipBad
                ? <span className="badge badge-risk"><Icon name="flag" size={12}/>IP flag</span>
                : <span className="badge" style={{background:"rgba(255,255,255,.9)",color:"var(--good)"}}><Icon name="check" size={12}/>Clear</span>}
            </div>
          </div>
        )}
        {generated && (
          <div className="row between" style={{position:"absolute",top:12,left:12,right:12}}>
            <span className="badge" style={{background:"rgba(255,255,255,.92)",color:"var(--ink)"}}>Variant {v.letter}</span>
            <span className="badge" style={{background:"rgba(255,255,255,.92)",color:"var(--good)"}}><Icon name="check" size={12}/>Image generated</span>
          </div>
        )}
      </div>

      <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:13,flex:1}}>
        {failed && (
          <div className="row" style={{gap:9,padding:"10px 12px",background:"var(--risk-soft)",borderRadius:10,fontSize:12.5}}>
            <Icon name="flag" size={15} style={{color:"var(--risk)",flex:"0 0 15px",marginTop:1}}/>
            <span style={{color:"var(--risk)",lineHeight:1.45}}>{errorMessage(v.asset_error)}</span>
          </div>
        )}
        <div>
          <div className="eyebrow" style={{marginBottom:6}}>Headline</div>
          <h3 style={{fontSize:17,lineHeight:1.2}}>{v.headline}</h3>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom:6}}>Primary text</div>
          <p className="soft" style={{fontSize:13.5,lineHeight:1.5}}>{v.primary}</p>
        </div>
        <div className="row wrap" style={{gap:7}}>
          <Tag icon="send">{v.cta}</Tag>
        </div>
        <div className="divider"/>
        <div className="col" style={{gap:8}}>
          <div className="row" style={{gap:9,fontSize:12.5}}><Icon name="eye" size={14} style={{color:"var(--ink-3)",flex:"0 0 14px",marginTop:1}}/><span className="muted">{v.visual}</span></div>
          {v.visual_prompt && (
            <details style={{fontSize:12.5,color:"var(--ink-3)"}}>
              <summary style={{cursor:"pointer",fontWeight:700,color:"var(--ink-2)"}}>Visual prompt</summary>
              <p className="muted" style={{marginTop:6,lineHeight:1.45}}>{v.visual_prompt}</p>
            </details>
          )}
          <div className="row between" style={{fontSize:12.5}}>
            <span className="muted"><Icon name="user" size={13} style={{verticalAlign:"-2px",marginRight:5}}/>{v.audienceSeg}</span>
            <span className="muted">{v.platform}</span>
          </div>
        </div>
        {(ipBad || v.ipNote) && (
          <div className="row" style={{gap:9,padding:"10px 12px",background:ipBad?"var(--risk-soft)":"var(--warn-soft)",borderRadius:10,fontSize:12.5}}>
            <Icon name="shield" size={15} style={{color:ipBad?"var(--risk)":"var(--warn)",flex:"0 0 15px",marginTop:1}}/>
            <span style={{color:"var(--ink-2)"}}>{v.ipNote||"Review before launch."}</span>
          </div>
        )}
        {failed && <Btn variant="soft" icon="loop" onClick={()=>onRetry(v.letter)} style={{width:"100%",justifyContent:"center"}}>Retry this ad</Btn>}
      </div>
    </div>
  );
}

export default function Studio({route,campaignId}){
  const {state,set}=useStore();
  const [campaign,setCampaign]=React.useState(null);
  const [variants,setVariants]=React.useState([]);
  const [phase,setPhase]=React.useState("loading");
  const [genStep,setGenStep]=React.useState(0);
  const [revealCount,setRevealCount]=React.useState(0);
  const [error,setError]=React.useState("");
  const [agentRun,setAgentRun]=React.useState(null);

  const load=React.useCallback(()=>{
    setPhase("loading"); setError("");
    API.getCampaign(campaignId).then(c=>{
      if(!c.context || !c.context.brief){ navigate(`/campaigns/${campaignId}/context`); return; }
      if(!c.layout || !Object.keys(c.layout).length){ navigate(`/campaigns/${campaignId}/layout`); return; }
      if(!c.concept || !c.concept.creative_intent){ navigate(`/campaigns/${campaignId}/concept`); return; }
      const loaded=c.variants||[];
      const readyForDisplay=hasAssetState(loaded);
      setCampaign(c); setVariants(loaded); setAgentRun(c.agent_run||null); setRevealCount(readyForDisplay?loaded.length:0);
      set({
        activeCampaignId:campaignId,
        campaignTitle:c.title||c.campaign_name,
        campaignContextSaved:true,
        campaignLayoutSaved:true,
        campaignConceptSaved:true,
        variantsGenerated:readyForDisplay,
      });
      setPhase(readyForDisplay?"done":"idle");
    }).catch(e=>{ setError(e.message); setPhase("error"); });
  },[campaignId]);

  React.useEffect(()=>{ load(); },[load]);

  React.useEffect(()=>{
    if(phase!=="gen") return;
    let alive=true;
    const poll=async()=>{
      try{
        const c=await API.getCampaign(campaignId);
        if(!alive) return;
        setCampaign(c);
        setAgentRun(c.agent_run||null);
        if(c.variants?.length) setVariants(c.variants);
      }catch(e){
        if(alive) setError(e.message);
      }
    };
    poll();
    const timer=setInterval(poll,1500);
    return ()=>{ alive=false; clearInterval(timer); };
  },[campaignId,phase]);

  const run=async(letters,options={})=>{
    setPhase("gen"); setGenStep(0); setRevealCount(0); setError(""); setAgentRun(null);
    let s=0;
    let current=variants;
    const stepTimer=setInterval(()=>{ s++; setGenStep(Math.min(s,GEN_STEPS.length)); },520);
    try{
      setGenStep(2);
      const body={
        mode:options.mode || "auto",
        force:Boolean(options.force),
        ...(letters ? {variant_letters:letters} : {}),
      };
      const assetRes=await API.generateAdAssets(campaignId, body);
      clearInterval(stepTimer);
      setGenStep(GEN_STEPS.length);
      const generated=assetRes.ads||[];
      const byLetter=new Map(generated.map(v=>[v.letter,v]));
      const out=letters
        ? current.map(v=>byLetter.get(v.letter)||v)
        : generated.length ? generated : current;
      setVariants(out);
      setAgentRun(assetRes.agent_run||null);
      set({variantsGenerated:hasAssetState(out),scored:false});
      if(assetRes.agent_run?.status==="failed" && !generated.length){
        setError(assetRes.agent_run.next_action || errorMessage(assetRes.agent_run.error));
        setPhase(hasAssetState(out)?"done":"idle");
      }else{
        setPhase("done");
      }
      if(assetRes.agent_run?.failed_count){
        setError(assetRes.agent_run.next_action || `${assetRes.agent_run.failed_count} ad asset${assetRes.agent_run.failed_count>1?"s":""} failed. Open the card details and retry after fixing the issue.`);
      }
      out.forEach((_,i)=>setTimeout(()=>setRevealCount(i+1), i*160));
    }catch(e){
      clearInterval(stepTimer); setError(e.message);
      if(current.length){
        setVariants(current);
        setPhase("done");
        setRevealCount(current.length);
        set({variantsGenerated:current.length>0,scored:false});
      }else{
        setPhase("idle");
      }
    }
  };

  if(phase==="loading") return <AppShell route={route} title="Ad Generation" crumb="Campaign"><div className="card card-pad">Loading campaign…</div></AppShell>;
  if(phase==="error") return <AppShell route={route} title="Ad Generation" crumb="Campaign"><EmptyState title="Campaign unavailable" msg={error}/></AppShell>;

  const title=(campaign&&campaign.title)||state.campaignTitle||"Campaign";
  const count = campaign?.concept?.variant_count || 5;
  const displayVariants = displayableVariants(variants);
  const imageCount = variants.filter(v=>assetUrl(v)).length;
  const failedCount = displayVariants.filter(v=>v.asset_status==="failed").length;
  const liveSteps = agentRun?.steps || [];
  const actions = phase==="done"
    ? <><Tag icon="spark">{imageCount}/{variants.length} image ads ready</Tag><Btn variant="primary" size="sm" iconRight="arrow" disabled={!imageCount} onClick={()=>{set({scored:false});navigate(`/campaigns/${campaignId}/scoring`);}}>Compare ads</Btn></>
    : <Tag icon="brain">Concept ready</Tag>;

  return (
    <AppShell route={route} title={title} crumb="Campaign · Ad Generation" actions={actions} wide>
      <div style={{marginBottom:22}}><Stepper current="studio" campaignId={campaignId}/></div>

      <SectionHead eyebrow="Step 5 · Generate"
        title="Ad Generation"
        desc="Campaign context, event timing, layout, image references, and the approved concept become Cloudflare-generated visuals with readable rendered ad copy."
        right={phase==="done" && <Btn variant="ghost" size="sm" icon="loop" onClick={()=>run(null,{force:true})}>Regenerate image ads</Btn>}/>

      {error && <div className="card card-pad" style={{marginBottom:16,background:"var(--risk-soft)",color:"var(--risk)"}}>{error}</div>}

      {phase==="idle" && (
        <div className="card" style={{padding:"54px 32px",textAlign:"center",background:"var(--surface-warm)"}}>
          <div style={{display:"inline-flex",width:60,height:60,borderRadius:18,background:"var(--ink)",color:"var(--canvas)",alignItems:"center",justifyContent:"center",marginBottom:20}}><Icon name="spark" size={28}/></div>
          <h3 style={{fontSize:22,marginBottom:10}}>Generate production ads</h3>
          <p className="soft" style={{fontSize:15,maxWidth:500,margin:"0 auto 24px",lineHeight:1.55}}>
            The backend will create {count} event-aware ad variants if needed, generate Cloudflare Flux visuals, then compose final ad images with readable copy and CTA.
          </p>
          <Btn variant="primary" size="lg" icon="spark" onClick={()=>run()}>Generate image ads</Btn>
        </div>
      )}

      {phase==="gen" && (
        <div className="card card-pad pop" style={{maxWidth:620,margin:"0 auto"}}>
          <div className="row" style={{gap:12,marginBottom:20}}>
            <Icon name="loop" className="spin" style={{color:"var(--brand)"}}/>
          <span style={{fontWeight:700,fontSize:16}}>Generating production ad images...</span>
          </div>
          {liveSteps.length>0 ? (
            <div className="col" style={{gap:10}}>
              {liveSteps.map((step,i)=>{
                const status=step.status || "running";
                const done=status==="complete" || status==="completed" || status==="skipped";
                const failed=status==="failed";
                return (
                  <div key={`${step.agent}-${i}`} className="row" style={{gap:12,alignItems:"flex-start"}}>
                    <span style={{width:22,height:22,borderRadius:99,flex:"0 0 22px",display:"flex",alignItems:"center",justifyContent:"center",
                      background:failed?"var(--risk)":done?"var(--good)":"var(--ink)",color:"#fff"}}>
                      {failed?<Icon name="flag" size={13}/>:done?<Icon name="check" size={13}/>:<Icon name="loop" size={12} className="spin"/>}
                    </span>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:14,color:"var(--ink-2)",fontWeight:700}}>{step.agent}</div>
                      {(step.model || step.reason || step.error?.message || step.error) && (
                        <div className="muted" style={{fontSize:12,lineHeight:1.35,marginTop:3}}>
                          {step.model || step.reason || step.error?.message || String(step.error)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="col" style={{gap:11}}>
              {GEN_STEPS.map((s,i)=>{
                const state=i<genStep?"done":i===genStep?"active":"todo";
                return (
                  <div key={i} className="row" style={{gap:12,opacity:state==="todo"?.4:1,transition:".3s"}}>
                    <span style={{width:22,height:22,borderRadius:99,flex:"0 0 22px",display:"flex",alignItems:"center",justifyContent:"center",
                      background:state==="done"?"var(--good)":state==="active"?"var(--ink)":"var(--canvas-2)",color:state==="todo"?"var(--ink-3)":"#fff"}}>
                      {state==="done"?<Icon name="check" size={13}/>:state==="active"?<Icon name="loop" size={12} className="spin"/>:i+1}
                    </span>
                    <span style={{fontSize:14,color:state==="todo"?"var(--ink-3)":"var(--ink-2)",fontWeight:state==="active"?600:400}}>{s}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="scorebar" style={{marginTop:22}}><span style={{width:(genStep/GEN_STEPS.length*100)+"%",background:"var(--brand)"}}/></div>
        </div>
      )}

      {phase==="done" && (
        <>
          <div className="row wrap" style={{gap:10,marginBottom:18}}>
            <Badge tone="good" icon="check">{displayVariants.filter(v=>v.risk==="low").length} clear to test</Badge>
            <Badge tone="warn" icon="shield">{displayVariants.filter(v=>v.risk==="medium").length} needs review</Badge>
            <Badge tone="risk" icon="flag">{displayVariants.filter(v=>v.risk==="high").length} IP flag</Badge>
            <Badge tone={failedCount?"warn":"good"} icon={failedCount?"flag":"spark"}>{imageCount} final image{imageCount===1?"":"s"}</Badge>
          </div>
          {agentRun?.steps?.length>0 && (
            <div className="card card-pad" style={{marginBottom:18}}>
              <div className="row between wrap" style={{gap:12,marginBottom:12}}>
                <div>
                  <div className="eyebrow" style={{marginBottom:5}}>Agent run</div>
                  <h3 style={{fontSize:17}}>Production pipeline status</h3>
                </div>
                <Badge tone={agentRun.status==="completed"?"good":agentRun.status==="partial"?"warn":"risk"} icon={agentRun.status==="completed"?"check":"flag"}>
                  {agentRun.generated_count||0} generated · {agentRun.failed_count||0} failed
                </Badge>
              </div>
              <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
                {agentRun.steps.map((step,idx)=>(
                  <div key={`${step.agent}-${idx}`} style={{border:"1px solid var(--line)",borderRadius:10,padding:"10px 12px",background:"var(--surface-warm)"}}>
                    <div className="row between" style={{gap:8}}>
                      <span style={{fontWeight:700,fontSize:12.5}}>{step.agent}</span>
                      <Badge tone={step.status==="failed"?"risk":step.status==="skipped"?"soft":"good"}>{step.status}</Badge>
                    </div>
                    {(step.model||step.reason||step.error?.message) && <p className="muted" style={{fontSize:11.5,lineHeight:1.35,marginTop:7}}>{step.model||step.reason||step.error.message}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
            {displayVariants.map((v,i)=><VariantCard key={v.id||v.letter} v={v} i={i} revealed={i<revealCount} onRetry={(letter)=>run([letter])}/>)}
          </div>
          <div className="card card-pad" style={{marginTop:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:14,background:"var(--surface-warm)"}}>
            <div className="row" style={{gap:11}}><Icon name="target" style={{color:"var(--neural)"}}/><span style={{fontWeight:600}}>Next: compare the strongest 2-3 ads by attention, emotion, memory, event fit, and launch risk.</span></div>
            <Btn variant="primary" iconRight="arrow" disabled={!imageCount} onClick={()=>{set({scored:false});navigate(`/campaigns/${campaignId}/scoring`);}}>Compare ads</Btn>
          </div>
        </>
      )}
    </AppShell>
  );
}
