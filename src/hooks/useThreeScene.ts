/** @file Custom React hook that initialises and manages a Three.js 3D scene with orbit controls, lighting, and an animation loop. */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Props for the {@link useThreeScene} hook.
 *
 * @property containerRef - React ref pointing to the `<div>` that serves as the scene container.
 * @property canvasRef    - React ref pointing to the `<canvas>` element where Three.js renders.
 * @property autoRotate   - When `true`, the current mesh rotates automatically around the Y axis.
 */
export interface UseThreeSceneProps {
    containerRef: React.RefObject<HTMLDivElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    autoRotate: boolean;
}

/**
 * Initialises a Three.js scene, perspective camera, renderer, lighting (ambient + two directional),
 * and orbit controls inside the given container and canvas refs, and starts an animation loop.
 *
 * The returned refs allow the caller to add custom objects to the scene and to control
 * automatic rotation of a tracked mesh.
 *
 * @param props.containerRef - Ref to the HTMLDivElement that sizes the viewport.
 * @param props.canvasRef    - Ref to the HTMLCanvasElement used by the WebGLRenderer.
 * @param props.autoRotate   - Whether the currently tracked mesh (stored in `currentMeshRef`)
 *                             should be continuously rotated around the Y axis.
 *
 * @returns An object containing the following stable refs:
 *  - `sceneRef`        – Mutable ref holding the `THREE.Scene` instance.
 *  - `cameraRef`       – Mutable ref holding the `THREE.PerspectiveCamera` instance.
 *  - `rendererRef`     – Mutable ref holding the `THREE.WebGLRenderer` instance.
 *  - `controlsRef`     – Mutable ref holding the `OrbitControls` instance.
 *  - `currentMeshRef`  – Mutable ref holding the currently displayed `THREE.Mesh` (may be `null`).
 */
