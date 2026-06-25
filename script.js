/* ============================================================
   script.js — Darren's Portfolio (v7)
   ============================================================
   1. Particle starfield
   2. Auto-year
   3. GitHub repo fetch → project cards
   4. Carousel drag + scroll wheel
   5. Menu open / close  (clip-path animation via CSS)
   6. showView()         (slide views left/right inside overlay)
   7. Music player
   8. Credits popup
   ============================================================ */


/* ============================================================
   1. PARTICLE STARFIELD
   ============================================================ */
const canvas = document.getElementById('particle-canvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const particles = Array.from({ length: 80 }, () => ({
  x:       Math.random() * window.innerWidth,
  y:       Math.random() * window.innerHeight,
  vx:      (Math.random() - 0.5) * 0.18,
  vy:      (Math.random() - 0.5) * 0.18,
  radius:  Math.random() * 1.2 + 0.3,
  opacity: Math.random() * 0.5 + 0.1,
}));

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0)             p.x = canvas.width;
    if (p.x > canvas.width)  p.x = 0;
    if (p.y < 0)             p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,200,255,${p.opacity})`;
    ctx.fill();
  });
  requestAnimationFrame(animateParticles);
}
animateParticles();


/* ============================================================
   2. AUTO-YEAR
   ============================================================ */
document.getElementById('year').textContent = new Date().getFullYear();


/* ============================================================
   3. GITHUB PROJECTS
   ============================================================ */
async function loadProjects() {
  const track  = document.getElementById('projects-track');
  const status = document.getElementById('projects-status');
  try {
    const res = await fetch(
      'https://api.github.com/users/renmadz/repos?sort=pushed&per_page=30'
    );
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const repos = await res.json();
    status.remove();
    if (!repos.length) {
      track.innerHTML = '<p class="projects-status">No public repositories found.</p>';
      return;
    }
    repos.forEach(repo => {
      const card = document.createElement('a');
      card.href = repo.html_url; card.target = '_blank'; card.rel = 'noopener';
      card.className = 'project-card';
      const name = repo.name.replace(/[-_]/g,' ').replace(/\b\w/g, c => c.toUpperCase());
      const desc = repo.description || 'No description provided.';
      const lang = repo.language  || '';
      card.innerHTML = `
        <span class="card-title">${name}</span>
        <span class="card-desc">${desc}</span>
        ${lang ? `<span class="card-lang">${lang}</span>` : ''}
      `;
      track.appendChild(card);
    });
  } catch (e) {
    status.textContent = 'Could not load repositories.';
    console.error(e);
  }
}
loadProjects();


/* ============================================================
   4. CAROUSEL — DRAG + SCROLL WHEEL
   ============================================================ */
const carousel  = document.getElementById('projects-carousel');
let isDragging  = false;
let dragStartX  = 0;
let scrollOrigin = 0;

carousel.addEventListener('mousedown', e => {
  isDragging   = true;
  dragStartX   = e.pageX - carousel.offsetLeft;
  scrollOrigin = carousel.scrollLeft;
  carousel.classList.add('grabbing');
});
carousel.addEventListener('mouseleave', () => { isDragging = false; carousel.classList.remove('grabbing'); });
carousel.addEventListener('mouseup',    () => { isDragging = false; carousel.classList.remove('grabbing'); });
carousel.addEventListener('mousemove',  e => {
  if (!isDragging) return;
  e.preventDefault();
  const x    = e.pageX - carousel.offsetLeft;
  const walk = (x - dragStartX) * 1.5;
  carousel.scrollLeft = scrollOrigin - walk;
});

/* Scroll wheel → horizontal */
carousel.addEventListener('wheel', e => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    carousel.scrollLeft += e.deltaY;
  }
}, { passive: false });


/* ============================================================
   5. MENU OPEN / CLOSE
   The animation lives in CSS (clip-path circle).
   JS just toggles .open on the overlay and .open on the button.
   ============================================================ */
const menuOverlay = document.getElementById('menu-overlay');
const menuBtn     = document.getElementById('menu-btn');
const shockwave   = document.getElementById('menu-shockwave');
let   menuIsOpen  = false;

function toggleMenu() {
  menuIsOpen ? closeMenu() : openMenu();
}

function openMenu() {
  menuIsOpen = true;

  /* Always reset to nav view when opening so users never land
     inside a content view from a previous session */
  resetToNav();

  menuBtn.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
  menuOverlay.classList.add('open');
  menuOverlay.removeAttribute('aria-hidden');

  /* Shockwave: remove first so re-opening re-triggers the animation */
  shockwave.classList.remove('pulse');
  requestAnimationFrame(() => requestAnimationFrame(() => shockwave.classList.add('pulse')));
}

function closeMenu() {
  menuIsOpen = false;
  menuOverlay.classList.remove('open');
  menuOverlay.setAttribute('aria-hidden', 'true');
  menuBtn.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  setTimeout(() => shockwave.classList.remove('pulse'), 700);
}

/* Force nav view visible, all others hidden — no animation */
function resetToNav() {
  document.querySelectorAll('.menu-view').forEach(v => {
    v.classList.remove('view-active', 'exit-left', 'exit-right', 'enter-left');
  });
  document.getElementById('view-nav').classList.add('view-active');
  currentView = 'nav';
}

window.toggleMenu = toggleMenu;


/* ============================================================
   6. VIEW SWITCHER

   showView(id, goingBack)
   ─────────────────────────────────────────────────────────────
   goingBack = false (default) → going INTO a section
     outgoing view: slides LEFT out  (exit-left)
     incoming view: comes from RIGHT (default transform: translateX(60px))

   goingBack = true → going BACK to nav
     outgoing view: slides RIGHT out (exit-right)
     incoming view: comes from LEFT  (enter-left → translateX(-60px))

   Race-condition fix:
   We set the incoming view's start position BEFORE adding
   view-active. A 20ms timeout (one rAF) gives the browser
   a chance to paint the start position before the transition
   to translateX(0) begins. Without this gap the browser
   might merge both class changes into one paint and skip
   the animation entirely.
   ============================================================ */
let currentView = 'nav';

function showView(id, goingBack = false) {
  if (id === currentView) return;

  const outEl = document.getElementById(`view-${currentView}`);
  const inEl  = document.getElementById(`view-${id}`);
  if (!outEl || !inEl) return;

  /* ── Exit the current view ── */
  outEl.classList.remove('view-active');
  outEl.classList.add(goingBack ? 'exit-right' : 'exit-left');

  /* ── Position the incoming view at its starting offset ── */
  if (goingBack) {
    inEl.classList.add('enter-left'); /* start translateX(-60px) */
  }
  /* else: incoming already sits at translateX(60px) from CSS defaults */

  /* ── One frame later: activate the incoming view ── */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      inEl.classList.remove('enter-left');  /* remove offset class */
      inEl.classList.add('view-active');    /* triggers transition to translateX(0) */
      currentView = id;

      /* Clean up exit classes after transition (300ms matches CSS) */
      setTimeout(() => {
        outEl.classList.remove('exit-left', 'exit-right');
      }, 350);
    });
  });
}

window.showView = showView;


/* ============================================================
   7. ESCAPE KEY
   ============================================================ */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (currentView !== 'nav') {
    showView('nav', true);   /* go back to menu list */
  } else if (menuIsOpen) {
    closeMenu();             /* close the overlay */
  }
});


/* ============================================================
   8. MUSIC PLAYER
   ============================================================ */
const audio     = document.getElementById('audio');
const iconPlay  = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
audio.volume    = 0.5;

function togglePlay() {
  if (audio.paused) {
    audio.play().catch(e => console.warn('Audio blocked:', e));
    iconPlay.style.display  = 'none';
    iconPause.style.display = 'block';
  } else {
    audio.pause();
    iconPlay.style.display  = 'block';
    iconPause.style.display = 'none';
  }
}
function setVolume(val) { audio.volume = parseFloat(val); }
audio.addEventListener('ended', () => {
  iconPlay.style.display  = 'block';
  iconPause.style.display = 'none';
});
window.togglePlay = togglePlay;
window.setVolume  = setVolume;


/* ============================================================
   9. CREDITS POPUP
   ============================================================ */
const creditsPopup = document.getElementById('credits-popup');
function toggleCredits() {
  const v = creditsPopup.classList.toggle('visible');
  creditsPopup.setAttribute('aria-hidden', String(!v));
}
window.toggleCredits = toggleCredits;
