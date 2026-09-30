"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { EndBlock } from "@light/lib/site";
import { place, type Fit } from "../fit";
import { usePaperTextures } from "../popup/paperTexture";
import { BLOCK_D, BLOCK_H, Block, widthOf } from "../popup/TypeBlock";
import { endCamera, endGeometry, manifest, rect } from "../timeline";
import "../../three-console";
import "../popup/rapier-console";
import styles from "./End.module.css";

/* ==================================================================
   END SCENE — the way back into the book, set in maple type on the
   table in front of the cat.

   The same blocks as the projects' letterpress (popup/TypeBlock), in a
   3D scene drawn through the camera solved for the last scene's frame
   (calibrate-camera.mjs --rest end), so they sit on the photographed
   table. Each arrival they drop in, one after another, and settle;
   pointing lifts a block's colour, and pressing one sinks it into the
   cloth and goes there.

   The canvas covers only the strip of table the blocks are on (a view
   offset keeps the full frame's projection), so it never stands between
   the pointer and the cat or the links beside her. Units are cm; the
   solve's y = 0 is the book's top face, the table is tableY below it.
   ================================================================== */

const MAPLE = "/book/props/maple.webp";
const GAP = 0.5;
/* How tall a block should look, in source px of the frame: readable,
   whatever scale the table is at in the shot. */
const BLOCK_PX = 28;

type Props = {
    fit: Fit;
    active: boolean;
    blocks: EndBlock[];
    onChoose: (b: EndBlock) => void;
};

function calibrating() {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("calibrate") === "end";
}

export default function EndScene({ fit, active, blocks, onChoose }: Props) {
    const [warm, setWarm] = useState(false);
    /* Each arrival drops the type in afresh. */
    const [arrival, setArrival] = useState(0);
    const was = useRef(false);
    useEffect(() => {
        if (active && !was.current) setArrival((a) => a + 1);
        was.current = active;
    }, [active]);

    if (!endCamera || !endGeometry) return null;
    const full = calibrating();
    const strip = place(fit, rect(endGeometry.blocks));
    /* Room above the strip for the blocks to fall through. */
    const box = full
        ? { left: fit.x, top: fit.y, width: fit.w, height: fit.h }
        : { left: strip.left, top: strip.top - strip.height * 0.9, width: strip.width, height: strip.height * 2.3 };

    return (
        <div className={styles.scene} style={box} aria-hidden="true">
            <Canvas
                shadows="percentage"
                flat
                dpr={[1, 1.5]}
                frameloop={active && warm ? "always" : "demand"}
                gl={{ alpha: true, antialias: true }}
                camera={{ fov: endCamera.fov, near: endCamera.near, far: endCamera.far, manual: true }}
            >
                <FrameCamera fit={fit} box={box} />
                <hemisphereLight args={["#fff8ee", "#c9ae8e", 1.6]} />
                <directionalLight
                    position={[-40, 70, 30]}
                    intensity={2.2}
                    color="#fff1da"
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                    shadow-camera-left={-60}
                    shadow-camera-right={60}
                    shadow-camera-top={60}
                    shadow-camera-bottom={-60}
                    shadow-bias={-0.0005}
                />
                <Suspense fallback={null}>
                    <Table />
                    {/* One physics world for good (starting the engine is the
                        slow part); the type is dropped into it afresh on each
                        arrival. */}
                    <Physics gravity={[0, -981, 0]} paused={!active}>
                        <RigidBody type="fixed" colliders={false}>
                            <CuboidCollider args={[200, 5, 200]} position={[0, tableY() - 5, 0]} friction={0.9} />
                        </RigidBody>
                        {arrival > 0 && <Row key={arrival} blocks={blocks} onChoose={onChoose} />}
                    </Physics>
                    <Speck />
                    <WarmUp onDone={() => setWarm(true)} />
                </Suspense>
                {full && <Outline />}
            </Canvas>
        </div>
    );
}

/* The solved camera, with the full frame's projection and this canvas's
   part of it as a view offset. R3F leaves a `manual` camera's aspect to
   us. */
