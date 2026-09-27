'use strict';
(() => {
  const dialog = document.getElementById('why-dialog');
  if (!dialog) return;
  const title = document.getElementById('why-dialog-title');
  const copy = document.getElementById('why-dialog-copy');
  const index = document.getElementById('why-dialog-index');
  const close = dialog.querySelector('.why-dialog-close');
  let opener = null;

  document.querySelectorAll('.why-card[data-why-title]').forEach(card => {
    card.addEventListener('click', () => {
      opener = card;
      title.textContent = card.dataset.whyTitle;
      copy.textContent = card.dataset.whyCopy;
      index.textContent = card.dataset.whyIndex;
      dialog.showModal();
    });
  });

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
    if (event.target.closest('a')) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
})();
