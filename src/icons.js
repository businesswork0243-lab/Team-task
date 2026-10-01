// Icon library for Operations Workspace
export function icon(name, size = 18, className = '') {
  const s = size;
  const c = className ? ` class="${className}"` : '';
  const base = `width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${c}`;

  switch (name) {
    case 'dashboard':
      return `<svg ${base}><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>`;

    case 'tasks':
      return `<svg ${base}><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`;

    case 'clients':
      return `<svg ${base}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;

    case 'search':
      return `<svg ${base}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

    case 'plus':
      return `<svg ${base}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

    case 'chevron-left':
      return `<svg ${base}><polyline points="15 18 9 12 15 6"></polyline></svg>`;

    case 'chevron-right':
      return `<svg ${base}><polyline points="9 18 15 12 9 6"></polyline></svg>`;

    case 'chevron-down':
      return `<svg ${base}><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    case 'logout':
      return `<svg ${base}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;

    case 'close':
      return `<svg ${base}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    case 'check':
      return `<svg ${base}><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    case 'lock':
      return `<svg ${base}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

    default:
      return '';
  }
}

export function workspaceLogo(size = 32) {
  return `
    <div style="width:${size}px;height:${size}px;border-radius:8px;background:#4F46E5;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${Math.round(size * 0.52)}px;box-shadow:0 2px 8px rgba(79,70,229,0.35);flex-shrink:0">
      <span style="font-family:system-ui,sans-serif;letter-spacing:-0.5px">O</span>
    </div>
  `;
}
