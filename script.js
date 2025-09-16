// Global variables
let canvas = document.getElementById('canvas');
let controls = document.getElementById('controls');
let zoomIndicator = document.getElementById('zoomIndicator');
let pasteIndicator = document.getElementById('pasteIndicator');
let mobileModal = document.getElementById('mobileModal');
let touchIndicator = document.getElementById('touchIndicator');

let draggedElement = null;
let offset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let canvasOffset = { x: 0, y: 0 };
let scale = 1;
let lastMousePosition = { x: 0, y: 0 };
let smoothTransition = false;

// Mobile specific variables
let longPressTimer = null;
let longPressStarted = false;
let touchStartPos = { x: 0, y: 0 };
let lastTouchPos = { x: 0, y: 0 };
let modalPosition = { x: 0, y: 0 };

// Initialize app
window.addEventListener('load', () => {
    controls.classList.add('show');
    pasteIndicator.classList.add('show');
    
    setTimeout(() => {
        controls.classList.remove('show');
        pasteIndicator.classList.remove('show');
    }, 4000);
    
    // Initialize canvas position
    canvasOffset.x = window.innerWidth / 2;
    canvasOffset.y = window.innerHeight / 2;
    updateCanvasTransform();
});

// Mouse tracking for paste location (Desktop)
document.addEventListener('mousemove', (e) => {
    // Convert screen coordinates to canvas coordinates
    const rect = canvas.getBoundingClientRect();
    lastMousePosition.x = (e.clientX - rect.left) / scale;
    lastMousePosition.y = (e.clientY - rect.top) / scale;

    if (draggedElement && !isPanning) {
        // Handle item dragging
        const x = lastMousePosition.x - offset.x;
        const y = lastMousePosition.y - offset.y;
        
        draggedElement.style.left = `${x}px`;
        draggedElement.style.top = `${y}px`;
    } else if (isPanning && !draggedElement) {
        // Handle canvas panning
        const deltaX = e.clientX - panStart.x;
        const deltaY = e.clientY - panStart.y;
        
        canvasOffset.x += deltaX;
        canvasOffset.y += deltaY;
        
        updateCanvasTransform();
        
        panStart.x = e.clientX;
        panStart.y = e.clientY;
    }
});

// Desktop mouse events
document.addEventListener('mousedown', (e) => {
    if (e.target === document.body || e.target === canvas) {
        isPanning = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        document.body.classList.add('grabbing');
        canvas.classList.remove('smooth');
    }
});

document.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        document.body.classList.remove('grabbing');
        canvas.classList.add('smooth');
    }
    
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
    }
});

// Touch events for mobile
document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartPos.x = touch.clientX;
    touchStartPos.y = touch.clientY;
    lastTouchPos.x = touch.clientX;
    lastTouchPos.y = touch.clientY;
    
    // Convert touch coordinates to canvas coordinates
    const rect = canvas.getBoundingClientRect();
    lastMousePosition.x = (touch.clientX - rect.left) / scale;
    lastMousePosition.y = (touch.clientY - rect.top) / scale;
    
    // Check if touching content item
    if (e.target.closest('.content-item')) {
        const item = e.target.closest('.content-item');
        if (!e.target.classList.contains('delete-btn')) {
            draggedElement = item;
            item.classList.add('dragging');
            
            const rect = item.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            
            offset.x = (touch.clientX - canvasRect.left) / scale - parseFloat(item.style.left);
            offset.y = (touch.clientY - canvasRect.top) / scale - parseFloat(item.style.top);
        }
        return;
    }
    
    // Start long press timer for canvas touch
    if (e.target === document.body || e.target === canvas) {
        longPressTimer = setTimeout(() => {
            showLongPressIndicator(touch.clientX, touch.clientY);
            longPressStarted = true;
            modalPosition.x = lastMousePosition.x;
            modalPosition.y = lastMousePosition.y;
        }, 500);
        
        // Start panning
        isPanning = true;
        panStart.x = touch.clientX;
        panStart.y = touch.clientY;
        canvas.classList.remove('smooth');
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    
    // Update last touch position for canvas coordinates
    const rect = canvas.getBoundingClientRect();
    lastMousePosition.x = (touch.clientX - rect.left) / scale;
    lastMousePosition.y = (touch.clientY - rect.top) / scale;
    
    // Cancel long press if moved too much
    if ((deltaX > 10 || deltaY > 10) && longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        hideLongPressIndicator();
    }
    
    // Handle item dragging
    if (draggedElement && !isPanning) {
        const x = lastMousePosition.x - offset.x;
        const y = lastMousePosition.y - offset.y;
        
        draggedElement.style.left = `${x}px`;
        draggedElement.style.top = `${y}px`;
        e.preventDefault();
        return;
    }
    
    // Handle canvas panning
    if (isPanning && !draggedElement) {
        const deltaX = touch.clientX - panStart.x;
        const deltaY = touch.clientY - panStart.y;
        
        canvasOffset.x += deltaX;
        canvasOffset.y += deltaY;
        
        updateCanvasTransform();
        
        panStart.x = touch.clientX;
        panStart.y = touch.clientY;
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    // Clear long press timer
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    
    // Handle long press completion
    if (longPressStarted) {
        longPressStarted = false;
        hideLongPressIndicator();
        showMobileModal();
        e.preventDefault();
        return;
    }
    
    // End panning
    if (isPanning) {
        isPanning = false;
        canvas.classList.add('smooth');
    }
    
    // End item dragging
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
    }
}, { passive: false });

