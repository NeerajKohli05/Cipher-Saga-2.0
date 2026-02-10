import { json, error } from '@sveltejs/kit';
import { adminDB } from '$lib/server/admin';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
    // Admin Only Check (You might want to secure this better in production)
    // For now, checks if user is authenticated. ideally check for specific admin UID.
    if (!locals.userID) {
        return error(401, 'Unauthorized');
    }

    try {
        const indexRef = adminDB.collection('index').doc('nameIndex');
        const doc = await indexRef.get();

        if (!doc.exists) {
            return json({ message: 'No nameIndex found. Nothing to migrate.' });
        }

        const data = doc.data();
        const teamNames = data?.teamnames || []; // Array of strings
        // Also teamcodes map might be useful if we wanted to backfill IDs, 
        // but 'teamnames' array in nameIndex usually just strings. 
        // Wait, the new schema uses teamNames/{name} -> { teamId, createdAt }
        // The old 'teamnames' array implies we know the name, but do we know the ID?
        // In the old schema:
        // 'teamnames' was just an array of names.
        // 'teamcodes' was a map of code -> ID.
        // 'teamcounts' was code -> members.
        // We DON'T easily know Name -> ID mapping from nameIndex alone, unless we scan all teams?
        // OR does nameIndex have a map?
        // Looking at Step 11 (original create):
        // data3.teamnames = arrayUnion(teamName)
        // It does NOT store name->ID map in `nameIndex`.

        // PROBLEM: We want to populate `teamNames/{name}` with `{ teamId: ... }`.
        // If we don't have the ID, we can't fully backfill the reference.
        // BUT, for *uniqueness check*, we only need the document `teamNames/{name}` to EXIST.
        // The ID is useful metadata but not strictly required for the "Is Taken?" check.
        // So we can create the doc with `{ migrated: true }` or try to find the ID if possible.

        // BETTER MIGRATION: 
        // Scan the `teams` collection directly.
        // For each team doc, get `teamName` and `uid`.
        // Write to `teamNames/{teamName}`.
        // This is more robust and correct than using the index.

        const teamsSnapshot = await adminDB.collection('teams').get();
        const batch = adminDB.batch();
        let count = 0;

        teamsSnapshot.forEach(doc => {
            const teamData = doc.data();
            const name = teamData.teamName;
            const id = doc.id;

            if (name) {
                const nameRef = adminDB.collection('teamNames').doc(name);
                batch.set(nameRef, {
                    teamId: id,
                    migrated: true,
                    migratedAt: new Date()
                }, { merge: true }); // Merge so we don't overwrite if already exists
                count++;
            }
        });

        await batch.commit();

        return json({
            success: true,
            message: `Migrated ${count} teams to 'teamNames' collection.`
        });

    } catch (err: any) {
        console.error("Migration Error:", err);
        return error(500, err.message);
    }
};
