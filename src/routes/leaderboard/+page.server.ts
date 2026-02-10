/** @type {import('./$types').PageLoad} */
import { adminDB } from "@/server/admin";
let loaded = false;
let leaderboard: any[] = [];
let queryDef = adminDB.collection("teams").orderBy("level", "desc").orderBy("last_change");

export const load = async ({ params, locals }: any) => {
    if (!loaded) {
        const qSnap = await queryDef.get();
        qSnap.docs.forEach((e) => {
            const data = e.data();
            leaderboard.push({
                teamName: data.teamName,
                score: (data.level - 1) * 100,
                members: data.members.length,
                gsv: data.gsv_verified
            });
        });
        queryDef.onSnapshot((snap) => {
            const newData: any[] = [];
            snap.docs.forEach((e) => {
                const data = e.data()
                newData.push({
                    teamName: data.teamName,
                    score: (data.level - 1) * 100,
                    members: data.members.length,
                    gsv: data.gsv_verified
                });
            });
            leaderboard = newData;
        });
        loaded = true;
    }
    return {
        leaderboard
    };
};
