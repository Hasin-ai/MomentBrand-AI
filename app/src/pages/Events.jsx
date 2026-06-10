import React from "react";
import { API } from "../api/client";
import { useStore, navigate, scoreColor, riskBadge } from "../store/store";
import { Icon, Btn, Badge, Tag, ScoreBar, AppShell, SectionHead, EmptyState } from "../components/ui";

/* ============================================================
   Route: /events  — Event Radar
   ============================================================ */
function Countdown({days}){
  return (
    <div className="row" style={{gap:6,alignItems:"baseline"}}>
      <span className="kpi" style={{fontSize:24}}>{days}</span>
      <span className="muted" style={{fontSize:12}}>day{days===1?"":"s"} to peak</span>
    </div>
  );
}

function EventCard({ev,onSelect,accepted,busy,canSelect}){
  const risk=ev.risk||"low";
  const [r1,b1]=riskBadge(risk);
  const title=ev.title||ev.name;
  const riskLabel=["Low risk","Medium risk","High IP risk"][{low:0,medium:1,high:2}[risk]||0];
  return (
    <div className="card card-hover" style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"18px 20px 0"}}>
        <div className="row between" style={{marginBottom:14}}>
          <div className="row" style={{gap:13}}>
            <span style={{fontSize:34,lineHeight:1}}>{ev.emoji||"📅"}</span>
            <div>
              <div className="row" style={{gap:8,alignItems:"center"}}>
                <h3 style={{fontSize:18}}>{title}</h3>
                {ev.recommended && <Badge tone="ink" icon="spark">Recommended</Badge>}
              </div>
              <div className="muted" style={{fontSize:12.5,marginTop:3}}>{ev.kind} · {ev.window||ev.event_date}</div>
            </div>
          </div>
          <span className={`badge ${b1==="badge-good"?"badge-good":r1}`}><Icon name={risk==="low"?"shield":"flag"} size={13}/>{riskLabel}</span>
        </div>
      </div>

      <div className="row" style={{padding:"0 20px",gap:18,marginBottom:16,flexWrap:"wrap"}}>
        <div>
          <div className="eyebrow" style={{marginBottom:6}}>Relevance</div>
          <div className="row" style={{gap:8,alignItems:"center"}}>
            <div className="kpi" style={{fontSize:22,color:scoreColor(ev.relevance||70)}}>{ev.relevance||70}</div>
            <div style={{width:60}}><ScoreBar value={ev.relevance||70} color={scoreColor(ev.relevance||70)}/></div>
          </div>
        </div>
        <div style={{borderLeft:"1px solid var(--line)",paddingLeft:18}}>
          <div className="eyebrow" style={{marginBottom:6}}>Timing</div>
          <Countdown days={ev.days||0}/>
        </div>
        <div style={{borderLeft:"1px solid var(--line)",paddingLeft:18}}>
          <div className="eyebrow" style={{marginBottom:6}}>Source</div>
          <div className="row" style={{gap:6,alignItems:"center",color:"var(--good)"}}><Icon name="cal" size={15}/><span style={{fontWeight:700,fontSize:14}}>{ev.trend||"Calendarific"}</span></div>
        </div>
      </div>

      <div style={{padding:"0 20px 18px",marginTop:"auto"}}>
        <div className="col" style={{gap:8,marginBottom:16}}>
          <div className="row" style={{gap:9,fontSize:13}}><Icon name="user" size={15} style={{color:"var(--ink-3)",flex:"0 0 15px"}}/><span className="soft">{ev.audience}</span></div>
          <div className="row" style={{gap:9,fontSize:13}}><Icon name="loop" size={15} style={{color:"var(--ink-3)",flex:"0 0 15px"}}/><span className="soft">{ev.hist}</span></div>
          <div className="row" style={{gap:9,fontSize:13,padding:"9px 11px",background:risk==="high"?"var(--risk-soft)":"var(--canvas-2)",borderRadius:10}}>
            <Icon name="shield" size={15} style={{color:risk==="high"?"var(--risk)":"var(--ink-3)",flex:"0 0 15px",marginTop:1}}/>
            <span style={{color:"var(--ink-2)"}}>{ev.riskNote||ev.risk_note}</span>
          </div>
        </div>
        {accepted
          ? <Btn variant="soft" icon="check" style={{width:"100%"}} onClick={()=>navigate(`/campaigns/${accepted}/context`)}>Campaign active — open Context</Btn>
          : <Btn variant={ev.recommended?"primary":"ghost"} iconRight="arrow" style={{width:"100%"}} disabled={busy||!canSelect} onClick={()=>onSelect(ev)}>{busy?"Creating campaign...":canSelect?"Use this moment":"Select a brand first"}</Btn>}
      </div>
    </div>
  );
}

