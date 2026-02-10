import type { RequestHandler } from '@sveltejs/kit';
import { adminDB, adminAuth } from '$lib/server/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { error, json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies, locals }: any) => {

    if (locals.userID === null || !locals.userExists || locals.userTeam === null) {
        return error(401, 'Unauthorized');
    } else {

        const userDoc = await adminDB.collection('/users').doc(locals.userID).get();
        const teamId = userDoc.data()?.team;
        if (!teamId) return error(400, "User not in a team");
        const team = await adminDB.collection('/teams').doc(teamId).get();
        const level = team.data()?.level || 0;
        let isAdmin = false;
        try {
            if (userDoc.exists) {
                const userData = userDoc.data();
                isAdmin = userData?.role === 'admin' || userData?.role === 'exception';
            } else {
                console.error('User not found in database');
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
        const now = new Date();
        const startTime = new Date("2025-03-18T18:39:00Z");

        await adminDB.runTransaction(async (transaction) => {
            const userRef = adminDB.collection('users').doc(locals.userID!);
            const teamRef = adminDB.collection("teams").doc(locals.userTeam!);
            // Original nameIndexRef and userIndexRef are now declared inside their respective blocks
            // const nameIndexRef = adminDB.collection('index').doc('nameIndex');
            // const userIndexRef = adminDB.collection('index').doc('userIndex');

            const teamData = (await transaction.get(teamRef)).data();
            if (!(now <= startTime) && !isAdmin) return error(405, "Method Not Allowed");
            if (teamData === undefined) return error(404, "Not Found");
            let newMembers = teamData.members.filter((e: string) => e !== locals.userID);
            if (newMembers.length === 0) {
                await transaction.delete(teamRef);
                const nameIndexRef = adminDB.collection('nameIndex').doc('index');
                const nameIndexDoc = await transaction.get(nameIndexRef);
                let nameIndexData: Record<string, any> = nameIndexDoc.data() || { teamnames: {}, teamcodes: {}, teamcounts: {} };
                nameIndexData.teamnames = FieldValue.arrayRemove(teamData.teamName);
                nameIndexData[`teamcodes.${teamData.code}`] = FieldValue.delete();
                nameIndexData[`teamcounts.${teamData.code}`] = FieldValue.delete();
                await transaction.update(nameIndexRef, nameIndexData)
            } else {
                let data = {
                    owner: newMembers[0],
                    members: newMembers,
                    gsv_verified: true,
                };
                for (const id of newMembers) {
                    const userRecord = await adminAuth.getUser(id);
                    if (!userRecord.email?.toString().endsWith("gsv.ac.in")) {
                        data.gsv_verified = false;
                        break;
                    }
                }
                await transaction.update(teamRef, data);
                const nameIndexRef = adminDB.collection('nameIndex').doc('index');
                let nameIndexData: Record<string, any> = {}
                nameIndexData[`teamcounts.${teamData.code}`] = newMembers.length; // Changed to length as per common usage for counts
                await transaction.update(nameIndexRef, nameIndexData);
            }
            await transaction.update(userRef, {
                team: null,
            });
            const userIndexRef = adminDB.collection('userIndex').doc('index');
            let userIndexData: Record<string, any> = {};
            userIndexData[locals.userID] = null
            await transaction.update(userIndexRef, userIndexData);
        });
        return json({ success: true, message: "Successfully left the team" }, { status: 200 });
    }


};