function FrameCamera({ fit, box }: { fit: Fit; box: { left: number; top: number; width: number; height: number } }) {
    const get = useThree((s) => s.get);
    useEffect(() => {
        const { camera: cam, invalidate } = get();
        const camera = cam as THREE.PerspectiveCamera;
        const c = endCamera!;
        camera.position.fromArray(c.position);
        camera.quaternion.fromArray(c.quaternion);
        camera.fov = c.fov;
        camera.aspect = fit.w / fit.h;
        camera.setViewOffset(fit.w, fit.h, box.left - fit.x, box.top - fit.y, box.width, box.height);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        invalidate();
    }, [get, fit, box.left, box.top, box.width, box.height]);
    return null;
}

const tableY = () => endGeometry?.tableY ?? -3.2;

/* Where the row goes: the strip's centre on the table, found by casting
   the frame's pixel through the solved camera onto the table plane. And
   how big a block must be to look BLOCK_PX tall there. */
function useRow(blocks: EndBlock[]) {
    return useMemo(() => {
        const c = endCamera!;
        const cam = new THREE.PerspectiveCamera(c.fov, manifest.width / manifest.height, c.near, c.far);
        cam.position.fromArray(c.position);
        cam.quaternion.fromArray(c.quaternion);
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        const [x, y, w, h] = endGeometry!.blocks;
        const onTable = (px: number, py: number) => {
            const ndc = new THREE.Vector3((px / manifest.width) * 2 - 1, -(py / manifest.height) * 2 + 1, 0.5).unproject(cam);
            const dir = ndc.sub(cam.position).normalize();
            const t = (tableY() - cam.position.y) / dir.y;
            return cam.position.clone().addScaledVector(dir, t);
        };
        const centre = onTable(x + w / 2, y + h * 0.6);
        /* The row runs level across the frame, whatever way the book lies
           and however the generated scene is rolled: its direction is the
           table between two points either side of the centre, at the same
           height in the picture. Its words face the other way, to us. */
        const axis = onTable(x + w * 0.7, y + h * 0.6).sub(onTable(x + w * 0.3, y + h * 0.6)).setY(0).normalize();
        const yaw = Math.atan2(-axis.z, axis.x);
        /* Source px per cm along the row. */
        const a = centre.clone().project(cam);
        const b = centre.clone().add(axis).project(cam);
        const pxPerCm = (Math.abs(b.x - a.x) * manifest.width) / 2;
        /* Big enough to read, small enough that the whole row fits the
           strip. */
        const rowCm = blocks.reduce((sum, bl) => sum + widthOf(bl.label), 0) + GAP * (blocks.length - 1);
        const scale = Math.min(BLOCK_PX / (pxPerCm * BLOCK_H), (w * 0.94) / (pxPerCm * rowCm));
        return { centre, axis, yaw, scale };
    }, [blocks]);
}

/* The table: catches the blocks' shadows, and stops them falling. */
function Table() {
    const y = tableY();
    return (
        <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[400, 400]} />
            <shadowMaterial transparent opacity={0.28} color="#2a1c13" />
        </mesh>
    );
}

function Row({ blocks, onChoose }: { blocks: EndBlock[]; onChoose: (b: EndBlock) => void }) {
    const { centre, axis, yaw, scale } = useRow(blocks);
    const [mapleSrc] = usePaperTextures([MAPLE]);
    const maple = useMemo(() => {
        const t = mapleSrc.clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(0.35, 0.35);
        t.needsUpdate = true;
        return t;
    }, [mapleSrc]);

    /* Each block's centre on the table, along the row, which is centred on
       the strip. */
    const slots = useMemo(() => {
        const widths = blocks.map((b) => widthOf(b.label) * scale);
        const gap = GAP * scale;
        const total = widths.reduce((s, w) => s + w, 0) + gap * (blocks.length - 1);
        return widths.map((w, i) => {
            const along = -total / 2 + widths.slice(0, i).reduce((s, v) => s + v + gap, 0) + w / 2;
            return centre.clone().addScaledVector(axis, along);
        });
    }, [blocks, centre, axis, scale]);

    const y = tableY();
    return (
        <>
            {blocks.map((b, i) => (
                <DroppedBlock
                    key={b.label}
                    block={b}
                    order={i}
                    x={slots[i].x}
                    y={y}
                    z={slots[i].z}
                    yaw={yaw}
                    scale={scale}
                    texture={maple}
                    onChoose={onChoose}
                />
            ))}
        </>
    );
}

