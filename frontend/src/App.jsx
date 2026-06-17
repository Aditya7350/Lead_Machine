import { useState, useEffect, useCallback, useRef } from 'react'

const API = window.location.origin.includes('5173') ? 'http://localhost:3000' : ''

const NICHES = [
  {value:"dentists",label:"Dentists / Dental",keywords:["dentist","dental clinic","dental office","family dentist","cosmetic dentist"]},
  {value:"plumbers",label:"Plumbers / HVAC",keywords:["plumber","plumbing services","emergency plumber"]},
  {value:"restaurants",label:"Restaurants / Cafes",keywords:["restaurant","cafe","dining","family restaurant"]},
  {value:"salons",label:"Salons / Barbershops",keywords:["hair salon","beauty salon","barbershop"]},
  {value:"realestate",label:"Real Estate",keywords:["real estate agent","realtor","property dealer"]},
  {value:"auto",label:"Auto Repair",keywords:["auto repair","car mechanic","auto service"]},
  {value:"gyms",label:"Gyms / Fitness",keywords:["gym","fitness studio","yoga studio"]},
  {value:"lawyers",label:"Lawyers / Law Firms",keywords:["lawyer","attorney","law firm"]},
  {value:"vets",label:"Veterinary",keywords:["veterinary","vet clinic","animal hospital"]},
  {value:"cleaning",label:"Cleaning Services",keywords:["cleaning service","house cleaning"]},
  {value:"it_services",label:"IT Services / Tech",keywords:["IT services","IT company","software company","tech company"]},
  {value:"web_dev",label:"Web Development",keywords:["web development","web design company"]},
  {value:"digital_marketing",label:"Digital Marketing",keywords:["digital marketing agency","SEO agency"]},
  {value:"accounting",label:"Accounting / CA",keywords:["accountant","CA firm","tax consultant"]},
  {value:"photography",label:"Photography",keywords:["photographer","photo studio","wedding photographer"]},
  {value:"education",label:"Education / Coaching",keywords:["coaching classes","tuition center","training institute"]},
  {value:"hospital",label:"Hospitals / Clinics",keywords:["hospital","clinic","medical center"]},
  {value:"hotel",label:"Hotels / Resorts",keywords:["hotel","resort","guest house"]},
  {value:"construction",label:"Construction",keywords:["construction company","builder","contractor"]},
  {value:"custom",label:"✏️ Custom (type your own)",keywords:[]},
]
const COUNTRIES = [
  {code:"US",name:"United States"},{code:"GB",name:"United Kingdom"},{code:"IN",name:"India"},
  {code:"CA",name:"Canada"},{code:"AU",name:"Australia"},{code:"DE",name:"Germany"},
  {code:"AE",name:"UAE"},{code:"SG",name:"Singapore"},{code:"NZ",name:"New Zealand"},
]
const STATUS = {
  new:{color:"#64748b",bg:"#1e293b",label:"NEW"},
  qualified:{color:"#22d3ee",bg:"#0e3a4a",label:"QUALIFIED"},
  demo_built:{color:"#FB923C",bg:"#2e1f5e",label:"DEMO BUILT"},
  contacted:{color:"#f59e0b",bg:"#3d2e0a",label:"CONTACTED"},
  replied:{color:"#10b981",bg:"#0a3d2e",label:"REPLIED"},
  archived:{color:"#475569",bg:"#1e293b",label:"ARCHIVED"},
}

function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return "just now"
  if (d < 3600) return Math.floor(d/60) + "m ago"
  if (d < 86400) return Math.floor(d/3600) + "h ago"
  return Math.floor(d/86400) + "d ago"
}
function getEmail(l) { if(l.email) return l.email; try { return "info@" + new URL(l.website_url).hostname.replace("www.","") } catch(e) { return "" } }
function getHost(u) { try { return new URL(u).hostname } catch(e) { return "" } }

