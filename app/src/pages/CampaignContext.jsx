import React from "react";
import { API } from "../api/client";
import { useStore, navigate } from "../store/store";
import { Icon, Btn, Badge, AppShell, Stepper, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /campaigns/:id/context — campaign context inputs
   ============================================================ */
const IMAGE_CONTEXT_LIMIT = 3;
const IMAGE_CONTEXT_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_CONTEXT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_CONTEXT_ROLES = [
  {value:"reference", label:"Visual reference", help:"Guide mood, product framing, color, or composition."},
  {value:"edit_source", label:"Edit source", help:"Use this image as the base when generation mode allows editing."},
];

function formatBytes(bytes){
  if(!bytes) return "0 KB";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function normalizeImages(images){
  return Array.isArray(images)
    ? images.map(img=>({...img, role: img.role==="edit_source" ? "edit_source" : "reference"})).slice(0,IMAGE_CONTEXT_LIMIT)
    : [];
}

export default function CampaignContext({route,campaignId}){
  const {state,set}=useStore();
  const [campaign,setCampaign]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [saving,setSaving]=React.useState(false);
  const [uploading,setUploading]=React.useState(false);
  const [productUploading,setProductUploading]=React.useState(false);
  const [error,setError]=React.useState("");
  const [uploadError,setUploadError]=React.useState("");
  const [productError,setProductError]=React.useState("");
  const [brand,setBrand]=React.useState(null);
  const [form,setForm]=React.useState({
    brief:"",
    objective:"awareness",
    audience_segment:"",
    product_offer:"",
    tone_override:"default brand voice",
    language:"English",
    safety_notes:"",
    platform_intent:"Meta feed",
    image_context_notes:"",
    image_context_images:[],
  });

  React.useEffect(()=>{
    let alive=true;
    setLoading(true); setError("");
    API.getCampaign(campaignId).then(c=>{
      if(!alive) return;
      setCampaign(c);
      if(c.brand_id){
        API.getBrand(c.brand_id).then(brand=>{
          if(!alive) return;
          setBrand(brand);
          set({
            activeBrandId:brand.brand_id,
            brandReady:true,
            brandName:brand.brand_name,
            brandCategory:brand.industry,
            brandColor:brand.colors?.primary,
          });
        }).catch(()=>{});
      }
      const context=c.context||{};
      setForm(f=>({
        ...f,
        ...context,
        brief:context.brief||`Create a timely campaign for ${(c.event&&c.event.title)||"this event"}.`,
        image_context_notes:context.image_context_notes||"",
        image_context_images:normalizeImages(context.image_context_images),
      }));
      set({activeCampaignId:campaignId,campaignTitle:c.title||c.campaign_name});
    }).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false));
    return ()=>{alive=false};
  },[campaignId]);

  const update=(k,v)=>setForm(f=>({...f,[k]:v}));
  const canSave=form.brief.trim().length>=12 && !saving && !uploading && !productUploading;
  const imageCount=(form.image_context_images||[]).length;
  const uploadImage=async(file)=>{
    setUploadError("");
    if(!file) return;
    if(imageCount>=IMAGE_CONTEXT_LIMIT){
      setUploadError("You can attach up to 3 reference images.");
      return;
    }
    if(!IMAGE_CONTEXT_TYPES.includes(file.type)){
      setUploadError("Upload a PNG, JPG, or WebP image.");
      return;
    }
    if(file.size>IMAGE_CONTEXT_MAX_BYTES){
      setUploadError("Image context files must be 5 MB or smaller.");
      return;
    }
    const fd=new FormData();
    fd.append("image",file);
    fd.append("current_count",String(imageCount));
    setUploading(true);
    try{
      const uploaded=await API.uploadContextImage(campaignId,fd);
      setForm(f=>({
        ...f,
        image_context_images:[...(f.image_context_images||[]),{...uploaded,role:uploaded.role||"reference"}].slice(0,IMAGE_CONTEXT_LIMIT),
      }));
    }catch(e){
      setUploadError(e.message);
    }finally{
      setUploading(false);
    }
  };
  const removeImage=(idx)=>{
    setForm(f=>({
      ...f,
      image_context_images:(f.image_context_images||[]).filter((_,i)=>i!==idx),
    }));
  };
  const updateImageRole=(idx,role)=>{
    setForm(f=>({
      ...f,
      image_context_images:(f.image_context_images||[]).map((img,i)=>i===idx?{...img,role}:img),
    }));
  };
  const uploadProductImage=async(file)=>{
    setProductError("");
    if(!file) return;
    if(!campaign?.brand_id){
      setProductError("This campaign is not attached to a brand. Select a brand when accepting an event.");
      return;
    }
    if(!IMAGE_CONTEXT_TYPES.includes(file.type)){
      setProductError("Upload a PNG, JPG, or WebP product image.");
      return;
    }
    if(file.size>PRODUCT_IMAGE_MAX_BYTES){
      setProductError("Product images must be 8 MB or smaller.");
      return;
    }
    const fd=new FormData();
    fd.append("product_image",file);
    setProductUploading(true);
    try{
      const res=await API.uploadProductImage(campaign.brand_id,fd);
      setBrand(current=>({
        ...(current||{}),
        brand_id:campaign.brand_id,
        product_image_url:res.product_image_url,
      }));
    }catch(e){
      setProductError(e.message);
    }finally{
      setProductUploading(false);
    }
  };
  const save=async()=>{
    setSaving(true); setError("");
    try{
      const c=await API.saveContext(campaignId,form);
      set({campaignContextSaved:true,campaignLayoutSaved:false,campaignConceptSaved:false,variantsGenerated:false,campaignTitle:c.title||c.campaign_name,activeCampaignId:campaignId});
      navigate(`/campaigns/${campaignId}/layout`);
    }catch(e){ setError(e.message); }
    finally{ setSaving(false); }
  };

  if(loading) return <AppShell route={route} title="Campaign Context" crumb="Campaign"><div className="card card-pad">Loading campaign…</div></AppShell>;
  if(error && !campaign) return <AppShell route={route} title="Campaign Context" crumb="Campaign"><EmptyState title="Campaign unavailable" msg={error}/></AppShell>;

  return (
    <AppShell route={route} title={(campaign&&campaign.title)||"Campaign Context"} crumb="Campaign · Context"
      actions={<Btn variant="primary" size="sm" iconRight="arrow" disabled={!canSave} onClick={save}>{saving?"Saving...":"Save brief"}</Btn>}>
      <div style={{marginBottom:22}}><Stepper current="context" campaignId={campaignId}/></div>
      <SectionHead eyebrow="Step 2 · Shape the brief" title="Tell the generator what this campaign must accomplish"
        desc="Keep the brief plain-language. The best inputs name the audience, the event angle, the offer, and any claims or references to avoid."/>
      {error && <div className="card card-pad" style={{marginBottom:16,background:"var(--risk-soft)",color:"var(--risk)"}}>{error}</div>}

      <div className="grid" style={{gridTemplateColumns:"1.45fr 1fr",gap:18,alignItems:"start"}}>
        <div className="card card-pad">
          <div className="field" style={{marginBottom:16}}>
            <div className="row between">
              <span className="label">Campaign brief</span>
              <span className="muted mono" style={{fontSize:11}}>{form.brief.trim().length} characters</span>
            </div>
            <textarea className="textarea" style={{minHeight:132}} value={form.brief} onChange={e=>update("brief",e.target.value)}/>
            <p className="muted" style={{fontSize:12.5}}>Example: “Create an Eid bundle ad for young families. Warm, celebratory, Bengali-first, no discount exaggeration.”</p>
          </div>
          <div className="grid" style={{gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div className="field"><span className="label">Campaign goal</span><select className="select" value={form.objective} onChange={e=>update("objective",e.target.value)}>{["awareness","traffic","conversion","engagement"].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
            <div className="field"><span className="label">Language</span><select className="select" value={form.language} onChange={e=>update("language",e.target.value)}>{["English","Bengali","Both"].map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="field"><span className="label">Who should care?</span><input className="input" value={form.audience_segment||""} onChange={e=>update("audience_segment",e.target.value)} placeholder="18-34 social sharers"/></div>
            <div className="field"><span className="label">Where will it run?</span><select className="select" value={form.platform_intent||"Meta feed"} onChange={e=>update("platform_intent",e.target.value)}>{["Meta feed","Reels / Stories","TikTok-style vertical","YouTube / Facebook landscape"].map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="field"><span className="label">Product, offer, or launch hook</span><input className="input" value={form.product_offer||""} onChange={e=>update("product_offer",e.target.value)} placeholder="Bundle, SKU, discount, launch message"/></div>
            <div className="field"><span className="label">Tone adjustment</span><select className="select" value={form.tone_override||"default brand voice"} onChange={e=>update("tone_override",e.target.value)}>{["default brand voice","playful","urgent","premium","community","informative"].map(x=><option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="field" style={{marginTop:16}}>
            <span className="label">Claims, IP, and cultural guardrails</span>
            <textarea className="textarea" value={form.safety_notes||""} onChange={e=>update("safety_notes",e.target.value)} placeholder="Claims to avoid, IP-sensitive terms, cultural sensitivity guidance"/>
          </div>

          <div className="divider" style={{margin:"20px 0"}}/>

          <div className="card" style={{padding:16,marginBottom:18,background:"var(--surface-warm)"}}>
            <div className="row between wrap" style={{gap:14,marginBottom:12}}>
              <div>
                <div className="eyebrow" style={{marginBottom:6}}>Product focus</div>
                <h3 style={{fontSize:18}}>Upload product image for cutout</h3>
                <p className="muted" style={{fontSize:12.5,lineHeight:1.45,marginTop:5}}>The backend removes the background when Remove.bg is configured, then saves the product asset to the selected brand.</p>
              </div>
              <label className={`btn btn-${productUploading?"soft":"primary"}`} style={{cursor:productUploading?"not-allowed":"pointer"}}>
                <Icon name={productUploading?"loop":"plus"} className={productUploading?"spin":undefined}/>
                {productUploading?"Processing...":"Choose product"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={productUploading}
                  onChange={e=>{ uploadProductImage(e.target.files?.[0]); e.target.value=""; }}
                  style={{display:"none"}}
                />
              </label>
            </div>
            {productError && <div style={{padding:"10px 12px",marginBottom:12,background:"var(--risk-soft)",color:"var(--risk)",fontSize:13,borderRadius:10}}>{productError}</div>}
            {brand?.product_image_url ? (
              <div className="row wrap" style={{gap:14,alignItems:"center"}}>
                <div style={{width:124,height:124,border:"1px solid var(--line)",borderRadius:12,background:"var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",padding:10}}>
                  <img src={brand.product_image_url} alt="Product cutout preview" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>
                </div>
                <div>
                  <Badge tone="good" icon="check">Product asset saved</Badge>
                  <p className="muted" style={{fontSize:12.5,lineHeight:1.45,marginTop:8}}>This product image will be available to the composition agent during ad generation.</p>
                </div>
              </div>
            ) : (
              <div className="row" style={{gap:10,color:"var(--ink-3)",fontSize:13}}>
                <Icon name="layers" size={16}/>
                <span>No product cutout is attached to this brand yet.</span>
              </div>
            )}
          </div>

          <div>
            <div className="row between wrap" style={{gap:12,marginBottom:12}}>
              <div>
                <div className="eyebrow" style={{marginBottom:6}}>Image context</div>
                <h3 style={{fontSize:18}}>Add visual references for this campaign</h3>
              </div>
              <Badge tone={imageCount>=IMAGE_CONTEXT_LIMIT?"warn":"soft"} icon="eye">{imageCount}/{IMAGE_CONTEXT_LIMIT} images</Badge>
            </div>
            <p className="muted" style={{fontSize:12.5,lineHeight:1.5,marginBottom:14}}>
              Upload product shots, mood references, or sample creative direction. Mark an image as an edit source only when the generated visual should be based on that image.
            </p>

            <div className="field" style={{marginBottom:14}}>
              <span className="label">Reference notes</span>
              <textarea
                className="textarea"
                style={{minHeight:86}}
                value={form.image_context_notes||""}
                onChange={e=>update("image_context_notes",e.target.value)}
                placeholder="Example: Use the first image for product framing, the second for mood and lighting. Avoid copying the layout exactly."
              />
            </div>

            <div style={{border:"1px dashed var(--line-2)",borderRadius:14,padding:14,background:"var(--surface-warm)",marginBottom:14}}>
              <div className="row between wrap" style={{gap:12}}>
                <div className="row" style={{gap:10}}>
                  <span style={{width:38,height:38,borderRadius:12,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"var(--canvas-2)",color:"var(--ink-2)",flex:"0 0 38px"}}>
                    <Icon name="eye" size={19}/>
                  </span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>Upload reference image</div>
                    <div className="muted" style={{fontSize:12}}>PNG, JPG, or WebP · max 5 MB each</div>
                  </div>
                </div>
                <label className={`btn btn-${imageCount>=IMAGE_CONTEXT_LIMIT||uploading?"soft":"primary"}`} style={{cursor:imageCount>=IMAGE_CONTEXT_LIMIT||uploading?"not-allowed":"pointer"}}>
                  <Icon name={uploading?"loop":"plus"} className={uploading?"spin":undefined}/>
                  {uploading?"Uploading...":"Choose image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={imageCount>=IMAGE_CONTEXT_LIMIT||uploading}
                    onChange={e=>{ uploadImage(e.target.files?.[0]); e.target.value=""; }}
                    style={{display:"none"}}
                  />
                </label>
              </div>
            </div>

            {uploadError && <div style={{padding:"10px 12px",marginBottom:14,background:"var(--risk-soft)",color:"var(--risk)",fontSize:13,borderRadius:10}}>{uploadError}</div>}

            {imageCount>0 && (
              <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
                {(form.image_context_images||[]).map((img,idx)=>(
                  <div key={`${img.url}-${idx}`} style={{border:"1px solid var(--line)",borderRadius:12,overflow:"hidden",background:"var(--surface)"}}>
                    <div style={{aspectRatio:"4/3",background:"var(--canvas-2)",overflow:"hidden"}}>
                      <img src={img.url} alt={img.filename||`Reference ${idx+1}`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                    </div>
                    <div style={{padding:"10px 11px"}}>
                      <div className="row between" style={{gap:8,alignItems:"flex-start"}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:12.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{img.filename}</div>
                          <div className="muted" style={{fontSize:11.5,marginTop:2}}>{img.content_type} · {formatBytes(img.size_bytes)}</div>
                        </div>
                        <button type="button" onClick={()=>removeImage(idx)} aria-label={`Remove ${img.filename}`} style={{border:"1px solid var(--line)",background:"var(--surface-warm)",borderRadius:8,width:30,height:30,display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--ink-2)",flex:"0 0 30px"}}>
                          <Icon name="plus" size={16} style={{transform:"rotate(45deg)"}}/>
                        </button>
                      </div>
                      <div className="field" style={{marginTop:10}}>
                        <span className="label" style={{fontSize:11}}>Generation role</span>
                        <select className="select" value={img.role||"reference"} onChange={e=>updateImageRole(idx,e.target.value)} style={{height:38,fontSize:12}}>
                          {IMAGE_CONTEXT_ROLES.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}
                        </select>
                        <p className="muted" style={{fontSize:11.5,lineHeight:1.35,marginTop:5}}>
                          {(IMAGE_CONTEXT_ROLES.find(role=>role.value===(img.role||"reference"))||IMAGE_CONTEXT_ROLES[0]).help}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!canSave && <p className="muted" style={{fontSize:12.5,marginTop:12}}>Add at least a short campaign brief before moving to layout.</p>}
        </div>

        <div className="card card-pad" style={{position:"sticky",top:84}}>
          <div className="eyebrow" style={{marginBottom:14}}>Accepted event</div>
          <div className="row" style={{gap:12,marginBottom:14}}>
            <span style={{fontSize:34}}>{campaign&&campaign.event&&campaign.event.emoji || "📅"}</span>
            <div><h3 style={{fontSize:17}}>{campaign&&campaign.event&&campaign.event.title || "Campaign event"}</h3><div className="muted" style={{fontSize:12.5}}>{campaign&&campaign.event&&campaign.event.window}</div></div>
          </div>
          {campaign&&campaign.event&&<div className="col" style={{gap:9}}>
            <Badge tone={campaign.event.risk==="high"?"risk":campaign.event.risk==="medium"?"warn":"good"} icon={campaign.event.risk==="high"?"flag":"shield"}>{campaign.event.risk} risk</Badge>
            <p className="soft" style={{fontSize:13.5,lineHeight:1.5}}>{campaign.event.risk_note}</p>
          </div>}
        </div>
      </div>
    </AppShell>
  );
}