export default function Events({route}){
  const {state,set}=useStore();
  const [events,setEvents]=React.useState([]);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState("");
  const [accepting,setAccepting]=React.useState(null);
  const [brands,setBrands]=React.useState([]);
  const [brandsLoading,setBrandsLoading]=React.useState(true);
  const [selectedBrandId,setSelectedBrandId]=React.useState(state.activeBrandId||"");
  const requestId=React.useRef(0);

  const normalizeEvents=React.useCallback((rows)=>(
    (rows||[]).map(e=>({
      ...e,
      riskNote:e.riskNote||e.risk_note,
      emoji:e.emoji||"📅",
    }))
  ),[]);

  const loadOpportunities=React.useCallback(async({sync=false}={})=>{
    const id=++requestId.current;
    setLoading(true); setError("");
    try{
      const data=sync ? await API.syncCalendarific() : await API.listOpportunities();
      const rows=sync ? data.opportunities : data;
      if(id===requestId.current) setEvents(normalizeEvents(rows));
    }catch(e){
      if(id===requestId.current){ setError(e.message); setEvents([]); }
    }finally{
      if(id===requestId.current) setLoading(false);
    }
  },[normalizeEvents]);

  React.useEffect(()=>{
    loadOpportunities();
  },[loadOpportunities]);

  React.useEffect(()=>{
    let alive=true;
    setBrandsLoading(true);
    API.listBrands()
      .then(rows=>{
        if(!alive) return;
        const list=rows||[];
        setBrands(list);
        const selected = state.activeBrandId || list[0]?.id || "";
        setSelectedBrandId(selected);
        if(selected && !state.activeBrandId){
          const brand=list.find(item=>item.id===selected);
          set({
            activeBrandId:selected,
            brandReady:true,
            brandName:brand?.brand_name || state.brandName,
            brandColor:brand?.colors?.primary || state.brandColor,
          });
        }
      })
      .catch(()=>{ if(alive) setBrands([]); })
      .finally(()=>alive&&setBrandsLoading(false));
    return ()=>{alive=false};
  },[set,state.activeBrandId]);

  const recommended=events.filter(e=>e.recommended);
  const others=events.filter(e=>!e.recommended);

  const onSelect=async(ev)=>{
    if(!selectedBrandId){
      setError("Create or select a brand before accepting an event.");
      return;
    }
    setAccepting(ev.id); setError("");
    try{
      const res=await API.acceptEvent(ev.id,{brand_id:selectedBrandId});
      const selectedBrand=brands.find(brand=>brand.id===selectedBrandId);
      set({
        activeBrandId:selectedBrandId,
        brandReady:true,
        brandName:selectedBrand?.brand_name || state.brandName,
        brandColor:selectedBrand?.colors?.primary || state.brandColor,
        acceptedEvent:ev.id,
        activeCampaignId:res.campaign_id,
        campaignTitle:(res.campaign&&res.campaign.campaign_name)||((ev.title||ev.name)+" campaign"),
        campaignContextSaved:false,
        campaignLayoutSaved:false,
        campaignConceptSaved:false,
        variantsGenerated:false,
        scored:false,
        experimentConfigured:false,
        launched:false,
        winnerDeclared:false,
      });
      navigate(`/campaigns/${res.campaign_id}/context`);
    }catch(e){ setError(e.message); }
    finally{ setAccepting(null); }
  };

  const selectBrand=(id)=>{
    setSelectedBrandId(id);
    const brand=brands.find(item=>item.id===id);
    set({
      activeBrandId:id || null,
      brandReady:Boolean(id),
      brandName:brand?.brand_name || null,
      brandColor:brand?.colors?.primary || null,
    });
  };

  return (
    <AppShell route={route} title="Event Radar" crumb={state.brandName ? `${state.brandName} workspace` : "Brand workspace"}
      actions={<Tag icon="radar">{loading?"Loading Calendarific…":"Calendarific events"}</Tag>}>
      <SectionHead eyebrow="Step 1 · Detect the moment"
        title="Choose the moment your ad should react to"
        desc="Use relevance for audience fit, timing for urgency, and IP risk to decide how safely the creative can reference the event."/>

      <div className="card card-pad" style={{marginBottom:22,background:"var(--ink)",color:"var(--canvas)"}}>
        <div className="row between wrap" style={{gap:16}}>
          <div className="row" style={{gap:11}}>
            <span style={{width:9,height:9,borderRadius:9,background:"var(--brand)"}} className="pulse-dot"/>
            <span style={{fontWeight:600}}>{loading?"Checking production event opportunities...":error?"Event Radar needs the API before campaigns can start.":`${events.length} production moments are ready to brief.`}</span>
          </div>
          <div className="row wrap" style={{gap:18,fontSize:12.5,color:"rgba(244,240,231,.7)"}}>
            <span>National · Religious · Observance · Shopping</span>
            <span className="mono">{error?"API unavailable":"PostgreSQL / Calendarific"}</span>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{marginBottom:22}}>
        <div className="row between wrap" style={{gap:14}}>
          <div>
            <div className="eyebrow" style={{marginBottom:6}}>Brand selector</div>
            <h3 style={{fontSize:18}}>Attach accepted campaigns to a brand</h3>
            <p className="muted" style={{fontSize:13,marginTop:5}}>The selected brand controls logo, product asset, colors, voice, and safety rules during generation.</p>
          </div>
          <div className="row wrap" style={{gap:10}}>
            <select className="select" value={selectedBrandId} onChange={e=>selectBrand(e.target.value)} disabled={brandsLoading||brands.length===0} style={{minWidth:260}}>
              <option value="">{brandsLoading?"Loading brands...":"Select a saved brand"}</option>
              {brands.map(brand=><option key={brand.id} value={brand.id}>{brand.brand_name}</option>)}
            </select>
            {brands.length===0 && !brandsLoading && <Btn variant="primary" iconRight="arrow" onClick={()=>navigate("/brand/setup")}>Create brand</Btn>}
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(330px,1fr))",gap:16,marginBottom:30}}>
          {[0,1,2].map(i=><div key={i} className="card card-pad"><div className="shimmer" style={{height:28,width:"60%",marginBottom:18}}/><div className="shimmer" style={{height:110}}/></div>)}
        </div>
      )}

      {error && (
        <div className="card card-pad" style={{marginBottom:18,background:"var(--warn-soft)",color:"var(--warn)"}}>
          <div className="row between wrap" style={{gap:14}}>
            <div>
              <div style={{fontWeight:800,marginBottom:4}}>Production event data is unavailable.</div>
              <div style={{fontSize:13.5,lineHeight:1.5}}>Fix the API connection or Calendarific configuration, then reload production opportunities. Error: {error}</div>
            </div>
            <Btn variant="ghost" icon="loop" disabled={loading} onClick={()=>loadOpportunities({sync:true})}>Retry sync</Btn>
          </div>
        </div>
      )}

      {!loading && !error && events.length===0 && (
        <EmptyState
          title="No event opportunities yet"
          msg="Connect Calendarific and sync events to create the first production campaign opportunity."
        />
      )}

      {!loading && <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(330px,1fr))",gap:16,marginBottom:30}}>
        {recommended.map(ev=>(
          <EventCard key={ev.id} ev={ev} onSelect={onSelect} accepted={state.acceptedEvent===ev.id&&state.activeCampaignId} busy={accepting===ev.id} canSelect={Boolean(selectedBrandId)}/>
        ))}
      </div>}

      {!loading && others.length>0 && <div className="eyebrow" style={{marginBottom:14}}>Also on the radar</div>}
      {!loading && <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(330px,1fr))",gap:16}}>
        {others.map(ev=><EventCard key={ev.id} ev={ev} onSelect={onSelect} busy={accepting===ev.id} canSelect={Boolean(selectedBrandId)}/>)}
      </div>}
    </AppShell>
  );
}
