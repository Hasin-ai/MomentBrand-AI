import React from "react";
import { navigate, useInView } from "../store/store";
import { Icon, Btn, Badge, ScoreBar, Logo } from "../components/ui";

/* ============================================================
   Route: /  — marketing landing (Surface-style, concise)
   ============================================================ */
function LandingNav(){
  return (
    <div style={{position:"sticky",top:0,zIndex:30,background:"color-mix(in srgb,var(--canvas) 82%,transparent)",backdropFilter:"blur(10px)",borderBottom:"1px solid var(--line)"}}>
      <div className="landing-nav-inner" style={{maxWidth:1120,margin:"0 auto",padding:"15px 24px",display:"flex",alignItems:"center",gap:18}}>
        <Logo size={19}/>
        <div className="row landing-nav-links" style={{gap:26,marginLeft:34,fontSize:14,fontWeight:500}}>
          {[
            ["Event Radar","/events"],
            ["Brain Response","/brain-response"],
            ["Workspace","/dashboard"],
          ].map(([label,path])=><button key={label} className="muted navlink link-btn" onClick={()=>navigate(path)}>{label}</button>)}
        </div>
        <div className="row landing-nav-actions" style={{gap:10,marginLeft:"auto"}}>
          <span className="desktop-only"><Btn variant="ghost" size="sm" onClick={()=>navigate("/dashboard")}>Dashboard</Btn></span>
          <Btn variant="primary" size="sm" iconRight="arrow" onClick={()=>navigate("/events")}>Start with an event</Btn>
        </div>
      </div>
    </div>
  );
}

