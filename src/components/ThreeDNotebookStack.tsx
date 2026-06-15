"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeDNotebookStack() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 480;
    const isMobile = width < 768;

    // Scene
    const scene = new THREE.Scene();

    // Camera - dynamic distance based on mobile/desktop
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    if (isMobile) {
      camera.position.set(0, 3.2, 8.2);
    } else {
      camera.position.set(0, 2.5, 6.5);
    }

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

    // No interactive OrbitControls to keep it as a clean looping visual

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffdf6, 1.25);
    dirLight.position.set(6, 11, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 22;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x0c8f84, 0.25);
    fillLight.position.set(-6, 3, -4);
    scene.add(fillLight);

    // Floor Shadow plane catcher
    const shadowPlaneGeo = new THREE.PlaneGeometry(12, 12);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.95;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Auto rotation parameters

    // Central Stack container group
    const stackGroup = new THREE.Group();
    stackGroup.position.set(0, 0.2, 0); // centered vertical offset
    scene.add(stackGroup);

    // --- LANDSCAPE BOOK GENERATOR ---
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
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 512, 360);
        grad.addColorStop(0, gradColors[0]);
        grad.addColorStop(1, gradColors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 360);

        ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
        ctx.fillRect(0, 0, 24, 360);

        ctx.fillStyle = textColor;
        ctx.font = "bold 14px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(topText.toUpperCase(), 45, 40);

        ctx.font = "800 32px system-ui, sans-serif";
        ctx.fillText(mainText, 45, 275);
      }

      const coverTexture = new THREE.CanvasTexture(canvas);
      coverTexture.colorSpace = THREE.SRGBColorSpace;

      const coverMat = new THREE.MeshStandardMaterial({
        map: coverTexture,
        roughness: 0.45,
        metalness: 0.08,
      });

      const coverBaseMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.6,
        metalness: 0.05,
      });

      const coverGeo = new THREE.BoxGeometry(w, h, 0.035);
      const frontMaterials = [
        coverBaseMat,
        coverBaseMat,
        coverBaseMat,
        coverBaseMat,
        coverMat,
        coverBaseMat,
      ];
      const frontCover = new THREE.Mesh(coverGeo, frontMaterials);
      frontCover.position.set(0, 0, t / 2 + 0.035 / 2);
      frontCover.castShadow = true;
      bookGroup.add(frontCover);

      const backCover = new THREE.Mesh(coverGeo, coverBaseMat);
      backCover.position.set(0, 0, -t / 2 - 0.035 / 2);
      backCover.castShadow = true;
      bookGroup.add(backCover);

      const spineGeo = new THREE.BoxGeometry(0.035, h, t + 0.07);
      const spine = new THREE.Mesh(spineGeo, coverBaseMat);
      spine.position.set(-w / 2 - 0.035 / 2, 0, 0);
      spine.castShadow = true;
      bookGroup.add(spine);

      const pagesGeo = new THREE.BoxGeometry(w - 0.04, h - 0.05, t);
      const pagesMat = new THREE.MeshStandardMaterial({
        color: "#fcfcf7",
        roughness: 0.8,
        metalness: 0.0,
      });
      const pages = new THREE.Mesh(pagesGeo, pagesMat);
      pages.position.set(0.02, 0, 0);
      pages.castShadow = true;
      bookGroup.add(pages);

      return { bookGroup, coverTexture, coverMat, coverBaseMat, pagesGeo, pagesMat, coverGeo, spineGeo };
    };

    const bookWidth = 3.1;
    const bookHeight = 2.15;
    const bookThickness = 0.16;

    // Book 1: A4 Photo Album (Teal) - Top
    const b1 = createBook(
      bookWidth,
      bookHeight,
      bookThickness,
      "#08534d",
      "rgba(255, 255, 255, 0.95)",
      "NoteKart",
      "A4 Photo Album",
      ["#0c8f84", "#064642"]
    );
    b1.bookGroup.position.set(-0.16, 0.16, 0.58);
    b1.bookGroup.rotation.y = 0.05;
    stackGroup.add(b1.bookGroup);

    // Book 2: 192 Pages Classmate Series (Saffron) - Middle
    const b2 = createBook(
      bookWidth,
      bookHeight,
      bookThickness,
      "#5a2c0c",
      "rgba(255, 255, 255, 0.95)",
      "Classmate Series",
      "192 Pages",
      ["#d97919", "#783b0a"]
    );
    b2.bookGroup.position.set(0.0, 0.0, 0.0);
    b2.bookGroup.rotation.y = -0.04;
    stackGroup.add(b2.bookGroup);

    // Book 3: A5 Hardbound (Gold/Beige) - Bottom
    const b3 = createBook(
      bookWidth,
      bookHeight,
      bookThickness,
      "#201e1a",
      "#17130f",
      "Doomra Made",
      "A5 Hardbound",
      ["#f6e3af", "#cca75a"]
    );
    b3.bookGroup.position.set(0.16, -0.16, -0.58);
    b3.bookGroup.rotation.y = 0.02;
    stackGroup.add(b3.bookGroup);

    // Front-on tilt on stackGroup (clean horizontal stack)
    stackGroup.rotation.x = 0.2;
    stackGroup.rotation.y = -0.4;
    stackGroup.rotation.z = 0;

    // --- DISPLAY PEDESTAL (FLOATING BASE) ---
    const pedestalGeo = new THREE.CylinderGeometry(2.3, 2.3, 0.15, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: "#f3eee3",
      roughness: 0.5,
      metalness: 0.05,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, -0.65, 0);
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    scene.add(pedestal);

    // --- ABSTRACT PREMIUM SHAPES ---
    // 1. Golden Idea Ring
    const ringGeo = new THREE.TorusGeometry(2.3, 0.03, 16, 80);
    const ringMat = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      metalness: 0.95,
      roughness: 0.15,
    });
    const goldenRing = new THREE.Mesh(ringGeo, ringMat);
    goldenRing.position.set(0, 0, 0);
    goldenRing.rotation.x = Math.PI / 3;
    goldenRing.castShadow = true;
    scene.add(goldenRing);

    // 2. Frosted Glass Sphere
    const glassSphereGeo = new THREE.SphereGeometry(0.28, 32, 32);
    const glassSphereMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.15,
      metalness: 0.0,
      transmission: 0.9,
      thickness: 0.6,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const glassSphere = new THREE.Mesh(glassSphereGeo, glassSphereMat);
    glassSphere.position.set(1.9, 0.4, 0.6);
    glassSphere.castShadow = true;
    scene.add(glassSphere);

    // 3. Matte Teal Clay Sphere
    const tealSphereGeo = new THREE.SphereGeometry(0.18, 32, 32);
    const tealSphereMat = new THREE.MeshStandardMaterial({
      color: "#0c8f84",
      roughness: 0.75,
      metalness: 0.0,
    });
    const tealSphere = new THREE.Mesh(tealSphereGeo, tealSphereMat);
    tealSphere.position.set(-1.8, -0.1, -0.8);
    tealSphere.castShadow = true;
    scene.add(tealSphere);

    // 4. Matte Saffron Cone
    const saffronConeGeo = new THREE.ConeGeometry(0.14, 0.32, 32);
    const saffronConeMat = new THREE.MeshStandardMaterial({
      color: "#d97919",
      roughness: 0.8,
      metalness: 0.0,
    });
    const saffronCone = new THREE.Mesh(saffronConeGeo, saffronConeMat);
    saffronCone.position.set(1.5, -0.2, -1.0);
    saffronCone.castShadow = true;
    scene.add(saffronCone);

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

    // --- ANIMATION LOOP ---
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const time = Date.now() * 0.001;

      // Gentle floating for the entire stack group (keeps relative notebook distances intact)
      stackGroup.position.y = 0.2 + Math.sin(time * 1.2) * 0.06;

      // Micro Z-direction float for books to prevent sliding overlap
      b1.bookGroup.position.z = 0.58 + Math.sin(time * 1.5) * 0.008;
      b2.bookGroup.position.z = 0.0 + Math.sin(time * 1.25 + 1.2) * 0.005;
      b3.bookGroup.position.z = -0.58 + Math.sin(time * 1.05 + 2.5) * 0.008;

      // Slow orbital rotate of stack (gentle auto-rotation oscillation)
      stackGroup.rotation.x = THREE.MathUtils.lerp(stackGroup.rotation.x, 0.2 + Math.sin(time * 0.4) * 0.015, 0.08);
      stackGroup.rotation.y = THREE.MathUtils.lerp(stackGroup.rotation.y, -0.4 + Math.cos(time * 0.3) * 0.02, 0.08);

      // Pedestal breathing
      pedestal.position.y = -0.65 + Math.sin(time * 0.8) * 0.02;

      // Golden ring rotation
      goldenRing.rotation.z = time * 0.25;

      // Floating / orbiting abstract objects
      glassSphere.position.y = 0.4 + Math.sin(time * 1.1) * 0.08;
      glassSphere.position.x = 1.9 + Math.sin(time * 0.6) * 0.15;
      glassSphere.position.z = 0.6 + Math.cos(time * 0.6) * 0.15;

      tealSphere.position.y = -0.1 + Math.cos(time * 1.3) * 0.06;
      tealSphere.position.x = -1.8 + Math.cos(time * 0.5) * 0.12;
      tealSphere.position.z = -0.8 + Math.sin(time * 0.5) * 0.12;

      saffronCone.position.y = -0.2 + Math.sin(time * 0.95) * 0.07;
      saffronCone.rotation.y = time * 0.5;
      saffronCone.rotation.z = Math.sin(time * 0.8) * 0.15;

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup resources
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();

      // Dispose Central Stack
      [b1, b2, b3].forEach((b) => {
        b.coverGeo.dispose();
        b.spineGeo.dispose();
        b.pagesGeo.dispose();
        b.coverTexture.dispose();
        b.coverMat.dispose();
        b.coverBaseMat.dispose();
        b.pagesMat.dispose();
      });

      // Dispose Pedestal and Abstract Shapes
      pedestalGeo.dispose();
      pedestalMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      glassSphereGeo.dispose();
      glassSphereMat.dispose();
      tealSphereGeo.dispose();
      tealSphereMat.dispose();
      saffronConeGeo.dispose();
      saffronConeMat.dispose();

      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[440px] w-full items-center justify-center md:h-[520px] pointer-events-none"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
