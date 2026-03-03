// ============================================================
//  Cipher Saga — Bonus Questions Bulk Upload Script
//  Usage: node scripts/upload-bonus-questions.js
//  Requires: .env file with FB_PROJECT_ID, FB_PRIVATE_KEY, FB_CLIENT_EMAIL
// ============================================================

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config(); // Load .env

// ---- Init Firebase Admin ----
initializeApp({
    credential: cert({
        projectId: process.env.FB_PROJECT_ID,
        privateKey: process.env.FB_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FB_CLIENT_EMAIL,
    }),
});

const db = getFirestore();

// ============================================================
//  ✏️  EDIT THIS ARRAY to add your bonus questions
//  Each object = one document in bonusQuestions collection
//  qrString: the text encoded inside the printed QR code
// ============================================================
const QUESTIONS = [
    {
        id: 'bonus_campus_mystery_01',          // Firestore document ID (must be unique)
        title: 'Campus Mystery',
        description: 'A secret hidden in plain sight on campus',
        question: 'What is written on the main gate?',
        hint: 'Look at the entrance arch carefully',
        answer: 'Knowledge',                    // Case-insensitive match at submission
        qrString: 'BONUS_QR_001',              // Must match text encoded in QR code
        points: 150,
        negative_points: 75,
        isSolved: false,
        isVisible: true,
        solvedByTeamId: null,
        solvedAt: null,
    },
    {
        id: 'bonus_library_secret_02',
        title: 'Library Secret',
        description: 'Books hold more than stories',
        question: 'What year was the library established?',
        hint: 'Check the stone plaque near the entrance',
        answer: '1998',
        qrString: 'BONUS_QR_002',
        points: 200,
        negative_points: 100,
        isSolved: false,
        isVisible: true,
        solvedByTeamId: null,
        solvedAt: null,
    },
    {
        id: 'bonus_lab_cipher_03',
        title: 'Lab Cipher',
        description: 'The answer lies in the machines',
        question: 'What is the lab number on the 3rd floor?',
        hint: 'Walk down the corridor near the staircase',
        answer: '301',
        qrString: 'BONUS_QR_003',
        points: 250,
        negative_points: 125,
        isSolved: false,
        isVisible: true,
        solvedByTeamId: null,
        solvedAt: null,
    },
    // ➕ Add more questions here following the same format...
];

// ============================================================
//  Upload Logic — no need to edit below this line
// ============================================================
async function uploadQuestions() {
    console.log(`\n🚀 Uploading ${QUESTIONS.length} bonus questions...\n`);

    const batch = db.batch();

    for (const q of QUESTIONS) {
        const { id, ...data } = q;
        const ref = db.collection('bonusQuestions').doc(id);
        batch.set(ref, {
            ...data,
            createdAt: Timestamp.now(),
        });
        console.log(`  ✅ Queued: ${id}`);
    }

    await batch.commit();
    console.log(`\n✨ Done! ${QUESTIONS.length} questions uploaded to Firestore.\n`);
}

uploadQuestions().catch((err) => {
    console.error('❌ Upload failed:', err);
    process.exit(1);
});
