import { renderSVG } from '../utils/svg.js';

export function renderHeader() {
  return `
    <header class="app-header">
      <div class="brand">
        <img class="brand-avatar" src="/assets/avatar.jpg" alt="User Avatar" style="width: 54px; height: 54px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-purple); box-shadow: 0 0 16px rgba(139, 92, 246, 0.4); flex-shrink: 0;" />
        <span class="brand-title" style="font-size: 1.5rem;">MyMix</span>
      </div>
      <div class="header-actions">
        <button class="btn-primary" id="btn-add-track">
          ${renderSVG('plus')}
          <span>Add Music</span>
        </button>
      </div>
    </header>
  `;
}
