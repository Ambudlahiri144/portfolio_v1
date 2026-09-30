"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, useCursor } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";
import { projects } from "@light/lib/site";
import { manifest } from "../timeline";
import { hingeAt } from "./choreography";
import Letterpress from "./Letterpress";
import { usePaperTextures } from "./paperTexture";
import "../../three-console";

/* ==================================================================
   POP-UP SCENE — paper cards standing up off a photographed page.

   The background is the front rest frame of the footage, drawn by the
   book canvas underneath. This canvas is transparent and placed exactly
   over that frame, with the camera scripts/calibrate-camera.mjs solved
   from it, so y = 0 here IS the page in the photo.

   Units are centimetres. The spine runs along x = 0, +x is the right
   page, +z comes toward the camera. The spread is 49.2 x 32 cm.

   What sells the paper as being in the photo is not the geometry, it
   is the shadow: a shadow-only plane on the page takes the cards'
   shadows from a light placed where the footage's window is.
   ================================================================== */


/* Start the textures downloading the moment this module is imported
   (PopupLayer imports it when the page goes idle), not when it mounts. */
usePaperTextures.preload([
    "/book/props/cardstock.webp",
    "/book/props/maple.webp",
    ...projects.map((p) => p.image.replace("/projects/", "/book/props/shots/")),
]);

const CAM = manifest.camera;
const FONT_TITLE = "/book/fonts/cormorant-600.ttf";
const FONT_ITALIC = "/book/fonts/cormorant-500-italic.ttf";

/* One row across the spread, fanned into a shallow arc: the outer cards
   stand a little nearer and turn in toward the middle, the way a pop-up
   stage frames itself. A single row keeps every card whole from this
   camera; two rows hid each other. */
const LAYOUT = [
    { x: -17.4, z: -2.2, yaw: 0.2, w: 10.4, h: 8.2 },
    { x: -5.9, z: -4.6, yaw: 0.06, w: 10.4, h: 8.2 },
    { x: 5.9, z: -4.6, yaw: -0.06, w: 10.4, h: 8.2 },
    { x: 17.4, z: -2.2, yaw: -0.2, w: 10.4, h: 8.2 },
] as const;

const INK = "#3f2a1d";
const INK_SOFT = "#6e513c";

type Props = {
    local: MotionValue<number>;
    spot: number;
    selected: number | null;
    tech: string | null;
    visible: boolean;
    onSelect: (i: number | null) => void;
    onTech: (t: string) => void;
};

export default function PopupScene(props: Props) {
    /* Nothing draws on its own until the GPU is ready (see WarmUp): a draw
       before the shaders finish compiling waits for them, on the main
       thread. Only matters when the reader lands right on the pop-up. */
    const [warm, setWarm] = useState(false);
    return (
        <Canvas
            /* "percentage" is PCFShadowMap. Plain `shadows` asks for
               PCFSoftShadowMap, which three r183+ deprecates and swaps for
               PCF anyway, with a warning. */
            shadows="percentage"
            flat
            dpr={[1, 1.5]}
            /* Mounted before the reader arrives (see PopupLayer), so off
               screen it renders only on demand: once, to warm up. */
            frameloop={props.visible && warm ? "always" : "demand"}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            camera={{
                fov: CAM.fov,
                near: CAM.near,
                far: CAM.far,
                position: CAM.position as [number, number, number],
                quaternion: CAM.quaternion as [number, number, number, number],
            }}
            onPointerMissed={() => props.onSelect(null)}
            style={{ pointerEvents: props.visible ? "auto" : "none" }}
        >
            <CameraPose />
            <Lights />
            <ShadowCatcher />
            {calibrating() && <CalibrationOutline />}
            <Suspense fallback={null}>
                {projects.map((p, i) => (
                    <Card
                        key={p.title}
                        index={i}
                        {...props}
                        highlighted={props.tech !== null && p.tech.includes(props.tech)}
                    />
                ))}
                <Letterpress
                    local={props.local}
                    spot={props.spot}
                    selected={props.selected}
                    tech={props.tech}
                    visible={props.visible}
                    onTech={props.onTech}
                />
                <WarmUp onDone={() => setWarm(true)} />
            </Suspense>
        </Canvas>
    );
}

