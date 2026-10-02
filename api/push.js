// Vercel serverless function: POST /api/push  { ws, ids }  with  Authorization: Bearer <supabase access token>
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { sendPushes, HttpError } from './_push-core.js';
import { VAPID_PUBLIC_KEY } from '../push-config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !privateKey) {
    return res.status(503).json({ error: 'Push is not configured. Add SUPABASE_SERVICE_ROLE_KEY and VAPID_PRIVATE_KEY in Vercel.' });
  }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:alerts@example.com', process.env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY, privateKey);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const out = await sendPushes({ token, ws: body.ws, ids: body.ids }, { admin, push: webpush });
    return res.status(200).json(out);
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Could not send alerts.' });
  }
}
