
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import TemplatesPage from './pages/TemplatesPage';
import EditorPage from './pages/EditorPage';

function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-900 text-gray-200">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;