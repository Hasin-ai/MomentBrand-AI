/* ============================================================
   Seed data for the MomentBrand AI prototype.
   Story: Cresta (DTC sparkling beverage) x World Football Cup.
   Shared mock/demo data
   ============================================================ */
  const brand = {
    name:"Cresta",
    tagline:"Taste the rush.",
    color:"#E5342A",
    logoText:"Cresta",
    category:"Sparkling beverage · DTC",
    site:"drinkcresta.com",
    palette:["#E5342A","#17150F","#F4F0E7","#1F7A4D"],
    fonts:{display:"Clash Display",body:"Schibsted Grotesk"},
    voice:["Playful","Warm","Inclusive","A little cheeky"],
    avoid:["Health / “good for you” claims","“Sugar-free” unless lab-verified","Official sports-body endorsements","Comparative knocks on named competitors"],
    products:[
      {name:"Cresta Classic",note:"The original cola rush",price:"$2.49"},
      {name:"Cresta Zero",note:"Full taste, zero sugar",price:"$2.49"},
      {name:"Cresta Cherry",note:"Dark cherry twist",price:"$2.79"},
    ],
    personas:[
      {name:"Match-night Maya",age:"18–34",note:"Social sharer, watches with friends, posts stories",share:46},
      {name:"Family-fridge Faisal",age:"30–45",note:"Stocks up for the household, value-led",share:31},
      {name:"Late-night Leo",age:"21–29",note:"Craves snacks + drinks after 10pm",share:23},
    ],
    integrations:[
      {name:"Meta Ads",status:"connected",note:"Marketing API · acct ••4192"},
      {name:"Shopify catalog",status:"connected",note:"14 SKUs synced"},
      {name:"Google Trends",status:"connected",note:"via SerpAPI"},
      {name:"TikTok Ads",status:"available",note:"Connect in V2"},
    ],
    completeness:92,
  };

  const events = [
    {
      id:"wc26", title:"World Football Cup 2026", kind:"Sports",
      window:"Peak in 8 days", days:8, relevance:94, reach:"Very high",
      risk:"high", riskNote:"Official tournament names & marks are protected — needs safe-alternative copy.",
      audience:"92% overlap with 18–34 social sharers",
      hist:"Watch-party angles +27% CTR for beverage brands last cycle",
      trend:"+340% search volume this week", emoji:"⚽", accent:"#1F7A4D",
      recommended:true,
    },
    {
      id:"cric", title:"National Cricket Final", kind:"Sports",
      window:"Peak in 5 days", days:5, relevance:88, reach:"High",
      risk:"medium", riskNote:"Avoid broadcaster logos; team names usable in fan context.",
      audience:"81% overlap, skews family households",
      hist:"Late-night combo offers convert well", trend:"+180% this week",
      emoji:"🏏", accent:"#B7791F", recommended:true,
    },
    {
      id:"fest", title:"Summer Music Festival Season", kind:"Entertainment",
      window:"Peak in 18 days", days:18, relevance:81, reach:"Medium-high",
      risk:"low", riskNote:"Generic festival themes are clear of IP risk.",
      audience:"74% overlap with Gen-Z sharers",
      hist:"UGC-driven creative outperforms polished", trend:"+96% this week",
      emoji:"🎪", accent:"#6D4AFF", recommended:true,
    },
    {
      id:"eid", title:"Eid Shopping Week", kind:"Shopping season",
      window:"Peak in 22 days", days:22, relevance:77, reach:"Medium",
      risk:"low", riskNote:"Cultural sensitivity review recommended.",
      audience:"Family + gifting moments", hist:"Bundle offers lift AOV",
      trend:"+58% this week", emoji:"🌙", accent:"#1F7A4D", recommended:false,
    },
    {
      id:"meme", title:"“Last-minute equalizer” viral moment", kind:"Internet trend",
      window:"Trending now · 36h window", days:1, relevance:69, reach:"Spiky",
      risk:"medium", riskNote:"Fast-moving — verify the clip’s source before reuse.",
      audience:"Football fans, meme-fluent", hist:"Real-time reactive posts spike shares",
      trend:"+1,200% in 12h", emoji:"🔥", accent:"#E5342A", recommended:false,
    },
  ];

  // Variants generated in the Studio for the World Football Cup campaign
  const variants = [
    {
      id:"A", letter:"A", angle:"Watch Party", emotion:"Nostalgia", emotionTone:"warm",
      headline:"Bring the match home.",
      primary:"Every great match needs a great cooler. Stock the fridge, gather the crew, and let Cresta carry the night — goal after goal.",
      cta:"Stock up for match night",
      visual:"Living-room watch party, friends mid-cheer, Cresta cans sweating on the coffee table, warm lamp light, shallow depth of field.",
      platform:"Meta · Feed + Reels", audienceSeg:"Match-night Maya", placement:"Feed",
      ip:"clear", grad:"linear-gradient(135deg,#E5342A,#B81f1f)",
    },
    {
      id:"B", letter:"B", angle:"Official-style", emotion:"Pride", emotionTone:"bold",
      headline:"The official taste of football season.",
      primary:"Cresta — the drink of champions this World Cup. Raise a can to every goal.",
      cta:"Join the celebration",
      visual:"Stadium-style hero shot, trophy silhouette, gold confetti, official-looking lockup.",
      platform:"Meta · Feed", audienceSeg:"Broad", placement:"Feed",
      ip:"flag", ipNote:"“official”, “World Cup” + trophy imagery imply endorsement. Safe rewrite suggested.",
      grad:"linear-gradient(135deg,#C9A227,#8A6d13)",
    },
    {
      id:"C", letter:"C", angle:"Meme / Reactive", emotion:"Humour", emotionTone:"playful",
      headline:"POV: it’s the 89th minute and the fridge is empty.",
      primary:"Don’t be that house. Cresta delivers before extra time.",
      cta:"Never run dry",
      visual:"Meme-format still, big caption type, slightly chaotic kitchen, phone-shot energy.",
      platform:"Meta · Reels + Stories", audienceSeg:"Late-night Leo", placement:"Reels",
      ip:"clear", grad:"linear-gradient(135deg,#6D4AFF,#3B22B8)",
    },
    {
      id:"D", letter:"D", angle:"Emotional Unity", emotion:"Belonging", emotionTone:"warm",
      headline:"One game. One world. One Cresta.",
      primary:"Ninety minutes where the whole world watches together. Wherever you’re from, there’s a seat at the table — and a cold Cresta in your hand.",
      cta:"Pull up a chair",
      visual:"Diverse group of fans, different jerseys, sharing a table, golden-hour, documentary feel.",
      platform:"Meta · Feed + Reels", audienceSeg:"Match-night Maya", placement:"Feed",
      ip:"clear", grad:"linear-gradient(135deg,#1F7A4D,#0E4D2E)",
    },
    {
      id:"E", letter:"E", angle:"Limited-time Combo", emotion:"Urgency", emotionTone:"bold",
      headline:"Goal-time combo: Cresta + snacks, 20% off.",
      primary:"Kickoff’s in an hour. Get the match-night bundle delivered before the whistle.",
      cta:"Grab the bundle",
      visual:"Flat-lay of bundle, bold price flash, countdown timer motif, high-contrast.",
      platform:"Meta · Feed", audienceSeg:"Family-fridge Faisal", placement:"Feed",
      ip:"clear", grad:"linear-gradient(135deg,#E5342A,#F08C1D)",
    },
  ];

  // Scoring (standard scorecard + TRIBE v2 brain dimensions)
  const scores = {
    A:{brandFit:91,eventFit:94,novelty:74,clarity:90,emotion:83,cultural:88,ctr:4.1,conv:2.7,risk:"low",
       tribe:{composite:87,salience:90,emotional:84,memory:88,coherence:86,label:"High salience"},action:"Launch"},
    B:{brandFit:78,eventFit:96,novelty:61,clarity:85,emotion:88,cultural:82,ctr:3.7,conv:2.2,risk:"high",
       tribe:{composite:82,salience:88,emotional:90,memory:74,coherence:76,label:"High emotion · risk"},action:"Revise — IP risk"},
    C:{brandFit:73,eventFit:88,novelty:92,clarity:79,emotion:71,cultural:90,ctr:4.4,conv:2.1,risk:"medium",
       tribe:{composite:79,salience:93,emotional:70,memory:72,coherence:80,label:"High novelty"},action:"Small-scale test"},
    D:{brandFit:88,eventFit:90,novelty:70,clarity:88,emotion:92,cultural:86,ctr:3.9,conv:2.6,risk:"low",
       tribe:{composite:91,salience:84,emotional:95,memory:93,coherence:92,label:"High memory"},action:"Launch alongside A"},
    E:{brandFit:84,eventFit:82,novelty:58,clarity:93,emotion:64,cultural:71,ctr:4.0,conv:3.1,risk:"low",
       tribe:{composite:76,salience:82,emotional:62,memory:70,coherence:78,label:"High clarity"},action:"Test for conversions"},
  };

  const tribeDims = [
    {key:"salience", name:"Visual Salience Index", region:"V1–V4 visual cortex", why:"Scroll-stop proxy — predicts thumb-stop rate"},
    {key:"emotional", name:"Emotional Encoding", region:"Amygdala / limbic", why:"Brand recall & purchase-intent proxy"},
    {key:"memory", name:"Memory Consolidation", region:"Hippocampal engagement", why:"Remembered 48h+ — predicts brand lift"},
    {key:"coherence", name:"Multimodal Coherence", region:"Cross-modal consistency", why:"Image + copy + audio tell one story"},
  ];

  // Experiment defaults
  const experiment = {
    hypothesis:"A warm “watch-party” angle (Variant A) will lower CPC vs. a high-emotion unity angle (Variant D) among 18–34 sharers.",
    variable:"creative",
    cells:["A","D","C"],
    audience:"18–34 · football interest · EN markets",
    budget:90,
    days:3,
    minSample:1800,
    stopRule:"95% Bayesian probability-to-beat",
  };

  // Analytics: 72h performance per variant + timeseries
  const analytics = {
    duration:"72 hours · live",
    spend:268, impressions:184200, reach:96400,
    variants:{
      A:{ctr:4.6,cpc:0.31,cpa:6.40,roas:4.8,conv:412,purchaseIntent:71,winner:true},
      D:{ctr:4.0,cpc:0.45,cpa:8.10,roas:3.6,conv:298,purchaseIntent:64,winner:false},
      C:{ctr:4.9,cpc:0.52,cpa:9.70,roas:2.9,conv:188,purchaseIntent:53,winner:false},
    },
    // 12 points over 72h (CTR-ish trend) per cell
    series:{
      A:[2.9,3.4,3.8,4.1,4.0,4.3,4.6,4.7,4.5,4.8,4.6,4.6],
      D:[2.7,3.1,3.3,3.5,3.7,3.8,3.9,4.0,3.9,4.1,4.0,4.0],
      C:[3.6,4.2,4.8,5.1,4.9,4.6,4.4,4.2,4.0,4.1,4.0,3.9],
    },
    audienceBreakdown:[
      {seg:"18–24",ctr:5.1,share:38},
      {seg:"25–34",ctr:4.7,share:41},
      {seg:"35–44",ctr:3.2,share:16},
      {seg:"45+",ctr:2.1,share:5},
    ],
    placements:[
      {name:"Reels",share:44,ctr:5.0},
      {name:"Feed",share:39,ctr:4.2},
      {name:"Stories",share:17,ctr:3.6},
    ],
  };

  const winner = {
    cell:"A",
    cpcDelta:-31, intentDelta:+18, roas:4.8,
    summary:"Variant A (Watch Party) delivered 31% lower CPC and 18% higher purchase-intent signal than the unity angle. Friendship language outperformed competition language among 18–34 sharers.",
    learnings:[
      "Watch-party / friendship framing beats victory/competition framing for this brand among 18–34.",
      "Optimal publish window: ~90 minutes before kickoff.",
      "Reels placement drove the lowest CPC; scale budget there first.",
      "Meme angle (C) earned the highest CTR but worst CPA — great for awareness, weak for conversion.",
    ],
    nextTest:"Keep Variant A’s image. Test urgency copy vs. nostalgia copy as the next isolated variable.",
  };

  // Dashboard rollups
  const dashboard = {
    activeCampaigns:1,
    liveTests:1,
    creativesGenerated:5,
    avgBrainScore:83,
    recentActivity:[
      {t:"2m ago", txt:"Variant A declared winner — World Football Cup", kind:"win"},
      {t:"1h ago", txt:"A/B/C test live on Meta · 3 cells", kind:"launch"},
      {t:"3h ago", txt:"5 variants scored · avg TRIBE 83", kind:"score"},
      {t:"5h ago", txt:"World Football Cup opportunity accepted", kind:"event"},
      {t:"yesterday", txt:"Brand Brain updated · tone rules parsed", kind:"brand"},
    ],
  };
export const DATA = { brand, events, variants, scores, tribeDims, experiment, analytics, winner, dashboard,
  campaignTitle:"Cresta × World Football Cup", campaignId:"wc26" };
