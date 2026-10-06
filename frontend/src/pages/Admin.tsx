import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
type Role={code:string;name:string;scope:string};
export default function Admin(){
 const [profile,setProfile]=useState<any>(null); const [roles,setRoles]=useState<Role[]>([]); const [companies,setCompanies]=useState<any[]>([]); const [loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser(); if(!user){setLoading(false);return}
   const [p,r,c]=await Promise.all([
    supabase.from('profiles').select('full_name,email,phone,status').eq('id',user.id).maybeSingle(),
    supabase.from('user_roles').select('roles(code,name,scope)').eq('user_id',user.id).is('ended_at',null),
    supabase.from('companies').select('id,name,status,slug,primary_color,secondary_color,public_page_enabled').order('name')
   ]);
   setProfile(p.data); setRoles((r.data||[]).map((x:any)=>x.roles).filter(Boolean)); setCompanies(c.data||[]); setLoading(false);
 })()},[]);
 if(loading)return <div className="p-10">Loading administration…</div>;
 return <div>
   <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="text-[#f35a02] font-bold text-sm">ADMINISTRATION</p><h1 className="text-3xl font-black text-[#00194C] mt-1">Platform control centre</h1><p className="text-slate-500 mt-2">Governance starts here. Operational access remains permission-controlled.</p></div><span className="rounded-full bg-green-100 text-green-700 px-4 py-2 text-sm font-semibold">Secure session</span></div>
   <div className="grid lg:grid-cols-3 gap-5 mt-8">
    <div className="card p-6"><p className="text-sm text-slate-500">Signed-in administrator</p><h2 className="text-xl font-bold mt-2">{profile?.full_name||'User'}</h2><p className="text-slate-500">{profile?.email||'—'}</p><div className="mt-5 flex flex-wrap gap-2">{roles.length?roles.map(r=><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold" key={r.code}>{r.name}</span>):<span className="text-sm text-red-600">No administrator role assigned yet.</span>}</div></div>
    <div className="card p-6"><p className="text-sm text-slate-500">Member companies</p><p className="text-4xl font-black text-[#00194C] mt-2">{companies.length}</p><p className="text-sm text-slate-500 mt-2">Companies visible to this administrator</p></div>
    <div className="card p-6"><p className="text-sm text-slate-500">Governance model</p><p className="font-bold mt-2">Multi-tenant + RLS</p><p className="text-sm text-slate-500 mt-2">Database policies enforce boundaries instead of relying only on the interface.</p></div>
   </div>
   <div className="card mt-6 overflow-auto"><div className="p-6 border-b"><h2 className="font-bold text-lg">Companies</h2><p className="text-sm text-slate-500 mt-1">Next we will add create, edit, branding and administrator assignment workflows.</p></div><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-4">Company</th><th>Status</th><th>Public page</th><th>Brand</th></tr></thead><tbody>{companies.map(c=><tr className="border-b" key={c.id}><td className="p-4 font-semibold">{c.name}</td><td>{c.status}</td><td>{c.public_page_enabled?'Enabled':'Disabled'}</td><td><span className="inline-block h-5 w-5 rounded-full align-middle mr-2 border" style={{background:c.primary_color}}></span>{c.primary_color}</td></tr>)}</tbody></table>{!companies.length&&<p className="p-6 text-slate-500">No companies have been created yet.</p>}</div>
 </div>;
}