export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = '344efe1d1acf8086abe9ec9a4993dff0';
  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  const { action, id, ids, status_penuh } = req.body;

  try {
    // Update 1 paket
    if (action === 'update_satu') {
      if (!id) return res.status(400).json({ error: 'ID diperlukan.' });
      const r = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { 'Status Penuh': { checkbox: status_penuh === true } }
        })
      });
      if (!r.ok) return res.status(500).json({ error: `Notion error: ${r.status}` });
      return res.status(200).json({ success: true });
    }

    // Update banyak paket sekaligus (toggle per aplikasi)
    if (action === 'update_banyak') {
      if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs diperlukan.' });
      const results = await Promise.all(ids.map(pageId =>
        fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: { 'Status Penuh': { checkbox: status_penuh === true } }
          })
        })
      ));
      const failed = results.filter(r => !r.ok).length;
      if (failed > 0) return res.status(500).json({ error: `${failed} paket gagal diupdate.` });
      return res.status(200).json({ success: true, updated: ids.length });
    }

    return res.status(400).json({ error: 'Action tidak valid. Gunakan: update_satu atau update_banyak.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
