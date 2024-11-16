import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function CarModel({ position, rotation }) {
  const { scene } = useGLTF('/models/Volkswagen Golf GL 1990.gltf');
  scene.scale.set(0.01, 0.01, 0.01);

  scene.traverse((child) => {
    if (child.isMesh && (child.name === "ID37" || child.name === "ID176")) {
      child.material.color.set('red');
      child.material.metalness = 0.5;
      child.material.roughness = 0.5;
    }
  });

  scene.position.set(position[0], position[1], position[2]);
  scene.rotation.y = rotation;

  return <primitive object={scene} />;
}

function HomeModel() {
  const { scene } = useGLTF('/models/scene.gltf');
  return <primitive object={scene} />;
}

function HumanModel({ position, rotation, isMoving }) {
  const { scene, animations } = useGLTF('/models/male_basic_walk_30_frames_loop.glb');
  const mixer = useRef();

  useEffect(() => {
    if (animations.length) {
      mixer.current = new THREE.AnimationMixer(scene);
      const action = mixer.current.clipAction(animations[0]);
      if (isMoving) {
        action.play();
      } else {
        action.stop();
      }
    }
  }, [isMoving, animations, scene]);

  useFrame((state, delta) => {
    mixer.current?.update(delta);
  });

  scene.position.set(position[0], position[1], position[2]);
  scene.rotation.y = rotation;

  return <primitive object={scene} />;
}

function CameraController({ targetPosition, targetRotation, isCameraInside, isCarControlled, isCarMoving }) {
  const controlsRef = useRef();

  useFrame((state) => {
    if (controlsRef.current) {
      if (isCarControlled && isCarMoving) {
        const cameraOffset = isCameraInside ? 0.2 : 5;
        const elevation = isCameraInside ? 1.5 : 3;

        state.camera.position.x = targetPosition[0] - cameraOffset * Math.sin(targetRotation);
        state.camera.position.y = targetPosition[1] + elevation;
        state.camera.position.z = targetPosition[2] - cameraOffset * Math.cos(targetRotation);

        controlsRef.current.target.set(targetPosition[0], targetPosition[1], targetPosition[2]);
      } else {
        const humanCameraOffset = 3;
        const humanElevation = 2;

        state.camera.position.x = targetPosition[0] - humanCameraOffset * Math.sin(targetRotation);
        state.camera.position.y = targetPosition[1] + humanElevation;
        state.camera.position.z = targetPosition[2] - humanCameraOffset * Math.cos(targetRotation);

        controlsRef.current.target.set(targetPosition[0], targetPosition[1], targetPosition[2]);
      }
      controlsRef.current.update();
    }
  });

  return <OrbitControls ref={controlsRef} enablePan={true} enableZoom={true} />;
}

function Speedometer({ speed }) {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      fontSize: '24px',
      fontWeight: 'bold',
      color: 'white',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 1111
    }}>
      Speed: {Math.abs(speed * 1000).toFixed(1)} km/h
    </div>
  );
}

