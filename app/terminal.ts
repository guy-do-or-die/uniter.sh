import { UnifiedTerminalEngine, UnifiedTerminalRenderer } from '../shared/terminal/index.js';
import { WebTerminalRenderer as WebRenderer } from './renderer.js';
import { WebAdapter } from './adapter.js';

/**
 * Web Terminal - unified terminal using dependency injection
 */
export class WebTerminalRenderer {
  private unifiedRenderer: UnifiedTerminalRenderer;
  private webRenderer: WebRenderer;

  constructor() {
    const adapter = new WebAdapter();
    const engine = new UnifiedTerminalEngine(adapter);
    this.webRenderer = new WebRenderer();
    this.unifiedRenderer = new UnifiedTerminalRenderer(engine, this.webRenderer);
  }

  /**
   * Initialize the web terminal
   */
  async init(): Promise<void> {
    await this.webRenderer.init();
    await this.unifiedRenderer.start();
  }
}
