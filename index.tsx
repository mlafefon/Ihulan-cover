import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './AuthContext';
import { supabase } from './supabaseClient';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Let Supabase handle the auth redirect first, before the router initializes.
// This prevents the HashRouter from clearing the auth token from the URL hash
// before the Supabase client can process it.
supabase.auth.getSession().finally(() => {
  root.render(
    <React.StrictMode>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </React.StrictMode>
  );
});
