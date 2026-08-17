class CommitteeCard extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute('name') || '';
    const role = this.getAttribute('role') || '';
    const pronouns = this.getAttribute('pronouns') || '';
    const course = this.getAttribute('course') || '';
    const email = this.getAttribute('email') || '';
    const favourite = this.getAttribute('favourite') || '';
    const about = this.getAttribute('about') || '';

    const hasBio = Boolean(favourite || about);

    this.className = "col-12 col-sm-6 col-md-4 col-lg-4";
    this.innerHTML = `
      <div class="card h-100 shadow-sm border text-center">
        <div class="card-body p-4 d-flex flex-column justify-content-between">
          <div>
            <img src="https://placehold.co/400" 
                alt="Member Name" 
                class="rounded-circle mx-auto mb-3 d-block" 
                style="width: 80px; height: 80px; object-fit: cover; border: 3px solid #5c9e31;">
            <div class="mb-2">
              <span class="badge" style="background-color: #edf6e8; color: #498226; border: 1px solid rgba(92, 158, 49, 0.35);">${role}</span>
            </div>
            <h5 class="card-title fw-bold mb-1">${name}</h5>
            <div class="text-muted small mb-2">(${pronouns})</div>
            <p class="card-text small text-muted mb-3">${course}</p>
          </div>
          <div class="d-flex justify-content-center gap-2 mt-auto">
            ${email ? `
              <a href="mailto:${email}" class="btn btn-outline-secondary btn-sm rounded-pill px-3">
                <i class="bi bi-envelope me-1"></i>Email
              </a>
            ` : ''}
            ${hasBio ? `
              <button type="button" class="btn btn-sm rounded-pill px-3 text-white btn-about" style="background-color: #5c9e31;">
                About
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // shared modal
    const aboutBtn = this.querySelector('.btn-about');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        document.getElementById('committeeModalTitle').textContent = name;
        document.getElementById('committeeModalRole').textContent = `${role} • (${pronouns})`;
        document.getElementById('committeeModalCourse').innerHTML = course;

        const favSec = document.getElementById('committeeModalFavSection');
        if (favourite) {
          favSec.style.display = 'block';
          document.getElementById('committeeModalFav').textContent = favourite;
        } else {
          favSec.style.display = 'none';
        }

        const aboutSec = document.getElementById('committeeModalAboutSection');
        if (about) {
          aboutSec.style.display = 'block';
          document.getElementById('committeeModalAbout').textContent = about;
        } else {
          aboutSec.style.display = 'none';
        }

        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('committeeModal'));
        modal.show();
      });
    }
  }
}

customElements.define('committee-card', CommitteeCard);