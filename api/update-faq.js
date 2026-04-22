export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const FAQ_DB_ID = '344efe1d1acf80e8b53cec779a8832ee';

  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  const { action, id, pertanyaan, jawaban, kategori, urutan, aplikasi } = req.body;

  try {
    // TAMBAH — buat halaman baru di Notion
    if (action === 'tambah') {
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: FAQ_DB_ID },
          properties: {
            'Pertanyaan': { title: [{ text: { content: pertanyaan || '' } }] },
            'Jawaban': { rich_text: [{ text: { content: jawaban || '' } }] },
            'Kategori': { select: { name: kategori || 'Publik' } },
            'Urutan': { number: urutan || 0 },
            'Aktif': { checkbox: true },
'Aplikasi': { select: { name: aplikasi || 'Semua' } }
          }
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status}` });
      return res.status(200).json({ success: true, id: data.id });
    }

    // EDIT — update halaman yang sudah ada
    if (action === 'edit') {
      if (!id) return res.status(400).json({ error: 'ID diperlukan untuk edit.' });
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            'Pertanyaan': { title: [{ text: { content: pertanyaan || '' } }] },
            'Jawaban': { rich_text: [{ text: { content: jawaban || '' } }] },
            'Kategori': { select: { name: kategori || 'Publik' } },
            'Urutan': { number: urutan || 0 },
'Aplikasi': { select: { name: aplikasi || 'Semua' } }
          }
        })
      });
      if (!response.ok) {
        const data = await response.json();
        return res.status(500).json({ error: `Notion error: ${response.status}` });
      }
      return res.status(200).json({ success: true });
    }

    // HAPUS — archive halaman (soft delete)
    if (action === 'hapus') {
      if (!id) return res.status(400).json({ error: 'ID diperlukan untuk hapus.' });
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true })
      });
      if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status}` });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Action tidak valid. Gunakan: tambah, edit, atau hapus.' });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