function ThreeScene() {
  const [carPosition, setCarPosition] = useState([0, 0, 0]);
  const [carRotation, setCarRotation] = useState(0);
  const [humanPosition, setHumanPosition] = useState([5, 0.1, 1]);
  const [humanRotation, setHumanRotation] = useState(0);
  const [keys, setKeys] = useState({});
  const [isCarMoving, setIsCarMoving] = useState(false);
  const [isCameraInside, setIsCameraInside] = useState(false);
  const [isCarControlled, setIsCarControlled] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [isMovingToCar, setIsMovingToCar] = useState(false);

  const isHumanMoving = isMovingToCar || keys['arrowup'] || keys['arrowdown'];

  const moveHumanToCar = () => {
    setIsMovingToCar(true);
  };

  const exitCar = () => {
    const exitDistance = 1;
    const exitPosition = [
      carPosition[0] + exitDistance * Math.cos(carRotation + Math.PI / 2),
      carPosition[1],
      carPosition[2] + exitDistance * Math.sin(carRotation + Math.PI / 2),
    ];
    setHumanPosition(exitPosition);
    setIsCarControlled(false);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      setKeys((prevKeys) => ({ ...prevKeys, [event.key.toLowerCase()]: true }));

      if (event.key.toLowerCase() === 'c' && isCarControlled) {
        setIsCameraInside((prev) => !prev);
      }

      if (event.key.toLowerCase() === 'f') {
        if (isCarControlled) {
          exitCar();
        } else if (isMovingToCar) {
          setIsMovingToCar(false);
        }
      }

      if (event.key.toLowerCase() === 'y') {
        moveHumanToCar();
      }
    };

    const handleKeyUp = (event) => {
      setKeys((prevKeys) => ({ ...prevKeys, [event.key.toLowerCase()]: false }));
    };

    const updateMovement = () => {
      if (isMovingToCar && !isCarControlled) {
        const carEntryDistance = 0.5;
        const angleToCar = Math.atan2(
          carPosition[2] - humanPosition[2],
          carPosition[0] - humanPosition[0]
        );
        setHumanRotation(angleToCar);

        setHumanPosition((prevPosition) => {
          const distance = Math.sqrt(
            Math.pow(carPosition[0] - prevPosition[0], 2) +
            Math.pow(carPosition[2] - prevPosition[2], 2)
          );

          if (distance > carEntryDistance) {
            return [
              prevPosition[0] + 0.05 * Math.cos(angleToCar),
              prevPosition[1],
              prevPosition[2] + 0.05 * Math.sin(angleToCar),
            ];
          } else {
            setIsCarControlled(true);
            setIsMovingToCar(false);
            return carPosition;
          }
        });
      } else if (isCarControlled) {
        setCarPosition((prevPosition) => {
          let newPosition = [...prevPosition];
          let newRotation = carRotation;
          let newSpeed = speed;

          const acceleration = 0.0009;
          const maxSpeed = 2.0;
          const minSpeed = -1.5;
          const friction = 0.98;
          const braking = 0.9;

          let moving = false;

          if (keys['a']) {
            newRotation += 0.05;
            moving = true;
          }
          if (keys['d']) {
            newRotation -= 0.05;
            moving = true;
          }

          if (keys['w']) {
            newSpeed = Math.min(newSpeed + acceleration, maxSpeed);
            moving = true;
          }
          if (keys['s']) {
            newSpeed = Math.max(newSpeed - acceleration, minSpeed);
            moving = true;
          }

          if (!keys['w'] && !keys['s'] && !keys[' ']) {
            newSpeed *= friction;
          }

          if (keys[' ']) {
            newSpeed *= braking;
          }

          newPosition[0] += newSpeed * Math.sin(newRotation);
          newPosition[2] += newSpeed * Math.cos(newRotation);

          setSpeed(newSpeed);
          setIsCarMoving(moving);
          setCarRotation(newRotation);

          return newPosition;
        });
      } else {
        setHumanPosition((prevPosition) => {
          let newPosition = [...prevPosition];
          let newRotation = humanRotation;

          if (keys['arrowleft']) {
            newRotation += 0.05;
          }
          if (keys['arrowright']) {
            newRotation -= 0.05;
          }

          if (keys['arrowup']) {
            newPosition[0] += 0.05 * Math.sin(newRotation);
            newPosition[2] += 0.05 * Math.cos(newRotation);
          }
          if (keys['arrowdown']) {
            newPosition[0] -= 0.05 * Math.sin(newRotation);
            newPosition[2] -= 0.05 * Math.cos(newRotation);
          }

          setHumanRotation(newRotation);
          return newPosition;
        });
      }
    };

    const interval = setInterval(updateMovement, 16);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [carRotation, humanRotation, keys, speed, isCarControlled, carPosition, isMovingToCar]);

  return (
    <>
      <Speedometer speed={speed} />
      <Canvas>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <CarModel position={carPosition} rotation={carRotation} />
        <HomeModel />
        {!isCarControlled && (
          <HumanModel
            position={humanPosition}
            rotation={humanRotation}
            isMoving={isHumanMoving}
          />
        )}
        <CameraController
          targetPosition={isCarControlled ? carPosition : humanPosition}
          targetRotation={isCarControlled ? carRotation : humanRotation}
          isCameraInside={isCarControlled && isCameraInside}
          isCarControlled={isCarControlled}
          isCarMoving={isCarMoving}
        />
      </Canvas>
    </>
  );
}

export default ThreeScene;
