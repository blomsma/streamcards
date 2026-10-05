import { loadFontFamily } from './fonts.js';
import { database, ref, set, onValue, off, serverNow } from './local-store.js';
import { fontOptions } from './utils.js';

export async function initControlPage() {
    async function mediaRequest(url, options) {
        const token = 'local-event';
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${token}`);
        return fetch(url, { ...options, headers });
    }
    // --- DOM Elementen ---
    const mainContent = document.getElementById('mainContent');
    const controlPanel = document.getElementById('controlPanel');
    const previewPane = document.getElementById('previewPane');

    const viewTimerLink = document.getElementById('viewTimerLink');

    // Timer Control elements
    const timerForm = document.getElementById('timerForm');
    const timerTitleInput = document.getElementById('timerTitleInput');
    const dateTimeInputContainer = document.getElementById('dateTimeInputContainer');
    const durationInputContainer = document.getElementById('durationInputContainer');
    const timerModeDateTimeRadio = document.getElementById('timerModeDateTime');
    const timerModeDurationRadio = document.getElementById('timerModeDuration');
    const targetDateTimeInput = document.getElementById('targetDateTime');
    const durationHoursInput = document.getElementById('durationHours');
    const durationMinutesInput = document.getElementById('durationMinutes');
    const durationSecondsInput = document.getElementById('durationSeconds');
    const hideLeadingZerosCheckbox = document.getElementById('hideLeadingZeros');
    const loopTimerCheckbox = document.getElementById('loopTimer');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resetTimerBtn = document.getElementById('resetTimerBtn');
    const resetModal = document.getElementById('resetModal');
    const resetModalCancel = document.getElementById('resetModalCancel');
    const resetModalConfirm = document.getElementById('resetModalConfirm');
    const statusIndicator = document.getElementById('statusIndicator');
    const controlError = document.getElementById('controlError');

    // Realtime options elements
    const backgroundTypeVideoRadio = document.getElementById('bgTypeVideo');
    const backgroundTypeStillRadio = document.getElementById('bgTypeStill');
    const backgroundTypeTransparentRadio = document.getElementById('bgTypeTransparent');
    const backgroundVideoOptionsDiv = document.getElementById('backgroundVideoOptions');
    const backgroundImageOptionsDiv = document.getElementById('backgroundImageOptions');
    const backgroundVideoSelect = document.getElementById('backgroundVideoSelect');
    const backgroundUploadInput = document.getElementById('backgroundUpload');
    const customBackgroundInfo = document.getElementById('customBackgroundInfo');
    const bgVideoPlayBtn = document.getElementById('bgVideoPlayBtn');
    const bgVideoPauseBtn = document.getElementById('bgVideoPauseBtn');
    const bgVideoRestartBtn = document.getElementById('bgVideoRestartBtn');

    const imageUploadInput = document.getElementById('imageUpload');
    const customImageInfo = document.getElementById('customImageInfo');
    const removeCustomImageBtn = document.getElementById('removeCustomImageBtn');
    
    // Overlay Images Elements (multiple)
    const overlayImageUploadInput = document.getElementById('overlayImageUpload');
    const overlayImagesList = document.getElementById('overlayImagesList');

    // Vignette Elements
    const vignetteEnabledCheckbox = document.getElementById('vignetteEnabled');
    const vignetteStrengthInput = document.getElementById('vignetteStrengthInput');
    const vignetteStrengthValue = document.getElementById('vignetteStrengthValue');

    // Background Blur Elements
    const backgroundBlurInput = document.getElementById('backgroundBlurInput');
    const backgroundBlurValue = document.getElementById('backgroundBlurValue');

    const fontFamilySelect = document.getElementById('fontFamilySelect');
    const fontUploadInput = document.getElementById('fontUpload');
    const removeCustomFontBtn = document.getElementById('removeCustomFontBtn');
    const customFontInfo = document.getElementById('customFontInfo');
    const fontSizeInput = document.getElementById('fontSizeInput');
    const fontColorInput = document.getElementById('fontColorInput');
    const overlayOpacityInput = document.getElementById('overlayOpacityInput');
    const overlayOpacityValue = document.getElementById('overlayOpacityValue');

    // Clock Appearance elements
    const enableClockBorderCheckbox = document.getElementById('enableClockBorder');
    const clockBorderOptionsDiv = document.getElementById('clockBorderOptions');
    const clockBorderThicknessInput = document.getElementById('clockBorderThickness');
    const clockBorderColorInput = document.getElementById('clockBorderColor');
    const clockBackgroundBlurInput = document.getElementById('clockBackgroundBlur');
    const clockBackgroundBlurValue = document.getElementById('clockBackgroundBlurValue');
    const clockPaddingInput = document.getElementById('clockPaddingInput');
    const clockPaddingValue = document.getElementById('clockPaddingValue');
    const clockCornerRadiusInput = document.getElementById('clockCornerRadiusInput');
    const clockCornerRadiusValue = document.getElementById('clockCornerRadiusValue');
    const clockTextShadowBlurInput = document.getElementById('clockTextShadowBlurInput');
    const clockTextShadowBlurValue = document.getElementById('clockTextShadowBlurValue');

    // Title formatting elements
    const titleFontFamilySelect = document.getElementById('titleFontFamilySelect');
    const titleFontSizeInput = document.getElementById('titleFontSizeInput');
    const titleFontSizeValue = document.getElementById('titleFontSizeValue');
    const titleFontColorInput = document.getElementById('titleFontColorInput');
    const titleTextShadowBlurInput = document.getElementById('titleTextShadowBlurInput');
    const titleTextShadowBlurValue = document.getElementById('titleTextShadowBlurValue');
    const titleFontUploadInput = document.getElementById('titleFontUpload');
    const removeTitleCustomFontBtn = document.getElementById('removeTitleCustomFontBtn');
    const titleCustomFontInfo = document.getElementById('titleCustomFontInfo');

    // Message formatting elements
    const messageFontFamilySelect = document.getElementById('messageFontFamilySelect');
    const messageFontSizeInput = document.getElementById('messageFontSizeInput');
    const messageFontSizeValue = document.getElementById('messageFontSizeValue');
    const messageFontColorInput = document.getElementById('messageFontColorInput');
    const messageTextShadowBlurInput = document.getElementById('messageTextShadowBlurInput');
    const messageTextShadowBlurValue = document.getElementById('messageTextShadowBlurValue');
    const messageFontUploadInput = document.getElementById('messageFontUpload');
    const removeMessageCustomFontBtn = document.getElementById('removeMessageCustomFontBtn');
    const messageCustomFontInfo = document.getElementById('messageCustomFontInfo');

    // Realtime message elements
    const realtimeMessageInput = document.getElementById('realtimeMessageInput');
    const toggleMessageVisibilityBtn = document.getElementById('toggleMessageVisibilityBtn');
    const messageVisibilityStatus = document.getElementById('messageVisibilityStatus');

    const previewIframe = document.getElementById('previewIframe');

    const currentUserId = 'event';
    let timerStateRef = null;
    let timerStateListener = null;

    // --- State Variables ---
    let currentTimerState = {
        isRunning: false,
        isPaused: false,
        clockVisible: true, timerVisible: true, // New: visibility toggle for timer
        title: '',
        targetTimestamp: 0,
        pauseTimeRemaining: null,
        countdownMode: 'datetime',
        timerMode: 'datetime',
        targetDateTimeString: '',
        durationHours: 0,
        durationMinutes: 0,
        durationSeconds: 0,
        hideLeadingZeros: false,
        loopTimer: false,
        backgroundType: 'video',
        backgroundVideo: '1.mp4',
        customBackgroundFile: null,
        customImageFile: null,
        overlayImages: [], // Changed: array of overlay objects {id, file, posX, posY, scale}
        vignetteEnabled: false,
        vignetteStrength: 50,
        backgroundBlur: 0,
        fontFamily: "'Inter', sans-serif",
        customFontFile: null,
        fontSize: 72,
        fontColor: '#FFFFFF',
        overlayOpacity: 50,
        clockBorderEnabled: false,
        clockBorderThickness: 2,
        clockBorderColor: '#FFFFFF',
        clockBackgroundBlur: 5,
        clockPadding: 16,
        clockCornerRadius: 6,
        clockTextShadowBlur: 5,
        titleFontFamily: "'Inter', sans-serif",
        titleCustomFontFile: null,
        titleFontSize: 43,
        titleFontColor: '#FFFFFF',
        titleTextShadowBlur: 5,
        messageFontFamily: "'Inter', sans-serif",
        messageCustomFontFile: null,
        messageFontSize: 43,
        messageFontColor: '#FFFFFF',
        messageTextShadowBlur: 5,
        titlePosX: 50,
        titlePosY: 30,
        clockPosX: 50,
        clockPosY: 60,
        messagePosX: 50, // New: separate message position
        messagePosY: 50, // New: separate message position
        isShowingMessage: false,
        currentMessage: '',
        videoCommand: null
    };

    // Toast notification system
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
        toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full opacity-0 flex items-center gap-2 min-w-[200px]`;
        
        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.textContent = `${icon} ${message}`;
        toast.setAttribute("role", type === "error" ? "alert" : "status");
        
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function showControlError(message) {
        showToast(message, 'error');
    }
    
    function showControlSuccess(message) {
        showToast(message, 'success');
    }

    function updateControlPanelUI(state) {
        const defaultState = {
            isRunning: false, isPaused: false, isShowingMessage: false, clockVisible: true, timerVisible: true, title: '', targetTimestamp: 0,
            pauseTimeRemaining: null, countdownMode: 'datetime', timerMode: 'datetime', targetDateTimeString: '',
            durationHours: 0, durationMinutes: 0, durationSeconds: 0, hideLeadingZeros: false, loopTimer: false,
            backgroundType: 'video', backgroundVideo: '1.mp4', customBackgroundFile: null, customImageFile: null,
            overlayImages: [], vignetteEnabled: false, vignetteStrength: 50,
            fontFamily: "'Inter', sans-serif", customFontFile: null, fontSize: 72, fontColor: '#FFFFFF',
            clockBorderEnabled: false, clockBorderThickness: 2, clockBorderColor: '#FFFFFF', clockBackgroundBlur: 5,
            clockPadding: 16, clockCornerRadius: 6, clockTextShadowBlur: 5,
            currentMessage: '',
            titleFontFamily: "'Inter', sans-serif", titleCustomFontFile: null, titleFontSize: 43, titleFontColor: '#FFFFFF', titleTextShadowBlur: 5,
            messageFontFamily: "'Inter', sans-serif", messageCustomFontFile: null, messageFontSize: 43, messageFontColor: '#FFFFFF', messageTextShadowBlur: 5,
            titleRotation: 0, clockRotation: 0, messageRotation: 0,
            titlePosX: 50, titlePosY: 30, clockPosX: 50, clockPosY: 60, messagePosX: 50, messagePosY: 50,
            overlayOpacity: 50, videoCommand: null
        };

        const cleanState = state ? { ...defaultState, ...state } : defaultState;
        currentTimerState = { ...cleanState };
        const currentState = currentTimerState;

        // Status Indicator
        let indicatorColorClass = 'bg-gray-500';
        let indicatorTitle = 'Niet gestart';
        if (currentState.isShowingMessage) {
             indicatorColorClass = 'bg-purple-500';
             indicatorTitle = `Bericht zichtbaar: ${currentState.currentMessage}`;
        } else if (currentState.isRunning) {
            if (currentState.isPaused) {
                indicatorColorClass = 'bg-yellow-500';
                indicatorTitle = `Gepauzeerd — ${currentState.title || '(zonder titel)'}`;
            } else {
                indicatorColorClass = 'bg-green-500';
                indicatorTitle = `Actief — ${currentState.title || '(zonder titel)'}`;
            }
        }
        statusIndicator.className = `w-4 h-4 rounded-full ${indicatorColorClass} transition-colors duration-300`;
        statusIndicator.title = indicatorTitle;
        document.getElementById("statusText").textContent = indicatorTitle;

        // Buttons
        // Start button becomes Stop button when timer is running
        if (currentState.isRunning) {
            startBtn.textContent = 'Stop Countdown';
            startBtn.classList.remove('bg-green-700', 'hover:bg-green-800');
            startBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            startBtn.title = 'Stop de countdown en verberg de klok';
            startBtn.disabled = false;
            startBtn.type = 'button';
        } else {
            startBtn.textContent = 'Start Countdown';
            startBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            startBtn.classList.add('bg-green-700', 'hover:bg-green-800');
            startBtn.title = 'Start de countdown met de ingestelde tijd';
            startBtn.disabled = false;
            startBtn.type = 'button';
        }
        pauseBtn.disabled = !currentState.isRunning || currentState.isPaused || currentState.isShowingMessage;
        resumeBtn.disabled = !currentState.isRunning || !currentState.isPaused || currentState.isShowingMessage;
        
        // Herstart button: enabled when timer is active OR when form has valid timer settings
        if (resetTimerBtn) {
            const isDurationMode = timerModeDurationRadio.checked;
            let hasValidSettings = false;
            
            if (isDurationMode) {
                const hours = parseInt(durationHoursInput.value, 10) || 0;
                const minutes = parseInt(durationMinutesInput.value, 10) || 0;
                const seconds = parseInt(durationSecondsInput.value, 10) || 0;
                hasValidSettings = (hours + minutes + seconds) > 0;
            } else {
                hasValidSettings = !!targetDateTimeInput.value;
            }
            
            const isTimerActive = currentState.isRunning || currentState.isPaused;
            resetTimerBtn.disabled = !isTimerActive && !hasValidSettings;
        }

        // Message visibility toggle
        if (currentState.isShowingMessage) {
            toggleMessageVisibilityBtn.textContent = '👁';
            toggleMessageVisibilityBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            toggleMessageVisibilityBtn.classList.add('bg-purple-600', 'hover:bg-purple-700');
            toggleMessageVisibilityBtn.title = 'Bericht is zichtbaar - Klik om te verbergen';
            messageVisibilityStatus.textContent = 'Bericht is zichtbaar';
        } else {
            toggleMessageVisibilityBtn.textContent = '👁‍🗨';
            toggleMessageVisibilityBtn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
            toggleMessageVisibilityBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
            toggleMessageVisibilityBtn.title = 'Bericht is verborgen - Klik om te tonen';
            messageVisibilityStatus.textContent = 'Bericht is verborgen';
        }

        // Form
        if (!currentState.isRunning && !currentState.isPaused && !currentState.isShowingMessage) {
             // Only update title if the input is not focused (to prevent losing focus while typing)
             if (document.activeElement !== timerTitleInput) {
                 timerTitleInput.value = currentState.title || '';
             }
        }
        
        // Timer Mode
        if (currentState.timerMode === 'duration') {
            timerModeDurationRadio.checked = true;
            dateTimeInputContainer.classList.add('hidden');
            durationInputContainer.classList.remove('hidden');
        } else {
            timerModeDateTimeRadio.checked = true;
            dateTimeInputContainer.classList.remove('hidden');
            durationInputContainer.classList.add('hidden');
        }
        targetDateTimeInput.value = currentState.targetDateTimeString || '';
        durationHoursInput.value = currentState.durationHours || 0;
        durationMinutesInput.value = currentState.durationMinutes || 0;
        durationSecondsInput.value = currentState.durationSeconds || 0;
        hideLeadingZerosCheckbox.checked = currentState.hideLeadingZeros || false;
        loopTimerCheckbox.checked = currentState.loopTimer || false;

        // Only disable timer start settings (title, datetime, duration), not appearance settings
        const timerStartDisabled = currentState.isRunning || currentState.isPaused;
        // Don't change disabled state if the input is focused (would cause focus loss)
        if (document.activeElement !== timerTitleInput) {
            timerTitleInput.disabled = timerStartDisabled;
        }
        targetDateTimeInput.disabled = timerStartDisabled;
        durationHoursInput.disabled = timerStartDisabled;
        durationMinutesInput.disabled = timerStartDisabled;
        durationSecondsInput.disabled = timerStartDisabled;
        timerModeDateTimeRadio.disabled = timerStartDisabled;
        timerModeDurationRadio.disabled = timerStartDisabled;


        // Background
        if (currentState.backgroundType === 'still') {
             backgroundTypeStillRadio.checked = true;
             backgroundVideoOptionsDiv.classList.add('hidden');
             backgroundImageOptionsDiv.classList.remove('hidden');
        } else if (currentState.backgroundType === 'transparent') {
             backgroundTypeTransparentRadio.checked = true;
             backgroundVideoOptionsDiv.classList.add('hidden');
             backgroundImageOptionsDiv.classList.add('hidden');
        } else {
             backgroundTypeVideoRadio.checked = true;
             backgroundVideoOptionsDiv.classList.remove('hidden');
             backgroundImageOptionsDiv.classList.add('hidden');
        }

        // Video Select
        const customVideoFilename = currentState.customBackgroundFile;
        const customVideoOptionValue = customVideoFilename;
        let customVideoOptionExists = false;
        for (let i = 0; i < backgroundVideoSelect.options.length; i++) {
            if (backgroundVideoSelect.options[i].value === customVideoOptionValue && customVideoFilename) {
                customVideoOptionExists = true;
                backgroundVideoSelect.options[i].textContent = `Custom Video (${customVideoFilename})`;
                break;
            }
            if (backgroundVideoSelect.options[i].value.startsWith('user') && !customVideoFilename) {
                 backgroundVideoSelect.remove(i);
                 i--;
            }
        }
        if (customVideoFilename && !customVideoOptionExists) {
            const customOption = document.createElement('option');
            customOption.value = customVideoOptionValue;
            customOption.textContent = `Custom Video (${customVideoFilename})`;
            backgroundVideoSelect.insertBefore(customOption, backgroundVideoSelect.firstChild);
        }
        if (customVideoFilename && currentState.backgroundType === 'video') {
            backgroundVideoSelect.value = customVideoOptionValue;
            backgroundVideoSelect.disabled = true;
            customBackgroundInfo.textContent = `Active: ${customVideoFilename}`;
            customBackgroundInfo.classList.remove('hidden');
            removeCustomVideoBtn.classList.remove('hidden');
        } else {
            backgroundVideoSelect.value = currentState.backgroundVideo || '1.mp4';
            backgroundVideoSelect.disabled = false;
            customBackgroundInfo.textContent = '';
            customBackgroundInfo.classList.add('hidden');
            removeCustomVideoBtn.classList.add('hidden');
        }

        // Image Info
        if (currentState.customImageFile && currentState.backgroundType === 'still') {
            customImageInfo.textContent = `Active: ${currentState.customImageFile}`;
            customImageInfo.classList.remove('hidden');
            removeCustomImageBtn.classList.remove('hidden');
        } else {
            customImageInfo.textContent = '';
            customImageInfo.classList.add('hidden');
            removeCustomImageBtn.classList.add('hidden');
        }

        // Overlay Images List (multiple)
        renderOverlayImagesList(currentState.overlayImages || []);

        // Vignette
        vignetteEnabledCheckbox.checked = currentState.vignetteEnabled;
        vignetteStrengthInput.value = currentState.vignetteStrength;
        vignetteStrengthValue.textContent = currentState.vignetteStrength;
        vignetteStrengthInput.disabled = !currentState.vignetteEnabled;

        // Background Blur
        backgroundBlurInput.value = currentState.backgroundBlur ?? 0;
        backgroundBlurValue.textContent = currentState.backgroundBlur ?? 0;

        // Fonts
        fontFamilySelect.value = currentState.fontFamily || "'Inter', sans-serif";
        updateCustomDropdown('fontFamilyDropdownContainer', fontFamilySelect.value);
        
        fontSizeInput.value = currentState.fontSize || 72;
        fontColorInput.value = currentState.fontColor || '#FFFFFF';
        realtimeMessageInput.value = currentState.currentMessage || '';

        fontFamilySelect.disabled = !!currentState.customFontFile;
        const fontDropdownTrigger = document.getElementById('fontFamilyDropdownTrigger');
        if (fontDropdownTrigger) fontDropdownTrigger.disabled = !!currentState.customFontFile;

        customFontInfo.textContent = currentState.customFontFile ? `Custom: ${currentState.customFontFile}` : '';
        removeCustomFontBtn.classList.toggle('hidden', !currentState.customFontFile);

        // Clock Appearance
        enableClockBorderCheckbox.checked = currentState.clockBorderEnabled || false;
        clockBorderOptionsDiv.classList.toggle('hidden', !currentState.clockBorderEnabled);
        clockBorderThicknessInput.value = currentState.clockBorderThickness || 2;
        clockBorderColorInput.value = currentState.clockBorderColor || '#FFFFFF';
        clockBackgroundBlurInput.value = currentState.clockBackgroundBlur || 5;
        clockBackgroundBlurValue.textContent = `${currentState.clockBackgroundBlur || 5}px`;
        clockPaddingInput.value = currentState.clockPadding || 16;
        clockPaddingValue.textContent = currentState.clockPadding || 16;
        clockCornerRadiusInput.value = currentState.clockCornerRadius || 0;
        clockCornerRadiusValue.textContent = currentState.clockCornerRadius || 0;
        clockTextShadowBlurInput.value = currentState.clockTextShadowBlur || 0;
        clockTextShadowBlurValue.textContent = currentState.clockTextShadowBlur || 0;

        // Title Formatting
        titleFontFamilySelect.value = currentState.titleFontFamily || fontFamilySelect.value;
        updateCustomDropdown('titleFontFamilyDropdownContainer', titleFontFamilySelect.value);
        titleFontSizeInput.value = currentState.titleFontSize || 43;
        titleFontSizeValue.textContent = currentState.titleFontSize || 43;
        titleFontColorInput.value = currentState.titleFontColor || fontColorInput.value;
        titleTextShadowBlurInput.value = currentState.titleTextShadowBlur || 5;
        titleTextShadowBlurValue.textContent = currentState.titleTextShadowBlur || 5;
        // Title custom font
        titleFontFamilySelect.disabled = !!currentState.titleCustomFontFile;
        const titleFontDropdownTrigger = document.getElementById('titleFontFamilyDropdownTrigger');
        if (titleFontDropdownTrigger) titleFontDropdownTrigger.disabled = !!currentState.titleCustomFontFile;
        titleCustomFontInfo.textContent = currentState.titleCustomFontFile ? `Custom: ${currentState.titleCustomFontFile}` : '';
        removeTitleCustomFontBtn.classList.toggle('hidden', !currentState.titleCustomFontFile);

        // Message Formatting
        messageFontFamilySelect.value = currentState.messageFontFamily || fontFamilySelect.value;
        updateCustomDropdown('messageFontFamilyDropdownContainer', messageFontFamilySelect.value);
        messageFontSizeInput.value = currentState.messageFontSize || 43;
        messageFontSizeValue.textContent = currentState.messageFontSize || 43;
        messageFontColorInput.value = currentState.messageFontColor || fontColorInput.value;
        messageTextShadowBlurInput.value = currentState.messageTextShadowBlur || 5;
        messageTextShadowBlurValue.textContent = currentState.messageTextShadowBlur || 5;
        // Message custom font
        messageFontFamilySelect.disabled = !!currentState.messageCustomFontFile;
        const messageFontDropdownTrigger = document.getElementById('messageFontFamilyDropdownTrigger');
        if (messageFontDropdownTrigger) messageFontDropdownTrigger.disabled = !!currentState.messageCustomFontFile;
        messageCustomFontInfo.textContent = currentState.messageCustomFontFile ? `Custom: ${currentState.messageCustomFontFile}` : '';
        removeMessageCustomFontBtn.classList.toggle('hidden', !currentState.messageCustomFontFile);

        overlayOpacityInput.value = currentState.overlayOpacity;
        overlayOpacityValue.textContent = currentState.overlayOpacity;

        timerTitleInput.disabled = false;
        targetDateTimeInput.disabled = false;
    }
    
    // Render overlay images list
    function renderOverlayImagesList(overlays) {
        if (!overlayImagesList) return;
        overlayImagesList.innerHTML = '';
        
        if (!overlays || overlays.length === 0) {
            overlayImagesList.innerHTML = '<p class="text-xs text-gray-500 italic">Geen overlays toegevoegd</p>';
            return;
        }
        
        overlays.forEach((overlay, index) => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-gray-800 rounded px-2 py-1 text-sm';
            item.innerHTML = `
                <span class="text-gray-300 truncate flex-1"></span>
                <button data-index="${index}" class="remove-overlay-btn ml-2 text-red-400 hover:text-red-300 px-2" title="Verwijder">✕</button>
            `;
            item.querySelector("span").textContent = overlay.file;
            overlayImagesList.appendChild(item);
        });
        
        // Add remove button handlers
        overlayImagesList.querySelectorAll('.remove-overlay-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                removeOverlayImage(index);
            });
        });
    }
    
    async function removeOverlayImage(index) {
        const overlays = [...(currentTimerState.overlayImages || [])];
        const overlay = overlays[index];
        
        if (overlay && overlay.file) {
            try {
                const response = await mediaRequest('/delete-overlay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: overlay.file })
                });
                if (!response.ok && response.status !== 404) throw new Error("Verwijderen mislukt");
            } catch (err) {
                console.error('Failed to delete overlay file:', err);
                return showControlError('Overlay kon niet worden verwijderd. Probeer opnieuw.');
            }
        }
        
        updateAndSendState({ overlayImages: (currentTimerState.overlayImages || []).filter(item => item.id !== overlay?.id) });
        showControlSuccess('Overlay verwijderd');
    }

    function updateCustomDropdown(containerId, value) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const selectedText = container.querySelector('span[id$="SelectedText"]');
        const option = fontOptions.find(o => o.value === value);
        if (option && selectedText) {
            selectedText.textContent = option.name;
            selectedText.style.fontFamily = option.value;
        }
    }

    async function sendStateToServer() {
        if (!timerStateRef) return;
        try {
            await set(timerStateRef, currentTimerState);
        } catch (error) {
            console.error("Error writing to lokale server:", error);
            if (error.code === 'PERMISSION_DENIED') {
                 showControlError("Fout: Geen permissie om data op te slaan.");
            } else {
                 showControlError(`Kon timer niet bijwerken: ${error.message}`);
            }
        }
    }

    function updateAndSendState(updates) {
         console.log('updateAndSendState called with:', updates);
         currentTimerState = { ...currentTimerState, ...updates };
         console.log('New currentTimerState:', currentTimerState);
         if (Object.hasOwn(updates, "isRunning") || Object.hasOwn(updates, "isPaused")) updateControlPanelUI(currentTimerState);
         return sendStateToServer();
    }

    function initializeLocalListener() {
        if (timerStateRef && timerStateListener) {
            off(timerStateRef, 'value', timerStateListener);
            timerStateListener = null;
            timerStateRef = null;
        }
        if (!currentUserId || !database) return;

        try {
            timerStateRef = ref(database, `users/${currentUserId}/timerState`);
            timerStateListener = (snapshot) => {
                const state = snapshot.val();
                updateControlPanelUI(state);
            };
             onValue(timerStateRef, timerStateListener, (error) => {
                console.error(`Error listening to lokale server:`, error);
                showControlError('Verbinding met de NUC verbroken. Wacht op herstel voordat je verder bedient.');
             });
        } catch (error) {
             console.error("Error setting up listener:", error);
        }
    }

    // --- Handlers ---
    function handleStartTimer(event) {
        if (event) event.preventDefault();
        
        // If timer is running, stop it instead
        if (currentTimerState.isRunning) {
            handleStopTimer();
            return;
        }
        
        const title = timerTitleInput.value.trim();
        const timerMode = timerModeDurationRadio.checked ? 'duration' : 'datetime';
        const hideLeadingZeros = hideLeadingZerosCheckbox.checked;
        const loopTimer = loopTimerCheckbox.checked;
        
        let targetTimestamp;
        let dateTimeString = '';
        let durationHours = 0;
        let durationMinutes = 0;
        let durationSeconds = 0;
        
        if (timerMode === 'duration') {
            durationHours = parseInt(durationHoursInput.value, 10) || 0;
            durationMinutes = parseInt(durationMinutesInput.value, 10) || 0;
            durationSeconds = parseInt(durationSecondsInput.value, 10) || 0;
            
            const totalMs = ((durationHours * 3600) + (durationMinutes * 60) + durationSeconds) * 1000;
            if (totalMs <= 0) return showControlError("Voer een geldige tijdsduur in.");
            
            targetTimestamp = serverNow() + totalMs;
        } else {
            dateTimeString = targetDateTimeInput.value;
            if (!dateTimeString) return showControlError("Selecteer een geldige doel datum en tijd.");
            const targetDate = new Date(dateTimeString);
            if (isNaN(targetDate.getTime())) return showControlError("Ongeldige datum/tijd formaat.");
            targetTimestamp = targetDate.getTime();
            if (targetTimestamp <= serverNow()) return showControlError("Doel datum/tijd moet in de toekomst liggen.");
        }

        updateAndSendState({
            title, targetTimestamp, isRunning: true, isPaused: false, isShowingMessage: false,
            currentMessage: '', pauseTimeRemaining: null, targetDateTimeString: dateTimeString,
            timerMode, durationHours, durationMinutes, durationSeconds, hideLeadingZeros, loopTimer,
            clockVisible: true, timerVisible: true
        });
    }
    
    function handleStopTimer() {
        console.log('handleStopTimer called, timerStateRef:', timerStateRef ? 'exists' : 'null');
        const newState = {
            isRunning: false,
            isPaused: false,
            targetTimestamp: 0,
            pauseTimeRemaining: null,
            timerVisible: false
        };
        console.log('Sending stop state:', newState);
        updateAndSendState(newState);
    }

    function handlePauseTimer() {
         if (!currentTimerState.isRunning || currentTimerState.isPaused) return;
         const remaining = Math.max(0, currentTimerState.targetTimestamp - serverNow());
         updateAndSendState({ isPaused: true, pauseTimeRemaining: remaining });
    }

    function handleResumeTimer() {
         if (!currentTimerState.isRunning || !currentTimerState.isPaused) return;
         const remaining = currentTimerState.pauseTimeRemaining !== null ? currentTimerState.pauseTimeRemaining : Math.max(0, currentTimerState.targetTimestamp - serverNow());
         updateAndSendState({ isPaused: false, targetTimestamp: serverNow() + remaining, pauseTimeRemaining: null });
    }

    // Restart the timer from the beginning with the same settings
    function handleResetTimerOnly() {
        // Read directly from form inputs to get the current timer configuration
        const isDurationMode = timerModeDurationRadio.checked;
        
        if (isDurationMode) {
            // Duration mode: restart with the duration shown in the inputs
            const hours = parseInt(durationHoursInput.value, 10) || 0;
            const minutes = parseInt(durationMinutesInput.value, 10) || 0;
            const seconds = parseInt(durationSecondsInput.value, 10) || 0;
            const totalMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
            
            if (totalMs <= 0) {
                return showControlError("Voer een geldige tijdsduur in om te herstarten.");
            }
            
            updateAndSendState({
                isRunning: true, clockVisible: true,
                isPaused: false,
                targetTimestamp: serverNow() + totalMs,
                pauseTimeRemaining: null,
                isShowingMessage: false,
                timerMode: 'duration',
                durationHours: hours,
                durationMinutes: minutes,
                durationSeconds: seconds
            });
        } else {
            // Datetime mode: use the datetime shown in the input
            const dateTimeString = targetDateTimeInput.value;
            if (!dateTimeString) {
                return showControlError("Selecteer een doel datum/tijd om te herstarten.");
            }
            
            const targetDate = new Date(dateTimeString);
            if (isNaN(targetDate.getTime())) {
                return showControlError("Ongeldige datum/tijd formaat.");
            }
            
            if (targetDate.getTime() <= serverNow()) {
                return showControlError("De ingestelde datum/tijd is al verstreken.");
            }
            
            updateAndSendState({
                isRunning: true, clockVisible: true,
                isPaused: false,
                targetTimestamp: targetDate.getTime(),
                pauseTimeRemaining: null,
                isShowingMessage: false,
                timerMode: 'datetime',
                targetDateTimeString: dateTimeString
            });
        }
    }

    // Show reset confirmation modal
    function handleResetTimer() {
        if (resetModal) {
            resetModal.classList.remove('hidden');
        } else {
            // Fallback if modal doesn't exist
            performReset();
        }
    }
    
    // Actually perform the reset
    function performReset() {
        updateAndSendState({
            clockVisible: true, title: '', targetTimestamp: 0, isRunning: false, isPaused: false, isShowingMessage: false,
            currentMessage: '', pauseTimeRemaining: null, targetDateTimeString: '',
            timerMode: 'datetime', durationHours: 0, durationMinutes: 0, durationSeconds: 0,
            hideLeadingZeros: false, loopTimer: false,
            backgroundType: 'video', backgroundVideo: '1.mp4',
            customBackgroundFile: null, customImageFile: null, overlayImages: [],
            vignetteEnabled: false, vignetteStrength: 50, backgroundBlur: 0,
            fontFamily: "'Inter', sans-serif", customFontFile: null,
            fontSize: 72, fontColor: '#FFFFFF', overlayOpacity: 50,
            clockBorderEnabled: false, clockBorderThickness: 2, clockBorderColor: '#FFFFFF',
            clockBackgroundBlur: 5, clockPadding: 16, clockCornerRadius: 6, clockTextShadowBlur: 5,
            titleFontFamily: "'Inter', sans-serif", titleCustomFontFile: null,
            titleFontSize: 43, titleFontColor: '#FFFFFF', titleTextShadowBlur: 5,
            messageFontFamily: "'Inter', sans-serif", messageCustomFontFile: null,
            messageFontSize: 43, messageFontColor: '#FFFFFF', messageTextShadowBlur: 5,
            titleRotation: 0, clockRotation: 0, messageRotation: 0,
            titlePosX: 50, titlePosY: 30, clockPosX: 50, clockPosY: 60,
            messagePosX: 50, messagePosY: 50
        });
        timerTitleInput.value = '';
        targetDateTimeInput.value = '';
        durationHoursInput.value = 0;
        durationMinutesInput.value = 0;
        durationSecondsInput.value = 0;
    }

    function handleToggleMessageVisibility() {
        const isCurrentlyShowing = currentTimerState.isShowingMessage;
        if (isCurrentlyShowing) {
            // Hide the message
            updateAndSendState({ isShowingMessage: false });
        } else {
            // Show the message
            const message = realtimeMessageInput.value.trim();
            if (!message) return showControlError("Voer een bericht in.");
            updateAndSendState({ isShowingMessage: true, currentMessage: message });
        }
    }

    function handleDisplayOptionChange() {
        let selectedBackgroundType = 'video';
        if (backgroundTypeStillRadio.checked) selectedBackgroundType = 'still';
        if (backgroundTypeTransparentRadio.checked) selectedBackgroundType = 'transparent';

        updateAndSendState({
             backgroundType: selectedBackgroundType,
             backgroundVideo: (selectedBackgroundType === 'video' && !currentTimerState.customBackgroundFile) ? backgroundVideoSelect.value : currentTimerState.backgroundVideo,
             fontFamily: currentTimerState.customFontFile ? currentTimerState.fontFamily : fontFamilySelect.value,
             fontSize: parseInt(fontSizeInput.value, 10) || 72,
             fontColor: fontColorInput.value,
        });
    }

    async function handleBackgroundUpload(event) {
        const file = event.target.files[0];
        if (!file || !currentUserId) return;
        
        const formData = new FormData();
        formData.append('userId', currentUserId);
        formData.append('videoFile', file);

        backgroundUploadInput.disabled = true;
        customBackgroundInfo.textContent = 'Uploading...';
        customBackgroundInfo.classList.remove('hidden');

        try {
            const response = await mediaRequest('/upload-video', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            updateAndSendState({
                customBackgroundFile: data.filename,
                backgroundVideo: data.filename,
                backgroundType: 'video',
                customImageFile: null
            });
            showControlSuccess("Video geüpload");
        } catch (error) {
            showControlError("Upload mislukt");
        } finally {
            backgroundUploadInput.disabled = false;
            backgroundUploadInput.value = '';
        }
    }

    async function handleRemoveCustomVideo() {
        const filename = currentTimerState.customBackgroundFile;
        if (!filename) return;

        try {
            const response = await mediaRequest('/delete-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
                if (!response.ok && response.status !== 404) throw new Error("Verwijderen mislukt");
        } catch (err) {
            console.error('Failed to delete video file:', err);
            return showControlError('Bestand kon niet worden verwijderd. Probeer opnieuw.');
        }

        updateAndSendState({
            customBackgroundFile: null,
            backgroundVideo: '1.mp4'
        });
        showControlSuccess('Video verwijderd');
    }

    async function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file || !currentUserId) return;

        const formData = new FormData();
        formData.append('userId', currentUserId);
        formData.append('imageFile', file);

        imageUploadInput.disabled = true;
        customImageInfo.textContent = 'Uploading...';
        customImageInfo.classList.remove('hidden');

        try {
            const response = await mediaRequest('/upload-image', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            updateAndSendState({
                customImageFile: data.filename,
                backgroundType: 'still',
                customBackgroundFile: null
            });
            showControlSuccess("Afbeelding geüpload");
        } catch (error) {
            showControlError("Upload mislukt");
        } finally {
            imageUploadInput.disabled = false;
            imageUploadInput.value = '';
        }
    }

    async function handleRemoveCustomImage() {
        const filename = currentTimerState.customImageFile;
        if (!filename) return;

        try {
            const response = await mediaRequest('/delete-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
                if (!response.ok && response.status !== 404) throw new Error("Verwijderen mislukt");
        } catch (err) {
            console.error('Failed to delete image file:', err);
            return showControlError('Bestand kon niet worden verwijderd. Probeer opnieuw.');
        }

        updateAndSendState({
            customImageFile: null,
            backgroundType: 'video'
        });
        showControlSuccess('Achtergrond verwijderd');
    }

    async function handleOverlayImageUpload(event) {
        const file = event.target.files[0];
        if (!file || !currentUserId) return;

        const formData = new FormData();
        formData.append('userId', currentUserId);
        formData.append('overlayFile', file);

        overlayImageUploadInput.disabled = true;

        try {
            const response = await mediaRequest('/upload-overlay', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            
            // Add to overlays array
            const currentOverlays = [...(currentTimerState.overlayImages || [])];
            const newOverlay = {
                id: serverNow().toString(),
                file: data.filename,
                posX: 50,
                posY: 50,
                scale: 100
            };
            currentOverlays.push(newOverlay);
            
            updateAndSendState({ overlayImages: currentOverlays });
            showControlSuccess("Overlay toegevoegd");
        } catch (error) {
            showControlError("Upload mislukt");
        } finally {
            overlayImageUploadInput.disabled = false;
            overlayImageUploadInput.value = '';
        }
    }

    let dropQueue = Promise.resolve();
    function handlePreviewDrop({ files, posX, posY }) {
        if (!Array.isArray(files) || !files.every(file => file instanceof File) || !currentUserId) return;
        const x = Number.isFinite(posX) ? Math.max(0, Math.min(100, posX)) : 50;
        const y = Number.isFinite(posY) ? Math.max(0, Math.min(100, posY)) : 50;
        dropQueue = dropQueue.then(async () => {
            const progress = document.getElementById('previewUploadStatus');
            progress.hidden = false;
            for (const [index, file] of files.entries()) {
                progress.textContent = `Uploaden ${index + 1}/${files.length}: ${file.name}`;
                try {
                    const extension = file.name.split('.').pop().toLowerCase();
                    const video = ['mp4', 'webm', 'mov', 'm4v'].includes(extension);
                    if (!video && !['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'json', 'lottie'].includes(extension)) throw new Error('Sleep een afbeelding, animatie of video naar de preview.');
                    if (file.size > (video ? 50 : 10) * 1024 * 1024) throw new Error(`${file.name} is te groot (maximaal ${video ? 50 : 10} MB).`);
                    const body = new FormData();
                    body.append('userId', currentUserId);
                    body.append(video ? 'videoFile' : 'overlayFile', file);
                    const response = await mediaRequest(video ? '/upload-video' : '/upload-overlay', { method: 'POST', body });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'Upload mislukt.');
                    if (video) await updateAndSendState({ backgroundType: 'video', backgroundVideo: result.filename, customBackgroundFile: result.filename, customImageFile: null });
                    else await updateAndSendState({ overlayImages: [...(currentTimerState.overlayImages || []), { id: crypto.randomUUID(), file: result.filename, posX: x, posY: y, scale: 100, rotation: 0 }] });
                } catch (error) { showControlError(error.message); }
            }
            progress.hidden = true;
        });
    }

    function handleVignetteChange() {
        updateAndSendState({
            vignetteEnabled: vignetteEnabledCheckbox.checked,
            vignetteStrength: parseInt(vignetteStrengthInput.value, 10)
        });
    }

    async function handleFontUpload(event) {
        const file = event.target.files[0];
        if (!file || !currentUserId) return;

        const formData = new FormData();
        formData.append('userId', currentUserId);
        formData.append('fontFile', file);

        fontUploadInput.disabled = true;
        customFontInfo.textContent = 'Uploading...';

        try {
            const response = await mediaRequest('/upload-font', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            updateAndSendState({ customFontFile: data.filename });
            showControlSuccess("Font geüpload");
        } catch (error) {
            showControlError("Upload mislukt");
        } finally {
            fontUploadInput.disabled = false;
            fontUploadInput.value = '';
        }
    }

    function handleRemoveCustomFont() {
        updateAndSendState({ customFontFile: null });
    }

    async function handleTitleFontUpload(event) {
        const file = event.target.files[0];
        if (!file || !currentUserId) return;

        const formData = new FormData();
        formData.append('userId', currentUserId);
        formData.append('fontFile', file);
        formData.append('fontType', 'title');

        titleFontUploadInput.disabled = true;
        titleCustomFontInfo.textContent = 'Uploading...';

        try {
            const response = await mediaRequest('/upload-font', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            updateAndSendState({ titleCustomFontFile: data.filename });
            showControlSuccess("Titel font geüpload");
        } catch (error) {
            showControlError("Upload mislukt");
        } finally {
            titleFontUploadInput.disabled = false;
            titleFontUploadInput.value = '';
        }
    }

    function handleRemoveTitleCustomFont() {
        updateAndSendState({ titleCustomFontFile: null });
    }

    async function handleMessageFontUpload(event) {
        const file = event.target.files[0];
        if (!file || !currentUserId) return;

        const formData = new FormData();
        formData.append('userId', currentUserId);
        formData.append('fontFile', file);
        formData.append('fontType', 'message');

        messageFontUploadInput.disabled = true;
        messageCustomFontInfo.textContent = 'Uploading...';

        try {
            const response = await mediaRequest('/upload-font', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            updateAndSendState({ messageCustomFontFile: data.filename });
            showControlSuccess("Bericht font geüpload");
        } catch (error) {
            showControlError("Upload mislukt");
        } finally {
            messageFontUploadInput.disabled = false;
            messageFontUploadInput.value = '';
        }
    }

    function handleRemoveMessageCustomFont() {
        updateAndSendState({ messageCustomFontFile: null });
    }

    function handleOverlayOpacityChange() {
        const opacity = parseInt(overlayOpacityInput.value, 10);
        overlayOpacityValue.textContent = opacity;
        updateAndSendState({ overlayOpacity: opacity });
    }

    function handleClockAppearanceChange() {
        updateAndSendState({
            clockBorderEnabled: enableClockBorderCheckbox.checked,
            clockBorderThickness: parseInt(clockBorderThicknessInput.value, 10) || 0,
            clockBorderColor: clockBorderColorInput.value,
            clockBackgroundBlur: parseInt(clockBackgroundBlurInput.value, 10) || 0,
            clockPadding: parseInt(clockPaddingInput.value, 10) || 0,
            clockCornerRadius: parseInt(clockCornerRadiusInput.value, 10) || 0,
            clockTextShadowBlur: parseInt(clockTextShadowBlurInput.value, 10) || 0,
        });
    }

    function handleTitleFormattingChange() {
        updateAndSendState({
            titleFontFamily: titleFontFamilySelect.value,
            titleFontSize: parseInt(titleFontSizeInput.value, 10) || 43,
            titleFontColor: titleFontColorInput.value,
            titleTextShadowBlur: parseInt(titleTextShadowBlurInput.value, 10) || 5
        });
    }

    function handleMessageFormattingChange() {
        updateAndSendState({
            messageFontFamily: messageFontFamilySelect.value,
            messageFontSize: parseInt(messageFontSizeInput.value, 10) || 43,
            messageFontColor: messageFontColorInput.value,
            messageTextShadowBlur: parseInt(messageTextShadowBlurInput.value, 10) || 5
        });
    }

    function handleVideoControl(action) {
        updateAndSendState({ videoCommand: { action: action, timestamp: serverNow() } });
    }

    // One local event timer shared by control, preview and output.
    mainContent.classList.remove('hidden');
    const timerUrl = 'streamcard.html?timerId=event';
    viewTimerLink.href = timerUrl;
    viewTimerLink.classList.remove('hidden');
    previewIframe.src = timerUrl + '&interactive=true';
    initializeLocalListener();
    populateVideoDropdown();

    function populateVideoDropdown() {
        const videoFiles = Array.from({length: 20}, (_, i) => `${i+1}.mp4`);
        Array.from(backgroundVideoSelect.options).forEach(option => {
             if (videoFiles.includes(option.value)) backgroundVideoSelect.remove(option.index);
        });
        videoFiles.forEach(file => {
            let exists = false;
            for(let i=0; i < backgroundVideoSelect.options.length; i++) {
                if (backgroundVideoSelect.options[i].value === file) { exists = true; break; }
            }
            if (!exists) {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                backgroundVideoSelect.appendChild(option);
            }
        });
    }

    // Listeners
    // Start/Stop button click handler (button is now outside the form)
    startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('startBtn clicked, isRunning:', currentTimerState.isRunning, 'isPaused:', currentTimerState.isPaused);
        if (currentTimerState.isRunning) {
            console.log('Calling handleStopTimer');
            handleStopTimer();
        } else {
            console.log('Calling handleStartTimer');
            handleStartTimer();
        }
    });
    pauseBtn.addEventListener('click', handlePauseTimer);
    resumeBtn.addEventListener('click', handleResumeTimer);
    resetBtn.addEventListener('click', handleResetTimer);
    if (resetTimerBtn) resetTimerBtn.addEventListener('click', handleResetTimerOnly);
    toggleMessageVisibilityBtn.addEventListener('click', handleToggleMessageVisibility);
    
    // Reset modal event listeners
    if (resetModalCancel) {
        resetModalCancel.addEventListener('click', () => {
            resetModal.classList.add('hidden');
        });
    }
    if (resetModalConfirm) {
        resetModalConfirm.addEventListener('click', () => {
            resetModal.classList.add('hidden');
            performReset();
        });
    }
    // Close modal on backdrop click
    if (resetModal) {
        resetModal.addEventListener('click', (e) => {
            if (e.target === resetModal) {
                resetModal.classList.add('hidden');
            }
        });
    }
    
    // Timer mode toggle
    timerModeDateTimeRadio.addEventListener('change', () => {
        dateTimeInputContainer.classList.remove('hidden');
        durationInputContainer.classList.add('hidden');
    });
    timerModeDurationRadio.addEventListener('change', () => {
        dateTimeInputContainer.classList.add('hidden');
        durationInputContainer.classList.remove('hidden');
    });
    
    // Hide leading zeros - update state in real-time
    hideLeadingZerosCheckbox.addEventListener('change', () => {
        updateAndSendState({ hideLeadingZeros: hideLeadingZerosCheckbox.checked });
    });
    
    // Loop timer - update state in real-time
    loopTimerCheckbox.addEventListener('change', () => {
        updateAndSendState({ loopTimer: loopTimerCheckbox.checked });
    });
    
    backgroundTypeVideoRadio.addEventListener('change', handleDisplayOptionChange);
    backgroundTypeStillRadio.addEventListener('change', handleDisplayOptionChange);
    backgroundTypeTransparentRadio.addEventListener('change', handleDisplayOptionChange);
    backgroundVideoSelect.addEventListener('change', handleDisplayOptionChange);
    fontFamilySelect.addEventListener('change', handleDisplayOptionChange);
    fontSizeInput.addEventListener('change', handleDisplayOptionChange);
    fontColorInput.addEventListener('input', handleDisplayOptionChange);
    backgroundUploadInput.addEventListener('change', handleBackgroundUpload);
    removeCustomVideoBtn.addEventListener('click', handleRemoveCustomVideo);
    imageUploadInput.addEventListener('change', handleImageUpload);
    removeCustomImageBtn.addEventListener('click', handleRemoveCustomImage);
    overlayImageUploadInput.addEventListener('change', handleOverlayImageUpload);
    vignetteEnabledCheckbox.addEventListener('change', handleVignetteChange);
    vignetteStrengthInput.addEventListener('input', (e) => {
        vignetteStrengthValue.textContent = e.target.value;
        handleVignetteChange();
    });
    backgroundBlurInput.addEventListener('input', (e) => {
        backgroundBlurValue.textContent = e.target.value;
        updateAndSendState({ backgroundBlur: parseInt(e.target.value, 10) });
    });
    fontUploadInput.addEventListener('change', handleFontUpload);
    removeCustomFontBtn.addEventListener('click', handleRemoveCustomFont);
    titleFontUploadInput.addEventListener('change', handleTitleFontUpload);
    removeTitleCustomFontBtn.addEventListener('click', handleRemoveTitleCustomFont);
    messageFontUploadInput.addEventListener('change', handleMessageFontUpload);
    removeMessageCustomFontBtn.addEventListener('click', handleRemoveMessageCustomFont);
    overlayOpacityInput.addEventListener('input', handleOverlayOpacityChange);
    enableClockBorderCheckbox.addEventListener('change', handleClockAppearanceChange);
    clockBorderThicknessInput.addEventListener('change', handleClockAppearanceChange);
    clockBorderColorInput.addEventListener('input', handleClockAppearanceChange);
    clockBackgroundBlurInput.addEventListener('input', (e) => {
        clockBackgroundBlurValue.textContent = `${e.target.value}px`;
        handleClockAppearanceChange();
    });
    clockPaddingInput.addEventListener('input', (e) => {
        clockPaddingValue.textContent = e.target.value;
        handleClockAppearanceChange();
    });
    clockCornerRadiusInput.addEventListener('input', (e) => {
        clockCornerRadiusValue.textContent = e.target.value;
        handleClockAppearanceChange();
    });
    clockTextShadowBlurInput.addEventListener('input', (e) => {
        clockTextShadowBlurValue.textContent = e.target.value;
        handleClockAppearanceChange();
    });
    titleFontFamilySelect.addEventListener('change', handleTitleFormattingChange);
    titleFontSizeInput.addEventListener('input', (e) => {
        titleFontSizeValue.textContent = e.target.value;
        handleTitleFormattingChange();
    });
    titleFontColorInput.addEventListener('input', handleTitleFormattingChange);
    titleTextShadowBlurInput.addEventListener('input', (e) => {
        titleTextShadowBlurValue.textContent = e.target.value;
        handleTitleFormattingChange();
    });
    messageFontFamilySelect.addEventListener('change', handleMessageFormattingChange);
    messageFontSizeInput.addEventListener('input', (e) => {
        messageFontSizeValue.textContent = e.target.value;
        handleMessageFormattingChange();
    });
    messageFontColorInput.addEventListener('input', handleMessageFormattingChange);
    messageTextShadowBlurInput.addEventListener('input', (e) => {
        messageTextShadowBlurValue.textContent = e.target.value;
        handleMessageFormattingChange();
    });
    bgVideoPlayBtn.addEventListener('click', () => handleVideoControl('play'));
    bgVideoPauseBtn.addEventListener('click', () => handleVideoControl('pause'));
    bgVideoRestartBtn.addEventListener('click', () => handleVideoControl('restart'));
    
    // Debounce title input to prevent focus issues
    let titleDebounceTimer = null;
    timerTitleInput.addEventListener('input', () => {
        clearTimeout(titleDebounceTimer);
        titleDebounceTimer = setTimeout(() => {
            updateAndSendState({ title: timerTitleInput.value });
        }, 300);
    });
    targetDateTimeInput.addEventListener('change', () => {
        const dateTimeString = targetDateTimeInput.value;
        const targetDate = new Date(dateTimeString);
        if (!isNaN(targetDate.getTime())) {
            updateAndSendState({ targetDateTimeString: dateTimeString, targetTimestamp: targetDate.getTime() });
        }
    });
    fontSizeInput.addEventListener('input', (e) => document.getElementById('fontSizeValue').textContent = e.target.value);
    clockBorderThicknessInput.addEventListener('input', (e) => document.getElementById('clockBorderThicknessValue').textContent = e.target.value);

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin || event.source !== previewIframe.contentWindow) return;
        if (event.data?.type === 'STREAMCARD_DELETE') {
            const { objectType, id } = event.data;
            if (objectType === 'overlay') {
                const index = (currentTimerState.overlayImages || []).findIndex(item => item.id === id);
                if (index !== -1) removeOverlayImage(index);
            } else if (objectType === 'title') {
                timerTitleInput.value = '';
                updateAndSendState({ title: '' });
            } else if (objectType === 'clock') {
                updateAndSendState({ clockVisible: false });
            } else if (objectType === 'message') {
                realtimeMessageInput.value = '';
                updateAndSendState({ currentMessage: '', isShowingMessage: false });
            }
            return;
        }
        if (event.data?.type === 'STREAMCARD_DROP') {
            handlePreviewDrop(event.data);
            return;
        }
        if (event.data?.type === 'STREAMCARD_FONT_ERROR') {
            showControlError('Lettertype kon niet laden. Controleer het bestand of je verbinding.');
            return;
        }
        if (event.data && event.data.type === 'STREAMCARD_UPDATE') {
            const payload = event.data.payload;
            if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
            
            if (payload.overlayTransform && typeof payload.overlayTransform === 'object') {
                const { id, ...values } = payload.overlayTransform;
                const changes = {};
                for (const [key, value] of Object.entries(values)) {
                    const limit = { posX: [0, 100], posY: [0, 100], scale: [1, 1000], rotation: [-360, 360] }[key];
                    if (limit && Number.isFinite(value) && value >= limit[0] && value <= limit[1]) changes[key] = value;
                }
                if (Object.keys(changes).length) updateAndSendState({ overlayImages: (currentTimerState.overlayImages || []).map(item => item.id === id ? { ...item, ...changes } : item) });
                return;
            }
            // Handle overlay position updates
            if (payload.overlayUpdate) {
                const { id, posX, posY } = payload.overlayUpdate;
                if (![posX, posY].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) return;
                const overlays = [...(currentTimerState.overlayImages || [])];
                const index = overlays.findIndex(o => o.id === id);
                if (index !== -1) {
                    overlays[index] = { ...overlays[index], posX, posY };
                    updateAndSendState({ overlayImages: overlays });
                }
                return;
            }
            
            // Handle overlay scale updates
            if (payload.overlayScaleUpdate) {
                const { id, scale } = payload.overlayScaleUpdate;
                if (!Number.isFinite(scale) || scale <= 0 || scale > 1000) return;
                const overlays = [...(currentTimerState.overlayImages || [])];
                const index = overlays.findIndex(o => o.id === id);
                if (index !== -1) {
                    overlays[index] = { ...overlays[index], scale };
                    updateAndSendState({ overlayImages: overlays });
                }
                return;
            }
            
            const allowed = ['titlePosX', 'titlePosY', 'clockPosX', 'clockPosY', 'messagePosX', 'messagePosY', 'fontSize', 'titleFontSize', 'messageFontSize', 'titleRotation', 'clockRotation', 'messageRotation'];
            const updates = Object.fromEntries(Object.entries(payload).filter(([key, value]) => allowed.includes(key) && Number.isFinite(value)));
            if (Object.keys(updates).length) updateAndSendState(updates);
        }
    });

    function initTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons[0]?.parentElement.setAttribute('role', 'tablist');
        tabButtons.forEach(btn => {
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-controls', `tab-${btn.dataset.tab}`);
            btn.setAttribute('aria-selected', String(btn.dataset.tab === 'timer'));
            document.getElementById(`tab-${btn.dataset.tab}`).setAttribute('role', 'tabpanel');
            btn.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const buttons = [...tabButtons];
                const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (buttons.indexOf(btn) + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
                buttons[index].focus();
                buttons[index].click();
            });
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                tabButtons.forEach(b => {
                    b.setAttribute('aria-selected', String(b.dataset.tab === targetTab));
                    if (b.dataset.tab === targetTab) {
                        b.classList.add('text-blue-500', 'border-b-2', 'border-blue-500');
                        b.classList.remove('text-gray-400');
                    } else {
                        b.classList.remove('text-blue-500', 'border-b-2', 'border-blue-500');
                        b.classList.add('text-gray-400');
                    }
                });
                tabContents.forEach(content => {
                    content.classList.toggle('hidden', content.id !== `tab-${targetTab}`);
                });
            });
        });
    }

    function initCustomDropdown(containerId, inputId, options) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const trigger = container.querySelector('button');
        const list = container.querySelector('div[id$="List"]');
        const input = document.getElementById(inputId);
        const selectedText = container.querySelector('span[id$="SelectedText"]');

        if (input.tagName === 'SELECT') {
            input.replaceChildren(...options.map(opt => new Option(opt.name, opt.value)));
        }
        list.innerHTML = '';
        options.forEach(opt => {
            const div = document.createElement('button');
            div.type = 'button';
            div.className = 'w-full text-left px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200';
            div.style.fontFamily = opt.value;
            div.textContent = opt.name;
            div.dataset.value = opt.value;
            div.addEventListener('click', () => {
                loadFontFamily(opt.value).catch(error => showControlError(error.message));
                input.value = opt.value;
                selectedText.textContent = opt.name;
                selectedText.style.fontFamily = opt.value;
                list.classList.add('hidden');
                input.dispatchEvent(new Event('change'));
            });
            list.appendChild(div);
        });

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('[id$="DropdownList"]').forEach(el => {
                if (el !== list) el.classList.add('hidden');
            });
            list.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) list.classList.add('hidden');
        });
    }

    // Changelog modal
    const changelogLink = document.getElementById('changelogLink');
    const changelogModal = document.getElementById('changelogModal');
    const closeChangelog = document.getElementById('closeChangelog');
    
    if (changelogLink && changelogModal) {
        changelogLink.addEventListener('click', (e) => {
            e.preventDefault();
            changelogModal.classList.remove('hidden');
        });
        
        closeChangelog?.addEventListener('click', () => {
            changelogModal.classList.add('hidden');
        });
        
        changelogModal.addEventListener('click', (e) => {
            if (e.target === changelogModal) {
                changelogModal.classList.add('hidden');
            }
        });
    }

    initTabs();
    initCustomDropdown('fontFamilyDropdownContainer', 'fontFamilySelect', fontOptions);
    initCustomDropdown('titleFontFamilyDropdownContainer', 'titleFontFamilySelect', fontOptions);
    initCustomDropdown('messageFontFamilyDropdownContainer', 'messageFontFamilySelect', fontOptions);
}
