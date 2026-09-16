/**
 * ==========================================================================
 * My Tasks - State Management & Storage Logic
 * ==========================================================================
 */

// 1. 상태 변수
let todos = [];
let projects = [];

// 뷰 상태 변수
let currentMainView = 'todos'; // 'todos' | 'projects' | 'all'
let activityViewMode = 'month'; // 'month' (디폴트) | 'day' | 'year'
let activityYear = new Date().getFullYear();
let activityMonth = new Date().getMonth() + 1; // 1 ~ 12
let selectedDateFilter = null; // 'YYYY.MM.DD' 또는 'YYYY.MM' 등
let currentMemoTodoId = null;  // 현재 메모 모달에서 작업 중인 Todo ID

// 프로젝트 아코디언 및 관리 메뉴 상태 변수
let expandedProjectIds = new Set(); // 펼쳐진 프로젝트 ID 집합 (디폴트는 비어있음 -> 모두 접힘)
let activeManageDropdownId = null;  // 현재 열려 있는 [관리] 드롭다운 프로젝트 ID
let editingProjectId = null;        // 현재 수정 중인 프로젝트 ID (null이면 생성 모드)

/* ==========================================================================
   Storage 함수
   ========================================================================== */

function saveTodos() {
  try {
    localStorage.setItem('todos', JSON.stringify(todos));
  } catch (error) {
    console.error('Todos 저장 중 오류 발생:', error);
  }
}

function loadTodos() {
  try {
    const rawData = localStorage.getItem('todos');
    if (!rawData) return [];
    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch (error) {
    console.error('Todos 파싱 오류 발생, 빈 배열을 반환합니다:', error);
    return [];
  }
}

function saveProjects() {
  try {
    localStorage.setItem('projects', JSON.stringify(projects));
  } catch (error) {
    console.error('Projects 저장 중 오류 발생:', error);
  }
}

function loadProjects() {
  try {
    const rawData = localStorage.getItem('projects');
    if (!rawData) return [];
    const parsedData = JSON.parse(rawData);
    if (!Array.isArray(parsedData)) return [];

    // 카테고리 데이터 구조 정규화 (하위 호환성 유지)
    return parsedData.map(proj => {
      if (Array.isArray(proj.categories)) {
        proj.categories = proj.categories.map(cat => {
          if (typeof cat === 'string') {
            const parts = cat.split('>').map(s => s.trim());
            return {
              major: parts[0] || '일반 작업',
              sub: parts[1] || ''
            };
          }
          return {
            major: cat.major || '일반 작업',
            sub: cat.sub || ''
          };
        });
      } else {
        proj.categories = [{ major: '일반 작업', sub: '' }];
      }
      return proj;
    });
  } catch (error) {
    console.error('Projects 파싱 오류 발생, 빈 배열을 반환합니다:', error);
    return [];
  }
}

/* ==========================================================================
   비즈니스 로직 (CRUD 및 프로젝트 관리)
   ========================================================================== */

function addTodo(content, category = 'personal', dueDate = '', projectId = null, projectCategory = '') {
  if (!content || !content.trim()) return null;

  const newTodo = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    content: content.trim(),
    category: category,
    dueDate: dueDate ? dueDate.trim() : '',
    projectId: projectId ? Number(projectId) : null,
    projectCategory: projectCategory ? projectCategory.trim() : '',
    createdAt: new Date().toISOString(),
    completedAt: null,
    memo: '',
    isCompleted: false
  };

  todos.push(newTodo);
  saveTodos();
  return newTodo;
}

function deleteTodo(id, askConfirm = true) {
  if (askConfirm && !confirm('정말 이 할 일을 삭제하시겠습니까?')) {
    return false;
  }

  const targetId = Number(id);
  const initialLength = todos.length;
  todos = todos.filter(todo => todo.id !== targetId);

  if (todos.length !== initialLength) {
    saveTodos();
    return true;
  }
  return false;
}

function toggleTodoStatus(id) {
  const targetId = Number(id);
  const targetTodo = todos.find(todo => todo.id === targetId);
  if (!targetTodo) return null;

  targetTodo.isCompleted = !targetTodo.isCompleted;
  targetTodo.completedAt = targetTodo.isCompleted ? new Date().toISOString() : null;

  saveTodos();
  return targetTodo;
}

function updateTodo(id, newContent) {
  if (!newContent || !newContent.trim()) return null;

  const targetId = Number(id);
  const targetTodo = todos.find(todo => todo.id === targetId);
  if (!targetTodo) return null;

  targetTodo.content = newContent.trim();
  saveTodos();
  return targetTodo;
}

function updateTodoMemo(id, memoText) {
  const targetId = Number(id);
  const targetTodo = todos.find(todo => todo.id === targetId);
  if (!targetTodo) return false;

  targetTodo.memo = (memoText || '').trim();
  saveTodos();
  return true;
}

/**
 * 새 프로젝트 생성
 */
function addProject(title, overview, categories) {
  if (!title || !title.trim()) return null;

  const newProject = {
    id: Date.now(),
    title: title.trim(),
    overview: (overview || '').trim(),
    categories: Array.isArray(categories) && categories.length > 0 ? categories : [{ major: '일반 작업', sub: '' }],
    createdAt: new Date().toISOString()
  };

  projects.push(newProject);
  saveProjects();
  return newProject;
}

