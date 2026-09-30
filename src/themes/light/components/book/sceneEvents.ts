/* ==================================================================
   SCENE EVENTS — things in the room nudging each other.

   The cat's footage is prerecorded, but the pen and the ribbon are live
   (PenLayer, PullCord), so when the cat walks past them it has to tell
   them. At cue times in its clips the cat layer emits:

     penNudge     the resting pen is brushed: it rolls a few degrees and
                  shifts a little along the cloth (dx in cm, rot in deg)
     gust         a hanging cord is brushed: a short decaying push of
                  wind on the named cord ("ribbon")

   A plain synchronous emitter, nothing more.
   ================================================================== */

type Events = {
    penNudge: { dx: number; rot: number };
    gust: { cord: string; strength: number };
};

type Handler<K extends keyof Events> = (e: Events[K]) => void;

const handlers: { [K in keyof Events]: Set<Handler<K>> } = {
    penNudge: new Set(),
    gust: new Set(),
};

export function onScene<K extends keyof Events>(name: K, cb: Handler<K>) {
    handlers[name].add(cb);
    return () => {
        handlers[name].delete(cb);
    };
}

export function emitScene<K extends keyof Events>(name: K, e: Events[K]) {
    handlers[name].forEach((cb) => cb(e));
}
