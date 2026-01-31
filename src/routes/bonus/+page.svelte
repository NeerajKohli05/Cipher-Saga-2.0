<script lang="ts">
    import { Doc, Collection } from "sveltefire";
    import { auth, db } from "$lib/firebase";
    import { userStore } from "sveltefire";
    import QRScanner from "$lib/components/QRScanner.svelte";
    import {
        sendErrorToast,
        sendSuccessToast,
        sendInfoToast,
    } from "$lib/toast_utils"; // Added Info Toast if available, or fallback
    import { fade, slide } from "svelte/transition";

    const user = userStore(auth);

    let manualCode = "";
    let submitting = false;
    let submittingAnswer = false;

    // State for the active question (after scanning)
    let activeBonus: { qrCode: string; hint: string; question: string } | null =
        null;
    let answerInput = "";

    async function handleClaim(code: string) {
        if (!code) return;
        submitting = true;

        try {
            const res = await fetch("/api/bonus/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ qrCode: code }),
            });

            const data = await res.json();

            if (res.ok) {
                // SUCCESS: Lock the question and show the input interface
                activeBonus = {
                    qrCode: code,
                    hint: data.hint,
                    question: data.question,
                };
                sendSuccessToast(
                    data.message || "Bonus Found!",
                    "Solving time!",
                );
                manualCode = ""; // clear input
            } else {
                if (res.status === 409) {
                    sendErrorToast("Too Late!", data.message);
                } else if (res.status === 404) {
                    sendErrorToast(
                        "Invalid Code",
                        "This QR code is not a bonus.",
                    );
                } else {
                    sendErrorToast(
                        "Error",
                        data.message || "Failed to claim bonus",
                    );
                }
            }
        } catch (e) {
            console.error(e);
            sendErrorToast("Error", "Network error occurred");
        } finally {
            submitting = false;
        }
    }

    async function handleSubmitAnswer() {
        if (!activeBonus || !answerInput.trim()) return;
        submittingAnswer = true;

        try {
            const res = await fetch("/api/bonus/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    qrCode: activeBonus.qrCode,
                    answer: answerInput,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.correct) {
                    sendSuccessToast("Correct!", data.message);
                    activeBonus = null; // Clear state, back to scanner
                    answerInput = "";
                } else {
                    sendErrorToast("Wrong Answer", data.message);
                    // Do not clear activeBonus, let them try again (with penalty)
                }
            } else {
                sendErrorToast("Submission Error", data.message);
            }
        } catch (e) {
            console.error(e);
            sendErrorToast("Error", "Network error submitting answer");
        } finally {
            submittingAnswer = false;
        }
    }

    function onScan(event: CustomEvent) {
        handleClaim(event.detail.code);
    }

    function cancelActive() {
        activeBonus = null;
        answerInput = "";
    }
</script>