/**
 * 기존 프로젝트 수정 (프로젝트명, 개요, 대분류/중분류)
 */
function updateProject(projectId, title, overview, categories) {
  const targetId = Number(projectId);
  const project = projects.find(p => p.id === targetId);
  if (!project) return false;

  project.title = title.trim();
  project.overview = (overview || '').trim();
  project.categories = Array.isArray(categories) && categories.length > 0 ? categories : [{ major: '일반 작업', sub: '' }];

  saveProjects();
  return true;
}

function deleteProject(projectId) {
  if (!confirm('정말 이 프로젝트를 삭제하시겠습니까?\n포함된 하위 할 일들도 함께 삭제됩니다.')) {
    return false;
  }

  const targetId = Number(projectId);
  projects = projects.filter(p => p.id !== targetId);
  todos = todos.filter(t => t.projectId !== targetId);
  expandedProjectIds.delete(targetId);

  saveProjects();
  saveTodos();
  return true;
}

/* ==========================================================================
   날짜 유틸리티
   ========================================================================== */

function formatDateOnly(isoOrDateStr) {
  if (!isoOrDateStr) return '';
  const d = new Date(isoOrDateStr);
  if (isNaN(d.getTime())) return isoOrDateStr;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function getDDayInfo(dueDateStr) {
  if (!dueDateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  if (isNaN(due.getTime())) return null;

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `기한 초과 (${Math.abs(diffDays)}일 전)`, className: 'overdue' };
  } else if (diffDays === 0) {
    return { label: '오늘 마감 (D-Day)', className: 'today' };
  } else {
    return { label: `D-${diffDays}`, className: 'normal' };
  }
}

/* ==========================================================================
   키워드 기반 자동 카테고리 분류
   ========================================================================== */
const CATEGORY_KEYWORDS = {
  work: [
    '회의', '보고', '보고서', '미팅', '업무', '프로젝트', '발표', '기획', '메일', '이메일',
    '개발', '코딩', '검토', '작업', '문서', '고객', '출장', '일정', 'jira', '지라',
    'slack', '슬랙', 'pr', '커밋', '마감', '스프린트', '배포', '테스트', '버그', '이슈',
    '과제', '기안', '결재', '클라이언트', '협의', '세미나', '워크숍', '면접'
  ],
  personal: [
    '운동', '헬스', 'pt', '장보기', '쇼핑', '마트', '병원', '진료', '청소', '빨래',
    '독서', '책', '공부', '취미', '친구', '가족', '부모님', '식사', '밥', '점심', '저녁',
    '약', '영양제', '여행', '휴식', '산책', '영화', '드라마', '요리', '은행', '적금',
    '생일', '선물', '카페', '커피', '데이트', '청구서', '세탁'
  ]
};

function classifyCategoryByKeyword(text) {
  if (!text || typeof text !== 'string') return null;
  const lowerText = text.toLowerCase();

  const isWork = CATEGORY_KEYWORDS.work.some(keyword => lowerText.includes(keyword.toLowerCase()));
  if (isWork) return 'work';

  const isPersonal = CATEGORY_KEYWORDS.personal.some(keyword => lowerText.includes(keyword.toLowerCase()));
  if (isPersonal) return 'personal';

  return null;
}

/* ==========================================================================
   DOM 렌더링 로직
   ========================================================================== */

/**
 * 할 일 <li> 엘리먼트 생성 (XSS 방지 API)
 */
function createTodoListItem(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item';
  li.dataset.id = todo.id;
  if (todo.isCompleted) li.classList.add('completed');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked = Boolean(todo.isCompleted);

  const todoMain = document.createElement('div');
  todoMain.className = 'todo-main';

  const textSpan = document.createElement('span');
  textSpan.className = 'todo-text';
  textSpan.textContent = todo.content;
  textSpan.title = '클릭하여 세부 진행 메모를 확인/작성하세요';

  const metaWrap = document.createElement('div');
  metaWrap.className = 'todo-meta';

  if (todo.projectId) {
    const proj = projects.find(p => p.id === todo.projectId);
    const projBadge = document.createElement('span');
    projBadge.className = 'badge-project-tag';
    projBadge.textContent = `🚀 ${proj ? proj.title : '프로젝트'}${todo.projectCategory ? ` > ${todo.projectCategory}` : ''}`;
    metaWrap.appendChild(projBadge);
  }

  const createdSpan = document.createElement('span');
  createdSpan.className = 'meta-created';
  createdSpan.textContent = `등록: ${formatDateOnly(todo.createdAt)}`;
  metaWrap.appendChild(createdSpan);

  if (todo.dueDate) {
    const dueSpan = document.createElement('span');
    dueSpan.className = 'meta-due';
    dueSpan.textContent = `마감: ${formatDateOnly(todo.dueDate)}`;
    metaWrap.appendChild(dueSpan);

    const ddayInfo = getDDayInfo(todo.dueDate);
    if (ddayInfo) {
      const ddayBadge = document.createElement('span');
      ddayBadge.className = `badge-dday ${ddayInfo.className}`;
      ddayBadge.textContent = ddayInfo.label;
      metaWrap.appendChild(ddayBadge);
    }
  }

  if (todo.memo && todo.memo.trim()) {
    const memoBadge = document.createElement('span');
    memoBadge.className = 'badge-memo';
    memoBadge.textContent = '📝 메모 있음';
    metaWrap.appendChild(memoBadge);
  }

  todoMain.appendChild(textSpan);
  todoMain.appendChild(metaWrap);

  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'todo-actions';

  const categoryBadge = document.createElement('span');
  categoryBadge.className = `badge badge-${todo.category === 'work' ? 'work' : 'personal'}`;
  categoryBadge.textContent = todo.category === 'work' ? '업무' : '개인';

  const memoBtn = document.createElement('button');
  memoBtn.type = 'button';
  memoBtn.className = 'memo-btn';
  memoBtn.textContent = '메모';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'edit-btn';
  editBtn.textContent = '수정';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '삭제';

  actionsWrap.appendChild(categoryBadge);
  actionsWrap.appendChild(memoBtn);
  actionsWrap.appendChild(editBtn);
  actionsWrap.appendChild(deleteBtn);

  li.appendChild(checkbox);
  li.appendChild(todoMain);
  li.appendChild(actionsWrap);

  return li;
}

