import { createPreviewEditor } from './preview-editor.js';
import { applyFont } from './fonts.js';
import { database, ref, onValue, serverNow } from './local-store.js';

export function initStreamcardPage() {
    let countdownInterval = null;
    let targetTimestamp = 0;
    let lastServerTimestamp = 0; // Track the last timestamp received from Server
    let isPaused = false;
    let pauseTimeRemaining = null;
    let currentTimerId = null;
    let lastAppliedState = {};
    let cursorHideTimeout = null;
    let isInteractiveMode = false;
    const interactiveElements = new Set();
    let editor = null;

    const videoBackground = document.getElementById('videoBackground');
    const imageBackground = document.getElementById('imageBackground');
    const backgroundOverlay = document.getElementById('backgroundOverlay');
    const vignetteOverlay = document.getElementById('vignetteOverlay');
    const overlayImagesContainer = document.getElementById('overlayImagesContainer');
    const timerDisplay = document.getElementById('timerDisplay');
    const waitingMessage = document.getElementById('waitingMessage');
    const timerTitle = document.getElementById('timerTitle');
    const clockWrapper = document.getElementById('clockWrapper');
    const clockElement = document.getElementById('clock');
    const hoursElement = document.getElementById('hours');
    const hoursSeparator = document.getElementById('hoursSeparator');
    const minutesElement = document.getElementById('minutes');
    const minutesSeparator = document.getElementById('minutesSeparator');
    const secondsElement = document.getElementById('seconds');
    const realtimeMessageDisplay = document.getElementById('realtimeMessageDisplay');
    const thankYouMessage = document.getElementById('thankYouMessage');
    
    // Debug: log all clock elements at init
    console.log('Clock elements at init:', {
        clockElement,
        hoursElement,
        hoursSeparator,
        minutesElement,
        minutesSeparator,
        secondsElement
    });

    function setSpecificBackgroundVideo(videoFileName) {
        if (!videoFileName || !videoBackground) return;
        let file = videoFileName;
        const isCustom = !/^\d+\.mp4$/.test(file);

        const videoSourcePath = isCustom ? `/video/${file}` : `./video/${file}`;
        const sourceElement = videoBackground.querySelector('source') || videoBackground;

         if (sourceElement.getAttribute('src') !== videoSourcePath) {
            sourceElement.removeAttribute('type');
            sourceElement.setAttribute('src', videoSourcePath);
            videoBackground.load();
            videoBackground.play().catch(error => console.warn("Autoplay failed:", error.message));
         } else if (videoBackground.paused) {
            videoBackground.play().catch(error => console.warn("Re-play failed:", error.message));
         }
    }

    function setSpecificBackgroundImage(imageFileName) {
        if (!imageFileName || !imageBackground) return;
        const imageSourcePath = `/images/${imageFileName}`;
        if (imageBackground.getAttribute('src') !== imageSourcePath) {
            imageBackground.setAttribute('src', imageSourcePath);
        }
    }

    function setOverlayImage(imageFileName) {
        // Deprecated - now handled by renderOverlayImages
    }
    
    function renderOverlayImages(overlays) {
        if (!overlayImagesContainer) return;
        
        // Get existing overlay elements (can be img, div for lottie, or object for svg)
        const existingElements = overlayImagesContainer.querySelectorAll('[data-overlay-id]');
        const existingIds = new Set();
        existingElements.forEach(el => existingIds.add(el.dataset.overlayId));
        
        const newIds = new Set((overlays || []).map(o => o.id));
        
        // Remove overlays that no longer exist
        existingElements.forEach(el => {
            if (!newIds.has(el.dataset.overlayId)) {
                // Destroy lottie animation if it exists
                if (el.lottieInstance) {
                    el.lottieInstance.destroy();
                }
                interactiveElements.delete(el);
                el.remove();
            }
        });
        
        // Add or update overlays
        (overlays || []).forEach(overlay => {
            const file = overlay.file;
            const fileLower = file.toLowerCase();
            const isLottie = fileLower.endsWith('.json') || fileLower.endsWith('.lottie');
            const isSvg = fileLower.endsWith('.svg');
            
            let element = overlayImagesContainer.querySelector(`[data-overlay-id="${overlay.id}"]`);
            let isNew = false;
            
            if (!element) {
                isNew = true;
                
                if (isLottie) {
                    // Create container for Lottie animation
                    element = document.createElement('div');
                    element.dataset.overlayId = overlay.id;
                    element.className = 'absolute pointer-events-auto';
                    element.style.width = `${200 / 1920 * 100}vw`;
                    element.style.height = `${200 / 1920 * 100}vw`;
                    overlayImagesContainer.appendChild(element);
                    
                    // Load Lottie animation
                    if (typeof lottie !== 'undefined') {
                        element.lottieInstance = lottie.loadAnimation({
                            container: element,
                            renderer: 'svg',
                            loop: true,
                            autoplay: true,
                            path: `/images/${file}`
                        });
                    }
                } else if (isSvg) {
                    // SVG - treat same as regular image, img tag handles SVG fine
                    element = document.createElement('img');
                    element.dataset.overlayId = overlay.id;
                    element.className = 'absolute pointer-events-auto';
                    element.style.maxWidth = '50vw';
                    element.addEventListener('load', () => { element.style.width = `${element.naturalWidth / 1920 * 100}vw`; editor?.refresh(); });
                    element.src = `/images/${file}`;
                    overlayImagesContainer.appendChild(element);
                } else {
                    // Regular image
                    element = document.createElement('img');
                    element.dataset.overlayId = overlay.id;
                    element.className = 'absolute pointer-events-auto';
                    element.style.maxWidth = '50vw';
                    element.addEventListener('load', () => { element.style.width = `${element.naturalWidth / 1920 * 100}vw`; editor?.refresh(); });
                    element.src = `/images/${file}`;
                    overlayImagesContainer.appendChild(element);
                }
            } else {
                // Update existing element source if needed (for non-lottie)
                if (!isLottie) {
                    const imagePath = `/images/${file}`;
                    if (element.tagName === 'IMG' && element.src !== location.origin + imagePath) {
                        element.src = imagePath;
                    }
                }
            }
            
            element.style.left = `${overlay.posX ?? 50}%`;
            element.style.top = `${overlay.posY ?? 50}%`;
            element.style.transform = `translate(-50%, -50%) rotate(${overlay.rotation || 0}deg) scale(${(overlay.scale || 100) / 100})`;
            
            // Make new overlays interactive if in interactive mode
            if (isNew && isInteractiveMode) {
                makeInteractive(element, 'overlay', overlay.id);
            }
        });
    }

    function formatTime(num) {
        return num.toString().padStart(2, '0');
    }

    function updateClockDisplay(totalSeconds, hideLeadingZeros = false) {
        if (totalSeconds < 0) totalSeconds = 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor((totalSeconds % 60));

        // Determine what we should show.
        const showHours = !hideLeadingZeros || hours > 0;
        const showMinutes = !hideLeadingZeros || showHours || minutes > 0;
        const showHoursSeparator = showHours;
        const showMinutesSeparator = showMinutes;

        // Hours
        if (hoursElement) {
            if (showHours) {
                hoursElement.classList.remove('hidden');
                hoursElement.style.display = '';
                hoursElement.textContent = formatTime(hours);
            } else {
                hoursElement.classList.add('hidden');
                hoursElement.style.display = 'none';
                hoursElement.textContent = '';
            }
        }
        if (hoursSeparator) {
            if (showHoursSeparator) {
                hoursSeparator.classList.remove('hidden');
                hoursSeparator.style.display = '';
                hoursSeparator.textContent = ':';
            } else {
                hoursSeparator.classList.add('hidden');
                hoursSeparator.style.display = 'none';
                hoursSeparator.textContent = '';
            }
        }

        // Minutes
        if (minutesElement) {
            if (showMinutes) {
                minutesElement.classList.remove('hidden');
                minutesElement.style.display = '';
                minutesElement.textContent = showHours ? formatTime(minutes) : minutes.toString();
            } else {
                minutesElement.classList.add('hidden');
                minutesElement.style.display = 'none';
                minutesElement.textContent = '';
            }
        }
        if (minutesSeparator) {
            if (showMinutesSeparator) {
                minutesSeparator.classList.remove('hidden');
                minutesSeparator.style.display = '';
                minutesSeparator.textContent = ':';
            } else {
                minutesSeparator.classList.add('hidden');
                minutesSeparator.style.display = 'none';
                minutesSeparator.textContent = '';
            }
        }

        // Seconds
        if (secondsElement) {
            secondsElement.textContent = showMinutes ? formatTime(seconds) : seconds.toString();
        }
    }

    function startCountdownLoop() {
        if (countdownInterval) clearInterval(countdownInterval);
        const tick = () => {
            if (isPaused) return;
            const now = serverNow();
            const remainingMilliseconds = targetTimestamp - now;
            if (remainingMilliseconds <= 0) {
                // Check if loopTimer is enabled and we have duration mode
                if (lastAppliedState.loopTimer && lastAppliedState.timerMode === 'duration') {
                    // Calculate the original duration from saved values
                    const durationHours = lastAppliedState.durationHours || 0;
                    const durationMinutes = lastAppliedState.durationMinutes || 0;
                    const durationSeconds = lastAppliedState.durationSeconds || 0;
                    const totalMs = ((durationHours * 3600) + (durationMinutes * 60) + durationSeconds) * 1000;
                    
                    if (totalMs > 0) {
                        // Reset the timer to the original duration
                        targetTimestamp = serverNow() + totalMs;
                        updateClockDisplay(totalMs / 1000, lastAppliedState.hideLeadingZeros);
                        return; // Continue the loop
                    }
                }
                
                // No loop - timer finished
                clearInterval(countdownInterval);
                countdownInterval = null;
                updateClockDisplay(0, lastAppliedState.hideLeadingZeros);
                timerTitle.classList.remove('fade-in');
                timerTitle.classList.add('fade-out');
                clockWrapper.classList.remove('fade-in');
                clockWrapper.classList.add('fade-out');
                setTimeout(() => {
                    if (!countdownInterval && !isPaused && !lastAppliedState.isShowingMessage) {
                         timerTitle.classList.add('hidden');
                         clockWrapper.classList.add('hidden');
                    }
                }, 500);
                return;
            }
            updateClockDisplay(remainingMilliseconds / 1000, lastAppliedState.hideLeadingZeros);
        };
        countdownInterval = setInterval(tick, 250);
        tick();
    }

    function resetTimerDisplay() {
        clearInterval(countdownInterval);
        countdownInterval = null;
        isPaused = false;
        pauseTimeRemaining = null;
        targetTimestamp = 0;
        lastServerTimestamp = 0;
        lastAppliedState = {};

        timerTitle.textContent = '';
        updateClockDisplay(0);
        timerDisplay.classList.add('hidden');
        timerTitle.classList.add('fade-out', 'hidden');
        clockWrapper.classList.add('fade-out', 'hidden');
        realtimeMessageDisplay.classList.add('fade-out', 'hidden');
        thankYouMessage.classList.add('hidden');
        waitingMessage.classList.remove('hidden');
        waitingMessage.textContent = "";

        timerTitle.style = '';
        clockElement.style = '';
        realtimeMessageDisplay.style = '';
        clockWrapper.style = '';
        if (backgroundOverlay) backgroundOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        if (vignetteOverlay) vignetteOverlay.style.opacity = 0;
        if (overlayImagesContainer) overlayImagesContainer.innerHTML = '';

        document.body.style.cursor = 'default';
        clearTimeout(cursorHideTimeout);
        if (document.fullscreenElement) document.exitFullscreen().catch(e => {});
    }

    function openFullscreen() {
        const elem = document.documentElement;
        if (!document.fullscreenElement) {
            if (elem.requestFullscreen) elem.requestFullscreen().catch(e => {});
            else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        } else {
             if (document.exitFullscreen) document.exitFullscreen().catch(e => {});
        }
    }

    function applyStateToDOM(state) {
        const baseFontSizePx = 16;
        const safeState = {
            isRunning: state.isRunning || false,
            isPaused: state.isPaused || false,
            isShowingMessage: state.isShowingMessage || false,
            title: state.title || '',
            targetTimestamp: state.targetTimestamp || 0,
            pauseTimeRemaining: state.pauseTimeRemaining,
            hideLeadingZeros: state.hideLeadingZeros || false,
            loopTimer: state.loopTimer || false,
            timerMode: state.timerMode || 'datetime',
            durationHours: state.durationHours || 0,
            durationMinutes: state.durationMinutes || 0,
            durationSeconds: state.durationSeconds || 0,
            backgroundType: state.backgroundType || 'video',
            backgroundVideo: state.backgroundVideo || '1.mp4',
            customBackgroundFile: state.customBackgroundFile,
            customImageFile: state.customImageFile,
            overlayImageFile: state.overlayImageFile, // New
            vignetteEnabled: state.vignetteEnabled || false, // New
            vignetteStrength: state.vignetteStrength ?? 50, // New
            backgroundBlur: state.backgroundBlur ?? 0,
            fontFamily: state.fontFamily || "'Inter', sans-serif",
            customFontFile: state.customFontFile,
            fontSize: state.fontSize || 72,
            fontColor: state.fontColor || '#FFFFFF',
            clockBorderEnabled: state.clockBorderEnabled || false,
            clockBorderThickness: state.clockBorderThickness || 0,
            clockBorderColor: state.clockBorderColor || '#FFFFFF',
            clockBackgroundBlur: state.clockBackgroundBlur || 0,
            clockPadding: state.clockPadding || 16,
            clockCornerRadius: state.clockCornerRadius || 0,
            clockTextShadowBlur: state.clockTextShadowBlur || 0,
            currentMessage: state.currentMessage || '',
            titleFontFamily: state.titleFontFamily || state.fontFamily || "'Inter', sans-serif",
            titleCustomFontFile: state.titleCustomFontFile,
            titleFontSize: state.titleFontSize || 43,
            titleFontColor: state.titleFontColor || state.fontColor || '#FFFFFF',
            titleTextShadowBlur: state.titleTextShadowBlur || 0,
            messageFontFamily: state.messageFontFamily || state.fontFamily || "'Inter', sans-serif",
            messageCustomFontFile: state.messageCustomFontFile,
            messageFontSize: state.messageFontSize || 43,
            messageFontColor: state.messageFontColor || state.fontColor || '#FFFFFF',
            messageTextShadowBlur: state.messageTextShadowBlur || 0,
            titlePosX: state.titlePosX !== undefined ? state.titlePosX : 50,
            titlePosY: state.titlePosY !== undefined ? state.titlePosY : 30,
            clockPosX: state.clockPosX !== undefined ? state.clockPosX : 50,
            clockPosY: state.clockPosY !== undefined ? state.clockPosY : 60,
            messagePosX: state.messagePosX !== undefined ? state.messagePosX : 50,
            messagePosY: state.messagePosY !== undefined ? state.messagePosY : 50,
            overlayImages: state.overlayImages || [],
            titleRotation: state.titleRotation ?? 0,
            clockRotation: state.clockRotation ?? 0,
            messageRotation: state.messageRotation ?? 0,
            clockVisible: state.clockVisible !== false,
            timerVisible: state.timerVisible !== false, // Default to true
            overlayOpacity: state.overlayOpacity !== undefined ? state.overlayOpacity : 50,
            videoCommand: state.videoCommand
        };

        // Background
        if (safeState.backgroundType === 'still') {
            if (safeState.customImageFile !== lastAppliedState.customImageFile) {
                setSpecificBackgroundImage(safeState.customImageFile);
                lastAppliedState.customImageFile = safeState.customImageFile;
            }
            imageBackground.classList.remove('hidden');
            videoBackground.classList.add('hidden');
            videoBackground.pause();
        } else if (safeState.backgroundType === 'transparent') {
            imageBackground.classList.add('hidden');
            videoBackground.classList.add('hidden');
            videoBackground.pause();
            document.body.style.backgroundColor = 'transparent';
        } else {
            const videoFile = safeState.customBackgroundFile || safeState.backgroundVideo;
            if (videoFile !== (lastAppliedState.customBackgroundFile || lastAppliedState.backgroundVideo)) {
                setSpecificBackgroundVideo(videoFile);
                lastAppliedState.backgroundVideo = safeState.backgroundVideo;
                lastAppliedState.customBackgroundFile = safeState.customBackgroundFile;
            }
            videoBackground.classList.remove('hidden');
            imageBackground.classList.add('hidden');
        }

        // Overlay Images (multiple)
        renderOverlayImages(safeState.overlayImages);

        // Background Blur
        const blurValue = `blur(${safeState.backgroundBlur}px)`;
        if (videoBackground) videoBackground.style.filter = blurValue;
        if (imageBackground) imageBackground.style.filter = blurValue;

        // Vignette
        if (vignetteOverlay) {
            vignetteOverlay.style.opacity = safeState.vignetteEnabled ? (safeState.vignetteStrength / 100) : 0;
        }

        // Video Command
        const videoCmd = safeState.videoCommand;
        if (videoCmd && videoCmd.timestamp !== lastAppliedState.lastVideoCmdTimestamp) {
            if (videoBackground) {
                if (videoCmd.action === 'play') videoBackground.play().catch(e => {});
                else if (videoCmd.action === 'pause') videoBackground.pause();
                else if (videoCmd.action === 'restart') {
                    videoBackground.currentTime = 0;
                    videoBackground.play().catch(e => {});
                }
            }
            lastAppliedState.lastVideoCmdTimestamp = videoCmd.timestamp;
        }

        // Overlay Opacity
        const newOpacityValue = safeState.overlayOpacity / 100;
        if (backgroundOverlay) backgroundOverlay.style.backgroundColor = `rgba(0, 0, 0, ${newOpacityValue})`;

        applyFont(clockElement, safeState.fontFamily, safeState.customFontFile);
        applyFont(timerTitle, safeState.titleFontFamily, safeState.titleCustomFontFile);
        applyFont(realtimeMessageDisplay, safeState.messageFontFamily, safeState.messageCustomFontFile);

        // Sizes & Colors
        clockElement.style.fontSize = `${safeState.fontSize / baseFontSizePx}rem`;
        realtimeMessageDisplay.style.fontSize = `${safeState.messageFontSize / baseFontSizePx}rem`;
        timerTitle.style.fontSize = `${safeState.titleFontSize / baseFontSizePx}rem`;
        
        clockElement.style.color = safeState.fontColor;
        realtimeMessageDisplay.style.color = safeState.messageFontColor;
        timerTitle.style.color = safeState.titleFontColor;

        // Shadows
        const shadow = (blur, size) => blur > 0 ? `0.08em 0.08em ${blur / size}em rgba(0,0,0,0.8)` : 'none';
        clockElement.style.textShadow = shadow(safeState.clockTextShadowBlur, safeState.fontSize);
        realtimeMessageDisplay.style.textShadow = shadow(safeState.messageTextShadowBlur, safeState.messageFontSize);
        timerTitle.style.textShadow = shadow(safeState.titleTextShadowBlur, safeState.titleFontSize);

        // Clock Wrapper
        clockWrapper.style.padding = `${safeState.clockPadding / baseFontSizePx}rem`;
        clockWrapper.style.borderRadius = `${safeState.clockCornerRadius / baseFontSizePx}rem`;
        clockWrapper.style.border = safeState.clockBorderEnabled ? `${safeState.clockBorderThickness / baseFontSizePx}rem solid ${safeState.clockBorderColor}` : 'none';
        clockWrapper.style.backgroundColor = safeState.clockBorderEnabled ? `${safeState.clockBorderColor}33` : 'transparent';
        clockWrapper.style.backdropFilter = safeState.clockBorderEnabled ? `blur(${safeState.clockBackgroundBlur}px)` : 'none';

        // Positioning
        timerTitle.style.left = `${safeState.titlePosX}%`;
        timerTitle.style.top = `${safeState.titlePosY}%`;
        clockWrapper.style.left = `${safeState.clockPosX}%`;
        clockWrapper.style.top = `${safeState.clockPosY}%`;
        realtimeMessageDisplay.style.left = `${safeState.messagePosX}%`;
        realtimeMessageDisplay.style.top = `${safeState.messagePosY}%`;

        timerTitle.style.transform = `translate(-50%, -50%) rotate(${safeState.titleRotation}deg)`;
        clockWrapper.style.transform = `translate(-50%, -50%) rotate(${safeState.clockRotation}deg)`;
        realtimeMessageDisplay.style.transform = `translate(-50%, -50%) rotate(${safeState.messageRotation}deg)`;

        // Visibility
        isPaused = safeState.isPaused;
        
        // Message is now a separate layer - show/hide independently with fade
        if (safeState.isShowingMessage) {
            realtimeMessageDisplay.textContent = safeState.currentMessage;
            realtimeMessageDisplay.classList.remove('hidden', 'fade-out');
            realtimeMessageDisplay.classList.add('fade-in');
        } else {
            realtimeMessageDisplay.classList.remove('fade-in');
            realtimeMessageDisplay.classList.add('fade-out');
        }
        
        // Timer visibility (can be toggled independently)
        if (safeState.isRunning) {
            waitingMessage.classList.add('hidden');
            timerDisplay.classList.remove('hidden');
            
            // Check if timer should be visible
            if (safeState.timerVisible !== false) {
                timerTitle.classList.remove('hidden', 'fade-out');
                timerTitle.classList.add('fade-in');
                clockWrapper.classList.remove('hidden', 'fade-out');
                clockWrapper.classList.add('fade-in');
            } else {
                timerTitle.classList.add('fade-out');
                clockWrapper.classList.add('fade-out');
            }
            
            timerTitle.textContent = safeState.title;

            // Update lastAppliedState BEFORE starting countdown so hideLeadingZeros is available
            lastAppliedState = {...lastAppliedState, ...safeState};

            if (!safeState.isPaused) {
                // Check if Server timestamp changed - this means we need to restart the countdown
                // Compare against lastServerTimestamp, not the local targetTimestamp which may be modified by looping
                const timestampChanged = safeState.targetTimestamp && safeState.targetTimestamp !== lastServerTimestamp;
                
                if (timestampChanged) {
                    // Always restart when Server timestamp changes (including herstart button)
                    lastServerTimestamp = safeState.targetTimestamp;
                    targetTimestamp = safeState.targetTimestamp;
                    startCountdownLoop();
                } else if (!countdownInterval && targetTimestamp > 0) {
                    // Interval was somehow lost but we have a valid timestamp - restart
                    startCountdownLoop();
                } else if (!countdownInterval && safeState.targetTimestamp > 0) {
                    // No local timestamp but Server has one - start fresh
                    lastServerTimestamp = safeState.targetTimestamp;
                    targetTimestamp = safeState.targetTimestamp;
                    startCountdownLoop();
                } else if (countdownInterval) {
                    // Timer is already running correctly, just update the display with current hideLeadingZeros setting
                    const remainingMs = Math.max(0, targetTimestamp - serverNow());
                    updateClockDisplay(remainingMs / 1000, safeState.hideLeadingZeros);
                }
            } else {
                if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
                updateClockDisplay((safeState.pauseTimeRemaining || 0) / 1000, safeState.hideLeadingZeros);
            }
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            targetTimestamp = 0;
            lastServerTimestamp = 0;
            timerTitle.classList.remove('fade-in');
            timerTitle.classList.add('hidden');
            clockWrapper.classList.remove('fade-in');
            clockWrapper.classList.add('hidden');
            timerDisplay.classList.add('hidden');
            waitingMessage.classList.add('hidden');
        }
        lastAppliedState = {...lastAppliedState, ...safeState};
        if (!safeState.clockVisible) clockWrapper.classList.add('hidden');
        editor?.refresh();
    }

    function initializeServerListener(timerId) {
        if (!timerId) {
            resetTimerDisplay();
            waitingMessage.textContent = "Geen timer ID gevonden.";
            waitingMessage.classList.remove('hidden');
            return;
        }
        currentTimerId = timerId;
        waitingMessage.classList.add('hidden');
        const userTimerStateRef = ref(database, `users/${currentTimerId}/timerState`);
        onValue(userTimerStateRef, (snapshot) => {
            waitingMessage.classList.add('hidden');
            const state = snapshot.val();
            if (!state) { resetTimerDisplay(); return; }
            applyStateToDOM(state);
        }, (error) => {
            waitingMessage.textContent = "Verbinding verbroken; opnieuw verbinden…";
            waitingMessage.classList.remove('hidden');
        });
    }

    function startPage() {
        resetTimerDisplay();
        const params = new URLSearchParams(location.search);
        // Interactivity also requires embedding, so the normal output stays clean.
        if (params.get('interactive') === 'true' && window.parent !== window) enableInteractivity();
        initializeServerListener(params.get('timerId') || 'event');
        if (!isInteractiveMode) document.body.addEventListener('dblclick', openFullscreen);
    }
    if (document.readyState === 'complete') startPage();
    else window.addEventListener('load', startPage, { once: true });

    function makeInteractive(element, type, id = null) {
        editor?.bind(element, type, id);
    }
    function enableInteractivity() {
        isInteractiveMode = true;
        document.body.classList.add('interactive-mode');
        editor = createPreviewEditor({ getState: () => lastAppliedState, remove(selected) {
            window.parent.postMessage({ type: 'STREAMCARD_DELETE', objectType: selected.type, id: selected.id }, location.origin);
        }, send(updates) {
            let local = { ...lastAppliedState, ...updates };
            if (updates.overlayTransform) {
                const { id, ...changes } = updates.overlayTransform;
                local.overlayImages = (lastAppliedState.overlayImages || []).map(item => item.id === id ? { ...item, ...changes } : item);
                delete local.overlayTransform;
            }
            applyStateToDOM(local);
            window.parent.postMessage({ type: 'STREAMCARD_UPDATE', payload: updates }, location.origin);
        }});
        makeInteractive(timerTitle, 'title');
        makeInteractive(clockWrapper, 'clock');
        makeInteractive(realtimeMessageDisplay, 'message');
        document.addEventListener('dragover', event => {
            if (![...event.dataTransfer.types].includes('Files')) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
            document.body.classList.add('file-dragover');
        });
        document.addEventListener('dragleave', event => { if (!event.relatedTarget) document.body.classList.remove('file-dragover'); });
        document.addEventListener('drop', event => {
            event.preventDefault(); document.body.classList.remove('file-dragover');
            window.parent.postMessage({ type: 'STREAMCARD_DROP', files: [...event.dataTransfer.files], posX: event.clientX / innerWidth * 100, posY: event.clientY / innerHeight * 100 }, location.origin);
        });
    }
}
