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

    // ===== UPDATE INFO (JUDUL / JUMLAH VARIABEL) =====
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

    // ===== SUBMIT REWARD REFERRAL (dari client) =====
    if (action === 'submit_reward') {
      const { nama, kode_akses, nominal, metode, nomor, nama_pemilik } = req.body || {};
      if (!metode || !nomor || !nama_pemilik) return res.status(400).json({ error: 'Metode, nomor, dan nama pemilik wajib diisi.' });

      const rekening_value = `${metode}|${nomor}|${nama_pemilik}`;
      const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' });
      const nominalFmt = nominal ? `Rp ${Number(nominal).toLocaleString('id-ID')}` : '?';

      // Update Notion
      const notionRes = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            'Reward_Dicairkan': { checkbox: true },
            'Rekening_Reward': { rich_text: [{ text: { content: rekening_value } }] }
          }
        })
      });

      const notionData = await notionRes.json();
      if (!notionRes.ok) return res.status(500).json({ error: `Notion error: ${notionRes.status}` });

      // Kirim email via Resend
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const GMAIL_USER = process.env.GMAIL_USER;
      if (RESEND_API_KEY && GMAIL_USER) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'AMKOBAR Portal <onboarding@resend.dev>',
              to: [GMAIL_USER],
              subject: `[REWARD] Cairkan Referral — ${nama || kode_akses} (${nominalFmt})`,
              html: `
                <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
                  <h2 style="color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
                    🎁 Reward Referral Perlu Dicairkan
                  </h2>
                  <table style="width:100%;border-collapse:collapse;margin-top:16px">
                    <tr><td style="padding:8px 0;color:#64748b;width:140px">Nama Client</td><td style="padding:8px 0;font-weight:500">${nama || '-'}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Kode Akses</td><td style="padding:8px 0;font-weight:500">${kode_akses || '-'}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Nominal</td><td style="padding:8px 0;font-weight:600;color:#059669">${nominalFmt}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Metode</td><td style="padding:8px 0;font-weight:500">${metode}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Nomor</td><td style="padding:8px 0;font-weight:500">${nomor}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Nama Pemilik</td><td style="padding:8px 0;font-weight:500">${nama_pemilik}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Waktu Submit</td><td style="padding:8px 0">${waktu}</td></tr>
                  </table>
                  <div style="margin-top:20px;padding:12px;background:#fef9c3;border-radius:8px;font-size:13px;color:#92400e">
                    ⚠️ Segera lakukan transfer dan tandai reward sebagai selesai di tab Segera TF pada Admin Dashboard.
                  </div>
                </div>
              `
            })
          });
        } catch (emailErr) {
          console.error('Email error:', emailErr.message);
        }
      }

      return res.status(200).json({ success: true });
    }

    // ===== KONFIRMASI REWARD SUDAH DITRANSFER (dari admin) =====
    if (action === 'confirm_reward_tf') {
      const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            'Reward_Ditransfer': { checkbox: true }
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(500).json({ error: `Notion error: ${response.status} - ${JSON.stringify(data)}` });
      }

      return res.status(200).json({ success: true });
    }