/**
 * 데일리 및 전체 할 일 목록 렌더링
 */
function renderTodos() {
  const todoList = document.getElementById('todo-list');
  const listTitle = document.getElementById('list-title');
  const listFilterStatus = document.getElementById('list-filter-status');
  const listCountBadge = document.getElementById('list-count-badge');
  if (!todoList) return;

  todoList.replaceChildren();

  let displayTodos = todos;
  if (currentMainView === 'todos') {
    if (listTitle) listTitle.textContent = '데일리 할 일 목록';
    displayTodos = todos.filter(t => !t.projectId);
  } else if (currentMainView === 'all') {
    if (listTitle) listTitle.textContent = '전체 할 일 모아보기';
    displayTodos = todos;
  }

  if (selectedDateFilter) {
    displayTodos = displayTodos.filter(todo => {
      const createdDate = formatDateOnly(todo.createdAt);
      const completedDate = todo.completedAt ? formatDateOnly(todo.completedAt) : '';
      return (
        createdDate === selectedDateFilter ||
        completedDate === selectedDateFilter ||
        createdDate.startsWith(selectedDateFilter)
      );
    });

    if (listFilterStatus) {
      listFilterStatus.textContent = `📅 ${selectedDateFilter} 필터 적용 중`;
    }
  } else {
    if (listFilterStatus) listFilterStatus.textContent = '';
  }

  if (listCountBadge) {
    listCountBadge.textContent = `${displayTodos.length}개 항목`;
  }

  if (displayTodos.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-message';
    emptyLi.textContent = selectedDateFilter
      ? `${selectedDateFilter}에 해당하는 할 일이 없습니다 🐣`
      : '등록된 할 일이 없습니다. 새로운 할 일을 추가해보세요 ✨';
    todoList.appendChild(emptyLi);
    return;
  }

  displayTodos.forEach(todo => {
    const li = createTodoListItem(todo);
    todoList.appendChild(li);
  });
}

/**
 * 장기 프로젝트 뷰 렌더링 (아코디언 접기/펼치기 & [관리] 메뉴 & 대/중분류 계층)
 */
