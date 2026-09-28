"use client";

import { Suspense, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox, Text, useCursor, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { DEPTH, volumes, type Volume } from "./volumes";
import "../three-console";

/* ==================================================================
   SHELF SCENE — the record, as volumes on a shelf.

   A walnut shelf against the linen wall, the volumes standing on it spine
   out. Point at one and it slides a little way off the shelf, its gold
   catching the light; choose one and it comes out to you, turns its
   cover to face you and opens. The page it opens to is real HTML
   (Shelf.tsx places it each frame over the 3D page), so it is readable,
   selectable and links work.

   Unlike the book, nothing here is a photograph, so the camera is ours:
   it leans a little toward the pointer.

   Units are centimetres. The shelf's top is y = 0, spines face +z.
   ================================================================== */

const FONT = "/book/fonts/cormorant-600.ttf";
const FONT_SMALL = "/book/fonts/plexmono-500.ttf";

/* Standing positions, left to right, with a finger's gap between. The last
   volume leans on its neighbour. */
const LAYOUT = (() => {
    const gap = 0.35;
    const total = volumes.reduce((s, v) => s + v.t, 0) + gap * (volumes.length - 1) + 3;
    let x = -total / 2;
    return volumes.map((v, i) => {
        const at = { x: x + v.t / 2, lean: i === volumes.length - 1 ? 0.16 : 0 };
        x += v.t + gap + (i === volumes.length - 2 ? 1.6 : 0);
        return at;
    });
})();

export type ShelfSceneProps = {
    selected: number | null;
    hovered: number | null;
    onHover: (i: number | null) => void;
    onSelect: (i: number | null) => void;
    /* Placed each frame over the open volume's first page. */
    pageRef: RefObject<HTMLDivElement | null>;
};

export default function ShelfScene(props: ShelfSceneProps) {
    return (
        <Canvas
            shadows="percentage"
            /* No tone mapping, like the pop-up: the cloth and the linen are
               matched to the site's colours, and a filmic curve muddied them. */
            flat
            dpr={[1, 1.75]}
            camera={{ position: [0, 19, 80], fov: 27, near: 1, far: 400 }}
            onPointerMissed={() => props.onSelect(null)}
        >
            <Rig />
            <hemisphereLight args={["#fff6ea", "#a7866a", 1.5]} />
            <directionalLight
                position={[-28, 44, 34]}
                intensity={2.4}
                color="#fff0da"
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-40}
                shadow-camera-right={40}
                shadow-camera-top={40}
                shadow-camera-bottom={-10}
                shadow-bias={-0.0004}
            />
            {/* A small environment of soft light panels, rendered here, not
                fetched: it is what the gold foil reflects. */}
            <Environment resolution={128} frames={1}>
                <Lightformer intensity={2.2} color="#fff1d8" position={[-10, 12, 10]} scale={[18, 12, 1]} />
                <Lightformer intensity={1.2} color="#ffe2b8" position={[14, 6, 8]} scale={[10, 10, 1]} />
                <Lightformer intensity={0.6} color="#d8c4a6" position={[0, -6, 12]} scale={[30, 4, 1]} />
            </Environment>
            <Suspense fallback={null}>
                <ShelfAndWall />
                {volumes.map((v, i) => (
                    <VolumeMesh key={v.id} index={i} volume={v} {...props} />
                ))}
            </Suspense>
        </Canvas>
    );
}

/* The camera leans toward the pointer, a few degrees at most. */
function Rig() {
    const target = useMemo(() => new THREE.Vector3(0, 11.5, 0), []);
    useFrame(({ camera, pointer }, dt) => {
        const k = 1 - Math.exp(-3 * dt);
        camera.position.x += (pointer.x * 3.5 - camera.position.x) * k;
        camera.position.y += (19 + pointer.y * 1.6 - camera.position.y) * k;
        camera.lookAt(target);
    });
    return null;
}

