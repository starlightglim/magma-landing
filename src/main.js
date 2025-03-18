// Import necessary ThreeJS libraries
import * as THREE from 'three';

// Main scene variables
let scene, camera, renderer;
let rockMesh;
let mouse = new THREE.Vector2(0.5, 0.5);
let lastMousePos = new THREE.Vector2(0.5, 0.5);
let raycaster = new THREE.Raycaster();
let isHovering = false;
let hoverPosition = new THREE.Vector2(0.5, 0.5);
let targetPosition = new THREE.Vector2(0.5, 0.5);

// Scene parameters
const params = {
  // Lava parameters
  baseIntensity: 0.2,    // Increased base intensity
  maxIntensity: 1.4,     // Adjusted max intensity
  lavaColor: '#ff3300',  // Matching our brand color
  lavaColor2: '#ff6600', // Secondary brand color
  lavaColor3: '#ff9900', // Warm accent color
  
  // Rock parameters
  baseCreviceGlow: 0.05,  // Subtle base glow
  maxCreviceGlow: 0.15,   // Moderate max glow
  baseRimLight: 0.1,      // Subtle rim light
  maxRimLight: 0.4,       // Increased rim light
  rockDarkness: 0.6,      // Darker rock for contrast
  
  // Flow parameters
  flowSpeed: 0.05,        // Slower, more subtle flow
  flowRadius: 0.4,        // Larger influence radius
  transitionSpeed: 0.98,  // Smoother transitions
  noiseScale: 2.5,        // Adjusted noise scale
  noiseOctaves: 4,        // Reduced complexity
  colorMixSpeed: 0.3,     // Slower color mixing
  fadeSpeed: 0.97,        // Smoother fading
};

// Initialize the scene
function init() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a); // Matching our background color

  // Set up camera
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  // Set up renderer
  renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('lava-canvas'),
    antialias: true 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Add lights
  const ambientLight = new THREE.AmbientLight(0x333333);
  scene.add(ambientLight);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(1, 1, 1);
  scene.add(dirLight);

  // Load rock with lava
  loadRockWithLava();

  // Add event listeners
  window.addEventListener('resize', onWindowResize);
  
  // Add hover event listeners to interactive elements
  setupHoverEffects();
}

