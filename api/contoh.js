export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  const DB_ID = '347efe1d1acf8061a38acac87d4a1d45';

  // ===== GET: ambil semua item =====
  if (req.method === 'GET') {
    try {
      let all = [];
      let cursor = undefined;
      let hasMore = true;

      while (hasMore) {
        const body = {
          page_size: 100,
          sorts: [{ property: 'Urutan', direction: 'ascending' }],
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

      const items = all.map(p => {
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

        return {
  id: p.id,
  nama: getText('Name'),
  tipe: getSelect('Tipe'),
  tipe_file: getSelect('Tipe_File'),
  parent_id: getText('Parent_ID'),
  akses: getSelect('Akses'),
  aplikasi: getSelect('Aplikasi'),
  link_drive: props['Link_Drive']?.url || '',
  link_template: props['Link Template']?.url || '',
  link_youtube: props['Link YouTube']?.url || '',
  judul_youtube: (props['Judul Video Tutorial']?.rich_text || []).map(t => t.plain_text).join('') || '',
  note_folder: (props['Note Folder']?.rich_text || []).map(t => t.plain_text).join('') || '',
  deskripsi: getText('Deskripsi'),
  urutan: props['Urutan']?.number || 0,
};
      }).filter(t => t.nama);

      return res.status(200).json({ items });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== POST: tambah / edit / hapus =====
  if (req.method === 'POST') {
    try {
      const { action, page_id, nama, tipe, tipe_file, parent_id, akses, aplikasi, link_drive, deskripsi, urutan } = req.body || {};

      // --- TAMBAH ---
      if (action === 'tambah') {
        if (!nama || !tipe || !akses) {
          return res.status(400).json({ error: 'nama, tipe, dan akses wajib diisi.' });
        }

        const properties = {
          'Name': { title: [{ text: { content: nama } }] },
          'Tipe': { select: { name: tipe } },
          'Akses': { select: { name: akses } },
          'Deskripsi': { rich_text: [{ text: { content: deskripsi || '' } }] },
          'Urutan': { number: urutan || 0 },
        };

        if (tipe_file) properties['Tipe_File'] = { select: { name: tipe_file } };
if (aplikasi) properties['Aplikasi'] = { select: { name: aplikasi } };
        if (link_drive) properties['Link_Drive'] = { url: link_drive };
        if (req.body.link_template) properties['Link Template'] = { url: req.body.link_template };
        if (req.body.link_youtube) properties['Link YouTube'] = { url: req.body.link_youtube };
        if (req.body.judul_youtube) properties['Judul Video Tutorial'] = { rich_text: [{ text: { content: req.body.judul_youtube } }] };
        if (req.body.note_folder) properties['Note Folder'] = { rich_text: [{ text: { content: req.body.note_folder } }] };
        if (parent_id) properties['Parent_ID'] = { rich_text: [{ text: { content: parent_id } }] };

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
          return res.status(500).json({ error: err.message || 'Gagal tambah item.' });
        }

        const data = await r.json();
        return res.status(200).json({ success: true, id: data.id });
      }

      // --- EDIT ---
      if (action === 'edit') {
        if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi.' });

        const properties = {};
        if (nama !== undefined) properties['Name'] = { title: [{ text: { content: nama } }] };
        if (tipe !== undefined) properties['Tipe'] = { select: { name: tipe } };
        if (tipe_file !== undefined) properties['Tipe_File'] = tipe_file ? { select: { name: tipe_file } } : { select: null };
        if (akses !== undefined) properties['Akses'] = { select: { name: akses } };
if (aplikasi !== undefined) properties['Aplikasi'] = aplikasi ? { select: { name: aplikasi } } : { select: null };
        if (link_drive !== undefined) properties['Link_Drive'] = { url: link_drive || null };
        if (req.body.link_template !== undefined) properties['Link Template'] = { url: req.body.link_template || null };
        if (req.body.link_youtube !== undefined) properties['Link YouTube'] = { url: req.body.link_youtube || null };
        if (req.body.judul_youtube !== undefined) properties['Judul Video Tutorial'] = { rich_text: [{ text: { content: req.body.judul_youtube || '' } }] };
        if (req.body.note_folder !== undefined) properties['Note Folder'] = { rich_text: [{ text: { content: req.body.note_folder || '' } }] };
        if (deskripsi !== undefined) properties['Deskripsi'] = { rich_text: [{ text: { content: deskripsi } }] };
        if (urutan !== undefined) properties['Urutan'] = { number: urutan };
        if (parent_id !== undefined) properties['Parent_ID'] = { rich_text: [{ text: { content: parent_id } }] };

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
          return res.status(500).json({ error: err.message || 'Gagal edit item.' });
        }

        return res.status(200).json({ success: true });
      }

      // --- HAPUS ---
      if (action === 'hapus') {
        if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi.' });

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
          return res.status(500).json({ error: err.message || 'Gagal hapus item.' });
        }

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Action tidak dikenal. Gunakan: tambah, edit, atau hapus.' });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