function renderProjects() {
  const projectsList = document.getElementById('projects-list');
  const listTitle = document.getElementById('list-title');
  const listCountBadge = document.getElementById('list-count-badge');
  if (!projectsList) return;

  projectsList.replaceChildren();

  if (listTitle) listTitle.textContent = '장기 프로젝트 관리 🚀';
  if (listCountBadge) listCountBadge.textContent = `${projects.length}개 프로젝트`;

  if (projects.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-message';
    emptyDiv.textContent = '아직 등록된 프로젝트가 없습니다. 상단의 "+ 새 프로젝트 만들기" 버튼으로 장기 프로젝트를 시작해보세요 🎨';
    projectsList.appendChild(emptyDiv);
    return;
  }

  projects.forEach(project => {
    const isExpanded = expandedProjectIds.has(project.id); // 디폴트: false (접힘)

    const projectCard = document.createElement('div');
    projectCard.className = `project-card ${isExpanded ? 'expanded' : ''}`;
    projectCard.dataset.projectId = project.id;

    // 해당 프로젝트 하위 태스크 집계
    const projectTasks = todos.filter(t => t.projectId === project.id);
    const completedTasks = projectTasks.filter(t => t.isCompleted);
    const progressPercent = projectTasks.length === 0 ? 0 : Math.round((completedTasks.length / projectTasks.length) * 100);

    // 1. 프로젝트 헤더 (클릭 시 아코디언 토글)
    const header = document.createElement('div');
    header.className = 'project-header';

    const titleBox = document.createElement('div');
    titleBox.className = 'project-title-box';

    const titleRow = document.createElement('div');
    titleRow.className = 'project-title-row';

    const title = document.createElement('h3');
    title.className = 'project-title';
    title.textContent = `🚀 ${project.title}`;

    titleRow.appendChild(title);

    const overview = document.createElement('p');
    overview.className = 'project-overview';
    overview.textContent = project.overview || '개요가 작성되지 않았습니다.';

    titleBox.appendChild(titleRow);
    titleBox.appendChild(overview);

    const headerRight = document.createElement('div');
    headerRight.className = 'project-header-right';

    // 진행률 게이지
    const progWrap = document.createElement('div');
    progWrap.className = 'project-progress-wrap';

    const progBar = document.createElement('div');
    progBar.className = 'project-progress-bar';
    const progFill = document.createElement('div');
    progFill.className = 'project-progress-fill';
    progFill.style.width = `${progressPercent}%`;
    progBar.appendChild(progFill);

    const progText = document.createElement('span');
    progText.className = 'project-progress-text';
    progText.textContent = `${progressPercent}% (${completedTasks.length}/${projectTasks.length})`;

    progWrap.appendChild(progBar);
    progWrap.appendChild(progText);

    // 아코디언 토글 버튼
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'accordion-toggle-btn';
    toggleBtn.textContent = isExpanded ? '🔼 접기' : '🔽 펼치기';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProjectAccordion(project.id);
    });

    // [관리 ⚙️] 드롭다운 버튼 & 메뉴
    const manageWrap = document.createElement('div');
    manageWrap.className = 'project-manage-wrap';

    const manageBtn = document.createElement('button');
    manageBtn.type = 'button';
    manageBtn.className = 'manage-btn';
    manageBtn.textContent = '관리 ⚙️';

    const manageDropdown = document.createElement('div');
    manageDropdown.className = `manage-dropdown ${activeManageDropdownId === project.id ? '' : 'hidden'}`;

    const editItem = document.createElement('button');
    editItem.type = 'button';
    editItem.className = 'manage-item';
    editItem.innerHTML = '✏️ 프로젝트 수정';
    editItem.addEventListener('click', (e) => {
      e.stopPropagation();
      activeManageDropdownId = null;
      openProjectModal(project.id);
    });

    const delItem = document.createElement('button');
    delItem.type = 'button';
    delItem.className = 'manage-item delete';
    delItem.innerHTML = '🗑️ 프로젝트 삭제';
    delItem.addEventListener('click', (e) => {
      e.stopPropagation();
      activeManageDropdownId = null;
      if (deleteProject(project.id)) render();
    });

    manageDropdown.appendChild(editItem);
    manageDropdown.appendChild(delItem);

    manageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeManageDropdownId = activeManageDropdownId === project.id ? null : project.id;
      render();
    });

    manageWrap.appendChild(manageBtn);
    manageWrap.appendChild(manageDropdown);

    headerRight.appendChild(progWrap);
    headerRight.appendChild(toggleBtn);
    headerRight.appendChild(manageWrap);

    header.appendChild(titleBox);
    header.appendChild(headerRight);

    // 헤더 자체 클릭 시 아코디언 토글
    header.addEventListener('click', () => {
      toggleProjectAccordion(project.id);
    });

    projectCard.appendChild(header);

    // 2. 프로젝트 본문 (아코디언 펼쳐질 때만 표시)
    const projectBody = document.createElement('div');
    projectBody.className = `project-body ${isExpanded ? '' : 'collapsed'}`;

    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'project-sections-container';

    project.categories.forEach(catObj => {
      const majorName = catObj.major || '일반 작업';
      const subName = catObj.sub || '';
      const categoryDisplayName = subName ? `${majorName} > ${subName}` : majorName;

      const section = document.createElement('div');
      section.className = 'project-section';

      const secHeader = document.createElement('div');
      secHeader.className = 'section-header';

      const secName = document.createElement('h4');
      secName.className = 'section-name';
      secName.innerHTML = `📌 ${majorName}`;
      if (subName) {
        const subTag = document.createElement('span');
        subTag.className = 'sub-tag';
        subTag.textContent = `🏷️ ${subName}`;
        secName.appendChild(subTag);
      }

      // 하위 작업 필터링 (정확한 카테고리 매칭 또는 하위 호환)
      const secTasks = projectTasks.filter(t => {
        return (
          t.projectCategory === categoryDisplayName ||
          t.projectCategory === majorName ||
          (subName && t.projectCategory === subName)
        );
      });

      const secCount = document.createElement('span');
      secCount.className = 'task-stats';
      secCount.textContent = `${secTasks.filter(t => t.isCompleted).length} / ${secTasks.length} 완료`;

      secHeader.appendChild(secName);
      secHeader.appendChild(secCount);
      section.appendChild(secHeader);

      const tasksUl = document.createElement('ul');
      tasksUl.className = 'section-tasks-list';

      secTasks.forEach(task => {
        const taskLi = createTodoListItem(task);
        tasksUl.appendChild(taskLi);
      });

      section.appendChild(tasksUl);

      // 인라인 태스크 추가 폼
      const inlineForm = document.createElement('form');
      inlineForm.className = 'inline-task-form';
      inlineForm.onsubmit = (e) => {
        e.preventDefault();
        const input = inlineForm.querySelector('.inline-task-input');
        const dateInput = inlineForm.querySelector('.inline-task-date');
        const text = input.value.trim();
        if (!text) return;

        addTodo(text, 'work', dateInput ? dateInput.value : '', project.id, categoryDisplayName);
        input.value = '';
        render();
      };

      const taskInput = document.createElement('input');
      taskInput.type = 'text';
      taskInput.className = 'inline-task-input';
      taskInput.placeholder = `[${categoryDisplayName}]에 새 일일 작업 추가...`;

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'inline-task-date';
      dateInput.title = '마감 시한';

      const addBtn = document.createElement('button');
      addBtn.type = 'submit';
      addBtn.className = 'inline-task-btn';
      addBtn.textContent = '+ 추가';

      inlineForm.appendChild(taskInput);
      inlineForm.appendChild(dateInput);
      inlineForm.appendChild(addBtn);

      section.appendChild(inlineForm);
      sectionsContainer.appendChild(section);
    });

    projectBody.appendChild(sectionsContainer);
    projectCard.appendChild(projectBody);

    projectsList.appendChild(projectCard);
  });
}

