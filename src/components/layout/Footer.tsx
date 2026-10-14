import React from 'react';
import { ShieldCheck, Users, Repeat, KeyRound } from 'lucide-react';

const VALUE_PROPS = [
  {
    icon: <Users className="w-5 h-5" />,
    color: 'text-indigo-400',
    title: 'Small, friendly co-ops',
    body: 'Shared appliances are capped at a handful of households, so there is rarely a wait.',
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    color: 'text-emerald-400',
    title: 'Deposits that come back',
    body: 'We hold your payment until the item is returned, then your deposit goes straight back.',
  },
  {
    icon: <Repeat className="w-5 h-5" />,
    color: 'text-amber-400',
    title: 'Fair turns for everyone',
    body: 'Every member can see how many turns they have left each month.',
  },
  {
    icon: <KeyRound className="w-5 h-5" />,
    color: 'text-sky-400',
    title: 'Easy pickup',
    body: 'Collect with a simple code from your host, or unlock shared appliances with your own.',
  },
];

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800 text-left">
          {VALUE_PROPS.map((p) => (
            <div key={p.title} className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl bg-slate-800 ${p.color}`}>{p.icon}</div>
              <div>
                <h4 className="font-semibold text-white text-sm mb-1">{p.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{p.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            <span className="font-semibold text-slate-300">ShareHub</span> · Borrow more, buy less
          </span>
          <span>© {new Date().getFullYear()} ShareHub</span>
        </div>
      </div>
    </footer>
  );
};
