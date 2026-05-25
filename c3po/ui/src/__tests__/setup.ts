// Synchronously ensure browser globals are available before any imports
if (typeof global.window === "undefined") {
  // @ts-ignore
  global.window = {};
}
if (typeof global.document === "undefined") {
  // @ts-ignore
  global.document = {};
}
if (typeof global.navigator === "undefined") {
  // @ts-ignore
  global.navigator = { userAgent: "node.js" };
}

// Synchronously mock localStorage if not present
if (typeof global.localStorage === "undefined") {
  // Minimal localStorage polyfill
  const store: Record<string, string> = {};
  global.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (i: number) => Object.keys(store)[i] || null,
    get length() {
      return Object.keys(store).length;
    },
  };
}
if (
  typeof window !== "undefined" &&
  typeof window.localStorage === "undefined"
) {
  window.localStorage = global.localStorage;
}

import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock window.location
const mockLocation = {
  href: "",
  assign: vi.fn(),
  reload: vi.fn(),
  replace: vi.fn(),
  pathname: "/",
  search: "",
  hash: "",
  host: "localhost",
  hostname: "localhost",
  origin: "http://localhost",
  port: "",
  protocol: "http:",
};
if (typeof window !== "undefined") {
  Object.defineProperty(window, "location", {
    value: mockLocation,
    writable: true,
  });
}

// Mock canvas for chart.js
if (typeof window !== "undefined") {
  // @ts-expect-error - TypeScript doesn't have complete type definitions for CanvasRenderingContext2D
  window.HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({
      canvas: {
        width: 100,
        height: 100,
        style: {},
        getContext: vi.fn(),
      },
      getLineDash: vi.fn(),
      setLineDash: vi.fn(),
      scale: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      toDataURL: vi.fn().mockReturnValue("data:image/png;base64,iVBORw0KGgo="),
      // Minimal CanvasRenderingContext2D properties needed for chart.js
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      isPointInPath: vi.fn().mockReturnValue(false),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      createLinearGradient: vi.fn(),
      createPattern: vi.fn(),
      createRadialGradient: vi.fn(),
      lineDashOffset: 0,
      miterLimit: 10,
      lineCap: "butt",
      lineJoin: "miter",
      lineWidth: 1,
      shadowBlur: 0,
      shadowColor: "",
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textAlign: "start",
      textBaseline: "alphabetic",
      font: "10px sans-serif",
    })
  );
}
