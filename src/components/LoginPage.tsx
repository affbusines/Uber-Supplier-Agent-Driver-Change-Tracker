import React, { useState } from 'react';
import { logInWithGoogle } from '../firebase';
import { LogIn, ShieldAlert, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await logInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col items-center text-center animate-fade-in relative overflow-hidden">
        
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl translate-x-10 -translate-y-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl -translate-x-10 translate-y-10 pointer-events-none"></div>

        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-zinc-200 dark:border-zinc-700 relative z-10">
          <ShieldAlert size={32} className="text-emerald-500" />
        </div>

        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-2 relative z-10">
          Supplier Access Console
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 max-w-xs relative z-10 font-medium">
          Sign in to access your secure, isolated driver tracking environment.
        </p>

        {error && (
          <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs font-semibold mb-6 animate-shake text-left flex items-center gap-2">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full relative z-10 flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md overflow-hidden group ${
            loading 
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed' 
              : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-[1.02] active:scale-95 cursor-pointer hover:shadow-lg'
          }`}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-500 dark:border-t-zinc-400 rounded-full animate-spin"></div>
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 dark:via-black/10 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none"></span>
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
              <span>Continue with Google</span>
              <LogIn size={16} className="ml-1 opacity-50 group-hover:opacity-100 transition-opacity" />
            </>
          )}
        </button>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs font-mono text-zinc-400 dark:text-zinc-500 relative z-10">
          <Sparkles size={12} className="text-emerald-500/70" />
          <span>Multi-tenant Isolation Active</span>
        </div>
      </div>
    </div>
  );
}