/* Inside the Suspense boundary, so it runs once the textures and fonts are
   in. It gets the GPU ready while the canvas is still at opacity 0 on the
   page before, so the first visible frame of the pop-up has nothing left
   to do. Measured without it, that frame stalled the page for ~250 ms.

   Done in one frame, the warm-up itself was the stall, 360-520 ms, when
   the reader jumped straight past About (the dock, a link): most of it
   texSubImage2D decoding each image on the main thread as it uploaded.
   So it is spread out, and the heavy parts leave the main thread:
     1. each image is decoded off thread (img.decode()),
     2. then uploaded, one texture per frame,
     3. the shaders compile in parallel where the driver can
        (compileAsync, KHR_parallel_shader_compile),
     4. and one full draw uploads the geometry. */
function WarmUp({ onDone }: { onDone: () => void }) {
    const { gl, scene, camera, invalidate } = useThree();
    const done = useRef(onDone);
    useEffect(() => {
        done.current = onDone;
    });
    useEffect(() => {
        let cancelled = false;
        const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
        /* Folded cards are hidden, and three skips hidden objects when it
           compiles and uploads: show everything while it looks. Each
           object's useFrame puts its real visibility back on the next
           frame. */
        const showAll = () =>
            scene.traverse((o) => {
                o.visible = true;
            });

        (async () => {
            const textures = new Set<THREE.Texture>();
            showAll();
            scene.traverse((o) => {
                const m = (o as THREE.Mesh).material;
                for (const mat of [m].flat()) {
                    if (!mat) continue;
                    for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
                }
            });
            for (const tex of textures) {
                const img = tex.image as unknown;
                if (img instanceof HTMLImageElement) await img.decode().catch(() => {});
                await nextFrame();
                if (cancelled) return;
                gl.initTexture(tex);
            }
            await nextFrame();
            if (cancelled) return;
            showAll();
            await gl.compileAsync(scene, camera);
            await nextFrame();
            if (cancelled) return;
            showAll();
            gl.render(scene, camera);
            invalidate();
            done.current();
        })();
        return () => {
            cancelled = true;
        };
    }, [gl, scene, camera, invalidate]);
    return null;
}

/* R3F points a default camera at the origin on creation; this puts the
   solved orientation back, plus any hand-tuned extra pitch. */
function CameraPose() {
    const camera = useThree((s) => s.camera);
    useMemo(() => {
        camera.quaternion.fromArray(CAM.quaternion);
        if (CAM.pitch) camera.rotateX(THREE.MathUtils.degToRad(CAM.pitch));
        camera.updateMatrixWorld();
    }, [camera]);
    return null;
}

/* ?calibrate=3d draws the solved page outline over the photograph. If it
   does not sit on the page block's top edges, adjust with
   scripts/calibrate-camera.mjs --fov/--dx/--dy/--dz/--pitch. */
function calibrating() {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("calibrate") === "3d";
}

function CalibrationOutline() {
    const line = useMemo(() => {
        const { width: w, depth: d } = CAM.plane;
        const pts = [
            [-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w / 2, 0, -d / 2],
            [0, 0, -d / 2], [0, 0, d / 2],
        ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#ff2d2d" }));
    }, []);
    return <primitive object={line} />;
}

/* The footage is lit from a window at the upper left. */
function Lights() {
    return (
        <>
            <hemisphereLight args={["#fff8ee", "#c9ae8e", 1.7]} />
            <directionalLight
                position={[-45, 70, 25]}
                intensity={2.5}
                color="#fff1dc"
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0004}
                shadow-normalBias={0.02}
                shadow-camera-left={-34}
                shadow-camera-right={34}
                shadow-camera-top={26}
                shadow-camera-bottom={-26}
                shadow-camera-near={10}
                shadow-camera-far={220}
            />
        </>
    );
}

/* Invisible except where something casts a shadow onto it: the page. */
function ShadowCatcher() {
    return (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
            <planeGeometry args={[52, 34]} />
            <shadowMaterial transparent opacity={0.26} color="#2a1c13" />
        </mesh>
    );
}

