import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MagazineIcon, GoogleIcon } from '../components/Icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // If the auth state is determined and a user exists, redirect them away.
    if (!authLoading && user) {
      navigate('/templates', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else navigate('/templates');
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    // Construct the redirect URL by taking the current URL and removing any hash fragment.
    // This is more robust for deployments in subdirectories (like GitHub Pages).
    const redirectTo = window.location.href.split('#')[0];

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  // While checking auth status or if a user is already logged in, show a loading state.
  if (authLoading || user) {
    return (
       <div className="min-h-screen bg-slate-900 flex items-center justify-center">
         <div className="text-white">טוען...</div>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <MagazineIcon className="w-12 h-12 mx-auto text-blue-500" />
          <h1 className="text-3xl font-bold text-white mt-4">איחולן</h1>
          <p className="text-slate-400">התחבר כדי לשמור את העיצובים שלך</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 font-semibold py-2.5 px-4 rounded-lg transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            <GoogleIcon className="w-5 h-5" />
            התחבר עם גוגל
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-600"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-sm">או</span>
            <div className="flex-grow border-t border-slate-600"></div>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="אימייל"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
              dir="ltr"
              required
            />
            <input
              type="password"
              placeholder="סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
              dir="ltr"
              required
            />
            {error && <p className="text-red-400 text-sm pt-2 text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'טוען...' : 'התחבר עם אימייל'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;