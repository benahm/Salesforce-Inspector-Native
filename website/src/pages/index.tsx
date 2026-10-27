import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './index.module.css';

type Feature = {title: string; description: ReactNode};

const features: Feature[] = [
  {
    title: 'No browser extension',
    description: (
      <>
        A managed package installed in the org. It works where extensions are blocked, on any browser, for every user
        given access.
      </>
    ),
  },
  {
    title: 'One click from any page',
    description: (
      <>
        A global action opens the launcher from the <code>+</code> menu of every Lightning page, with the current
        record already in context.
      </>
    ),
  },
  {
    title: 'The essential tools',
    description: (
      <>
        Show All Data, object inspector, data export and import, org limits, event monitor and debug logs, in Lightning
        components.
      </>
    ),
  },
  {
    title: 'Inside the org security',
    description: (
      <>
        No callout and no Tooling API: queries and changes run in user mode, with the user's own permissions. Admins choose who gets
        access.
      </>
    ),
  },
];

function Hero(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.hero)}>
      <div className="container">
        <img className={styles.logo} src={useBaseUrl('img/logo-beta.svg')} alt="" width="96" height="96" />
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className={clsx('hero__subtitle', styles.tagline)}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/getting-started">
            Get started
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/category/tools">
            Tools
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout description="Salesforce Inspector essentials as a native Salesforce managed package, opened from a global action.">
      <Hero />
      <main className="container margin-vert--xl">
        <div className="row">
          {features.map((feature) => (
            <div key={feature.title} className={clsx('col col--3', styles.feature)}>
              <Heading as="h3">{feature.title}</Heading>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
