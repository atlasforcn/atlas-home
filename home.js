// The static introduction works without JavaScript; script.js loads the detailed résumé.
const copyButton = document.querySelector('[data-copy-email]');
const copyStatus = document.querySelector('.copy-status');
if (copyButton && copyStatus && navigator.clipboard && window.isSecureContext) {
    copyButton.classList.add('is-available');
    copyButton.addEventListener('click', async () => {
        const english = document.documentElement.lang === 'en';
        try {
            await navigator.clipboard.writeText(copyButton.dataset.copyEmail);
            copyStatus.textContent = english ? 'Email address copied.' : 'Email 已複製。';
        } catch {
            copyStatus.textContent = english ? 'Please select and copy the email address above.' : '請選取上方 Email 地址並複製。';
        }
    });
}
