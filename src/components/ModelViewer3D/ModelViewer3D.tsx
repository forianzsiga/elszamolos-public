/**
 * @file ModelViewer3D.tsx
 * @brief 3D model viewer component for displaying dental CAD/CAM models.
 *
 * This component provides an interactive 3D visualization environment for dental models.
 * It loads **all** available model layers (suffixes) into the scene simultaneously.
 * Users can toggle individual layer visibility via a layers panel on the right side
 * of the canvas (eye-icon buttons). Hidden layers are still rendered using a very
 * faint fresnel-edge shader so the user knows where geometry exists. A "base" layer
 * (containing "lower", "upper", or "base" in the suffix name) is always visible and
 * its toggle is locked.
 *
 * @see useThreeScene hook for Three.js scene management
 * @see ModelLayersPanel for the layer visibility UI
 * @see createFresnelEdgeMaterial for the hidden-mesh shader
 * @see ModelViewer3D-i11n.json for internationalization strings
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, Paper } from '@mui/material';
import { Replay, Warning } from '@mui/icons-material';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { useThreeScene } from '../../hooks/useThreeScene';
import { stringToColor } from '../../utils/color';
import { createFresnelEdgeMaterial } from '../../utils/fresnelEdgeMaterial';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { ModelLayersPanel } from '../ModelLayersPanel';
import { dbService } from '../../services/db';
import i11n from './ModelViewer3D-i11n.json';
import './ModelViewer3D.css';

/**
 * @interface ModelViewer3DProps
 * @brief Props for the ModelViewer3D component.
 *
 * @property fileName        - Name of the dental project file (e.g. "patient.dentalProject").
 * @property modelSuffixes   - Array of model suffix identifiers (e.g. ["lower", "upper", "crown"]).
 * @property activeSuffixIndex - Retained for backwards compatibility with the call site;
 *                                no longer drives any UI element (layers are not active/passive).
 * @property onChangeSuffixIndex - Retained for backwards compatibility; not used internally.
 */
interface ModelViewer3DProps {
    fileName: string;
    modelSuffixes: string[];
    activeSuffixIndex?: number;
    onChangeSuffixIndex?: (index: number) => void;
    jobId?: string;
}

/**
 * @interface WindowWithFileHandles
 * @brief Extended Window interface that includes a registry for local file handles.
 *
 * Maps file names to FileSystemFileHandle or File objects, allowing the component
 * to access locally stored STL files.
 *
 * @property {Record<string, FileSystemFileHandle|File>} [localFileHandles] - Optional registry.
 */
interface WindowWithFileHandles extends Window {
    localFileHandles?: Record<string, FileSystemFileHandle | File>;
}

/** Result of building a single layer mesh. */
interface MeshBuildResult {
    suffix: string;
    color: string;
    mesh: THREE.Mesh;
}

/* ------------------------------------------------------------------ */
/*  Helper: dispose a single mesh                                       */
/* ------------------------------------------------------------------ */

/**
 * Properly disposes of a Three.js mesh geometry and material resources.
 * @param obj - The mesh to dispose.
 */
const disposeMesh = (obj: THREE.Mesh) => {
    if (obj.geometry) obj.geometry.dispose();

    // Dispose all materials stored in userData to prevent memory leaks
    if (obj.userData.normalMat) {
        obj.userData.normalMat.dispose();
    }
    if (obj.userData.visibleFresnelMat) {
        obj.userData.visibleFresnelMat.dispose();
    }
    if (obj.userData.hiddenFresnelMat) {
        obj.userData.hiddenFresnelMat.dispose();
    }

    if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
    } else if (obj.material) {
        obj.material.dispose();
    }
};

/* ------------------------------------------------------------------ */
/*  Helper: purge all meshes from the scene                            */
/* ------------------------------------------------------------------ */

/**
 * Removes all mesh objects from the scene and disposes their resources.
 * Also clears the provided mesh map.
 * @param scene   - The Three.js scene to purge.
 * @param meshMap - Optional map of suffix -> mesh to clear.
 */
const purgeScene = (
    scene: THREE.Scene,
    meshMap?: Map<string, THREE.Mesh>
) => {
    if (meshMap) {
        for (const mesh of meshMap.values()) {
            scene.remove(mesh);
            disposeMesh(mesh);
        }
        meshMap.clear();
    }
};

/**
 * Determines a human-readable direction label (e.g. 'Top', 'Front') from a normalized camera direction vector.
 */
