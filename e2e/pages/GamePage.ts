const { I } = inject();

/**
 * Page object for the Guild of Second Chances game.
 * Encapsulates common selectors and game-state manipulation helpers.
 */
export = {
  /** Header gold amount */
  headerGold: '.energy-amount',
  /** Header settings gear button */
  settingsButton: '.header-settings',
  /** Bottom tab bar */
  tabBar: '.tab-bar',
  /** Modal overlay */
  modalOverlay: '.story-overlay',
  /** Modal dialog */
  modalDialog: '.story-modal',
  /** Modal title */
  modalTitle: '.story-title',
  /** Modal body text */
  modalBody: '.story-text',
  /** Modal close button (icon-button inside modal) */
  modalCloseButton: '.story-modal .icon-button',
  /** ConfirmModal confirm button */
  confirmButton: '.story-modal .small-button.primary, .story-modal .small-button.danger',
  /** ConfirmModal cancel button */
  cancelButton: '.story-modal .small-button:not(.primary):not(.danger)',
  /** Toast container */
  toastStack: '.toast-stack',
  /** Individual toast */
  toast: '.toast',
  /** Toast close button */
  toastClose: '.toast-close',
  /** Story continue button */
  storyContinue: '.story-continue',
  /** Click button (Work Odd Jobs) */
  clickButton: '.click-button',
  /** Section titles */
  sectionTitle: '.section-title',
  /** Quest checklist rows */
  questChecklistRow: '.quest-checklist-row',
  /** PixiJS battle canvas */
  battleCanvas: 'canvas',

  /**
   * Navigate to the game and wait for it to be ready.
   */
  open() {
    I.amOnPage('/');
    I.waitForElement(this.headerGold, 10);
  },

  /**
   * Open a tab by its label text.
   */
  openTab(tabLabel: string) {
    I.click(tabLabel);
    I.wait(0.5);
  },

  /**
   * Open the Settings panel.
   */
  openSettings() {
    I.click(this.settingsButton);
    I.waitForElement('.settings-panel', 5);
  },

  /**
   * Close any open modal by clicking its backdrop or close button.
   */
  closeModal() {
    I.click(this.modalCloseButton);
    I.waitForInvisible(this.modalDialog, 3);
  },

  /**
   * Click the "Work Odd Jobs" button N times.
   */
  clickOddJobs(times: number) {
    for (let i = 0; i < times; i++) {
      I.click(this.clickButton);
      I.wait(0.1);
    }
  },

  /**
   * Inject game state to set up specific conditions.
   * Returns the injected state for assertions.
   */
  async injectState(statePatch: Record<string, unknown>) {
    return await I.executeScript((patch) => {
      // Access the global game store (exposed for testing)
      const store = (window as any).__GAME_STORE__;
      if (!store) return null;
      store.dispatch((s: any) => ({ ...s, ...patch }));
      return store.getState();
    }, statePatch);
  },

  /**
   * Get computed style of an element.
   */
  async getComputedStyle(selector: string, property: string) {
    return await I.executeScript(
      (sel: string, prop: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return getComputedStyle(el)[prop as any];
      },
      selector,
      property,
    );
  },

  /**
   * Check if an element exists in the DOM.
   */
  async elementExists(selector: string) {
    return await I.executeScript((sel: string) => {
      return !!document.querySelector(sel);
    }, selector);
  },

  /**
   * Check if a modal is currently open.
   */
  async isModalOpen() {
    return await this.elementExists(this.modalDialog);
  },

  /**
   * Wait for a toast to appear.
   */
  waitForToast(messageSubstring: string, timeout = 10) {
    I.waitForText(messageSubstring, timeout, this.toast);
  },

  /**
   * Count visible toasts.
   */
  async countToasts() {
    return await I.executeScript(() => {
      return document.querySelectorAll('.toast:not(.toast-out)').length;
    });
  },
};
