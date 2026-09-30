"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import {
    CuboidCollider,
    Physics,
    RigidBody,
    useRapier,
    type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";
import { projects } from "@light/lib/site";
import { FOLD_START, RISE_END } from "./choreography";
import { usePaperTextures } from "./paperTexture";
import { BLOCK_H, Block, widthOf } from "./TypeBlock";
import "./rapier-console";

/* ==================================================================
   LETTERPRESS — the tech stack as wooden type, with real physics.

   The project in the spotlight has its stack set in maple type along the
   near edge of the page. The blocks drop onto the page one after another
   and land in a line. They are real rigid bodies (Rapier), so:

   - click one: it is flicked up and tumbles, knocking into its neighbours
     (and every card built with that technology lights up)
   - drag one: it follows the pointer across the page and is thrown on
     release
   - leave them: after a moment at rest, any block out of place walks
     itself back to its slot, upright, and the line re-forms

   When the spotlight moves on, the previous project's type sinks through
   the page from wherever it lies as the next set drops in.

   Units are centimetres, like the rest of the pop-up; gravity is 981.
   ================================================================== */

const GAP = 0.4;
const ROW_Z = 10.2;
/* Half the spread; blocks that leave it are put back. */
const PAGE = { x: 24.6, z: 16 };
/* Seconds at rest before a displaced block returns to its slot. */
const SETTLE_S = 1.5;

function lineFor(stack: readonly string[]) {
    const total = stack.reduce((s, n) => s + widthOf(n), 0) + GAP * (stack.length - 1);
    let x = -total / 2;
    return stack.map((name, order) => {
        const w = widthOf(name);
        const slot = { name, order, w, x: x + w / 2 };
        x += w + GAP;
        return slot;
    });
}
const LINES = projects.map((p) => lineFor(p.tech));

/* Every letter the type blocks will ever show. The first set of blocks
   used to be the first text in this font, so troika built its glyphs then,
   on the GPU with a synchronous read-back: a ~150 ms stall right as the
   pop-up came into view. Preloaded, it happens during WarmUp instead. */
const TYPE_CHARS = [...new Set(projects.flatMap((p) => p.tech).join(""))].join("");

type Pose = { p: THREE.Vector3; q: THREE.Quaternion };

export default function Letterpress({
    local,
    spot,
    selected,
    tech,
    visible,
    onTech,
}: {
    local: MotionValue<number>;
    spot: number;
    selected: number | null;
    tech: string | null;
    visible: boolean;
    onTech: (t: string) => void;
}) {
    const [mapleSrc] = usePaperTextures(["/book/props/maple.webp"]);
    const maple = useMemo(() => {
        const t = mapleSrc.clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(0.35, 0.35);
        t.needsUpdate = true;
        return t;
    }, [mapleSrc]);

    /* Type is only set while the spotlight part of the hold is on. */
    const [inRange, setInRange] = useState(() => {
        const lp = local.get();
        return lp > RISE_END && lp < FOLD_START;
    });
    useEffect(
        () =>
            local.on("change", (lp) => {
                const v = lp > RISE_END && lp < FOLD_START;
                setInRange((cur) => (cur === v ? cur : v));
            }),
        [local],
    );
    const focus = inRange ? (selected ?? spot) : -1;

    /* Where every live block is, so a set that is replaced can sink from
       where it actually lies rather than from its slot. */
    const poses = useRef(new Map<string, Pose>());
    const [leaving, setLeaving] = useState<{ id: number; focus: number } | null>(null);
    const prevFocus = useRef(focus);
    useEffect(() => {
        const was = prevFocus.current;
        prevFocus.current = focus;
        if (was < 0 || was === focus) return;
        const id = performance.now();
        /* Deferred a tick: a state change straight from an effect body is a
           cascading render. */
        const start = window.setTimeout(() => setLeaving({ id, focus: was }), 0);
        const end = window.setTimeout(() => setLeaving((l) => (l?.id === id ? null : l)), 600);
        return () => {
            window.clearTimeout(start);
            window.clearTimeout(end);
        };
    }, [focus]);

    return (
        <>
            {/* A type block the size of a speck, under the page, there from
                the start. The real blocks only exist once a project is in
                the spotlight, so WarmUp never saw their material: its
                shaders compiled on the first live frame, a ~110 ms wait on
                the GPU just as the pop-up came into view. This one gets
                them compiled, and its glyphs (drei suspends on
                `characters`, inside the scene's Suspense) built and
                uploaded, during the warm-up. */}
            <group scale={0.001} position={[0, -1, 0]}>
                <Block name={TYPE_CHARS} w={1} texture={maple} pressed={false} characters={TYPE_CHARS} />
            </group>
            <Physics gravity={[0, -981, 0]} paused={!visible}>
                {/* The page: a slab under y = 0, the size of the spread. Thick
                    on purpose: a block dropped from 10 cm meets it at ~140
                    cm/s, 2.3 cm per step, and a 1 cm slab let blocks
                    tunnel straight through. */}
                <RigidBody type="fixed" colliders={false}>
                    <CuboidCollider args={[PAGE.x, 5, PAGE.z]} position={[0, -5, 0]} friction={0.9} />
                </RigidBody>

                {focus >= 0 &&
                    LINES[focus].map((slot) => (
                        <TypeBlock
                            key={`${focus}:${slot.name}`}
                            {...slot}
                            texture={maple}
                            pressed={tech === slot.name}
                            onPress={() => onTech(slot.name)}
                            poses={poses}
                        />
                    ))}
            </Physics>

            {leaving &&
                LINES[leaving.focus]?.map((slot) => (
                    <SinkingBlock
                        key={`${leaving.id}:${slot.name}`}
                        {...slot}
                        poses={poses}
                        texture={maple}
                    />
                ))}
        </>
    );
}

