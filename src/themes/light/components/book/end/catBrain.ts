import type { Region } from "../cat/catData";

/* ==================================================================
   CAT BRAIN — how she answers being petted.

   Each part of her has its reaction clips (end/EndLayer plays them). A
   few rules keep it feeling like a cat rather than a jukebox:

   - a part petted again gets its next clip, where it has more than one
   - three pets within five seconds is enough: she yawns or scratches,
     and ignores the next two seconds
   - while she is reacting, pets are ignored, except on the tail
   - left alone, she does something of her own every 12-20 s
   - when the type blocks land in front of her, she looks down at them

   A clip the footage does not include falls back to one that it does.
   ================================================================== */

/* A part's own reaction first, then the nearest one that exists: a pet
   on the head reads as a chin scratch, a touch on the ear sets off a
   scratch, a stroke down the back sets the tail going. */
export const REACTIONS: Record<Region, string[]> = {
    head: ["pet-head", "chin"],
    chin: ["chin", "pet-head"],
    ear: ["ear", "scratch"],
    back: ["back", "tail"],
    tail: ["tail"],
    paws: ["paws"],
    neck: ["scratch"],
    face: ["yawn"],
};

const ENOUGH = ["yawn", "scratch"];
const FALLBACK = ["pet-head", "tail", "scratch", "yawn"];
const AMBIENT = ["yawn", "tail", "ear"];

export class CatBrain {
    private busyUntil = 0;
    private cooldownUntil = 0;
    private recent: number[] = [];
    private turn = new Map<Region, number>();
    lastActivity = 0;

    constructor(
        private has: (clip: string) => boolean,
        /* Starts a clip; returns its length in seconds. */
        private play: (clip: string) => number,
    ) {}

    pet(region: Region, now = performance.now()) {
        this.lastActivity = now;
        if (now < this.cooldownUntil) return;

        /* Counted even while she is busy: a flurry of pets is what makes it
           enough. */
        this.recent = this.recent.filter((t) => now - t < 5000);
        this.recent.push(now);
        if (this.recent.length >= 3) {
            this.recent = [];
            const clip = this.pick(ENOUGH);
            if (clip) this.start(clip, now, 2000);
            return;
        }
        if (now < this.busyUntil && region !== "tail") return;
        const own = REACTIONS[region].filter((c) => this.has(c));
        const i = this.turn.get(region) ?? 0;
        this.turn.set(region, i + 1);
        const clip = own.length > 0 ? own[i % own.length] : this.pick(FALLBACK);
        if (clip) this.start(clip, now);
    }

    /* Something of her own, if she is not busy. */
    ambient(now = performance.now()) {
        if (now < this.busyUntil) return;
        const clip = this.pick(AMBIENT);
        if (clip) this.start(clip, now);
        this.lastActivity = now;
    }

    arrive(now = performance.now()) {
        this.lastActivity = now;
        if (this.has("watch")) this.start("watch", now);
    }

    private start(clip: string, now: number, cooldown = 0) {
        const seconds = this.play(clip);
        this.busyUntil = now + seconds * 1000;
        if (cooldown) this.cooldownUntil = this.busyUntil + cooldown;
    }

    private pick(list: string[]) {
        const ok = list.filter((c) => this.has(c));
        return ok.length > 0 ? ok[Math.floor(Math.random() * ok.length)] : null;
    }
}
