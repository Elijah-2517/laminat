document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const wallsContainer = document.getElementById('wallsContainer');
    const addWallBtn = document.getElementById('addWallBtn');
    const autoCloseBtn = document.getElementById('autoCloseBtn');
    const resetRoomBtn = document.getElementById('resetRoomBtn');
    const roomError = document.getElementById('roomError');
    const cutMapTableBody = document.querySelector('#cutMapTable tbody');

    const qbIdle = document.getElementById('qbIdle');
    const qbActive = document.getElementById('qbActive');
    const qbDirIcon = document.getElementById('qbDirIcon');
    const qbLength = document.getElementById('qbLength');

    const canvas = document.getElementById('roomCanvas');
    const ctx = canvas.getContext('2d');

    const lamLengthInput = document.getElementById('lamLength');
    const lamWidthInput = document.getElementById('lamWidth');
    const minLeftoverInput = document.getElementById('minLeftover');
    const minOverlapInput = document.getElementById('minOverlap');
    const lamInPackInput = document.getElementById('lamInPack');
    const startCornerSelect = document.getElementById('startCorner');
    const wallOffsetInput = document.getElementById('wallOffset');
    const manualRowWidthInput = document.getElementById('manualRowWidth');
    const manualFirstBoardLengthInput = document.getElementById('manualFirstBoardLength');
    const fullRowBtn = document.getElementById('fullRowBtn');
    const fullBoardBtn = document.getElementById('fullBoardBtn');
    const calcRowWidthDisplay = document.getElementById('calcRowWidthDisplay');
    const rowWidthWarning = document.getElementById('rowWidthWarning');
    const swapRowBtn = document.getElementById('swapRowBtn');
    const lblManualRow = document.getElementById('lblManualRow');
    const showLocksCheck = document.getElementById('showLocks');

    let manualRowMode = 'first';

    const INPUTS = [lamLengthInput, lamWidthInput, minLeftoverInput, minOverlapInput, lamInPackInput, startCornerSelect, wallOffsetInput, manualRowWidthInput, manualFirstBoardLengthInput];

    if (fullRowBtn) {
        fullRowBtn.addEventListener('click', () => {
            manualRowWidthInput.value = lamWidthInput.value;
            queueDraw(0);
        });
    }

    if (fullBoardBtn) {
        fullBoardBtn.addEventListener('click', () => {
            manualFirstBoardLengthInput.value = '';
            queueDraw(0);
        });
    }

    if (swapRowBtn) {
        swapRowBtn.addEventListener('click', () => {
            manualRowMode = manualRowMode === 'first' ? 'last' : 'first';
            lblManualRow.textContent = manualRowMode === 'first' ? 'Ширина первого ряда' : 'Ширина последнего ряда';
            saveState();
            queueDraw(0);
        });
    }

    if (showLocksCheck) {
        showLocksCheck.addEventListener('change', () => {
            const ll = document.getElementById('locksLegend');
            if (ll) ll.style.display = showLocksCheck.checked ? 'flex' : 'none';
            drawCanvas();
        });
    }

    const toggleInstallModeBtn = document.getElementById('toggleInstallModeBtn');
    if (toggleInstallModeBtn) {
        toggleInstallModeBtn.addEventListener('click', () => {
            let isInstall = document.body.classList.contains('install-mode');
            if (isInstall) {
                installZoom = scaleZoom; installPanX = panX; installPanY = panY;
                document.body.classList.remove('install-mode');
                scaleZoom = normalZoom; panX = normalPanX; panY = normalPanY;
            } else {
                normalZoom = scaleZoom; normalPanX = panX; normalPanY = panY;
                document.body.classList.add('install-mode');
                scaleZoom = installZoom; panX = installPanX; panY = installPanY;
            }
            toggleInstallModeBtn.textContent = document.body.classList.contains('install-mode') ? 'Выйти из режима' : 'Режим укладки (Во весь экран)';
            drawCanvas();
        });
    }

    const backToCanvasBtn = document.getElementById('backToCanvasBtn');
    if (backToCanvasBtn) {
        backToCanvasBtn.addEventListener('click', () => {
            canvasWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
            backToCanvasBtn.style.display = 'none';
        });
    }

    // Canvas Auto Resize when full screen toggles
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    if (canvasWrapper) {
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                canvas.width = entry.contentRect.width;
                canvas.height = entry.contentRect.height;
                drawCanvas();
            }
        });
        ro.observe(canvasWrapper);
    }

    // State
    let walls = [];
    let boardsMap = [];
    let pieceStates = {}; // Stores interactive states
    let currentLayout = null; // Cache for drawing

    // Canvas Pan & Zoom state
    let scaleZoom = 1;
    let panX = 0;
    let panY = 0;
    
    let installZoom = 1, installPanX = 0, installPanY = 0;
    let normalZoom = 1, normalPanX = 0, normalPanY = 0;
    
    let isDragging = false;
    let startDragX, startDragY;

    // Storage
    function saveState() {
        const data = {
            walls: walls,
            lamL: lamLengthInput.value,
            lamW: lamWidthInput.value,
            minLeftover: minLeftoverInput.value,
            minOverlap: minOverlapInput.value,
            pack: lamInPackInput.value,
            corner: startCornerSelect.value,
            wallOffset: wallOffsetInput.value,
            manualRowW: manualRowWidthInput.value,
            manualFirstBoardLen: manualFirstBoardLengthInput.value,
            manualRowMode: manualRowMode
        };
        localStorage.setItem('laminatorDataV3', JSON.stringify(data));
    }

    function loadState() {
        try {
            const data = JSON.parse(localStorage.getItem('laminatorDataV3'));
            let fallbackData = JSON.parse(localStorage.getItem('laminatorDataV2'));
            let finalData = data || fallbackData;

            if (finalData && finalData.walls && finalData.walls.length > 0) {
                walls = finalData.walls;
                lamLengthInput.value = finalData.lamL || 1380;
                lamWidthInput.value = finalData.lamW || 193;
                minLeftoverInput.value = finalData.minLeftover || 300;
                minOverlapInput.value = finalData.minOverlap || 400;
                lamInPackInput.value = finalData.pack || 8;
                if (finalData.corner) startCornerSelect.value = finalData.corner;
                if (finalData.wallOffset !== undefined) wallOffsetInput.value = finalData.wallOffset;
                if (finalData.manualRowW !== undefined || finalData.firstRowW !== undefined) {
                    manualRowWidthInput.value = finalData.manualRowW || finalData.firstRowW || '';
                }
                if (finalData.manualFirstBoardLen !== undefined) {
                    manualFirstBoardLengthInput.value = finalData.manualFirstBoardLen || '';
                }
                if (finalData.manualRowMode) {
                    manualRowMode = finalData.manualRowMode;
                    lblManualRow.textContent = manualRowMode === 'first' ? 'Ширина первого ряда' : 'Ширина последнего ряда';
                }
                return true;
            }
        } catch (e) { console.error(e); }
        return false;
    }

    if (!loadState()) {
        walls.push({ dir: 'right', len: 4000 });
        walls.push({ dir: 'down', len: 3000 });
        walls.push({ dir: 'left', len: 4000 });
        walls.push({ dir: 'up', len: 3000 });
        saveState();
    }

    renderWallsList();
    processAndDraw();

    // Canvas Events (Pan & Zoom)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const rawZoom = e.deltaY < 0 ? 1.1 : 0.9;
        scaleZoom *= rawZoom;

        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        panX = mouseX - cx - (mouseX - cx - panX) * rawZoom;
        panY = mouseY - cy - (mouseY - cy - panY) * rawZoom;

        drawCanvas();
    });

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        startDragX = e.clientX - panX;
        startDragY = e.clientY - panY;
        canvas.dataset.startX = e.clientX;
        canvas.dataset.startY = e.clientY;
    });
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            panX = e.clientX - startDragX;
            panY = e.clientY - startDragY;
            drawCanvas();
            return;
        }

        if (!currentLayout || !currentLayout.layoutBoards) {
            canvas.style.cursor = 'default';
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const { minX, maxX, minY, maxY, layoutBoards } = currentLayout;
        let rwOrig = maxX - minX; let rhOrig = maxY - minY;
        let rw = rwOrig;
        let rh = rhOrig;
        if (rw === 0) rw = 1; if (rh === 0) rh = 1;
        
        let baseScale = Math.min((canvas.width * 0.45) / rw, (canvas.height * 0.45) / rh);
        let activeScale = baseScale * scaleZoom;
        let offX = -rwOrig * activeScale / 2 - minX * activeScale;
        let offY = -rhOrig * activeScale / 2 - minY * activeScale;

        let cx = canvas.width/2 + panX;
        let cy = canvas.height/2 + panY;
        let rotX = mouseX - cx;
        let rotY = mouseY - cy;
        
        let isHovering = false;
        
        let activePId = null;
        let activeFullLabel = null;
        for (let key in pieceStates) {
            if (pieceStates[key] === 'in_progress') { 
                activeFullLabel = key;
                activePId = key.split('.')[0]; 
                break; 
            }
        }

        if (isInstallMode && activePId && mouseX >= canvas.width - 480 && mouseX <= canvas.width - 30 && mouseY >= 30 && mouseY <= 280) {
             let hudX = canvas.width - 480, hudY = 30, hudW = 450, hudH = 250;
             if (mouseX >= hudX + hudW - 40 && mouseX <= hudX + hudW - 10 && mouseY >= hudY + 10 && mouseY <= hudY + 40) {
                 canvas.style.cursor = 'pointer';
                 return;
             }
             if (mouseX >= hudX + 20 && mouseX <= hudX + 110 && mouseY >= hudY + hudH - 50 && mouseY <= hudY + hudH - 14) {
                 canvas.style.cursor = 'pointer';
                 return;
             }
             if (mouseX >= hudX + hudW - 110 && mouseX <= hudX + hudW - 20 && mouseY >= hudY + hudH - 50 && mouseY <= hudY + hudH - 14) {
                 canvas.style.cursor = 'pointer';
                 return;
             }
             canvas.style.cursor = 'default';
             return;
        }
        for (let i = layoutBoards.length - 1; i >= 0; i--) {
            let b = layoutBoards[i];
            let rx = b.x * activeScale + offX;
            let ry = b.y * activeScale + offY;
            let rwBox = b.w * activeScale;
            let rhBox = b.h * activeScale;
            if (rotX >= rx && rotX <= rx + rwBox && rotY >= ry && rotY <= ry + rhBox) {
                isHovering = true;
                break;
            }
        }
        canvas.style.cursor = isHovering ? 'pointer' : 'default';
    });
    canvas.addEventListener('mouseup', (e) => {
        isDragging = false;
        let dx = Math.abs(e.clientX - Number(canvas.dataset.startX || e.clientX));
        let dy = Math.abs(e.clientY - Number(canvas.dataset.startY || e.clientY));
        if (dx < 5 && dy < 5) {
            handleCanvasClick(e);
        }
    });
    canvas.addEventListener('mouseleave', () => isDragging = false);

    function handleCanvasClick(e) {
        if (!currentLayout || !currentLayout.layoutBoards) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const { minX, maxX, minY, maxY, layoutBoards } = currentLayout;
        let rwOrig = maxX - minX; let rhOrig = maxY - minY;
        let rw = rwOrig;
        let rh = rhOrig;
        if (rw === 0) rw = 1; if (rh === 0) rh = 1;
        
        let baseScale = Math.min((canvas.width * 0.45) / rw, (canvas.height * 0.45) / rh);
        let activeScale = baseScale * scaleZoom;
        let offX = -rwOrig * activeScale / 2 - minX * activeScale;
        let offY = -rhOrig * activeScale / 2 - minY * activeScale;

        let cx = canvas.width/2 + panX;
        let cy = canvas.height/2 + panY;
        
        let dxScreen = mouseX - cx;
        let dyScreen = mouseY - cy;
        let rotX = dxScreen, rotY = dyScreen;

        let isInstallMode = document.body.classList.contains('install-mode');
        
        let activePId = null;
        let activeFullLabel = null;
        for (let key in pieceStates) {
            if (pieceStates[key] === 'in_progress') { 
                activeFullLabel = key;
                activePId = key.split('.')[0]; 
                break; 
            }
        }

        if (isInstallMode && activePId && mouseX >= canvas.width - 480 && mouseX <= canvas.width - 30 && mouseY >= 30 && mouseY <= 280) {
             let hudX = canvas.width - 480, hudY = 30, hudW = 450, hudH = 250;
             
             if (mouseX >= hudX + hudW - 40 && mouseX <= hudX + hudW - 10 && mouseY >= hudY + 10 && mouseY <= hudY + 40) {
                 for (let key in pieceStates) {
                    if (pieceStates[key] === 'in_progress') pieceStates[key] = 'waiting';
                    if (pieceStates[key] === 'in_progress_sibling') pieceStates[key] = 'waiting';
                 }
                 panX += 225;
                 drawCanvas();
                 highlightActiveTableRows();
                 return;
             }

             if (mouseX >= hudX + 20 && mouseX <= hudX + 110 && mouseY >= hudY + hudH - 50 && mouseY <= hudY + hudH - 14) {
                 switchToAdjacentPiece(activeFullLabel, -1);
                 return;
             }

             if (mouseX >= hudX + hudW - 110 && mouseX <= hudX + hudW - 20 && mouseY >= hudY + hudH - 50 && mouseY <= hudY + hudH - 14) {
                 switchToAdjacentPiece(activeFullLabel, 1);
                 return;
             }
             return;
        }

        for (let i = layoutBoards.length - 1; i >= 0; i--) {
            let b = layoutBoards[i];
            let rx = b.x * activeScale + offX;
            let ry = b.y * activeScale + offY;
            let rwBox = b.w * activeScale;
            let rhBox = b.h * activeScale;
            
            if (rotX >= rx && rotX <= rx + rwBox && rotY >= ry && rotY <= ry + rhBox) {
                let pId = b.label.split('.')[0];
                let isInstallMode = document.body.classList.contains('install-mode');

                if (!isInstallMode) {
                    // Normal mode click
                    for (let key in pieceStates) {
                        if (pieceStates[key] === 'normal_selected' || pieceStates[key] === 'normal_selected_sibling') {
                           pieceStates[key] = 'default';
                        }
                    }
                    
                    let curState = pieceStates[b.label] || 'default';
                    
                    if (curState === 'default') {
                        pieceStates[b.label] = 'normal_selected';
                        layoutBoards.forEach(lb => {
                            if (lb.label !== b.label && lb.label.split('.')[0] === pId) {
                                if (!pieceStates[lb.label] || pieceStates[lb.label] === 'default') {
                                    pieceStates[lb.label] = 'normal_selected_sibling';
                                }
                            }
                        });
                        highlightActiveTableRows(pId);
                    } else if (curState === 'normal_selected') {
                        pieceStates[b.label] = 'default';
                        highlightActiveTableRows();
                    } else {
                        // Installation states (in_progress, done, waiting). Do not modify state, just jump to list
                        highlightActiveTableRows(pId);
                    }

                    if (document.getElementById('backToCanvasBtn')) {
                        document.getElementById('backToCanvasBtn').style.display = 'block';
                    }
                    drawCanvas();
                    return;
                }

                let currentState = pieceStates[b.label] || 'default';

                if (currentState === 'default' || currentState === 'waiting' || currentState === 'in_progress_sibling' || currentState === 'normal_selected' || currentState === 'normal_selected_sibling') {
                    
                    for (let key in pieceStates) {
                        if (pieceStates[key] === 'in_progress' || pieceStates[key] === 'in_progress_sibling') {
                            pieceStates[key] = 'default';
                        }
                    }

                    pieceStates[b.label] = 'in_progress';
                    layoutBoards.forEach(lb => {
                        if (lb.label !== b.label && lb.label.split('.')[0] === pId) {
                            if (!pieceStates[lb.label] || pieceStates[lb.label] === 'default') {
                                pieceStates[lb.label] = 'in_progress_sibling';
                            }
                        }
                    });
                    
                    if (document.body.classList.contains('install-mode')) {
                        let targetActiveScale = Math.min((canvas.width * 0.7) / b.w, (canvas.height * 0.7) / b.h);
                        targetActiveScale = Math.min(targetActiveScale, baseScale * 25); 
                        scaleZoom = targetActiveScale / baseScale;
                        activeScale = baseScale * scaleZoom; 
                        
                        let newOffX = -rwOrig * activeScale / 2 - minX * activeScale;
                        let newOffY = -rhOrig * activeScale / 2 - minY * activeScale;
                        let pCx = (b.x + b.w/2) * activeScale + newOffX;
                        let pCy = (b.y + b.h/2) * activeScale + newOffY;
                        
                        // Shift center left to fit HUD on the right
                        panX = -pCx - 225;
                        panY = -pCy;
                    }
                    
                } else if (currentState === 'in_progress') {
                    pieceStates[b.label] = 'done';
                    layoutBoards.forEach(lb => {
                        if (lb.label !== b.label && lb.label.split('.')[0] === pId) {
                             if (pieceStates[lb.label] === 'in_progress_sibling') pieceStates[lb.label] = 'waiting';
                        }
                    });
                } else if (currentState === 'done') {
                    pieceStates[b.label] = 'default';
                }
                
                drawCanvas();
                highlightActiveTableRows();
                break;
            }
        }
    }

    function highlightActiveTableRows(forceActiveId = null) {
        let activeBoardId = forceActiveId;
        let activeFullLabel = null;

        if (!activeBoardId) {
            for (let key in pieceStates) {
                if (pieceStates[key] === 'in_progress' || pieceStates[key] === 'normal_selected') {
                    activeBoardId = key.split('.')[0];
                    activeFullLabel = key;
                    break;
                }
            }
        } else {
            for (let key in pieceStates) {
                if ((pieceStates[key] === 'in_progress' || pieceStates[key] === 'normal_selected') && key.split('.')[0] === activeBoardId) {
                    activeFullLabel = key;
                    break;
                }
            }
        }
        
        let foundRow = null;
        document.querySelectorAll('#cutMapTable tbody tr').forEach(tr => {
            tr.classList.remove('active-row');
            if (activeBoardId && tr.dataset.boardId === activeBoardId) {
                tr.classList.add('active-row');
                foundRow = tr;
            }
        });

        document.querySelectorAll('#cutMapTable tbody .piece-badge').forEach(badge => {
            badge.classList.remove('active-badge');
            if (activeFullLabel && badge.dataset.label === activeFullLabel) {
                 badge.classList.add('active-badge');
            }
        });

        if (foundRow) {
            if (document.body.classList.contains('install-mode')) {
                let container = foundRow.closest('.table-responsive');
                if (container) {
                    let containerRect = container.getBoundingClientRect();
                    let rowRect = foundRow.getBoundingClientRect();
                    let scrollTop = container.scrollTop + (rowRect.top - containerRect.top) - (containerRect.height / 2) + (rowRect.height / 2);
                    container.scrollTo({ top: scrollTop, behavior: 'smooth' });
                } else {
                    foundRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                foundRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    // -- QUICK BUILD --
    const dirMap = {
        'ArrowUp': { dir: 'up', icon: '↑' },
        'ArrowDown': { dir: 'down', icon: '↓' },
        'ArrowLeft': { dir: 'left', icon: '←' },
        'ArrowRight': { dir: 'right', icon: '→' }
    };

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.id !== 'qbLength') return;
        if (dirMap[e.key]) {
            e.preventDefault();
            qbIdle.style.display = 'none';
            qbActive.style.display = 'flex';
            qbDirIcon.textContent = dirMap[e.key].icon;
            qbDirIcon.dataset.dir = dirMap[e.key].dir;
            qbLength.focus();
        }
    });

    qbLength.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const len = Math.max(0, Math.round(Number(qbLength.value)));
            if (len > 0) {
                walls.push({ dir: qbDirIcon.dataset.dir, len: len });
                saveState();
                renderWallsList();
                processAndDraw();
                qbLength.value = '';
                qbActive.style.display = 'none';
                qbIdle.style.display = 'block';
                qbLength.blur();
                wallsContainer.scrollTop = wallsContainer.scrollHeight;
            }
        } else if (e.key === 'Escape') {
            qbLength.value = '';
            qbActive.style.display = 'none';
            qbIdle.style.display = 'block';
            qbLength.blur();
        }
    });

    // -- EVENTS --
    addWallBtn.addEventListener('click', () => {
        let lastDir = walls.length > 0 ? walls[walls.length - 1].dir : 'up';
        let dirs = (lastDir === 'left' || lastDir === 'right') ? ['down', 'up'] : ['right', 'left'];
        walls.push({ dir: dirs[0], len: 2000 });
        saveState();
        renderWallsList();
        processAndDraw();
        wallsContainer.scrollTop = wallsContainer.scrollHeight;
    });

    autoCloseBtn.addEventListener('click', () => {
        autoCloseRoom();
        saveState();
        renderWallsList();
        processAndDraw();
        wallsContainer.scrollTop = wallsContainer.scrollHeight;
    });

    resetRoomBtn.addEventListener('click', () => {
        walls = [{ dir: 'right', len: 4000 }];
        saveState();
        renderWallsList();
        processAndDraw();

        // Reset view
        scaleZoom = 1;
        panX = 0; panY = 0;
        drawCanvas();
    });

    let drawTimeout;
    function queueDraw(delay = 600) {
        clearTimeout(drawTimeout);
        drawTimeout = setTimeout(() => {
            saveState();
            processAndDraw();
        }, delay);
    }

    INPUTS.forEach(el => {
        el.addEventListener('change', () => queueDraw(0));
        if (el.tagName === 'INPUT') el.addEventListener('input', () => queueDraw(700));
    });

    function removeWall(index) {
        walls.splice(index, 1);
        saveState();
        renderWallsList();
        processAndDraw();
    }

    function renderWallsList() {
        wallsContainer.innerHTML = '';
        walls.forEach((w, i) => {
            const row = document.createElement('div');
            row.className = 'wall-row';
            row.innerHTML = `
                <div class="wall-num">${i + 1}</div>
                <select class="wall-dir">
                    <option value="right" ${w.dir === 'right' ? 'selected' : ''}>Вправо →</option>
                    <option value="down" ${w.dir === 'down' ? 'selected' : ''}>Вниз ↓</option>
                    <option value="left" ${w.dir === 'left' ? 'selected' : ''}>Влево ←</option>
                    <option value="up" ${w.dir === 'up' ? 'selected' : ''}>Вверх ↑</option>
                </select>
                <input type="number" class="wall-len" value="${w.len}" min="10" step="10">
                <span class="unit-text">мм</span>
                <button class="remove-btn">×</button>
            `;

            row.querySelector('.wall-len').addEventListener('input', (e) => {
                walls[i].len = Math.max(0, Math.round(Number(e.target.value)) || 0);
                queueDraw(700);
            });

            row.querySelector('.wall-dir').addEventListener('change', (e) => {
                walls[i].dir = e.target.value;
                queueDraw(0);
            });

            row.querySelector('.remove-btn').addEventListener('click', () => removeWall(i));
            wallsContainer.appendChild(row);
        });
    }

    function autoCloseRoom() {
        let x = 0, y = 0;
        for (let w of walls) {
            if (w.dir === 'right') x += w.len;
            if (w.dir === 'left') x -= w.len;
            if (w.dir === 'down') y += w.len;
            if (w.dir === 'up') y -= w.len;
        }
        x = Math.round(x);
        y = Math.round(y);
        if (x === 0 && y === 0) return;

        if (Math.abs(x) > 0 && Math.abs(x) <= 400) {
            for (let i = walls.length - 1; i >= 0; i--) {
                if (walls[i].dir === 'left') {
                    if (walls[i].len + x > 0) { walls[i].len += x; x = 0; break; }
                }
                if (walls[i].dir === 'right') {
                    if (walls[i].len - x > 0) { walls[i].len -= x; x = 0; break; }
                }
            }
        }
        if (Math.abs(y) > 0 && Math.abs(y) <= 400) {
            for (let i = walls.length - 1; i >= 0; i--) {
                if (walls[i].dir === 'up') {
                    if (walls[i].len + y > 0) { walls[i].len += y; y = 0; break; }
                }
                if (walls[i].dir === 'down') {
                    if (walls[i].len - y > 0) { walls[i].len -= y; y = 0; break; }
                }
            }
        }

        if (x === 0 && y === 0) return;

        let lastDir = walls.length > 0 ? walls[walls.length - 1].dir : '';
        if (Math.abs(x) > 0 && Math.abs(y) > 0) {
            if (lastDir === 'left' || lastDir === 'right') {
                walls.push({ dir: y > 0 ? 'up' : 'down', len: Math.abs(y) });
                walls.push({ dir: x > 0 ? 'left' : 'right', len: Math.abs(x) });
            } else {
                walls.push({ dir: x > 0 ? 'left' : 'right', len: Math.abs(x) });
                walls.push({ dir: y > 0 ? 'up' : 'down', len: Math.abs(y) });
            }
        } else if (Math.abs(x) > 0) {
            walls.push({ dir: x > 0 ? 'left' : 'right', len: Math.abs(x) });
        } else if (Math.abs(y) > 0) {
            walls.push({ dir: y > 0 ? 'up' : 'down', len: Math.abs(y) });
        }
    }

    function generatePolygon() {
        let pts = [{ x: 0, y: 0 }];
        let cx = 0, cy = 0;
        for (let w of walls) {
            if (w.dir === 'right') cx += w.len;
            if (w.dir === 'left') cx -= w.len;
            if (w.dir === 'down') cy += w.len;
            if (w.dir === 'up') cy -= w.len;
            pts.push({ x: cx, y: cy });
        }
        return pts;
    }

    function pointInPoly(px, py, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            let xi = pts[i].x, yi = pts[i].y;
            let xj = pts[j].x, yj = pts[j].y;
            let intersect = ((yi > py) != (yj > py))
                && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function processAndDraw() {
        boardsMap = [];
        pieceStates = {};
        const pts = generatePolygon();
        const endNode = pts[pts.length - 1];
        const dx = Math.abs(endNode.x);
        const dy = Math.abs(endNode.y);
        const isClosed = dx < 1 && dy < 1 && walls.length >= 3;

        let minX = Math.min(...pts.map(p => p.x));
        let maxX = Math.max(...pts.map(p => p.x));
        let minY = Math.min(...pts.map(p => p.y));
        let maxY = Math.max(...pts.map(p => p.y));

        roomError.style.display = isClosed ? 'none' : 'block';
        if (!isClosed) {
            currentLayout = { pts, minX, maxX, minY, maxY, hasError: true, layoutBoards: null };
            drawCanvas();
            resetResults();
            return;
        }

        const lamL = parseInt(lamLengthInput.value) || 1380;
        const lamW = parseInt(lamWidthInput.value) || 193;
        const lamInPack = parseInt(lamInPackInput.value) || 8;
        const minLeftover = parseInt(minLeftoverInput.value) || 300;
        const minOverlap = parseInt(minOverlapInput.value) || 400;
        const corner = startCornerSelect.value;
        const wallOffset = parseInt(wallOffsetInput.value) || 0;
        let manualW = parseInt(manualRowWidthInput.value) || 0;

        const dirY = (corner === 'TL' || corner === 'TR') ? 1 : -1;
        const dirX = (corner === 'TL' || corner === 'BL') ? 1 : -1;

        const layoutBoards = [];
        let nextBoardId = 1;
        let pool = [];

        let prevRowSeams = [];

        let effMinY = minY + wallOffset;
        let effMaxY = maxY - wallOffset;
        let roomH = effMaxY - effMinY;
        if (roomH <= 0) roomH = 1;

        let firstRowHLabel = 0;
        let lastRowHLabel = 0;

        let defaultRemainder = roomH % lamW;
        let autoFirstRowH = lamW;
        if (defaultRemainder > 0 && defaultRemainder < 100) autoFirstRowH = Math.floor((lamW + defaultRemainder) / 2);

        let firstRowH = lamW;

        if (manualW > 0 && manualW <= lamW) {
            if (manualRowMode === 'first') {
                firstRowH = manualW;
            } else {
                let roomMinusLast = roomH - manualW;
                firstRowH = roomMinusLast % lamW;
                if (firstRowH < 0.1) firstRowH = lamW;
            }
        } else {
            firstRowH = autoFirstRowH;
        }

        let yRows = [];
        let curY = dirY === 1 ? effMinY : effMaxY;
        let remainingH = roomH;
        let currentH = firstRowH;

        while (remainingH > 0.1) {
            let h = Math.min(currentH, remainingH);
            let rowY = dirY === 1 ? curY : curY - h;
            yRows.push({ y: rowY, h: h, cy: rowY + h / 2 });
            curY = dirY === 1 ? curY + h : curY - h;
            remainingH -= h;
            currentH = lamW;
        }

        if (yRows.length > 0) {
            firstRowHLabel = Math.round(yRows[0].h);
            lastRowHLabel = Math.round(yRows[yRows.length - 1].h);
        }

        if (calcRowWidthDisplay) {
            if (manualRowWidthInput.value === '') {
                manualRowWidthInput.placeholder = `Авто (${manualRowMode === 'first' ? firstRowHLabel : lastRowHLabel})`;
            } else {
                manualRowWidthInput.placeholder = `Авто`;
            }

            let calculatedDisplayVal = manualRowMode === 'first' ? lastRowHLabel : firstRowHLabel;
            let opponentName = manualRowMode === 'first' ? 'последнего' : 'первого';
            calcRowWidthDisplay.innerHTML = `Ширина ${opponentName} ряда: <b>${manualW > 0 ? '' : 'Авто ('}${calculatedDisplayVal} мм${manualW > 0 ? '' : ')'}</b>`;
        }

        if (rowWidthWarning) {
            if ((firstRowHLabel > 0 && firstRowHLabel < 100) || (lastRowHLabel > 0 && lastRowHLabel < 100)) {
                rowWidthWarning.style.display = 'block';
            } else {
                rowWidthWarning.style.display = 'none';
            }
        }

        let isAbsoluteFirstBoard = true;
        let manualFirstLen = parseInt(manualFirstBoardLengthInput.value) || 0;

        for (let row of yRows) {
            let y = row.y;
            let currentLamW = row.h;
            let rayY = row.cy;

            let inters = [];
            for (let i = 0; i < pts.length - 1; i++) {
                let p1 = pts[i], p2 = pts[i + 1];
                if ((p1.y <= rayY && p2.y > rayY) || (p2.y <= rayY && p1.y > rayY)) {
                    let t = (rayY - p1.y) / (p2.y - p1.y);
                    inters.push(p1.x + t * (p2.x - p1.x));
                }
            }
            inters.sort((a, b) => a - b);

            let currentRowSeams = [];
            let chunks = [];
            for (let i = 0; i < inters.length; i += 2) {
                if (inters[i] !== undefined && inters[i + 1] !== undefined) {
                    let cx1 = inters[i] + wallOffset;
                    let cx2 = inters[i + 1] - wallOffset;
                    if (cx2 >= cx1 + 0.1) chunks.push([cx1, cx2]);
                }
            }
            if (dirX === -1) chunks.reverse();

            for (let chunk of chunks) {
                let currX = dirX === 1 ? chunk[0] : chunk[1];
                let needSpan = Math.abs(chunk[1] - chunk[0]);

                let validConfig = null;
                let usedPoolIdx = -1;
                let startIsNew = true;

                function getValidRow(L_first) {
                    if (L_first < minLeftover && L_first < needSpan - 0.1) return null;

                    let L_last = 0;
                    let k = 0;
                    if (needSpan <= L_first + 0.1) {
                        L_first = needSpan;
                    } else {
                        let rem = needSpan - L_first;
                        k = Math.floor(rem / lamL);
                        L_last = rem - k * lamL;
                        if (L_last > 0.1 && L_last < minLeftover) return null;
                    }

                    // Seam clash check
                    let seams = [];
                    let offset = L_first;
                    for (let i = 0; i < k + (L_last > 0.1 ? 1 : 0) - 1; i++) {
                        if (offset < needSpan - 0.1) {
                            seams.push(dirX === 1 ? currX + offset : currX - offset);
                            offset += lamL;
                        }
                    }
                    if (offset < needSpan - 0.1) seams.push(dirX === 1 ? currX + offset : currX - offset);

                    for (let sx of prevRowSeams) {
                        for (let s of seams) {
                            if (Math.abs(s - sx) < minOverlap) return null;
                        }
                    }
                    return { L_first, k, L_last };
                }

                if (isAbsoluteFirstBoard && manualFirstLen > 0 && manualFirstLen <= lamL) {
                    let L_last = 0;
                    let k = 0;
                    let forceL = manualFirstLen;
                    if (needSpan <= forceL + 0.1) {
                        forceL = needSpan;
                    } else {
                        let rem = needSpan - forceL;
                        k = Math.floor(rem / lamL);
                        L_last = rem - k * lamL;
                    }
                    validConfig = { L_first: forceL, k, L_last };
                    startIsNew = true;
                } else if (needSpan <= lamL + 0.1) {
                    // Single piece chunk!
                    pool.sort((a, b) => a.len - b.len);
                    for (let i = 0; i < pool.length; i++) {
                        if (pool[i].len >= needSpan - 0.1) {
                            validConfig = { L_first: needSpan, k: 0, L_last: 0 };
                            usedPoolIdx = i;
                            startIsNew = false;
                            break;
                        }
                    }
                    if (!validConfig) validConfig = { L_first: needSpan, k: 0, L_last: 0 };
                } else {
                    // Try pool
                    pool.sort((a, b) => a.len - b.len);
                    for (let i = 0; i < pool.length; i++) {
                        let scrap = pool[i];
                        for (let tryL = scrap.len; tryL >= minLeftover; tryL -= 5) {
                            validConfig = getValidRow(tryL);
                            if (validConfig) {
                                usedPoolIdx = i;
                                startIsNew = false;
                                break;
                            }
                        }
                        if (validConfig) break;
                    }
                    // Try new board
                    if (!validConfig) {
                        for (let tryL = lamL; tryL >= minLeftover; tryL -= 5) {
                            validConfig = getValidRow(tryL);
                            if (validConfig) {
                                startIsNew = true;
                                break;
                            }
                        }
                    }
                }

                if (!validConfig) {
                    let fallbackL = lamL;
                    let remLam = (needSpan - lamL) % lamL;
                    if (remLam < 0) remLam += lamL;
                    if (needSpan > lamL && (remLam < minLeftover)) fallbackL = lamL / 2;
                    validConfig = {
                        L_first: fallbackL,
                        k: Math.floor((needSpan - fallbackL) / lamL),
                        L_last: (needSpan - fallbackL) % lamL
                    };
                }

                isAbsoluteFirstBoard = false;

                // NOW WE LAY IT OUT
                let pieces = [];
                pieces.push({ len: validConfig.L_first, isStart: true, isEnd: (validConfig.k === 0 && validConfig.L_last < 0.1) });
                for (let i = 0; i < validConfig.k; i++) {
                    pieces.push({ len: lamL, isStart: false, isEnd: (i === validConfig.k - 1 && validConfig.L_last < 0.1) });
                }
                if (validConfig.L_last > 0.1) {
                    pieces.push({ len: validConfig.L_last, isStart: false, isEnd: true });
                }

                let activeX = currX;
                for (let pi = 0; pi < pieces.length; pi++) {
                    let p = pieces[pi];
                    let useLen = p.len;
                    let drawX = dirX === 1 ? activeX : (activeX - useLen);

                    let midX = drawX + useLen / 2;
                    let keptWidth = currentLamW;
                    let isCutLengthwise = keptWidth < lamW - 0.1;

                    let pId, pIdx, isNewPiece, origLen;
                    if (p.isStart) {
                        isNewPiece = startIsNew;
                        if (startIsNew) {
                            pId = nextBoardId++;
                            boardsMap.push({ id: pId, original: lamL, pieces: [], waste: lamL });
                            pIdx = 1;
                            origLen = lamL;
                        } else {
                            let scrap = pool[usedPoolIdx];
                            pool.splice(usedPoolIdx, 1);
                            pId = scrap.id;
                            pIdx = scrap.suffixIdx;
                            origLen = scrap.len;
                        }
                    } else {
                        // Internal or end piece -> Always new factory board
                        isNewPiece = true;
                        pId = nextBoardId++;
                        boardsMap.push({ id: pId, original: lamL, pieces: [], waste: lamL });
                        pIdx = 1;
                        origLen = lamL;
                    }

                    let typeStr = 'pool';
                    if (isNewPiece) typeStr = (useLen >= lamL - 0.1) ? 'whole' : 'new_cut';

                    let displayLabel = `${pId}.${pIdx}`;

                    let cutLeft = false, cutRight = false;
                    let isFullFactoryBoard = (useLen >= lamL - 0.1);

                    // Visualize cuts physically based on boundaries
                    // Any board touching a wall that is NOT a full factory board MUST have its cut facing the wall.
                    if (dirX === 1) {
                        // Laying L to R. Start = Left Wall. End = Right Wall.
                        if (p.isStart && !isFullFactoryBoard) cutLeft = true;
                        if (p.isEnd && !isFullFactoryBoard) cutRight = true;
                    } else {
                        // Laying R to L. Start = Right Wall. End = Left Wall.
                        if (p.isStart && !isFullFactoryBoard) cutRight = true;
                        if (p.isEnd && !isFullFactoryBoard) cutLeft = true;
                    }

                    layoutBoards.push({
                        x: drawX, y: y,
                        w: useLen, h: currentLamW,
                        type: typeStr,
                        label: displayLabel,
                        cutLeft: cutLeft,
                        cutRight: cutRight,
                        keptWidth: keptWidth,
                        isCutLengthwise: isCutLengthwise
                    });

                    let bMap = boardsMap.find(b => b.id === pId);
                    bMap.pieces.push({
                        len: useLen, label: displayLabel, isReused: !isNewPiece,
                        isWhole: (useLen >= lamL - 0.1), cutLengthwise: isCutLengthwise,
                        keptWidth: keptWidth, origW: lamW
                    });
                    bMap.waste -= useLen;

                    if (!p.isEnd) currentRowSeams.push(dirX === 1 ? activeX + useLen : activeX - useLen);
                    activeX = dirX === 1 ? activeX + useLen : activeX - useLen;

                    let remainder = origLen - useLen;
                    if (remainder >= minLeftover && isNewPiece) {
                        pool.push({ id: pId, len: remainder, suffixIdx: pIdx + 1 });
                    }
                }
            }
            prevRowSeams = currentRowSeams;
        }

        currentLayout = { pts, minX, maxX, minY, maxY, wallOffset, hasError: false, layoutBoards, dirX, dirY };
        drawCanvas();

        updateResults(pts, nextBoardId - 1, lamL, lamW, lamInPack);
        renderCutTable();
    }

    function renderCutTable() {
        cutMapTableBody.innerHTML = '';
        boardsMap.forEach(b => {
            let partsHtml = b.pieces.map(p => {
                let badgeClass = '';
                if (p.isReused) badgeClass = 'from-pool';
                else if (p.isWhole) badgeClass = 'whole';
                let extra = '';
                if (p.cutLengthwise) {
                    let cutAway = p.origW - Math.round(p.keptWidth);
                    extra = `<br><small style="color:var(--danger); display:block; margin-top:3px; line-height:1.2; border-top: 1px solid rgba(0,0,0,0.1); padding-top:2px;">✂️ Пилом вдоль:<br>отрезать в мусор: <b>${cutAway} мм</b><br>укладываем ширину: <b>${Math.round(p.keptWidth)} мм</b></small>`;
                }
                return `<span class="piece-badge ${badgeClass}" data-label="${p.label}" style="vertical-align:top;">${p.label}: ${Math.round(p.len)}мм${extra}</span>`
            }).join('');

            let wasteClass = b.waste > 0 ? 'waste-badge' : '';
            let wasteText = b.waste > 0 ? `${Math.round(b.waste)} мм` : '0';

            const tr = document.createElement('tr');
            tr.dataset.boardId = b.id;
            tr.innerHTML = `
                <td><b>Доска ${b.id}</b></td>
                <td>${partsHtml}</td>
                <td class="${wasteClass}">${wasteText}</td>
            `;
            cutMapTableBody.appendChild(tr);
        });
    }

    function switchToAdjacentPiece(currentLabel, dir) {
        if (!currentLayout || !currentLayout.layoutBoards) return;
        let boards = currentLayout.layoutBoards;
        let idx = boards.findIndex(b => b.label === currentLabel);
        if (idx === -1) return;
        
        let targetIdx = idx + dir;
        if (targetIdx >= 0 && targetIdx < boards.length) {
            let nextBoard = boards[targetIdx];
            
            for (let key in pieceStates) {
                if (pieceStates[key] === 'in_progress') {
                    pieceStates[key] = dir > 0 ? 'done' : 'waiting';
                } else if (pieceStates[key] === 'in_progress_sibling') {
                    pieceStates[key] = 'waiting';
                }
            }

            pieceStates[nextBoard.label] = 'in_progress';
            let newPId = nextBoard.label.split('.')[0];
            boards.forEach(lb => {
                if (lb.label !== nextBoard.label && lb.label.split('.')[0] === newPId) {
                    if (pieceStates[lb.label] !== 'done') {
                        pieceStates[lb.label] = 'in_progress_sibling';
                    }
                }
            });

            let rwOrig = currentLayout.maxX - currentLayout.minX;
            let rhOrig = currentLayout.maxY - currentLayout.minY;
            if (rwOrig === 0) rwOrig = 1; if (rhOrig === 0) rhOrig = 1;
            let baseScale = Math.min((canvas.width * 0.45) / rwOrig, (canvas.height * 0.45) / rhOrig);
            
            let targetActiveScale = Math.min((canvas.width * 0.7) / nextBoard.w, (canvas.height * 0.7) / nextBoard.h);
            targetActiveScale = Math.min(targetActiveScale, baseScale * 25); 
            scaleZoom = targetActiveScale / baseScale;
            let activeScale = baseScale * scaleZoom; 
            
            let newOffX = -rwOrig * activeScale / 2 - currentLayout.minX * activeScale;
            let newOffY = -rhOrig * activeScale / 2 - currentLayout.minY * activeScale;
            let pCx = (nextBoard.x + nextBoard.w/2) * activeScale + newOffX;
            let pCy = (nextBoard.y + nextBoard.h/2) * activeScale + newOffY;
            
            panX = -pCx - 225;
            panY = -pCy;

            drawCanvas();
            highlightActiveTableRows();
        }
    }

    function drawCanvas() {
        if (!currentLayout) return;
        const { pts, minX, maxX, minY, maxY, wallOffset, hasError, layoutBoards } = currentLayout;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let rw = maxX - minX;
        let rh = maxY - minY;
        if (rw === 0) rw = 1; if (rh === 0) rh = 1;

        // Base centering with massive padding to ensure external axes fit
        let baseScale = Math.min((canvas.width * 0.45) / rw, (canvas.height * 0.45) / rh);
        let activeScale = baseScale * scaleZoom;

        let offX = (canvas.width - rw * activeScale) / 2 - minX * activeScale + panX;
        let offY = (canvas.height - rh * activeScale) / 2 - minY * activeScale + panY;

        function tx(x) { return x * activeScale + offX; }
        function ty(y) { return y * activeScale + offY; }

        ctx.beginPath();
        ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].x), ty(pts[i].y));

        if (!hasError) {
            ctx.fillStyle = '#f8fafc';
            ctx.fill();

            if (layoutBoards) {
                ctx.save();
                ctx.clip();
                ctx.lineWidth = 1;
                ctx.font = 'bold 12px Inter';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                for (let b of layoutBoards) {
                    if (b.type === 'whole') ctx.fillStyle = '#fdfaf6';
                    else if (b.type === 'new_cut') ctx.fillStyle = '#e6ccb2';
                    else ctx.fillStyle = '#cd9f7b';

                    let rx = tx(b.x), ry = ty(b.y), rwBox = b.w * activeScale, rhBox = b.h * activeScale;
                    ctx.fillRect(rx, ry, rwBox, rhBox);

                    let ps = pieceStates[b.label] || 'default';
                    let bg = null;
                    if (ps === 'in_progress') bg = 'rgba(250, 204, 21, 0.75)'; 
                    else if (ps === 'in_progress_sibling') bg = 'rgba(253, 224, 71, 0.4)'; 
                    else if (ps === 'done') bg = 'rgba(74, 222, 128, 0.75)'; 
                    else if (ps === 'waiting') bg = 'rgba(251, 146, 60, 0.75)'; 

                    if (bg) {
                        ctx.fillStyle = bg;
                        ctx.fillRect(rx, ry, rwBox, rhBox);
                    }

                    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                    if (ps === 'in_progress') {
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(rx, ry, rwBox, rhBox);
                        ctx.lineWidth = 1;
                    } else {
                        ctx.strokeRect(rx, ry, rwBox, rhBox);
                    }

                    let showLocks = showLocksCheck && showLocksCheck.checked;
                    let isInstallMode = document.body.classList.contains('install-mode');
                    let showText = (rwBox > 25 && rhBox > 15) && !(ps === 'in_progress' && isInstallMode);

                    if (showText) {
                        ctx.fillStyle = (b.type === 'whole') ? '#475569' : ((b.type === 'pool') ? '#fff' : '#1e293b');
                        if (b.isCutLengthwise && rhBox > 25) {
                            ctx.fillText(b.label, rx + rwBox / 2, ry + rhBox / 2 - 6);
                        } else {
                            ctx.fillText(b.label, rx + rwBox / 2, ry + rhBox / 2);
                        }
                    }

                    if (showLocks) {
                        let isCutR = b.cutRight || b.atRightWall;
                        if (isCutR) {
                            ctx.fillStyle = '#ef4444'; ctx.fillRect(rx + rwBox - 4, ry, 4, rhBox);
                        } else {
                            ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(rx + rwBox - 4, ry + rhBox / 2, 4, -Math.PI / 2, Math.PI / 2); ctx.fill();
                        }

                        let isCutL = b.cutLeft || b.atLeftWall;
                        if (isCutL) {
                            ctx.fillStyle = '#ef4444'; ctx.fillRect(rx, ry, 4, rhBox);
                        } else {
                            ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(rx + 4, ry + rhBox / 2, 4, Math.PI / 2, Math.PI * 1.5); ctx.fill();
                        }
                    }

                    if (b.isCutLengthwise) {
                        let effMinYLocal = minY + wallOffset;
                        let effMaxYLocal = maxY - wallOffset;

                        let isTopRow = Math.abs(b.y - effMinYLocal) < 1;
                        let isBottomRow = Math.abs(b.y + b.h - effMaxYLocal) < 1;

                        ctx.fillStyle = '#ef4444';
                        if (isTopRow) ctx.fillRect(rx, ry, rwBox, 4);
                        if (isBottomRow) ctx.fillRect(rx, ry + rhBox - 4, rwBox, 4);

                        let wText = `Ш: ${Math.round(b.keptWidth)}`;
                        ctx.font = 'bold 10px Inter';
                        ctx.fillStyle = '#ef4444';
                        if (rhBox > 25) {
                            ctx.fillText(wText, rx + rwBox / 2, ry + rhBox / 2 + 8);
                        } else {
                            if (isTopRow) {
                                ctx.fillText(wText, rx + rwBox / 2, ry + rhBox + 10);
                            } else if (isBottomRow) {
                                ctx.fillText(wText, rx + rwBox / 2, ry - 6);
                            } else {
                                ctx.fillText(wText, rx + rwBox / 2, ry + rhBox / 2);
                            }
                        }
                        ctx.font = 'bold 12px Inter';
                    }

                    if (ps === 'in_progress' && isInstallMode) {
                        let isCutR = b.cutRight;
                        let isCutL = b.cutLeft;
                        let midX = rx + rwBox/2;
                        let midY = ry + rhBox/2;
                        
                        let nameText = `Доска ${b.label}`;
                        ctx.font = 'bold 15px Inter';
                        let twName = ctx.measureText(nameText).width;
                        let badgeW = twName + 24;
                        let badgeH = 28;
                        let badgeY = midY - 18; 
                        
                        ctx.fillStyle = '#1e293b'; 
                        ctx.beginPath();
                        ctx.roundRect(midX - badgeW/2, badgeY - badgeH/2, badgeW, badgeH, 14);
                        ctx.fill();
                        
                        ctx.fillStyle = '#f8fafc';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(nameText, midX, badgeY);
                        
                        let arrowY = midY + 18;
                        let dimText = `${Math.round(b.w)} мм`;
                        ctx.font = 'bold 16px Inter';
                        let twDim = ctx.measureText(dimText).width;
                        let pillW = twDim + 24;
                        
                        let sx = rx + 8, ex = rx + rwBox - 8;
                        if (rwBox > pillW + 30) {
                            ctx.beginPath();
                            ctx.strokeStyle = '#ef4444';
                            ctx.lineWidth = 2;
                            ctx.moveTo(sx, arrowY);
                            ctx.lineTo(midX - pillW/2, arrowY);
                            ctx.moveTo(midX + pillW/2, arrowY);
                            ctx.lineTo(ex, arrowY);
                            ctx.stroke();

                            ctx.fillStyle = '#ef4444';
                            // Left arrow
                            ctx.beginPath();
                            ctx.moveTo(sx, arrowY);
                            ctx.lineTo(sx + 10, arrowY - 4);
                            ctx.lineTo(sx + 10, arrowY + 4);
                            ctx.fill();
                            // Right arrow
                            ctx.beginPath();
                            ctx.moveTo(ex, arrowY);
                            ctx.lineTo(ex - 10, arrowY - 4);
                            ctx.lineTo(ex - 10, arrowY + 4);
                            ctx.fill();
                        }
                        
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                        ctx.beginPath();
                        ctx.roundRect(midX - pillW/2, arrowY - 14, pillW, 28, 6);
                        ctx.fill();
                        
                        ctx.fillStyle = '#ef4444'; 
                        ctx.fillText(dimText, midX, arrowY);
                    }

                }
                ctx.restore();
            }
        }

        ctx.strokeStyle = hasError ? '#ef4444' : '#0f172a';
        ctx.lineWidth = 3;
        ctx.stroke();

        if (hasError) {
            ctx.restore();
            return;
        }

        // Hide dimensions in full screen install mode for immersion
        if (document.body.classList.contains('install-mode')) {
            ctx.restore();
            drawHUD(ctx);
            return;
        }

        // Calc CW area to fix dimension line normals outwards
        let areaSrc = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            areaSrc += (pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y);
        }
        let sig = (areaSrc > 0) ? 1 : -1;

        // Group walls by their outward normal to tier dimensions!
        let groups = { top: [], bottom: [], left: [], right: [] };
        for (let i = 0; i < walls.length; i++) {
            let p1 = pts[i]; let p2 = pts[i + 1] ? pts[i + 1] : pts[0];
            let dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
            if (len === 0) continue;
            let nx = Math.round((dy / len) * sig), ny = Math.round((-dx / len) * sig);
            let side = 'top';
            if (ny > 0) side = 'bottom';
            else if (nx < 0) side = 'left';
            else if (nx > 0) side = 'right';
            groups[side].push({ idx: i, len: walls[i].len });
        }

        // Shortest segments are drawn closest to the drawing (tier 0)
        for (let side in groups) {
            groups[side].sort((a, b) => a.len - b.len);
            groups[side].forEach((w, rank) => walls[w.idx].tier = rank);
        }

        // External Dimensions
        for (let i = 0; i < walls.length; i++) {
            let p1 = pts[i];
            let p2 = pts[i + 1] ? pts[i + 1] : pts[0];

            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let len = Math.hypot(dx, dy);
            if (len === 0) continue;

            let nx = Math.round((dy / len) * sig);
            let ny = Math.round((-dx / len) * sig);

            let p1x = tx(p1.x); let p1y = ty(p1.y);
            let p2x = tx(p2.x); let p2y = ty(p2.y);

            let dim1x = p1x, dim1y = p1y, dim2x = p2x, dim2y = p2y;

            let tier = walls[i].tier || 0;
            // 60px base offset + 40px for each subsequent layer
            let offsetPix = 60 + tier * 40;

            let absoluteBoundsLocal = {
                top: ty(minY) - offsetPix * scaleZoom,
                bottom: ty(maxY) + offsetPix * scaleZoom,
                left: tx(minX) - offsetPix * scaleZoom,
                right: tx(maxX) + offsetPix * scaleZoom
            };

            // Project precisely to absolute bounds
            if (ny < 0) { dim1y = dim2y = absoluteBoundsLocal.top; }
            else if (ny > 0) { dim1y = dim2y = absoluteBoundsLocal.bottom; }
            else if (nx < 0) { dim1x = dim2x = absoluteBoundsLocal.left; }
            else if (nx > 0) { dim1x = dim2x = absoluteBoundsLocal.right; }

            // Draw extension lines (dashed and fade) linking wall segment to outer bounding box
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(dim1x, dim1y);
            ctx.moveTo(p2x, p2y);
            ctx.lineTo(dim2x, dim2y);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]); // reset

            // Draw solid dimension line
            ctx.beginPath();
            ctx.moveTo(dim1x, dim1y);
            ctx.lineTo(dim2x, dim2y);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Dimension text wrapper
            let cxDim = (dim1x + dim2x) / 2;
            let cyDim = (dim1y + dim2y) / 2;
            let text = `${walls[i].len}`;

            ctx.font = 'bold 13px Inter';
            let tw = ctx.measureText(text).width + 12;
            ctx.fillStyle = '#f8fafc'; // background padding
            ctx.fillRect(cxDim - tw / 2, cyDim - 12, tw, 24);

            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, cxDim, cyDim);
        }
        ctx.restore();
        drawHUD(ctx);
    }

    function drawHUD(ctx) {
        if (!document.body.classList.contains('install-mode')) return;

        let activePId = null;
        for (let key in pieceStates) {
            if (pieceStates[key] === 'in_progress') { activePId = key.split('.')[0]; break; }
        }

        if (!activePId || !currentLayout) return;

        let parts = [];
        for (let b of currentLayout.layoutBoards) {
            if (b.label.split('.')[0] === activePId) parts.push(b);
        }
        parts.sort((a, b) => parseInt(a.label.split('.')[1]) - parseInt(b.label.split('.')[1]));

        ctx.setTransform(1, 0, 0, 1, 0, 0); // Guarantee UI stays fixed
        let hudW = 450;
        let hudH = 250;
        let hudX = canvas.width - hudW - 30;
        let hudY = 30;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(hudX, hudY, hudW, hudH, 16);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // DRAW CLOSE X
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.arc(hudX + hudW - 25, hudY + 25, 15, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✖', hudX + hudW - 25, hudY + 26);

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`Распил: Физическая доска ${activePId}`, hudX + hudW/2, hudY + 30);

        let lamL = Number(lamLengthInput.value) || 1380;
        let boardScreenW = 350, boardScreenH = 60;
        let boardScreenX = hudX + (hudW - boardScreenW)/2, boardScreenY = hudY + 90;

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(boardScreenX, boardScreenY, boardScreenW, boardScreenH);
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(boardScreenX, boardScreenY, boardScreenW, boardScreenH);

        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter';
        ctx.fillText('папа', boardScreenX - 15, boardScreenY + boardScreenH/2);
        ctx.fillText('мама', boardScreenX + boardScreenW + 15, boardScreenY + boardScreenH/2);
        ctx.fillText('папа', boardScreenX + boardScreenW/2, boardScreenY - 10);
        ctx.fillText('мама', boardScreenX + boardScreenW/2, boardScreenY + boardScreenH + 15);

        let currentPixX = boardScreenX;
        let currentMathX = 0;

        let leftPiece = null;
        let rightPiece = null;

        if (parts.length > 0) leftPiece = parts[0];
        if (parts.length > 1) rightPiece = parts[1];

        // Draw left piece
        if (leftPiece) {
            let pwPix = (leftPiece.w / lamL) * boardScreenW;
            let ps = pieceStates[leftPiece.label];
            let fill = '#e2e8f0'; 
            if (ps === 'in_progress') fill = '#fde047';
            else if (ps === 'done') fill = '#86efac';
            else if (ps === 'waiting' || ps === 'in_progress_sibling') fill = '#fdba74';
            
            ctx.fillStyle = fill;
            ctx.fillRect(currentPixX, boardScreenY, pwPix, boardScreenH);
            
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.strokeRect(currentPixX, boardScreenY, pwPix, boardScreenH);

            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            if (pwPix > 40) {
                ctx.font = 'bold 13px Inter';
                ctx.fillText(`${leftPiece.label}`, currentPixX + pwPix/2, boardScreenY + boardScreenH/2);
            } else {
                ctx.font = 'bold 10px Inter';
                ctx.fillText(`${leftPiece.label}`, currentPixX + pwPix/2, boardScreenY + boardScreenH/2);
            }

            let dimY = boardScreenY + boardScreenH + 35;
            ctx.beginPath();
            ctx.moveTo(currentPixX, dimY - 5); ctx.lineTo(currentPixX, dimY + 5);
            ctx.moveTo(currentPixX + pwPix, dimY - 5); ctx.lineTo(currentPixX + pwPix, dimY + 5);
            ctx.moveTo(currentPixX, dimY); ctx.lineTo(currentPixX + pwPix, dimY);
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.stroke();
            
            ctx.font = 'bold 12px Inter';
            ctx.fillStyle = (ps === 'in_progress') ? '#ef4444' : '#1e293b';
            ctx.fillText(`${Math.round(leftPiece.w)} мм`, currentPixX + pwPix/2, dimY - 8);

            if (leftPiece.isCutLengthwise) {
                let effMinYLocal = currentLayout.minY + currentLayout.wallOffset;
                let effMaxYLocal = currentLayout.maxY - currentLayout.wallOffset;
                
                let isTopOnCanvas = Math.abs(leftPiece.y - effMinYLocal) < 1;
                // isFirstRow logic: if building downwards (dirY=1), first row is top. If upwards (dirY=-1), first row is at max Y (bottom).
                let isFirstRow = (currentLayout.dirY === 1) ? isTopOnCanvas : !isTopOnCanvas;
                
                // First row always cuts "папа" (top of widget). Last row always cuts "мама" (bottom of widget).
                let cutTopWidget = isFirstRow;
                
                ctx.fillStyle = '#ef4444';
                if (cutTopWidget) ctx.fillRect(currentPixX, boardScreenY, pwPix, 4);
                else ctx.fillRect(currentPixX, boardScreenY + boardScreenH - 4, pwPix, 4);
                
                ctx.font = 'bold 10px Inter';
                let wText = `Ш: ${Math.round(leftPiece.keptWidth)}`;
                ctx.fillText(wText, currentPixX + pwPix/2, cutTopWidget ? boardScreenY + 16 : boardScreenY + boardScreenH - 10);
            }

            currentPixX += pwPix;
            currentMathX += leftPiece.w;
        }

        // Output waste in the middle if there are 2 pieces
        if (leftPiece && rightPiece) {
            let wasteMath = lamL - leftPiece.w - rightPiece.w;
            if (wasteMath > 0.5) {
                let wasteWPix = (wasteMath / lamL) * boardScreenW;
                ctx.fillStyle = '#fca5a5'; 
                ctx.fillRect(currentPixX, boardScreenY, wasteWPix, boardScreenH);
                ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
                ctx.strokeRect(currentPixX, boardScreenY, wasteWPix, boardScreenH);
            
                ctx.fillStyle = '#1e293b'; ctx.font = '12px Inter';
                if (wasteWPix > 40) ctx.fillText('Мусор', currentPixX + wasteWPix/2, boardScreenY + boardScreenH/2);
                
                currentPixX += wasteWPix;
                currentMathX += wasteMath;
            }
        }

        // Draw right piece
        if (rightPiece) {
            let pwPix = (rightPiece.w / lamL) * boardScreenW;
            let ps = pieceStates[rightPiece.label];
            let fill = '#e2e8f0'; 
            if (ps === 'in_progress') fill = '#fde047';
            else if (ps === 'done') fill = '#86efac';
            else if (ps === 'waiting' || ps === 'in_progress_sibling') fill = '#fdba74';
            
            ctx.fillStyle = fill;
            ctx.fillRect(currentPixX, boardScreenY, pwPix, boardScreenH);
            
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.strokeRect(currentPixX, boardScreenY, pwPix, boardScreenH);

            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            if (pwPix > 40) {
                ctx.font = 'bold 13px Inter';
                ctx.fillText(`${rightPiece.label}`, currentPixX + pwPix/2, boardScreenY + boardScreenH/2);
            } else {
                ctx.font = 'bold 10px Inter';
                ctx.fillText(`${rightPiece.label}`, currentPixX + pwPix/2, boardScreenY + boardScreenH/2);
            }

            let dimY = boardScreenY + boardScreenH + 35;
            ctx.beginPath();
            ctx.moveTo(currentPixX, dimY - 5); ctx.lineTo(currentPixX, dimY + 5);
            ctx.moveTo(currentPixX + pwPix, dimY - 5); ctx.lineTo(currentPixX + pwPix, dimY + 5);
            ctx.moveTo(currentPixX, dimY); ctx.lineTo(currentPixX + pwPix, dimY);
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.stroke();
            
            ctx.font = 'bold 12px Inter';
            ctx.fillStyle = (ps === 'in_progress') ? '#ef4444' : '#1e293b';
            ctx.fillText(`${Math.round(rightPiece.w)} мм`, currentPixX + pwPix/2, dimY - 8);

            if (rightPiece.isCutLengthwise) {
                let effMinYLocal = currentLayout.minY + currentLayout.wallOffset;
                let effMaxYLocal = currentLayout.maxY - currentLayout.wallOffset;
                
                let isTopOnCanvas = Math.abs(rightPiece.y - effMinYLocal) < 1;
                let isFirstRow = (currentLayout.dirY === 1) ? isTopOnCanvas : !isTopOnCanvas;
                let cutTopWidget = isFirstRow;

                ctx.fillStyle = '#ef4444';
                if (cutTopWidget) ctx.fillRect(currentPixX, boardScreenY, pwPix, 4);
                else ctx.fillRect(currentPixX, boardScreenY + boardScreenH - 4, pwPix, 4);
                
                ctx.font = 'bold 10px Inter';
                let wText = `Ш: ${Math.round(rightPiece.keptWidth)}`;
                ctx.fillText(wText, currentPixX + pwPix/2, cutTopWidget ? boardScreenY + 16 : boardScreenY + boardScreenH - 10);
            }

            currentPixX += pwPix;
            currentMathX += rightPiece.w;
        }

        // If only 1 piece, draw waste on the right
        if (leftPiece && !rightPiece && currentMathX < lamL - 1) { 
            let wasteWPix = ((lamL - currentMathX) / lamL) * boardScreenW;
            ctx.fillStyle = '#fca5a5'; 
            ctx.fillRect(currentPixX, boardScreenY, wasteWPix, boardScreenH);
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
            ctx.strokeRect(currentPixX, boardScreenY, wasteWPix, boardScreenH);
            
            ctx.fillStyle = '#1e293b'; ctx.font = '12px Inter';
            if (wasteWPix > 40) ctx.fillText('Мусор', currentPixX + wasteWPix/2, boardScreenY + boardScreenH/2);
        }

        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(hudX + 20, hudY + hudH - 50, 90, 36, 8);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('← Назад', hudX + 20 + 45, hudY + hudH - 50 + 18);

        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.roundRect(hudX + hudW - 110, hudY + hudH - 50, 90, 36, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Далее →', hudX + hudW - 110 + 45, hudY + hudH - 50 + 18);

    }

    function updateResults(pts, totalBoards, lamL, lamW, lamInPack) {
        let areaMm2 = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            areaMm2 += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
        }
        areaMm2 = Math.abs(areaMm2 / 2);
        let areaM2 = areaMm2 / 1000000;

        let packsNeeded = Math.ceil(totalBoards / lamInPack);
        let purchasedBoards = packsNeeded * lamInPack;

        let purchasedArea = purchasedBoards * lamL * lamW / 1000000;
        let wastePct = 0;
        if (areaM2 > 0) {
            wastePct = ((purchasedArea - areaM2) / areaM2) * 100;
        }

        resRoomArea.textContent = areaM2.toFixed(3) + ' м²';
        resTotalArea.textContent = purchasedArea.toFixed(3) + ' м²';
        if (document.getElementById('resWastePct')) {
            document.getElementById('resWastePct').textContent = wastePct.toFixed(1) + ' %';
        }
        
        resTotalBoards.textContent = totalBoards + ' шт';
        resPacksCount.textContent = packsNeeded + ' шт';
        resLeftoverBoards.textContent = (purchasedBoards - totalBoards) + ' шт';
    }

    function resetResults() {
        resRoomArea.textContent = '0.00 м²';
        resTotalBoards.textContent = '0 шт';
        resPacksCount.textContent = '0 шт';
        resTotalArea.textContent = '0.00 м²';
        resLeftoverBoards.textContent = '0 шт';
        cutMapTableBody.innerHTML = '';
    }
});
