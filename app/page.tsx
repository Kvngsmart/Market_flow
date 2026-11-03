"use client";

import { useMemo, useState } from "react";
import ThemeToggle from "./components/theme-toggle";

type IconName = "grid" | "cart" | "box" | "chart" | "users" | "settings" | "help" | "search" | "bell" | "arrow" | "more" | "plus" | "filter" | "download" | "trend";

const sales = [
  { day: "Mon", value: 420000 },
  { day: "Tue", value: 510000 },
  { day: "Wed", value: 470000 },
  { day: "Thu", value: 635000 },
  { day: "Fri", value: 720000 },
  { day: "Sat", value: 890000 },
  { day: "Sun", value: 680000 }
];

const products = [
  { name: "Golden Penny Spaghetti 500g", sku: "GP-SPAG-500", category: "Groceries", stock: 24, sold: 86, tone: "yellow" },
  { name: "Peak Milk Sachet 60g", sku: "PEAK-MLK-60", category: "Dairy", stock: 8, sold: 72, tone: "blue" },
  { name: "Cway Table Water 75cl", sku: "CWAY-75CL", category: "Beverages", stock: 62, sold: 61, tone: "mint" },
  { name: "Power Oil 750ml", sku: "PWR-OIL-750", category: "Cooking oil", stock: 5, sold: 39, tone: "orange" }
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    cart: <><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.5L21 8H6"/></>,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 3-4 3 2 5-7"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.42 1.42-.06-.06A1.7 1.7 0 0 0 16.44 18a1.7 1.7 0 0 0-1 .98V19a1.7 1.7 0 0 0-1.7 1.7V21h-2v-.3A1.7 1.7 0 0 0 10 19a1.7 1.7 0 0 0-1-.98 1.7 1.7 0 0 0-1.88.34l-.06.06-1.42-1.42.06-.06A1.7 1.7 0 0 0 6 15.06a1.7 1.7 0 0 0-.98-1H5a1.7 1.7 0 0 0-1.7-1.7H3v-2h.3A1.7 1.7 0 0 0 5 9.4a1.7 1.7 0 0 0-.34-1.88L4.6 7.46l1.42-1.42.06.06A1.7 1.7 0 0 0 7.94 6a1.7 1.7 0 0 0 1-.98V5a1.7 1.7 0 0 0 1.7-1.7V3h2v.3A1.7 1.7 0 0 0 14 5a1.7 1.7 0 0 0 1 .98 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.42 1.42-.06.06A1.7 1.7 0 0 0 18 8.94a1.7 1.7 0 0 0 .98 1H19a1.7 1.7 0 0 0 1.7 1.7h.3v2h-.3A1.7 1.7 0 0 0 19.4 15Z"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.2 1.6c-.9.9-1.9 1.3-1.9 2.7M12 17h.01"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></>,
    trend: <><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/></>
  };
  return <svg {...common} aria-hidden="true">{paths[name]}</svg>;
}