function ShelfAndWall() {
    const [wood, linen] = useTexture(["/book/props/typeside.webp", "/book/props/shelf/cloth.webp"], (t) => {
        for (const tex of [t].flat()) {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        }
    });
    const woodMap = useMemo(() => {
        const t = wood.clone();
        t.repeat.set(4, 1.2);
        t.needsUpdate = true;
        return t;
    }, [wood]);
    const wallMap = useMemo(() => {
        const t = linen.clone();
        t.repeat.set(6, 3);
        t.needsUpdate = true;
        return t;
    }, [linen]);

    return (
        <group>
            {/* The plank. */}
            <mesh position={[0, -1.4, 0]} receiveShadow castShadow>
                <boxGeometry args={[70, 2.8, 22]} />
                <meshStandardMaterial map={woodMap} color="#b08a66" roughness={0.72} />
            </mesh>
            {/* Its front lip, a shade lighter where the light catches it. */}
            <mesh position={[0, -1.4, 11.02]}>
                <planeGeometry args={[70, 2.8]} />
                <meshStandardMaterial map={woodMap} color="#c29a74" roughness={0.6} />
            </mesh>
            {/* The wall behind: linen, a little darker than the table. */}
            <mesh position={[0, 20, -11.2]} receiveShadow>
                <planeGeometry args={[140, 80]} />
                <meshStandardMaterial map={wallMap} color="#f0dcc0" roughness={0.95} />
            </mesh>
        </group>
    );
}

/* ------------------------------------------------------------------ */

const pale = (hex: string) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace).l > 0.7;

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
/* Where a chosen volume is held up to read: far enough from the camera
   that the whole open book fits the stage. */
const PRESENT = new THREE.Vector3(-3, 12.5, 10.5);

