export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  const { page_id, akses_aktif } = req.body || {};
  if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi.' });
  if (typeof akses_aktif !== 'boolean') return res.status(400).json({ error: 'akses_aktif harus boolean.' });

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          'Akses_Aktif': { checkbox: akses_aktif }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: `Notion error: ${response.status} - ${JSON.stringify(data)}` });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
