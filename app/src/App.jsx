import React from "react";
import { navigate, matchCampaign, useRoute, useStore } from "./store/store";
import { AppShell, Btn, Icon } from "./components/ui";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import BrandSetup from "./pages/BrandSetup";
import CampaignContext from "./pages/CampaignContext";
import AdLayout from "./pages/AdLayout";
import AdConcept from "./pages/AdConcept";
import Studio from "./pages/Studio";
import Scoring from "./pages/Scoring";
import Experiment from "./pages/Experiment";
import Analytics from "./pages/Analytics";
import Winner from "./pages/Winner";
import BrainResponse from "./pages/BrainResponse";

class RouteErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = {error:null};
  }
  static getDerivedStateFromError(error){
    return {error};
  }
  componentDidUpdate(prevProps){
    if(prevProps.route !== this.props.route && this.state.error){
      this.setState({error:null});
    }
  }
  render(){
    if(!this.state.error) return this.props.children;
    const message = this.state.error && this.state.error.message
      ? this.state.error.message
      : "This page could not be rendered.";
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"var(--canvas)"}}>
        <div className="card" style={{padding:"34px 30px",maxWidth:560,width:"100%",background:"var(--surface-warm)"}}>
          <div style={{display:"inline-flex",width:52,height:52,borderRadius:16,background:"var(--risk-soft)",color:"var(--risk)",alignItems:"center",justifyContent:"center",marginBottom:18}}>
            <Icon name="flag" size={24}/>
          </div>
          <h2 style={{fontSize:24,marginBottom:10}}>This screen needs a refresh</h2>
          <p className="soft" style={{fontSize:14.5,lineHeight:1.55,marginBottom:18}}>
            MomentBrand hit a page-level issue instead of showing a blank workspace.
          </p>
          <div className="card" style={{padding:"10px 12px",fontSize:12.5,color:"var(--ink-2)",background:"var(--surface)",marginBottom:20,wordBreak:"break-word"}}>
            {message}
          </div>
          <div className="row wrap" style={{gap:10}}>
            <Btn variant="primary" icon="dash" onClick={()=>navigate("/dashboard")}>Back to dashboard</Btn>
            <Btn variant="ghost" icon="loop" onClick={()=>window.location.reload()}>Reload screen</Btn>
          </div>
        </div>
      </div>
    );
  }
}

function NotReady({route,title,msg,cta,to}){
  return (
    <AppShell route={route} title="Campaign" crumb="MomentBrand workspace">
      <div className="card" style={{padding:"60px 32px",textAlign:"center",maxWidth:520,margin:"40px auto",background:"var(--surface-warm)"}}>
        <div style={{display:"inline-flex",width:54,height:54,borderRadius:16,background:"var(--canvas-2)",color:"var(--ink-2)",alignItems:"center",justifyContent:"center",marginBottom:18}}><Icon name="loop" size={26}/></div>
        <h3 style={{fontSize:21,marginBottom:10}}>{title}</h3>
        <p className="soft" style={{fontSize:15,marginBottom:24,lineHeight:1.55}}>{msg}</p>
        <Btn variant="primary" iconRight="arrow" onClick={()=>navigate(to)}>{cta}</Btn>
      </div>
    </AppShell>
  );
}

export default function App(){
  const route=useRoute();
  const {state}=useStore();
  const cm=matchCampaign(route);
  let screen;

  // landing
  if(route==="/"||route===""||route==="/landing") screen = <Landing/>;
  else if(route==="/dashboard") screen = <Dashboard route={route}/>;
  else if(route==="/events") screen = <Events route={route}/>;
  else if(route==="/brain-response") screen = <BrainResponse route={route}/>;
  else if(route.startsWith("/brand")) screen = <BrandSetup route={route}/>;

  else if(cm){
    const step=cm.step, campaignId=cm.id;
    if(step==="context") screen = <CampaignContext route={route} campaignId={campaignId}/>;
    else if(step==="layout") screen = <AdLayout route={route} campaignId={campaignId}/>;
    else if(step==="concept") screen = <AdConcept route={route} campaignId={campaignId}/>;
    else if(step==="studio") screen = <Studio route={route} campaignId={campaignId}/>;
    if(step==="scoring"){
      screen = <Scoring route={route}/>;
    }
    else if(step==="experiment"){
      if(!state.scored) screen = <NotReady route={route} title="Score variants first" msg="Run the scoring engine so you know which variants are worth testing." cta="Open Scoring" to={`/campaigns/${campaignId}/scoring`}/>;
      else screen = <Experiment route={route}/>;
    }
    else if(step==="analytics"){
      if(!state.launched) screen = <NotReady route={route} title="No live test yet" msg="Build and launch an experiment on Meta to start pulling performance data." cta="Open Experiment Builder" to={`/campaigns/${campaignId}/experiment`}/>;
      else screen = <Analytics route={route}/>;
    }
    else if(step==="winner"){
      if(!state.launched) screen = <NotReady route={route} title="Nothing to crown yet" msg="Launch a test and let it run before declaring a winner." cta="Open Experiment Builder" to={`/campaigns/${campaignId}/experiment`}/>;
      else screen = <Winner route={route}/>;
    }
  }

  // fallback
  if(!screen) screen = <Dashboard route="/dashboard"/>;
  return <RouteErrorBoundary route={route}>{screen}</RouteErrorBoundary>;
}
