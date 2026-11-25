import { Surface } from '../../minato-design';

export function BlogPage() {
  return <>
    <section className="page-intro"><h1>Writing.</h1><p>A home for notes, ideas, and longer stories.</p></section>
    <Surface tone="low" className="starter-note"><h2>No posts yet.</h2><p>Add your first post in <code>src/pages/blog/</code>. There’s no content pipeline to work around yet.</p></Surface>
  </>;
}
