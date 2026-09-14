import { parseFrontmatter } from './frontmatter.js';

const POSTS_DIR = 'posts/';
const MANIFEST_URL = `${POSTS_DIR}posts.json`;

export function slugFromFilename(filename) {
  return filename.replace(/\.md$/, '');
}

export async function loadManifest() {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.status}`);
  }
  return response.json();
}

export async function loadPost(filename) {
  const response = await fetch(POSTS_DIR + filename);
  if (!response.ok) {
    throw new Error(`Failed to load post: ${filename}`);
  }
  const rawText = await response.text();
  const { data, content } = parseFrontmatter(rawText);
  return { slug: slugFromFilename(filename), filename, data, content };
}

export async function loadAllPosts() {
  const filenames = await loadManifest();
  const results = await Promise.all(
    filenames.map(async (filename) => {
      try {
        return await loadPost(filename);
      } catch (err) {
        console.error(err);
        return null;
      }
    })
  );

  return results
    .filter((post) => post !== null)
    .sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
}

export async function findPostBySlug(slug) {
  const filenames = await loadManifest();
  const match = filenames.find((filename) => slugFromFilename(filename) === slug);
  if (!match) return null;
  return loadPost(match);
}
