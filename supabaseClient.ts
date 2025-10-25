import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// IMPORTANT: Replace with your Supabase project URL and Anon Key.
// You can get these from your Supabase project settings.
// In a real-world app, these would be environment variables.
const supabaseUrl = 'https://dimfitabwerbszmocvgm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbWZpdGFid2VyYnN6bW9jdmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMjA4OTMsImV4cCI6MjA3NTg5Njg5M30.E8Yd4Iaz6yoQZBTgICKDEF8cWFsDch_YBbxtN77Dq3w';

// Fix: Removed the configuration check. Since the URL and key are hardcoded,
// the comparison to placeholder strings was causing a TypeScript error.
// This check is useful during setup but can be removed once configured.
if (!supabaseUrl || !supabaseAnonKey) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.backgroundColor = 'red';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '10px';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.zIndex = '1000';
    errorDiv.innerText = "Supabase client not configured. Please add your project URL and Anon Key to supabaseClient.ts";
    document.body.prepend(errorDiv);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/*
ONE-TIME SUPABASE SETUP:

*/