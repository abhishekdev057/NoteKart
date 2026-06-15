"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function ThreeDNotebookStack() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 480;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 6.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 1.8; // Limit bottom rotation
    controls.minDistance = 4;
    controls.maxDistance = 10;
    controls.enableZoom = false; // Disable zoom to prevent scroll hijack on landing page
    controls.autoRotate = false;

    let isDragging = false;
    controls.addEventListener("start", () => {
      isDragging = true;
    });
    controls.addEventListener("end", () => {
      isDragging = false;
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffdf6, 1.1);
    dirLight.position.set(5, 10, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 20;
    dirLight.shadow.camera.left = -4;
    dirLight.shadow.camera.right = 4;
    dirLight.shadow.camera.top = 4;
    dirLight.shadow.camera.bottom = -4;
    dirLight.shadow.bias = -0.0006;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x0c8f84, 0.22);
    fillLight.position.set(-6, 2, -3);
    scene.add(fillLight);

    // Shadow plane catcher (so books cast shadow on floor)
    const shadowPlaneGeo = new THREE.PlaneGeometry(10, 10);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.1 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.8;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Book stack container group
    const stackGroup = new THREE.Group();
    stackGroup.position.set(-0.2, 0, 0);
    scene.add(stackGroup);

    // Helper to generate a landscape book mesh
    const createBook = (
      w: number,
      h: number,
      t: number,
      baseColor: string,
      textColor: string,
      topText: string,
      mainText: string,
      gradColors: [string, string]
    ) => {
      const bookGroup = new THREE.Group();

      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 360; // Landscape aspect ratio
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw elegant gradient background
        const grad = ctx.createLinearGradient(0, 0, 512, 360);
        grad.addColorStop(0, gradColors[0]);
        grad.addColorStop(1, gradColors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 360);

        // Spine highlight binding line on cover
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
        ctx.fillRect(0, 0, 24, 360);

        // Draw top text
        ctx.fillStyle = textColor;
        ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(topText.toUpperCase(), 45, 40);

        // Draw main text
        ctx.font = "800 32px system-ui, -apple-system, sans-serif";
        ctx.fillText(mainText, 45, 280);
      }

      const coverTexture = new THREE.CanvasTexture(canvas);
      coverTexture.colorSpace = THREE.SRGBColorSpace;

      const coverMat = new THREE.MeshStandardMaterial({
        map: coverTexture,
        roughness: 0.5,
        metalness: 0.08,
      });

      const coverBaseMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.65,
        metalness: 0.05,
      });

      // Front Cover
      const coverGeo = new THREE.BoxGeometry(w, h, 0.035);
      const frontMaterials = [
        coverBaseMat,
        coverBaseMat,
        coverBaseMat,
        coverBaseMat,
        coverMat, // Face map
        coverBaseMat,
      ];
      const frontCover = new THREE.Mesh(coverGeo, frontMaterials);
      frontCover.position.set(0, 0, t / 2 + 0.035 / 2);
      frontCover.castShadow = true;
      bookGroup.add(frontCover);

      // Back Cover
      const backCover = new THREE.Mesh(coverGeo, coverBaseMat);
      backCover.position.set(0, 0, -t / 2 - 0.035 / 2);
      backCover.castShadow = true;
      bookGroup.add(backCover);

      // Spine
      const spineGeo = new THREE.BoxGeometry(0.035, h, t + 0.07);
      const spine = new THREE.Mesh(spineGeo, coverBaseMat);
      spine.position.set(-w / 2 - 0.035 / 2, 0, 0);
      spine.castShadow = true;
      bookGroup.add(spine);

      // Pages
      const pagesGeo = new THREE.BoxGeometry(w - 0.04, h - 0.05, t);
      const pagesMat = new THREE.MeshStandardMaterial({
        color: "#fbfcf6",
        roughness: 0.85,
        metalness: 0.0,
      });
      const pages = new THREE.Mesh(pagesGeo, pagesMat);
      pages.position.set(0.02, 0, 0);
      pages.castShadow = true;
      bookGroup.add(pages);

      return { bookGroup, coverTexture, coverMat, coverBaseMat, pagesGeo, pagesMat, coverGeo, spineGeo };
    };

    // Instantiate 3 books matching the original landing page stacked cards
    const bookWidth = 3.3;
    const bookHeight = 2.25;
    const bookThickness = 0.16;

    // Book 1: A4 Photo Album (Teal)
    const b1 = createBook(
      bookWidth,
      bookHeight,
      bookThickness,
      "#08534d", // Dark teal
      "rgba(255, 255, 255, 0.95)",
      "NoteKart",
      "A4 Photo Album",
      ["#0c8f84", "#084e49"]
    );
    b1.bookGroup.position.set(0, 0.65, 0.45);
    stackGroup.add(b1.bookGroup);

    // Book 2: 192 Pages Classmate Series (Saffron)
    const b2 = createBook(
      bookWidth,
      bookHeight,
      bookThickness,
      "#5a2c0c", // Dark saffron
      "rgba(255, 255, 255, 0.95)",
      "Classmate Series",
      "192 Pages",
      ["#d97919", "#783b0a"]
    );
    b2.bookGroup.position.set(0.35, 0.05, 0.0);
    stackGroup.add(b2.bookGroup);

    // Book 3: A5 Hardbound (Gold/Beige)
    const b3 = createBook(
      bookWidth,
      bookHeight,
      bookThickness,
      "#201e1a", // Dark charcoal base
      "#17130f", // Dark ink text
      "Doomra Made",
      "A5 Hardbound",
      ["#f6e3af", "#d4b36c"]
    );
    b3.bookGroup.position.set(0.7, -0.55, -0.45);
    stackGroup.add(b3.bookGroup);

    // Apply default isometric stack tilt
    stackGroup.rotation.x = 0.9;
    stackGroup.rotation.y = -0.15;
    stackGroup.rotation.z = -0.32;

    // Add gentle hover parallax effect
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = x * 0.4; // Parallax intensity
      targetY = y * 0.3;
    };

    container.addEventListener("mousemove", handleMouseMove);

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const time = Date.now() * 0.001;

      // Independent floating for each notebook
      b1.bookGroup.position.y = 0.65 + Math.sin(time * 1.6) * 0.04;
      b2.bookGroup.position.y = 0.05 + Math.sin(time * 1.3 + 1.2) * 0.03;
      b3.bookGroup.position.y = -0.55 + Math.sin(time * 1.1 + 2.5) * 0.02;

      // Dynamic mouse parallax dampening
      if (!isDragging) {
        // Only apply mouse parallax if user is not actively dragging the stack
        stackGroup.rotation.x = THREE.MathUtils.lerp(stackGroup.rotation.x, 0.9 + targetY, 0.08);
        stackGroup.rotation.y = THREE.MathUtils.lerp(stackGroup.rotation.y, -0.15 + targetX, 0.08);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousemove", handleMouseMove);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();

      // Dispose resources for all books
      [b1, b2, b3].forEach((b) => {
        b.coverGeo.dispose();
        b.spineGeo.dispose();
        b.pagesGeo.dispose();
        b.coverTexture.dispose();
        b.coverMat.dispose();
        b.coverBaseMat.dispose();
        b.pagesMat.dispose();
      });

      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[420px] w-full items-center justify-center md:h-[500px]"
    >
      <canvas ref={canvasRef} className="block h-full w-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-2 right-4 rounded bg-black/60 px-2.5 py-1 text-[10px] font-medium tracking-wider text-white/90 uppercase select-none pointer-events-none">
        Drag to spin stack
      </div>
    </div>
  );
}
