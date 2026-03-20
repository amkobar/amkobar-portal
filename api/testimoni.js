export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID;
  if (!NOTION_TOKEN || !NOTION_DB_ID) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          property: 'Testimoni_Selesai',
          checkbox: { equals: true }
        },
        page_size: 100
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status}` });

    const getText = p => {
      if (!p) return null;
      if (p.type === 'title') return p.title?.[0]?.plain_text || null;
      if (p.type === 'rich_text') return p.rich_text?.[0]?.plain_text || null;
      return null;
    };
    const getSelect = p => p?.select?.name || null;
    const getNumber = p => p?.number != null ? p.number : null;

    const mapLayanan = jenis => {
      if (!jenis) return null;
      if (jenis.includes('FULL') || jenis.includes('Full')) return 'Full BAB';
      if (jenis.includes('IV') && jenis.includes('V')) return 'BAB IV\u2013V';
      if (jenis.includes('IV')) return 'BAB IV';
      if (jenis.toLowerCase().includes('olahdata')) return 'Olah Data';
      return jenis;
    };

    const testimoni = (data.results || []).map(p => {
      const props = p.properties;
      const nama = getText(props['Nama Client']) || '';
      const inisial = nama.split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
      const namaShort = nama.split(' ').slice(0, 2).join(' ');
      const jenis = mapLayanan(getSelect(props['Jenis Layanan']));
      const aplikasi = getSelect(props['Aplikasi']);
      const subtitle = [jenis, aplikasi].filter(Boolean).join(' \u00b7 ');
      return {
        inisial,
        nama: namaShort,
        subtitle,
        rating: getNumber(props['Rating']) || 5,
        teks: getText(props['Testimoni_Teks']) || ''
      };
    }).filter(t => t.teks);

    return res.status(200).json(testimoni);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
