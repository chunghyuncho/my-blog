import { loadAllPosts } from './posts.js';
import { initThemeToggle } from './theme.js';

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString ?? '';
  return dateFormatter.format(date);
}

function renderTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return '';
  const items = tags.map((tag) => `<li class="tag">${tag}</li>`).join('');
  return `<ul class="tag-list">${items}</ul>`;
}

function renderPostCard(post) {
  const { slug, data } = post;
  const description = data.description
    ? `<p class="post-card-description">${data.description}</p>`
    : '';

  return `
    <li class="post-card">
      <a class="post-card-link" href="post.html?slug=${encodeURIComponent(slug)}">
        <h2 class="post-card-title">${data.title ?? slug}</h2>
      </a>
      <p class="post-meta">${formatDate(data.date)}</p>
      ${description}
      ${renderTags(data.tags)}
    </li>
  `;
}

async function init() {
  initThemeToggle();

  const listEl = document.getElementById('post-list');
  if (!listEl) return;

  try {
    const posts = await loadAllPosts();
    if (posts.length === 0) {
      listEl.innerHTML = '<p class="empty-state">아직 게시글이 없습니다.</p>';
      return;
    }
    listEl.innerHTML = posts.map(renderPostCard).join('');
  } catch (err) {
    console.error(err);
    listEl.innerHTML =
      '<p class="empty-state">게시글을 불러오지 못했습니다. 로컬 서버(예: <code>python -m http.server</code>)로 이 페이지를 열었는지 확인해주세요.</p>';
  }
}

document.addEventListener('DOMContentLoaded', init);
