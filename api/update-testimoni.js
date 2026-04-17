export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  const { action, page_id, tampil, nama, rating, teks } = req.body || {};

  if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi.' });

  try {
    let properties = {};

    if (action === 'toggle_tampil') {
      if (typeof tampil !== 'boolean') return res.status(400).json({ error: 'tampil harus boolean.' });
      properties['Testimoni_Tampil'] = { checkbox: tampil };

    } else if (action === 'edit') {
      if (!nama || !teks) return res.status(400).json({ error: 'nama dan teks wajib diisi.' });
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating harus antara 1-5.' });
      properties['Nama Client'] = { title: [{ text: { content: nama } }] };
      properties['Testimoni_Teks'] = { rich_text: [{ text: { content: teks } }] };
      properties['Rating'] = { number: rating };

    } else {
      return res.status(400).json({ error: 'action tidak dikenal. Gunakan toggle_tampil atau edit.' });
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties })
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
