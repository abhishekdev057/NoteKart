"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Loader2 } from "lucide-react";

interface ThreeDNotebookCustomizerProps {
  productId?: string;
  artworkUrl?: string;
  coverName?: string;
}

export default function ThreeDNotebookCustomizer({
  productId = "custom-photo-journal",
  artworkUrl,
  coverName = "",
}: ThreeDNotebookCustomizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  // Keep refs for live dynamic updates without destroying the WebGL context
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);

  const isA5 = productId === "classic-a5-hardbound";

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
        if (isA5) {
          // A5: Leather background, print the name in elegant gold text directly at the bottom
          ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
          ctx.shadowBlur = 4;
          ctx.fillStyle = "#ebd095"; // Shiny gold/beige text
          ctx.font = "bold 22px Georgia, serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(nameText.slice(0, 40), width / 2, height * 0.86);
        } else {
          // A4: Full cover print, draw standard plaque
          const plaqueW = width * 0.8;
          const plaqueH = 80;
          const plaqueX = (width - plaqueW) / 2;
          const plaqueY = height * 0.72;

          ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;

          ctx.fillStyle = "#fffdf7";
          ctx.beginPath();
          ctx.roundRect?.(plaqueX, plaqueY, plaqueW, plaqueH, 8);
          ctx.fill();

          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          ctx.strokeStyle = "#17130f";
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.strokeStyle = "rgba(12, 143, 132, 0.45)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect?.(plaqueX + 4, plaqueY + 4, plaqueW - 8, plaqueH - 8, 6);
          ctx.stroke();

          ctx.fillStyle = "#17130f";
          ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(nameText.slice(0, 40), width / 2, plaqueY + plaqueH / 2);
        }
      }
      texture.needsUpdate = true;
    };

    if (artUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (isA5) {
          // A5 Hardbound: Leather cover, image goes inside the marked center frame
          ctx.fillStyle = "#3e271a"; // Rich leather brown
          ctx.fillRect(0, 0, width, height);

          // Embossed gold borders
          ctx.strokeStyle = "#ebd095";
          ctx.lineWidth = 10;
          ctx.strokeRect(15, 15, width - 30, height - 30);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
          ctx.strokeRect(22, 22, width - 44, height - 44);

          // Center marked photo frame coordinates
          const frameW = width * 0.72;
          const frameH = height * 0.52;
          const frameX = (width - frameW) / 2;
          const frameY = height * 0.2;

          // Frame border
          ctx.fillStyle = "#2a1810";
          ctx.fillRect(frameX - 6, frameY - 6, frameW + 12, frameH + 12);
          ctx.strokeStyle = "#ebd095";
          ctx.lineWidth = 4;
          ctx.strokeRect(frameX - 4, frameY - 4, frameW + 8, frameH + 8);

          // Draw uploaded image inside the frame boundary
          ctx.drawImage(img, frameX, frameY, frameW, frameH);

          // Inner frame shadow for realism
          ctx.strokeStyle = "rgba(0, 0, 0, 0.52)";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(frameX, frameY, frameW, frameH);
        } else {
          // A4 Custom Photo Album: Full wrap cover image
          ctx.drawImage(img, 0, 0, width, height);

          // Subtle gradient overlay
          const grad = ctx.createLinearGradient(0, 0, width, 0);
          grad.addColorStop(0, "rgba(0, 0, 0, 0.15)");
          grad.addColorStop(0.08, "rgba(0, 0, 0, 0.05)");
          grad.addColorStop(0.25, "rgba(255, 255, 255, 0.02)");
          grad.addColorStop(0.9, "rgba(0, 0, 0, 0.0)");
          grad.addColorStop(1, "rgba(0, 0, 0, 0.1)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
        }

        drawPlaque();
        setLoading(false);
      };
      img.onerror = () => {
        ctx.fillStyle = "#0c8f84";
        ctx.fillRect(0, 0, width, height);
        drawPlaque();
        setLoading(false);
      };
      img.src = artUrl;
    } else {
      // Default state (no uploaded artwork yet)
      if (isA5) {
        ctx.fillStyle = "#3e271a";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "#ebd095";
        ctx.lineWidth = 10;
        ctx.strokeRect(15, 15, width - 30, height - 30);

        const frameW = width * 0.72;
        const frameH = height * 0.52;
        const frameX = (width - frameW) / 2;
        const frameY = height * 0.2;

        ctx.fillStyle = "#2a1810";
        ctx.fillRect(frameX - 6, frameY - 6, frameW + 12, frameH + 12);
        ctx.strokeStyle = "#ebd095";
        ctx.lineWidth = 4;
        ctx.strokeRect(frameX - 4, frameY - 4, frameW + 8, frameH + 8);

        // Placeholder text inside marked frame
        ctx.fillStyle = "rgba(250, 247, 238, 0.35)";
        ctx.font = "italic 16px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Marked Photo Area", width / 2, frameY + frameH / 2 - 12);
        ctx.fillText("(Upload Photo Below)", width / 2, frameY + frameH / 2 + 12);
      } else {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, "#0c8f84");
        grad.addColorStop(1, "#17130f");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

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
      }

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

    // Orbit Controls - restricted horizontal view, full vertical sweep
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI; // Full vertical rotation
    controls.minAzimuthAngle = -Math.PI / 2; // Limit left rotation to -90 deg
    controls.maxAzimuthAngle = Math.PI / 2;  // Limit right rotation to +90 deg
    controls.minDistance = 3.5;
    controls.maxDistance = 10;
    controls.autoRotate = !artworkUrl; // Auto rotate only if no artwork is uploaded yet
    controls.autoRotateSpeed = 1.2;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85); // High ambient light so colors never fade
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaf0, 0.7);
    dirLight.position.set(5, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Headlight (attaches to camera so whichever face is viewed is always illuminated)
    const headlight = new THREE.PointLight(0xffffff, 0.58, 40);
    camera.add(headlight);
    scene.add(camera); // Add camera to scene to enable child light

    // Create Floor Shadow Catcher
    const shadowPlaneGeo = new THREE.PlaneGeometry(8, 8);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.55;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // --- Book Geometry Definition ---
    // A5 size: width = 1.75, height = 2.5, thickness = 0.20
    // A4 size: width = 2.10, height = 2.97, thickness = 0.22
    const bookWidth = isA5 ? 1.75 : 2.1;
    const bookHeight = isA5 ? 2.5 : 2.97;
    const coverThickness = 0.035;
    const bookThickness = isA5 ? 0.2 : 0.22;

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
      roughness: 0.4,
      metalness: 0.05,
    });

    // Outer & inner card base materials
    const coverBaseColorMat = new THREE.MeshStandardMaterial({
      color: isA5 ? "#28170c" : "#075750", // Leather brown for A5, Teal for A4
      roughness: 0.65,
      metalness: 0.05,
    });

    // Create Front Cover Mesh
    const frontCoverGeo = new THREE.BoxGeometry(bookWidth, bookHeight, coverThickness);
    const frontMaterials = [
      coverBaseColorMat,
      coverBaseColorMat,
      coverBaseColorMat,
      coverBaseColorMat,
      frontCoverMat,      // +z texture map
      coverBaseColorMat,
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
    const pagesMat = new THREE.MeshStandardMaterial({
      color: "#fbfcf7",
      roughness: 0.8,
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

    let isDragging = false;
    controls.addEventListener("start", () => {
      isDragging = true;
    });
    controls.addEventListener("end", () => {
      isDragging = false;
    });

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
  }, [productId, !!artworkUrl]); // Re-create scene if product model or artwork state changes

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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#faf7ee]/75 backdrop-blur-sm z-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--teal)]" />
          <span className="text-sm font-semibold text-[var(--ink)]/80">Updating 3D preview...</span>
        </div>
      )}
      <div className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-[10px] font-medium tracking-wide text-white/90 uppercase select-none pointer-events-none z-10">
        Drag to rotate
      </div>
    </div>
  );
}
