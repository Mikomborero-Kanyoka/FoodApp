import React from 'react';
import { Activity, BarChart3, Building, Search, Users, UserCog, X } from 'lucide-react';

export const inputCls =
  'w-full px-[16px] sm:px-5 py-[12px] sm:py-4 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#FFD600] outline-none font-dm text-[14px] sm:text-base text-[#0a0a0a] transition-all placeholder:text-gray-400';

export const selectCls =
  'w-full px-[16px] sm:px-5 py-[12px] sm:py-4 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#FFD600] outline-none font-syne font-bold text-[11px] sm:text-sm uppercase text-[#0a0a0a] transition-all';

export const TABS = [
  { key: 'overview', label: 'Overview', icon: <Activity size={15} /> },
  { key: 'branches', label: 'Branches', icon: <Building size={15} /> },
  { key: 'customers', label: 'Customers', icon: <Users size={15} /> },
  { key: 'employees', label: 'Employees', icon: <UserCog size={15} /> },
  { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
];

export function ensureAdminDashboardStyles() {
  if (document.querySelector('[data-ad-fonts]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-ad-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-ad-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }
    @keyframes ad-fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ad-scaleIn { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
    .anim-1 { animation: ad-fadeUp .45s .00s cubic-bezier(.22,1,.36,1) both; }
    .anim-2 { animation: ad-fadeUp .45s .08s cubic-bezier(.22,1,.36,1) both; }
    .anim-3 { animation: ad-fadeUp .45s .16s cubic-bezier(.22,1,.36,1) both; }
    .anim-4 { animation: ad-fadeUp .45s .24s cubic-bezier(.22,1,.36,1) both; }
    .modal-in { animation: ad-scaleIn .24s cubic-bezier(.22,1,.36,1) both; }
    .lift-card { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
    .lift-card:hover { transform: translateY(-3px); box-shadow: 0 16px 36px rgba(0,0,0,.08); }
    .tab-pill { transition: background .2s ease, color .2s ease, transform .18s ease; }
    .tab-pill:active { transform: scale(.98); }
  `;
  document.head.appendChild(style);
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="relative block w-full">
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        className={`${inputCls} pl-11`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Modal({ onClose, title, icon, children, maxWidthCls = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[110]">
      <div className={`modal-in bg-white rounded-[28px] sm:rounded-[36px] shadow-2xl w-full ${maxWidthCls} border border-black/[0.06] overflow-hidden max-h-[92vh]`}>
        <div className="bg-[#0a0a0a] px-5 sm:px-7 py-5 sm:py-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-[#FFD600] flex items-center justify-center shrink-0">
              {icon}
            </div>
            <h2 className="font-syne text-[16px] sm:text-[20px] font-extrabold text-white truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 sm:px-7 py-5 sm:py-7 overflow-y-auto max-h-[78vh]">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({ icon, label, value, detail, accent = 'yellow' }) {
  const accents = {
    yellow: { stripe: 'from-[#FFD600] to-[#FFF2A6]', icon: 'bg-[#FFD600] text-[#0a0a0a]', value: 'text-[#0a0a0a]' },
    slate: { stripe: 'from-[#0a0a0a] to-[#445069]', icon: 'bg-[#0a0a0a] text-white', value: 'text-[#0a0a0a]' },
    green: { stripe: 'from-[#2dbd72] to-[#bff1d0]', icon: 'bg-[#dff8e8] text-[#15803d]', value: 'text-[#0a0a0a]' },
    blue: { stripe: 'from-[#3b82f6] to-[#dbeafe]', icon: 'bg-[#dbeafe] text-[#1d4ed8]', value: 'text-[#0a0a0a]' },
    rose: { stripe: 'from-[#fb7185] to-[#ffe4e6]', icon: 'bg-[#ffe4e6] text-[#be123c]', value: 'text-[#0a0a0a]' },
  };

  const palette = accents[accent] || accents.yellow;

  return (
    <div className="lift-card bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${palette.stripe}`} />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="font-syne text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{label}</p>
            <p className={`font-syne text-[24px] sm:text-[30px] font-black leading-none ${palette.value}`}>{value}</p>
          </div>
          <div className={`w-11 sm:w-12 h-11 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 ${palette.icon}`}>{icon}</div>
        </div>
        <p className="font-dm text-[11px] sm:text-[13px] text-gray-500 mt-4 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

export function VerticalBars({ rows, valueFormatter = (value) => value, accentClass = 'bg-gradient-to-t from-[#FFD600] to-[#FFF2A6]' }) {
  const maxValue = Math.max(...rows.map((row) => Number(row.value || 0)), 1);

  return (
    <div className="h-[230px] flex items-end gap-3">
      {rows.map((row) => {
        const value = Number(row.value || 0);
        const height = value > 0 ? Math.max((value / maxValue) * 100, 12) : 6;

        return (
          <div key={row.label} className="flex-1 h-full flex flex-col items-center justify-end gap-2">
            <span className="font-syne text-[9px] sm:text-[10px] font-bold text-[#0a0a0a]">{valueFormatter(value)}</span>
            <div className="w-full h-[150px] bg-gray-100 rounded-[22px] border border-black/[0.04] flex items-end overflow-hidden">
              <div className={`w-full rounded-[22px] ${accentClass}`} style={{ height: `${height}%` }} />
            </div>
            <span className="font-dm text-[10px] sm:text-[11px] text-gray-500 text-center">{row.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HorizontalBars({ rows, valueFormatter = (value) => value, accentClass = 'bg-[#0a0a0a]' }) {
  const maxValue = Math.max(...rows.map((row) => Number(row.value || 0)), 1);

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const value = Number(row.value || 0);
        const width = value > 0 ? Math.max((value / maxValue) * 100, 6) : 0;

        return (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-syne text-[12px] sm:text-[13px] font-extrabold text-[#0a0a0a] truncate">{row.label}</p>
                {row.meta ? <p className="font-dm text-[10px] sm:text-[11px] text-gray-400 mt-0.5">{row.meta}</p> : null}
              </div>
              <span className="font-syne text-[11px] sm:text-[12px] font-black text-[#0a0a0a] shrink-0">{valueFormatter(value)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-black/[0.03]">
              <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyPanel({ title, description, action }) {
  return (
    <div className="bg-white rounded-3xl border border-dashed border-gray-200 px-6 sm:px-8 py-12 sm:py-16 text-center">
      <p className="font-syne text-[12px] sm:text-[14px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
      <p className="font-dm text-[13px] sm:text-[14px] text-gray-500 mt-3 leading-relaxed max-w-md mx-auto">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
