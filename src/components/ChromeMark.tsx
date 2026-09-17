"use client";

// The hero's shape in chrome: the flat SVG pushed out into a solid with
// Three.js, given a mirror-like finish that reflects a generated room, and
// turned slowly on its vertical axis. Scrolling gives the turn a push that
// eases back out.
//
// Three.js loads only when this mounts, so it stays out of every other
// page. Until the model is ready, and wherever WebGL is missing, the flat
// SVG shows in its place. For reduced motion the model holds still at an
// angle. Rendering pauses while it is off screen.

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const SPIN = 0.006; // radians per frame at rest
const KICK = 0.00004; // radians per frame, per pixel of scroll
const KICK_MAX = 0.08;
const REST_ANGLE = -0.45; // where it starts, and where it stays for reduced motion

export function ChromeMark({ src, className }: { src: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { SVGLoader } = await import("three/addons/loaders/SVGLoader.js");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      if (disposed) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // No WebGL: the flat SVG stays.
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.className = "absolute inset-0 size-full";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      scene.environment = pmrem.fromScene(room, 0.04).texture;

      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(3, 4, 8);
      const fill = new THREE.DirectionalLight(0xa8d8ff, 1.2);
      fill.position.set(-4, -1, 6);
      const rim = new THREE.DirectionalLight(0xffffff, 1);
      rim.position.set(0, 2, -8);
      scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.8));

      const camera = new THREE.PerspectiveCamera(10, 1, 0.1, 100);
      camera.position.set(0, 0, 13);

      // The SVG as solids, centred, and flipped (SVG's y runs down).
      const svg = await new SVGLoader().loadAsync(src);
      if (disposed) {
        renderer.dispose();
        return;
      }
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xe7ecf6,
        metalness: 0.92,
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.7,
        side: THREE.DoubleSide,
      });
      const model = new THREE.Group();
      const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
      const outline = new THREE.Box2().setFromPoints(shapes.flatMap((shape) => shape.getPoints()));
      const depth = (outline.max.x - outline.min.x) * 0.045;
      for (const shape of shapes) {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelSegments: 3,
          bevelSize: depth * 0.04,
          bevelThickness: depth * 0.08,
          curveSegments: 40,
        });
        model.add(new THREE.Mesh(geometry, material));
      }
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      for (const mesh of model.children as import("three").Mesh[]) {
        mesh.geometry.translate(-center.x, -center.y, -center.z);
        mesh.geometry.scale(1, -1, 1);
        mesh.geometry.computeVertexNormals();
      }
      model.rotation.y = REST_ANGLE;
      scene.add(model);

      // Fit the model to 90% of the view, whatever the box's shape.
      const fit = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const viewH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const viewW = viewH * camera.aspect;
        model.scale.setScalar(Math.min((viewW * 0.9) / size.x, (viewH * 0.9) / size.y));
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(host);

      const still = prefersReducedMotion();
      let kick = 0;
      let eased = 0;
      let lastY = window.scrollY;
      let frame = 0;
      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (!still) {
          const y = window.scrollY;
          kick = THREE.MathUtils.clamp((y - lastY) * KICK, -KICK_MAX, KICK_MAX) || kick * 0.9;
          lastY = y;
          eased += (kick - eased) * 0.16;
          model.rotation.y -= SPIN + eased;
        }
        renderer.render(scene, camera);
      };
      const io = new IntersectionObserver(([entry]) => {
        cancelAnimationFrame(frame);
        if (entry.isIntersecting) frame = requestAnimationFrame(tick);
      });
      io.observe(host);
      renderer.render(scene, camera);
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(frame);
        io.disconnect();
        ro.disconnect();
        model.traverse((o) => (o as import("three").Mesh).geometry?.dispose());
        material.dispose();
        scene.environment?.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [src]);

  return (
    <div ref={box} className={cn("relative", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimizing */}
      <img
        src={src}
        alt=""
        aria-hidden
        className={cn("size-full object-contain transition-opacity duration-500", ready && "opacity-0")}
      />
    </div>
  );
}
