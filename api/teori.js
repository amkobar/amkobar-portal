export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = '346efe1d1acf801c9123ea7b5549ed05';

  // ===== GET: ambil semua teori =====
  if (req.method === 'GET') {
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

        return {
          id: p.id,
          nama_teori: getText('Nama Teori'),
          kutipan: getText('Kutipan'),
          sumber: getText('Sumber'),
          link_drive: props['Link Drive']?.url || '',
          tabs: (props['Tab']?.multi_select || []).map(s => s.name),
tab: (props['Tab']?.multi_select || [])[0]?.name || '',
          kategori: props['Kategori']?.select?.name || '',
          tags: (props['Tags']?.multi_select || []).map(s => s.name),
          is_new: props['Is_New']?.checkbox === true,
        };
      }).filter(t => t.nama_teori);

      const bidang = [...new Set(
        teori.filter(t => t.tab === 'Variabel').map(t => t.kategori).filter(Boolean)
      )];

      return res.status(200).json({ teori, bidang });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== POST: add / update / delete =====
  if (req.method === 'POST') {
    try {
      const { action, page_id, nama_teori, kutipan, sumber, link_drive, tab, kategori, tags, is_new } = req.body;

      // --- TAMBAH ---
      if (action === 'tambah') {
        if (!nama_teori || !tab || !kategori) {
          return res.status(400).json({ error: 'nama_teori, tab, dan kategori wajib diisi' });
        }
        const properties = {
          'Nama Teori': { title: [{ text: { content: nama_teori } }] },
          'Kutipan': { rich_text: [{ text: { content: kutipan || '' } }] },
          'Sumber': { rich_text: [{ text: { content: sumber || '' } }] },
          'Tab': { multi_select: (Array.isArray(tab) ? tab : [tab]).filter(Boolean).map(t => ({ name: t })) },
          'Kategori': { select: { name: kategori } },
          'Tags': { multi_select: (tags || []).map(t => ({ name: t })) },
          'Is_New': { checkbox: is_new === true },
        };
        if (link_drive) properties['Link Drive'] = { url: link_drive };

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
      }

      // --- EDIT ---
      if (action === 'edit') {
        if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi' });
        const properties = {};
        if (nama_teori !== undefined) properties['Nama Teori'] = { title: [{ text: { content: nama_teori } }] };
        if (kutipan !== undefined) properties['Kutipan'] = { rich_text: [{ text: { content: kutipan } }] };
        if (sumber !== undefined) properties['Sumber'] = { rich_text: [{ text: { content: sumber } }] };
        if (link_drive !== undefined) properties['Link Drive'] = { url: link_drive || null };
        if (tab !== undefined) properties['Tab'] = { multi_select: (Array.isArray(tab) ? tab : [tab]).filter(Boolean).map(t => ({ name: t })) };
        if (kategori !== undefined) properties['Kategori'] = { select: { name: kategori } };
        if (tags !== undefined) properties['Tags'] = { multi_select: tags.map(t => ({ name: t })) };
        if (is_new !== undefined) properties['Is_New'] = { checkbox: is_new === true };

        const r = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        });
        if (!r.ok) {
          const err = await r.json();
          return res.status(500).json({ error: err.message || 'Gagal update teori' });
        }
        return res.status(200).json({ success: true });
      }

      // --- HAPUS ---
      if (action === 'hapus') {
        if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi' });
        const r = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ archived: true }),
        });
        if (!r.ok) {
          const err = await r.json();
          return res.status(500).json({ error: err.message || 'Gagal hapus teori' });
        }
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Action tidak dikenal' });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