function loadRockWithLava() {
  const textureLoader = new THREE.TextureLoader();
  
  // Load all textures
  const albedoTexture = textureLoader.load('/textures/TCom_Rock_Lava2_1K_albedo.jpg');
  const normalTexture = textureLoader.load('/textures/TCom_Rock_Lava2_1K_normal.png');
  const heightTexture = textureLoader.load('/textures/TCom_Rock_Lava2_1K_height.png');
  const roughnessTexture = textureLoader.load('/textures/TCom_Rock_Lava2_1K_roughness.png');
  const aoTexture = textureLoader.load('/textures/TCom_Rock_Lava2_1K_ao.png');
  const maskTexture = textureLoader.load('/textures/TCom_Rock_Lava2_1K_mask.png');

  // Set texture properties
  [albedoTexture, normalTexture, heightTexture, roughnessTexture, aoTexture, maskTexture].forEach(texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  });

  // Create shader material
  const lavaShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      mousePos: { value: new THREE.Vector2(0.5, 0.5) },
      lastMousePos: { value: new THREE.Vector2(0.5, 0.5) },
      currentInfluence: { value: 0.0 },  // Track current influence
      targetInfluence: { value: 0.0 },   // Target influence from mouse
      ...Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] = { value: typeof value === 'string' ? new THREE.Color(value) : value };
        return acc;
      }, {}),
      // Add texture uniforms
      albedoMap: { value: albedoTexture },
      normalMap: { value: normalTexture },
      heightMap: { value: heightTexture },
      roughnessMap: { value: roughnessTexture },
      aoMap: { value: aoTexture },
      maskMap: { value: maskTexture }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vTangent;
      varying vec3 vBitangent;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        // Calculate tangent space for normal mapping
        vec3 tangent = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vec3 bitangent = normalize(cross(vNormal, tangent));
        vTangent = tangent;
        vBitangent = bitangent;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vTangent;
      varying vec3 vBitangent;
      
      uniform float time;
      uniform vec2 mousePos;
      uniform vec2 lastMousePos;
      uniform float baseIntensity;
      uniform float maxIntensity;
      uniform vec3 lavaColor;
      uniform vec3 lavaColor2;
      uniform vec3 lavaColor3;
      uniform float baseCreviceGlow;
      uniform float maxCreviceGlow;
      uniform float baseRimLight;
      uniform float maxRimLight;
      uniform float rockDarkness;
      uniform float flowSpeed;
      uniform float flowRadius;
      uniform float transitionSpeed;
      uniform float noiseScale;
      uniform float noiseOctaves;
      uniform float colorMixSpeed;
      uniform float currentInfluence;
      uniform float targetInfluence;
      uniform float fadeSpeed;
      
      uniform sampler2D albedoMap;
      uniform sampler2D normalMap;
      uniform sampler2D heightMap;
      uniform sampler2D roughnessMap;
      uniform sampler2D aoMap;
      uniform sampler2D maskMap;
      
      // Improved noise function
      float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
      vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
      vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}
      
      float noise(vec3 p){
          vec3 a = floor(p);
          vec3 d = p - a;
          d = d * d * (3.0 - 2.0 * d);
      
          vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
          vec4 k1 = perm(b.xyxy);
          vec4 k2 = perm(k1.xyxy + b.zzww);
      
          vec4 c = k2 + a.zzzz;
          vec4 k3 = perm(c);
          vec4 k4 = perm(c + 1.0);
      
          vec4 o1 = fract(k3 * (1.0 / 41.0));
          vec4 o2 = fract(k4 * (1.0 / 41.0));
      
          vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
          vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);
      
          return o4.y * d.y + o4.x * (1.0 - d.y);
      }
      
      float fbm(vec3 x) {
          float v = 0.0;
          float a = 0.5;
          vec3 shift = vec3(100);
          for (int i = 0; i < 5; ++i) {
              v += a * noise(x);
              x = x * 2.0 + shift;
              a *= 0.5;
          }
          return v;
      }

      // New function for more organic flow
      float organicFlow(vec2 uv, float time) {
          float flow = 0.0;
          float scale = noiseScale;
          float speed = flowSpeed;
          
          // Multiple layers of noise with different scales and speeds
          for (int i = 0; i < 5; i++) {
              vec3 p = vec3(uv * scale, time * speed);
              flow += fbm(p) * (1.0 / float(i + 1));
              scale *= 2.0;
              speed *= 1.5;
          }
          
          return flow;
      }

      vec3 perturbNormal(vec3 normal, vec3 tangent, vec3 bitangent, vec2 uv) {
        vec3 normalMap = texture2D(normalMap, uv).xyz * 2.0 - 1.0;
        mat3 TBN = mat3(tangent, bitangent, normal);
        return normalize(TBN * normalMap);
      }
      
      void main() {
        // Sample textures
        vec4 albedo = texture2D(albedoMap, vUv);
        float height = texture2D(heightMap, vUv).r;
        float roughness = texture2D(roughnessMap, vUv).r;
        float ao = texture2D(aoMap, vUv).r;
        float mask = texture2D(maskMap, vUv).r;
        
        // Get perturbed normal
        vec3 normal = perturbNormal(vNormal, vTangent, vBitangent, vUv);
        
        // Create organic flowing lava effect
        float flow = organicFlow(vUv, time);
        float pattern = flow * mask;
        
        // Calculate influence-based parameters
        float lavaIntensity = mix(baseIntensity, maxIntensity, currentInfluence);
        float creviceGlowAmount = mix(baseCreviceGlow, maxCreviceGlow, currentInfluence);
        float rimLightAmount = mix(baseRimLight, maxRimLight, currentInfluence);
        
        // Create height-based cracks with variation
        float cracks = smoothstep(0.4, 0.6, height) * mask;
        cracks *= (1.0 + 0.2 * noise(vec3(vUv * 5.0, time * 0.5)));
        
        // Calculate rim lighting
        float rim = 1.0 - max(0.0, dot(normal, normalize(vViewPosition)));
        rim = smoothstep(0.5, 1.0, rim) * rimLightAmount;
        
        // Create color variation based on temperature
        float temp = pattern * lavaIntensity;
        vec3 hotColor = mix(lavaColor, lavaColor2, temp * colorMixSpeed);
        hotColor = mix(hotColor, lavaColor3, temp * temp * colorMixSpeed);
        
        // Mix colors with textures
        vec3 baseColor = albedo.rgb;
        vec3 lavaColor = mix(baseColor, hotColor, temp);
        vec3 crackColor = mix(lavaColor, hotColor * 1.2, cracks * creviceGlowAmount);
        
        // Add rim lighting and AO
        vec3 finalColor = crackColor + rim * hotColor;
        finalColor *= ao;
        
        // Add roughness variation
        finalColor *= mix(1.0, 0.7, roughness);
        
        // Add subtle pulsing to the lava
        float pulse = 1.0 + 0.1 * sin(time * 2.0 + pattern * 10.0);
        finalColor *= pulse;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: true
  });

  // Create mesh
  const aspect = window.innerWidth / window.innerHeight;
  const geometry = new THREE.PlaneGeometry(2 * aspect, 2, 128, 128);
  geometry.computeVertexNormals();
  geometry.computeTangents();
  
  rockMesh = new THREE.Mesh(geometry, lavaShaderMaterial);
  scene.add(rockMesh);
}

