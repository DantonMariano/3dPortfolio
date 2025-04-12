import { useRef, useEffect, useState, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Text3D, OrbitControls, Stats, Environment } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";
import { useSpringValue, animated, config } from "@react-spring/three";
import * as THREE from "three";
import fontJson from "./fonts/helvetiker_regular.typeface.json";

const AnimatedLetter = ({ char, x, pointer, setFocusPoint }) => {
  if (char === " ") return null;

  const ref = useRef();
  const [worldPos] = useState(() => new THREE.Vector3());

  const y = useSpringValue(0, {
    config: { mass: 1, tension: 300, friction: 20 },
  });
  const color = useSpringValue("#ffffff");

  useFrame(() => {
    if (!ref.current) return;
    ref.current.getWorldPosition(worldPos);
    const dist = pointer.current.distanceTo(worldPos);
    const maxDist = 1.5;
    const lift = dist < maxDist ? 0.2 * (1 - dist / maxDist) : 0;
    const highlight = dist < maxDist * 0.5 ? "#ff4f8b" : "#ffffff";

    y.start(lift);
    color.start(highlight);

    if (dist < maxDist * 0.5) {
      setFocusPoint(worldPos.clone());
    }
  });

  return (
    <animated.group ref={ref} position-x={x} position-y={y}>
      <Text3D
        font={fontJson}
        size={0.5}
        height={0.2}
        bevelEnabled
        bevelThickness={0.01}
        bevelSize={0.02}
        curveSegments={24}
        bevelSegments={10}
        castShadow
        receiveShadow
      >
        {char}
        <animated.meshPhysicalMaterial
          attach="material"
          color={color}
          metalness={1}
          roughness={0.1}
          reflectivity={1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          iridescence={0.15}
          iridescenceIOR={1.3}
          sheen={1}
          sheenRoughness={0.25}
          envMapIntensity={2}
        />
      </Text3D>
    </animated.group>
  );
};

const App = () => {
  const lightningRef = useRef();
  const pointer = useRef(new THREE.Vector3());
  const flashCooldownRef = useRef(0);
  const cameraTarget = useSpringValue([0, 0, 3.8], config.slow); // Increased zoom effect

  const rawText = "Danton Mariano";
  const text = useMemo(() => rawText.split(""), []);
  const dummyRefs = useRef([]);
  const [positions, setPositions] = useState([]);
  const [ready, setReady] = useState(false);

  const { camera, mouse } = useThree();

  const setFocusPoint = (point) => {
    const newTarget = new THREE.Vector3(point.x, point.y, 3.8); // Increased zoom (from 5 to 3.8)
    cameraTarget.start([newTarget.x, newTarget.y, newTarget.z]);
  };

  useEffect(() => {
    if (dummyRefs.current.length !== text.length) return;

    const widths = [];
    let offset = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === " ") {
        widths[i] = 0.3;
        continue;
      }

      const mesh = dummyRefs.current[i];
      if (mesh && mesh.geometry) {
        mesh.geometry.computeBoundingBox();
        const size = new THREE.Vector3();
        mesh.geometry.boundingBox.getSize(size);
        widths[i] = size.x;
      } else {
        widths[i] = 0.4;
      }
    }

    const newPositions = [];
    for (let i = 0; i < widths.length; i++) {
      newPositions[i] = offset;
      offset += widths[i] + 0.05;
    }

    const totalWidth = offset;
    for (let i = 0; i < newPositions.length; i++) {
      newPositions[i] -= totalWidth / 2;
    }

    setPositions(newPositions);
    setReady(true);
  }, [text]);

  useFrame(() => {
    const current = camera.position;
    const target = new THREE.Vector3(...cameraTarget.get());
    current.lerp(target, 0.05);
    camera.lookAt(0, 0, 0);

    if (lightningRef.current) {
      flashCooldownRef.current -= 0.016;
      if (flashCooldownRef.current <= 0 && Math.random() > 0.98) {
        lightningRef.current.intensity = 3 + Math.random() * 3;
        flashCooldownRef.current = 2 + Math.random() * 4;
        setTimeout(() => {
          if (lightningRef.current) lightningRef.current.intensity = 0;
        }, 100);
      }
    }

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    pointer.current.copy(intersection);
  });

  return (
    <>
      <color attach="background" args={["black"]} />
      <ambientLight intensity={0.05} color="white" />
      <directionalLight
        ref={lightningRef}
        position={[-5, 5, 5]}
        intensity={0}
        color="white"
      />
      <Environment preset="city" background={false} />

      <group visible={false}>
        {text.map((char, i) =>
          char === " " ? null : (
            <Text3D
              key={`dummy-${i}`}
              ref={(el) => (dummyRefs.current[i] = el)}
              font={fontJson}
              size={0.5}
              height={0.2}
              bevelEnabled
              bevelThickness={0.01}
              bevelSize={0.02}
              curveSegments={48}
              bevelSegments={20}
            >
              {char}
            </Text3D>
          )
        )}
      </group>

      {ready && (
        <group>
          {text.map((char, i) => (
            <AnimatedLetter
              key={i}
              char={char}
              x={positions[i]}
              pointer={pointer}
              setFocusPoint={setFocusPoint}
            />
          ))}
        </group>
      )}

      <EffectComposer>
        <Bloom
          intensity={0.1}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.9}
          height={300}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.9} />
        <Noise opacity={0.03} />
      </EffectComposer>
    </>
  );
};

export default App;