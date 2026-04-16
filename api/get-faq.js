export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const FAQ_DB_ID = '344efe1d1acf80e8b53cec779a8832ee';

  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${FAQ_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'Aktif', checkbox: { equals: true } },
        sorts: [
          { property: 'Kategori', direction: 'ascending' },
          { property: 'Urutan', direction: 'ascending' }
        ],
        page_size: 100
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status}` });

    const items = (data.results || []).map(page => ({
      id: page.id,
      pertanyaan: page.properties['Pertanyaan']?.title?.[0]?.plain_text || '',
      jawaban: page.properties['Jawaban']?.rich_text?.[0]?.plain_text || '',
      kategori: page.properties['Kategori']?.select?.name || '',
      urutan: page.properties['Urutan']?.number || 0,
      aktif: page.properties['Aktif']?.checkbox || false,
    }));

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
