// src/test/setup.js
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock de elementos del navegador que pueden no existir en el entorno de pruebas
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Evitar advertencias de acts no envueltos
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Silenciar advertencias normales durante las pruebas
console.error = vi.fn();
console.warn = vi.fn();