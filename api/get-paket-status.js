export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = '344efe1d1acf8086abe9ec9a4993dff0';
  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  try {
    let all = [];
    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
      const body = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: `Notion error: ${r.status}` });

      const items = (data.results || []).map(page => ({
        id: page.id,
        nama: page.properties['Nama Paket']?.title?.[0]?.plain_text || '',
        aplikasi: page.properties['Aplikasi']?.select?.name || '',
        jenis_layanan: page.properties['Jenis Layanan']?.select?.name || '',
        jumlah_variabel: page.properties['Jumlah Variabel']?.select?.name || '',
        sub_kategori: page.properties['Sub Kategori']?.select?.name || '',
        harga_kerjasama: page.properties['Harga Kerjasama']?.number || 0,
        dp_kerjasama: page.properties['DP Kerjasama']?.number || 0,
        harga_umum: page.properties['Harga Umum']?.number || 0,
        dp_umum: page.properties['DP Umum']?.number || 0,
        status_penuh: page.properties['Status Penuh']?.checkbox || false,
      }));

      all = all.concat(items);
      hasMore = data.has_more || false;
      cursor = data.next_cursor || undefined;
    }

    return res.status(200).json(all);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