const getViewDirectionLabel = (targetToCam: THREE.Vector3, tolerance = 0.05): string => {
    if (Math.abs(targetToCam.x - 1) < tolerance && Math.abs(targetToCam.y) < tolerance && Math.abs(targetToCam.z) < tolerance) {
        return 'Right';
    }
    if (Math.abs(targetToCam.x + 1) < tolerance && Math.abs(targetToCam.y) < tolerance && Math.abs(targetToCam.z) < tolerance) {
        return 'Left';
    }
    if (Math.abs(targetToCam.y - 1) < tolerance && Math.abs(targetToCam.x) < tolerance && Math.abs(targetToCam.z) < tolerance) {
        return 'Back';
    }
    if (Math.abs(targetToCam.y + 1) < tolerance && Math.abs(targetToCam.x) < tolerance && Math.abs(targetToCam.z) < tolerance) {
        return 'Front';
    }
    if (Math.abs(targetToCam.z - 1) < tolerance && Math.abs(targetToCam.x) < tolerance && Math.abs(targetToCam.y) < tolerance) {
        return 'Top';
    }
    if (Math.abs(targetToCam.z + 1) < tolerance && Math.abs(targetToCam.x) < tolerance && Math.abs(targetToCam.y) < tolerance) {
        return 'Bottom';
    }
    return 'User';
};

/**
 * Loads a single BufferGeometry for a given suffix, trying real STL file handles
 * first. If the file is not in the in-memory registry, an error is thrown so the
 * caller can surface a "Missing file" indicator instead of silently substituting
 * a placeholder geometry.
 */
async function loadGeometryFromIndexedDB(
    targetFileNameLower: string,
    active: boolean,
    jobId: string
): Promise<THREE.BufferGeometry | null> {
    try {
        const assets = await dbService.getAssetsByJob(jobId);
        const matchingAsset = assets.find(a => a.fileName.toLowerCase() === targetFileNameLower);
        if (!matchingAsset) return null;

        const blob = await dbService.getAssetBlob(matchingAsset.id);
        if (!blob) return null;

        const arrayBuffer = await blob.arrayBuffer();
        if (!active) throw new Error('Cancelled');
        const loader = new STLLoader();
        return loader.parse(arrayBuffer);
    } catch (err) {
        console.error(`Failed to load asset ${targetFileNameLower} from IndexedDB:`, err);
        return null;
    }
}

/**
 * Loads a single BufferGeometry for a given suffix, trying real STL file handles
 * first. If the file is not in the in-memory registry, an error is thrown so the
 * caller can surface a "Missing file" indicator instead of silently substituting
 * a placeholder geometry.
 */
async function loadSingleGeometry(
    prefix: string,
    suffix: string,
    active: boolean,
    jobId?: string
): Promise<THREE.BufferGeometry> {
    const targetFileNameLower = `${prefix}-${suffix}.stl`.toLowerCase();

    const registry = (window as WindowWithFileHandles).localFileHandles || {};
    const foundKey = Object.keys(registry).find(
        (key) => key.toLowerCase() === targetFileNameLower
    );
    const fileHandle = foundKey
        ? (registry[foundKey] as FileSystemFileHandle | File)
        : null;

    if (fileHandle) {
        const file = 'getFile' in fileHandle ? await fileHandle.getFile() : fileHandle;
        const arrayBuffer = await file.arrayBuffer();
        if (!active) throw new Error('Cancelled');
        const loader = new STLLoader();
        return loader.parse(arrayBuffer);
    }

    // Fallback: Try to load from IndexedDB assets store!
    if (jobId) {
        const geom = await loadGeometryFromIndexedDB(targetFileNameLower, active, jobId);
        if (geom) return geom;
    }

    throw new Error(`MISSING_FILE: ${targetFileNameLower}`);
}

/**
 * Builds a single layer mesh (geometry, normal material, hidden fresnel material)
 * and returns the result. Returns `null` on error or if the operation was cancelled.
 */
