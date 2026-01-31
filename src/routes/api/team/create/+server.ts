import type { RequestHandler } from '../$types';
import { adminDB, adminAuth } from '$lib/server/admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as referralCodes from 'referral-codes';
import { error, json } from '@sveltejs/kit';
import axios from "axios";
let existingTeamNames = new Set<string>();
let existingTeamCodes = new Map();
const indexRef = adminDB.collection("index").doc('nameIndex');
const userIndexRef = adminDB.collection("index").doc("userIndex");
let indexData = false;

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
    if (!indexData) {
        const doc = await indexRef.get();
        if (doc.exists) {
            const data = doc.data();
            if (data) {
                if (data.teamnames && Array.isArray(data.teamnames)) {
                    data.teamnames.forEach((e: string) => existingTeamNames.add(e));
                }
                existingTeamCodes = data.teamcodes || {};
            }
        }
        indexData = true; // Make sure to set this to true so we don't retry every time if it was successful (or partial)
    }

    if (locals.userID === null || !locals.userExists || locals.userTeam !== null) {
        return error(401, 'Unauthorized');
    }

    const body = await request.json();
    let { teamName } = body;
    if (teamName === undefined || teamName === null || teamName.trim() === "") return error(400, "Bad Request");
    teamName = teamName.toLowerCase();
    if (existingTeamNames.has(teamName)) return error(429, "Team name is already taken");
    try {
        await adminDB.runTransaction(async (transaction) => {
            const newTeamRef = adminDB.collection('teams').doc();
            const userRef = adminDB.collection('users').doc(locals.userID!);
            const teamID = newTeamRef.id;
            let teamCode = referralCodes.generate({
                length: 8,
                count: 1
            })[0].toLowerCase();

            // Safety check
            let attempts = 0;
            // Use Map .has() if we converted it, OR use Object check if we keep it Object.
            // Let's coerce to Object for checking if we didn't fully refactor the load logic yet, 
            // BUT simpler is to assume 'existingTeamCodes' is treated as Object in the load logic (line 20).
            // Line 20 says: existingTeamCodes = data.teamcodes; (which is Object from Firestore).
            // So treating it as Object is correct for the current load logic.
            // The issue might be line 20 failing if teamcodes is missing?
            // Or 'referralCodes' generating something bad?

            // Let's stick to Object access for now to match Line 20, but make it robust.
            while (attempts < 100 && existingTeamCodes[teamCode] !== undefined) {
                teamCode = referralCodes.generate({
                    length: 8,
                    count: 1,
                })[0].toLowerCase();
                attempts++;
            }
            if (attempts >= 100) throw new Error("Failed to generate unique team code");

            const teamMembers = [locals.userID,];
            const userRecord = await adminAuth.getUser(locals.userID!);
            let data = {
                created: FieldValue.serverTimestamp(),
                last_change: FieldValue.serverTimestamp(),
                teamName,
                uid: teamID,
                code: teamCode,
                owner: locals.userID,
                members: teamMembers,
                level: 1,
                banned: false,
                gsv_verified: false
            };
            if ((userRecord.email || "").endsWith("gsv.ac.in")) {
                data['gsv_verified'] = true;
            }
            transaction.set(newTeamRef, data);

            let data2 = {
                team: teamID
            };
            transaction.update(userRef, data2);

            const teamCodeKey = 'teamcodes.' + teamCode;
            const teamCountKey = 'teamcounts.' + teamCode;
            let data3 = {
                teamnames: FieldValue.arrayUnion(teamName)
            };
            data3[teamCodeKey] = teamID;
            data3[teamCountKey] = [locals.userID,];

            transaction.set(indexRef, data3, { merge: true });

            let data4 = {};
            data4[locals.userID] = teamID
            transaction.set(userIndexRef, data4, { merge: true });

            // Update local cache
            if (existingTeamCodes) {
                existingTeamCodes[teamCode] = teamID;
            }
            existingTeamNames.add(teamName);
        });

        // Webhook
        try {
            // Count query might fail if permissions/index issue, but shouldn't crash request
            let teamcount = 0;
            try {
                const countSnapshot = await adminDB.collection('teams').count().get();
                teamcount = countSnapshot.data().count;
            } catch (err) {
                console.warn("Failed to get team count", err);
            }

            if (process.env.WEBHOOK) await axios.post(process.env.WEBHOOK, {
                "content": "**New Team**\nName: " + teamName + "\nTeam Count: " + teamcount
            });
        } catch (webhookError) {
            console.error("Webhook error:", webhookError);
        }

        return json({ success: true });

    } catch (e: any) {
        // Safe logging
        console.error("Team Creation Error Stack:", e?.stack);
        console.error("Team Creation Error Message:", e?.message);
        return error(500, `Internal Server Error: ${e?.message || "Unknown error"}`);
    }
};