/* ------------------------------------------------------------------
   A card: a sheet of cardstock on a paper hinge, with the project's
   screenshot tipped onto it as a small glossy print.
   ------------------------------------------------------------------ */

const tmpHingeQ = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpFwd = new THREE.Vector3();
const tmpPulled = new THREE.Vector3();

function Card({
    index,
    local,
    spot,
    selected,
    highlighted,
    onSelect,
}: Props & { index: number; highlighted: boolean }) {
    const project = projects[index];
    const spec = LAYOUT[index];
    const { w, h } = spec;

    const group = useRef<THREE.Group>(null);
    const face = useRef<THREE.MeshStandardMaterial>(null);
    const struts = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    useCursor(hovered);

    /* Colour textures are sRGB; set once, when they load. */
    /* The card-sized copy of the screenshot (scripts/book-props.mjs). */
    const shotUrl = project.image.replace("/projects/", "/book/props/shots/");
    const [cardstock, shot] = usePaperTextures(["/book/props/cardstock.webp", shotUrl]);

    /* Smoothed state, advanced every frame. */
    const s = useRef({ pull: 0, lift: 0, lean: 0, dim: 0, tiltX: 0, tiltY: 0 });
    const pointer = useRef(new THREE.Vector2());

    const printW = w * 0.8;
    const printH = printW * 0.6;
    const printY = h * 0.5 - 0.62 - printH / 2 - 0.25;
    const textTop = printY - printH / 2 - 0.5;

    useFrame((state, dt) => {
        const g = group.current;
        if (!g) return;
        const st = s.current;
        const k = (rate: number) => 1 - Math.exp(-rate * Math.min(dt, 0.05));

        const isSel = selected === index;
        const isSpot = selected === null && spot === index;
        const others = (selected !== null && !isSel) || (selected === null && spot >= 0 && !isSpot);

        st.pull += ((isSel ? 1 : 0) - st.pull) * k(6);
        st.lift += ((isSpot || hovered || highlighted ? 1 : 0) - st.lift) * k(8);
        st.lean += ((isSpot ? 1 : 0) - st.lean) * k(6);
        st.dim += ((others ? 1 : 0) - st.dim) * k(6);
        st.tiltX += ((hovered ? pointer.current.y : 0) - st.tiltX) * k(8);
        st.tiltY += ((hovered ? pointer.current.x : 0) - st.tiltY) * k(8);

        /* The hinge pose: rotate up from lying flat (top pointing away from
           the camera) to standing, around the fold line on the page. */
        const open = hingeAt(local.get(), index);
        const angle = -(Math.PI / 2) * (1 - open) + st.lean * 0.1 + st.tiltX * 0.12;
        tmpEuler.set(angle, spec.yaw + st.tiltY * 0.18, 0, "YXZ");
        tmpHingeQ.setFromEuler(tmpEuler);
        const hingeCentre = tmpV.set(0, h / 2, 0).applyQuaternion(tmpHingeQ);
        hingeCentre.x += spec.x;
        hingeCentre.y += st.lift * 1.1;
        hingeCentre.z += spec.z;

        /* The pulled-out pose: in front of the camera, square to it. */
        const cam = state.camera;
        cam.getWorldDirection(tmpFwd);
        tmpUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
        const pulled = tmpPulled.copy(cam.position).addScaledVector(tmpFwd, 84).addScaledVector(tmpUp, -1.2);

        g.position.lerpVectors(hingeCentre, pulled, st.pull);
        g.quaternion.slerpQuaternions(tmpHingeQ, cam.quaternion, st.pull);
        g.scale.setScalar(1 + st.pull * 0.12);

        /* The struts that hold it up fold away as the card leaves them. */
        if (struts.current) struts.current.visible = st.pull < 0.02 && open > 0.02;
        /* Folded flat, a card is not drawn at all: lying on the page it read
           as a pale rectangle appearing out of nowhere as the hold began. */
        g.visible = open > 0.01 || st.pull > 0.01;

        if (face.current) {
            const v = 1 - st.dim * 0.22;
            face.current.color.setRGB(v, v, v);
            /* The cardstock's own texture as a faint glow lifts it to the
               cream of the photographed page; a pressed type block that is
               in this card's stack warms it further. */
            /* Pulled out, the card faces the key light square on and needs no
               lift of its own. */
            face.current.emissiveIntensity =
                (highlighted ? 0.55 : 0.34) * (1 - st.dim * 0.5) * (1 - st.pull * 0.85);
        }
    });

    return (
        <>
            <group
                ref={group}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={() => setHovered(false)}
                onPointerMove={(e) => {
                    /* Pointer position across the card, -1..1 each way, for
                       the tilt toward it. */
                    const uv = e.uv;
                    if (uv) pointer.current.set(uv.x * 2 - 1, uv.y * 2 - 1);
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(selected === index ? null : index);
                }}
            >
                {/* The sheet of cardstock, with a little thickness so its
                    edge catches the light like paper does. */}
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[w, h, 0.07]} />
                    <meshStandardMaterial
                        ref={face}
                        map={cardstock}
                        color="#fffaf0"
                        roughness={0.92}
                        emissive="#fbf1e3"
                        emissiveMap={cardstock}
                        emissiveIntensity={0.34}
                    />
                </mesh>

                {/* The print: a white border, then the photograph. */}
                <group position={[0, printY, 0.045]} rotation-z={index % 2 ? 0.02 : -0.018}>
                    <mesh castShadow>
                        <planeGeometry args={[printW + 0.5, printH + 0.5]} />
                        <meshStandardMaterial color="#fbf8f2" roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 0, 0.01]}>
                        <planeGeometry args={[printW, printH]} />
                        <meshStandardMaterial map={shot} roughness={0.35} metalness={0} />
                    </mesh>
                </group>

                <Text
                    font={FONT_TITLE}
                    fontSize={w * 0.084}
                    color={INK}
                    anchorX="left"
                    anchorY="top"
                    position={[-printW / 2, textTop, 0.05]}
                    maxWidth={printW}
                >
                    {project.title}
                </Text>
                <Text
                    font={FONT_ITALIC}
                    fontSize={w * 0.046}
                    color={INK_SOFT}
                    anchorX="left"
                    anchorY="top"
                    position={[-printW / 2, textTop - w * 0.094, 0.05]}
                >
                    {project.kind}
                </Text>
            </group>

            {/* V-fold struts behind the card: what a real pop-up stands on. */}
            <Struts refGroup={struts} spec={spec} local={local} index={index} texture={cardstock} />
        </>
    );
}

