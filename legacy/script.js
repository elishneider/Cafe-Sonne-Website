const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

function handleWaitlistSubmit(formId, noteId) {
  const form = document.getElementById(formId);
  const note = document.getElementById(noteId);
  if (!form || !note) return;

  const defaultNote = note.textContent;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]').value.trim();
    if (!email) return;

    note.textContent = `Thanks — we'll email ${email} when Café Sonne launches.`;
    note.classList.add('success');
    form.reset();

    setTimeout(() => {
      note.textContent = defaultNote;
      note.classList.remove('success');
    }, 6000);
  });
}

handleWaitlistSubmit('waitlistForm', 'formNote');
handleWaitlistSubmit('waitlistFormCta', 'formNoteCta');
