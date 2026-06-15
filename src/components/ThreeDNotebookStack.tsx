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

    // Orbit Controls - full spherical view
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = isMobile ? 5.5 : 4;
    controls.maxDistance = 12;
    controls.enableZoom = false; // Prevent page scroll hijack

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

    // Dynamic drag tracking
    let isDragging = false;
    controls.addEventListener("start", () => {
      isDragging = true;
    });
    controls.addEventListener("end", () => {
      isDragging = false;
    });

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

    // Isometric tilt on stackGroup
    stackGroup.rotation.x = 0.85;
    stackGroup.rotation.y = -0.15;
    stackGroup.rotation.z = -0.3;

    // --- PROCEDURAL WORKSPACE ELEMENTS (NEAT FLAT-LAY DESK LAYOUT) ---

    // 1. Ruled Paper Sheet
    const ruledPaperCanvas = document.createElement("canvas");
    ruledPaperCanvas.width = 512;
    ruledPaperCanvas.height = 724;
    const rpCtx = ruledPaperCanvas.getContext("2d");
    if (rpCtx) {
      rpCtx.fillStyle = "#fffdf7";
      rpCtx.fillRect(0, 0, 512, 724);
      rpCtx.strokeStyle = "#ff7b7b";
      rpCtx.lineWidth = 2.5;
      rpCtx.beginPath();
      rpCtx.moveTo(85, 0);
      rpCtx.lineTo(85, 724);
      rpCtx.stroke();
      rpCtx.strokeStyle = "#a5d8ff";
      rpCtx.lineWidth = 1;
      for (let y = 60; y < 724; y += 28) {
        rpCtx.beginPath();
        rpCtx.moveTo(0, y);
        rpCtx.lineTo(512, y);
        rpCtx.stroke();
      }
    }
    const ruledTexture = new THREE.CanvasTexture(ruledPaperCanvas);
    const ruledMat = new THREE.MeshStandardMaterial({
      map: ruledTexture,
      roughness: 0.82,
      side: THREE.DoubleSide,
    });
    const paperGeo1 = new THREE.PlaneGeometry(1.6, 2.26, 4, 4);
    const pos1 = paperGeo1.attributes.position;
    for (let i = 0; i < pos1.count; i++) {
      const x = pos1.getX(i);
      const y = pos1.getY(i);
      pos1.setZ(i, Math.sin(x * 1.1) * 0.06 + Math.cos(y * 0.8) * 0.03);
    }
    paperGeo1.computeVertexNormals();
    const ruledPaper = new THREE.Mesh(paperGeo1, ruledMat);
    // Laid neatly flat on the left side of the desk
    ruledPaper.position.set(-2.5, -1.82, 0.3);
    ruledPaper.rotation.set(-Math.PI / 2, 0, 0.15);
    ruledPaper.receiveShadow = true;
    scene.add(ruledPaper);

    // 2. Grid Paper Sheet
    const gridPaperCanvas = document.createElement("canvas");
    gridPaperCanvas.width = 512;
    gridPaperCanvas.height = 724;
    const gpCtx = gridPaperCanvas.getContext("2d");
    if (gpCtx) {
      gpCtx.fillStyle = "#fffdf7";
      gpCtx.fillRect(0, 0, 512, 724);
      gpCtx.strokeStyle = "rgba(12, 143, 132, 0.16)";
      gpCtx.lineWidth = 1;
      for (let x = 20; x < 512; x += 22) {
        gpCtx.beginPath();
        gpCtx.moveTo(x, 0);
        gpCtx.lineTo(x, 724);
        gpCtx.stroke();
      }
      for (let y = 20; y < 724; y += 22) {
        gpCtx.beginPath();
        gpCtx.moveTo(0, y);
        gpCtx.lineTo(512, y);
        gpCtx.stroke();
      }
    }
    const gridTexture = new THREE.CanvasTexture(gridPaperCanvas);
    const gridMat = new THREE.MeshStandardMaterial({
      map: gridTexture,
      roughness: 0.82,
      side: THREE.DoubleSide,
    });
    const paperGeo2 = new THREE.PlaneGeometry(1.5, 2.12, 4, 4);
    const pos2 = paperGeo2.attributes.position;
    for (let i = 0; i < pos2.count; i++) {
      const x = pos2.getX(i);
      const y = pos2.getY(i);
      pos2.setZ(i, Math.sin(x * 1.2) * 0.05 + Math.cos(y * 0.7) * 0.04);
    }
    paperGeo2.computeVertexNormals();
    const gridPaper = new THREE.Mesh(paperGeo2, gridMat);
    // Laid flat on the right side of the desk
    gridPaper.position.set(2.5, -1.82, -0.3);
    gridPaper.rotation.set(-Math.PI / 2, 0, -0.15);
    gridPaper.receiveShadow = true;
    scene.add(gridPaper);

    // 3. Procedural Hexagonal Pencils
    const createPencil = (color: string) => {
      const pencil = new THREE.Group();

      const bodyGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.0, 6);
      const bodyMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.42,
        metalness: 0.05,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      pencil.add(body);

      const woodGeo = new THREE.ConeGeometry(0.045, 0.3, 6);
      const woodMat = new THREE.MeshStandardMaterial({
        color: "#ebd095",
        roughness: 0.78,
      });
      const wood = new THREE.Mesh(woodGeo, woodMat);
      wood.position.y = 1.0 + 0.15;
      wood.castShadow = true;
      pencil.add(wood);

      const leadGeo = new THREE.ConeGeometry(0.016, 0.08, 6);
      const leadMat = new THREE.MeshStandardMaterial({
        color: "#2f2f32",
        roughness: 0.85,
      });
      const lead = new THREE.Mesh(leadGeo, leadMat);
      lead.position.y = 1.0 + 0.3 + 0.04;
      lead.castShadow = true;
      pencil.add(lead);

      const ferruleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.14, 6);
      const ferruleMat = new THREE.MeshStandardMaterial({
        color: "#e3bc64",
        metalness: 0.95,
        roughness: 0.12,
      });
      const ferrule = new THREE.Mesh(ferruleGeo, ferruleMat);
      ferrule.position.y = -1.0 - 0.07;
      ferrule.castShadow = true;
      pencil.add(ferrule);

      const eraserGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 6);
      const eraserMat = new THREE.MeshStandardMaterial({
        color: "#fc9088",
        roughness: 0.68,
      });
      const eraser = new THREE.Mesh(eraserGeo, eraserMat);
      eraser.position.y = -1.0 - 0.14 - 0.06;
      eraser.castShadow = true;
      pencil.add(eraser);

      return pencil;
    };
    
    // Pencil 1 (Saffron): Laid flat at the bottom-left desk area
    const pencil1 = createPencil("#d97919");
    pencil1.position.set(-1.8, -1.88, 1.1);
    pencil1.rotation.set(Math.PI / 2, 0.25, 0);
    scene.add(pencil1);

    // Pencil 2 (Teal): Laid flat at the bottom-right desk area
    const pencil2 = createPencil("#0c8f84");
    pencil2.position.set(1.8, -1.88, 0.9);
    pencil2.rotation.set(Math.PI / 2, -0.35, 0);
    scene.add(pencil2);

    // 4. Floating Gold Paper Clips (Wire loop Tubes)
    const createPaperClip = () => {
      const points = [
        new THREE.Vector3(0, -0.28, 0),
        new THREE.Vector3(0, 0.28, 0),
        new THREE.Vector3(0.035, 0.32, 0),
        new THREE.Vector3(0.07, 0.28, 0),
        new THREE.Vector3(0.07, -0.22, 0),
        new THREE.Vector3(0.035, -0.26, 0),
        new THREE.Vector3(0, -0.22, 0),
        new THREE.Vector3(0, 0.14, 0),
        new THREE.Vector3(-0.018, 0.18, 0),
        new THREE.Vector3(-0.035, 0.14, 0),
        new THREE.Vector3(-0.035, 0, 0),
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const clipGeo = new THREE.TubeGeometry(curve, 32, 0.01, 8, false);
      const clipMat = new THREE.MeshStandardMaterial({
        color: "#d4af37",
        metalness: 0.95,
        roughness: 0.15,
      });
      const clip = new THREE.Mesh(clipGeo, clipMat);
      clip.castShadow = true;
      return { clip, clipGeo, clipMat };
    };

    const c1 = createPaperClip();
    // Placed flat next to Pencil 1
    c1.clip.position.set(-1.3, -1.9, 1.3);
    c1.clip.rotation.set(Math.PI / 2, 0.1, 0);
    c1.clip.scale.set(1.3, 1.3, 1.3);
    scene.add(c1.clip);

    const c2 = createPaperClip();
    // Placed flat next to Pencil 2
    c2.clip.position.set(1.4, -1.9, 1.1);
    c2.clip.rotation.set(Math.PI / 2, -0.25, 0);
    c2.clip.scale.set(1.3, 1.3, 1.3);
    scene.add(c2.clip);

    // 5. Floating Acrylic Ruler
    const rulerCanvas = document.createElement("canvas");
    rulerCanvas.width = 128;
    rulerCanvas.height = 512;
    const rCtx = rulerCanvas.getContext("2d");
    if (rCtx) {
      rCtx.fillStyle = "rgba(250, 247, 238, 0.1)";
      rCtx.fillRect(0, 0, 128, 512);
      rCtx.strokeStyle = "#17130f";
      rCtx.lineWidth = 1.5;
      for (let y = 10; y < 502; y += 8) {
        const isMajor = (y - 10) % 40 === 0;
        rCtx.beginPath();
        rCtx.moveTo(0, y);
        rCtx.lineTo(isMajor ? 32 : 16, y);
        rCtx.stroke();

        if (isMajor) {
          rCtx.fillStyle = "#17130f";
          rCtx.font = "bold 18px system-ui";
          rCtx.textAlign = "left";
          rCtx.textBaseline = "middle";
          rCtx.fillText(`${Math.floor((y - 10) / 40)}`, 40, y);
        }
      }
    }
    const rulerTexture = new THREE.CanvasTexture(rulerCanvas);
    const rulerGeo = new THREE.BoxGeometry(0.32, 2.2, 0.015);
    const rulerMat = new THREE.MeshStandardMaterial({
      map: rulerTexture,
      transparent: true,
      opacity: 0.64,
      roughness: 0.12,
      color: "#faf7ee",
    });
    const ruler = new THREE.Mesh(rulerGeo, rulerMat);
    // Placed flat on the desk, pointing horizontally
    ruler.position.set(1.0, -1.9, 1.5);
    ruler.rotation.set(Math.PI / 2, 0, -Math.PI / 2 + 0.15);
    ruler.castShadow = true;
    scene.add(ruler);

    // Base positions to calculate float animations
    const ruledBaseY = ruledPaper.position.y;
    const gridBaseY = gridPaper.position.y;
    
    // Tiny micro-float amplitude for floor elements to make them breathe
    const pencil1BaseY = pencil1.position.y;
    const pencil2BaseY = pencil2.position.y;
    const clip1BaseY = c1.clip.position.y;
    const clip2BaseY = c2.clip.position.y;
    const rulerBaseY = ruler.position.y;

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

      // Slow orbital rotate of stack (mouse tracking parallax dampening if not dragging)
      if (!isDragging) {
        stackGroup.rotation.x = THREE.MathUtils.lerp(stackGroup.rotation.x, 0.85 + Math.sin(time * 0.4) * 0.015, 0.08);
        stackGroup.rotation.y = THREE.MathUtils.lerp(stackGroup.rotation.y, -0.15 + Math.cos(time * 0.3) * 0.02, 0.08);
      }

      // Flat lay breathing animation (tiny hovering up and down, but strictly vertical, no horizontal shifting)
      ruledPaper.position.y = ruledBaseY + Math.sin(time * 0.8) * 0.02;
      gridPaper.position.y = gridBaseY + Math.cos(time * 0.75) * 0.02;
      
      pencil1.position.y = pencil1BaseY + Math.sin(time * 1.1) * 0.02;
      pencil2.position.y = pencil2BaseY + Math.sin(time * 1.0 + 1.5) * 0.02;
      
      c1.clip.position.y = clip1BaseY + Math.sin(time * 1.3) * 0.015;
      c2.clip.position.y = clip2BaseY + Math.cos(time * 1.2) * 0.015;
      
      ruler.position.y = rulerBaseY + Math.sin(time * 0.9) * 0.018;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup resources
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
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

      // Dispose Papers
      paperGeo1.dispose();
      ruledTexture.dispose();
      ruledMat.dispose();
      paperGeo2.dispose();
      gridTexture.dispose();
      gridMat.dispose();

      // Dispose Pencils & Clips
      pencil1.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      pencil2.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });

      c1.clipGeo.dispose();
      c1.clipMat.dispose();
      c2.clipGeo.dispose();
      c2.clipMat.dispose();

      // Dispose Ruler
      rulerGeo.dispose();
      rulerTexture.dispose();
      rulerMat.dispose();

      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[440px] w-full items-center justify-center md:h-[520px]"
    >
      <canvas ref={canvasRef} className="block h-full w-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-2 right-4 rounded bg-black/60 px-2.5 py-1 text-[10px] font-medium tracking-wider text-white/90 uppercase select-none pointer-events-none">
        Drag to spin stack 360°
      </div>
    </div>
  );
}
