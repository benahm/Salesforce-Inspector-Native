import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    'getting-started',
    'setup',
    {
      type: 'category',
      label: 'Tools',
      collapsed: false,
      link: {type: 'generated-index', slug: '/category/tools', description: 'Every tool of SF Inspector Native, opened from the launcher.'},
      items: [
        'tools/launcher',
        'tools/show-all-data',
        'tools/object-inspector',
        'tools/data-export',
        'tools/data-import',
        'tools/org-limits',
        'tools/event-monitor',
        'tools/logs-viewer',
      ],
    },
    'security',
    'uninstall',
    'development',
  ],
};

export default sidebars;