async function buildLayerMesh(
    prefix: string,
    suffix: string,
    active: boolean,
    isHidden: boolean,
    jobId?: string
): Promise<MeshBuildResult | null> {
    try {
        const geometry = await loadSingleGeometry(prefix, suffix, active, jobId);
        if (!active) {
            geometry.dispose();
            return null;
        }

        const color = stringToColor(suffix);

        // Determine display color — crown/cad layers get gold.
        const lowSuffix = suffix.toLowerCase();
        const displayColor =
            lowSuffix.includes('crown') || lowSuffix.includes('cad')
                ? '#ffd700'
                : color;

        const normalMat = new THREE.MeshStandardMaterial({
            color: displayColor,
            roughness: 0.25,
            metalness: 0.45,
            flatShading: false,
            side: THREE.DoubleSide,
        });

        // Visible rim glow: kept low enough (alpha 0.15–0.35) that overlapping
        // layers compose approximately additively, so Three.js's mesh-centroid
        // transparent sort flip produces a near-invisible colour change as the
        // camera rotates. Higher alphas (e.g. 0.3+ at rim) make the sort flip
        // very apparent because the overlap region shows whichever fragment
        // won the sort instead of the natural blend.
        const visibleFresnelMat = createFresnelEdgeMaterial(color, 0.15, 0.20, 2.0, 0.0);
        // alphaTest=0.06 discards the low-alpha centre of the hidden rim so
        // the surviving pixels can write depth — fixes overlapping-hidden
        // layers "popping" through each other as the camera rotates.
        const hiddenFresnelMat = createFresnelEdgeMaterial(color, 0.03, 0.07, 2.0, 0.06);

        const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(geometry, normalMat);
        // Store materials in userData so we can swap them later.
        mesh.userData.normalMat = normalMat;
        mesh.userData.visibleFresnelMat = visibleFresnelMat;
        mesh.userData.hiddenFresnelMat = hiddenFresnelMat;

        // If this suffix should start hidden, use hidden fresnel material.
        if (isHidden) {
            mesh.material = hiddenFresnelMat;
            mesh.frustumCulled = false;
        } else {
            mesh.material = visibleFresnelMat;
            mesh.frustumCulled = false;
        }

        return { suffix, color, mesh };
    } catch (err) {
        if (active && (err as Error).message !== 'Cancelled') {
            console.error('3D layer load error:', suffix, err);
        }
        return null;
    }
}

/**
 * Creates a millimeter grid mesh with a custom ShaderMaterial.
 * The grid has 1mm spacing and a thicker, brighter 10mm (1cm) spacing,
 * and fades out at the edges of the grid plane.
 *
 * @param size - The total width and height of the grid plane.
 * @returns A THREE.Mesh representing the millimeter grid.
 */
function createMillimeterGrid(size: number = 300): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(size, size);
    
    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
            uGridColor: { value: new THREE.Color('#ffffff') },
            uMajorGridColor: { value: new THREE.Color('#ffffff') },
            uGridSize: { value: size }
        },
        vertexShader: `
            varying vec3 vLocalPosition;
            varying vec3 vWorldPosition;
            void main() {
                vLocalPosition = position;
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vLocalPosition;
            varying vec3 vWorldPosition;
            uniform vec3 uGridColor;
            uniform vec3 uMajorGridColor;
            uniform float uGridSize;

            void main() {
                vec2 coord = vWorldPosition.xy;
                vec2 derivative = fwidth(coord);
                
                // Avoid divide-by-zero if derivative is 0
                derivative = max(derivative, vec2(0.0001));

                // 1mm grid lines
                vec2 grid = abs(fract(coord - 0.5) - 0.5) / derivative;
                float line = min(grid.x, grid.y);
                float lineVal = 1.0 - min(line / 1.0, 1.0);
                
                // 10mm (1cm) grid lines
                vec2 grid10 = abs(fract(coord / 10.0 - 0.5) - 0.5) / (derivative / 10.0);
                float line10 = min(grid10.x, grid10.y);
                // 10mm lines are thicker (1.5px vs 1.0px)
                float line10Val = 1.0 - min(line10 / 1.5, 1.0);
                
                // Opacities
                float alpha1 = lineVal * 0.08;       // Thinner and dimmer 1mm line
                float alpha10 = line10Val * 0.35;    // Thicker and brighter 10mm line
                
                // Combine lines
                float alpha = max(alpha1, alpha10);
                vec3 color = mix(uGridColor, uMajorGridColor, line10Val);
                
                // Fade out towards the edges of the grid plane (based on local coordinates)
                float dist = length(vLocalPosition.xy);
                float maxDist = uGridSize * 0.5;
                // Fade starts at 40% of maxDist and goes to 95% of maxDist
                float fade = 1.0 - smoothstep(maxDist * 0.4, maxDist * 0.95, dist);
                
                if (alpha * fade < 0.001) {
                    discard;
                }
                
                gl_FragColor = vec4(color, alpha * fade);
            }
        `
    });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

/**
 * Safely removes a grid mesh from the scene and disposes of its resources.
 *
 * @param scene - The Three.js scene containing the grid.
 * @param gridMesh - The grid mesh to dispose, or null.
 */
function disposeGrid(scene: THREE.Scene, gridMesh: THREE.Mesh | null): void {
    if (!gridMesh) return;
    scene.remove(gridMesh);
    if (gridMesh.geometry) {
        gridMesh.geometry.dispose();
    }
    if (gridMesh.material) {
        if (Array.isArray(gridMesh.material)) {
            gridMesh.material.forEach((m) => m.dispose());
        } else {
            gridMesh.material.dispose();
        }
    }
}

/**
 * Recalculates bounding boxes, recreates the grid mesh, and positions it flat
 * at the bottom of the loaded model geometries.
 *
 * @param scene - The active Three.js scene.
 * @param meshesMap - The active loaded suffix-to-mesh map.
 * @param currentGrid - The existing grid mesh reference to replace.
 * @returns The new grid mesh reference, or null.
 */