// ============ LOGIN PAGE ============
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let nodes = [], W, H, animId
    const resize = () => { W = canvas.width = canvas.parentElement.offsetWidth; H = canvas.height = canvas.parentElement.offsetHeight }
    resize(); window.addEventListener('resize', resize)
    for (let i = 0; i < 18; i++) nodes.push({ x: Math.random()*2000, y: Math.random()*1200, vx:(Math.random()-.5)*.3, vy:(Math.random()-.5)*.3, r:Math.random()*2+1.5, pulse:0, ps:0 })
    const iv = setInterval(() => { const n = nodes[Math.floor(Math.random()*nodes.length)]; n.pulse=1; n.ps=0.015 }, 2000)
    const draw = () => {
      ctx.clearRect(0,0,W,H)
      for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++) { const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,dist=Math.sqrt(dx*dx+dy*dy); if(dist<150){ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.strokeStyle=`rgba(249,115,22,${(1-dist/150)*.12})`;ctx.lineWidth=.5;ctx.stroke()}}
      for(const n of nodes){n.x+=n.vx;n.y+=n.vy;if(n.x<0||n.x>W)n.vx*=-1;if(n.y<0||n.y>H)n.vy*=-1;if(n.pulse>0){n.pulse-=n.ps;ctx.beginPath();ctx.arc(n.x,n.y,n.r+n.pulse*16,0,Math.PI*2);ctx.fillStyle=`rgba(234,88,12,${n.pulse*.25})`;ctx.fill()}ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fillStyle=n.pulse>.5?'#EA580C':'#F97316';ctx.fill()}
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); clearInterval(iv); window.removeEventListener('resize', resize) }
  }, [])

  const handleLogin = async () => {
    if (!email || !pass) { setErr('Enter email and password'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch(API + '/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password:pass}) })
      const data = await res.json()
      if (data.token) { localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user)); onLogin(data.user) }
      else setErr(data.detail || 'Invalid credentials')
    } catch(e) { setErr('Cannot connect to server') }
    setLoading(false)
  }

  return (
    <div className="login-split">
      <div className="login-brand">
        <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}} />
        <div style={{position:'relative',zIndex:2}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:48}}>
            <div style={{width:48,height:48,borderRadius:14,background:'linear-gradient(135deg,#F97316,#EA580C)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,boxShadow:'0 8px 32px rgba(249,115,22,.3)'}}>⚡</div>
            <div><h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:700}}>Lead Machine</h1><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#64748b'}}>ai-powered pipeline</span></div>
          </div>
          <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:44,fontWeight:700,lineHeight:1.15,letterSpacing:'-.03em',marginBottom:20}}>Find leads.<br/>Build demos.<br/><em style={{fontStyle:'normal',background:'linear-gradient(135deg,#F97316,#EA580C)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Close clients.</em></h2>
          <p style={{fontSize:16,color:'#64748b',lineHeight:1.7,maxWidth:440}}>AI discovers businesses, qualifies them, builds demo websites, and sends personalized outreach — all on autopilot.</p>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-form">
          <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:28,fontWeight:600,marginBottom:8}}>Welcome back</h2>
          <p style={{color:'#01070f',fontSize:14,marginBottom:36}}>Sign in to your dashboard</p>
          {err && <div style={{background:'#1a0a0a',border:'1px solid #7f1d1d',color:'#fca5a5',padding:'10px 14px',borderRadius:8,fontSize:13,marginBottom:16}}>{err}</div>}
          <div style={{marginBottom:22}}>
            <label style={{display:'block',fontSize:12,fontWeight:500,color:'#94a3b8',marginBottom:6}}>Email</label>
            <input className="input" type="email" placeholder="you@agency.com" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div style={{marginBottom:22,position:'relative'}}>
            <label style={{display:'block',fontSize:12,fontWeight:500,color:'#94a3b8',marginBottom:6}}>Password</label>
            <input className="input" type={showPw?'text':'password'} placeholder="Enter password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleLogin()}} />
            <button onClick={()=>setShowPw(!showPw)} style={{position:'absolute',right:14,top:34,background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>{showPw?'Hide':'Show'}</button>
          </div>
          <button className="login-btn" onClick={handleLogin} disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </div>
      </div>
    </div>
  )
}

