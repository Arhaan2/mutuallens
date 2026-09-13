import {
  compareDataset,
  compareSnapshots,
  createSampleDataset,
  importInstagramFiles,
} from '@mutuallens/core';
import type { Dataset, ImportOptions, Snapshot } from '@mutuallens/core';

type Request =
  | { id: number; kind: 'sample' }
  | { id: number; kind: 'import'; files: File[]; options: ImportOptions }
  | { id: number; kind: 'compare'; dataset: Dataset }
  | { id: number; kind: 'history'; before: Snapshot; after: Snapshot };

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const started = performance.now();
    if (data.kind === 'history') {
      self.postMessage({
        id: data.id,
        result: compareSnapshots(data.before, data.after),
      });
      return;
    }
    const dataset =
      data.kind === 'sample'
        ? createSampleDataset()
        : data.kind === 'compare'
          ? data.dataset
          : await importInstagramFiles(data.files, data.options);
    self.postMessage({
      id: data.id,
      result: {
        dataset,
        comparison: compareDataset(dataset),
        elapsedMs: performance.now() - started,
      },
    });
  } catch (error) {
    const assignments =
      error instanceof Error &&
      'assignments' in error &&
      Array.isArray(error.assignments)
        ? error.assignments
        : undefined;
    self.postMessage({
      ...(assignments ? { assignments } : {}),
      id: data.id,
      error:
        error instanceof Error
          ? error.message
          : 'The selected data could not be processed.',
    });
  }
};
