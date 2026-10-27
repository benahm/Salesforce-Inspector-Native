import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repoUrl = 'https://github.com/benahm/Salesforce-Inspector-Native';

const config: Config = {
  title: 'SF Inspector Native',
  tagline: 'The essentials of Salesforce Inspector, built in Salesforce: a managed package opened from a global action, with no browser extension.',
  favicon: 'img/logo-beta.svg',

  future: {
    v4: true,
  },

  url: 'https://benahm.github.io',
  baseUrl: '/Salesforce-Inspector-Native/',
  organizationName: 'benahm',
  projectName: 'Salesforce-Inspector-Native',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: `${repoUrl}/tree/main/website/`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'beta',
      content: `SF Inspector Native is in beta: install it in a sandbox or a Developer Edition org, and <a href="${repoUrl}/issues">report issues</a>.`,
      isCloseable: true,
    },
    navbar: {
      title: 'SF Inspector Native',
      logo: {
        alt: 'SF Inspector Native',
        src: 'img/logo-beta.svg',
        srcDark: 'img/logo-beta-dark.svg',
      },
      items: [
        {type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs'},
        {to: '/docs/category/tools', label: 'Tools', position: 'left'},
        {href: `${repoUrl}/releases`, label: 'Releases', position: 'right'},
        {href: repoUrl, label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting started', to: '/docs/getting-started'},
            {label: 'Tools', to: '/docs/category/tools'},
            {label: 'Setup tab', to: '/docs/setup'},
          ],
        },
        {
          title: 'Project',
          items: [
            {label: 'GitHub', href: repoUrl},
            {label: 'Issues', href: `${repoUrl}/issues`},
            {label: 'Releases', href: `${repoUrl}/releases`},
          ],
        },
      ],
      copyright: `SF Inspector Native, MIT license. Not affiliated with Salesforce.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'apex'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
