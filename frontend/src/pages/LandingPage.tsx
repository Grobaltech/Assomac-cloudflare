import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '../lib/supabase';

type Company={id:string;name:string;slug:string;description:string|null;logo_url:string|null;primary_color:string;secondary_color:string};

export default function LandingPage(){
  const [companies,setCompanies]=useState<Company[]>([]);
  useEffect(()=>{supabase.from('companies').select('id,name,slug,description,logo_url,primary_color,secondary_color').eq('status','ACTIVE').eq('public_page_enabled',true).order('name').then(({data})=>setCompanies(data||[]))},[]);
  return <div className="min-h-screen bg-white text-slate-900">
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
        <Link to="/" className="font-black text-2xl text-[#00194C]">ASSOMAC</Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <a href="#about">About</a><a href="#services">Services</a><a href="#companies">Companies</a><a href="#contact">Contact</a>
          <Link to="/login" className="text-[#00194C]">Login</Link>
          <Link to="/register" className="rounded-lg bg-[#f35a02] px-5 py-2.5 text-white">Sign Up</Link>
        </nav>
        <Link to="/login" className="md:hidden rounded-lg bg-[#f35a02] px-4 py-2 text-white text-sm">Login</Link>
      </div>
    </header>
    <section className="bg-[#00194C] text-white">
      <div className="max-w-7xl mx-auto px-5 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block rounded-full bg-white/10 px-4 py-2 text-sm">Enterprise management platform</span>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mt-6">One platform for ASOMAC and its member companies.</h1>
          <p className="mt-6 text-lg text-blue-100 max-w-xl">Manage companies, branches, people, stock, transfers, finance, history and public company activities from one secure multi-tenant platform.</p>
          <div className="flex flex-wrap gap-4 mt-8"><Link to="/register" className="rounded-xl bg-[#f35a02] px-6 py-3 font-bold">Get started</Link><a href="#companies" className="rounded-xl border border-white/30 px-6 py-3 font-bold">Explore companies</a></div>
        </div>
        <div className="rounded-3xl bg-white/10 border border-white/10 p-8">
          <div className="text-sm text-blue-200">ASOMAC structure</div>
          <div className="mt-6 space-y-3">{['Super Administrator','ASOMAC Administrator','Companies','Company Administrators','Branches','Branch Operations'].map((x,i)=><div key={x} className="rounded-xl bg-white/10 px-5 py-4" style={{marginLeft:i*10}}>{x}</div>)}</div>
        </div>
      </div>
    </section>
    <section id="about" className="max-w-7xl mx-auto px-5 py-20"><div className="max-w-3xl"><p className="text-[#f35a02] font-bold">ABOUT ASOMAC</p><h2 className="text-3xl md:text-4xl font-black text-[#00194C] mt-2">Built around accountability, structure and growth.</h2><p className="mt-5 text-slate-600 text-lg">ASOMAC separates platform governance from company administration and branch operations, with permissions and database security enforcing each user's actual authority.</p></div></section>
    <section id="services" className="bg-slate-50 py-20"><div className="max-w-7xl mx-auto px-5"><p className="text-[#f35a02] font-bold">SERVICES</p><h2 className="text-3xl font-black text-[#00194C] mt-2">Everything connected.</h2><div className="grid md:grid-cols-3 gap-5 mt-8">{[['Companies','Governance, branding and public company pages.'],['Branches','Locations, managers and branch-level operations.'],['Operations','People, stock, consignments, sales, finance and reports.'],['Transfers','Controlled company-to-company and branch-to-branch movement.'],['History','Historical reconstruction and permanent audit trails.'],['Public presence','Events, activities, announcements and company updates.']].map(([t,d])=><div className="card p-6" key={t}><h3 className="font-bold text-lg">{t}</h3><p className="text-slate-500 mt-2">{d}</p></div>)}</div></div></section>
    <section id="companies" className="max-w-7xl mx-auto px-5 py-20"><p className="text-[#f35a02] font-bold">MEMBER COMPANIES</p><h2 className="text-3xl font-black text-[#00194C] mt-2">Our companies</h2>{companies.length?<div className="grid md:grid-cols-3 gap-5 mt-8">{companies.map(c=><Link to={'/company/'+c.slug} key={c.id} className="card p-6 hover:-translate-y-1 transition"><div className="h-14 w-14 rounded-xl grid place-items-center text-white font-black" style={{background:c.primary_color}}>{c.name.slice(0,1)}</div><h3 className="font-bold text-lg mt-5">{c.name}</h3><p className="text-slate-500 mt-2 line-clamp-2">{c.description||'ASOMAC member company'}</p><span className="inline-block mt-5 text-[#f35a02] font-semibold">View company →</span></Link>)}</div>:<div className="card p-8 mt-8 text-slate-500">Member companies will appear here once they are registered and published.</div>}</section>
    <section id="contact" className="bg-[#00194C] text-white"><div className="max-w-7xl mx-auto px-5 py-16 flex flex-col md:flex-row justify-between gap-8"><div><h2 className="text-3xl font-black">Ready to join ASOMAC?</h2><p className="text-blue-100 mt-2">Create an account or contact the administration team.</p></div><div className="flex gap-3"><Link to="/register" className="rounded-xl bg-[#f35a02] px-6 py-3 font-bold">Sign Up</Link><Link to="/login" className="rounded-xl border border-white/30 px-6 py-3 font-bold">Login</Link></div></div></section>
  </div>
}