export const useThreeScene = ({
    containerRef,
    canvasRef,
    autoRotate
}: UseThreeSceneProps) => {
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.Camera | null>(null);
    const perspCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const currentMeshRef = useRef<THREE.Mesh | null>(null);
    const autoRotateRef = useRef(autoRotate);

    const transitionRef = useRef<{
        isTransitioning: boolean;
        startTime: number;
        duration: number;
        startPosition: THREE.Vector3;
        endPosition: THREE.Vector3;
        startUp: THREE.Vector3;
        endUp: THREE.Vector3;
        target: THREE.Vector3;
    } | null>(null);

    // Keep autoRotateRef in sync with parameter
    useEffect(() => {
        autoRotateRef.current = autoRotate;
    }, [autoRotate]);

    const setProjectionMode = (mode: 'perspective' | 'orthographic') => {
        const controls = controlsRef.current;
        const container = containerRef.current;
        if (!controls || !container) return;

        const width = container.clientWidth || 400;
        const height = container.clientHeight || 300;
        const aspect = width / height;

        const activeCamera = cameraRef.current;
        if (!activeCamera) return;

        if (mode === 'perspective' && activeCamera instanceof THREE.OrthographicCamera) {
            const persp = perspCameraRef.current;
            if (!persp) return;

            persp.position.copy(activeCamera.position);
            persp.quaternion.copy(activeCamera.quaternion);
            persp.up.copy(activeCamera.up);
            persp.aspect = aspect;
            persp.updateProjectionMatrix();

            cameraRef.current = persp;
            controls.object = persp;
            controls.update();
        } else if (mode === 'orthographic' && activeCamera instanceof THREE.PerspectiveCamera) {
            const ortho = orthoCameraRef.current;
            if (!ortho) return;

            const d = activeCamera.position.distanceTo(controls.target);
            const halfHeight = d * Math.tan(THREE.MathUtils.degToRad(activeCamera.fov / 2)) || 10;

            ortho.left = -aspect * halfHeight;
            ortho.right = aspect * halfHeight;
            ortho.top = halfHeight;
            ortho.bottom = -halfHeight;
            ortho.position.copy(activeCamera.position);
            ortho.quaternion.copy(activeCamera.quaternion);
            ortho.up.copy(activeCamera.up);
            ortho.zoom = 1;
            ortho.updateProjectionMatrix();

            cameraRef.current = ortho;
            controls.object = ortho;
            controls.update();
        }
    };

    const snapToView = (axis: 'x' | '-x' | 'y' | '-y' | 'z' | '-z') => {
        const controls = controlsRef.current;
        const container = containerRef.current;
        if (!controls || !container) return;

        // Snap snaps to orthographic mode
        setProjectionMode('orthographic');

        const camera = cameraRef.current;
        if (!camera) return;

        const target = controls.target;
        const dist = camera.position.distanceTo(target) || 50;

        const dir = new THREE.Vector3();
        const up = new THREE.Vector3(0, 0, 1);

        switch (axis) {
            case 'x':
                dir.set(1, 0, 0);
                break;
            case '-x':
                dir.set(-1, 0, 0);
                break;
            case 'y':
                dir.set(0, 1, 0);
                break;
            case '-y':
                dir.set(0, -1, 0);
                break;
            case 'z':
                dir.set(0, 0, 1);
                up.set(0, 1, 0);
                break;
            case '-z':
                dir.set(0, 0, -1);
                up.set(0, -1, 0);
                break;
        }

        const endPosition = target.clone().add(dir.multiplyScalar(dist));

        transitionRef.current = {
            isTransitioning: true,
            startTime: performance.now(),
            duration: 350,
            startPosition: camera.position.clone(),
            endPosition,
            startUp: camera.up.clone(),
            endUp: up,
            target: target.clone()
        };
    };

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        // --- 1. Setup Three.js Scene, Camera, and Renderer ---
        const width = containerRef.current.clientWidth || 400;
        const height = containerRef.current.clientHeight || 300;

        const scene = new THREE.Scene();
        // Lighter mid-grey so the area past the grid horizon and the
        // grid's distance-fade target both read as clearly grey, not
        // black. The grid line edges (smoothstep transition) fade to
        // this same colour via uBgColor, so matching it removes the
        // dark fringe that was appearing at every line boundary.
        scene.background = new THREE.Color('#121212'); // Dark slate background
        sceneRef.current = scene;

        // Set the global default up direction to Z-up
        THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

        const perspCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        perspCamera.up.set(0, 0, 1);
        perspCamera.position.set(0, -50, 30);
        perspCameraRef.current = perspCamera;

        const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        orthoCamera.up.set(0, 0, 1);
        orthoCamera.position.set(0, -50, 30);
        orthoCameraRef.current = orthoCamera;

        cameraRef.current = perspCamera;

        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;

        // --- 2. Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight1.position.set(10, -15, 20);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xaaccff, 0.5); // Soft blue clinical fill light
        dirLight2.position.set(-10, 15, -20);
        scene.add(dirLight2);

        // --- 3. Controls ---
        const controls = new OrbitControls(perspCamera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxDistance = 300;
        controls.minDistance = 5;
        controlsRef.current = controls;

        // --- 4. Animation Loop ---
        let animationFrameId: number;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            if (currentMeshRef.current && autoRotateRef.current) {
                currentMeshRef.current.rotation.z += 0.005;
            }

            const camera = cameraRef.current;
            if (camera && transitionRef.current) {
                const tRef = transitionRef.current;
                const now = performance.now();
                const progress = Math.min(1, (now - tRef.startTime) / tRef.duration);

                // Smooth cubic easing
                const ease = progress < 0.5
                    ? 4 * progress * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                camera.position.lerpVectors(tRef.startPosition, tRef.endPosition, ease);
                camera.up.lerpVectors(tRef.startUp, tRef.endUp, ease);
                controls.target.copy(tRef.target);

                if (progress >= 1) {
                    transitionRef.current = null;
                }
            }

            controls.update();
            if (camera) {
                renderer.render(scene, camera);
            }
        };
        animate();

        // Handle resizing with ResizeObserver
        const handleResize = () => {
            if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            const aspect = w / h;

            const camera = cameraRef.current;
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = aspect;
                camera.updateProjectionMatrix();
            } else if (camera instanceof THREE.OrthographicCamera) {
                const halfHeight = (camera.top - camera.bottom) / 2;
                camera.left = -aspect * halfHeight;
                camera.right = aspect * halfHeight;
                camera.top = halfHeight;
                camera.bottom = -halfHeight;
                camera.updateProjectionMatrix();
            }
            rendererRef.current.setSize(w, h);
        };

        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        resizeObserver.observe(containerRef.current);

        // Clean up
        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            controls.dispose();
            renderer.dispose();
        };
    }, [containerRef, canvasRef]);

    return {
        sceneRef,
        cameraRef,
        rendererRef,
        controlsRef,
        currentMeshRef,
        setProjectionMode,
        snapToView,
        isTransitioning: () => !!transitionRef.current
    };
};
export default useThreeScene;
