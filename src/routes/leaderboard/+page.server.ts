/** @type {import('./$types').PageLoad} */
import { adminDB } from "@/server/admin";
let loaded = false;
let leaderboard: any[] = [];
let queryDef = adminDB.collection("teams").orderBy("level", "desc").orderBy("last_change");

export const load = async ({ params, locals }: any) => {
    try {
        if (!loaded) {
            const qSnap = await queryDef.get();
            qSnap.docs.forEach((e) => {
                const data = e.data() || {};
                const members = data.members || [];
                leaderboard.push({
                    teamName: data.teamName || "Unknown Team",
                    score: ((data.level || 1) - 1) * 100,
                    members: members.length,
                    gsv: data.gsv_verified || false
                });
            });
            queryDef.onSnapshot((snap) => {
                const newData: any[] = [];
                snap.docs.forEach((e) => {
                    const data = e.data() || {};
                    const members = data.members || [];
                    newData.push({
                        teamName: data.teamName || "Unknown Team",
                        score: ((data.level || 1) - 1) * 100,
                        members: members.length,
                        gsv: data.gsv_verified || false
                    });
                });
                leaderboard = newData;
            });
            loaded = true;
        }
        return {
            leaderboard
        };
    } catch (error: any) {
        console.error("Leaderboard Load Error:", error);
        return {
            leaderboard: [],
            error: error.message
        };
    }
};
