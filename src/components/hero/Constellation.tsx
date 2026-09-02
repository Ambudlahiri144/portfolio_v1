"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
    DUST_POSITIONS,
    NODE_POSITIONS,
    EDGE_POSITIONS,
    FIELD_DEPTH,
} from "@/lib/constellation";

/* How far the camera travels across the whole scroll range. Kept well inside
   FIELD_DEPTH so the camera never flies out the back of the cloud. */
const TRAVEL = FIELD_DEPTH * 0.55;
const START_Z = 20;

export type Palette = {
    dust: string;
    node: string;
    edge: string;
    fog: string;
};

/* PointsMaterial draws a flat square sprite unless it is given an alpha map.
   At the sizes used here that is very visible — the nodes come out as hard
   little blocks. This paints a soft radial dot once and reuses it for both
   point clouds. */
function makeDotTexture() {
    const SIZE = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const r = SIZE / 2;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.92)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export default function Constellation({
    scrollRef,
    palette,
}: {
    /* Normalised 0..1 scroll progress through the hero. A ref rather than a
       prop value on purpose — this changes every frame, and routing it through
       React state would re-render the whole scene sixty times a second. */
    scrollRef: RefObject<number>;
    palette: Palette;
}) {
    const group = useRef<THREE.Group>(null);

    /* Buffers are module-level constants, so these attach once and are never
       rebuilt. useMemo here guards against StrictMode's double-invoke creating
       two BufferAttributes over the same array. */
    const geometries = useMemo(() => {
        const dust = new THREE.BufferGeometry();
        dust.setAttribute("position", new THREE.BufferAttribute(DUST_POSITIONS, 3));

        const nodes = new THREE.BufferGeometry();
        nodes.setAttribute("position", new THREE.BufferAttribute(NODE_POSITIONS, 3));

        const edges = new THREE.BufferGeometry();
        edges.setAttribute("position", new THREE.BufferAttribute(EDGE_POSITIONS, 3));

        return { dust, nodes, edges };
    }, []);

    const dot = useMemo(() => makeDotTexture(), []);

    /* Geometries and the texture hold GPU memory that React will not reclaim
       on its own. Without this, every client navigation back to the hero leaks
       another full set. */
    useEffect(() => {
        return () => {
            geometries.dust.dispose();
            geometries.nodes.dispose();
            geometries.edges.dispose();
            dot?.dispose();
        };
    }, [geometries, dot]);

    useFrame((state, delta) => {
        const g = group.current;
        if (!g) return;

        /* Camera is taken off the frame state rather than from useThree().

           Mutating the camera every frame is the normal r3f idiom, but the
           React Compiler's immutability rule treats a value captured from a
           hook return as off-limits and errors on it. Reading it from the
           frame callback's own argument is the same object, without the
           captured-hook-value problem — so this stays compiler-clean without
           needing a "use no memo" opt-out. */
        const { camera } = state;

        /* delta-scaled rather than per-frame, so the drift runs at the same
           speed on 60Hz and 120Hz displays. Clamped because a backgrounded tab
           can deliver one enormous delta on resume, which would otherwise snap
           the field round to a new angle. */
        const d = Math.min(delta, 0.1);

        g.rotation.y += d * 0.018;
        g.rotation.x = Math.sin(state.clock.elapsedTime * 0.08) * 0.05;

        /* Camera pushes into the field as the hero scrolls away. Lerped toward
           the target instead of assigned, so a fling of the scrollbar still
           reads as travel rather than a cut. */
        const target = START_Z - scrollRef.current * TRAVEL;
        camera.position.z += (target - camera.position.z) * Math.min(1, d * 4);

        /* A little counter-drift on the group keeps the parallax from feeling
           purely axial. */
        g.position.y = scrollRef.current * 2.5;
    });

    return (
        <group ref={group}>
            <points geometry={geometries.dust}>
                <pointsMaterial
                    color={palette.dust}
                    map={dot}
                    size={0.11}
                    sizeAttenuation
                    transparent
                    opacity={0.7}
                    depthWrite={false}
                />
            </points>

            <lineSegments geometry={geometries.edges}>
                <lineBasicMaterial
                    color={palette.edge}
                    transparent
                    opacity={0.28}
                    depthWrite={false}
                />
            </lineSegments>

            <points geometry={geometries.nodes}>
                <pointsMaterial
                    color={palette.node}
                    map={dot}
                    size={0.34}
                    sizeAttenuation
                    transparent
                    opacity={0.9}
                    depthWrite={false}
                />
            </points>
        </group>
    );
}
