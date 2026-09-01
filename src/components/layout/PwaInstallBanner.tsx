import React, { useState } from 'react';
import { Download, X, Sparkles, Smartphone, Check } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export function PwaInstallBanner() {
  const { isInstallable, promptInstall, dismissPrompt } = usePwaInstall();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isInstallable) return null;

  const handleInstall = async () => {
    setIsInstalling(true);
    await promptInstall();
    setIsInstalling(false);
  };

  return (
    <div
      id="pwa-install-banner"
      className="fixed top-18 sm:top-20 left-4 right-4 max-w-md mx-auto z-40 bg-slate-900 text-white rounded-2xl p-3.5 shadow-xl border border-slate-700/80 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 p-0.5 shrink-0 flex items-center justify-center shadow-xs">
          <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs text-white truncate">Install ShareHub App</span>
            <span className="text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
              PWA
            </span>
          </div>
          <p className="text-[11px] text-slate-300 truncate">
            Fast offline access & instant appliance unlock
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleInstall}
          disabled={isInstalling}
          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isInstalling ? 'Installing...' : 'Install'}</span>
        </button>
        <button
          type="button"
          onClick={dismissPrompt}
          aria-label="Dismiss banner"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default PwaInstallBanner;