/* ------------------------------------------------------------------ */

const UPRIGHT = new THREE.Quaternion();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
/* The plane a dragged block is carried on: a block's height above the page. */
const DRAG_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6);

type Drag = { sx: number; sy: number; last: THREE.Vector3; v: THREE.Vector3; moved: boolean };

function TypeBlock({
    name,
    order,
    w,
    x,
    texture,
    pressed,
    onPress,
    poses,
}: {
    name: string;
    order: number;
    w: number;
    x: number;
    texture: THREE.Texture;
    pressed: boolean;
    onPress: () => void;
    poses: React.RefObject<Map<string, Pose>>;
}) {
    const body = useRef<RapierRigidBody>(null);
    const { rapier } = useRapier();
    const [hovered, setHovered] = useState(false);
    useCursor(hovered);

    const slot = useMemo(() => new THREE.Vector3(x, BLOCK_H / 2 + 0.01, ROW_Z), [x]);
    /* Time at rest, whether it is walking home, and any drag in progress. */
    const s = useRef({ rest: 0, homing: false, drag: null as Drag | null });

    useFrame((_, dt) => {
        const b = body.current;
        if (!b) return;
        const st = s.current;
        const t = b.translation();
        const r = b.rotation();

        const map = poses.current;
        const pose = map.get(name) ?? { p: new THREE.Vector3(), q: new THREE.Quaternion() };
        pose.p.set(t.x, t.y, t.z);
        pose.q.set(r.x, r.y, r.z, r.w);
        map.set(name, pose);

        if (process.env.NODE_ENV !== "production") {
            const w = window as unknown as { __blocks?: Record<string, unknown> };
            (w.__blocks ??= {})[name] = {
                y: +t.y.toFixed(2),
                x: +t.x.toFixed(2),
                type: b.bodyType(),
                homing: st.homing,
                rest: +st.rest.toFixed(2),
                sleeping: b.isSleeping(),
            };
        }

        if (st.drag) return;

        /* Flicked off the page: put it back above its slot. */
        if (t.y < -15 || Math.abs(t.x) > PAGE.x + 6 || Math.abs(t.z) > PAGE.z + 6) {
            b.setTranslation({ x: slot.x, y: 6, z: slot.z }, true);
            b.setLinvel({ x: 0, y: 0, z: 0 }, true);
            b.setAngvel({ x: 0, y: 0, z: 0 }, true);
            b.setRotation(UPRIGHT, true);
            return;
        }

        if (st.homing) {
            /* Walk to the slot, upright, then hand back to physics. */
            const k = 1 - Math.exp(-6 * dt);
            tmpV.set(t.x, t.y, t.z).lerp(slot, k);
            tmpQ.copy(pose.q).slerp(UPRIGHT, k);
            b.setNextKinematicTranslation(tmpV);
            b.setNextKinematicRotation(tmpQ);
            if (tmpV.distanceTo(slot) < 0.05 && tmpQ.angleTo(UPRIGHT) < 0.02) {
                st.homing = false;
                b.setBodyType(rapier.RigidBodyType.Dynamic, true);
            }
            return;
        }

        const v = b.linvel();
        const av = b.angvel();
        const still = Math.hypot(v.x, v.y, v.z) < 1.5 && Math.hypot(av.x, av.y, av.z) < 0.6;
        st.rest = still ? st.rest + dt : 0;
        const out = pose.p.distanceTo(slot) > 0.3 || pose.q.angleTo(UPRIGHT) > 0.08;
        if (st.rest > SETTLE_S && out) {
            st.homing = true;
            st.rest = 0;
            b.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        }
    });

    const onDown = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const hit = e.ray.intersectPlane(DRAG_PLANE, new THREE.Vector3()) ?? slot.clone();
        s.current.homing = false;
        s.current.drag = { sx: e.clientX, sy: e.clientY, last: hit, v: new THREE.Vector3(), moved: false };
    };

    const onMove = (e: ThreeEvent<PointerEvent>) => {
        const d = s.current.drag;
        const b = body.current;
        if (!d || !b) return;
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) {
            d.moved = true;
            b.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        }
        if (!d.moved) return;
        const hit = e.ray.intersectPlane(DRAG_PLANE, new THREE.Vector3());
        if (!hit) return;
        hit.x = THREE.MathUtils.clamp(hit.x, -PAGE.x, PAGE.x);
        hit.z = THREE.MathUtils.clamp(hit.z, -PAGE.z, PAGE.z);
        /* Velocity for the throw, from the last move. */
        d.v.copy(hit).sub(d.last).multiplyScalar(60);
        d.last = hit;
        b.setNextKinematicTranslation(hit);
    };

    const onUp = (e: ThreeEvent<PointerEvent>) => {
        const d = s.current.drag;
        const b = body.current;
        s.current.drag = null;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
        if (!d || !b) return;
        if (d.moved) {
            /* Let go: back to physics, carrying the hand's speed. */
            b.setBodyType(rapier.RigidBodyType.Dynamic, true);
            d.v.clampLength(0, 400);
            b.setLinvel({ x: d.v.x, y: 30, z: d.v.z }, true);
            return;
        }
        /* A click: flick it up and away from where it was hit, spinning. */
        const m = b.mass();
        const away = e.point.x < b.translation().x ? 1 : -1;
        b.applyImpulse(
            { x: away * m * (60 + Math.random() * 60), y: m * (230 + Math.random() * 90), z: m * (Math.random() - 0.5) * 80 },
            true,
        );
        b.applyTorqueImpulse(
            { x: m * (Math.random() - 0.5) * 14, y: m * (Math.random() - 0.5) * 10, z: m * (Math.random() - 0.5) * 14 },
            true,
        );
        onPress();
    };

    return (
        <RigidBody
            ref={body}
            colliders="cuboid"
            /* Dropped from above its slot, the first of the line first. */
            position={[x, 3.2 + order * 0.9, ROW_Z]}
            /* Continuous collision: small, fast blocks must not pass
               through the page or each other between steps. */
            ccd
            restitution={0.22}
            friction={0.85}
            linearDamping={0.35}
            angularDamping={0.7}
        >
            <group
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={() => setHovered(false)}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
            >
                <Block name={name} w={w} texture={texture} pressed={pressed} />
            </group>
        </RigidBody>
    );
}

/* A replaced block, sinking through the page from where it lay. */
function SinkingBlock({
    name,
    w,
    x,
    poses,
    texture,
}: {
    name: string;
    w: number;
    x: number;
    poses: React.RefObject<Map<string, Pose>>;
    texture: THREE.Texture;
}) {
    const ref = useRef<THREE.Group>(null);
    const start = useRef<number | null>(null);
    const from = useRef<Pose | null>(null);
    useFrame(({ clock }) => {
        const g = ref.current;
        if (!g) return;
        if (start.current === null) {
            start.current = clock.elapsedTime;
            const p = poses.current.get(name);
            from.current = p ? { p: p.p.clone(), q: p.q.clone() } : null;
        }
        const t = Math.min(1, (clock.elapsedTime - start.current) / 0.5);
        const f = from.current;
        g.position.set(f?.p.x ?? x, (f?.p.y ?? BLOCK_H / 2) - t * t * 2.2, f?.p.z ?? ROW_Z);
        if (f) g.quaternion.copy(f.q);
        g.scale.setScalar(Math.max(0.001, 1 - t));
    });
    return (
        <group ref={ref}>
            <Block name={name} w={w} texture={texture} pressed={false} />
        </group>
    );
}
