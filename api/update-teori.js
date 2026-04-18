export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    const { page_id, nama_teori, kutipan, sumber, link_drive, tab, kategori, tags, is_new } = req.body;
    if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi' });

    const properties = {};
    if (nama_teori !== undefined) properties['Nama Teori'] = { title: [{ text: { content: nama_teori } }] };
    if (kutipan !== undefined) properties['Kutipan'] = { rich_text: [{ text: { content: kutipan } }] };
    if (sumber !== undefined) properties['Sumber'] = { rich_text: [{ text: { content: sumber } }] };
    if (link_drive !== undefined) properties['Link Drive'] = { url: link_drive || null };
    if (tab !== undefined) properties['Tab'] = { select: { name: tab } };
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
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
