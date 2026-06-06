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

    const page = data.results[0];
    const props = page.properties;

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

    // Cek akses aktif — skip kalau request dari admin
    const isAdminRequest = req.query.admin === '1';
    const aksesAktif = getCheckbox(props['Akses_Aktif']);
    if (!aksesAktif && !isAdminRequest) {
      return res.status(200).json({ found: false, nonaktif: true });
    }

    return res.status(200).json({
      found: true,
      page_id: page.id,
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
      sisa_pembayaran: (() => {
        const raw = getFormula(props['Sisa Pembayaran']);
        const dis = props['Diskon Referral']?.number || 0;
        const j = getRollup(props['Jumlah Referral']) || 0;
        if (!raw || raw <= 0) return 0;
        if (dis > 0 && j < 3) return raw + dis;
        return raw;
      })(),
      total_addon: getRollup(props['Total Add-On']) || getFormula(props['Total Add-On']) || 0,
      link_drive: getUrl(props['Link Drive']),
      link_hasil_final: getUrl(props['Link Hasil Final']),
      jumlah_referral: getRollup(props['Jumlah Referral']) || 0,
      diskon_referral: props['Diskon Referral']?.number || 0,
      kode_akses: getFormula(props['Kode Akses']),
      testimoni_selesai: getCheckbox(props['Testimoni_Selesai']),
      akses_aktif: aksesAktif,
      reward_dicairkan: getCheckbox(props['Reward_Dicairkan']),
      reward_ditransfer: getCheckbox(props['Reward_Ditransfer']), // BARU
      rekening_reward: getText(props['Rekening_Reward']),
      teori_dipilih: (props['Teori Dipilih']?.rich_text || []).map(t => t.plain_text).join('') || '{}',
all_teori_tampil: getCheckbox(props['All Teori Tampil']),
      tanggal_pendampingan: getDate(props['Tanggal Pendampingan']),
      masa_berlaku_hari: props['Masa Berlaku Hari']?.number ?? 50,
      tanggal_selesai: getDate(props['Tanggal Selesai']),
      tanggal_aktivasi_rating: props['Tanggal Aktivasi Rating']?.date?.start || null,
      client_lama: getCheckbox(props['Client Lama']),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
