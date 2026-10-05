import { initControlPage } from './js/control-page.js';
import { initStreamcardPage } from './js/streamcard-page.js';

const isStreamcardPage = window.location.pathname.includes('streamcard.html');
const isControlPage = !isStreamcardPage;

if (isControlPage) {
    initControlPage();
} else if (isStreamcardPage) {
    initStreamcardPage();
}
