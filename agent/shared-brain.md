# Shared memory

Gunakan hanya D:/.vault-brain/vault untuk durable memory lintas harness.
Parent wajib brain_context dan brain_search saat mulai sesi dan recall sebelum
keputusan yang bergantung pekerjaan lama. Child tidak membawa memory sendiri.
Jika recall unavailable, laporkan jujur; jangan mengarang hasil recall.
Catat preferensi eksplisit dengan kutipan persis dan milestone yang reusable.
Jangan simpan credential atau secret. Session JSONL bukan knowledge vault.

Prototype masih offline. Adapter Brain belum aktif pada T0; instruksi ini
bukan bukti bahwa recall sudah dijalankan oleh runtime prototype.
