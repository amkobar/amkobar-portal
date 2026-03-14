export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const kode = req.query.kode;
  if (!kode) return res.status(400).json({ error: 'Kode akses tidak boleh kosong.' });

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
        filter: { property: 'Kode Akses', rich_text: { equals: kode.toUpperCase() } },
        page_size: 1
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status} - ${JSON.stringify(data)}` });
    if (!data.results || data.results.length === 0) return res.status(200).json({ found: false });

    const props = data.results[0].properties;

    const getText = p => {
      if (!p) return null;
      if (p.type === 'title') return p.title?.[0]?.plain_text || null;
      if (p.type === 'rich_text') return p.rich_text?.[0]?.plain_text || null;
      return null;
    };
    const getSelect = p => p?.select?.name || null;
    const getCheckbox = p => p?.checkbox || false;
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
    const getUrl = p => p?.url || null;

    return res.status(200).json({
      found: true,
      nama: getText(props['Nama Client']),
      nim: getText(props['NIM/NPM']),
      universitas: getSelect(props['Universitas']),
      judul: getText(props['Judul Penelitian']),
      jenis_layanan: getSelect(props['Jenis Layanan']),
      aplikasi: getRollup(props['Aplikasi']) || getSelect(props['Aplikasi']),
      jumlah_variabel: getSelect(props['Jumlah Variabel']),
      status_project: getSelect(props['Status Project']),
      deadline: getDate(props['Deadline']),
      skema: getRollup(props['Skema Pembayaran']) || getText(props['Skema Pembayaran']),
      kategori_harga: getSelect(props['Kategori Harga']),
      harga_kerjasama: getRollup(props['Harga Kerjasama']),
      harga_umum: getRollup(props['Harga Umum']),
      dp_kerjasama: getRollup(props['DP Kerjasama']),
      dp_umum: getRollup(props['DP Umum']),
      dp_masuk: getCheckbox(props['DP Masuk']),
      tahap2_masuk: getCheckbox(props['Tahap 2 Masuk']),
      pelunasan_masuk: getCheckbox(props['Pelunasan Masuk']),
      sisa_pembayaran: getFormula(props['Sisa Pembayaran']),
      total_addon: getRollup(props['Total Add-On']) || getFormula(props['Total Add-On']) || 0,
      link_drive: getUrl(props['Link Drive']),
      jumlah_referral: getRollup(props['Jumlah Referral']) || 0,
      diskon_referral: getFormula(props['Diskon Referral']) || 0,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
