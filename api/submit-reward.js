export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const GMAIL_USER = process.env.GMAIL_USER;

  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  const { page_id, nama, kode_akses, nominal, metode, nomor, nama_pemilik } = req.body || {};

  if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi.' });
  if (!metode || !nomor || !nama_pemilik) return res.status(400).json({ error: 'Metode, nomor, dan nama pemilik wajib diisi.' });

  const rekening_value = `${metode}|${nomor}|${nama_pemilik}`;
  const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' });
  const nominalFmt = nominal ? `Rp ${Number(nominal).toLocaleString('id-ID')}` : '?';

  try {
    // 1. Update Notion
    const notionRes = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          'Reward_Dicairkan': { checkbox: true },
          'Rekening_Reward': { rich_text: [{ text: { content: rekening_value } }] }
        }
      })
    });

    const notionData = await notionRes.json();
    if (!notionRes.ok) {
      return res.status(500).json({ error: `Notion error: ${notionRes.status} - ${JSON.stringify(notionData)}` });
    }

    // 2. Kirim email via Resend
    if (RESEND_API_KEY && GMAIL_USER) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'AMKOBAR Portal <onboarding@resend.dev>',
            to: [GMAIL_USER],
            subject: `[REWARD] Cairkan Referral — ${nama || kode_akses} (${nominalFmt})`,
            html: `
              <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
                <h2 style="color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
                  🎁 Reward Referral Perlu Dicairkan
                </h2>
                <table style="width:100%;border-collapse:collapse;margin-top:16px">
                  <tr><td style="padding:8px 0;color:#64748b;width:140px">Nama Client</td><td style="padding:8px 0;font-weight:500">${nama || '-'}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Kode Akses</td><td style="padding:8px 0;font-weight:500">${kode_akses || '-'}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Nominal</td><td style="padding:8px 0;font-weight:600;color:#059669">${nominalFmt}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Metode</td><td style="padding:8px 0;font-weight:500">${metode}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Nomor</td><td style="padding:8px 0;font-weight:500">${nomor}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Nama Pemilik</td><td style="padding:8px 0;font-weight:500">${nama_pemilik}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Waktu Submit</td><td style="padding:8px 0">${waktu}</td></tr>
                </table>
                <div style="margin-top:20px;padding:12px;background:#fef9c3;border-radius:8px;font-size:13px;color:#92400e">
                  ⚠️ Segera lakukan transfer ke nomor di atas dan tandai reward sebagai selesai di Notion.
                </div>
              </div>
            `
          })
        });
      } catch (emailErr) {
        console.error('Email error:', emailErr.message);
      }
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