function setupMillimeterGrid(
    scene: THREE.Scene,
    meshesMap: Map<string, THREE.Mesh>,
    currentGrid: THREE.Mesh | null
): THREE.Mesh | null {
    disposeGrid(scene, currentGrid);

    const box = new THREE.Box3();
    meshesMap.forEach((m) => {
        if (!m.geometry) return;
        m.geometry.computeBoundingBox();
        if (m.geometry.boundingBox) {
            box.union(m.geometry.boundingBox);
        }
    });

    if (box.isEmpty()) {
        return null;
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const modelRadius = Math.max(size.x, size.y) / 2 || 30;
    const gridSize = Math.max(300, modelRadius * 5);

    const gridMesh = createMillimeterGrid(gridSize);
    gridMesh.position.set(center.x, center.y, box.min.z - 0.05);

    scene.add(gridMesh);
    return gridMesh;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

/**
 * @component ModelViewer3D
 * @brief Main 3D model viewer component for dental CAD/CAM applications.
 *
 * Loads all model layers (suffixes) simultaneously into a single Three.js scene.
 * Provides a layers panel on the left for toggling visibility and selection.
 * @param props - Component properties.
 * @param props.fileName - Name of the dental project file.
 * @param props.modelSuffixes - Array of model suffix identifiers.
 * @param props.jobId - Optional unique identifier of the job.
 * @returns Rendered 3D model viewer component.
 */
export const ModelViewer3D = ({
    fileName,
    modelSuffixes,
    jobId
}: ModelViewer3DProps) => {
    const { language } = useLanguage();
    const localT = useCallback(
        (key: string) =>
            (i11n as Record<string, Record<string, string>>)[language]?.[key] || key,
        [language]
    );

    // --- Refs ---
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    /** Map suffix -> mesh for all loaded layers. */
    const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
    /** Reference to the millimeter grid mesh. */
    const gridMeshRef = useRef<THREE.Mesh | null>(null);

    // --- State ---
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hiddenSuffixes, setHiddenSuffixes] = useState<Set<string>>(new Set());
    const [hoveredSuffix, setHoveredSuffix] = useState<string | null>(null);
    const [layerColors, setLayerColors] = useState<Map<string, string>>(new Map());
    const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

    // Mirror of `hiddenSuffixes` for the GPU picking effect, which captures
    // the ref (not the state) so the pick rAF tick can read the *current*
    // hidden set without needing to tear down and rebuild the effect on
    // every visibility toggle. Without this, hidden layers would still
    // appear in the pick pass and steal hover from the visible ones,
    // breaking the "matte view" of just the visible layers.
    const hiddenSuffixesRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        hiddenSuffixesRef.current = hiddenSuffixes;
    }, [hiddenSuffixes]);

    // Determine which suffixes are considered "base" (labeled as base, but hideable).
    const baseSuffixes = useMemo(
        () => modelSuffixes.filter((s) => /base|lower|upper/i.test(s)),
        [modelSuffixes]
    );

    // --- Three.js scene (auto-rotate removed per UX requirement: "forgast kivesszuk") ---
    const { 
        sceneRef, 
        cameraRef, 
        rendererRef,
        controlsRef,
        setProjectionMode,
        snapToView,
        isTransitioning
    } = useThreeScene({
        containerRef,
        canvasRef,
        autoRotate: false,
    });

    const [cameraState, setCameraState] = useState<{
        quaternion: THREE.Quaternion;
        isOrthographic: boolean;
        viewLabel: string;
    }>({
        quaternion: new THREE.Quaternion(),
        isOrthographic: false,
        viewLabel: 'User Perspective'
    });

    const lastRotationRef = useRef<THREE.Quaternion>(new THREE.Quaternion());

    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;

        const updateCameraState = () => {
            const camera = cameraRef.current;
            if (!camera) return;

            const isOrtho = camera instanceof THREE.OrthographicCamera;
            const currentQuat = camera.quaternion;
            const hasRotated = !currentQuat.equals(lastRotationRef.current);
            lastRotationRef.current.copy(currentQuat);

            // If in orthographic, has rotated, and is NOT transitioning,
            // automatically switch back to perspective!
            if (isOrtho && hasRotated && !isTransitioning()) {
                setProjectionMode('perspective');
                return;
            }

            // Determine view label (User, Top, Front, Right, etc.)
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const targetToCam = dir.clone().negate().normalize();

            const dirLabel = getViewDirectionLabel(targetToCam);
            const label = `${dirLabel} ${camera instanceof THREE.OrthographicCamera ? 'Orthographic' : 'Perspective'}`;

            setCameraState({
                quaternion: camera.quaternion.clone(),
                isOrthographic: camera instanceof THREE.OrthographicCamera,
                viewLabel: label
            });
        };

        controls.addEventListener('change', updateCameraState);
        // Initial update
        updateCameraState();

        return () => {
            controls.removeEventListener('change', updateCameraState);
        };
    }, [cameraRef, controlsRef, isTransitioning, setProjectionMode]);

    const projectedAxes = useMemo(() => {
        const cameraQuaternion = cameraState.quaternion;
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternion);
        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuaternion);
        const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion);

        const axes = [
            { axis: 'x', dir: new THREE.Vector3(1, 0, 0), color: '#ff4f4f', label: 'X', isNegative: false },
            { axis: '-x', dir: new THREE.Vector3(-1, 0, 0), color: '#ff4f4f', label: 'X', isNegative: true },
            { axis: 'y', dir: new THREE.Vector3(0, 1, 0), color: '#1b5e20', label: 'Y', isNegative: false },
            { axis: '-y', dir: new THREE.Vector3(0, -1, 0), color: '#1b5e20', label: 'Y', isNegative: true },
            { axis: 'z', dir: new THREE.Vector3(0, 0, 1), color: '#2d69ff', label: 'Z', isNegative: false },
            { axis: '-z', dir: new THREE.Vector3(0, 0, -1), color: '#2d69ff', label: 'Z', isNegative: true }
        ];

        const projected = axes.map(a => {
            const screenX = a.dir.dot(cameraRight);
            const screenY = -a.dir.dot(cameraUp);
            const depth = a.dir.dot(cameraForward);
            return {
                ...a,
                x: 50 + screenX * 32,
                y: 50 + screenY * 32,
                depth
            };
        });

        return [...projected].sort((a, b) => b.depth - a.depth);
    }, [cameraState.quaternion]);

    /* -------------------------------------------------------------- */
    /*  Camera fitting                                                  */
    /* -------------------------------------------------------------- */

    /**
     * Fits the camera to the union bounding sphere of all currently visible layers.
     * If no layer is visible, falls back to the first mesh's bounds.
     */
    const fitCameraToScene = useCallback(() => {
        const controls = controlsRef.current;
        const camera = cameraRef.current;
        if (!controls || !camera) return;

        const meshes = Array.from(meshesRef.current.values())
            .filter((m) => !hiddenSuffixes.has(m.userData.suffix as string));

        if (meshes.length === 0) {
            const first = meshesRef.current.values().next().value as THREE.Mesh | undefined;
            if (!first) return;
            meshes.push(first);
        }

        const box = new THREE.Box3();
        meshes.forEach((m) => {
            if (!m.geometry) return;
            m.geometry.computeBoundingBox();
            if (m.geometry.boundingBox) {
                box.union(m.geometry.boundingBox);
            }
        });

        if (box.isEmpty()) return;
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const radius = Math.max(size.x, size.y, size.z) / 2 || 1;

        controls.target.copy(center);
        camera.up.set(0, 0, 1);
        camera.position.set(center.x, center.y - radius * 2.0, center.z + radius * 1.2);
        controls.update();
    }, [hiddenSuffixes, controlsRef, cameraRef]);

    /* -------------------------------------------------------------- */
    /*  Load all model geometries                                       */
    /* -------------------------------------------------------------- */

    useEffect(() => {
        let active = true;
        const scene = sceneRef.current;

        /**
         * Asynchronously loads all 3D models into the scene.
         */
        const loadAllModels = async () => {
            const camera = cameraRef.current;
            const controls = controlsRef.current;
            if (!scene || !camera || !controls) return;

            setLoading(true);
            setError(null);
            setHoveredSuffix(null);
            const missing = new Set<string>();

            // Remove existing meshes from scene and dispose.
            purgeScene(scene, meshesRef.current);

        const prefix = fileName.replace(/\.dentalproject$/i, '');
        const colorsAccum: [string, string][] = [];

        for (let i = 0; i < modelSuffixes.length; i++) {
            if (!active) return;

            const suffix = modelSuffixes[i];
            const isHidden = hiddenSuffixes.has(suffix);

            const result = await buildLayerMesh(prefix, suffix, active, isHidden, jobId);
            if (!result) {
                missing.add(suffix);
                continue;
            }

            // Stash the suffix on userData so fitCameraToScene can filter by visibility.
            result.mesh.userData.suffix = result.suffix;

            colorsAccum.push([result.suffix, result.color]);
            scene.add(result.mesh);
            meshesRef.current.set(result.suffix, result.mesh);
        }

        if (!active) return;

        setLayerColors(new Map(colorsAccum));
        setMissingFiles(missing);

        // Position the millimeter grid at the bottom bounds of the loaded geometry
        gridMeshRef.current = setupMillimeterGrid(scene, meshesRef.current, gridMeshRef.current);

        fitCameraToScene();
        setLoading(false);
    };

        loadAllModels();

        return () => {
            active = false;
            // Clean up grid when unmounting or re-running using the captured scene reference
            if (scene) {
                disposeGrid(scene, gridMeshRef.current);
                gridMeshRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileName, modelSuffixes.join(','), jobId]);

    /* -------------------------------------------------------------- */
    /*  GPU picking / Hover detection                                  */
    /* -------------------------------------------------------------- */

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        /* ---- GPU picking state ---- */
        const mousePixel = { x: 0, y: 0 };
        let pickNeeded = false;
        let pickRAF = 0;

        /* Lazy-init resources (renderer is null until scene hook runs) */
        let initialized = false;
        let pickScene: THREE.Scene;
        let pickTarget: THREE.WebGLRenderTarget;
        const pickMeshes = new Map<string, THREE.Mesh>();
        const pixelBuf = new Uint8Array(4);

        const initPick = () => {
            if (initialized) return;
            const renderer = rendererRef.current;
            if (!renderer) return;
            pickScene = new THREE.Scene();
            pickTarget = new THREE.WebGLRenderTarget(1, 1);
            initialized = true;
        };

        /* ---- Core pick: render offscreen and read one pixel ---- */
        const performPick = () => {
            if (!pickNeeded) return;
            pickNeeded = false;

            const camera = cameraRef.current;
            const renderer = rendererRef.current;
            if (!camera || !renderer) return;
            initPick();

            const rect = canvas.getBoundingClientRect();
            const cw = Math.floor(rect.width);
            const ch = Math.floor(rect.height);
            if (cw === 0 || ch === 0) return;

            // Resize pick target if canvas size changed
            if (pickTarget.width !== cw || pickTarget.height !== ch) {
                pickTarget.setSize(cw, ch);
            }

            /* Build ID→suffix map and sync pick meshes with main meshes.
             * Hidden meshes are kept in the pickScene with visible=false so
             * they're skipped by the pick render, but their geometry ref is
             * still updated in case they become visible again later. Only
             * visible meshes get an ID assigned and added to idToSuffix. */
            const idToSuffix = new Map<number, string>();
            const mainEntries = Array.from(meshesRef.current.entries());
            const hiddenSet = hiddenSuffixesRef.current;
            let nextId = 1;

            const syncPickMesh = (suffix: string, mesh: THREE.Mesh, isHidden: boolean) => {
                let pickMesh = pickMeshes.get(suffix);

                if (pickMesh) {
                    // Update geometry reference if model was reloaded
                    if (pickMesh.geometry !== mesh.geometry) {
                        pickMesh.geometry = mesh.geometry;
                    }
                } else {
                    pickMesh = new THREE.Mesh(
                        mesh.geometry,
                        new THREE.MeshBasicMaterial({ vertexColors: false })
                    );
                    pickMeshes.set(suffix, pickMesh);
                    pickScene.add(pickMesh);
                }

                // Hidden meshes are excluded from the pick pass so the user
                // gets a clean matte view of just the visible layers.
                pickMesh.visible = !isHidden;

                if (!isHidden) {
                    pickMesh.position.copy(mesh.position);
                    pickMesh.quaternion.copy(mesh.quaternion);
                    pickMesh.scale.copy(mesh.scale);
                    (pickMesh.material as THREE.MeshBasicMaterial).color.setHex(nextId, THREE.LinearSRGBColorSpace);
                    idToSuffix.set(nextId, suffix);
                    nextId++;
                }
            };

            for (let i = 0; i < mainEntries.length; i++) {
                const [suffix, mesh] = mainEntries[i];
                syncPickMesh(suffix, mesh, hiddenSet.has(suffix));
            }

            /* Remove stale pick meshes (suffix no longer in main scene) */
            for (const [suffix, pickMesh] of pickMeshes) {
                if (!meshesRef.current.has(suffix)) {
                    pickScene.remove(pickMesh);
                    (pickMesh.material as THREE.MeshBasicMaterial).dispose();
                    pickMeshes.delete(suffix);
                }
            }

            /* Nothing to pick — clear hover */
            if (pickScene.children.length === 0) {
                setHoveredSuffix(null);
                return;
            }

            /* ---- Offscreen render pass ---- */
            renderer.setRenderTarget(pickTarget);
            renderer.render(pickScene, camera);
            renderer.setRenderTarget(null);

            /* Read the single pixel under the cursor */
            const px = Math.min(Math.max(0, Math.floor(mousePixel.x)), pickTarget.width - 1);
            const py = Math.min(Math.max(0, Math.floor(mousePixel.y)), pickTarget.height - 1);
            renderer.readRenderTargetPixels(pickTarget, px, py, 1, 1, pixelBuf);

        /* Decode RGB → integer ID.
         * Note: `Color.setHex(id)` puts the high byte of `id` into the red
         * channel (`id >> 16 & 0xff`), so the byte order on read-back is
         * R-high, G-mid, B-low — the opposite of `readRenderTargetPixels`
         * returning bytes in RGBA order. */
        const id = (pixelBuf[0] << 16) | (pixelBuf[1] << 8) | pixelBuf[2];
        const suffix = idToSuffix.get(id) ?? null;

            setHoveredSuffix((prev) => (suffix !== prev ? suffix : prev));
        };

        /* ---- rAF tick: decouples picking from mouse event rate ---- */
        const tick = () => {
            pickRAF = requestAnimationFrame(tick);
            try {
                performPick();
            } catch (err) {
                console.warn('Error in performPick:', err);
            }
        };
        pickRAF = requestAnimationFrame(tick);

        /* ---- Pointer event handlers ---- */
        const handlePointerMove = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            mousePixel.x = e.clientX - rect.left;
            mousePixel.y = rect.height - (e.clientY - rect.top);
            pickNeeded = true;
        };

        const handlePointerLeave = () => {
            setHoveredSuffix(null);
            pickNeeded = false;
        };

        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerleave', handlePointerLeave);

        /* ---- Cleanup ---- */
        return () => {
            cancelAnimationFrame(pickRAF);
            canvas.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('pointerleave', handlePointerLeave);

            if (initialized) {
                pickTarget.dispose();
                for (const [, pickMesh] of pickMeshes) {
                    pickScene.remove(pickMesh);
                    (pickMesh.material as THREE.MeshBasicMaterial).dispose();
                }
                pickMeshes.clear();
            }
        };
    }, [cameraRef, rendererRef]);

    /* -------------------------------------------------------------- */
    /*  Hidden / visible material swap                                  */
    /* -------------------------------------------------------------- */

    // Whenever hiddenSuffixes or hoveredSuffix changes, swap materials on the corresponding meshes.
    useEffect(() => {
        for (const [suffix, mesh] of meshesRef.current) {
            const isHidden = hiddenSuffixes.has(suffix);
            const isHovered = (hoveredSuffix === suffix);

            const normalMat = mesh.userData.normalMat as THREE.MeshStandardMaterial | undefined;
            const visibleFresnelMat = mesh.userData.visibleFresnelMat as THREE.ShaderMaterial | undefined;
            const hiddenFresnelMat = mesh.userData.hiddenFresnelMat as THREE.ShaderMaterial | undefined;

            if (isHovered && normalMat) {
                mesh.material = normalMat;
                mesh.frustumCulled = true;
            } else if (isHidden && hiddenFresnelMat) {
                mesh.material = hiddenFresnelMat;
                mesh.frustumCulled = false;
            } else if (!isHidden && visibleFresnelMat) {
                mesh.material = visibleFresnelMat;
                mesh.frustumCulled = false;
            }
        }
    }, [hiddenSuffixes, hoveredSuffix]);

    /* -------------------------------------------------------------- */
    /*  Visibility toggle handler                                       */
    /* -------------------------------------------------------------- */

    const toggleVisibility = useCallback((suffix: string) => {
        setHiddenSuffixes((prev) => {
            const next = new Set(prev);
            if (next.has(suffix)) {
                next.delete(suffix);
            } else {
                next.add(suffix);
            }
            return next;
        });
    }, []);

    /* -------------------------------------------------------------- */
    /*  Reset view handler                                              */
    /* -------------------------------------------------------------- */

    const handleGizmoMouseDown = (mouseDownEvent: React.MouseEvent<HTMLOrSVGElement>) => {
        mouseDownEvent.stopPropagation();
        mouseDownEvent.preventDefault();

        const controls = controlsRef.current;
        if (!controls) return;

        let startX = mouseDownEvent.clientX;
        let startY = mouseDownEvent.clientY;

        document.body.style.cursor = 'grabbing';

        const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
            const dx = mouseMoveEvent.clientX - startX;
            const dy = mouseMoveEvent.clientY - startY;
            startX = mouseMoveEvent.clientX;
            startY = mouseMoveEvent.clientY;

            const factor = 0.007;
            controls.rotateLeft(dx * factor);
            controls.rotateUp(dy * factor);
            controls.update();
        };

        const handleMouseUp = () => {
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleResetView = useCallback(() => {
        fitCameraToScene();
    }, [fitCameraToScene]);

    /* -------------------------------------------------------------- */
    /*  Render                                                          */
    /* -------------------------------------------------------------- */

    return (
        <Paper variant="outlined" className="model-viewer-paper">
            {/* 3D Canvas Area */}
            <Box className="canvas-container">
                {/* Viewport Wrapper (takes flex: 1, contains canvas and overlays) */}
                <Box ref={containerRef} className="viewport-wrapper">
                    {loading && (
                        <Box className="loading-overlay">
                            <CircularProgress color="primary" />
                        </Box>
                    )}
                    {error && (
                        <Box className="error-overlay">
                            <Typography color="error" variant="body1">
                                {error}
                            </Typography>
                        </Box>
                    )}
                    {!loading && !error && modelSuffixes.length > 0 && meshesRef.current.size === 0 && (
                        <Box className="missing-model-overlay">
                            <Box className="missing-model-card">
                                <Warning className="missing-model-icon" />
                                <Typography variant="h6" className="missing-model-title">
                                    {localT('modelsNotFoundTitle')}
                                </Typography>
                                <Typography variant="body2" className="missing-model-message">
                                    {localT('modelsNotFoundMessage')}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                    <canvas ref={canvasRef} className="canvas" />

                    {/* Viewport text indicator (top-left) */}
                    {!loading && !error && cameraState.viewLabel && cameraState.viewLabel !== 'User Perspective' && (
                        <div className="viewport-text-indicator">
                            {cameraState.viewLabel}
                        </div>
                    )}

                    {/* Viewport orientation gizmo (top-right) */}
                    {!loading && !error && (
                        <div className="viewport-gizmo-container">
                            <svg className="viewport-gizmo-svg" viewBox="0 0 100 100">
                                {/* Circular background shadow & trackball outline */}
                                <circle 
                                    cx="50" 
                                    cy="50" 
                                    r="45" 
                                    fill="rgba(255, 255, 255, 0.05)" 
                                    stroke="rgba(255, 255, 255, 0.25)" 
                                    strokeWidth="1"
                                    className="viewport-gizmo-trackball"
                                    onMouseDown={handleGizmoMouseDown}
                                />
                                
                                {/* Render lines and circles for projected axes */}
                                {projectedAxes.map((axis) => {
                                    const isNeg = axis.isNegative;
                                    if (isNeg) {
                                        return (
                                            <g 
                                                key={axis.axis} 
                                                className="viewport-gizmo-axis-btn"
                                                onClick={() => snapToView(axis.axis as 'x' | '-x' | 'y' | '-y' | 'z' | '-z')}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <circle 
                                                    cx={axis.x} 
                                                    cy={axis.y} 
                                                    r="4" 
                                                    fill="#121212" 
                                                    stroke={axis.color} 
                                                    strokeWidth="1.5" 
                                                    opacity="0.75"
                                                />
                                            </g>
                                        );
                                    } else {
                                        return (
                                            <g 
                                                key={axis.axis} 
                                                className="viewport-gizmo-axis-btn"
                                                onClick={() => snapToView(axis.axis as 'x' | '-x' | 'y' | '-y' | 'z' | '-z')}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <line 
                                                    x1="50" 
                                                    y1="50" 
                                                    x2={axis.x} 
                                                    y2={axis.y} 
                                                    stroke={axis.color} 
                                                    strokeWidth="2" 
                                                    opacity="0.85"
                                                />
                                                <circle 
                                                    cx={axis.x} 
                                                    cy={axis.y} 
                                                    r="7" 
                                                    fill={axis.color} 
                                                />
                                                <text 
                                                    x={axis.x} 
                                                    y={axis.y + 2.5} 
                                                    fill="#ffffff" 
                                                    stroke="#000000"
                                                    strokeWidth="1.2"
                                                    paintOrder="stroke fill"
                                                    fontSize="8.5" 
                                                    fontWeight="bold" 
                                                    textAnchor="middle"
                                                    pointerEvents="none"
                                                >
                                                    {axis.label}
                                                </text>
                                            </g>
                                        );
                                    }
                                })}
                            </svg>
                        </div>
                    )}
                </Box>

                {/* Layers Panel — right side, eye-icon toggles */}
                {modelSuffixes.length > 0 && (
                    <ModelLayersPanel
                        suffixes={modelSuffixes}
                        hiddenSuffixes={hiddenSuffixes}
                        baseSuffixes={baseSuffixes}
                        layerColors={layerColors}
                        missingFiles={missingFiles}
                        onToggleVisibility={toggleVisibility}
                    />
                )}
            </Box>

            {/* Bottom Controls Area */}
            <Box className="controls-container">
                <Box flex={1} />

                <Box display="flex" alignItems="center" gap={1}>
                    <ResponsiveTooltip title={localT('resetView')}>
                        <Button
                            variant="outlined"
                            size="small"
                            color="inherit"
                            startIcon={<Replay />}
                            onClick={handleResetView}
                            className="reset-button"
                        >
                            {localT('resetView')}
                        </Button>
                    </ResponsiveTooltip>
                </Box>
            </Box>
        </Paper>
    );
};
