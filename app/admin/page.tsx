"use client";

import Link from "next/link";
import ThemeToggle from "../components/theme-toggle";

const businesses = [
  { name: "Sunrise Mart", owner: "Amaka Okafor", plan: "Business", status: "Active", revenue: "₦15,000" },
  { name: "Adebayo Pharmacy", owner: "Tunde Adebayo", plan: "Enterprise", status: "Active", revenue: "₦35,000" },
  { name: "Daily Basket", owner: "Chioma Eze", plan: "Starter", status: "Trial", revenue: "₦0" },
  { name: "The Corner Shop", owner: "Musa Bello", plan: "Business", status: "Past due", revenue: "₦15,000" }
];

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></Link>
        <div className="admin-context"><span className="admin-context-dot"></span><div><strong>Platform admin</strong><small>Operations console</small></div></div>
        <p className="admin-label">Control center</p>
        <nav className="admin-nav"><a className="admin-nav-active" href="#overview">Overview</a><a href="#businesses">Businesses <span>24</span></a><a href="#subscriptions">Subscriptions</a><a href="#plans">Plans & pricing</a><a href="#support">Support cases</a><a href="#audit">Audit log</a></nav>
        <div className="admin-bottom"><Link href="/">← Back to merchant view</Link><div className="admin-profile"><div className="profile-avatar">AO</div><div><strong>Amaka Okafor</strong><small>Platform owner</small></div></div></div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><span className="eyebrow">Tuesday, 03 November 2026</span><h1>Platform overview</h1></div><div className="admin-top-actions"><ThemeToggle/><span className="admin-live"><i></i> All systems operational</span><button className="admin-avatar">AO</button></div></header>
        <div className="admin-content">
          <div className="admin-intro"><div><h2>Good morning, Amaka</h2><p>Here&apos;s how MarketFlow is performing across all merchant workspaces.</p></div><button className="secondary-button">Download report</button></div>
          <div className="admin-kpis"><AdminKpi label="Monthly recurring revenue" value="₦8.42m" change="18.4%"/><AdminKpi label="Active businesses" value="1,284" change="12.6%"/><AdminKpi label="Active subscriptions" value="1,167" change="9.8%"/><AdminKpi label="Trial accounts" value="117" change="6.2%"/></div>
          <div className="admin-columns"><section className="admin-panel growth-panel"><div className="admin-panel-heading"><div><h3>Registration growth</h3><p>New businesses over the last 30 days</p></div><select aria-label="Registration period"><option>Last 30 days</option><option>Last 90 days</option></select></div><div className="admin-chart"><div className="admin-chart-y"><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span></div><div className="admin-chart-area"><div className="admin-lines"><i></i><i></i><i></i><i></i><i></i></div><svg viewBox="0 0 700 210" preserveAspectRatio="none"><defs><linearGradient id="adminFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#54c7a3" stopOpacity=".24"/><stop offset="1" stopColor="#54c7a3" stopOpacity="0"/></linearGradient></defs><path d="M0 176 C42 170 60 160 87 166 S130 142 160 150 S198 140 230 146 S274 118 305 125 S342 108 375 112 S412 87 447 98 S487 72 520 81 S562 64 590 70 S630 39 663 46 S685 26 700 24 V210 H0Z" fill="url(#adminFill)"/><path d="M0 176 C42 170 60 160 87 166 S130 142 160 150 S198 140 230 146 S274 118 305 125 S342 108 375 112 S412 87 447 98 S487 72 520 81 S562 64 590 70 S630 39 663 46 S685 26 700 24" fill="none" stroke="#43b58d" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div className="admin-chart-x"><span>05 Oct</span><span>12 Oct</span><span>19 Oct</span><span>26 Oct</span><span>03 Nov</span></div></div></div><div className="admin-chart-foot"><span><i></i> New registrations</span><strong>+18.4% this period</strong></div></section><section className="admin-panel plans-panel" id="plans"><div className="admin-panel-heading"><div><h3>Plan distribution</h3><p>Current active subscriptions</p></div></div><div className="donut-wrap"><div className="donut"><div><strong>1,167</strong><small>subscriptions</small></div></div><div className="donut-legend"><span><i className="starter"></i>Starter <b>402</b></span><span><i className="business"></i>Business <b>583</b></span><span><i className="enterprise"></i>Enterprise <b>182</b></span></div></div></section></div>
          <section className="admin-panel business-panel" id="businesses"><div className="admin-panel-heading"><div><h3>Recent businesses</h3><p>Latest merchant workspaces on MarketFlow</p></div><button className="admin-link">View all businesses →</button></div><div className="admin-table"><div className="admin-table-row admin-table-head"><span>Business</span><span>Plan</span><span>Status</span><span>MRR</span><span></span></div>{businesses.map((business) => <div className="admin-table-row" key={business.name}><div className="admin-business"><div>{business.name.slice(0, 1)}</div><span><strong>{business.name}</strong><small>{business.owner}</small></span></div><span className="admin-plan">{business.plan}</span><span className={`admin-status ${business.status.toLowerCase().replace(" ", "-")}`}>{business.status}</span><strong>{business.revenue}</strong><button className="admin-more">•••</button></div>)}</div></section>
          <div className="admin-footer-note"><span className="admin-live"><i></i> Infrastructure healthy</span><span>Last updated just now</span></div>
        </div>
      </section>
    </main>
  );
}

function AdminKpi({ label, value, change }: { label: string; value: string; change: string }) {
  return <div className="admin-kpi"><span>{label}</span><strong>{value}</strong><small>↗ {change} <em>vs last month</em></small></div>;
}
