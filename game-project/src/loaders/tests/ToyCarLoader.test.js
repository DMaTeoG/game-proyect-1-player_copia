import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ToyCarLoader from '../ToyCarLoader';
import Prize from '../../Experience/World/Prize';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as PhysicsFactory from '../../Experience/Utils/PhysicsShapeFactory';

// Mock mejorado de THREE
vi.mock('three', () => {
  const texture = {
    encoding: null,
    wrapS: null,
    wrapT: null,
    anisotropy: null,
    center: { set: vi.fn() },
    rotation: 0
  };

  return {
    Box3: vi.fn(() => ({
      setFromObject: vi.fn().mockReturnThis(),
      getCenter: vi.fn(() => new THREE.Vector3()),
      getSize: vi.fn(() => new THREE.Vector3())
    })),
    Vector3: vi.fn(() => ({
      set: vi.fn(),
      copy: vi.fn(),
      x: 0, y: 0, z: 0,
      subtract: vi.fn()
    })),
    TextureLoader: vi.fn(() => ({
      load: vi.fn((path, callback) => {
        if (callback) callback(texture);
        return texture;
      })
    })),
    MeshBasicMaterial: vi.fn(),
    ClampToEdgeWrapping: 'ClampToEdgeWrapping',
    DoubleSide: 'DoubleSide',
    sRGBEncoding: 'sRGBEncoding'
  };
});

// Mock mejorado de cannon-es
vi.mock('cannon-es', () => ({
  Body: vi.fn(() => ({
    position: { x: 0, y: 0, z: 0 },
    quaternion: { setFromEuler: vi.fn() },
    material: null,
    shape: null,
    addShape: vi.fn(),
    applyImpulse: vi.fn(),
    applyForce: vi.fn(),
    velocity: { set: vi.fn(), x: 0, y: 0, z: 0 },
    angularVelocity: { set: vi.fn() },
    angularFactor: { set: vi.fn() },
    updateMassProperties: vi.fn()
  })),
  Vec3: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
  Quaternion: vi.fn(),
  Material: vi.fn(),
  Sphere: vi.fn(),
  Box: vi.fn(),
  Trimesh: vi.fn()
}));

vi.mock('../../Experience/World/Prize', () => ({
  default: vi.fn(() => ({
    model: {},
    position: { x: 0, y: 0, z: 0 }
  }))
}));

vi.mock('../../Experience/Utils/PhysicsShapeFactory.js', () => ({
  createBoxShapeFromModel: vi.fn(() => ({})),
  createTrimeshShapeFromModel: vi.fn(() => ({}))
}));

describe('ToyCarLoader', () => {
  let toyCarLoader;
  let mockExperience;
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    global.import = { 
      meta: { 
        env: { 
          VITE_API_URL: 'http://localhost:3000',
          BASE_URL: '/'
        } 
      } 
    };

    mockExperience = {
      scene: {
        add: vi.fn(),
        getObjectByName: vi.fn(() => null)
      },
      resources: {
        items: {
          'coin001': { 
            scene: { 
              clone: vi.fn(() => ({ 
                name: 'coin001',
                traverse: vi.fn()
              })) 
            } 
          },
          'block001': { 
            scene: { 
              clone: vi.fn(() => ({ 
                name: 'block001',
                traverse: vi.fn()
              })) 
            } 
          }
        }
      },
      physics: {
        world: { addBody: vi.fn() },
        obstacleMaterial: { name: 'obstacleMaterial' }
      },
      renderer: {
        instance: {
          capabilities: {
            getMaxAnisotropy: vi.fn().mockReturnValue(16)
          }
        }
      }
    };

    toyCarLoader = new ToyCarLoader(mockExperience);
    
    // Mock de console para verificar llamadas
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('debe inicializar correctamente', () => {
      expect(toyCarLoader).toBeDefined();
      expect(toyCarLoader.scene).toBe(mockExperience.scene);
      expect(toyCarLoader.resources).toBe(mockExperience.resources);
      expect(toyCarLoader.physics).toBe(mockExperience.physics);
      expect(toyCarLoader.prizes).toEqual([]);
    });
  });

  describe('loadFromAPI()', () => {
    it('debe manejar errores de API y cargar desde archivo local', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ['block001']
        })
        .mockResolvedValueOnce({
          ok: false
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'block001', x: 1, y: 2, z: 3 }]
        });

      await toyCarLoader.loadFromAPI();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/No se pudo conectar con la API/)
      );
      expect(mockFetch).toHaveBeenCalledWith('/data/threejs_blocks.blocks.json');
    });

    it('debe manejar bloques sin nombre', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ x: 1, y: 2, z: 3 }]
        });

      await toyCarLoader.loadFromAPI();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Bloque sin nombre|🛑 Bloque sin nombre/),
        expect.objectContaining({ x: 1, y: 2, z: 3 })
      );
    });

    it('debe manejar modelos no encontrados', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'modeloInexistente', x: 1, y: 2, z: 3 }]
        });

      await toyCarLoader.loadFromAPI();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Modelo no encontrado/)
      );
    });

    it('debe aplicar texturas a carteles cuando existen', async () => {
      const mockCube = {
        name: 'Cube',
        material: null
      };
      mockExperience.scene.getObjectByName.mockReturnValue(mockCube);

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ 
          ok: true, 
          json: async () => [{ name: 'block001', x: 1, y: 2, z: 3 }] 
        });

      await toyCarLoader.loadFromAPI();

      expect(THREE.TextureLoader).toHaveBeenCalled();
      expect(mockExperience.scene.getObjectByName).toHaveBeenCalledWith('Cube');
    });

    it('debe crear premios para modelos coin', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ 
          ok: true, 
          json: async () => [{ name: 'coin001', x: 1, y: 2, z: 3 }] 
        });

      await toyCarLoader.loadFromAPI();

      expect(Prize).toHaveBeenCalled();
      expect(toyCarLoader.prizes.length).toBe(1);
    });

    it('debe crear cuerpos físicos para los modelos', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ['block001'] })
        .mockResolvedValueOnce({ 
          ok: true, 
          json: async () => [{ name: 'block001', x: 1, y: 2, z: 3 }] 
        });

      await toyCarLoader.loadFromAPI();

      expect(PhysicsFactory.createTrimeshShapeFromModel).toHaveBeenCalled();
      expect(CANNON.Body).toHaveBeenCalled();
      expect(mockExperience.physics.world.addBody).toHaveBeenCalled();
    });

    it('debe manejar errores generales', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Error de red'));

      await toyCarLoader.loadFromAPI();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error al cargar bloques/),
        expect.any(Error)
      );
    });
  });
});