function VolumeMesh({
    index,
    volume,
    selected,
    hovered,
    onHover,
    onSelect,
    pageRef,
}: ShelfSceneProps & { index: number; volume: Volume }) {
    const { h, t } = volume;
    const d = DEPTH;
    const at = LAYOUT[index];
    const root = useRef<THREE.Group>(null);
    const cover = useRef<THREE.Group>(null);
    const [over, setOver] = useState(false);
    useCursor(over);

    const [cloth, leather] = useTexture(["/book/props/shelf/cloth.webp", "/book/props/shelf/leather.webp"], (tx) => {
        for (const tex of [tx].flat()) {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        }
    });
    const skin = volume.leather ? leather : cloth;

    const s = useRef({ out: 0, pull: 0, open: 0 });
    const camera = useThree((st) => st.camera);
    const size = useThree((st) => st.size);
    const corner = useMemo(() => [0, 1, 2, 3].map(() => new THREE.Vector3()), []);

    useFrame((_, dt) => {
        const g = root.current;
        if (!g) return;
        const st = s.current;
        const k = (r: number) => 1 - Math.exp(-r * Math.min(dt, 0.05));
        const isSel = selected === index;
        st.out += ((hovered === index && !isSel ? 1 : 0) - st.out) * k(10);
        st.pull += ((isSel ? 1 : 0) - st.pull) * k(4.5);
        /* The cover opens once the volume is nearly out. */
        st.open += ((isSel && st.pull > 0.85 ? 1 : 0) - st.open) * k(5);

        /* On the shelf: standing (or leaning), slid out a little on hover. */
        tmpV.set(at.x, h / 2 + 0.001, st.out * 3);
        tmpE.set(0, 0, at.lean);
        tmpQ.setFromEuler(tmpE);
        /* Presented: in front of the shelf, front cover to the camera. */
        const presentQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, -Math.PI / 2, 0));
        g.position.lerpVectors(tmpV, PRESENT, st.pull);
        g.quaternion.slerpQuaternions(tmpQ, presentQ, st.pull);

        if (cover.current) cover.current.rotation.y = -st.open * 2.55;

        /* Tell the DOM where the first page is on screen, so the entry sits
           on it. The page's face, in this volume's local space, is x = t/2. */
        if (isSel && pageRef.current) {
            const x = t / 2 - 0.28;
            const pts = [
                [x, h / 2 - 0.4, d / 2 - 0.4],
                [x, h / 2 - 0.4, -d / 2 + 0.3],
                [x, -h / 2 + 0.4, -d / 2 + 0.3],
                [x, -h / 2 + 0.4, d / 2 - 0.4],
            ];
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            pts.forEach(([px, py, pz], i) => {
                const v = corner[i].set(px, py, pz).applyMatrix4(g.matrixWorld).project(camera);
                const sx = ((v.x + 1) / 2) * size.width;
                const sy = ((1 - v.y) / 2) * size.height;
                minX = Math.min(minX, sx);
                maxX = Math.max(maxX, sx);
                minY = Math.min(minY, sy);
                maxY = Math.max(maxY, sy);
            });
            const el = pageRef.current;
            el.style.left = `${minX}px`;
            el.style.top = `${minY}px`;
            el.style.width = `${maxX - minX}px`;
            el.style.height = `${maxY - minY}px`;
            el.style.setProperty("--pw", `${maxX - minX}px`);
            el.style.opacity = String(Math.max(0, (st.open - 0.7) / 0.3));
        }
    });

    /* Foil: part metal, part pigment, with a faint glow of its own, so it
       reads as gold straight on as well as at a glancing angle. Gold is
       lost on a pale cloth, so there the binder stamps in brown ink. */
    const gold = pale(volume.cloth) ? (
        <meshStandardMaterial color="#4a2e1c" roughness={0.6} />
    ) : (
        <meshStandardMaterial
            color="#e2bd72"
            metalness={0.55}
            roughness={0.3}
            envMapIntensity={2.4}
            emissive="#8a6424"
            emissiveIntensity={0.35}
        />
    );

    return (
        <group
            ref={root}
            onPointerOver={(e) => {
                e.stopPropagation();
                setOver(true);
                onHover(index);
            }}
            onPointerOut={() => {
                setOver(false);
                onHover(null);
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(selected === index ? null : index);
            }}
        >
            {/* The text block: page edges, cream. */}
            <mesh position={[0, 0, -0.2]} castShadow receiveShadow>
                <boxGeometry args={[t - 0.5, h - 0.6, d - 0.5]} />
                <meshStandardMaterial color="#efe6d4" roughness={0.9} />
            </mesh>
            {/* Back board. */}
            <RoundedBox args={[0.26, h, d]} radius={0.08} smoothness={2} position={[-t / 2 + 0.13, 0, 0]} castShadow>
                <meshStandardMaterial map={skin} color={volume.cloth} roughness={0.85} />
            </RoundedBox>
            {/* Spine, facing out. */}
            <RoundedBox args={[t, h, 0.34]} radius={0.1} smoothness={3} position={[0, 0, d / 2 - 0.17]} castShadow>
                <meshStandardMaterial map={skin} color={volume.cloth} roughness={0.8} />
            </RoundedBox>
            {/* Gold bands at head and tail. */}
            {[1, -1].map((side) => (
                <mesh key={side} position={[0, side * (h / 2 - 1.3), d / 2 + 0.005]}>
                    <planeGeometry args={[t * 0.86, 0.14]} />
                    {gold}
                </mesh>
            ))}
            {/* The title, stamped down the spine, and the dates at its foot. */}
            <Text
                font={FONT}
                fontSize={Math.min(1.3, t * 0.31)}
                maxWidth={h * 0.62}
                anchorX="center"
                anchorY="middle"
                position={[0, 1.2, d / 2 + 0.01]}
                rotation={[0, 0, -Math.PI / 2]}
                letterSpacing={0.04}
            >
                {volume.spine.toUpperCase()}
                {gold}
            </Text>
            <Text
                font={FONT_SMALL}
                fontSize={0.34}
                anchorX="center"
                anchorY="middle"
                position={[0, -h / 2 + 2.6, d / 2 + 0.01]}
                rotation={[0, 0, -Math.PI / 2]}
                maxWidth={4}
                textAlign="center"
            >
                {volume.period}
                {gold}
            </Text>
            {/* Front board, hinged at the spine so it swings open. */}
            <group ref={cover} position={[t / 2, 0, d / 2]}>
                <RoundedBox args={[0.26, h, d]} radius={0.08} smoothness={2} position={[-0.13, 0, -d / 2]} castShadow>
                    <meshStandardMaterial map={skin} color={volume.cloth} roughness={0.85} />
                </RoundedBox>
            </group>
        </group>
    );
}
