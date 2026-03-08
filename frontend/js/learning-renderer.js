/**
 * Learning Renderer - Renders courses into #learning-progress-container
 * Depends on: learningService, loadCourses (global)
 */

/**
 * Render learning courses in the UI
 * @param {Array} courses - Array of course objects from database
 */
function renderCourses(courses) {
    const container = document.getElementById('learning-progress-container');
    if (!container) return;

    if (!courses || courses.length === 0) {
        container.innerHTML = getCoursesEmptyStateHTML();
        return;
    }

    container.innerHTML = courses.map(course => getCourseHTML(course)).join('');
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Generate HTML for a single course card
 * @param {object} course - Course object { id, title, description, progress, current_chapter, total_chapters, ... }
 * @returns {string} HTML string
 */
function getCourseHTML(course) {
    const titleSafe = escapeHtml(course.title || 'Untitled Course');
    const progress = course.progress || 0;
    const currentChapter = course.current_chapter || '';
    const totalChapters = course.total_chapters || 0;
    const type = course.type || 'course';

    // Icon based on type
    let icon = '';
    if (type === 'course') {
        icon = '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>';
    } else if (type === 'book') {
        icon = '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>';
    } else {
        icon = '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>';
    }

    return `
        <div class="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group" data-course-id="${escapeHtml(course.id)}">
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-start gap-3 flex-1">
                    <div class="w-8 h-8 rounded-lg bg-learn/20 text-learn flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${icon}
                        </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-medium text-white truncate">${titleSafe}</h4>
                        ${currentChapter ? `<p class="text-xs text-gray-400 mt-0.5 truncate">${escapeHtml(currentChapter)}</p>` : ''}
                    </div>
                </div>
                <button type="button" onclick="event.stopPropagation(); deleteCourse('${escapeHtml(course.id)}')"
                        class="p-1.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Hapus kursus">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            <div class="space-y-1.5">
                <div class="flex justify-between text-xs text-gray-400">
                    <span>${totalChapters > 0 ? `${Math.round(progress * totalChapters / 100)} / ${totalChapters} chapters` : 'Progress'}</span>
                    <span>${progress}%</span>
                </div>
                <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-learn to-learn-light transition-all" style="width: ${progress}%"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for empty state
 * @returns {string} HTML string
 */
function getCoursesEmptyStateHTML() {
    return `
        <div class="glass rounded-xl p-8 text-center border border-white/5">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-400">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">Belum ada kursus</h3>
            <p class="text-sm text-gray-400 mb-4">Tambahkan kursus atau buku yang sedang Anda pelajari.</p>
            <button type="button" onclick="typeof showCreateCourseModal === 'function' && showCreateCourseModal()"
                    class="px-4 py-2 rounded-lg bg-learn hover:bg-learn-dark transition-colors text-sm font-medium inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Tambah Kursus
            </button>
        </div>
    `;
}
