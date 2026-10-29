import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && key);
const supabase = cloudConfigured ? createClient(url, key) : null;

// ถ้า Supabase ใช้ไม่ได้ (ไม่ได้ตั้งค่า / ยังไม่เปิด Anonymous sign-in) จะ fallback ไปเก็บในเครื่อง
let cloudOk = cloudConfigured;

export const mode = () => (cloudOk ? 'cloud' : 'local');

export async function initStore() {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }
  } catch (err) {
    console.warn('Supabase auth unavailable, using local storage:', err.message);
    cloudOk = false;
  }
}

/* ---------- local fallback ---------- */
const readLocal = (name) => {
  try {
    return JSON.parse(localStorage.getItem(name) || '[]');
  } catch {
    return [];
  }
};
const writeLocal = (name, rows) => {
  try {
    localStorage.setItem(name, JSON.stringify(rows));
  } catch {
    /* storage full / blocked */
  }
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

/* ---------- analyses ---------- */
export async function listAnalyses() {
  if (cloudOk) {
    const { data, error } = await supabase.from('analyses').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data;
  }
  return readLocal('analyses').sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function saveAnalysis(row) {
  if (cloudOk) {
    const { error } = await supabase.from('analyses').insert(row);
    if (error) throw error;
    return;
  }
  writeLocal('analyses', [...readLocal('analyses'), { id: uid(), created_at: new Date().toISOString(), ...row }]);
}

export async function deleteAnalysis(id) {
  if (cloudOk) {
    const { error } = await supabase.from('analyses').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  writeLocal('analyses', readLocal('analyses').filter((r) => r.id !== id));
}

/* ---------- user-added draws ---------- */
export async function listDraws() {
  if (cloudOk) {
    const { data, error } = await supabase.from('draws').select('*').order('draw_date', { ascending: false });
    if (error) throw error;
    return data;
  }
  return readLocal('draws').sort((a, b) => b.draw_date.localeCompare(a.draw_date));
}

export async function addDraw(row) {
  if (cloudOk) {
    const { error } = await supabase.from('draws').upsert(row, { onConflict: 'user_id,draw_date' });
    if (error) throw error;
    return;
  }
  const rows = readLocal('draws').filter((r) => r.draw_date !== row.draw_date);
  writeLocal('draws', [...rows, { id: uid(), ...row }]);
}

export async function deleteDraw(id) {
  if (cloudOk) {
    const { error } = await supabase.from('draws').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  writeLocal('draws', readLocal('draws').filter((r) => r.id !== id));
}