<div class="min-h-screen pt-20 px-4 pb-12 bg-zinc-950 text-white font-mono">
    <div class="max-w-4xl mx-auto">
        <h1
            class="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-8 text-center"
        >
            Bonus Hunt
        </h1>

        {#if activeBonus}
            <!-- ANSWER INTERFACE -->
            <div
                class="card bg-zinc-900 shadow-xl border-2 border-accent mb-8"
                in:slide
            >
                <div class="card-body">
                    <h2 class="card-title text-2xl text-accent mb-4">
                        Target Locked!
                    </h2>

                    <div class="bg-zinc-800 p-4 rounded-lg mb-4">
                        <h3
                            class="font-bold text-zinc-400 text-sm uppercase mb-1"
                        >
                            Question
                        </h3>
                        <p class="text-lg text-white">{activeBonus.question}</p>
                    </div>

                    <div
                        class="bg-zinc-800/50 p-4 rounded-lg mb-6 border-l-4 border-info"
                    >
                        <h3 class="font-bold text-info text-sm uppercase mb-1">
                            Hint
                        </h3>
                        <p class="text-zinc-300 italic">{activeBonus.hint}</p>
                    </div>

                    <div class="form-control w-full">
                        <label class="label" for="answer">
                            <span class="label-text text-zinc-400"
                                >Your Answer</span
                            >
                        </label>
                        <div class="join w-full">
                            <input
                                id="answer"
                                type="text"
                                placeholder="Type answer here..."
                                class="input input-bordered input-accent join-item w-full bg-zinc-950 text-white"
                                bind:value={answerInput}
                                on:keydown={(e) =>
                                    e.key === "Enter" && handleSubmitAnswer()}
                            />
                            <button
                                class="btn btn-accent join-item"
                                disabled={submittingAnswer || !answerInput}
                                on:click={handleSubmitAnswer}
                            >
                                {#if submittingAnswer}
                                    <span
                                        class="loading loading-spinner loading-xs"
                                    ></span>
                                {:else}
                                    Submit
                                {/if}
                            </button>
                        </div>
                        <label class="label">
                            <span class="label-text-alt text-error"
                                >Warning: Incorrect answers deduct points.</span
                            >
                        </label>
                    </div>

                    <div class="card-actions justify-end mt-4">
                        <button
                            class="btn btn-ghost btn-sm text-zinc-500"
                            on:click={cancelActive}
                            >Cancel / Scan Another</button
                        >
                    </div>
                </div>
            </div>
        {:else}
            <!-- SCANNER SECTION -->
            <div
                class="card bg-zinc-900 shadow-xl border border-zinc-800 mb-8"
                in:fade
            >
                <div class="card-body items-center text-center">
                    <h2 class="card-title text-accent mb-2">Scan to Claim</h2>
                    <p class="text-sm text-zinc-400 mb-4">
                        Be the first to scan the QR code. Once scanned, the
                        question stays with you.
                    </p>
                    <QRScanner on:scan={onScan} />

                    <div class="divider text-zinc-600">OR</div>

                    <div class="join w-full max-w-sm">
                        <input
                            type="text"
                            placeholder="Enter code manually..."
                            class="input input-bordered join-item w-full bg-zinc-950 border-zinc-700 focus:border-accent"
                            bind:value={manualCode}
                        />
                        <button
                            class="btn btn-accent join-item"
                            disabled={submitting}
                            on:click={() => handleClaim(manualCode)}
                        >
                            {#if submitting}
                                <span class="loading loading-spinner loading-xs"
                                ></span>
                            {:else}
                                Claim
                            {/if}
                        </button>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Active Bonuses List -->
        <h2
            class="text-2xl font-bold mb-4 text-zinc-300 border-l-4 border-purple-500 pl-3"
        >
            Live Feed
        </h2>

        <Collection ref="bonuses" let:data={bonuses} let:count>
            {#if count === 0}
                <p class="text-zinc-500 italic">No bonuses live yet.</p>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each bonuses as bonus}
                        <!-- Only show if it is NOT claimed, OR if it is solved (to show history/glory) -->
                        <!-- Actually requirement said: "Once scanned... question will be removed from the bonus section" -->
                        <!-- So we hide it if 'isClaimed' is true. Unless we want to show it as "Claimed" to induce jealousy. -->
                        <!-- Let's hide it if claimed, as per user request "question will be removed...". 
                             BUT, user might want to see THEIR active bonuses? 
                             The 'activeBonus' state handles the immediate interaction. 
                             If they leave page and come back, they might need a way to restore it. 
                             For now, let's just HIDE claimed bonuses from the public list. -->

                        {#if !bonus.isClaimed}
                            <div
                                class="card bg-zinc-900 border border-zinc-800 shadow-lg hover:border-zinc-700 transition-all opacity-100"
                            >
                                <div class="card-body">
                                    <div
                                        class="flex justify-between items-start"
                                    >
                                        <h3
                                            class="card-title text-lg text-zinc-200"
                                        >
                                            {bonus.title || "Mystery Bonus"}
                                        </h3>
                                        <span
                                            class="badge badge-success gap-1 animate-pulse"
                                            >Available</span
                                        >
                                    </div>
                                    <p class="text-zinc-400 text-sm mt-2">
                                        {bonus.description ||
                                            "Find the QR code to unlock."}
                                    </p>
                                    <div
                                        class="mt-4 flex justify-between items-center text-xs text-zinc-500"
                                    >
                                        <span
                                            >Value: <span
                                                class="text-accent font-bold"
                                                >{bonus.points || 10} pts</span
                                            ></span
                                        >
                                    </div>
                                </div>
                            </div>
                        {:else if bonus.isClaimed && bonus.isSolved}
                            <!-- Optionally show solved bonuses as "Sold Out" -->
                            <div
                                class="card bg-zinc-900/50 border border-zinc-800/50 shadow-none opacity-50 grayscale"
                            >
                                <div class="card-body">
                                    <div
                                        class="flex justify-between items-start"
                                    >
                                        <h3
                                            class="card-title text-lg text-zinc-200"
                                        >
                                            {bonus.title || "Mystery Bonus"}
                                        </h3>
                                        <span class="badge badge-ghost gap-1"
                                            >Solved</span
                                        >
                                    </div>
                                    <p class="text-zinc-600 text-sm mt-2">
                                        Claimed by Team {bonus.claimedBy?.slice(
                                            0,
                                            5,
                                        )}...
                                    </p>
                                </div>
                            </div>
                        {:else}
                            <!-- Claimed but not solved. Hidden from list as per request "removed from bonus section". -->
                        {/if}
                    {/each}
                </div>
            {/if}
            <div slot="loading" class="flex justify-center p-8">
                <span class="loading loading-spinner loading-lg text-accent"
                ></span>
            </div>
        </Collection>
    </div>
</div>
