export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = '346efe1d1acf801c9123ea7b5549ed05';

  try {
    const { nama_teori, kutipan, sumber, link_drive, tab, kategori, tags, is_new } = req.body;
    if (!nama_teori || !tab || !kategori) {
      return res.status(400).json({ error: 'nama_teori, tab, dan kategori wajib diisi' });
    }

    const properties = {
      'Nama Teori': { title: [{ text: { content: nama_teori } }] },
      'Kutipan': { rich_text: [{ text: { content: kutipan || '' } }] },
      'Sumber': { rich_text: [{ text: { content: sumber || '' } }] },
      'Tab': { select: { name: tab } },
      'Kategori': { select: { name: kategori } },
      'Tags': { multi_select: (tags || []).map(t => ({ name: t })) },
      'Is_New': { checkbox: is_new === true },
    };

    if (link_drive) {
      properties['Link Drive'] = { url: link_drive };
    }

    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: DB_ID }, properties }),
    });

    if (!r.ok) {
      const err = await r.json();
      return res.status(500).json({ error: err.message || 'Gagal tambah teori' });
    }

    const data = await r.json();
    return res.status(200).json({ success: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
