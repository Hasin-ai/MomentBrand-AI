/* ============================================================
   Backend API helpers
   ============================================================ */
export const API_BASE = window.MOMENTBRAND_API_BASE || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(message, {status, code, detail}={}){
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function normalizeError(data, status){
  const detail = data && data.detail !== undefined ? data.detail : data;
  if(typeof detail === "string"){
    return {message:detail, detail};
  }
  if(detail && typeof detail === "object"){
    const message = detail.message || detail.error || detail.error_message || detail.detail || "Request failed";
    return {
      message: typeof message === "string" ? message : JSON.stringify(message),
      code: detail.code || detail.error_type,
      detail,
    };
  }
  return {message: status ? `Request failed (${status})` : "Request failed", detail};
}

async function request(path, opts={}){
    const isForm = opts.body instanceof FormData;
    let res;
    try{
      res = await fetch(API_BASE + path, {
        headers: {
          ...(isForm ? {} : {"Content-Type":"application/json"}),
          ...(opts&&opts.headers||{}),
        },
        ...opts,
      });
    }catch(e){
      throw new ApiError("Backend is unreachable. Start the MomentBrand API and try again.", {code:"network_error", detail:e});
    }
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
    if(!res.ok){
      const err = normalizeError(data, res.status);
      throw new ApiError(err.message, {status:res.status, code:err.code, detail:err.detail});
    }
    return data;
  }
export const API = {
    listBrands: ()=>request("/brands"),
    getBrand: (id)=>request(`/brands/${encodeURIComponent(id)}`),
    createManualBrand: (body)=>request("/brands/manual", {
      method:"POST", body:JSON.stringify(body)
    }),
    uploadProductImage: (brandId, formData)=>request(`/brands/${encodeURIComponent(brandId)}/product`, {
      method:"POST", body:formData
    }),
    listOpportunities: ()=>request("/events/opportunities"),
    syncCalendarific: (params={})=>{
      const qs = new URLSearchParams({country:"BD", year:new Date().getFullYear(), ...params});
      return request("/events/calendarific?"+qs.toString());
    },
    acceptEvent: (eventId, body={})=>request(`/events/${encodeURIComponent(eventId)}/accept`, {
      method:"POST", body:JSON.stringify(body)
    }),
    getCampaign: (id)=>request(`/campaigns/${encodeURIComponent(id)}`),
    uploadContextImage: (id, formData)=>request(`/campaigns/${encodeURIComponent(id)}/context-images`, {
      method:"POST", body:formData
    }),
    saveContext: (id, body)=>request(`/campaigns/${encodeURIComponent(id)}/context`, {
      method:"PATCH", body:JSON.stringify(body)
    }),
    saveLayout: (id, body)=>request(`/campaigns/${encodeURIComponent(id)}/layout`, {
      method:"PATCH", body:JSON.stringify(body)
    }),
    saveConcept: (id, body)=>request(`/campaigns/${encodeURIComponent(id)}/concept`, {
      method:"PATCH", body:JSON.stringify(body)
    }),
    listVariants: (id)=>request(`/campaigns/${encodeURIComponent(id)}/variants`),
    generateVariants: (id)=>request(`/campaigns/${encodeURIComponent(id)}/variants`, {method:"POST"}),
    generateAdAssets: (id, body={})=>request(`/campaigns/${encodeURIComponent(id)}/ads/generate`, {
      method:"POST", body:JSON.stringify(body)
    }),
    brainHealth: ()=>request("/brain/health"),
    analyzeBrainResponse: (formData)=>request("/brain/analyze", {
      method:"POST", body:formData
    }),
    getBrainAnalysis: (id)=>request(`/brain/analyses/${encodeURIComponent(id)}`),
    listCampaignBrainAnalyses: (campaignId)=>request(`/campaigns/${encodeURIComponent(campaignId)}/brain-analyses`),
    analyzeCampaignGeneratedAds: (campaignId, body={})=>request(`/campaigns/${encodeURIComponent(campaignId)}/brain-analyses/run`, {
      method:"POST", body:JSON.stringify(body)
    }),
  };