function Marquee(){
  const items=["BEVERAGE","FASHION","FOOD DELIVERY","SPORTS MERCH","BEAUTY","CONSUMER APPS","AGENCIES","DTC"];
  return (
    <div style={{overflow:"hidden",borderTop:"1px solid var(--line)",borderBottom:"1px solid var(--line)",padding:"15px 0",background:"var(--canvas-2)"}}>
      <div style={{display:"flex",gap:48,whiteSpace:"nowrap",animation:"marq 26s linear infinite",fontFamily:"var(--mono)",fontSize:12.5,letterSpacing:".14em",color:"var(--ink-3)"}}>
        {[...items,...items,...items].map((x,i)=><span key={i}>{x}</span>)}
      </div>
      <style>{`@keyframes marq{to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

function StepCard({n,icon,title,desc}){
  const [ref,seen]=useInView();
  return (
    <div ref={ref} className="card card-pad" style={{opacity:seen?1:0,transform:seen?"none":"translateY(16px)",transition:`.5s ${n*.07}s cubic-bezier(.2,.8,.2,1)`}}>
      <div className="row between" style={{marginBottom:14}}>
        <span style={{display:"inline-flex",width:38,height:38,borderRadius:11,background:"var(--ink)",color:"var(--canvas)",alignItems:"center",justifyContent:"center"}}><Icon name={icon}/></span>
        <span className="mono" style={{fontSize:12,color:"var(--ink-3)"}}>0{n}</span>
      </div>
      <h3 style={{fontSize:17,marginBottom:7}}>{title}</h3>
      <p className="soft" style={{fontSize:13.5,lineHeight:1.55}}>{desc}</p>
    </div>
  );
}

function MiniBrain(){
  // small decorative brain-score panel for hero
  const dims=[["Salience",90],["Emotion",84],["Memory",88],["Coherence",86]];
  return (
    <div className="card" style={{padding:18,width:300,boxShadow:"var(--shadow-lg)"}}>
      <div className="row between" style={{marginBottom:14}}>
        <div className="row" style={{gap:8}}><span style={{width:9,height:9,borderRadius:9,background:"var(--neural)"}} className="pulse-dot"/><span className="eyebrow" style={{color:"var(--neural)"}}>TRIBE v2 Brain Score</span></div>
        <Badge tone="neural">87</Badge>
      </div>
      <div className="col" style={{gap:11}}>
        {dims.map(([l,v],i)=>(
          <div key={l}>
            <div className="row between" style={{fontSize:12.5,marginBottom:5}}><span className="soft">{l}</span><span className="mono" style={{color:"var(--ink-2)"}}>{v}</span></div>
            <ScoreBar value={v} color="var(--neural)" delay={i*140}/>
          </div>
        ))}
      </div>
      <div className="divider" style={{margin:"15px 0 12px"}}/>
      <div className="row between">
        <span className="muted" style={{fontSize:12}}>Variant A · Watch Party</span>
        <Badge tone="good" icon="check">Launch</Badge>
      </div>
    </div>
  );
}

export default function Landing(){
  return (
    <div>
      <LandingNav/>

      {/* hero */}
      <section style={{maxWidth:1120,margin:"0 auto",padding:"72px 24px 64px"}}>
        <div className="row wrap" style={{gap:48,alignItems:"center",justifyContent:"space-between"}}>
          <div style={{flex:"1 1 320px",maxWidth:600,minWidth:0}}>
            <div className="row wrap" style={{gap:8,marginBottom:22}}>
              <Badge tone="soft" icon="bolt">Event-driven ad platform</Badge>
              <Badge tone="soft">Generate · compare · learn</Badge>
            </div>
            <h1 className="display hero-title" style={{marginBottom:20}}>
              Turn a cultural moment into ad options your team can compare.
            </h1>
            <p className="soft" style={{fontSize:18,lineHeight:1.55,maxWidth:520,marginBottom:30}}>
              Choose an event, write the campaign context, pick the layout, generate ad concepts, then compare which creative is most attention-grabbing, emotionally engaging, memorable, and event-safe.
            </p>
            <div className="workflow-strip" style={{marginBottom:24}}>
              {["Choose event","Brief","Layout","Generate","Compare"].map((step,i)=>(
                <React.Fragment key={step}>
                  {i>0 && <span className="workflow-line"/>}
                  <span className="workflow-chip">{step}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="row wrap" style={{gap:12}}>
              <Btn variant="primary" size="lg" iconRight="arrow" onClick={()=>navigate("/events")}>Choose a campaign moment</Btn>
              <Btn variant="ghost" size="lg" icon="brain" onClick={()=>navigate("/brain-response")}>Analyze an ad image</Btn>
            </div>
            <p className="muted" style={{fontSize:13,marginTop:18}}>Demo data is available when the backend is not connected, and API-backed campaigns are used when available.</p>
          </div>
          <div style={{flex:"0 1 340px",display:"flex",justifyContent:"center"}}>
            <div style={{position:"relative"}}>
              <div className="card" style={{padding:20,width:300,boxShadow:"var(--shadow-lg)",marginBottom:-40,marginLeft:-50,transform:"rotate(-3deg)"}}>
                <div className="eyebrow" style={{marginBottom:10}}>Event Radar · top opportunity</div>
                <div className="row" style={{gap:11,marginBottom:12}}>
                  <span style={{fontSize:30}}>⚽</span>
                  <div><div style={{fontWeight:700,fontSize:15}}>World Football Cup</div><div className="muted" style={{fontSize:12.5}}>Peak in 8 days · +340% search</div></div>
                </div>
                <div className="row between"><Badge tone="good">94 relevance</Badge><Badge tone="risk" icon="flag">IP risk</Badge></div>
              </div>
              <div style={{marginLeft:40}}><MiniBrain/></div>
            </div>
          </div>
        </div>
      </section>

      <Marquee/>

      {/* the broken workflow */}
      <section style={{maxWidth:1120,margin:"0 auto",padding:"72px 24px"}}>
        <div className="row wrap between" style={{gap:40,alignItems:"flex-start"}}>
          <div style={{flex:"1 1 360px",maxWidth:460}}>
            <div className="eyebrow" style={{marginBottom:12}}>The problem</div>
            <h2 style={{fontSize:34,marginBottom:16}}>“The World Cup is trending. Now what?”</h2>
            <p className="soft" style={{fontSize:16,lineHeight:1.6}}>
              Today a brand needs 20 event-specific concepts, tested for emotional resonance, launched, and measured — all before the final whistle. Instead the work is broken into six disconnected, slow, manual steps.
            </p>
          </div>
          <div className="card card-pad" style={{flex:"1 1 380px",maxWidth:480}}>
            {[
              "Someone manually tracks trends",
              "A creative team brainstorms for days",
              "Designers produce assets — more days",
              "Marketers set up ads by hand",
              "Analysts check results, often too late",
              "A/B testing is skipped or inconsistent",
            ].map((t,i)=>(
              <div key={i} className="row" style={{gap:13,padding:"11px 0",borderBottom:i<5?"1px solid var(--line)":"none"}}>
                <span className="mono" style={{fontSize:12,color:"var(--ink-3)",width:18}}>{i+1}</span>
                <span style={{fontSize:14.5,color:"var(--ink-2)",textDecoration:"line-through",textDecorationColor:"var(--line-2)"}}>{t}</span>
              </div>
            ))}
            <div className="row" style={{gap:10,marginTop:16,padding:"13px 14px",background:"var(--ink)",borderRadius:12,color:"var(--canvas)"}}>
              <Icon name="bolt" size={17}/><span style={{fontWeight:600,fontSize:14}}>MomentBrand compresses all six into one loop.</span>
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section style={{background:"var(--canvas-2)",borderTop:"1px solid var(--line)",borderBottom:"1px solid var(--line)"}}>
        <div style={{maxWidth:1120,margin:"0 auto",padding:"72px 24px"}}>
          <div style={{textAlign:"center",marginBottom:42}}>
            <div className="eyebrow" style={{marginBottom:12}}>How it works</div>
            <h2 style={{fontSize:36,marginBottom:14}}>One loop, end to end</h2>
            <p className="soft" style={{fontSize:16,maxWidth:560,margin:"0 auto"}}>Detect the moment → build the Brand Brain → approve concept → generate → pre-score → launch → measure → learn → scale.</p>
          </div>
          <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
            <StepCard n={1} icon="radar" title="Event Radar" desc="Continuously ranks cultural, sports and shopping moments by brand-audience fit, timing and IP risk."/>
            <StepCard n={2} icon="brain" title="Brand Brain" desc="Your tone, colors, prohibited claims and audiences — the intelligence layer governing every campaign."/>
            <StepCard n={3} icon="edit" title="Ad Concept" desc="Locks the creative strategy before production generation starts."/>
            <StepCard n={4} icon="spark" title="Ad Generation" desc="Generates event-specific ads with copy, visual direction and audience match in seconds."/>
            <StepCard n={5} icon="target" title="Brain Scoring" desc="Every variant is pre-scored on brand fit, IP risk and a TRIBE v2 neural brain score before spend."/>
            <StepCard n={6} icon="flask" title="Experiment" desc="Clean A/B tests on Meta — one variable, defined hypothesis, Bayesian stopping rule."/>
            <StepCard n={7} icon="trophy" title="Learn & scale" desc="Declares the winner, scales budget, and writes the learning back to the Brand Brain."/>
          </div>
        </div>
      </section>

      {/* differentiator strip */}
      <section style={{maxWidth:1120,margin:"0 auto",padding:"72px 24px"}}>
        <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:24,textAlign:"center"}}>
          {[["3–5 days","saved per campaign vs. manual creative"],["5–10","brand-safe variants in ~30 seconds"],["4","neural dimensions pre-scored per ad"],["1 loop","from cultural moment to scaled winner"]].map(([k,v],i)=>(
            <div key={i} style={{borderLeft:i?"1px solid var(--line)":"none",padding:"0 12px"}}>
              <div className="kpi" style={{fontSize:40,marginBottom:6}}>{k}</div>
              <div className="soft" style={{fontSize:14,lineHeight:1.45}}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* cta */}
      <section style={{maxWidth:1120,margin:"0 auto",padding:"0 24px 88px"}}>
        <div style={{background:"var(--ink)",borderRadius:28,padding:"56px 40px",textAlign:"center",color:"var(--canvas)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(600px 300px at 70% -10%, rgba(229,52,42,.35), transparent 60%)"}}/>
          <div style={{position:"relative"}}>
            <div className="eyebrow" style={{color:"rgba(244,240,231,.6)",marginBottom:14}}>Walk the whole flow</div>
            <h2 className="display landing-cta-title" style={{color:"var(--canvas)",marginBottom:18}}>Start from an event, not a blank prompt.</h2>
            <p style={{color:"rgba(244,240,231,.72)",fontSize:16,maxWidth:560,margin:"0 auto 28px"}}>The workflow keeps brand rules, event context, layout choices, and brain-response evidence in one place.</p>
            <Btn variant="brand" size="lg" iconRight="arrow" onClick={()=>navigate("/events")}>Open Event Radar</Btn>
          </div>
        </div>
        <div className="row between wrap" style={{marginTop:32,gap:16,color:"var(--ink-3)",fontSize:13}}>
          <Logo size={16}/>
          <span>Detect the moment. Test the creative. Scale the winner.</span>
          <span className="mono">© 2026 MomentBrand AI · demo</span>
        </div>
      </section>
    </div>
  );
}
