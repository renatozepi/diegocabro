// supabaseClient.js
(() => {
  const URL = "https://krzatkarucysnhoeyipt.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyemF0a2FydWN5c25ob2V5aXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MjQxMTMsImV4cCI6MjA3NzIwMDExM30.4SxY8dIKlPSY2LBP-3dtj4f3aOWWiphGK3uR9ZA487g";
  // Requiere que el CDN de @supabase/supabase-js esté cargado antes.
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Carga primero el CDN de supabase-js v2.");
    return;
  }
  // Sobrescribimos con el cliente para usar `supabase.*` en el resto del código.
  window.supabase = window.supabase.createClient(URL, KEY);
})();
