import {useEffect,useState,type ReactNode} from 'react';
import {Routes,Route,Link,useNavigate} from 'react-router-dom';
import {supabase} from './lib/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Transfers from './pages/Transfers';
import HistoricalEntry from './pages/HistoricalEntry';
import LandingPage from './pages/LandingPage';
import Admin from './pages/Admin';
import CompanyPage from './pages/CompanyPage';

function Shell({children}:{children:ReactNode}){
 const nav=useNavigate();
 const logout=async()=>{await supabase.auth.signOut();nav('/login')};
 return <div className="min-h-screen"><header className="bg-[#00194C] text-white"><div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between"><Link to="/dashboard" className="font-bold text-xl">ASSOMAC</Link><nav className="flex gap-4 text-sm items-center"><Link to="/dashboard">Dashboard</Link><Link to="/admin">Administration</Link><Link to="/companies">Companies</Link><Link to="/transfers">Transfers</Link><Link to="/historical">Historical Data</Link><button onClick={logout}>Sign out</button></nav></div></header><main className="max-w-7xl mx-auto p-5">{children}</main></div>
}
function Protected({children}:{children:ReactNode}){const[ready,setReady]=useState(false);const nav=useNavigate();useEffect(()=>{let active=true;supabase.auth.getSession().then(({data})=>{if(!active)return;if(!data.session)nav('/login');else setReady(true)});return()=>{active=false}},[nav]);return ready?<Shell>{children}</Shell>:<div className="p-10">Loading…</div>}
export default function App(){return <Routes><Route path="/" element={<LandingPage/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<div className="p-10 text-center"><h1 className="text-3xl font-bold">Registration</h1><p className="mt-3 text-slate-500">Registration will be connected to the controlled onboarding workflow next.</p><Link className="text-[#f35a02] inline-block mt-5" to="/login">Go to Login</Link></div>}/><Route path="/company/:slug" element={<CompanyPage/>}/><Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="/admin" element={<Protected><Admin/></Protected>}/><Route path="/companies" element={<Protected><Companies/></Protected>}/><Route path="/transfers" element={<Protected><Transfers/></Protected>}/><Route path="/historical" element={<Protected><HistoricalEntry/></Protected>}/></Routes>}
