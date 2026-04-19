export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });

  const { action, page_id, akses_aktif, status } = req.body || {};

  if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi.' });
  if (!action) return res.status(400).json({ error: 'action wajib diisi.' });

  try {

    // ===== UPDATE AKSES AKTIF =====
    if (action === 'update_akses') {
      if (typeof akses_aktif !== 'boolean') {
        return res.status(400).json({ error: 'akses_aktif harus boolean.' });
      }

      const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            'Akses_Aktif': { checkbox: akses_aktif }
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(500).json({ error: `Notion error: ${response.status} - ${JSON.stringify(data)}` });
      }

      return res.status(200).json({ success: true });
    }

    // ===== UPDATE STATUS PROJECT =====
    if (action === 'update_status') {
      if (!status) return res.status(400).json({ error: 'status wajib diisi.' });

      const validStatus = [
        'Refund',
        'Menunggu Review',
        'Antrian',
        'Diproses',
        'Menunggu Pelunasan',
        'Pendampingan',
        'Selesai',
        'Dibatalkan'
      ];

      if (!validStatus.includes(status)) {
        return res.status(400).json({ error: 'Status tidak valid.' });
      }

      const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            'Status Project': { select: { name: status } }
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(500).json({ error: `Notion error: ${response.status} - ${JSON.stringify(data)}` });
      }

      return res.status(200).json({ success: true });
    }

if (action === 'update_info') {
  const { judul, jumlah_variabel } = req.body;
  const properties = {};
  if (judul !== undefined) properties['Judul Penelitian'] = { rich_text: [{ text: { content: judul || '' } }] };
  if (jumlah_variabel !== undefined) properties['Jumlah Variabel'] = jumlah_variabel ? { select: { name: jumlah_variabel } } : { select: null };
  if (!Object.keys(properties).length) return res.status(400).json({ error: 'Tidak ada field yang diupdate.' });
  const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties })
  });
  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status}` });
  return res.status(200).json({ success: true });
}    
return res.status(400).json({ error: 'Action tidak dikenal. Gunakan: update_akses atau update_status.' });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
