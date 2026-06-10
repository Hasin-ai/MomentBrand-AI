import React from "react";
import { API } from "../api/client";
import { useStore, navigate } from "../store/store";
import { Icon, Btn, Badge, Tag, ScoreBar, AppShell, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /brand/setup - Brand Brain
   ============================================================ */
const DEFAULT_FORM = {
  brand_name:"",
  tagline:"",
  tagline_bn:"",
  industry:"",
  target_audience:"",
  brand_personality:"Warm, Clear, Useful",
  primary:"#E5342A",
  secondary:"#17150F",
  accent:"#FFD15C",
  heading_font:"Anton",
  heading_font_bn:"Hind Siliguri",
  body_font:"Inter",
  body_font_bn:"Noto Sans Bengali",
  tone:"warm, useful, confident",
  language:"both",
  formality:"semi-formal",
  do_not_use:"Unsupported claims\nCompetitor attacks",
  logo:null,
};

function asList(value, fallback=[]){
  const rows = Array.isArray(value) ? value : String(value || "").split(/[\n,]/);
  const clean = rows.map(item=>String(item || "").trim()).filter(Boolean);
  return clean.length ? clean : fallback;
}

function paletteFromForm(form){
  return Array.from(new Set([form.primary, form.secondary, form.accent].filter(Boolean)));
}

function fileToBase64(file){
  if(!file) return Promise.resolve(null);
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload=()=>resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror=()=>reject(new Error("Could not read the logo file."));
    reader.readAsDataURL(file);
  });
}

function brandId(brand){
  return brand?.brand_id || brand?.id || "";
}

function brandColor(brand){
  return brand?.colors?.primary || "#17150F";
}