// ===== SIMPAN TEORI DIPILIH (dari client) =====
    if (action === 'simpan_teori_dipilih') {
      const { kategori, teori_id } = req.body;
      if (!kategori || !teori_id) return res.status(400).json({ error: 'kategori dan teori_id wajib diisi.' });
      const getRes = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }
      });
      const getData = await getRes.json();
      const existing = (getData.properties['Teori Dipilih']?.rich_text || []).map(t => t.plain_text).join('') || '{}';
      let teoriMap = {};
      try { teoriMap = JSON.parse(existing); } catch(e) {}
      teoriMap[kategori] = teori_id;
      const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { 'Teori Dipilih': { rich_text: [{ text: { content: JSON.stringify(teoriMap) } }] } } })
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status}` });
      return res.status(200).json({ success: true, teori_dipilih: teoriMap });
    }

    // ===== SIMPAN TEMPLATE DIPILIH (client pilih template di folder Pilihan Tunggal) =====
    if (action === 'simpan_template_dipilih') {
      const { folder_id, item_id } = req.body;
      if (!folder_id || !item_id) return res.status(400).json({ error: 'folder_id dan item_id wajib diisi.' });
      const getRes = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }
      });
      const getData = await getRes.json();
      const existing = (getData.properties['Template Dipilih']?.rich_text || []).map(t => t.plain_text).join('') || '{}';
      let tplMap = {};
      try { tplMap = JSON.parse(existing); } catch(e) {}
      // Permanen: jika folder ini sudah punya pilihan, JANGAN timpa
      if (tplMap[folder_id]) {
        return res.status(200).json({ success: true, template_dipilih: tplMap, already: true });
      }
      tplMap[folder_id] = item_id;
      const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { 'Template Dipilih': { rich_text: [{ text: { content: JSON.stringify(tplMap) } }] } } })
      });
      if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status}` });
      return res.status(200).json({ success: true, template_dipilih: tplMap });
    }

    // ===== UPDATE ALL TEORI TAMPIL (dari admin) =====
    if (action === 'update_all_teori_tampil') {
      const { all_teori_tampil } = req.body;
      if (typeof all_teori_tampil !== 'boolean') return res.status(400).json({ error: 'all_teori_tampil harus boolean.' });
      const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { 'All Teori Tampil': { checkbox: all_teori_tampil } } })
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: `Notion error: ${response.status}` });
      return res.status(200).json({ success: true });
    }

    // ===== RESET & UPGRADE LAYANAN (ganti paket, client diperlakukan seperti baru + penyesuaian saldo) =====
    if (action === 'reset_upgrade') {
      const { jenis_layanan, aplikasi, jumlah_variabel, status_judul, sumber_data, preview } = req.body || {};
      if (!jenis_layanan || !aplikasi || !jumlah_variabel) {
        return res.status(400).json({ error: 'jenis_layanan, aplikasi, dan jumlah_variabel wajib diisi.' });
      }

      const MASTER_PAKET_DB_ID = '310efe1d1acf803493db000bb3abeb96';

      // --- 1. Ambil data client saat ini (untuk hitung "sudah dibayar" & harga lama) ---
      const getRes = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }
      });
      const getData = await getRes.json();
      if (!getRes.ok) return res.status(500).json({ error: `Notion error (get client): ${getRes.status}` });

      const props = getData.properties;
      const getFormulaNum = p => {
        if (!p || p.type !== 'formula') return 0;
        const f = p.formula;
        if (f?.type === 'number') return f.number || 0;
        return 0;
      };

      const totalDibayarLama = getFormulaNum(props['Total Dibayar']);
      const hargaNettoLama = getFormulaNum(props['Harga Netto']);
      const sisaLama = getFormulaNum(props['Sisa Pembayaran']);

      // --- 2. Query Master Paket sesuai dimensi baru ---
      const filterConditions = [
        { property: 'Sub Layanan', select: { equals: jenis_layanan } },
        { property: 'Aplikasi', select: { equals: aplikasi } },
        { property: 'Jumlah Variabel', select: { equals: jumlah_variabel } },
      ];

      if (jenis_layanan === 'FULL BAB (I–V)') {
        if (!status_judul) return res.status(400).json({ error: 'status_judul wajib diisi untuk FULL BAB (I–V).' });
        filterConditions.push({ property: 'Status Judul', select: { equals: status_judul } });
      } else if (jenis_layanan === 'Olahdata Only') {
        if (!sumber_data) return res.status(400).json({ error: 'sumber_data wajib diisi untuk Olahdata Only.' });
        filterConditions.push({ property: 'Sumber Data', select: { equals: sumber_data } });
      } else {
        // BAB IV / BAB IV–V: dimensi ke-4 harus "Tidak Berlaku"
        filterConditions.push({ property: 'Status Judul', select: { equals: 'Tidak Berlaku' } });
        filterConditions.push({ property: 'Sumber Data', select: { equals: 'Tidak Berlaku' } });
      }

      const queryRes = await fetch(`https://api.notion.com/v1/databases/${MASTER_PAKET_DB_ID}/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: { and: filterConditions }, page_size: 2 })
      });
      const queryData = await queryRes.json();
      if (!queryRes.ok) return res.status(500).json({ error: `Notion error (query master paket): ${queryRes.status}` });
      if (!queryData.results || queryData.results.length === 0) {
        return res.status(404).json({ error: 'Paket tidak ditemukan untuk kombinasi ini. Cek kembali pilihan layanan/aplikasi/jumlah variabel.' });
      }

      const paketBaru = queryData.results[0];
      const paketBaruId = paketBaru.id;
      const pProps = paketBaru.properties;
      const kategoriHarga = props['Kategori Harga']?.select?.name || 'khu';
      const hargaBaruRaw = kategoriHarga === 'khk'
        ? (pProps['Harga Kerjasama']?.number || 0)
        : (pProps['Harga Umum']?.number || 0);

      // Total Add-On & Diskon Referral (untuk hitung Harga Netto baru secara akurat di response)
      const totalAddOn = props['Total Add-On']?.rollup?.number || 0;
      const diskonReferral = props['Diskon Referral']?.number || 0;

      // --- 3. Hitung penyesuaian saldo (negatif = mengurangi sisa pembayaran paket baru) ---
      const penyesuaianSaldo = -totalDibayarLama;
      const hargaNettoBaruEstimasi = hargaBaruRaw + totalAddOn - diskonReferral;
      const sisaBaruEstimasi = Math.max(0, hargaNettoBaruEstimasi + penyesuaianSaldo);
      const namaPaketBaru = pProps['Nama Paket']?.title?.map(t => t.plain_text).join('') || '';

      const ringkasan = {
        harga_netto_lama: hargaNettoLama,
        sisa_lama: sisaLama,
        sudah_dibayar: totalDibayarLama,
        harga_netto_baru: hargaNettoBaruEstimasi,
        sisa_baru: sisaBaruEstimasi,
        penyesuaian_saldo: penyesuaianSaldo,
        paket_baru: namaPaketBaru,
      };

      // --- MODE PREVIEW: hanya hitung, tidak ubah data ---
      if (preview) {
        return res.status(200).json({ success: true, preview: true, ringkasan });
      }

      // --- 4. PATCH client: ganti paket, reset checkbox, set penyesuaian saldo, update jenis layanan & jumlah variabel ---
      const patchProperties = {
        'Paket': { relation: [{ id: paketBaruId }] },
        'Jenis Layanan': { select: { name: jenis_layanan } },
        'Jumlah Variabel': { select: { name: jumlah_variabel } },
        'DP Masuk': { checkbox: false },
        'Tahap 2 Masuk': { checkbox: false },
        'Pelunasan Masuk': { checkbox: false },
        'Penyesuaian Saldo': { number: penyesuaianSaldo },
      };

      const patchRes = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: patchProperties })
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) return res.status(500).json({ error: `Notion error (update client): ${patchRes.status} - ${JSON.stringify(patchData)}` });

      return res.status(200).json({ success: true, ringkasan });
    }

    return res.status(400).json({ error: 'Action tidak dikenal.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
  }
}