/**
 * 아코디언 토글 함수
 */
function toggleProjectAccordion(projectId) {
  const targetId = Number(projectId);
  if (expandedProjectIds.has(targetId)) {
    expandedProjectIds.delete(targetId);
  } else {
    expandedProjectIds.add(targetId);
  }
  render();
}

/**
 * 진행률 바 및 통계 업데이트
 */
function updateProgress() {
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  const taskStats = document.getElementById('task-stats');

  const totalCount = todos.length;
  const completedCount = todos.filter(todo => todo.isCompleted).length;
  const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
  if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
  if (taskStats) taskStats.textContent = `${completedCount} / ${totalCount} 완료`;
}

/**
 * 사이드바 연/월/일 활동 기록 렌더링 (디폴트: 해당 월 이력)
 */
function renderDailyActivities() {
  const activityList = document.getElementById('daily-activity-list');
  const periodLabel = document.getElementById('activity-period-label');
  if (!activityList) return;

  activityList.replaceChildren();

  if (periodLabel) {
    if (activityViewMode === 'year') {
      periodLabel.textContent = `${activityYear}년 🌟`;
    } else if (activityViewMode === 'month') {
      periodLabel.textContent = `${activityYear}년 ${activityMonth}월 🗓️`;
    } else if (activityViewMode === 'day') {
      periodLabel.textContent = `${activityYear}년 ${activityMonth}월 전체 일자 📅`;
    }
  }

  const chips = document.querySelectorAll('.cute-chip');
  chips.forEach(chip => {
    if (chip.dataset.mode === activityViewMode) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  const activityMap = {};

  todos.forEach(todo => {
    const createdDate = formatDateOnly(todo.createdAt);
    if (!createdDate) return;

    const [year, month, day] = createdDate.split('.');
    const itemYear = Number(year);
    const itemMonth = Number(month);

    let key = createdDate;

    if (activityViewMode === 'year') {
      if (itemYear !== activityYear) return;
      key = `${year}.${month}월`;
    } else if (activityViewMode === 'month') {
      if (itemYear !== activityYear || itemMonth !== activityMonth) return;
      key = `${year}.${month}.${day}`;
    } else if (activityViewMode === 'day') {
      key = `${year}.${month}.${day}`;
    }

    if (!activityMap[key]) {
      activityMap[key] = { created: 0, completed: 0, rawKey: key };
    }
    activityMap[key].created += 1;

    if (todo.isCompleted && todo.completedAt) {
      activityMap[key].completed += 1;
    }
  });

  const keys = Object.keys(activityMap).sort((a, b) => b.localeCompare(a));

  if (keys.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'activity-desc';
    emptyItem.textContent = `${periodLabel ? periodLabel.textContent : ''} 기간에 활동 기록이 없어요 🐣`;
    activityList.appendChild(emptyItem);
    return;
  }

  keys.forEach(key => {
    const data = activityMap[key];
    const li = document.createElement('li');
    li.className = 'daily-item';
    if (selectedDateFilter === key || (activityViewMode === 'year' && selectedDateFilter && selectedDateFilter.startsWith(key.replace('월', '')))) {
      li.classList.add('active');
    }

    const dateSpan = document.createElement('span');
    dateSpan.className = 'daily-date';
    dateSpan.textContent = key;

    const countsDiv = document.createElement('div');
    countsDiv.className = 'daily-counts';

    const tagCreate = document.createElement('span');
    tagCreate.className = 'tag-create';
    tagCreate.textContent = `🐣 등록 ${data.created}`;

    const tagComplete = document.createElement('span');
    tagComplete.className = 'tag-complete';
    tagComplete.textContent = `✨ 완료 ${data.completed}`;

    countsDiv.appendChild(tagCreate);
    countsDiv.appendChild(tagComplete);

    li.appendChild(dateSpan);
    li.appendChild(countsDiv);

    li.addEventListener('click', () => {
      let filterTarget = key;
      if (activityViewMode === 'year') {
        filterTarget = key.replace('월', '');
      }

      if (selectedDateFilter === filterTarget) {
        selectedDateFilter = null;
      } else {
        selectedDateFilter = filterTarget;
      }
      render();
    });

    activityList.appendChild(li);
  });
}

function updateProjectSelectOptions() {
  const projectSelect = document.getElementById('todo-project-select');
  if (!projectSelect) return;

  const currentVal = projectSelect.value;
  projectSelect.innerHTML = '<option value="">일반 단독 할 일 (프로젝트 없음)</option>';

  projects.forEach(proj => {
    const option = document.createElement('option');
    option.value = proj.id;
    option.textContent = `🚀 ${proj.title}`;
    projectSelect.appendChild(option);
  });

  projectSelect.value = currentVal;
}

function render() {
  updateProjectSelectOptions();

  const todosViewContainer = document.getElementById('todos-view-container');
  const projectsViewContainer = document.getElementById('projects-view-container');
  const openProjectModalBtn = document.getElementById('open-project-modal-btn');

  const tabBtns = document.querySelectorAll('.view-tab-btn');
  tabBtns.forEach(btn => {
    if (btn.dataset.view === currentMainView) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (currentMainView === 'projects') {
    if (todosViewContainer) todosViewContainer.classList.add('hidden');
    if (projectsViewContainer) projectsViewContainer.classList.remove('hidden');
    if (openProjectModalBtn) openProjectModalBtn.classList.remove('hidden');
    renderProjects();
  } else {
    if (todosViewContainer) todosViewContainer.classList.remove('hidden');
    if (projectsViewContainer) projectsViewContainer.classList.add('hidden');
    if (openProjectModalBtn) openProjectModalBtn.classList.add('hidden');
    renderTodos();
  }

  updateProgress();
  renderDailyActivities();
}

/* ==========================================================================
   동적 대분류/중분류 입력 행 관리 로직 (생성 & 수정 모달 공용)
   ========================================================================== */

function addCategoryInputRow(majorValue = '', subValue = '', majorPlaceholder = '', subPlaceholder = '') {
  const container = document.getElementById('category-rows-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'category-input-row';

  const majorInput = document.createElement('input');
  majorInput.type = 'text';
  majorInput.className = 'major-cat-input';
  majorInput.placeholder = majorPlaceholder || '(예시) 대분류 (필수 📌)';
  majorInput.value = majorValue;

  const subInput = document.createElement('input');
  subInput.type = 'text';
  subInput.className = 'sub-cat-input';
  subInput.placeholder = subPlaceholder || '(예시) 중분류 (선택 🏷️)';
  subInput.value = subValue;

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'del-row-btn';
  delBtn.textContent = '❌';
  delBtn.title = '이 분류 삭제';
  delBtn.addEventListener('click', () => {
    const allRows = container.querySelectorAll('.category-input-row');
    if (allRows.length <= 1) {
      alert('최소 1개 이상의 대분류 행이 필요합니다.');
      return;
    }
    row.remove();
  });

  row.appendChild(majorInput);
  row.appendChild(subInput);
  row.appendChild(delBtn);

  container.appendChild(row);
}

function getCategoriesFromInputRows() {
  const container = document.getElementById('category-rows-container');
  if (!container) return [];

  const rows = container.querySelectorAll('.category-input-row');
  const categories = [];

  rows.forEach(row => {
    const majorInput = row.querySelector('.major-cat-input');
    const subInput = row.querySelector('.sub-cat-input');

    const major = majorInput ? majorInput.value.trim() : '';
    const sub = subInput ? subInput.value.trim() : '';

    if (major) {
      categories.push({ major, sub });
    }
  });

  return categories;
}

/* ==========================================================================
   메모 모달 & 프로젝트 모달 제어
   ========================================================================== */

function openMemoModal(id) {
  const targetId = Number(id);
  const targetTodo = todos.find(todo => todo.id === targetId);
  if (!targetTodo) return;

  currentMemoTodoId = targetId;

  const modal = document.getElementById('memo-modal');
  const contentElem = document.getElementById('modal-todo-content');
  const createdElem = document.getElementById('modal-todo-created');
  const dueElem = document.getElementById('modal-todo-due');
  const textarea = document.getElementById('memo-textarea');

  if (contentElem) contentElem.textContent = targetTodo.content;
  if (createdElem) createdElem.textContent = `등록: ${formatDateOnly(targetTodo.createdAt)}`;
  if (dueElem) {
    dueElem.textContent = targetTodo.dueDate ? `마감: ${formatDateOnly(targetTodo.dueDate)}` : '마감일 없음';
  }
  if (textarea) textarea.value = targetTodo.memo || '';

  if (modal) {
    modal.classList.remove('hidden');
    setTimeout(() => { if (textarea) textarea.focus(); }, 50);
  }
}

function closeMemoModal() {
  const modal = document.getElementById('memo-modal');
  if (modal) modal.classList.add('hidden');
  currentMemoTodoId = null;
}

/**
 * 프로젝트 모달 열기 (projectId가 있으면 '수정 모드', 없으면 '생성 모드')
 */
function openProjectModal(projectId = null) {
  editingProjectId = projectId ? Number(projectId) : null;

  const modal = document.getElementById('project-modal');
  const modalTitle = document.getElementById('project-modal-title');
  const submitBtn = document.getElementById('project-modal-submit-btn');
  const titleInput = document.getElementById('project-title-input');
  const overviewInput = document.getElementById('project-overview-input');
  const container = document.getElementById('category-rows-container');

  if (!modal || !container) return;

  container.replaceChildren();

  if (editingProjectId) {
    // 1. 프로젝트 수정 모드
    const proj = projects.find(p => p.id === editingProjectId);
    if (!proj) return;

    if (modalTitle) modalTitle.textContent = '프로젝트 정보 수정 ✏️';
    if (submitBtn) submitBtn.textContent = '수정 완료 💾';
    if (titleInput) titleInput.value = proj.title;
    if (overviewInput) overviewInput.value = proj.overview || '';

    // 기존 대/중분류 행 채우기 (수정 모드는 실제 값 유지)
    if (Array.isArray(proj.categories) && proj.categories.length > 0) {
      proj.categories.forEach(cat => addCategoryInputRow(cat.major, cat.sub, '(예시) 대분류 (필수 📌)', '(예시) 중분류 (선택 🏷️)'));
    } else {
      addCategoryInputRow('일반 작업', '', '(예시) 대분류 (필수 📌)', '(예시) 중분류 (선택 🏷️)');
    }
  } else {
    // 2. 새 프로젝트 생성 모드
    if (modalTitle) modalTitle.textContent = '새 장기 프로젝트 생성 🚀';
    if (submitBtn) submitBtn.textContent = '프로젝트 생성 ✨';
    if (titleInput) titleInput.value = '';
    if (overviewInput) overviewInput.value = '';

    // 대분류/중분류 디폴트 예시 행 배치: value는 비어있고 placeholder에 회색 (예시)로 노출 -> 타이핑 시작 시 자동 소멸
    addCategoryInputRow('', '', '(예시) 기획 및 설계', '(예시) 화면 기획');
    addCategoryInputRow('', '', '(예시) 개발 및 구현', '(예시) 핵심 기능');
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    if (titleInput) titleInput.focus();
  }, 50);
}

function closeProjectModal() {
  const modal = document.getElementById('project-modal');
  if (modal) modal.classList.add('hidden');
  editingProjectId = null;
}

/* ==========================================================================
   인라인 수정 모드 (할 일)
   ========================================================================== */

function enterEditMode(li, editBtn) {
  const textSpan = li.querySelector('.todo-text');
  if (!textSpan) return;

  const currentText = textSpan.textContent;
  const editInput = document.createElement('input');
  editInput.type = 'text';
  editInput.className = 'edit-input';
  editInput.value = currentText;

  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEdit(li);
    else if (e.key === 'Escape') render();
  });

  textSpan.replaceWith(editInput);
  editBtn.textContent = '저장';
  editBtn.className = 'save-btn';
  editInput.focus();
}

function saveEdit(li) {
  const editInput = li.querySelector('.edit-input');
  if (!editInput) return;

  const newContent = editInput.value.trim();
  if (!newContent) {
    alert('수정할 내용을 입력해주세요.');
    editInput.focus();
    return;
  }

  const id = Number(li.dataset.id);
  updateTodo(id, newContent);
  render();
}

/* ==========================================================================
   이벤트 리스너 바인딩
   ========================================================================== */

function initEventListeners() {
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const categorySelect = document.getElementById('category-select');
  const dueDateInput = document.getElementById('due-date-input');
  const todoProjectSelect = document.getElementById('todo-project-select');
  const todoList = document.getElementById('todo-list');
  const resetFilterBtn = document.getElementById('reset-filter-btn');

  // 메모 모달
  const memoModal = document.getElementById('memo-modal');
  const memoCloseBtn = document.getElementById('modal-close-btn');
  const memoCancelBtn = document.getElementById('memo-cancel-btn');
  const memoSaveBtn = document.getElementById('memo-save-btn');
  const memoTextarea = document.getElementById('memo-textarea');

  // 프로젝트 모달 & 분류 추가 버튼
  const projectModal = document.getElementById('project-modal');
  const openProjectModalBtn = document.getElementById('open-project-modal-btn');
  const projectCloseBtn = document.getElementById('project-modal-close-btn');
  const projectCancelBtn = document.getElementById('project-cancel-btn');
  const projectForm = document.getElementById('project-form');
  const addCategoryRowBtn = document.getElementById('add-category-row-btn');

  // 기간 네비게이터 버튼
  const prevPeriodBtn = document.getElementById('prev-period-btn');
  const nextPeriodBtn = document.getElementById('next-period-btn');
  const todayPeriodBtn = document.getElementById('today-period-btn');

  // 1. 키워드 감지
  if (todoInput && categorySelect) {
    todoInput.addEventListener('input', () => {
      const detected = classifyCategoryByKeyword(todoInput.value);
      if (detected && categorySelect.value !== detected) {
        categorySelect.value = detected;
        categorySelect.classList.remove('auto-detected');
        void categorySelect.offsetWidth;
        categorySelect.classList.add('auto-detected');
      } else if (!todoInput.value.trim()) {
        categorySelect.classList.remove('auto-detected');
      }
    });
  }

  // 2. 새 할 일 폼 제출
  if (todoForm) {
    todoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const content = todoInput.value.trim();
      if (!content) {
        alert('할 일 내용을 입력해주세요.');
        todoInput.focus();
        return;
      }

      const autoCategory = classifyCategoryByKeyword(content);
      const finalCategory = autoCategory || categorySelect.value;
      const dueDate = dueDateInput ? dueDateInput.value : '';
      const projectId = todoProjectSelect && todoProjectSelect.value ? Number(todoProjectSelect.value) : null;

      addTodo(content, finalCategory, dueDate, projectId);

      todoInput.value = '';
      if (dueDateInput) dueDateInput.value = '';
      if (todoProjectSelect) todoProjectSelect.value = '';
      categorySelect.classList.remove('auto-detected');
      todoInput.focus();

      render();
    });
  }

  // 3. 일자별 활동 네비게이터
  if (prevPeriodBtn) {
    prevPeriodBtn.addEventListener('click', () => {
      if (activityViewMode === 'year') {
        activityYear -= 1;
      } else {
        activityMonth -= 1;
        if (activityMonth < 1) {
          activityMonth = 12;
          activityYear -= 1;
        }
      }
      renderDailyActivities();
    });
  }

  if (nextPeriodBtn) {
    nextPeriodBtn.addEventListener('click', () => {
      if (activityViewMode === 'year') {
        activityYear += 1;
      } else {
        activityMonth += 1;
        if (activityMonth > 12) {
          activityMonth = 1;
          activityYear += 1;
        }
      }
      renderDailyActivities();
    });
  }

  if (todayPeriodBtn) {
    todayPeriodBtn.addEventListener('click', () => {
      const now = new Date();
      activityYear = now.getFullYear();
      activityMonth = now.getMonth() + 1;
      selectedDateFilter = null;
      render();
    });
  }

  // 4. 연/월/일 필터 칩
  const filterChips = document.querySelectorAll('.cute-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      activityViewMode = chip.dataset.mode;
      renderDailyActivities();
    });
  });

  // 5. 전체 보기 필터 초기화
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      selectedDateFilter = null;
      render();
    });
  }

  // 6. 메인 뷰 전환 탭
  const viewTabs = document.querySelectorAll('.view-tab-btn');
  viewTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      currentMainView = btn.dataset.view;
      selectedDateFilter = null;
      activeManageDropdownId = null;
      render();
    });
  });

  // 7. 프로젝트 모달 & 동적 행 추가
  if (openProjectModalBtn) {
    openProjectModalBtn.addEventListener('click', () => openProjectModal(null));
  }
  if (projectCloseBtn) projectCloseBtn.addEventListener('click', closeProjectModal);
  if (projectCancelBtn) projectCancelBtn.addEventListener('click', closeProjectModal);

  if (addCategoryRowBtn) {
    addCategoryRowBtn.addEventListener('click', () => {
      addCategoryInputRow('', '', '(예시) 대분류 입력 (필수 📌)', '(예시) 중분류 입력 (선택 🏷️)');
    });
  }

  if (projectForm) {
    projectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('project-title-input');
      const overviewInput = document.getElementById('project-overview-input');

      const title = titleInput.value.trim();
      if (!title) {
        alert('프로젝트명을 입력해주세요.');
        titleInput.focus();
        return;
      }

      const categories = getCategoriesFromInputRows();
      if (categories.length === 0) {
        alert('최소 하나 이상의 대분류(필수)를 입력해주세요. (예: 기획 및 설계)');
        const firstMajor = document.querySelector('#category-rows-container .major-cat-input');
        if (firstMajor) firstMajor.focus();
        return;
      }

      if (editingProjectId) {
        updateProject(editingProjectId, title, overviewInput.value, categories);
      } else {
        const newProj = addProject(title, overviewInput.value, categories);
        if (newProj) {
          // 새로 만든 프로젝트는 자동으로 펼쳐서 보여줌
          expandedProjectIds.add(newProj.id);
        }
      }

      closeProjectModal();
      currentMainView = 'projects';
      render();
    });
  }

  // 8. 할 일 리스트 클릭 이벤트 위임
  if (todoList) {
    todoList.addEventListener('click', (e) => {
      handleTodoItemClick(e);
    });
  }

  const projectsList = document.getElementById('projects-list');
  if (projectsList) {
    projectsList.addEventListener('click', (e) => {
      handleTodoItemClick(e);
    });
  }

  function handleTodoItemClick(e) {
    const target = e.target;
    const li = target.closest('.todo-item');
    if (!li) return;

    const id = Number(li.dataset.id);

    if (target.classList.contains('todo-checkbox')) {
      toggleTodoStatus(id);
      render();
      return;
    }

    if (target.classList.contains('delete-btn')) {
      if (deleteTodo(id)) render();
      return;
    }

    if (target.classList.contains('edit-btn')) {
      enterEditMode(li, target);
      return;
    }

    if (target.classList.contains('save-btn')) {
      saveEdit(li);
      return;
    }

    if (
      target.classList.contains('memo-btn') ||
      target.classList.contains('todo-text') ||
      target.classList.contains('badge-memo')
    ) {
      openMemoModal(id);
      return;
    }
  }

  // 9. 메모 모달 이벤트
  if (memoSaveBtn) {
    memoSaveBtn.addEventListener('click', () => {
      if (currentMemoTodoId !== null && memoTextarea) {
        updateTodoMemo(currentMemoTodoId, memoTextarea.value);
        closeMemoModal();
        render();
      }
    });
  }

  if (memoCloseBtn) memoCloseBtn.addEventListener('click', closeMemoModal);
  if (memoCancelBtn) memoCancelBtn.addEventListener('click', closeMemoModal);

  // 10. 바깥 영역 클릭 처리 (모달 닫기 & 드롭다운 닫기)
  document.addEventListener('click', (e) => {
    // 관리 드롭다운 바깥 클릭 시 닫기
    if (activeManageDropdownId && !e.target.closest('.project-manage-wrap')) {
      activeManageDropdownId = null;
      render();
    }

    // 모달 오버레이 바깥 클릭 시 닫기
    if (memoModal && e.target === memoModal) closeMemoModal();
    if (projectModal && e.target === projectModal) closeProjectModal();
  });

  // ESC 키 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (memoModal && !memoModal.classList.contains('hidden')) closeMemoModal();
      if (projectModal && !projectModal.classList.contains('hidden')) closeProjectModal();
      if (activeManageDropdownId) {
        activeManageDropdownId = null;
        render();
      }
    }
  });
}

/* ==========================================================================
   앱 초기화
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  todos = loadTodos();
  projects = loadProjects();
  render();
  initEventListeners();
});