function setupHoverEffects() {
  const interactiveElements = [
    document.querySelector('.nav-logo'),
    document.querySelector('.cta-primary')
  ];

  interactiveElements.forEach(element => {
    if (element) {
      element.addEventListener('mouseenter', (e) => {
        isHovering = true;
        updateHoverPosition(e, element);
      });

      element.addEventListener('mouseleave', () => {
        isHovering = false;
      });

      element.addEventListener('mousemove', (e) => {
        if (isHovering) {
          updateHoverPosition(e, element);
        }
      });
    }
  });
}

function updateHoverPosition(event, element) {
  const rect = element.getBoundingClientRect();
  const elementCenterX = rect.left + rect.width / 2;
  const elementCenterY = rect.top + rect.height / 2;

  // Convert to normalized device coordinates (-1 to +1)
  hoverPosition.x = (elementCenterX / window.innerWidth) * 2 - 1;
  hoverPosition.y = -(elementCenterY / window.innerHeight) * 2 + 1;
}

// Handle window resize
function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  
  camera.left = -aspect;
  camera.right = aspect;
  camera.updateProjectionMatrix();
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  if (rockMesh) {
    rockMesh.geometry = new THREE.PlaneGeometry(2 * aspect, 2, 128, 128);
    rockMesh.geometry.computeVertexNormals();
    rockMesh.geometry.computeTangents();
  }
}

// Add smoothstep function implementation
function smoothstep(edge0, edge1, x) {
  // Clamp x to 0..1 range and compute smoothstep
  x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  if (rockMesh) {
    const material = rockMesh.material;
    material.uniforms.time.value = performance.now() / 1000;

    // Smoothly update target position
    if (isHovering) {
      targetPosition.lerp(hoverPosition, 0.1);
    } else {
      targetPosition.lerp(new THREE.Vector2(0.5, 0.5), 0.05);
    }

    // Update raycaster with current target position
    raycaster.setFromCamera(targetPosition, camera);
    
    const intersects = raycaster.intersectObject(rockMesh);
    
    let targetInfluence = 0.0;
    if (intersects.length > 0 && isHovering) {
      const intersection = intersects[0];
      const uv = intersection.uv;
      
      const dist = Math.sqrt(
        Math.pow(uv.x - 0.5, 2) + 
        Math.pow(uv.y - 0.5, 2)
      );
      
      targetInfluence = smoothstep(params.flowRadius, 0.0, dist);
    }
    
    const currentInfluence = material.uniforms.currentInfluence.value;
    const newInfluence = currentInfluence + (targetInfluence - currentInfluence) * (1.0 - params.transitionSpeed);
    
    material.uniforms.currentInfluence.value = newInfluence;
    material.uniforms.targetInfluence.value = targetInfluence;
    material.uniforms.mousePos.value.set(targetPosition.x, targetPosition.y);
  }
  
  renderer.render(scene, camera);
}

// Start the app
init();
animate(); 