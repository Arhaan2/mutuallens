import {
  compareDataset,
  compareSnapshots,
  createSampleDataset,
  importInstagram,
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
    if (
      data.kind === 'import' &&
      (data.files.length > 2000 ||
        data.files.reduce((total, file) => total + file.size, 0) >
          64 * 1024 * 1024)
    ) {
      throw new Error(
        'These files exceed the local memory safety budget (64 MiB total input or 2,000 files). Select only the relevant followers and following JSON files. No record-count limit is applied.',
      );
    }
    if (data.kind === 'history') {
      self.postMessage({
        id: data.id,
        result: compareSnapshots(data.before, data.after),
      });
      return;
    }
    const files = [];
    if (data.kind === 'import') {
      for (const file of data.files)
        files.push({
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
    }
    const dataset =
      data.kind === 'sample'
        ? createSampleDataset()
        : data.kind === 'compare'
          ? data.dataset
          : await importInstagram(files, data.options);
    self.postMessage({
      id: data.id,
      result: {
        dataset,
        comparison: compareDataset(dataset),
        elapsedMs: performance.now() - started,
      },
    });
  } catch (error) {
    self.postMessage({
      id: data.id,
      error:
        error instanceof Error
          ? error.message
          : 'The selected data could not be processed.',
    });
  }
};
