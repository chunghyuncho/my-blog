import { findPostBySlug } from './posts.js';
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

function renderNotFound(container) {
  container.innerHTML = `
    <div class="empty-state">
      <p>글을 찾을 수 없습니다.</p>
      <p><a href="index.html">← 목록으로 돌아가기</a></p>
    </div>
  `;
}

async function init() {
  initThemeToggle();

  const container = document.getElementById('post-container');
  if (!container) return;

  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    renderNotFound(container);
    return;
  }

  try {
    const post = await findPostBySlug(slug);
    if (!post) {
      renderNotFound(container);
      return;
    }

    const { data, content } = post;
    document.title = data.title ? `${data.title} — my-blog` : 'my-blog';

    container.innerHTML = `
      <header class="post-header">
        <h1>${data.title ?? slug}</h1>
        <p class="post-meta">${formatDate(data.date)}</p>
        ${renderTags(data.tags)}
      </header>
      <div id="post-content" class="post-content"></div>
      <p class="post-footer"><a href="index.html">← 목록으로 돌아가기</a></p>
    `;

    document.getElementById('post-content').innerHTML = marked.parse(content);
  } catch (err) {
    console.error(err);
    container.innerHTML =
      '<p class="empty-state">게시글을 불러오지 못했습니다. 로컬 서버(예: <code>python -m http.server</code>)로 이 페이지를 열었는지 확인해주세요.</p>';
  }
}

document.addEventListener('DOMContentLoaded', init);
