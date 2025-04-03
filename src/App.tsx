import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Fisheye, useGLTF, useTexture, Environment, Html } from "@react-three/drei";
import { useState, useRef, Suspense } from "react";
import { Joystick } from "react-joystick-component";
import type { GLTF } from "three-stdlib";
import type { Vector3Tuple } from "three";
import * as THREE from "three";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";

// Типы
type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Mesh>;
  materials: Record<string, THREE.Material>;
};

interface PlayerState {
  position: Vector3Tuple;
  rotation: number;
  speed: number;
  hp: number;
}

// Компонент загрузки
const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);

  useFrame(() => {
    // Имитация прогресса загрузки (можно заменить на реальные данные)
    setProgress((prev) => Math.min(prev + 0.5, 100));
  });

  return (
    <Html fullscreen>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'black',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        zIndex: 1000
      }}>
        <div style={{
          width: '50%',
          height: '20px',
          background: '#333',
          borderRadius: '10px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: '#00ff00',
            transition: 'width 0.1s ease-in-out'
          }} />
        </div>
        <p style={{ color: 'white', marginTop: '10px' }}>
          Loading... {Math.round(progress)}%
        </p>
      </div>
    </Html>
  );
};

// Компонент слежения камеры
const FollowCamera = ({ target }: { target: Vector3Tuple }) => {
  const { camera } = useThree();
  const cameraOffset = new THREE.Vector3(0, 45, 0);
  const lerpFactor = 0.03;

  useFrame(() => {
    const targetPos = new THREE.Vector3(...target);
    const desiredPosition = targetPos.clone().add(cameraOffset);
    
    camera.position.lerp(desiredPosition, lerpFactor);
    // camera.lookAt(targetPos);
  });

  return null;
};

// Компонент игрока с движением
const Player = ({ state, setState }: { 
  state: PlayerState, 
  setState: React.Dispatch<React.SetStateAction<PlayerState>> 
}) => {
  const { scene } = useGLTF("./Chimpanzee.glb") as unknown as GLTFResult;
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    
    // Движение вперед
    groupRef.current.translateZ(state.speed);
    
    // Обновляем состояние
    const pos = groupRef.current.position;
    setState(prev => ({
      ...prev,
      position: [pos.x, pos.y, pos.z]
    }));
  });

  return (
    <group ref={groupRef} position={state.position} rotation={[0, state.rotation, 0]}>
      <primitive object={scene} scale={0.2} />
    </group>
  );
};

// Компонент шахматной доски
const ChessboardPlane = ({ playerPosition }: { playerPosition: Vector3Tuple }) => {
  const planeRef = useRef<THREE.Mesh>(null);

  // Создаем пиксельную шахматную текстуру
  const createChessboardTexture = () => {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isLight = (x + y) % 2 === 0;
        context.fillStyle = isLight ? '#0f6911' : '#005c02';
        context.fillRect(x, y, 1, 1);
      }
    }
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    texture.repeat.set(10, 10);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  };

  useFrame(() => {
    if (planeRef.current) {
      planeRef.current.position.set(playerPosition[0], 0, playerPosition[2]);
    }
  });

  return (
    <mesh ref={planeRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20000, 20000]} />
      <meshStandardMaterial map={createChessboardTexture()} />
    </mesh>
  );
};

// Игровой мир
const GameWorld = () => {
  return (
    <>
      <ambientLight intensity={3} />
    </>
  );
};

// Компонент скайбокса
const SkyBox = ({ position }: { position: Vector3Tuple }) => {
  const skyboxRef = useRef<THREE.Mesh>(null);
  const map = useTexture('./textures/skybox.jpeg');

  useFrame(() => {
    if (skyboxRef.current) {
      skyboxRef.current.position.set(position[0], 0, position[2]);
    }
  });

  return (
    <mesh ref={skyboxRef}>
      <sphereGeometry args={[550, 10, 10]} />
      <meshStandardMaterial map={map} side={THREE.BackSide} />
    </mesh>
  );
};

// Основной компонент
function App() {
  const [playerState, setPlayerState] = useState<PlayerState>({
    position: [0, 11.5, 0],
    rotation: 0,
    speed: 0,
    hp: 100
  });

  // Обработка движения джойстика
  const handleMove = (event: IJoystickUpdateEvent) => {
    const { x, y } = event;
    
    if (x !== null && y !== null) {
      const angle = Math.atan2(x, -y);
      const distance = Math.min(1, Math.sqrt(x * x + y * y) / 50);
      const maxSpeed = 55;
      const newSpeed = distance * maxSpeed;

      setPlayerState(prev => ({
        ...prev,
        rotation: angle,
        speed: newSpeed
      }));
    }
  };

  // Остановка при отпускании джойстика
  const handleStop = () => {
    setPlayerState(prev => ({
      ...prev,
      speed: 0
    }));
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Canvas 
        style={{ width: '100%', height: '100%' }}
        camera={{ 
          fov: 10,
          zoom: 0.5,
          position: [0, 615, 0] 
        }}
      >
        <Suspense fallback={<LoadingScreen />}>
          <Fisheye>
            <GameWorld />
            <ChessboardPlane playerPosition={[0,0,0]} />
            <Player state={playerState} setState={setPlayerState} />
            <FollowCamera target={playerState.position} />
            <SkyBox position={playerState.position} />
          </Fisheye>
        </Suspense>
      </Canvas>
      
      {/* Виртуальный джойстик внизу по центру */}
      <div style={{
        position: 'absolute',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000
      }}>
        <Joystick
          size={100}
          baseColor="rgba(100, 100, 100, 0.5)"
          stickColor="rgba(200, 200, 200, 0.8)"
          move={handleMove}
          stop={handleStop}
        />
      </div>
    </div>
  );
}

export default App;