function DroppedBlock({
    block,
    order,
    x,
    y,
    z,
    yaw,
    scale,
    texture,
    onChoose,
}: {
    block: EndBlock;
    order: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    scale: number;
    texture: THREE.Texture;
    onChoose: (b: EndBlock) => void;
}) {
    const body = useRef<RapierRigidBody>(null);
    const [hover, setHover] = useState(false);
    const [pressed, setPressed] = useState(false);
    useCursor(hover);
    const w = widthOf(block.label);

    const press = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (pressed) return;
        setPressed(true);
        body.current?.applyImpulse({ x: 0, y: -40 * scale, z: 0 }, true);
        window.setTimeout(() => onChoose(block), 200);
        window.setTimeout(() => setPressed(false), 900);
    };

    return (
        <RigidBody
            ref={body}
            colliders={false}
            ccd
            /* Dropped from a hand's height, the first of the line first. */
            position={[x, y + (BLOCK_H / 2 + 3 + order * 1.1) * scale, z]}
            rotation={[0, yaw, 0]}
            restitution={0.15}
            friction={0.8}
            angularDamping={2}
        >
            <CuboidCollider args={[(w / 2) * scale, (BLOCK_H / 2) * scale, (BLOCK_D / 2) * scale]} />
            <group
                scale={scale}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHover(true);
                }}
                onPointerOut={() => setHover(false)}
                onClick={press}
            >
                <Block name={block.label} w={w} texture={texture} pressed={hover || pressed} />
            </group>
        </RigidBody>
    );
}

/* One block, too small to see, there from the start: its shaders and its
   glyphs are ready before the real ones ever drop (as in Letterpress). */
function Speck() {
    const [maple] = usePaperTextures([MAPLE]);
    const chars = useMemo(() => [...new Set("AboutProjectsContactThe full recordBack to the cover")].join(""), []);
    return (
        <group scale={0.001} position={[0, tableY() - 1, 0]}>
            <Block name={chars} w={1} texture={maple} pressed={false} characters={chars} />
        </group>
    );
}

/* Shaders compiled while nobody is looking (see PopupScene's WarmUp). */
function WarmUp({ onDone }: { onDone: () => void }) {
    const { gl, scene, camera, invalidate } = useThree();
    const done = useRef(onDone);
    useEffect(() => {
        done.current = onDone;
    });
    useEffect(() => {
        let gone = false;
        void gl.compileAsync(scene, camera).then(() => {
            if (gone) return;
            gl.render(scene, camera);
            invalidate();
            done.current();
        });
        return () => {
            gone = true;
        };
    }, [gl, scene, camera, invalidate]);
    return null;
}

/* ?calibrate=end: the closed book's top face and the table's plane drawn
   through the solved camera. The rectangle should sit on the book. */
function Outline() {
    const line = useMemo(() => {
        const [bw, bd] = endGeometry?.bookCm ?? [25.6, 33.7];
        const y = tableY();
        const pts = [
            [-bw / 2, 0, -bd / 2], [bw / 2, 0, -bd / 2], [bw / 2, 0, bd / 2], [-bw / 2, 0, bd / 2], [-bw / 2, 0, -bd / 2],
            [-bw / 2, y, bd / 2], [bw / 2, y, bd / 2], [bw / 2, 0, bd / 2],
        ].map(([a, b, c]) => new THREE.Vector3(a, b, c));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#ff2d2d" }));
    }, []);
    return <primitive object={line} />;
}
