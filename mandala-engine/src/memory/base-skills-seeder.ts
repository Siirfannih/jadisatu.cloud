/**
 * Base Skills Seeder — Populates shared knowledge in Pinecone.
 *
 * Seeds the "base-skills" namespace with hospitality CS best practices.
 * Run once during setup, then update manually as needed.
 *
 * Usage: npx tsx src/memory/base-skills-seeder.ts
 */
import { SemanticStore } from './semantic-store.js';

const BASE_SKILLS = [
  {
    content: 'Greeting best practice: Sapa customer dengan nama jika tersedia. Gunakan "Halo Kak/Pak/Bu [nama]" di awal percakapan. Jangan langsung masuk topik, tanyakan kabar dulu secara singkat.',
    source: 'hospitality-greeting',
  },
  {
    content: 'Complaint handling: Dengarkan complaint sampai selesai tanpa memotong. Acknowledge perasaan customer ("Saya memahami ketidaknyamanannya"). Tawarkan solusi konkret, bukan janji kosong. Follow up setelah resolusi.',
    source: 'hospitality-complaint',
  },
  {
    content: 'Booking confirmation: Selalu konfirmasi ulang detail booking: nama tamu, tanggal check-in/check-out, tipe kamar, jumlah tamu, special request. Kirim konfirmasi tertulis via chat.',
    source: 'hospitality-booking',
  },
  {
    content: 'Upselling technique: Tawarkan upgrade hanya setelah customer sudah nyaman dan puas dengan layanan dasar. Gunakan framing "kebetulan ada" bukan "mau beli". Contoh: "Kebetulan ada room yang baru direnovasi dengan view lebih bagus, selisihnya hanya Rp X".',
    source: 'hospitality-upselling',
  },
  {
    content: 'Check-out procedure: Tanyakan apakah ada hal yang perlu dibantu sebelum check-out. Konfirmasi jam check-out. Tanyakan feedback tentang pengalaman menginap. Ingatkan tentang barang bawaan.',
    source: 'hospitality-checkout',
  },
  {
    content: 'Tone guidelines: Gunakan bahasa semi-formal yang hangat. Hindari bahasa terlalu formal (terkesan robot) atau terlalu kasual (tidak professional). Sesuaikan dengan gaya bicara customer — jika mereka casual, ikuti; jika formal, match.',
    source: 'hospitality-tone',
  },
  {
    content: 'Response timing: Balas pesan customer dalam 2-5 menit. Jika butuh waktu untuk cari info, kirim "Sebentar ya, saya cek dulu" agar customer tahu pesannya dibaca. Jangan biarkan customer menunggu tanpa update.',
    source: 'hospitality-timing',
  },
  {
    content: 'Follow up best practice: Follow up 1 hari setelah check-in untuk pastikan semuanya baik. Follow up 1 minggu setelah check-out untuk minta review/feedback. Jangan follow up terlalu sering — max 2x per booking.',
    source: 'hospitality-followup',
  },
  {
    content: 'Handling special requests: Catat special request di sistem. Konfirmasi ulang sebelum arrival. Jika tidak bisa dipenuhi, tawarkan alternatif dan jelaskan alasannya. Contoh: "Mohon maaf kamar connecting tidak tersedia, tapi kami bisa siapkan kamar bersebelahan".',
    source: 'hospitality-special-request',
  },
  {
    content: 'De-escalation: Jika customer marah, jangan defensif. Gunakan teknik HEAR: Hear (dengarkan), Empathize (tunjukkan empati), Apologize (minta maaf), Resolve (berikan solusi). Pindahkan ke channel yang lebih personal jika perlu (telepon > chat).',
    source: 'hospitality-deescalation',
  },
];

async function seed(): Promise<void> {
  console.log('Seeding base skills to Pinecone...');
  const store = SemanticStore.getInstance();

  let success = 0;
  let failed = 0;

  for (const skill of BASE_SKILLS) {
    try {
      const id = await store.storeBaseSkill(skill.content, skill.source);
      console.log(`  ✓ ${skill.source} → ${id}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${skill.source}:`, err);
      failed++;
    }
  }

  console.log(`\nDone! ${success}/${BASE_SKILLS.length} seeded successfully.${failed > 0 ? ` ${failed} failed.` : ''}`);
  if (failed > 0) process.exit(1);
}

// Run if called directly
seed().catch(console.error);