/* Two small paper struts from the back of a card down to the page behind
   it. Recomputed every frame from the hinge angle, so they fold flat with
   the card. */
function Struts({
    refGroup,
    spec,
    local,
    index,
    texture,
}: {
    refGroup: React.RefObject<THREE.Group | null>;
    spec: (typeof LAYOUT)[number];
    local: MotionValue<number>;
    index: number;
    texture: THREE.Texture;
}) {
    const a = useRef<THREE.Mesh>(null);
    const b = useRef<THREE.Mesh>(null);
    const attach = spec.h * 0.42;
    const foot = spec.h * 0.34;
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();

    useFrame(() => {
        const open = hingeAt(local.get(), index);
        const angle = (Math.PI / 2) * (1 - open);
        [a.current, b.current].forEach((m, side) => {
            if (!m) return;
            const x = spec.x + (side ? 1 : -1) * spec.w * 0.3;
            /* Top: on the back of the card. Foot: on the page behind it. */
            from.set(x, attach * Math.cos(angle), spec.z - 0.05 - attach * Math.sin(angle));
            to.set(x, 0.01, spec.z - foot);
            const len = from.distanceTo(to);
            m.position.lerpVectors(from, to, 0.5);
            m.lookAt(to);
            m.rotateX(Math.PI / 2);
            m.scale.set(1, Math.max(0.001, len), 1);
        });
    });

    const strut = (
        <>
            <planeGeometry args={[1.1, 1]} />
            <meshStandardMaterial map={texture} color="#e9dfcd" roughness={0.95} side={THREE.DoubleSide} />
        </>
    );

    return (
        <group ref={refGroup}>
            <mesh ref={a} castShadow>
                {strut}
            </mesh>
            <mesh ref={b} castShadow>
                {strut}
            </mesh>
        </group>
    );
}
