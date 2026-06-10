/* ============================================================
   Store + hash router + animation hooks.
   ============================================================ */
import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";


/* ---------- hash router ---------- */
function parseHash(){
  let h = window.location.hash.replace(/^#/,"") || "/";
  if(!h.startsWith("/")) h = "/"+h;
  return h;
}
export function navigate(path){
  if(window.location.hash.replace(/^#/,"") === path) return;
  window.location.hash = path;
  window.scrollTo(0,0);
}
export function useRoute(){
  const [route,setRoute] = useState(parseHash());
  useEffect(()=>{
    const on = ()=>{ setRoute(parseHash()); window.scrollTo(0,0); };
    window.addEventListener("hashchange",on);
    return ()=>window.removeEventListener("hashchange",on);
  },[]);
  return route;
}
// match /campaigns/:id/:step -> {id, step}
export function matchCampaign(route){
  const m = route.match(/^\/campaigns\/([^/]+)\/([^/]+)/);
  if(!m) return null;
  return { id:m[1], step:m[2] };
}

/* ---------- persistent app state ---------- */
const LS_KEY = "momentbrand_state_v1";
const defaultState = {
  brandReady:false,
  activeBrandId:null,
  brandName:null,
  brandCategory:null,
  brandColor:null,
  acceptedEvent:null,     // event accepted -> campaign exists
  activeCampaignId:null,
  campaignTitle:null,
  campaignContextSaved:false,
  campaignLayoutSaved:false,
  campaignConceptSaved:false,
  variantsGenerated:false,
  scored:false,
  selectedVariants:[],
  experimentConfigured:false,
  launched:false,
  winnerDeclared:false,
  learningSaved:false,
};
function loadState(){
  try{ const s = JSON.parse(localStorage.getItem(LS_KEY)); return s? {...defaultState,...s} : {...defaultState}; }
  catch(e){ return {...defaultState}; }
}

const StoreCtx = createContext(null);
export function StoreProvider({children}){
  const [state,setState] = useState(loadState);
  useEffect(()=>{ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){} },[state]);
  const set = useCallback((patch)=> setState(s=>({...s, ...(typeof patch==="function"?patch(s):patch)})),[]);
  const reset = useCallback(()=>{ setState({...defaultState}); },[]);
  const hardReset = useCallback(()=>{
    setState({...defaultState, acceptedEvent:null, variantsGenerated:false, scored:false,
      activeCampaignId:null, activeBrandId:null, campaignContextSaved:false, campaignLayoutSaved:false, campaignConceptSaved:false,
      experimentConfigured:false, launched:false, winnerDeclared:false, learningSaved:false});
  },[]);
  return React.createElement(StoreCtx.Provider,{value:{state,set,reset,hardReset}},children);
}
export function useStore(){ return useContext(StoreCtx); }

/* ---------- count-up hook ---------- */
export function useCountUp(target, opts={}){
  const {duration=1100, start=0, decimals=0, run=true} = opts;
  const [val,setVal] = useState(run?start:target);
  const raf = useRef(null);
  useEffect(()=>{
    if(!run){ setVal(target); return; }
    let t0;
    const tick = (t)=>{
      if(t0==null) t0=t;
      const p = Math.min(1,(t-t0)/duration);
      const e = 1-Math.pow(1-p,3); // easeOutCubic
      setVal(start+(target-start)*e);
      if(p<1) raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf.current);
  },[target,run]);
  const f = decimals>0 ? val.toFixed(decimals) : Math.round(val).toString();
  return f;
}

/* ---------- in-view trigger ---------- */
export function useInView(opts={threshold:.18}){
  const ref = useRef(null);
  const [seen,setSeen] = useState(false);
  useEffect(()=>{
    if(!ref.current || seen) return;
    const io = new IntersectionObserver(([e])=>{ if(e.isIntersecting){ setSeen(true); io.disconnect(); } },opts);
    io.observe(ref.current);
    return ()=>io.disconnect();
  },[seen]);
  return [ref,seen];
}

/* ---------- helpers ---------- */
export function scoreColor(v){
  if(v>=85) return "var(--good)";
  if(v>=75) return "var(--warn)";
  return "var(--ink-3)";
}
export function riskBadge(risk){
  return {low:["badge-good","Low risk"],medium:["badge-warn","Medium risk"],high:["badge-risk","High IP risk"]}[risk]||["badge-soft",risk];
}
