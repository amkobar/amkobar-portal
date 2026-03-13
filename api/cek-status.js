export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const nim = req.query.nim;
  if (!nim) {
    return res.status(400).json({ error: 'NIM/NPM tidak boleh kosong.' });
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
          property: 'NIM/NPM',
          rich_text: { equals: nim }
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
      return prop?.select?.name || null;
    }

    function getCheckbox(prop) {
      return prop?.checkbox || false;
    }

    function getNumber(prop) {
      return prop?.number ?? null;
    }

    function getFormula(prop) {
      if (!prop) return null;
      const f = prop.formula;
      if (!f) return null;
      if (f.type === 'number') return f.number;
      if (f.type === 'string') return f.string;
      if (f.type === 'boolean') return f.boolean;
      return null;
    }

    function getRollup(prop) {
      if (!prop) return null;
      const r = prop.rollup;
      if (!r) return null;
      if (r.type === 'number') return r.number;
      if (r.type === 'array' && r.array?.length > 0) {
        const first = r.array[0];
        if (first.type === 'number') return first.number;
        if (first.type === 'rich_text') return first.rich_text?.[0]?.plain_text || null;
        if (first.type === 'select') return first.select?.name || null;
      }
      return null;
    }

    function getDate(prop) {
      return prop?.date?.start || null;
    }

    function getUrl(prop) {
      return prop?.url || null;
    }

    // Hitung Sisa Pembayaran
    // Coba dari formula dulu, kalau tidak ada hitung manual
    let sisa = getFormula(props['Sisa Pembayaran']);
    if (sisa === null) {
      const hargaNetto = getFormula(props['Harga Netto']) || getRollup(props['Harga Netto']) || getNumber(props['Harga Netto']);
      const totalDibayar = getFormula(props['Total Dibayar']) || getNumber(props['Total Dibayar']);
      if (hargaNetto !== null && totalDibayar !== null) {
        sisa = Math.max(0, hargaNetto - totalDibayar);
      }
    }

    // Skema pembayaran — coba dari rollup atau langsung
    const skema = getRollup(props['Skema Pembayaran']) || getText(props['Skema Pembayaran']) || getSelect(props['Skema Pembayaran']);

    const result = {
      found: true,
      nama: getText(props['Nama Client']),
      nim: getText(props['NIM/NPM']),
      universitas: getSelect(props['Universitas']),
      judul: getText(props['Judul Penelitian']),
      jenis_layanan: getSelect(props['Jenis Layanan']),
      aplikasi: getSelect(props['Aplikasi']),
      status_project: getSelect(props['Status Project']),
      deadline: getDate(props['Deadline']),
      skema: skema,
      dp_masuk: getCheckbox(props['DP Masuk']),
      tahap2_masuk: getCheckbox(props['Tahap 2 Masuk']),
      pelunasan_masuk: getCheckbox(props['Pelunasan Masuk']),
      sisa_pembayaran: sisa,
      link_drive: getUrl(props['Link Drive']),
    };

    return res.status(200).json(result);

 } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