const currency = (value: number) => `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(value)}`;

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [period, setPeriod] = useState("This week");
  const [query, setQuery] = useState("");
  const [showMore, setShowMore] = useState(false);

  const filteredProducts = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()) || product.sku.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></div>
        <div className="workspace-switcher"><div className="workspace-avatar">S</div><div><strong>Sunrise Mart</strong><span>Retail workspace</span></div><span className="chevron">⌄</span></div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="Primary navigation">
          {[{ name: "Overview", icon: "grid" }, { name: "Point of sale", icon: "cart" }, { name: "Inventory", icon: "box" }, { name: "Analytics", icon: "chart" }, { name: "Customers", icon: "users" }].map((item) => <button key={item.name} className={`nav-item ${active === item.name ? "active" : ""}`} onClick={() => item.name === "Point of sale" ? window.location.assign("/pos") : setActive(item.name)}><Icon name={item.icon as IconName}/><span>{item.name}</span>{item.name === "Inventory" && <span className="nav-badge">4</span>}</button>)}
        </nav>
        <div className="nav-label nav-label-bottom">Manage</div>
        <nav className="nav-list"><button className="nav-item" onClick={() => setActive("Team & roles")}><Icon name="users"/><span>Team & roles</span></button><button className="nav-item" onClick={() => setActive("Settings")}><Icon name="settings"/><span>Settings</span></button></nav>
        <div className="sidebar-footer"><button className="help-link"><Icon name="help"/><span>Help center</span></button><div className="plan-card"><div className="plan-top"><span className="status-dot"></span><span>Business plan</span><span className="plan-pill">Active</span></div><p>Renewal on 08 Dec 2026</p><button>Manage plan <Icon name="arrow" size={14}/></button></div><div className="profile-row"><div className="profile-avatar">AO</div><div><strong>Amaka Okafor</strong><span>Owner</span></div><button className="profile-more"><Icon name="more"/></button></div></div>
      </aside>
      <section className="main-area">
        <header className="topbar"><div className="mobile-brand brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></div><div className="topbar-search"><Icon name="search" size={17}/><input aria-label="Search workspace" placeholder="Search anything"/></div><div className="topbar-actions"><ThemeToggle/><button className="icon-button"><Icon name="help"/></button><button className="icon-button notification"><Icon name="bell"/><span></span></button><div className="topbar-divider"></div><div className="topbar-user"><div className="profile-avatar small">AO</div><span>Amaka</span><span className="chevron">⌄</span></div></div></header>
        <div className="content">
          <div className="page-heading"><div><p className="eyebrow">Tuesday, 03 November 2026</p><h1>Good morning, Amaka <span className="wave">✦</span></h1><p className="muted">Here&apos;s what&apos;s happening with your business today.</p></div><div className="heading-actions"><button className="secondary-button"><Icon name="download" size={16}/> Export report</button><button className="primary-button" onClick={() => window.location.assign("/pos")}><Icon name="plus" size={17}/> New sale</button></div></div>
          <div className="summary-grid"><SummaryCard label="Total sales" value="₦4,325,600" detail="12.8%" detailText="vs last week" positive icon="₦"/><SummaryCard label="Transactions" value="284" detail="8.4%" detailText="vs last week" positive icon="↗"/><SummaryCard label="Average order value" value="₦15,231" detail="3.2%" detailText="vs last week" positive icon="⌁"/><SummaryCard label="Low stock items" value="4" detail="Needs attention" detailText="in your inventory" icon="!" warning/></div>
          <div className="dashboard-grid"><section className="panel sales-panel"><div className="panel-heading"><div><h2>Sales overview</h2><p className="muted">Track your revenue performance over time</p></div><div className="panel-controls"><div className="segmented"><button className="selected">Sales</button><button>Orders</button></div><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Sales period"><option>This week</option><option>This month</option><option>This quarter</option></select></div></div><div className="chart-wrap"><div className="chart-y-labels"><span>₦1m</span><span>₦750k</span><span>₦500k</span><span>₦250k</span><span>₦0</span></div><div className="chart"><div className="chart-grid-lines"><i></i><i></i><i></i><i></i><i></i></div><svg viewBox="0 0 700 230" preserveAspectRatio="none" className="chart-svg" aria-label="Sales trend chart"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7c5cff" stopOpacity=".20"/><stop offset="1" stopColor="#7c5cff" stopOpacity="0"/></linearGradient></defs><path d="M0 150 C35 142 50 132 75 143 S117 151 145 116 S185 140 215 121 S265 106 290 120 S320 95 360 93 S401 112 430 90 S475 69 505 81 S544 76 575 53 S618 39 650 50 S680 20 700 17 V230 H0Z" fill="url(#fill)"/><path d="M0 150 C35 142 50 132 75 143 S117 151 145 116 S185 140 215 121 S265 106 290 120 S320 95 360 93 S401 112 430 90 S475 69 505 81 S544 76 575 53 S618 39 650 50 S680 20 700 17" fill="none" stroke="#7658ec" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x-labels">{sales.map((item) => <span key={item.day}>{item.day}</span>)}</div></div></div><div className="chart-footer"><span><i className="legend-dot"></i> Revenue</span><span className="chart-insight"><Icon name="trend" size={15}/> Saturday was your best day</span></div></section><section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p className="muted">Get things done faster</p></div></div><div className="quick-actions"><QuickAction icon="cart" title="Make a sale" text="Open point of sale" onClick={() => window.location.assign("/pos")}/><QuickAction icon="box" title="Add product" text="Update your catalogue" onClick={() => setActive("Inventory")}/><QuickAction icon="users" title="Invite teammate" text="Grow your team" onClick={() => setActive("Team & roles")}/><QuickAction icon="chart" title="View reports" text="Understand your numbers" onClick={() => setActive("Analytics")}/></div><div className="tip-card"><div className="tip-icon">✦</div><div><strong>Make smarter decisions</strong><p>Explore your analytics to find opportunities in your sales data.</p><button onClick={() => setActive("Analytics")}>Explore analytics <Icon name="arrow" size={14}/></button></div></div></section></div>
          <div className="lower-grid"><section className="panel table-panel"><div className="panel-heading"><div><h2>Top selling products</h2><p className="muted">Your best performers this week</p></div><button className="text-button" onClick={() => setActive("Inventory")}>View all <Icon name="arrow" size={14}/></button></div><div className="table-toolbar"><div className="table-search"><Icon name="search" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products"/></div><button className="filter-button"><Icon name="filter" size={15}/> Filter</button></div><div className="product-table"><div className="table-row table-head"><span>Product</span><span>Category</span><span>In stock</span><span>Sold</span><span></span></div>{filteredProducts.map((product) => <div className="table-row" key={product.sku}><div className="product-cell"><div className={`product-thumb ${product.tone}`}></div><div><strong>{product.name}</strong><span>{product.sku}</span></div></div><span className="category-cell">{product.category}</span><span><span className={`stock ${product.stock < 10 ? "low" : ""}`}>{product.stock} units</span></span><strong>{product.sold}</strong><button className="row-more" onClick={() => setShowMore(!showMore)} aria-label={`More options for ${product.name}`}><Icon name="more"/></button></div>)}{filteredProducts.length === 0 && <div className="empty-row">No products match your search.</div>}</div></section><section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p className="muted">Latest updates from your workspace</p></div><button className="row-more" onClick={() => setShowMore(!showMore)}><Icon name="more"/></button></div><div className="activity-list"><Activity color="purple" title="Sale completed" text="Order #SM-10482 · ₦48,500" time="12 min ago"/><Activity color="green" title="Stock received" text="Golden Penny Spaghetti · 120 units" time="1 hr ago"/><Activity color="orange" title="New team member" text="Chinedu joined as Cashier" time="3 hrs ago"/><Activity color="blue" title="Refund processed" text="Order #SM-10470 · ₦12,200" time="Yesterday"/></div><button className="activity-footer">View all activity <Icon name="arrow" size={14}/></button></section></div>
          {showMore && <div className="toast"><span className="status-dot"></span> Your workspace is up to date <button onClick={() => setShowMore(false)}>×</button></div>}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value, detail, detailText, positive, warning, icon }: { label: string; value: string; detail: string; detailText: string; positive?: boolean; warning?: boolean; icon: string }) {
  return <div className="summary-card"><div className={`metric-icon ${warning ? "warning" : ""}`}>{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className={`metric-detail ${positive ? "positive" : warning ? "warning-text" : ""}`}>{positive && <span>↗</span>}{detail} <span className="metric-detail-text">{detailText}</span></div></div>;
}

function QuickAction({ icon, title, text, onClick }: { icon: IconName; title: string; text: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span className="quick-icon"><Icon name={icon}/></span><span><strong>{title}</strong><small>{text}</small></span><Icon name="arrow" size={15}/></button>;
}

function Activity({ color, title, text, time }: { color: string; title: string; text: string; time: string }) {
  return <div className="activity-item"><span className={`activity-dot ${color}`}></span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time></div>;
}
