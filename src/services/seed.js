import { storage } from './storage';

// These IDs are deliberately hard-coded and must never change: sessions already
// stored on users' devices reference them via drill_type_id.
const DEFAULT_DRILLS = [
  {
    id: 'd091fc9d-9b1f-4f8d-a171-2abac4bb6275',
    name: 'Putting by Distance',
    description: 'Practice putting accuracy at various distances',
    scoring_type: 'made_missed',
    categories: ["under 3'", "3-6'", "6-12'", "12'+"],
    metadata: null,
    is_default: true
  },
  {
    id: '0d76754f-dd5d-438c-bb4c-133eb3b10eb0',
    name: 'Chipping Target Practice',
    description: 'Chip to target from various distances',
    scoring_type: 'made_missed',
    categories: ["10-20'", "30-50'", "50'+"],
    metadata: null,
    is_default: true
  },
  {
    id: 'd892f6e3-84ad-4f82-96e8-5513ca7e2cbc',
    name: 'Par 18',
    description: '9 balls off the green - chip on then putt',
    scoring_type: 'stroke_count',
    categories: ['ball'],
    metadata: { total_balls: 9 },
    is_default: true
  }
];

export async function seedDefaultDrills() {
  try {
    const existing = await storage.getDrills();
    if (existing.length > 0) {
      console.log('✓ Drills already exist, skipping seed');
      return;
    }

    console.log('📝 Seeding default drills...');
    const now = Date.now();
    for (const drill of DEFAULT_DRILLS) {
      await storage.saveDrill({
        ...drill,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });
    }
    console.log('✅ Default drills seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed default drills:', error);
  }
}