// Prevent default touch behaviors
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

// Zoom functionality (Desktop)
document.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const zoomIntensity = 0.1;
    const zoomFactor = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
    
    // Get mouse position relative to viewport
    const mouseX = e.clientX - window.innerWidth / 2;
    const mouseY = e.clientY - window.innerHeight / 2;
    
    // Zoom towards mouse position
    canvasOffset.x -= mouseX * (zoomFactor - 1);
    canvasOffset.y -= mouseY * (zoomFactor - 1);
    
    scale *= zoomFactor;
    scale = Math.max(0.1, Math.min(5, scale)); // Limit zoom range
    
    updateCanvasTransform();
    showZoomIndicator();
});

// Mobile pinch zoom
let lastPinchDistance = 0;

document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        const distance = getPinchDistance(e.touches[0], e.touches[1]);
        lastPinchDistance = distance;
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        const distance = getPinchDistance(e.touches[0], e.touches[1]);
        const zoomFactor = distance / lastPinchDistance;
        
        // Get pinch center
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        const mouseX = centerX - window.innerWidth / 2;
        const mouseY = centerY - window.innerHeight / 2;
        
        canvasOffset.x -= mouseX * (zoomFactor - 1);
        canvasOffset.y -= mouseY * (zoomFactor - 1);
        
        scale *= zoomFactor;
        scale = Math.max(0.1, Math.min(5, scale));
        
        updateCanvasTransform();
        showZoomIndicator();
        
        lastPinchDistance = distance;
        e.preventDefault();
    }
}, { passive: false });

function getPinchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Long press indicator functions
function showLongPressIndicator(x, y) {
    touchIndicator.style.left = `${x - 30}px`;
    touchIndicator.style.top = `${y - 30}px`;
    touchIndicator.classList.add('show');
    touchIndicator.classList.add('pulse');
}

function hideLongPressIndicator() {
    touchIndicator.classList.remove('show');
    touchIndicator.classList.remove('pulse');
}

// Mobile modal functions
function showMobileModal() {
    mobileModal.classList.add('show');
    document.getElementById('contentInput').focus();
}

function hideMobileModal() {
    mobileModal.classList.remove('show');
    document.getElementById('contentInput').value = '';
    document.getElementById('imageInput').value = '';
}

// Modal event listeners
document.getElementById('closeModal').addEventListener('click', hideMobileModal);
document.getElementById('cancelModal').addEventListener('click', hideMobileModal);

document.getElementById('addContent').addEventListener('click', () => {
    const content = document.getElementById('contentInput').value.trim();
    const imageInput = document.getElementById('imageInput');
    
    if (imageInput.files.length > 0) {
        // Handle image
        const file = imageInput.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            createImageItem(event.target.result, modalPosition.x, modalPosition.y);
        };
        reader.readAsDataURL(file);
    } else if (content) {
        // Handle text content
        createTextItem(content, modalPosition.x, modalPosition.y);
    }
    
    hideMobileModal();
});

// Click outside modal to close
mobileModal.addEventListener('click', (e) => {
    if (e.target === mobileModal) {
        hideMobileModal();
    }
});

function updateCanvasTransform() {
    canvas.style.transform = `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`;
}