function brandCompleteness(brand){
  const checks = [
    brand?.brand_name,
    brand?.tagline,
    brand?.industry,
    brand?.target_audience,
    brand?.colors?.primary,
    brand?.typography?.heading_font,
    brand?.voice?.tone,
    (brand?.brand_personality || []).length >= 3,
    (brand?.do_not_use || []).length >= 2,
    brand?.logo_url,
    brand?.product_image_url,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function summarizeBrand(brand){
  return {
    activeBrandId: brandId(brand),
    brandReady: Boolean(brandId(brand)),
    brandName: brand?.brand_name || null,
    brandCategory: brand?.industry || null,
    brandColor: brandColor(brand),
  };
}

function BrandForm({busy,onSubmit,error}){
  const [form,setForm]=React.useState(DEFAULT_FORM);
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));

  const submit=async(e)=>{
    e.preventDefault();
    const personalities = asList(form.brand_personality).slice(0,5);
    const guardrails = asList(form.do_not_use);
    if(personalities.length < 3){
      onSubmit(null, "Add at least three personality tags.");
      return;
    }
    if(guardrails.length < 2){
      onSubmit(null, "Add at least two prohibited claims or guardrails.");
      return;
    }
    const logo_base64 = await fileToBase64(form.logo);
    onSubmit({
      brand_name:form.brand_name.trim(),
      tagline:form.tagline.trim(),
      tagline_bn:form.tagline_bn.trim() || null,
      industry:form.industry.trim(),
      target_audience:form.target_audience.trim(),
      brand_personality:personalities,
      colors:{
        primary:form.primary,
        secondary:form.secondary,
        accent:form.accent,
        palette:paletteFromForm(form),
      },
      typography:{
        heading_font:form.heading_font.trim(),
        heading_font_bn:form.heading_font_bn.trim(),
        body_font:form.body_font.trim(),
        body_font_bn:form.body_font_bn.trim(),
      },
      voice:{
        tone:form.tone.trim(),
        language:form.language,
        formality:form.formality.trim(),
      },
      do_not_use:guardrails,
      logo_base64,
      logo_content_type:form.logo?.type || "image/png",
    });
  };

  return (
    <form className="card card-pad" onSubmit={submit}>
      <div className="row between wrap" style={{gap:14,marginBottom:18}}>
        <div>
          <div className="eyebrow" style={{marginBottom:6}}>Create brand profile</div>
          <h3 style={{fontSize:20}}>Manual brand setup</h3>
        </div>
        <Badge tone="soft" icon="brain">PostgreSQL brand</Badge>
      </div>
      {error && <div className="card" style={{padding:"11px 13px",marginBottom:14,background:"var(--risk-soft)",color:"var(--risk)",fontSize:13}}>{error}</div>}
      <div className="grid" style={{gridTemplateColumns:"1fr 1fr",gap:14}}>
        <label className="field"><span className="label">Brand name</span><input className="input" required value={form.brand_name} onChange={e=>update("brand_name",e.target.value)} placeholder="Volt BD"/></label>
        <label className="field"><span className="label">Industry</span><input className="input" required value={form.industry} onChange={e=>update("industry",e.target.value)} placeholder="Energy drink"/></label>
        <label className="field"><span className="label">Tagline</span><input className="input" required value={form.tagline} onChange={e=>update("tagline",e.target.value)} placeholder="Power your moment"/></label>
        <label className="field"><span className="label">Bengali tagline</span><input className="input" value={form.tagline_bn} onChange={e=>update("tagline_bn",e.target.value)} placeholder="ঐচ্ছিক"/></label>
        <label className="field" style={{gridColumn:"1 / -1"}}><span className="label">Target audience</span><input className="input" required value={form.target_audience} onChange={e=>update("target_audience",e.target.value)} placeholder="Urban Gen Z and young professionals in Bangladesh"/></label>
        <label className="field" style={{gridColumn:"1 / -1"}}><span className="label">Personality tags</span><input className="input" value={form.brand_personality} onChange={e=>update("brand_personality",e.target.value)} placeholder="Warm, Bold, Youthful"/></label>
      </div>

      <div className="divider" style={{margin:"20px 0"}}/>

      <div className="grid" style={{gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {[["primary","Primary color"],["secondary","Secondary color"],["accent","Accent color"]].map(([key,label])=>(
          <label className="field" key={key}>
            <span className="label">{label}</span>
            <div className="row" style={{gap:8}}>
              <input type="color" value={form[key]} onChange={e=>update(key,e.target.value)} style={{width:48,height:42,border:"1px solid var(--line)",borderRadius:10,background:"var(--surface)"}}/>
              <input className="input mono" value={form[key]} onChange={e=>update(key,e.target.value)} pattern="^#[0-9A-Fa-f]{6}$"/>
            </div>
          </label>
        ))}
      </div>

      <div className="grid" style={{gridTemplateColumns:"1fr 1fr",gap:14,marginTop:16}}>
        <label className="field"><span className="label">Heading font</span><input className="input" value={form.heading_font} onChange={e=>update("heading_font",e.target.value)}/></label>
        <label className="field"><span className="label">Bengali heading font</span><input className="input" value={form.heading_font_bn} onChange={e=>update("heading_font_bn",e.target.value)}/></label>
        <label className="field"><span className="label">Body font</span><input className="input" value={form.body_font} onChange={e=>update("body_font",e.target.value)}/></label>
        <label className="field"><span className="label">Bengali body font</span><input className="input" value={form.body_font_bn} onChange={e=>update("body_font_bn",e.target.value)}/></label>
        <label className="field"><span className="label">Voice tone</span><input className="input" value={form.tone} onChange={e=>update("tone",e.target.value)} placeholder="warm, playful, confident"/></label>
        <label className="field"><span className="label">Language</span><select className="select" value={form.language} onChange={e=>update("language",e.target.value)}><option value="en">English</option><option value="bn">Bengali</option><option value="both">Both</option></select></label>
        <label className="field"><span className="label">Formality</span><input className="input" value={form.formality} onChange={e=>update("formality",e.target.value)} placeholder="semi-formal"/></label>
        <label className="field"><span className="label">Logo image</span><input className="input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>update("logo",e.target.files?.[0] || null)}/></label>
        <label className="field" style={{gridColumn:"1 / -1"}}><span className="label">Claims and words to avoid</span><textarea className="textarea" value={form.do_not_use} onChange={e=>update("do_not_use",e.target.value)}/></label>
      </div>
      <div className="row between wrap" style={{gap:14,marginTop:20}}>
        <p className="muted" style={{fontSize:12.5,lineHeight:1.5,maxWidth:540}}>This creates a backend brand record that later campaign steps can select for event acceptance, product cutouts, generation, and scoring.</p>
        <Btn type="submit" variant="primary" icon="check" disabled={busy}>{busy?"Saving brand...":"Create brand"}</Btn>
      </div>
    </form>
  );
}

function BrandSummary({brand}){
  const colors = brand?.colors || {};
  const palette = colors.palette?.length ? colors.palette : [colors.primary, colors.secondary, colors.accent].filter(Boolean);
  const typography = brand?.typography || {};
  const completeness = brandCompleteness(brand);
  return (
    <div className="card card-pad" style={{marginBottom:20,background:"var(--surface-warm)"}}>
      <div className="row between wrap" style={{gap:16}}>
        <div className="row" style={{gap:14}}>
          {brand.logo_url
            ? <img src={brand.logo_url} alt={`${brand.brand_name} logo`} style={{width:52,height:52,borderRadius:13,objectFit:"contain",background:"var(--surface)",border:"1px solid var(--line)",padding:6}}/>
            : <div className="brandmark" style={{background:brandColor(brand),width:52,height:52,borderRadius:13,fontSize:20}}>{(brand.brand_name || "B").charAt(0)}</div>}
          <div>
            <div className="row wrap" style={{gap:9,alignItems:"baseline"}}>
              <h3 style={{fontSize:20}}>{brand.brand_name}</h3>
              <span className="muted" style={{fontSize:13}}>{brand.industry}</span>
            </div>
            <div className="muted" style={{fontSize:13}}>{brand.tagline}{brand.tagline_bn ? ` · ${brand.tagline_bn}` : ""}</div>
          </div>
        </div>
        <div style={{minWidth:220,flex:"0 1 280px"}}>
          <div className="row between" style={{fontSize:12.5,marginBottom:6}}><span className="soft">Brain completeness</span><span className="mono" style={{fontWeight:700}}>{completeness}%</span></div>
          <ScoreBar value={completeness} color={completeness>=80?"var(--good)":"var(--warn)"}/>
        </div>
      </div>
      <div className="row wrap" style={{gap:8,marginTop:18}}>
        {palette.map(color=>(
          <span key={color} className="tag" style={{gap:7}}>
            <span style={{width:14,height:14,borderRadius:99,background:color,border:"1px solid var(--line)"}}/>
            <span className="mono">{color}</span>
          </span>
        ))}
        <Tag icon="doc">{typography.heading_font || "Heading font"}</Tag>
        <Tag icon="doc">{typography.body_font || "Body font"}</Tag>
      </div>
    </div>
  );
}

export default function BrandSetup({route}){
  const {state,set}=useStore();
  const [tab,setTab]=React.useState("identity");
  const [brands,setBrands]=React.useState([]);
  const [activeBrand,setActiveBrand]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState("");
  const [formError,setFormError]=React.useState("");
  const tabs=[["identity","Identity"],["voice","Voice & rules"],["catalog","Product"],["audience","Audience"],["connections","Connections"]];

  const loadBrands=React.useCallback(async(preferredId)=>{
    setLoading(true); setError("");
    try{
      const rows=await API.listBrands();
      setBrands(rows || []);
      const selectedId = preferredId || state.activeBrandId || rows?.[0]?.id;
      if(selectedId){
        const full=await API.getBrand(selectedId);
        setActiveBrand(full);
        set(summarizeBrand(full));
      }else{
        setActiveBrand(null);
        set({brandReady:false,activeBrandId:null,brandName:null,brandCategory:null,brandColor:null});
      }
    }catch(e){
      setError(e.message);
      setBrands([]);
      setActiveBrand(null);
    }finally{
      setLoading(false);
    }
  },[set,state.activeBrandId]);

  React.useEffect(()=>{ loadBrands(); },[loadBrands]);

  const chooseBrand=async(id)=>{
    setError("");
    try{
      const full=await API.getBrand(id);
      setActiveBrand(full);
      set(summarizeBrand(full));
    }catch(e){ setError(e.message); }
  };

  const createBrand=async(payload,clientError)=>{
    setFormError(clientError || "");
    if(clientError || !payload) return;
    setSaving(true);
    try{
      const res=await API.createManualBrand(payload);
      const brand=res.brand || {...payload,brand_id:res.brand_id};
      setActiveBrand(brand);
      set(summarizeBrand(brand));
      await loadBrands(res.brand_id);
      setTab("identity");
    }catch(e){
      setFormError(e.message);
    }finally{
      setSaving(false);
    }
  };

  const B=activeBrand;
  const actions=B
    ? <><Badge tone="good" icon="check">{brandCompleteness(B)}% complete</Badge><Btn variant="primary" size="sm" icon="check" onClick={()=>{set(summarizeBrand(B));navigate("/events");}}>Save & continue</Btn></>
    : <Badge tone="warn">No brand selected</Badge>;

  if(loading) return <AppShell route={route} title="Brand Brain" crumb="Workspace"><div className="card card-pad">Loading brand profiles...</div></AppShell>;

  return (
    <AppShell route={route} title="Brand Brain" crumb={B ? `${B.brand_name} workspace` : "Brand workspace"} actions={actions}>
      <SectionHead eyebrow="The intelligence layer" title="Brand Brain"
        desc="Set brand identity, rules, product assets, and audience context once so campaigns start from production data instead of mock profiles."/>

      {error && <div className="card card-pad" style={{marginBottom:18,background:"var(--warn-soft)",color:"var(--warn)"}}>{error}</div>}

      {brands.length>0 && (
        <div className="card card-pad" style={{marginBottom:18}}>
          <div className="row between wrap" style={{gap:14,marginBottom:14}}>
            <div>
              <div className="eyebrow" style={{marginBottom:6}}>Brand library</div>
              <h3 style={{fontSize:18}}>Select the active brand</h3>
            </div>
            <Badge tone="soft">{brands.length} saved</Badge>
          </div>
          <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
            {brands.map(brand=>(
              <button key={brand.id} type="button" onClick={()=>chooseBrand(brand.id)} className="card card-hover" style={{padding:"12px 13px",textAlign:"left",borderColor:brand.id===brandId(B)?"var(--ink)":"var(--line)",background:"var(--surface)"}}>
                <div className="row" style={{gap:10}}>
                  {brand.logo_url
                    ? <img src={brand.logo_url} alt="" style={{width:36,height:36,borderRadius:9,objectFit:"contain",border:"1px solid var(--line)",padding:4}}/>
                    : <span className="brandmark" style={{width:36,height:36,borderRadius:9,background:brand.colors?.primary || "var(--ink)"}}>{(brand.brand_name || "B").charAt(0)}</span>}
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:13.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{brand.brand_name}</div>
                    <div className="muted" style={{fontSize:11.5}}>{brand.created_at ? new Date(brand.created_at).toLocaleDateString() : "Saved brand"}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!B && (
        <div className="grid" style={{gridTemplateColumns:"1fr",gap:18}}>
          {brands.length===0 && !error && <EmptyState title="No brand profile yet" msg="Create a brand profile to unlock event acceptance, campaign generation, and product cutouts."/>}
          <BrandForm busy={saving} onSubmit={createBrand} error={formError}/>
        </div>
      )}

      {B && (
        <>
          <BrandSummary brand={B}/>
          <div className="row wrap" style={{gap:8,marginBottom:18}}>
            {tabs.map(([k,l])=>(
              <button key={k} className="tag" onClick={()=>setTab(k)}
                style={{cursor:"pointer",fontWeight:600,...(tab===k?{background:"var(--ink)",color:"var(--canvas)",borderColor:"var(--ink)"}:{})}}>{l}</button>
            ))}
          </div>

          <div className="route-enter" key={tab}>
          {tab==="identity" && (
            <div className="grid" style={{gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div className="card card-pad">
                <div className="eyebrow" style={{marginBottom:14}}>Logo & wordmark</div>
                <div style={{border:"1px dashed var(--line-2)",borderRadius:14,padding:"34px",textAlign:"center",background:"var(--surface-warm)"}}>
                  {B.logo_url
                    ? <img src={B.logo_url} alt={`${B.brand_name} logo`} style={{maxWidth:"100%",maxHeight:150,objectFit:"contain"}}/>
                    : <div style={{fontFamily:"var(--font-display)",fontWeight:800,fontSize:40,color:brandColor(B)}}>{B.brand_name}</div>}
                  <div className="muted" style={{fontSize:12.5,marginTop:8}}>Stored brand identity</div>
                </div>
              </div>
              <div className="card card-pad">
                <div className="eyebrow" style={{marginBottom:14}}>Palette & type</div>
                <div className="row" style={{gap:10,marginBottom:18}}>
                  {(B.colors?.palette || [B.colors?.primary,B.colors?.secondary,B.colors?.accent].filter(Boolean)).map(color=>(
                    <div key={color} style={{flex:1}}>
                      <div style={{height:54,borderRadius:11,background:color,border:"1px solid var(--line)"}}/>
                      <div className="mono muted" style={{fontSize:10.5,marginTop:6,textAlign:"center"}}>{color}</div>
                    </div>
                  ))}
                </div>
                <div className="row" style={{gap:12}}>
                  <div className="card" style={{flex:1,padding:"12px 14px"}}><div className="muted" style={{fontSize:11}}>Display</div><div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:17}}>{B.typography?.heading_font}</div></div>
                  <div className="card" style={{flex:1,padding:"12px 14px"}}><div className="muted" style={{fontSize:11}}>Body</div><div style={{fontWeight:600,fontSize:17}}>{B.typography?.body_font}</div></div>
                </div>
              </div>
            </div>
          )}

          {tab==="voice" && (
            <div className="grid" style={{gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div className="card card-pad">
                <div className="eyebrow" style={{marginBottom:14}}>Tone of voice</div>
                <div className="row wrap" style={{gap:8,marginBottom:18}}>
                  {(B.brand_personality || []).map(item=><Badge key={item} tone="soft">{item}</Badge>)}
                </div>
                <div className="field"><span className="label">Voice guidance</span>
                  <div className="textarea" style={{minHeight:96,background:"var(--surface-warm)"}}>{B.voice?.tone || "No voice tone saved yet."}</div>
                </div>
                <div className="row wrap" style={{gap:8,marginTop:12}}>
                  <Tag icon="doc">Language: {B.voice?.language || "not set"}</Tag>
                  <Tag icon="doc">Formality: {B.voice?.formality || "not set"}</Tag>
                </div>
              </div>
              <div className="card card-pad">
                <div className="row between" style={{marginBottom:14}}><div className="eyebrow">Prohibited claims</div><Badge tone="risk" icon="shield">Enforced</Badge></div>
                <div className="col" style={{gap:9}}>
                  {(B.do_not_use || []).map((item,i)=>(
                    <div key={i} className="row" style={{gap:10,padding:"10px 12px",background:"var(--risk-soft)",borderRadius:10}}>
                      <Icon name="flag" size={15} style={{color:"var(--risk)",flex:"0 0 15px"}}/>
                      <span style={{fontSize:13.5,color:"var(--ink-2)"}}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==="catalog" && (
            <div className="card card-pad">
              <div className="row between wrap" style={{gap:14}}>
                <div>
                  <div className="eyebrow" style={{marginBottom:7}}>Product asset</div>
                  <h3 style={{fontSize:18}}>{B.product_image_url ? "Transparent product cutout saved" : "No product cutout saved yet"}</h3>
                  <p className="muted" style={{fontSize:13.5,marginTop:6}}>Campaign Context can upload a product image for background removal and save the returned transparent PNG to this brand.</p>
                </div>
                <Btn variant="soft" iconRight="arrow" onClick={()=>navigate("/events")}>Start campaign</Btn>
              </div>
              {B.product_image_url && <div style={{marginTop:18,border:"1px solid var(--line)",borderRadius:12,padding:18,background:"var(--surface-warm)",textAlign:"center"}}>
                <img src={B.product_image_url} alt="Product cutout" style={{maxWidth:"100%",maxHeight:260,objectFit:"contain"}}/>
              </div>}
            </div>
          )}

          {tab==="audience" && (
            <div className="card card-pad">
              <div className="eyebrow" style={{marginBottom:8}}>Target audience</div>
              <h3 style={{fontSize:18,marginBottom:9}}>{B.target_audience}</h3>
              <p className="soft" style={{fontSize:13.5,lineHeight:1.5}}>This audience context is sent into campaign strategy, copywriting, and visual prompt generation.</p>
            </div>
          )}

          {tab==="connections" && (
            <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>
              {[
                ["PostgreSQL","connected","Brand, campaign, agent-run, and score records."],
                ["Cloudflare Workers AI","available","Used during ad generation for text-free backgrounds."],
                ["TRIBE v2 Brain API","available","Used after generation for neuromarketing proxy scores."],
              ].map(([name,status,note])=>(
                <div key={name} className="card card-pad">
                  <div className="row between" style={{marginBottom:12}}>
                    <h3 style={{fontSize:15.5}}>{name}</h3>
                    <Badge tone={status==="connected"?"good":"soft"} icon={status==="connected"?"check":undefined}>{status==="connected"?"Connected":"Configured by API"}</Badge>
                  </div>
                  <p className="muted" style={{fontSize:13}}>{note}</p>
                </div>
              ))}
            </div>
          )}
          </div>

          <div style={{marginTop:20}}>
            <BrandForm busy={saving} onSubmit={createBrand} error={formError}/>
          </div>
        </>
      )}
    </AppShell>
  );
}
