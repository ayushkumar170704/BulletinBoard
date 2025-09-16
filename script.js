let canvas = document.getElementById('canvas');
let controls = document.getElementById('controls');
let zoomIndicator = document.getElementById('zoomIndicator');
let pasteIndicator = document.getElementById('pasteIndicator');

let draggedElement = null;
let offset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let canvasOffset = { x: 0, y: 0 };
let scale = 1;
let lastMousePosition = { x: 0, y: 0 };
let smoothTransition = false;

// Show controls and paste indicator on load
window.addEventListener('load', () => {
    controls.classList.add('show');
    pasteIndicator.classList.add('show');
    
    setTimeout(() => {
        controls.classList.remove('show');
        pasteIndicator.classList.remove('show');
    }, 4000);
});

// Mouse tracking for paste location
document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    lastMousePosition.x = (e.clientX - rect.left) / scale;
    lastMousePosition.y = (e.clientY - rect.top) / scale;

    if (draggedElement && !isPanning) {
        const x = lastMousePosition.x - offset.x;
        const y = lastMousePosition.y - offset.y;
        
        draggedElement.style.left = `${x}px`;
        draggedElement.style.top = `${y}px`;
    } else if (isPanning && !draggedElement) {
        const deltaX = e.clientX - panStart.x;
        const deltaY = e.clientY - panStart.y;
        
        canvasOffset.x += deltaX;
        canvasOffset.y += deltaY;
        
        updateCanvasTransform();
        
        panStart.x = e.clientX;
        panStart.y = e.clientY;
    }
});

// Pan start
document.addEventListener('mousedown', (e) => {
    if (e.target === document.body || e.target === canvas) {
        isPanning = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        document.body.classList.add('grabbing');
        canvas.classList.remove('smooth');
    }
});

// Pan end
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

// Zoom functionality
document.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const zoomIntensity = 0.1;
    const zoomFactor = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
    
    const mouseX = e.clientX - window.innerWidth / 2;
    const mouseY = e.clientY - window.innerHeight / 2;
    
    canvasOffset.x -= mouseX * (zoomFactor - 1);
    canvasOffset.y -= mouseY * (zoomFactor - 1);
    
    scale *= zoomFactor;
    scale = Math.max(0.1, Math.min(5, scale));
    
    updateCanvasTransform();
    showZoomIndicator();
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

// Handle paste events
document.addEventListener('paste', async (e) => {
    e.preventDefault();
    
    const items = e.clipboardData.items;
    const text = e.clipboardData.getData('text');
    
    const x = lastMousePosition.x;
    const y = lastMousePosition.y;
    
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
    
    if (text.trim()) {
        createTextItem(text, x, y);
    }
});

function createTextItem(text, x, y) {
    const item = document.createElement('div');
    item.className = 'content-item';
    item.style.left = `${x - 75}px`;
    item.style.top = `${y - 25}px`;
    
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
    else if (isUrl(text)) {
        item.innerHTML = `
            <a href="${text}" class="link-content" target="_blank">${text}</a>
            <button class="delete-btn" onclick="deleteItem(this)">×</button>
        `;
    }
    else {
        item.innerHTML = `
            <div class="text-content">${escapeHtml(text)}</div>
            <button class="delete-btn" onclick="deleteItem(this)">×</button>
        `;
    }
    
    addDragFunctionality(item);
    canvas.appendChild(item);
    
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        canvasOffset.x = 0;
        canvasOffset.y = 0;
        scale = 1;
        canvas.classList.add('smooth');
        updateCanvasTransform();
        showZoomIndicator();
    }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

canvasOffset.x = window.innerWidth / 2;
canvasOffset.y = window.innerHeight / 2;
updateCanvasTransform();
