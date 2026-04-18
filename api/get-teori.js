export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = '346efe1d1acf801c9123ea7b5549ed05';

  try {
    let all = [];
    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const body = {
        page_size: 100,
        sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
      };
      if (cursor) body.start_cursor = cursor;

      const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const err = await r.json();
        return res.status(500).json({ error: err.message || 'Notion error' });
      }

      const data = await r.json();
      all = all.concat(data.results);
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    const teori = all.map(p => {
      const props = p.properties;

      const getText = (field) => {
        const f = props[field];
        if (!f) return '';
        if (f.type === 'title') return (f.title || []).map(t => t.plain_text).join('');
        if (f.type === 'rich_text') return (f.rich_text || []).map(t => t.plain_text).join('');
        return '';
      };

      const getSelect = (field) => {
        const f = props[field];
        return f && f.select ? f.select.name : '';
      };

      const getMultiSelect = (field) => {
        const f = props[field];
        return f && f.multi_select ? f.multi_select.map(s => s.name) : [];
      };

      const getUrl = (field) => {
        const f = props[field];
        return f && f.url ? f.url : '';
      };

      const getCheckbox = (field) => {
        const f = props[field];
        return f && f.checkbox === true;
      };

      return {
        id: p.id,
        nama_teori: getText('Nama Teori'),
        kutipan: getText('Kutipan'),
        sumber: getText('Sumber'),
        link_drive: getUrl('Link Drive'),
        tab: getSelect('Tab'),
        kategori: getSelect('Kategori'),
        tags: getMultiSelect('Tags'),
        is_new: getCheckbox('Is_New'),
      };
    }).filter(t => t.nama_teori);

    // Kumpulkan bidang unik dari tab Variabel (untuk filter chip dinamis)
    const bidang = [...new Set(
      teori.filter(t => t.tab === 'Variabel').map(t => t.kategori).filter(Boolean)
    )];

    return res.status(200).json({ teori, bidang });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
