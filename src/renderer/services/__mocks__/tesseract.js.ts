import { vi } from 'vitest';

export const createWorker = vi.fn(async (_langs: string) => {
  return {
    recognize: vi.fn(async (_canvas: HTMLCanvasElement) => ({
      data: {
        text: 'Mock-Text',
        words: [
          {
            text: 'Max',
            confidence: 92,
            bbox: { x0: 10, y0: 10, x1: 50, y1: 30 },
          },
          {
            text: 'Mustermann',
            confidence: 88,
            bbox: { x0: 55, y0: 10, x1: 150, y1: 30 },
          },
        ],
      },
    })),
    terminate: vi.fn(async () => undefined),
    reinitialize: vi.fn(),
  };
});

export default { createWorker };
