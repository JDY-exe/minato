import { Surface } from '../../minato-design';

export function MainPage() {
  return <>
    <section className="page-intro">
      <h1>A place to<br />make your own.</h1>
      <p>Your personal site starts here. Minato provides the foundations; your work, writing, and story come next.</p>
      <a className="page-link" href="/design-system">Explore the design system <span aria-hidden="true">→</span></a>
    </section>
    <Surface tone="primary" className="starter-note"><h2>Room for what’s next.</h2><p>This is a starter page. Add your introduction and selected work in <code>src/pages/main/</code>.</p></Surface>
  </>;
}
