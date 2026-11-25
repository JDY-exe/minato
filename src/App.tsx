import { LogoAlt } from './components/LogoAlt';
import { ThemeSelect } from './minato-design';
import { MainPage } from './pages/main';
import { BlogPage } from './pages/blog';
import { DesignSystemPage } from './pages/design-system';

// Native navigation keeps the initial scaffold free of a routing dependency.
const pages = { '/': MainPage, '/blog': BlogPage, '/design-system': DesignSystemPage };
export function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const Page = pages[path as keyof typeof pages];
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="yuan.tokyo home"><LogoAlt decorative /><span>yuan.tokyo</span></a>
      <nav aria-label="Main navigation">
        <a href="/" aria-current={path === '/' ? 'page' : undefined}>Home</a>
        <a href="/blog" aria-current={path === '/blog' ? 'page' : undefined}>Blog</a>
        <a href="/design-system" aria-current={path === '/design-system' ? 'page' : undefined}>Design system</a>
      </nav>
      <ThemeSelect />
    </header>
    <main id="main" tabIndex={-1}>{Page ? <Page /> : <section className="page-intro"><h1>Page not found.</h1><p><a href="/">Return home</a></p></section>}</main>
    <footer className="site-footer">Built with Minato · React & CSS</footer>
  </>;
}