function showZoomIndicator() {
    zoomIndicator.textContent = `Zoom: ${Math.round(scale * 100)}%`;
    zoomIndicator.classList.add('show');
    
    clearTimeout(zoomIndicator.timeout);
    zoomIndicator.timeout = setTimeout(() => {
        zoomIndicator.classList.remove('show');
    }, 1000);
}

// Handle paste events (Desktop)
document.addEventListener('paste', async (e) => {
    e.preventDefault();
    
    const items = e.clipboardData.items;
    const text = e.clipboardData.getData('text');
    
    // Use tracked mouse position
    const x = lastMousePosition.x;
    const y = lastMousePosition.y;
    
    // Handle images first
    for (let item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                createImageItem(event.target.result, x, y);
            };
            reader.readAsDataURL(file);
            return;
        }
    }
    
    // Handle text content
    if (text.trim()) {
        createTextItem(text, x, y);
    }
});

function createTextItem(text, x, y) {
    const item = document.createElement('div');
    item.className = 'content-item';
    item.style.left = `${x - 75}px`;
    item.style.top = `${y - 25}px`;
    
    // Check if it's a YouTube URL
    if (isYouTubeUrl(text)) {
        const videoId = extractYouTubeId(text);
        item.innerHTML = `
            <iframe class="youtube-content" 
                    src="https://www.youtube.com/embed/${videoId}" 
                    allowfullscreen>
            </iframe>
            <button class="delete-btn" onclick="deleteItem(this)">×</button>
        `;
    }
    // Check if it's a URL
    else if (isUrl(text)) {
        item.innerHTML = `
            <a href="${text}" class="link-content" target="_blank">${text}</a>
            <button class="delete-btn" onclick="deleteItem(this)">×</button>
        `;
    }
    // Regular text
    else {
        item.innerHTML = `
            <div class="text-content">${escapeHtml(text)}</div>
            <button class="delete-btn" onclick="deleteItem(this)">×</button>
        `;
    }
    
    addDragFunctionality(item);
    canvas.appendChild(item);
    
    // Add entrance animation
    item.style.opacity = '0';
    item.style.transform = 'translateZ(-100px) scale(0.8)';
    
    requestAnimationFrame(() => {
        item.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        item.style.opacity = '1';
        item.style.transform = 'translateZ(0) scale(1)';
    });
}

function createImageItem(src, x, y) {
    const item = document.createElement('div');
    item.className = 'content-item';
    item.style.left = `${x - 100}px`;
    item.style.top = `${y - 50}px`;
    
    item.innerHTML = `
        <img class="image-content" src="${src}" alt="Pasted image">
        <button class="delete-btn" onclick="deleteItem(this)">×</button>
    `;
    
    addDragFunctionality(item);
    canvas.appendChild(item);
    
    // Add entrance animation
    item.style.opacity = '0';
    item.style.transform = 'translateZ(-100px) scale(0.8)';
    
    requestAnimationFrame(() => {
        item.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        item.style.opacity = '1';
        item.style.transform = 'translateZ(0) scale(1)';
    });
}

function addDragFunctionality(element) {
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        
        e.stopPropagation();
        draggedElement = element;
        element.classList.add('dragging');
        
        const rect = element.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        offset.x = (e.clientX - canvasRect.left) / scale - parseFloat(element.style.left);
        offset.y = (e.clientY - canvasRect.top) / scale - parseFloat(element.style.top);
        
        e.preventDefault();
    });
}

function deleteItem(button) {
    const item = button.parentElement;
    item.style.transition = 'all 0.3s ease';
    item.style.transform = 'translateZ(-100px) scale(0.8)';
    item.style.opacity = '0';
    
    setTimeout(() => {
        item.remove();
    }, 300);
}

function isUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function isYouTubeUrl(url) {
    return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/.test(url);
}

function extractYouTubeId(url) {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close modal if open
        if (mobileModal.classList.contains('show')) {
            hideMobileModal();
            return;
        }
        
        // Reset view
        canvasOffset.x = window.innerWidth / 2;
        canvasOffset.y = window.innerHeight / 2;
        scale = 1;
        canvas.classList.add('smooth');
        updateCanvasTransform();
        showZoomIndicator();
    }
});

// Prevent context menu on right click
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Prevent default drag and drop
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Prevent zoom on double tap (iOS Safari)
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Prevent pull to refresh on mobile
document.body.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && window.scrollY === 0) {
        e.preventDefault();
    }
}, { passive: false });

document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });