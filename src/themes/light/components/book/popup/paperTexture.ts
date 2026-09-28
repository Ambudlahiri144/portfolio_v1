import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

/* ==================================================================
   PAPER TEXTURE — the pop-up's images, decoded off the main thread.

   drei's useTexture loads through an <img> and uploads it on mount, and
   the upload is where the browser decodes it: synchronously, inside the
   React commit, ~260 ms for the pop-up's six images when a reader jumped
   straight to it. Here each image is fetched and decoded by
   createImageBitmap on a worker thread instead, so by the time the scene
   mounts it is a ready bitmap and the upload is a copy.

   Bitmaps ignore texture.flipY, so the flip happens at decode. sRGB, like
   every colour image in the book.
   ================================================================== */

class PaperTextureLoader extends THREE.Loader<THREE.Texture> {
    load(
        url: string,
        onLoad: (texture: THREE.Texture) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (err: unknown) => void,
    ) {
        const bitmaps = new THREE.ImageBitmapLoader(this.manager);
        bitmaps.setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" });
        bitmaps.setPath(this.path);
        bitmaps.load(
            url,
            (bitmap) => {
                const texture = new THREE.Texture(bitmap);
                texture.flipY = false;
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.needsUpdate = true;
                onLoad(texture);
            },
            onProgress,
            onError,
        );
    }
}

export function usePaperTextures(urls: string[]): THREE.Texture[] {
    return useLoader(PaperTextureLoader, urls);
}

usePaperTextures.preload = (urls: string[]) => useLoader.preload(PaperTextureLoader, urls);