// ============ LEAD CARD ============
function LeadCard({ lead, onAction, loading }) {
  const sc = STATUS[lead.status] || STATUS.new
  const isNew = lead.status === 'new' || lead.qualification === 'pending'
  const isQ = lead.qualification === 'qualified'
  const hasD = lead.demo_site_built
  const canE = hasD && lead.status !== 'contacted' && lead.status !== 'replied'
  const em = getEmail(lead)
  const mapUrl = lead.latitude && lead.longitude ? `https://maps.google.com/maps?q=${lead.latitude},${lead.longitude}&z=16&output=embed` : null
  const mapLink = lead.latitude ? `https://www.google.com/maps?q=${lead.latitude},${lead.longitude}` : null
  const score = lead.website_score
  const pct = score != null ? (score/10)*100 : null
  const scoreColor = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444'

  return (
    <div className="lead-card">
      <div className="lead-map">
        {mapUrl ? <iframe src={mapUrl} loading="lazy" referrerPolicy="no-referrer" /> : <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#334155'}}>📍 No location</div>}
        <div style={{position:'absolute',top:10,right:10}}><span className="badge" style={{color:sc.color,background:sc.bg}}>{sc.label}</span></div>
        {mapLink && <a href={mapLink} target="_blank" rel="noreferrer" style={{position:'absolute',bottom:8,right:8,padding:'4px 10px',borderRadius:6,background:'rgba(255,255,255,.9)',color:'#94a3b8',fontSize:11,textDecoration:'none'}}>Maps ↗</a>}
      </div>
      <div style={{padding:'14px 18px 10px'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {lead.google_rating ? <><span style={{color:'#f59e0b',fontSize:16}}>{'★'.repeat(Math.floor(lead.google_rating))}{'☆'.repeat(5-Math.floor(lead.google_rating))}</span><span style={{fontSize:13,fontWeight:600,color:'#f59e0b'}}>{lead.google_rating}</span>{lead.review_count>0&&<span style={{fontSize:11,color:'#475569'}}>({lead.review_count})</span>}</> : <span style={{color:'#334155',fontSize:12}}>No rating</span>}
        </div>
        <h3 style={{fontSize:15,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",color:'#0F172A',marginTop:6,marginBottom:3}}>{lead.business_name}</h3>
        <div style={{fontSize:11,color:'#64748b'}}>{lead.niche} · {lead.city}</div>
      </div>
      <div className="lead-info">
        {[
          {icon:'📧',label:'Email',value:em,href:em?'mailto:'+em:null,miss:'No email'},
          {icon:'📞',label:'Phone',value:lead.phone,href:lead.phone?'tel:'+lead.phone:null,miss:'No phone'},
          {icon:'🌐',label:'Web',value:lead.website_url?getHost(lead.website_url):'',href:lead.website_url,miss:'No website'},
          {icon:'📍',label:'Address',value:lead.address},
        ].map((r,i) => (
          <div key={i} className="lead-info-row">
            <span className="icon">{r.icon}</span>
            <div style={{flex:1}}><span style={{color:'#64748b',fontSize:11}}>{r.label}:</span>{' '}
              {r.value ? (r.href ? <a href={r.href} target="_blank" rel="noreferrer" style={{color:'#F97316',textDecoration:'none',wordBreak:'break-all'}}>{r.value}</a> : <span style={{color:'#1E293B'}}>{r.value}</span>) : <span style={{color:'#475569',fontStyle:'italic'}}>{r.miss||'N/A'}</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:'12px 18px',borderTop:'1px solid #F1F5F9'}}>
        {pct != null ? <>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:11,color:'#94a3b8'}}>AI Lead Score</span><span style={{fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:scoreColor}}>{pct}%</span></div>
          <div className="score-bar-track"><div className="score-bar-fill" style={{width:pct+'%',background:scoreColor}} /></div>
          <div style={{fontSize:10,color:'#475569',marginTop:3}}>{score>=8?'High Priority':score>=6?'Good Lead':'Low Priority'} · {score}/10</div>
        </> : <div style={{fontSize:11,color:'#334155'}}>Not scored</div>}
        {lead.ai_analysis && <div style={{marginTop:8,padding:'8px 10px',borderRadius:6,background:'#F8FAFC',fontSize:11,color:'#94a3b8',lineHeight:1.5}}>🤖 {lead.ai_analysis}</div>}
      </div>
      {lead.demo_site_url && <div style={{padding:'0 18px 12px'}}><a href={lead.demo_site_url} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:8,background:'linear-gradient(135deg,rgba(249,115,22,.1),rgba(234,88,12,.1))',border:'1px solid rgba(249,115,22,.2)',textDecoration:'none'}}><span style={{fontSize:18}}>🌐</span><div><div style={{fontSize:12,fontWeight:600,color:'#FB923C'}}>Demo Ready</div><div style={{fontSize:11,color:'#64748b'}}>Click to preview</div></div><span style={{marginLeft:'auto',color:'#F97316'}}>↗</span></a></div>}
      <div className="lead-actions">
        {isNew && <button className="btn btn-sm" onClick={()=>onAction(lead.id,'qualify')} disabled={loading[lead.id+'qualify']} style={{color:'#22d3ee',borderColor:'#0e3a4a',flex:1}}>{loading[lead.id+'qualify']?<span className="spinner"/>:'🎯 Qualify'}</button>}
        {isQ && !hasD && <button className="btn btn-sm" onClick={()=>onAction(lead.id,'build-demo')} disabled={loading[lead.id+'build-demo']} style={{color:'#FB923C',borderColor:'#2e1f5e',flex:1}}>{loading[lead.id+'build-demo']?<span className="spinner"/>:'🏗️ Demo'}</button>}
        {canE && <button className="btn btn-sm" onClick={()=>onAction(lead.id,'send-email')} disabled={loading[lead.id+'send-email']} style={{color:'#f59e0b',borderColor:'#3d2e0a',flex:1}}>{loading[lead.id+'send-email']?<span className="spinner"/>:'📧 Email'}</button>}
      </div>
    </div>
  )
}

// ============ MAIN APP ============
export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user')) } catch { return null } })
  const [page, setPage] = useState('dashboard')
  const [stats, setStats] = useState({total_leads:0,qualified:0,demos_built:0,contacted:0,replied:0,emails_today:0})
  const [leads, setLeads] = useState([])
  const [activity, setActivity] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [connected, setConnected] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [expandedNav, setExpandedNav] = useState({})
  const [city, setCity] = useState(''); const [country, setCountry] = useState('US'); const [niche, setNiche] = useState('dentists')
  const [customKw, setCustomKw] = useState(''); const [radius, setRadius] = useState(25)
  const [scraping, setScraping] = useState(false); const [scrapeMsg, setScrapeMsg] = useState('')
  const [actionLoading, setActionLoading] = useState({})
  const [filter, setFilter] = useState('all')

  const token = localStorage.getItem('token')

  const fetchAll = useCallback(async () => {
    try {
      const [s,l,a,c] = await Promise.all([
        fetch(API+'/api/stats').then(r=>r.json()), fetch(API+'/api/leads?limit=100').then(r=>r.json()),
        fetch(API+'/api/activity?limit=30').then(r=>r.json()), fetch(API+'/api/campaigns').then(r=>r.json()),
      ])
      setStats(s); setLeads(l); setActivity(a); setCampaigns(c); setConnected(true)
    } catch { setConnected(false) }
  }, [])

  useEffect(() => { if(user){fetchAll(); const i=setInterval(fetchAll,12000); return ()=>clearInterval(i)} }, [user, fetchAll])

  if (!token || !user) return <LoginPage onLogin={setUser} />

  const startScrape = async () => {
    if(!city.trim()){setScrapeMsg('Enter a city');return}
    setScraping(true);setScrapeMsg('Scraping '+city+'...')
    const nd=NICHES.find(n=>n.value===niche)
    const kw=niche==='custom'?(customKw||'business').split(',').map(k=>k.trim()):(customKw.trim()?customKw.split(',').map(k=>k.trim()):(nd?nd.keywords:[niche]))
    try{await fetch(API+'/api/quick-scrape',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({city:city.trim(),country_code:country,niche:niche==='custom'?customKw.split(',')[0]||'business':nd?.value||niche,keywords:kw,radius_km:radius})});setScrapeMsg('Started! Check My Leads in ~30s.');setTimeout(fetchAll,5000);setTimeout(fetchAll,15000);setTimeout(fetchAll,30000)}catch(e){setScrapeMsg('Error: '+e.message)}
    setScraping(false)
  }
  const leadAction=async(id,act)=>{setActionLoading(p=>({...p,[id+act]:true}));try{await fetch(API+'/api/leads/'+id+'/'+act,{method:'POST'});setTimeout(fetchAll,3000);setTimeout(fetchAll,8000)}catch{};setTimeout(()=>setActionLoading(p=>({...p,[id+act]:false})),10000)}
  const bulkAction=async(ep,lb)=>{setActionLoading(p=>({...p,[lb]:true}));try{await fetch(API+'/api/run/'+ep,{method:'POST'});setTimeout(fetchAll,3000);setTimeout(fetchAll,10000)}catch{};setTimeout(()=>setActionLoading(p=>({...p,[lb]:false})),15000)}
  const logout=()=>{localStorage.clear();setUser(null)}
  const toggleNav=(id)=>setExpandedNav(p=>({...p,[id]:!p[id]}))

  const filtered=filter==='all'?leads:leads.filter(l=>{
    if(filter==='new')return l.status==='new';if(filter==='qualified')return l.qualification==='qualified'&&!l.demo_site_built;
    if(filter==='demo')return l.demo_site_built;if(filter==='contacted')return l.status==='contacted'||l.status==='replied';return true
  })
  const nd = NICHES.find(n=>n.value===niche)
  const demoLeads = leads.filter(l=>l.demo_site_built)

  const NAV = [
    {section:'Main',items:[
      {id:'dashboard',icon:'📊',label:'Dashboard'},
      {id:'find',icon:'🔍',label:'Find Leads',children:[{id:'scrape',label:'Google Maps Search'},{id:'custom_search',label:'Custom / IT Search'}]},
      {id:'leads',icon:'👥',label:'My Leads',badge:leads.length||null},
      {id:'demos',icon:'🌐',label:'Demo Sites',badge:demoLeads.length||null,badgeClass:'green'},
    ]},
    {section:'Outreach',items:[
      {id:'outreach_email',icon:'📧',label:'Email Outreach'},
      {id:'campaigns',icon:'📁',label:'Campaigns'},
      {id:'activity',icon:'📋',label:'Activity'},
    ]},
    {section:'Tools',items:[
      {id:'reports',icon:'📄',label:'Reports'},
      {id:'settings',icon:'⚙️',label:'Settings'},
    ]},
  ]

  const pageTitle = {dashboard:'Dashboard',scrape:'Find Leads — Google Maps',custom_search:'Find Leads — Custom Search',leads:'My Leads',demos:'Demo Sites',outreach_email:'Email Outreach',campaigns:'Campaigns',activity:'Activity Log',reports:'Reports',settings:'Settings'}

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className={`sidebar${collapsed?' collapsed':''}`}>
        <div className="sidebar-logo"><div className="icon">⚡</div><div><h1>Lead Machine</h1><span className="sub">ai-powered pipeline</span></div></div>
        <nav className="sidebar-nav">
          {NAV.map(group => (
            <div key={group.section} className="nav-group">
              <div className="nav-section">{group.section}</div>
              {group.items.map(item => (
                <div key={item.id}>
                  <div className={`nav-item${page===item.id||(item.children?.some(c=>c.id===page))?' active':''}`} onClick={()=>{if(item.children){toggleNav(item.id)}else{setPage(item.id)}}}>
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge && <span className={`nav-badge${item.badgeClass?' '+item.badgeClass:''}`}>{item.badge}</span>}
                    {item.children && <span className={`nav-arrow${expandedNav[item.id]?' open':''}`}>▶</span>}
                  </div>
                  {item.children && expandedNav[item.id] && (
                    <div className="nav-sub" style={{maxHeight:item.children.length*40}}>
                      {item.children.map(child => <div key={child.id} className={`nav-item${page===child.id?' active':''}`} onClick={()=>setPage(child.id)}><span className="nav-label">{child.label}</span></div>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user"><div className="avatar">{(user.name||user.email||'A')[0].toUpperCase()}</div><div><div className="uname">{user.name||'Admin'}</div><div className="uemail">{user.email}</div></div></div>
          <button className="logout-btn" onClick={logout}>🚪 Sign Out</button>
          <button className="collapse-btn" onClick={()=>setCollapsed(!collapsed)}>{collapsed?'▶':'◀'} {collapsed?'':'Collapse'}</button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-content">
        <div className="topbar">
          <h2>{pageTitle[page]||'Dashboard'}</h2>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{display:'flex',gap:5}}>
              {[{l:'Leads',v:stats.total_leads,c:'#F97316'},{l:'Qualified',v:stats.qualified,c:'#22d3ee'},{l:'Demos',v:stats.demos_built,c:'#FB923C'},{l:'Replied',v:stats.replied,c:'#10b981'}].map(p=><div key={p.l} className="stat-pill" style={{color:p.c}}><span className="label">{p.l}</span>{p.v}</div>)}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:connected?'#10b981':'#ef4444'}}><span className="live-dot" style={{background:connected?'#10b981':'#ef4444',animation:connected?'pulse-dot 2s infinite':'none'}}/>{connected?'Live':'Offline'}</div>
          </div>
        </div>

        <main style={{padding:'24px 28px'}}>

        {/* DASHBOARD */}
        {page==='dashboard' && <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:28}}>
            {[{l:'Total Leads',v:stats.total_leads,i:'🔍',c:'#F97316'},{l:'Qualified',v:stats.qualified,i:'🎯',c:'#22d3ee'},{l:'Demo Sites',v:stats.demos_built,i:'🏗️',c:'#FB923C'},{l:'Contacted',v:stats.contacted,i:'📧',c:'#f59e0b'},{l:'Replied',v:stats.replied,i:'💬',c:'#10b981'},{l:'Today',v:stats.emails_today,i:'📤',c:'#ec4899'}].map(s=>
              <div key={s.l} className="stat-card"><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:12,color:'#64748b'}}>{s.l}</span><span style={{fontSize:18}}>{s.i}</span></div><div className="stat-value" style={{color:s.c}}>{s.v}</div></div>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div><h3 style={{fontSize:14,fontWeight:600,color:'#090a0a',marginBottom:12}}>Recent Activity</h3><div className="card" style={{maxHeight:380,overflowY:'auto'}}>{activity.slice(0,10).map((it,i)=><div key={it.id||i} style={{padding:'10px 16px',borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:14}}>{{scrape:'🔍',qualify:'🎯',build:'🏗️',email:'📧',reply:'💬'}[it.type]||'📌'}</span><span style={{fontSize:12,color:'#334155',flex:1}}>{it.message}</span><span style={{fontSize:10,color:'#475569',fontFamily:"'JetBrains Mono',monospace"}}>{timeAgo(it.created_at)}</span></div>)}{activity.length===0&&<div style={{padding:40,textAlign:'center',color:'#475569',fontSize:13}}>No activity yet</div>}</div></div>
            <div><h3 style={{fontSize:14,fontWeight:600,color:'#0c0e10',marginBottom:12}}>Quick Actions</h3><div style={{display:'flex',flexDirection:'column',gap:10}}>{[{l:'Find New Leads',d:'Scrape by location',a:()=>setPage('scrape'),i:'🔍'},{l:'Qualify All New',d:'AI score leads',a:()=>bulkAction('qualify','bQ'),i:'🎯'},{l:'Build All Demos',d:'Generate websites',a:()=>bulkAction('build-sites','bB'),i:'🏗️'},{l:'Send All Emails',d:'Outreach campaign',a:()=>bulkAction('outreach','bE'),i:'📧'}].map(a=><button key={a.l} className="btn" onClick={a.a} style={{padding:'14px 16px',textAlign:'left',justifyContent:'flex-start'}}><span style={{fontSize:18,marginRight:4}}>{a.i}</span><div><div style={{fontSize:13,fontWeight:500,color:'#1E293B'}}>{a.l}</div><div style={{fontSize:11,color:'#475569'}}>{a.d}</div></div></button>)}</div></div>
          </div>
        </div>}

        {/* FIND LEADS */}
        {(page==='scrape'||page==='custom_search') && <div style={{maxWidth:680}}>
          <p style={{fontSize:13,color:'#64748b',marginBottom:24}}>{page==='custom_search'?'Search for any business type — IT companies, software firms, agencies, or anything else.':'Enter a location and niche to discover businesses via Google Maps.'}</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>City / Area *</label><input className="input" placeholder="e.g. Pune, Miami, London..." value={city} onChange={e=>setCity(e.target.value)} /></div>
            <div><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>Country</label><select className="select" value={country} onChange={e=>setCountry(e.target.value)}>{COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div>
              <label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>Niche</label>
              {page==='custom_search' ? <input className="input" placeholder="Type anything: IT consulting, pet shop, tattoo studio..." value={customKw} onChange={e=>setCustomKw(e.target.value)} />
              : <><select className="select" value={niche} onChange={e=>setNiche(e.target.value)}>{NICHES.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}</select>{niche==='custom'&&<input className="input" style={{marginTop:8}} placeholder="Type your niche..." value={customKw} onChange={e=>setCustomKw(e.target.value)} />}</>}
            </div>
            <div><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>Radius: {radius}km</label><input type="range" min="5" max="50" value={radius} onChange={e=>setRadius(+e.target.value)} style={{width:'100%',marginTop:8,accentColor:'#F97316'}} /></div>
          </div>
          {page!=='custom_search'&&<div style={{marginBottom:20}}><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>Keywords</label><input className="input" placeholder={nd?nd.keywords.join(', '):''} value={customKw} onChange={e=>setCustomKw(e.target.value)} />{!customKw&&nd&&nd.keywords.length>0&&<div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>{nd.keywords.map(k=><span key={k} style={{padding:'2px 8px',borderRadius:4,background:'#F1F5F9',fontSize:11,color:'#94a3b8'}}>{k}</span>)}</div>}</div>}
          <button className="btn btn-primary" onClick={startScrape} disabled={scraping} style={{padding:'12px 32px',fontSize:14}}>{scraping?'⏳ Scraping...':'🔍 Start Scraping'}</button>
          {scrapeMsg&&<div style={{marginTop:16,padding:'12px 16px',borderRadius:8,background:scrapeMsg.includes('Error')?'#3b1111':'#0a3d2e',color:scrapeMsg.includes('Error')?'#ef4444':'#10b981',fontSize:13}}>{scrapeMsg}</div>}
        </div>}

        {/* MY LEADS */}
        {page==='leads' && <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18,flexWrap:'wrap',gap:12}}>
            <div style={{display:'flex',gap:6}}>{[['all','All ('+leads.length+')'],['new','New'],['qualified','Qualified'],['demo','Has Demo'],['contacted','Contacted']].map(f=><button key={f[0]} className={`btn btn-sm ${filter===f[0]?'btn-primary':''}`} onClick={()=>setFilter(f[0])}>{f[1]}</button>)}</div>
            <div style={{display:'flex',gap:6}}><button className="btn btn-sm" onClick={()=>bulkAction('qualify','bQ')} disabled={actionLoading.bQ}>{actionLoading.bQ?<span className="spinner"/>:'🎯 Qualify All'}</button><button className="btn btn-sm" onClick={()=>bulkAction('build-sites','bB')} disabled={actionLoading.bB}>{actionLoading.bB?<span className="spinner"/>:'🏗️ Demos'}</button><button className="btn btn-sm" onClick={()=>bulkAction('outreach','bE')} disabled={actionLoading.bE}>{actionLoading.bE?<span className="spinner"/>:'📧 Emails'}</button></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))',gap:18}}>{filtered.map((l,i)=><LeadCard key={l.id||i} lead={l} onAction={leadAction} loading={actionLoading}/>)}</div>
          {filtered.length===0&&<div style={{padding:60,textAlign:'center',color:'#475569'}}>No leads. Go to Find Leads.</div>}
        </div>}

        {/* DEMO SITES */}
        {page==='demos' && <div>
          <p style={{fontSize:13,color:'#64748b',marginBottom:20}}>All generated demo websites for your leads.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16}}>
            {demoLeads.map((l,i)=><div key={l.id||i} className="card"><div style={{padding:18,display:'flex',alignItems:'center',gap:14}}><div style={{width:44,height:44,borderRadius:10,background:'linear-gradient(135deg,rgba(249,115,22,.15),rgba(234,88,12,.15))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🌐</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:'#1E293B'}}>{l.business_name}</div><div style={{fontSize:12,color:'#64748b'}}>{l.niche} · {l.city}</div></div><a href={l.demo_site_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">View ↗</a></div></div>)}
          </div>
          {demoLeads.length===0&&<div style={{padding:60,textAlign:'center',color:'#475569'}}><span style={{fontSize:48,display:'block',marginBottom:16}}>🏗️</span>No demo sites yet. Qualify leads and build demos.</div>}
        </div>}

        {/* EMAIL OUTREACH */}
        {page==='outreach_email' && <div>
          <div style={{display:'flex',gap:12,marginBottom:24}}><button className="btn btn-primary" onClick={()=>bulkAction('outreach','bO')} disabled={actionLoading.bO}>{actionLoading.bO?<span className="spinner"/>:'📧 Send All Due Emails'}</button></div>
          <h3 style={{fontSize:14,fontWeight:600,color:'#94a3b8',marginBottom:12}}>Recent Emails</h3>
          <div className="card">{activity.filter(a=>a.type==='email').map((it,i)=><div key={it.id||i} style={{padding:'12px 18px',borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:14}}>📧</span><span style={{fontSize:13,color:'#334155',flex:1}}>{it.message}</span><span style={{fontSize:10,color:'#475569',fontFamily:"'JetBrains Mono',monospace"}}>{timeAgo(it.created_at)}</span></div>)}{activity.filter(a=>a.type==='email').length===0&&<div style={{padding:40,textAlign:'center',color:'#475569',fontSize:13}}>No emails sent yet. Build demos first, then send outreach.</div>}</div>
        </div>}

        {/* CAMPAIGNS */}
        {page==='campaigns' && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
          {campaigns.map((c,i)=><div key={c.id||i} className="card"><div className="card-body"><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',background:c.status==='active'?'#10b981':'#475569',display:'inline-block'}}/><span style={{fontSize:14,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{c.name}</span></div><span className="badge" style={{color:c.status==='active'?'#10b981':'#64748b',background:c.status==='active'?'#0a3d2e':'#1e293b'}}>{c.status}</span></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12,color:'#94a3b8'}}><div><span style={{color:'#475569'}}>Niche:</span> {c.niche}</div><div><span style={{color:'#475569'}}>City:</span> {c.city}</div><div><span style={{color:'#475569'}}>Country:</span> {c.country_code}</div><div><span style={{color:'#475569'}}>Keywords:</span> {(c.keywords||[]).length}</div></div></div></div>)}
          {campaigns.length===0&&<div style={{padding:48,textAlign:'center',color:'#475569'}}>No campaigns yet. Search for leads to create one.</div>}
        </div>}

        {/* ACTIVITY */}
        {page==='activity' && <div style={{maxWidth:720}}><div className="card">{activity.map((it,i)=>{const cs={scrape:'#F97316',qualify:'#22d3ee',build:'#FB923C',email:'#f59e0b',reply:'#10b981'},em={scrape:'🔍',qualify:'🎯',build:'🏗️',email:'📧',reply:'💬'};return<div key={it.id||i} style={{padding:'12px 20px',borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',gap:12}}><div style={{width:30,height:30,borderRadius:7,background:(cs[it.type]||'#64748b')+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{em[it.type]||'📌'}</div><div style={{flex:1,fontSize:13,color:it.type==='reply'?'#10b981':'#cbd5e1',fontWeight:it.type==='reply'?600:400}}>{it.message}</div><div style={{fontSize:11,color:'#475569',fontFamily:"'JetBrains Mono',monospace"}}>{timeAgo(it.created_at)}</div></div>})}{activity.length===0&&<div style={{padding:48,textAlign:'center',color:'#475569'}}>No activity yet.</div>}</div></div>}

        {/* REPORTS */}
        {page==='reports' && <div style={{padding:60,textAlign:'center'}}><span style={{fontSize:48,display:'block',marginBottom:16}}>📄</span><h3 style={{fontSize:18,fontWeight:600,color:'#94a3b8',marginBottom:8}}>Reports — Coming Soon</h3><p style={{fontSize:13,color:'#475569',maxWidth:400,margin:'0 auto'}}>Generate branded PDF audit reports showing website issues, Google rating analysis, and your demo site preview. Perfect for client presentations.</p></div>}

        {/* SETTINGS */}
        {page==='settings' && <div style={{maxWidth:600}}>
          <div className="card" style={{marginBottom:20}}><div className="card-header"><span style={{fontSize:14}}>🔑</span><span style={{fontSize:14,fontWeight:600}}>API Configuration</span></div><div className="card-body"><div style={{marginBottom:16}}><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>Anthropic API Key</label><input className="input" type="password" defaultValue="sk-ant-•••••••••" disabled /></div><div style={{marginBottom:16}}><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>Google Maps API Key</label><input className="input" type="password" defaultValue="AIza•••••••••" disabled /></div><div><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>Resend API Key</label><input className="input" type="password" defaultValue="re_•••••••••" disabled /></div><p style={{fontSize:11,color:'#475569',marginTop:12}}>Edit these in your .env file and restart the server.</p></div></div>
          <div className="card"><div className="card-header"><span style={{fontSize:14}}>📧</span><span style={{fontSize:14,fontWeight:600}}>Email Configuration</span></div><div className="card-body"><div style={{marginBottom:16}}><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>From Email</label><input className="input" defaultValue={user.email} /></div><div><label style={{fontSize:12,color:'#94a3b8',display:'block',marginBottom:6}}>Agency Name</label><input className="input" defaultValue="Web Agency" /></div><button className="btn btn-primary" style={{marginTop:16}}>Save Settings</button></div></div>
        </div>}

        </main>
      </div>
    </div>
  )
}
