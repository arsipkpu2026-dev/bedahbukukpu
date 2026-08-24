const crypto = require('crypto');

// ========================================================
// MASUKKAN KREDENSIAL SUPABASE ANDA DI SINI
// ========================================================
const SUPABASE_URL = "https://tvtvzopswbwwwshhhmre.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dHZ6b3Bzd2J3d3dzaGhobXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTAxMDQsImV4cCI6MjEwMzEyNjEwNH0._WK_iFjfg64BWa2PRx8ljHKEX5ojmzpjVUKihtG0-3I";

async function dbQuery(method, table, queryParams = "", body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${queryParams}`;
  const options = {
    method: method,
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

function hashSHA256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = async function handler(req, res) {
  // Sistem Keamanan & Izin (CORS)[cite: 3]
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let parsedBody = {};
  if (req.body) {
    try { parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch(e){}
  }
  
  const action = req.method === 'GET' ? req.query.action : parsedBody.action;
  let result = {};

  try {
    if (action === 'hadirTeks') {
      const d = parsedBody.data;
      await dbQuery('POST', 'kehadiran', '', { nama: d[0], instansi: d[1], email: d[2], hp: d[3], auto_email: d[4] });
      result = { success: true, message: "Pendaftaran Berhasil Tanpa Antre!" };
    }
    else if (action === 'getData') {
      const data = await dbQuery('GET', 'kehadiran', '?select=*&order=id.asc');
      result = { data: data.map(r => [r.created_at, r.nama, r.instansi, r.email, r.hp, r.auto_email ? "Ya" : "Tidak", r.status_email, r.nomor_sertifikat]) };
    }
    else if (action === 'simpanPdf') {
      const bucketName = String(parsedBody.jenis) === '2' ? 'sertifikat2' : 'sertifikat';[cite: 3]
      const buffer = Buffer.from(parsedBody.base64Data.split(',')[1], 'base64');
      const fileRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucketName}/${parsedBody.filename}`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/pdf' },
        body: buffer
      });
      if(!fileRes.ok) throw new Error(await fileRes.text());
      result = { success: true };
    }
    else if (action === 'cariEmail') {
        const nama = req.query.nama.toLowerCase();
        const bucketName = req.query.jenis === '2' ? 'sertifikat2' : 'sertifikat';[cite: 3]

        // Perbaikan endpoint list menggunakan search body yang didukung Supabase Storage v1
        const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucketName}`, {
            method: 'POST', 
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: "", limit: 100, search: nama })
        });
        
        if (!listRes.ok) throw new Error(await listRes.text());
        const files = await listRes.json();
        const matched = Array.isArray(files) ? files.find(f => f.name && f.name.toLowerCase().includes(nama)) : null;

        if(matched && matched.name) {
            let parts = matched.name.replace('.pdf', '').split('_');
            let emailParts = parts[parts.length - 1].split("@");
            let masked = emailParts[0].length > 2 ? emailParts[0].substring(0, 2) + "***" : emailParts[0].substring(0, 1) + "***";
            result = { success: true, email: `${masked}@${emailParts[1]}`, message: "Petunjuk email ditemukan!" };
        } else { result = { success: false, message: "Tidak ada sertifikat dengan nama tersebut." }; }
    }
    else if (action === 'download') {
        const email = req.query.email.toLowerCase();
        const bucketName = req.query.jenis === '2' ? 'sertifikat2' : 'sertifikat';[cite: 3]

        const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucketName}`, {
            method: 'POST', 
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: "", limit: 100, search: email })
        });
        
        if (!listRes.ok) throw new Error(await listRes.text());
        const files = await listRes.json();
        const matched = Array.isArray(files) ? files.find(f => f.name && f.name.toLowerCase().includes(email)) : null;

        if(matched && matched.name) {
            result = { success: true, url: `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${matched.name}`, message: "Sertifikat ditemukan!" };
        } else { result = { success: false, message: "Sertifikat belum ada." }; }
    }
    else if (action === 'login') {
        const data = await dbQuery('GET', 'admin', `?username=eq.${req.query.user}&password=eq.${hashSHA256(req.query.pass)}&select=*`);
        result = data.length > 0 ? { success: true } : { success: false, message: 'Username atau Password salah!' };
    }
    else if (action === 'getSettings') {
        const settings = await dbQuery('GET', 'pengaturan', '?select=*');
        const admin = await dbQuery('GET', 'admin', '?id=eq.1&select=email_admin');
        let set = { kode: "", templateConfig: "", adminEmail: admin[0]?.email_admin || "" };
        settings.forEach(r => { if(r.key === 'kode_sertifikat') set.kode = r.value; if(r.key === 'template_config') set.templateConfig = r.value; });
        result = set;
    }
    else if (action === 'simpanSetUmum') {
        await dbQuery('PATCH', 'pengaturan', '?key=eq.kode_sertifikat', { value: parsedBody.kode });
        if (parsedBody.adminEmail) await dbQuery('PATCH', 'admin', '?id=eq.1', { email_admin: parsedBody.adminEmail });
        result = { success: true };
    }
    else if (action === 'simpanSetTemplate') {
        await dbQuery('PATCH', 'pengaturan', '?key=eq.template_config', { value: parsedBody.templateConfig });
        result = { success: true };
    }
    else if (action === 'ubahPass') {
        const admin = await dbQuery('GET', 'admin', '?id=eq.1&select=password');
        if (admin[0].password !== hashSHA256(parsedBody.oldPass)) result = { success: false, message: "Password lama salah!" };
        else { await dbQuery('PATCH', 'admin', '?id=eq.1', { password: hashSHA256(parsedBody.newPass) }); result = { success: true, message: "Berhasil" }; }
    }
    else if (action === 'getAgenda') {
        const data = await dbQuery('GET', 'agenda', '?select=*&order=waktu_mulai.asc');
        result = { data: data.map(r => [r.id, r.judul, r.waktu_mulai, r.platform, r.link, r.meeting_id, r.passcode, r.link_bg, r.waktu_selesai]) };
    }
    else if (action === 'addAgenda') {
        const d = parsedBody.data; await dbQuery('POST', 'agenda', '', { id: Date.now().toString(), judul: d[0], waktu_mulai: d[1], platform: d[2], link: d[3], meeting_id: d[4], passcode: d[5], link_bg: d[6], waktu_selesai: d[7] }); result = { success: true };
    }
    else if (action === 'delAgenda') {
        await dbQuery('DELETE', 'agenda', `?id=eq.${parsedBody.id}`); result = { success: true };
    }
    else if (action === 'getEbook') {
        const data = await dbQuery('GET', 'ebook', '?select=*&order=id.desc');
        result = { data: data.map(r => [r.id, r.judul, r.deskripsi, r.link_download]) };
    }
    else if (action === 'addEbook') {
        const d = parsedBody.data; await dbQuery('POST', 'ebook', '', { id: Date.now().toString(), judul: d[0], deskripsi: d[1], link_download: d[2] }); result = { success: true };
    }
    else if (action === 'delEbook') {
        await dbQuery('DELETE', 'ebook', `?id=eq.${parsedBody.id}`); result = { success: true };
    }
    else if (action === 'kirimEmailTTE') {
        if (parsedBody.selectedEmails && parsedBody.selectedEmails.length > 0) {
           for(let e of parsedBody.selectedEmails) await dbQuery('PATCH', 'kehadiran', `?email=eq.${e}`, { status_email: 'Terkirim' });
        } else { await dbQuery('PATCH', 'kehadiran', `?auto_email=eq.true`, { status_email: 'Terkirim' }); }
        result = { success: true, message: "Status di-update." };
    }
    else { result = { success: false, message: "Aksi tidak dikenali." }; }
  } catch (err) {
    console.error('ERROR STORAGE/API:', err);
    // Mengirimkan detail error ke client agar tidak 404 tersembunyi
    result = { success: false, message: err.message || "Terjadi kesalahan pada server." };
  }
  
  res.status(200).json(result);
};
