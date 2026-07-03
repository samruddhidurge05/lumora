/**
 * CustomerThreeDBackground — light-theme Three.js scene
 * z-index: -1, pointer-events: none → NEVER overlaps UI
 *
 * Scene: translucent glass spheres + soft floating torus + particle field
 * Colors match the light lavender / peach / sage palette.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function CustomerThreeDBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    /* ── Scene & Camera ── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 20;

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(8, 12, 10);
    scene.add(dir);

    const fillA = new THREE.PointLight(0xDCC6FF, 2.0, 40);
    fillA.position.set(-10, 6, 5);
    scene.add(fillA);

    const fillB = new THREE.PointLight(0xFFD6BA, 1.5, 40);
    fillB.position.set(10, -5, 5);
    scene.add(fillB);

    const fillC = new THREE.PointLight(0xCFE8D6, 1.2, 35);
    fillC.position.set(0, -10, 8);
    scene.add(fillC);

    /* ── Premium Glossy Purple material factory ── */
    const glossyMat = (color, opacity = 0.50) =>
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.10,
        roughness: 0.05,
        transmission: 0.82,
        thickness: 2.5,
        ior: 1.55,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });

    /* ── Torus ── */
    const torusGeo  = new THREE.TorusGeometry(3.6, 0.85, 32, 100);
    const torusMesh = new THREE.Mesh(torusGeo, glossyMat(0x3c1259, 0.55));
    scene.add(torusMesh);

    /* ── Glass Spheres ── */
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const spheres   = [];
    const configs = [
      { x:  5.5, y:  3.5, z: -2, s: 0.32, color: 0x3c1259, opacity: 0.42 },
      { x: -6.0, y: -3.0, z: -1, s: 0.38, color: 0x4c1d95, opacity: 0.38 },
      { x: -4.5, y:  3.8, z: -4, s: 0.25, color: 0x3c1259, opacity: 0.45 },
      { x:  5.0, y: -3.5, z: -3, s: 0.22, color: 0x4c1d95, opacity: 0.35 },
      { x: -1.0, y: -5.0, z: -5, s: 0.28, color: 0x2e0854, opacity: 0.32 },
    ];
    configs.forEach((cfg, idx) => {
      const mesh = new THREE.Mesh(sphereGeo, glossyMat(cfg.color, cfg.opacity));
      mesh.scale.setScalar(cfg.s);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.userData = { baseX: cfg.x, baseY: cfg.y, baseZ: cfg.z, phase: idx * 1.5, speed: 0.18 + idx * 0.04 };
      scene.add(mesh);
      spheres.push(mesh);
    });

    /* ── Particles ── */
    const N = 180;
    const positions = new Float32Array(N * 3);
    const colors    = new Float32Array(N * 3);
    const palette   = [new THREE.Color(0x3b0764), new THREE.Color(0x1e1b4b), new THREE.Color(0x475569)];
    for (let i = 0; i < N; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 24 - 8;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.40, blending: THREE.NormalBlending, depthWrite: false });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    /* ── Mouse tracking ── */
    let mx = 0, my = 0;
    const onMouse = (e) => {
      mx = (e.clientX / window.innerWidth)  * 2 - 1;
      my = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouse);

    /* ── Resize ── */
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    /* ── Animation loop ── */
    const clock = new THREE.Clock();
    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      torusMesh.rotation.x = t * 0.025;
      torusMesh.rotation.y = t * 0.018 + mx * 0.12;
      torusMesh.rotation.z = t * 0.010;
      torusMesh.position.y = Math.sin(t * 0.25) * 0.18;

      spheres.forEach(s => {
        const u = s.userData;
        s.position.x = u.baseX + Math.sin(t * u.speed + u.phase) * 0.35 + mx * 0.4;
        s.position.y = u.baseY + Math.cos(t * u.speed * 0.9 + u.phase) * 0.25 + my * 0.3;
        s.position.z = u.baseZ + Math.sin(t * u.speed * 0.5 + u.phase) * 0.15;
        s.rotation.x += 0.001;
        s.rotation.y += 0.001;
      });

      particles.rotation.y = t * 0.004;
      particles.rotation.x = t * 0.002;

      fillA.intensity = 1.8 + Math.sin(t * 0.8) * 0.3;
      fillB.intensity = 1.4 + Math.sin(t * 0.6 + 1) * 0.2;

      renderer.render(scene, camera);
    };
    animate();

    /* ── Cleanup ── */
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}
    />
  );
}
