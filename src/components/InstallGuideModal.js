import { renderSVG } from '../utils/svg.js';

export function renderInstallGuideModal() {
  return `
    <div class="player-drawer" id="install-modal" style="display: none; transform: translateY(100%);">
      <div class="drawer-header">
        <button class="btn-icon" id="btn-close-install" title="Close Guide">
          ${renderSVG('chevronDown', 24)}
        </button>
        <span class="section-title">Install on iPhone 13</span>
        <div style="width: 40px;"></div>
      </div>

      <div class="glass-card" style="margin-top: 10px;">
        <div style="text-align: center; padding: 20px 10px;">
          <div class="brand-icon" style="width: 64px; height: 64px; margin: 0 auto 16px;">
            ${renderSVG('smartphone', 32)}
          </div>
          <h3 style="font-family: var(--font-heading); font-size: 1.2rem; font-weight: 700; margin-bottom: 8px;">Install MyMix as an iPhone App</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5; margin-bottom: 20px;">
            MyMix runs as a native standalone PWA on iOS Safari with background audio playback, lock screen controls, and local offline music storage.
          </p>

          <div style="display: flex; flex-direction: column; gap: 14px; text-align: left;">
            <div style="display: flex; gap: 14px; align-items: center; background: var(--bg-surface); padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-glass);">
              <span class="badge" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; font-size: 0.9rem;">1</span>
              <div>
                <div style="font-weight: 600; font-size: 0.9rem;">Tap Share in Safari</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">Tap the Share icon ${renderSVG('share', 14)} at the bottom of Safari</div>
              </div>
            </div>

            <div style="display: flex; gap: 14px; align-items: center; background: var(--bg-surface); padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-glass);">
              <span class="badge" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; font-size: 0.9rem;">2</span>
              <div>
                <div style="font-weight: 600; font-size: 0.9rem;">Add to Home Screen</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">Scroll down and select <b>Add to Home Screen</b></div>
              </div>
            </div>

            <div style="display: flex; gap: 14px; align-items: center; background: var(--bg-surface); padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-glass);">
              <span class="badge" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; font-size: 0.9rem;">3</span>
              <div>
                <div style="font-weight: 600; font-size: 0.9rem;">Launch MyMix</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">Tap the MyMix icon on your iPhone home screen to play music!</div>
              </div>
            </div>
          </div>

          <button class="btn-primary" id="btn-got-it" style="margin-top: 24px; width: 100%; justify-content: center; padding: 12px;">
            Got It!
          </button>
        </div>
      </div>
    </div>
  `;
}
