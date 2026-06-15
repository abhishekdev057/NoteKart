"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Loader2 } from "lucide-react";

interface ThreeDNotebookCustomizerProps {
  artworkUrl?: string;
  coverName?: string;
}

export default function ThreeDNotebookCustomizer({
  artworkUrl,
  coverName = "",
}: ThreeDNotebookCustomizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  // Keep refs for live dynamic updates without destroying the WebGL context
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);

  // Redraws the 2D canvas texture
  const updateTexture = (artUrl?: string, nameText?: string) => {
    const canvas = canvas2dRef.current;
    const texture = textureRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Helper to draw the final text plaque
    const drawPlaque = () => {
      if (nameText && nameText.trim().length > 0) {
        // Draw elegant plaque
        const plaqueW = width * 0.8;
        const plaqueH = 80;
        const plaqueX = (width - plaqueW) / 2;
        const plaqueY = height * 0.72;

        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        // Plaque background (cream/paper)
        ctx.fillStyle = "#fffdf7";
        ctx.beginPath();
        ctx.roundRect?.(plaqueX, plaqueY, plaqueW, plaqueH, 8);
        ctx.fill();

        // Reset shadow for stroke & text
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Plaque border
        ctx.strokeStyle = "#17130f";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Subtle inner gold/border accent line
        ctx.strokeStyle = "rgba(12, 143, 132, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect?.(plaqueX + 4, plaqueY + 4, plaqueW - 8, plaqueH - 8, 6);
        ctx.stroke();

        // Plaque text
        ctx.fillStyle = "#17130f";
        ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nameText.slice(0, 40), width / 2, plaqueY + plaqueH / 2);
      }
      texture.needsUpdate = true;
    };

    if (artUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Draw image, preserve aspect ratio or stretch cover
        ctx.drawImage(img, 0, 0, width, height);

        // Overlay a very subtle gradient for lighting realism on texture
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, "rgba(0, 0, 0, 0.15)");
        grad.addColorStop(0.08, "rgba(0, 0, 0, 0.05)");
        grad.addColorStop(0.25, "rgba(255, 255, 255, 0.02)");
        grad.addColorStop(0.9, "rgba(0, 0, 0, 0.0)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0.1)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        drawPlaque();
        setLoading(false);
      };
      img.onerror = () => {
        // Fallback if image fails to load
        ctx.fillStyle = "#0c8f84";
        ctx.fillRect(0, 0, width, height);
        drawPlaque();
        setLoading(false);
      };
      img.src = artUrl;
    } else {
      // Default placeholder stylish design (Teal Gradient)
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0c8f84");
      grad.addColorStop(1, "#17130f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw NoteKart branding
      ctx.fillStyle = "rgba(250, 247, 238, 0.12)";
      ctx.font = "900 110px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NOTEKART", width / 2, height * 0.35);

      ctx.fillStyle = "rgba(250, 247, 238, 0.85)";
      ctx.font = "bold 26px system-ui, sans-serif";
      ctx.fillText("Custom A4 Photo Journal", width / 2, height * 0.52);

      ctx.fillStyle = "rgba(250, 247, 238, 0.52)";
      ctx.font = "500 16px system-ui, sans-serif";
      ctx.fillText("Upload your artwork below", width / 2, height * 0.57);

      drawPlaque();
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Dimensions
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 450;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 3.8, 6.2);

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
    controls.maxPolarAngle = Math.PI / 2; // Don't go below floor
    controls.minDistance = 3.5;
    controls.maxDistance = 10;
    controls.autoRotate = !artworkUrl; // Auto rotate only if no artwork is uploaded yet
    controls.autoRotateSpeed = 1.2;

    let isDragging = false;
    controls.addEventListener("start", () => {
      isDragging = true;
    });
    controls.addEventListener("end", () => {
      isDragging = false;
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaf0, 0.95);
    dirLight.position.set(5, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -3;
    dirLight.shadow.camera.right = 3;
    dirLight.shadow.camera.top = 3;
    dirLight.shadow.camera.bottom = -3;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Dynamic Fill Light
    const fillLight = new THREE.DirectionalLight(0xa5d8ff, 0.35);
    fillLight.position.set(-5, 3, -2);
    scene.add(fillLight);

    // Create Floor Shadow Catcher
    const shadowPlaneGeo = new THREE.PlaneGeometry(8, 8);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.55;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // --- Book Geometry Definition ---
    const bookWidth = 2.1;
    const bookHeight = 2.97; // A4 aspect
    const coverThickness = 0.035;
    const bookThickness = 0.22;

    const bookGroup = new THREE.Group();
    bookGroup.position.y = 0.1;

    // Create 2D canvas for cover texture
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 512;
    textureCanvas.height = 724;
    canvas2dRef.current = textureCanvas;

    const coverTexture = new THREE.CanvasTexture(textureCanvas);
    coverTexture.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = coverTexture;

    // Front Cover Material
    const frontCoverMat = new THREE.MeshStandardMaterial({
      map: coverTexture,
      roughness: 0.5,
      metalness: 0.08,
    });

    // Outer & inner card materials
    const coverBaseColorMat = new THREE.MeshStandardMaterial({
      color: "#075750",
      roughness: 0.6,
      metalness: 0.05,
    });

    // Create Front Cover Mesh
    const frontCoverGeo = new THREE.BoxGeometry(bookWidth, bookHeight, coverThickness);
    // Apply different materials to the faces of the cover box:
    // Order of materials in BoxGeometry: +x (right edge), -x (spine edge), +y (top), -y (bottom), +z (front), -z (inside)
    const frontMaterials = [
      coverBaseColorMat, // +x
      coverBaseColorMat, // -x
      coverBaseColorMat, // +y
      coverBaseColorMat, // -y
      frontCoverMat,      // +z (texture map)
      coverBaseColorMat, // -z
    ];
    const frontCover = new THREE.Mesh(frontCoverGeo, frontMaterials);
    frontCover.position.set(0, 0, bookThickness / 2 + coverThickness / 2);
    frontCover.castShadow = true;
    bookGroup.add(frontCover);

    // Back Cover Mesh
    const backCoverGeo = new THREE.BoxGeometry(bookWidth, bookHeight, coverThickness);
    const backCover = new THREE.Mesh(backCoverGeo, coverBaseColorMat);
    backCover.position.set(0, 0, -bookThickness / 2 - coverThickness / 2);
    backCover.castShadow = true;
    bookGroup.add(backCover);

    // Spine Cover Mesh
    const spineGeo = new THREE.BoxGeometry(coverThickness, bookHeight, bookThickness + coverThickness * 2);
    const spine = new THREE.Mesh(spineGeo, coverBaseColorMat);
    spine.position.set(-bookWidth / 2 - coverThickness / 2, 0, 0);
    spine.castShadow = true;
    bookGroup.add(spine);

    // Pages (inner pages block)
    const pagesGeo = new THREE.BoxGeometry(
      bookWidth - 0.05,
      bookHeight - 0.06,
      bookThickness
    );
    // Pages material with subtle ribbing texture simulated via bumpMap
    const pagesColor = new THREE.Color("#fbfcf7");
    const pagesMat = new THREE.MeshStandardMaterial({
      color: pagesColor,
      roughness: 0.85,
      metalness: 0.0,
    });
    const pages = new THREE.Mesh(pagesGeo, pagesMat);
    pages.position.set(0.025, 0, 0);
    pages.castShadow = true;
    bookGroup.add(pages);

    scene.add(bookGroup);

    // Initialize/Draw the texture for the first time
    updateTexture(artworkUrl, coverName);

    // Center pivot slightly
    bookGroup.rotation.y = -0.3;
    bookGroup.rotation.x = 0.2;

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 450;
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

      // Slow floating effect
      if (!isDragging) {
        const time = Date.now() * 0.001;
        bookGroup.position.y = 0.1 + Math.sin(time * 1.5) * 0.06;
        bookGroup.rotation.y += Math.sin(time * 0.8) * 0.001;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      pagesGeo.dispose();
      pagesMat.dispose();
      frontCoverGeo.dispose();
      backCoverGeo.dispose();
      spineGeo.dispose();
      coverTexture.dispose();
      frontCoverMat.dispose();
      coverBaseColorMat.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
    };
  }, []); // Run once on mount

  // Watch parameters for live texture changes (no scene re-creation)
  useEffect(() => {
    if (textureRef.current && canvas2dRef.current) {
      setLoading(true);
      updateTexture(artworkUrl, coverName);
    }
  }, [artworkUrl, coverName]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[350px] w-full items-center justify-center rounded-lg border border-black/10 bg-gradient-to-br from-[#faf7ee]/90 to-[#eee4d2]/80 shadow-[inset_0_2px_8px_rgba(23,19,15,0.05)] sm:h-[450px]"
    >
      <canvas ref={canvasRef} className="block h-full w-full cursor-grab active:cursor-grabbing" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-[#faf7ee]/75 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--teal)]" />
          <span className="text-sm font-semibold text-[var(--ink)]/80">Updating 3D preview...</span>
        </div>
      )}
      <div className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-[10px] font-medium tracking-wide text-white/90 uppercase select-none pointer-events-none">
        Drag to rotate
      </div>
    </div>
  );
}
