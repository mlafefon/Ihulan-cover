
import React from 'react';
import { Link } from 'react-router-dom';
import { MagazineIcon } from './Icons';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-white">
            <MagazineIcon className="w-8 h-8 text-blue-500" />
            <span>איחולן</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">admin@admin.com</span>
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center font-bold">A</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
