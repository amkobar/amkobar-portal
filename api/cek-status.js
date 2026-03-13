export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const kodeAkses = req.query.kode;
  if (!kodeAkses) {
    return res.status(400).json({ error: 'Kode akses tidak boleh kosong.' });
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID;

  if (!NOTION_TOKEN || !NOTION_DB_ID) {
    return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });
  }

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
          property: 'Kode Akses',
          formula: { string: { equals: kodeAkses.toUpperCase() } }
        },
        page_size: 1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: `Notion error: ${response.status} - ${JSON.stringify(data)}` });
    }

    if (!data.results || data.results.length === 0) {
      return res.status(200).json({ found: false });
    }

    const page = data.results[0];
    const props = page.properties;

    function getText(prop) {
      if (!prop) return null;
      if (prop.type === 'title') return prop.title?.[0]?.plain_text || null;
      if (prop.type === 'rich_text') return prop.rich_text?.[0]?.plain_text || null;
      return null;
    }

    function getSelect(prop) {
      if (!prop) return null;
      return prop.select?.name || null;
    }

    function getCheckbox(prop) {
      if (!prop) return false;
      return prop.checkbox || false;
    }

    function getNumber(prop) {
      if (!prop) return null;
      return prop.number ?? null;
    }

    function getFormula(prop) {
      if (!prop || prop.type !== 'formula') return null;
      const f = prop.formula;
      if (!f) return null;
      if (f.type === 'number') return f.number;
      if (f.type === 'string') return f.string;
      if (f.type === 'boolean') return f.boolean;
      return null;
    }

    function getRollup(prop) {
      if (!prop || prop.type !== 'rollup') return null;
      const r = prop.rollup;
      if (!r) return null;
      if (r.type === 'number') return r.number;
      if (r.type === 'array' && r.array?.length > 0) {
        const first = r.array[0];
        if (first.type === 'number') return first.number;
        if (first.type === 'rich_text') return first.rich_text?.[0]?.plain_text || null;
        if (first.type === 'formula') {
          const f = first.formula;
          if (f?.type === 'number') return f.number;
          if (f?.type === 'string') return f.string;
        }
        if (first.type === 'select') return first.select?.name || null;
        if (first.type === 'title') return first.title?.[0]?.plain_text || null;
      }
      return null;
    }

    function getDate(prop) {
      if (!prop) return null;
      return prop.date?.start || null;
    }

    function getUrl(prop) {
      if (!prop) return null;
      return prop.url || null;
    }

    // Sisa Pembayaran dari formula
    const sisaPembayaran = getFormula(props['Sisa Pembayaran']);

    // Jumlah Referral dari rollup
    const jumlahReferral = getRollup(props['Jumlah Referral']) || getNumber(props['Jumlah Referral']) || 0;

    // Diskon Referral dari formula
    const diskonReferral = getFormula(props['Diskon Referral']) || getNumber(props['Diskon Referral']) || 0;

    // Skema Pembayaran dari rollup
    const skema = getRollup(props['Skema Pembayaran']) || getText(props['Skema Pembayaran']);

    // Aplikasi dari rollup
    const aplikasi = getRollup(props['Aplikasi']) || getSelect(props['Aplikasi']);

    const result = {
      found: true,
      nama: getText(props['Nama Client']),
      nim: getText(props['NIM/NPM']),
      universitas: getSelect(props['Universitas']),
      judul: getText(props['Judul Penelitian']),
      jenis_layanan: getSelect(props['Jenis Layanan']),
      aplikasi: aplikasi,
      jumlah_variabel: getSelect(props['Jumlah Variabel']),
      status_project: getSelect(props['Status Project']),
      deadline: getDate(props['Deadline']),
      skema: skema,
      dp_masuk: getCheckbox(props['DP Masuk']),
      tahap2_masuk: getCheckbox(props['Tahap 2 Masuk']),
      pelunasan_masuk: getCheckbox(props['Pelunasan Masuk']),
      sisa_pembayaran: sisaPembayaran,
      link_drive: getUrl(props['Link Drive']),
      jumlah_referral: jumlahReferral,
      diskon_referral: diskonReferral,
    };

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
