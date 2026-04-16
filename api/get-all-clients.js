export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID;
  if (!NOTION_TOKEN || !NOTION_DB_ID) {
    return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });
  }

  const getText = p => {
    if (!p) return null;
    if (p.type === 'title') return p.title?.[0]?.plain_text || null;
    if (p.type === 'rich_text') return p.rich_text?.[0]?.plain_text || null;
    return null;
  };
  const getSelect = p => p?.select?.name || null;
  const getFormula = p => {
    if (!p || p.type !== 'formula') return null;
    const f = p.formula;
    if (f?.type === 'number') return f.number;
    if (f?.type === 'string') return f.string;
    return null;
  };
  const getRollup = p => {
    if (!p || p.type !== 'rollup') return null;
    const r = p.rollup;
    if (r?.type === 'number') return r.number;
    if (r?.type === 'array' && r.array?.length > 0) {
      const first = r.array[0];
      if (first.type === 'number') return first.number;
      if (first.type === 'rich_text') return first.rich_text?.[0]?.plain_text || null;
      if (first.type === 'formula') return first.formula?.number ?? first.formula?.string ?? null;
      if (first.type === 'select') return first.select?.name || null;
      if (first.type === 'title') return first.title?.[0]?.plain_text || null;
    }
    return null;
  };
  const getDate = p => p?.date?.start || null;

  try {
    let allClients = [];
    let hasMore = true;
    let startCursor = undefined;

    // Loop pagination sampai semua data termuat
    while (hasMore) {
      const body = {
        page_size: 100,
        sorts: [{ property: 'Dibuat', direction: 'descending' }]
      };
      if (startCursor) body.start_cursor = startCursor;

      const response = await fetch(
        `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();
      if (!response.ok) {
        return res.status(500).json({ error: `Notion error: ${response.status}` });
      }

      const clients = (data.results || []).map(page => {
        const props = page.properties;
        return {
          nama: getText(props['Nama Client']),
          kode_akses: getFormula(props['Kode Akses']),
          universitas: getSelect(props['Universitas']),
          jenis_layanan: getSelect(props['Jenis Layanan']),
          aplikasi: getRollup(props['Aplikasi']) || getSelect(props['Aplikasi']),
          status_project: getSelect(props['Status Project']),
          deadline: getDate(props['Deadline']),
        };
      });

      allClients = allClients.concat(clients);
      hasMore = data.has_more || false;
      startCursor = data.next_cursor || undefined;
    }

    return res.status(200).json(allClients);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
