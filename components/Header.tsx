
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MagazineIcon } from './Icons';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';

const Header: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-white">
            <MagazineIcon className="w-8 h-8 text-blue-500" />
            <span>איחולן</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-slate-400">{user.email}</span>
                <button 
                  onClick={handleLogout}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  התנתק
                </button>
              </>
            ) : (
              <Link to="/auth" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                התחבר
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
