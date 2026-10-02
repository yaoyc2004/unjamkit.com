import {formId} from './contact-config.mjs';

const form = document.getElementById('contact-form');
const fields = document.getElementById('contact-fields');
const topic = document.getElementById('topic');
const message = document.getElementById('message');
const button = document.getElementById('contact-submit');
const status = document.getElementById('contact-status');
const configured = /^[a-zA-Z0-9]{6,64}$/.test(formId);
let sending = false;

function setStatus(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

function updateTopic() {
  const request = topic.value === 'tool-request';
  document.getElementById('message-label').textContent = request ? 'What would you like the tool to do?' : 'Your message';
  message.placeholder = request
    ? 'I start with…\nI need to…\nThe result should look like…'
    : topic.value === 'bug-report' ? 'Which tool were you using? What happened, and what did you expect?' : 'How can we help?';
  button.textContent = request ? 'Send tool request ↗' : 'Send message ↗';
}

if (new URLSearchParams(location.search).get('topic') === 'tool-request') topic.value = 'tool-request';
updateTopic();
topic.addEventListener('change', updateTopic);
if (configured) {
  form.action = `https://formspree.io/f/${formId}`;
  fields.disabled = false;
  setStatus('');
} else {
  setStatus('The contact form is not accepting messages yet. Please check back soon.');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!configured || sending || !form.reportValidity()) return;
  if (!message.value.trim()) {
    setStatus('Please add a message before sending.', true);
    message.focus();
    return;
  }
  // Capture before disabling fields: disabled fields are omitted from FormData.
  const data = new FormData(form);
  data.set('message', message.value.trim());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  sending = true;
  fields.disabled = true;
  form.setAttribute('aria-busy', 'true');
  button.textContent = 'Sending…';
  setStatus('Sending your message…');
  try {
    const response = await fetch(form.action, {
      method: 'POST', body: data, headers: {Accept: 'application/json'},
      credentials: 'omit', signal: controller.signal
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) {
      setStatus(response.status === 429
        ? 'Too many requests right now. Please wait a little and try again. Your message is still here.'
        : 'Your message could not be sent. Please try again later. Your message is still here.', true);
      return;
    }
    form.reset();
    setStatus('Thanks! Your message has been sent.');
  } catch {
    setStatus('We couldn’t confirm delivery. Your message is still here. Check your connection before trying again.', true);
  } finally {
    clearTimeout(timeout);
    sending = false;
    fields.disabled = false;
    form.removeAttribute('aria-busy');
    updateTopic();
  }
});
