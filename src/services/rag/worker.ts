import { pipeline, PipelineType, env } from '@xenova/transformers';

// Skip local model checks for browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task as PipelineType, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { id, text, texts } = event.data;

  try {
    const extractor = await PipelineSingleton.getInstance((data: any) => {
      self.postMessage({
        id,
        status: 'progress',
        data
      });
    });

    // Handle single text or array of texts
    const input = texts || [text];
    const output = await extractor(input, { pooling: 'mean', normalize: true });

    self.postMessage({
      id,
      status: 'complete',
      output: output.tolist()
    });
  } catch (error: any) {
    self.postMessage({
      id,
      status: 'error',
      error: error.message
    });
  }
});
