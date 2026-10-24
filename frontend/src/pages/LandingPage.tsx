import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './boxup-theme.css';

type Company = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
};

declare global {
  interface Window {
    WOW?: new (options?: Record<string, unknown>) => { init: () => void };
  }
}

const services = [
  { icon: '▦', title: 'Company Governance', text: 'Keep company records, leadership and public profiles organised within a secure association-wide structure.', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85' },
  { icon: '⌖', title: 'Branch Management', text: 'Coordinate branches, managers and local operations with access tailored to each organisation.', image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85' },
  { icon: '⇄', title: 'Transfers & Movements', text: 'Maintain clear records for stock, assignments and movements across branches and companies.', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=85' },
  { icon: '▤', title: 'Historical Records', text: 'Reconstruct legacy information with original dates, traceable records and accountability.', image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=85' },
  { icon: '♙', title: 'People & Assignments', text: 'Manage people, roles, assignments and movement history within the right access boundaries.', image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=85' },
  { icon: '▥', title: 'Reports & Oversight', text: 'Build a clearer operational picture with consistent information and auditable activity records.', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=85' },
];

export default function LandingPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    let active = true;
    supabase.from('companies')
      .select('id,name,slug,description,logo_url,primary_color,secondary_color')
      .eq('status', 'ACTIVE')
      .eq('public_page_enabled', true)
      .order('name')
      .then(({ data }) => { if (active) setCompanies(data || []); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % 2), 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const init = () => {
      if (window.WOW) new window.WOW({ boxClass: 'wow', animateClass: 'animated', offset: 60, mobile: true, live: true }).init();
    };
    init();
    const retry = window.setTimeout(init, 250);
    return () => window.clearTimeout(retry);
  }, []);

  const nav = <><a href="#home" onClick={() => setMenuOpen(false)}>Home</a><a href="#about" onClick={() => setMenuOpen(false)}>About</a><a href="#services" onClick={() => setMenuOpen(false)}>Services</a><a href="#companies" onClick={() => setMenuOpen(false)}>Member Companies</a><a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a></>;

  return (
    <main className="boxup-site" id="home">
      <div className="bx-topbar">
        <div className="bx-container bx-topbar-inner">
          <div className="bx-top-items"><span>Association of Motorcar and Allied Businesses</span><span>ASOMAC · Uganda</span></div>
          <div className="bx-top-items"><a href="#contact">Contact administration</a><span>Governance · Operations · Growth</span></div>
        </div>
      </div>

      <header className="bx-navbar">
        <div className="bx-container bx-nav-inner">
          <Link to="/" className="bx-brand" aria-label="ASOMAC home"><span className="bx-brand-mark">A</span><span>ASOMAC</span></Link>
          <nav className="bx-nav-links">{nav}<Link to="/login">Login</Link><Link className="bx-btn" to="/register">Join ASOMAC <span aria-hidden="true">→</span></Link></nav>
          <button className="bx-menu-toggle" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '×' : '☰'}</button>
        </div>
        {menuOpen && <nav className="bx-mobile-nav">{nav}<Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link><Link className="bx-btn" to="/register" onClick={() => setMenuOpen(false)}>Join ASOMAC →</Link></nav>}
      </header>

      <section className="bx-hero" aria-label="ASOMAC introduction">
        <div className="bx-container bx-hero-grid">
          <div key={slide} className="wow fadeInLeft" data-wow-duration="1s">
            <p className="bx-eyebrow">A connected association</p>
            <h1>{slide === 0 ? 'A stronger network. A smarter way to work.' : 'Bringing companies, branches and people together.'}</h1>
            <p>{slide === 0 ? 'One connected platform for ASOMAC governance, member companies and branch operations — designed to improve coordination, accountability and growth.' : 'Bring records, people, operations and history into one secure environment built around the structure of your association.'}</p>
            <div className="bx-hero-actions"><Link to="/register" className="bx-btn">Get started <span>→</span></Link><a href="#about" className="bx-btn bx-btn-outline">Discover ASOMAC</a></div>
          </div>
          <div className="bx-hero-art wow fadeInRight" data-wow-delay=".2s" data-wow-duration="1s">
            <img className="bx-hero-photo" src={slide === 0 ? 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85' : 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85'} alt="Professional teams collaborating in a modern workplace" />
            <div className="bx-floating-card"><strong>One connected platform</strong><span>Governance, branches and operations in one place.</span></div>
          </div>
        </div>
        <div className="bx-container" style={{display:'flex',gap:9,paddingBottom:22}} aria-label="Hero slides">
          {[0,1].map((n) => <button key={n} aria-label={'Show slide '+(n+1)} onClick={() => setSlide(n)} style={{width:n===slide?32:10,height:10,border:0,borderRadius:10,background:n===slide?'#06a3da':'#ffffff80',cursor:'pointer',transition:'width .25s'}} />)}
        </div>
      </section>

      <section id="about" className="bx-section">
        <div className="bx-container bx-about-grid">
          <div className="bx-about-image-wrap wow fadeInUp" data-wow-delay=".1s"><img className="bx-about-image" src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1100&q=85" alt="Colleagues collaborating around a table" loading="lazy" /></div>
          <div className="bx-about-copy wow fadeInUp" data-wow-delay=".25s">
            <p className="bx-eyebrow">About ASOMAC</p>
            <h2>Built around accountability, structure and growth.</h2>
            <p>ASOMAC brings its association, member companies and branch operations together through a common digital platform. Each organisation can work within its own responsibilities while leadership retains the oversight it needs.</p>
            <p>Our approach puts reliable records, clear responsibilities and traceable activity at the centre of everyday operations.</p>
            <div className="bx-check-list"><span>Structured governance</span><span>Secure access</span><span>Traceable records</span><span>Connected operations</span></div>
            <Link to="/login" className="bx-btn">Explore the platform →</Link>
          </div>
        </div>
      </section>

      <section id="services" className="bx-section bx-section-light">
        <div className="bx-container">
          <div className="bx-section-head wow fadeInUp"><p className="bx-eyebrow">What we do</p><h2>Everything connected. Every detail accountable.</h2><p>A shared foundation for association oversight, member company administration and day-to-day branch operations.</p></div>
          <div className="bx-services-grid">{services.map((service, index) => <article className="bx-service-card wow fadeInUp" data-wow-delay={`${(index % 3) * 0.12}s`} key={service.title}><img className="bx-service-image" src={service.image} alt="" loading="lazy" /><div className="bx-service-body"><div className="bx-service-icon" aria-hidden="true">{service.icon}</div><h3>{service.title}</h3><p>{service.text}</p><Link className="bx-readmore" to="/login">Learn more →</Link></div></article>)}</div>
        </div>
      </section>

      <section className="bx-feature-band bx-section">
        <div className="bx-container bx-feature-grid">
          <div className="wow fadeInLeft"><p className="bx-eyebrow">One coordinated network</p><h2>Visibility for leadership. Clarity for every team.</h2><p>ASOMAC is designed around a clear organisational hierarchy — from platform governance to company administration and branch operations. Access and responsibilities should follow the structure, while records remain traceable.</p><div className="bx-feature-points"><div className="bx-feature-point"><strong>Clear roles</strong><span>Responsibilities aligned to each level.</span></div><div className="bx-feature-point"><strong>Reliable history</strong><span>Records designed for accountability.</span></div></div></div>
          <img className="bx-feature-image wow fadeInRight" src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1100&q=85" alt="A team planning and reviewing work together" loading="lazy" />
        </div>
      </section>

      <section id="companies" className="bx-section">
        <div className="bx-container">
          <div className="bx-section-head wow fadeInUp"><p className="bx-eyebrow">Our network</p><h2>Member companies</h2><p>Discover the companies that are part of the ASOMAC network.</p></div>
          {companies.length ? <div className="bx-services-grid">{companies.map((company, index) => <Link to={'/company/' + company.slug} key={company.id} className="bx-company-card wow fadeInUp" data-wow-delay={`${(index % 3) * .1}s`}><div className="bx-company-logo" style={{background:company.primary_color || '#06a3da'}}>{company.logo_url ? <img src={company.logo_url} alt={company.name+' logo'} style={{width:'100%',height:'100%',objectFit:'contain',background:'#fff'}} loading="lazy" /> : company.name.slice(0,1).toUpperCase()}</div><h3>{company.name}</h3><p>{company.description || 'ASOMAC member company'}</p><span className="bx-readmore">View company →</span></Link>)}</div> : <div className="bx-empty wow fadeInUp">Member companies will appear here once they are registered and their public pages are enabled.</div>}
        </div>
      </section>

      <section id="contact" className="bx-cta bx-section">
        <div className="bx-container bx-cta-inner wow fadeInUp"><div><p className="bx-eyebrow">Be part of the network</p><h2>Ready to connect with ASOMAC?</h2><p>Access the platform or begin the membership process today.</p></div><div className="bx-hero-actions"><Link to="/register" className="bx-btn">Join ASOMAC →</Link><Link to="/login" className="bx-btn bx-btn-outline">Member login</Link></div></div>
      </section>

      <footer className="bx-footer">
        <div className="bx-container bx-footer-grid">
          <div><Link to="/" className="bx-brand"><span className="bx-brand-mark">A</span><span style={{color:'#fff'}}>ASOMAC</span></Link><p>Connecting the association, member companies and branch operations through stronger coordination and accountable records.</p></div>
          <div><h3>Quick links</h3><a href="#about">About ASOMAC</a><a href="#services">Our capabilities</a><a href="#companies">Member companies</a><Link to="/login">Platform login</Link></div>
          <div><h3>Platform</h3><Link to="/register">Join ASOMAC</Link><Link to="/login">Sign in</Link><a href="#contact">Contact administration</a></div>
          <div><h3>Our commitment</h3><p>Clear responsibilities, secure access, dependable information and traceable activity across the network.</p></div>
        </div>
        <div className="bx-container bx-footer-bottom"><span>© {new Date().getFullYear()} ASOMAC. All rights reserved.</span><span>Association · Companies · Branches · Operations</span></div>
      </footer>
      <button className="bx-back-top" aria-label="Back to top" onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>↑</button>
    </main>
  );
}
