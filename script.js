// 全局变量
let currentConversationId = null;
let conversations = [];
let directoryHandle = null;
const CONFIG_FILE = 'chat_config.json';
let isDarkMode = false;
let isEnglish = false;

// 添加子文件夹选择窗口的 HTML
document.body.insertAdjacentHTML('beforeend', `
    <div id="subfoldersModal" class="subfolders-modal">
        <div class="subfolders-window">
            <div class="subfolders-header">
                <div class="subfolders-title">${isEnglish ? 'All Subfolders' : '所有子文件夹'}</div>
                <button class="subfolders-close" onclick="closeSubfoldersModal()">×</button>
            </div>
            <div id="subfoldersContent" class="subfolders-content"></div>
        </div>
    </div>
`);

/* 图片编辑器类 */
class ImageEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.image = null;
        this.scale = 1;
        this.rotation = 0;
        this.flipX = 1;
        this.flipY = 1;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.imageX = 0;
        this.imageY = 0;
        this.lastTouchDistance = 0;
        this.isRotationMode = false;

        this.initializeCanvas();
        this.setupEventListeners();
    }

    initializeCanvas() {
        // 设置默认分辨率
        this.setCanvasSize(512, 384);
    }

    setCanvasSize(width, height) {
        const aspectRatio = width / height;
        const container = this.canvas.parentElement;
        
        // 设置容器的宽高比
        container.style.aspectRatio = `${width} / ${height}`;
        
        // 根据宽高比调整显示大小
        const displayWidth = Math.min(width, 720);
        const displayHeight = displayWidth / aspectRatio;
        container.style.width = displayWidth + 'px';
        container.style.height = displayHeight + 'px';

        // 设置实际画布大小
        this.canvas.width = width;
        this.canvas.height = height;
        this.drawImage();
    }

    setupEventListeners() {
        // 文件拖放到 drop-zone
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('imageFileInput');

        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImage(file);
            }
        });

        // 允许将图片拖拽到 canvas 本身以替换当前图片
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImage(file);
            }
        });

        // 鼠标事件
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.ctrlKey) {
                // Ctrl + 鼠标左键用于旋转
                this.isDragging = true;
                this.isRotating = true;
                const rect = this.canvas.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                this.startAngle = Math.atan2(
                    e.clientY - rect.top - centerY,
                    e.clientX - rect.left - centerX
                );
                this.lastRotation = this.rotation;
            } else {
                // 普通拖拽
                this.isDragging = true;
                this.isRotating = false;
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // 考虑旋转角度的影响
                const rotationRad = (this.rotation * Math.PI) / 180;
                const cos = Math.cos(rotationRad);
                const sin = Math.sin(rotationRad);
                
                // 保存起始点，考虑旋转和镜像的影响
                this.startX = x * cos + y * sin;
                this.startY = -x * sin + y * cos;
                
                // 考虑镜像的影响
                this.startX *= this.flipX;
                this.startY *= this.flipY;
                
                // 保存当前图片位置
                this.lastImageX = this.imageX;
                this.lastImageY = this.imageY;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            if (this.isRotating) {
                // 旋转模式
                const rect = this.canvas.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const currentAngle = Math.atan2(
                    e.clientY - rect.top - centerY,
                    e.clientX - rect.left - centerX
                );
                const angleDiff = (currentAngle - this.startAngle) * (180 / Math.PI);
                this.rotation = this.lastRotation + angleDiff;
                this.drawImage();
            } else {
                // 普通拖拽模式
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // 考虑旋转角度的影响
                const rotationRad = (this.rotation * Math.PI) / 180;
                const cos = Math.cos(rotationRad);
                const sin = Math.sin(rotationRad);
                
                // 计算当前点，考虑旋转和镜像的影响
                const currentX = (x * cos + y * sin) * this.flipX;
                const currentY = (-x * sin + y * cos) * this.flipY;
                
                // 计算位移
                const deltaX = currentX - this.startX;
                const deltaY = currentY - this.startY;
                
                // 更新图片位置
                this.imageX = this.lastImageX + deltaX;
                this.imageY = this.lastImageY + deltaY;
                
                this.drawImage();
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.isRotating = false;
        });

        // 滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const oldScale = this.scale;
            const delta = e.deltaY > 0 ? 0.99 : 1.01;
            this.scale *= delta;
            
            // 调整图片位置以保持画布中心缩放
            const scaleRatio = this.scale / oldScale;
            this.imageX *= scaleRatio;
            this.imageY *= scaleRatio;
            
            this.drawImage();
        });

        // 预设分辨率按钮
        document.querySelectorAll('[data-resolution], [data-resolution-width]').forEach(button => {
            button.addEventListener('click', () => {
                if (button.dataset.resolution) {
                    // 正方形分辨率
                    const size = parseInt(button.dataset.resolution);
                    this.setCanvasSize(size, size);
                } else {
                    // 自定义宽高比分辨率
                    const width = parseInt(button.dataset.resolutionWidth);
                    const height = parseInt(button.dataset.resolutionHeight);
                    this.setCanvasSize(width, height);
                }
            });
        });

        // 宽高比按钮
        document.querySelectorAll('[data-aspect]').forEach(button => {
            button.addEventListener('click', () => {
                const [w, h] = button.dataset.aspect.split(':').map(Number);
                const newHeight = Math.round(this.canvas.width * (h / w));
                this.setCanvasSize(this.canvas.width, newHeight);
            });
        });

        // 图片操作按钮
        document.querySelector('.rotate-btn').onclick = () => this.rotate(90);
        document.querySelector('.flip-h-btn').onclick = () => this.flip('horizontal');
        document.querySelector('.flip-v-btn').onclick = () => this.flip('vertical');
        document.querySelector('.reset-btn').onclick = () => {
            if (this.image) {
                this.resetTransform();
                this.drawImage();
            }
        };

        // 下载按钮事件
        document.getElementById('downloadJPG').onclick = () => this.downloadImage('jpg');
        document.getElementById('downloadPNG').onclick = () => this.downloadImage('png');

        // 手动设置分辨率
        document.querySelector('.control-group button').onclick = () => {
            const width = parseInt(document.getElementById('widthInput').value);
            const height = parseInt(document.getElementById('heightInput').value);
            if (width > 0 && height > 0) {
                this.setCanvasSize(width, height);
            }
        };

        // 触摸事件
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 2) {
                // 双指触摸，记录初始信息
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.lastTouchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                if (this.isRotationMode) {
                    // 在旋转模式下，记录初始角度
                    this.startAngle = Math.atan2(
                        touch2.clientY - touch1.clientY,
                        touch2.clientX - touch1.clientX
                    );
                    this.lastRotation = this.rotation;
                }
            } else if (e.touches.length === 1) {
                // 单指触摸逻辑保持不变
                this.isDragging = true;
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                const rotationRad = (this.rotation * Math.PI) / 180;
                const cos = Math.cos(rotationRad);
                const sin = Math.sin(rotationRad);
                
                this.startX = x * cos + y * sin;
                this.startY = -x * sin + y * cos;
                
                this.startX *= this.flipX;
                this.startY *= this.flipY;
                
                this.lastImageX = this.imageX;
                this.lastImageY = this.imageY;
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );

                if (this.isRotationMode) {
                    // 旋转模式：双指旋转
                    const currentAngle = Math.atan2(
                        touch2.clientY - touch1.clientY,
                        touch2.clientX - touch1.clientX
                    );
                    const angleDiff = (currentAngle - this.startAngle) * (180 / Math.PI);
                    this.rotation = this.lastRotation + angleDiff;
                } else {
                    // 缩放模式：双指缩放
                    if (this.lastTouchDistance > 0) {
                        const oldScale = this.scale;
                        const scale = currentDistance / this.lastTouchDistance;
                        this.scale *= scale;
                        
                        // 调整图片位置以保持画布中心缩放
                        const scaleRatio = this.scale / oldScale;
                        this.imageX *= scaleRatio;
                        this.imageY *= scaleRatio;
                    }
                }
                this.drawImage();
                this.lastTouchDistance = currentDistance;
            } else if (e.touches.length === 1 && this.isDragging) {
                // 单指移动逻辑保持不变
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                const rotationRad = (this.rotation * Math.PI) / 180;
                const cos = Math.cos(rotationRad);
                const sin = Math.sin(rotationRad);
                
                const currentX = (x * cos + y * sin) * this.flipX;
                const currentY = (-x * sin + y * cos) * this.flipY;
                
                const deltaX = currentX - this.startX;
                const deltaY = currentY - this.startY;
                
                this.imageX = this.lastImageX + deltaX;
                this.imageY = this.lastImageY + deltaY;
                
                this.drawImage();
            }
        });

        this.canvas.addEventListener('touchend', () => {
            this.isDragging = false;
            this.lastTouchDistance = 0;
        });

        this.canvas.addEventListener('touchcancel', () => {
            this.isDragging = false;
            this.lastTouchDistance = 0;
        });
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.loadImage(file);
        }
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.scale = 1;
                this.rotation = 0;
                this.flipX = 1;
                this.flipY = 1;
                this.imageX = 0;
                this.imageY = 0;
                this.fitImageToCanvas();
                
                // 隐藏 drop-zone（只在首次加载/替换后隐藏）
                document.getElementById('drop-zone').style.display = 'none';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    fitImageToCanvas() {
        if (!this.image) return;
        
        const canvasRatio = this.canvas.width / this.canvas.height;
        const imageRatio = this.image.width / this.image.height;

        if (imageRatio > canvasRatio) {
            this.scale = this.canvas.width / this.image.width;
        } else {
            this.scale = this.canvas.height / this.image.height;
        }

        this.drawImage();
    }

    rotate(degrees) {
        if (!this.image) return;
        this.rotation = (this.rotation + degrees) % 360;
        this.drawImage();
    }

    flip(direction) {
        if (!this.image) return;
        if (direction === 'horizontal') this.flipX *= -1;
        if (direction === 'vertical') this.flipY *= -1;
        this.drawImage();
    }

    resetTransform() {
        if (!this.image) return;
        this.scale = 1;
        this.rotation = 0;
        this.flipX = 1;
        this.flipY = 1;
        this.imageX = 0;
        this.imageY = 0;
        this.fitImageToCanvas();
    }

    drawImage() {
        if (!this.image) return;

        this.ctx.fillStyle = isDarkMode ? '#1e1e1e' : '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // 移动到画布中心
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        
        // 应用变换
        this.ctx.rotate((this.rotation * Math.PI) / 180);
        this.ctx.scale(this.scale * this.flipX, this.scale * this.flipY);
        
        // 绘制图片
        this.ctx.drawImage(
            this.image,
            -this.image.width / 2 + this.imageX / this.scale,
            -this.image.height / 2 + this.imageY / this.scale,
            this.image.width,
            this.image.height
        );

        this.ctx.restore();
    }

    downloadImage(format) {
        if (!this.image) return;
        
        const link = document.createElement('a');
        const now = new Date();
        now.setHours(now.getHours() + 8); // 调整为北京时间
        const formattedDate = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
        const resolution = `${this.canvas.width}-${this.canvas.height}`;
        link.download = `image_${resolution}_${formattedDate}.${format}`;
        link.href = this.canvas.toDataURL(`image/${format}`, format === 'jpg' ? 0.9 : 1);
        link.click();
    }
}

/* 比例计算器类 */
class ProportionCalculator {
    constructor() {
        // 根据设备类型设置不同的默认值
        document.getElementById('valueC').value = '384';
        document.getElementById('valueD').value = '288';
        // A和B的值保持4:3不变
        document.getElementById('valueA').value = '4';
        document.getElementById('valueB').value = '3';
        
        this.setupEventListeners();
        // 初始化时就计算一次
        this.calculateFromC();
        // 初始化时就更新裁剪界面的分辨率
        this.updateCropResolution();
    }

    setupEventListeners() {
        document.getElementById('valueC').addEventListener('input', () => {
            this.calculateFromC();
            this.updateCropResolution();
        });
        
        document.getElementById('valueD').addEventListener('input', () => {
            this.calculateFromD();
            this.updateCropResolution();
        });
        
        // 添加比例按钮点击事件
        document.querySelectorAll('.ratio-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const ratio = e.target.dataset.ratio;
                const [a, b] = ratio.split(':').map(Number);
                document.getElementById('valueA').value = a;
                document.getElementById('valueB').value = b;
                // 清空 C 和 D 的值
                document.getElementById('valueC').value = '';
                document.getElementById('valueD').value = '';
            });
        });
    }

    calculateFromC() {
        const a = parseFloat(document.getElementById('valueA').value);
        const b = parseFloat(document.getElementById('valueB').value);
        const c = parseFloat(document.getElementById('valueC').value);
        
        if(isNaN(a) || isNaN(b) || isNaN(c)) {
            return;
        }
        
        if(b === 0 || a === 0) {
            alert('分母不能为0！');
            return;
        }
        
        const d = Math.round((b * c) / a);
        document.getElementById('valueD').value = d;
    }

    calculateFromD() {
        const a = parseFloat(document.getElementById('valueA').value);
        const b = parseFloat(document.getElementById('valueB').value);
        const d = parseFloat(document.getElementById('valueD').value);
        
        if(isNaN(a) || isNaN(b) || isNaN(d)) {
            return;
        }
        
        if(b === 0 || a === 0) {
            alert('分母不能为0！');
            return;
        }
        
        const c = Math.round((a * d) / b);
        document.getElementById('valueC').value = c;
    }

    // 更新裁剪界面的分辨率输入框
    updateCropResolution() {
        const widthInput = document.getElementById('widthInput');
        const heightInput = document.getElementById('heightInput');
        const valueC = document.getElementById('valueC').value;
        const valueD = document.getElementById('valueD').value;
        
        if (valueC && valueD) {
            widthInput.value = valueC;
            heightInput.value = valueD;
        }
    }
}

// 初始化应用
async function initApp() {
    try {
        // 恢复主题和语言设置
        restoreTheme();
        restoreLanguage();
        
        // 初始化工具切换
        setupToolSwitchers();
        
        // 默认显示聊天模式，隐藏其他工具
        const chatPanel = document.querySelector('.chat-panel');
        const editorPanel = document.querySelector('.editor-panel');
        const calculatorPanel = document.querySelector('.calculator-panel');
        
        if (chatPanel) chatPanel.classList.add('active-tool');
        if (editorPanel) editorPanel.classList.remove('active-tool');
        if (calculatorPanel) calculatorPanel.classList.remove('active-tool');
        
        // 显示侧边栏和主内容区
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (sidebar) {
            sidebar.style.display = 'flex';
            sidebar.classList.remove('hidden');
        }
        if (mainContent) {
            mainContent.style.marginLeft = '300px';
            mainContent.classList.remove('full');
        }
        
        // 初始化事件监听器
        setupEventListeners();
        
        // 初始化图片编辑器和比例计算器（但保持隐藏状态）
        new ImageEditor();
        new ProportionCalculator();
        
        // 尝试恢复上次的目录（如果有）
        const dirHandle = await restoreDirectoryHandle();
        if (dirHandle) {
            try {
                await verifyPermission(dirHandle);
                directoryHandle = dirHandle;
                await restoreLastDirectory();
            } catch (error) {
                console.warn('已保存的目录权限验证失败');
                localStorage.removeItem('directoryHandle');
            }
        }
        
        return true;
    } catch (error) {
        console.error('初始化失败:', error);
        alert(isEnglish ? 'Initialization failed: ' + error.message : '初始化失败：' + error.message);
        return false;
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 消息输入和发送
    const messageInput = document.querySelector('.message-input');
    const sendButton = document.querySelector('.send-btn');
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    // 设置按钮事件
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', toggleSettings);
    }
    
    // 主题切换按钮
    const themeToggleBtn = document.querySelector('.theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    // 语言切换按钮
    const langToggleBtn = document.querySelector('.lang-toggle-btn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', toggleLanguage);
    }
    
    // 更新文件夹按钮
    const updateFolderBtn = document.querySelector('.update-folder-btn');
    if (updateFolderBtn) {
        updateFolderBtn.addEventListener('click', updateFolders);
    }
    
    // 滚动到底部按钮
    const scrollBottomBtn = document.querySelector('.scroll-bottom-btn');
    const messagesContainer = document.querySelector('.messages-container');
    
    if (messagesContainer && scrollBottomBtn) {
        messagesContainer.addEventListener('scroll', () => {
            const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 200;
            scrollBottomBtn.style.opacity = isNearBottom ? '0' : '1';
            scrollBottomBtn.style.pointerEvents = isNearBottom ? 'none' : 'auto';
        });
        
        scrollBottomBtn.addEventListener('click', () => {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        });
    }
    
    // ESC键关闭设置窗口
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('settingsModal');
            if (modal && modal.classList.contains('show')) {
                toggleSettings();
            }
        }
    });
}

// 工具切换相关函数
function setupToolSwitchers() {
    const chatBtn = document.querySelector('[data-tool="chat"]');
    const editorBtn = document.querySelector('[data-tool="editor"]');
    const calculatorBtn = document.querySelector('[data-tool="calculator"]');
    
    const chatPanel = document.querySelector('.chat-panel');
    const editorPanel = document.querySelector('.editor-panel');
    const calculatorPanel = document.querySelector('.calculator-panel');
    
    // 确保所有面板都有正确的类名
    if (editorPanel) editorPanel.classList.add('tool-panel');
    if (calculatorPanel) calculatorPanel.classList.add('tool-panel');
    
    function switchTool(activeBtn, activePanel) {
        // 移除所有按钮的活动状态
        [chatBtn, editorBtn, calculatorBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        
        // 隐藏所有面板
        [chatPanel, editorPanel, calculatorPanel].forEach(panel => {
            if (panel) {
                panel.classList.remove('active-tool');
                panel.style.display = 'none';
            }
        });
        
        // 激活选中的按钮和面板
        if (activeBtn) activeBtn.classList.add('active');
        if (activePanel) {
            activePanel.classList.add('active-tool');
            activePanel.style.display = 'block';
        }
        
        // 特殊处理聊天工具的侧边栏
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (sidebar && mainContent) {
            // 检查侧边栏是否被手动隐藏
            const isSidebarHidden = sidebar.classList.contains('hidden');
            
            if (activePanel === chatPanel) {
                // 聊天模式：显示侧边栏（除非被手动隐藏）
                sidebar.style.display = isSidebarHidden ? 'none' : 'flex';
                mainContent.style.marginLeft = isSidebarHidden ? '0' : '300px';
            } else {
                // 其他工具：保持侧边栏状态不变
                sidebar.style.display = isSidebarHidden ? 'none' : 'flex';
                mainContent.style.marginLeft = isSidebarHidden ? '0' : '300px';
            }
        }
        
        // 保存当前工具状态
        if (activeBtn) {
            localStorage.setItem('currentTool', activeBtn.dataset.tool);
        }
    }
    
    // 添加点击事件
    if (chatBtn) chatBtn.addEventListener('click', () => switchTool(chatBtn, chatPanel));
    if (editorBtn) editorBtn.addEventListener('click', () => switchTool(editorBtn, editorPanel));
    if (calculatorBtn) calculatorBtn.addEventListener('click', () => switchTool(calculatorBtn, calculatorPanel));
    
    // 默认显示聊天模式
    switchTool(chatBtn, chatPanel);
}

// 语言相关函数
const labelTexts = {
    '主题': 'Theme',
    '语言': 'Language',
    '存储位置': 'Storage Location',
    '更新': 'Update',
    '更新文件夹': 'Update Folders',
    '选择存储位置': 'Select Storage Location',
    '设置': 'Settings',
    '发送': 'Send',
    '新建对话': 'New Chat',
    '重命名': 'Rename',
    '删除': 'Delete',
    '返回主文件夹': 'Back to Main Folder',
    '子文件夹': 'Subfolders',
    '图片编辑': 'Image Editor',
    '比例计算': 'Ratio Calculator',
    '聊天模式': 'Chat Mode',
    '拖放图片到此处': 'Drop Image Here',
    '或点击选择': 'or Click to Select',
    '旋转': 'Rotate',
    '水平翻转': 'Flip H',
    '垂直翻转': 'Flip V',
    '重置': 'Reset',
    '下载': 'Download',
    '设置分辨率': 'Set Resolution',
    '宽度': 'Width',
    '高度': 'Height',
    '确定': 'OK'
};

function applyLanguage() {
    const isEnglish = localStorage.getItem('isEnglish') === 'true';
    document.documentElement.setAttribute('lang', isEnglish ? 'en' : 'zh');
    
    // 更新所有带有 data-text 属性的元素
    document.querySelectorAll('[data-text]').forEach(element => {
        const key = element.dataset.text;
        if (labelTexts[key]) {
            element.textContent = isEnglish ? labelTexts[key] : key;
        }
    });
    
    // 更新按钮文本
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
        sendButton.textContent = isEnglish ? 'Send' : '发送';
    }
    
    // 更新滚动按钮标题
    const scrollBottomBtn = document.getElementById('scrollBottomBtn');
    if (scrollBottomBtn) {
        scrollBottomBtn.title = isEnglish ? 'Scroll to Bottom' : '滚动到底部';
    }
}

function toggleLanguage() {
    isEnglish = !isEnglish;
    localStorage.setItem('isEnglish', isEnglish);
    applyLanguage();
}

// 主题相关函数
function applyTheme() {
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
    saveTheme();
}

// 保存主题设置
function saveTheme() {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

// 恢复主题设置
function restoreTheme() {
    const savedTheme = localStorage.getItem('theme');
    isDarkMode = savedTheme === 'dark';
    applyTheme();
}

// 恢复语言设置
function restoreLanguage() {
    const savedLanguage = localStorage.getItem('isEnglish');
    isEnglish = savedLanguage === 'true';
    applyLanguage();
}

// 配置相关函数
async function loadConfig() {
    if (!directoryHandle) return null;
    
    try {
        const configHandle = await directoryHandle.getFileHandle(CONFIG_FILE);
        const file = await configHandle.getFile();
        const content = await file.text();
        return JSON.parse(content);
    } catch (error) {
        console.error('加载配置失败，可能是新目录:', error);
        return null;
    }
}

async function saveConfig() {
    if (!directoryHandle) return;
    
    try {
        const config = {
            lastAccessed: new Date().toISOString(),
            conversations: conversations.map(c => ({
                id: c.id,
                title: c.title,
                currentFolder: c.currentFolder,
                order: conversations.indexOf(c)
            }))
        };
        
        const configHandle = await directoryHandle.getFileHandle(CONFIG_FILE, { create: true });
        const writable = await configHandle.createWritable();
        await writable.write(JSON.stringify(config, null, 2));
        await writable.close();
    } catch (error) {
        console.error('保存配置失败:', error);
    }
}

// 目录相关函数
async function setupDirectory() {
    try {
        // 请求用户选择目录
        directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        
        // 验证新选择的目录权限
        await verifyPermission(directoryHandle);
        
        // 保存目录句柄到localStorage
        await saveDirectoryHandle();
        
        // 恢复或初始化目录内容
        await restoreLastDirectory();
        
        return true;
    } catch (error) {
        console.error('设置目录失败:', error);
        if (error.name === 'AbortError') {
            throw new Error(isEnglish ? 'Directory selection was cancelled' : '目录选择被取消');
        } else if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
            throw new Error(isEnglish ? 'Permission denied to access directory. Please try selecting a different directory.' : '没有访问目录的权限，请尝试选择其他目录');
        } else {
            throw new Error(isEnglish ? 'Failed to setup directory: ' + error.message : '设置目录失败：' + error.message);
        }
    }
}

async function verifyPermission(fileHandle) {
    const options = {
        mode: 'readwrite'
    };
    
    try {
        // 检查权限状态
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        
        // 请求权限
        const permission = await fileHandle.requestPermission(options);
        if (permission === 'granted') {
            return true;
        }
        
        throw new Error('Permission denied');
    } catch (error) {
        console.error('权限验证失败:', error);
        throw new Error(isEnglish ? 'Permission denied to access directory. Please try selecting a different directory.' : '没有访问目录的权限，请尝试选择其他目录');
    }
}

async function saveDirectoryHandle() {
    if (!directoryHandle) return;
    
    try {
        // 将目录句柄序列化并保存到localStorage
        const serializedHandle = await serializeDirectoryHandle(directoryHandle);
        localStorage.setItem('directoryHandle', JSON.stringify(serializedHandle));
    } catch (error) {
        console.error('保存目录句柄失败:', error);
    }
}

async function restoreDirectoryHandle() {
    try {
        const serializedHandle = localStorage.getItem('directoryHandle');
        if (!serializedHandle) return null;
        
        return await deserializeDirectoryHandle(JSON.parse(serializedHandle));
    } catch (error) {
        console.error('恢复目录句柄失败:', error);
        return null;
    }
}

async function serializeDirectoryHandle(handle) {
    return {
        name: handle.name,
        kind: handle.kind,
        // 可以添加其他需要保存的属性
    };
}

async function deserializeDirectoryHandle(serialized) {
    try {
        // 重新请求用户授权
        const handle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'downloads'
        });
        
        // 验证是否是同一个目录
        if (handle.name === serialized.name) {
            return handle;
        }
        return null;
    } catch (error) {
        console.error('反序列化目录句柄失败:', error);
        return null;
    }
}

// 对话相关函数
async function loadConversations() {
    try {
        // 获取所有对话文件
        const entries = await getAllFiles(directoryHandle);
        conversations = [];
        
        for (const entry of entries) {
            if (entry.name.endsWith('.txt')) {
                const conversation = {
                    id: entry.name.replace('.txt', ''),
                    title: entry.name.replace('.txt', ''),
                    currentFolder: 'main'
                };
                conversations.push(conversation);
            }
        }
        
        // 按修改时间排序
        conversations.sort((a, b) => {
            return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
        });
        
        // 更新界面
        updateConversationsList();
        
        // 如果有对话，加载第一个
        if (conversations.length > 0) {
            await loadConversation(conversations[0].id);
        }
        
        return true;
    } catch (error) {
        console.error('加载对话失败:', error);
        alert(isEnglish ? 'Failed to load conversations' : '加载对话失败');
        return false;
    }
}

// 获取所有文件
async function getAllFiles(dirHandle) {
    const entries = [];
    try {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
                const file = await entry.getFile();
                entries.push({
                    name: entry.name,
                    lastModified: file.lastModified
                });
            }
        }
    } catch (error) {
        console.error('获取文件列表失败:', error);
    }
    return entries;
}

// 加载指定对话
async function loadConversation(id) {
    try {
        const conversation = conversations.find(c => c.id === id);
        if (!conversation) return;
        
        currentConversationId = id;
        
        // 更新UI状态
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-id') === id);
        });
        
        // 获取对话文件内容
        const fileHandle = await directoryHandle.getFileHandle(id + '.txt');
        const file = await fileHandle.getFile();
        const content = await file.text();
        
        // 清空消息容器
        const messagesContainer = document.querySelector('.messages-container');
        messagesContainer.innerHTML = '';
        
        // 解析并显示消息
        const messages = content.split('\n').filter(line => line.trim());
        messages.forEach(message => {
            const div = document.createElement('div');
            div.className = 'message';
            div.textContent = message;
            messagesContainer.appendChild(div);
        });
        
        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return true;
    } catch (error) {
        console.error('加载对话失败:', error);
        alert(isEnglish ? 'Failed to load conversation' : '加载对话失败');
        return false;
    }
}

function updateConversationsList() {
    const conversationsList = document.querySelector('.conversation-list');
    if (!conversationsList) return;
    
    conversationsList.innerHTML = '';
    
    for (const conversation of conversations) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.setAttribute('data-id', conversation.id);
        
        if (conversation.id === currentConversationId) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="conversation-title">${conversation.title}</div>
            <div class="conversation-dropdown">
                <button class="dropdown-btn">⋮</button>
                <div class="dropdown-content">
                    <button class="rename-btn">${isEnglish ? 'Rename' : '重命名'}</button>
                    <button class="delete-btn">${isEnglish ? 'Delete' : '删除'}</button>
                </div>
            </div>
        `;
        
        // 点击加载对话
        item.querySelector('.conversation-title').addEventListener('click', () => {
            loadConversation(conversation.id);
        });
        
        // 重命名对话
        item.querySelector('.rename-btn').addEventListener('click', () => {
            renameConversation(conversation);
        });
        
        // 删除对话
        item.querySelector('.delete-btn').addEventListener('click', () => {
            deleteConversation(conversation);
        });
        
        conversationsList.appendChild(item);
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    try {
        // 如果没有当前对话，创建新对话
        if (!currentConversationId) {
            await createNewConversation();
        }
        
        // 追加消息到文件
        const fileHandle = await directoryHandle.getFileHandle(currentConversationId + '.txt', { create: true });
        const writable = await fileHandle.createWritable({ keepExistingData: true });
        await writable.seek((await fileHandle.getFile()).size);
        await writable.write(message + '\n');
        await writable.close();
        
        // 显示消息
        appendMessage(message);
        
        // 清空输入框
        messageInput.value = '';
        
        // 滚动到底部
        const messagesContainer = document.querySelector('.messages-container');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error('发送消息失败:', error);
        showError(isEnglish ? 'Failed to send message' : '发送消息失败');
    }
}

function appendMessage(message) {
    const messagesContainer = document.querySelector('.messages-container');
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
}

async function createNewConversation() {
    try {
        if (!directoryHandle) {
            throw new Error(isEnglish ? 'Please select a storage location first' : '请先选择存储位置');
        }
        
        const id = 'chat_' + Date.now();
        const title = isEnglish ? 'New Chat' : '新对话';
        
        // 创建新对话对象
        const conversation = {
            id,
            title,
            currentFolder: 'main'
        };
        
        // 创建新文件
        const fileHandle = await directoryHandle.getFileHandle(id + '.txt', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.close();
        
        // 添加到对话列表
        conversations.unshift(conversation);
        currentConversationId = id;
        
        // 更新界面
        updateConversationsList();
        
        // 清空消息容器
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        return true;
    } catch (error) {
        console.error('创建新对话失败:', error);
        alert(isEnglish ? 'Failed to create new chat: ' + error.message : '创建新对话失败：' + error.message);
        return false;
    }
}

async function renameConversation(conversation) {
    const newTitle = prompt(isEnglish ? 'Enter new chat name:' : '请输入新的对话名称:', conversation.title);
    if (!newTitle) return;
    
    try {
        const oldFileName = conversation.id + '.txt';
        const newFileName = newTitle + '.txt';
        
        // 重命名文件
        await directoryHandle.getFileHandle(oldFileName);
        const newFileHandle = await directoryHandle.getFileHandle(newFileName, { create: true });
        
        // 复制内容
        const oldFile = await (await directoryHandle.getFileHandle(oldFileName)).getFile();
        const writable = await newFileHandle.createWritable();
        await writable.write(await oldFile.text());
        await writable.close();
        
        // 删除旧文件
        await directoryHandle.removeEntry(oldFileName);
        
        // 更新对话信息
        conversation.id = newTitle;
        conversation.title = newTitle;
        
        // 如果是当前对话，更新currentConversationId
        if (currentConversationId === oldFileName.replace('.txt', '')) {
            currentConversationId = newTitle;
        }
        
        // 更新界面
        updateConversationsList();
    } catch (error) {
        console.error('重命名对话失败:', error);
        showError(isEnglish ? 'Failed to rename chat' : '重命名对话失败');
    }
}

async function deleteConversation(conversation) {
    if (!confirm(isEnglish ? 'Delete this chat?' : '确定要删除这个对话吗？')) {
        return;
    }
    
    try {
        // 删除文件
        await directoryHandle.removeEntry(conversation.id + '.txt');
        
        // 从数组中移除
        const index = conversations.findIndex(c => c.id === conversation.id);
        if (index !== -1) {
            conversations.splice(index, 1);
        }
        
        // 如果删除的是当前对话，清空当前对话
        if (currentConversationId === conversation.id) {
            currentConversationId = null;
            document.querySelector('.messages-container').innerHTML = '';
        }
        
        // 更新界面
        updateConversationsList();
        
        // 如果还有其他对话，加载第一个
        if (conversations.length > 0) {
            await loadConversation(conversations[0].id);
        }
    } catch (error) {
        console.error('删除对话失败:', error);
        showError(isEnglish ? 'Failed to delete chat' : '删除对话失败');
    }
}

// 设置相关函数
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    
    modal.classList.toggle('show');
    
    // 当设置窗口打开时，更新设置项的状态
    if (modal.classList.contains('show')) {
        // 更新语言按钮状态
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.textContent = isEnglish ? 'CH' : 'EN';
        }
        
        // 更新设置部分
        const settingsSections = document.querySelectorAll('.settings-section');
        
        // 更新常规设置部分
        const generalSection = settingsSections[0];
        if (generalSection) {
            const generalItems = generalSection.querySelectorAll('.settings-item');
            
            // 主题设置
            if (generalItems[0]) {
                generalItems[0].innerHTML = `
                    <div class="settings-item-row">
                        <span class="settings-item-label">${isEnglish ? 'Theme' : '主题'}</span>
                        <button id="themeToggleBtn" class="theme-toggle-btn">
                            ${isEnglish ? 'Toggle Theme' : '切换主题'}
                        </button>
                    </div>
                `;
            }
            
            // 语言设置
            if (generalItems[1]) {
                generalItems[1].innerHTML = `
                    <div class="settings-item-row">
                        <span class="settings-item-label">${isEnglish ? 'Language' : '语言'}</span>
                        <button id="langToggleBtn" class="lang-toggle-btn">
                            ${isEnglish ? 'CH' : 'EN'}
                        </button>
                    </div>
                `;
            }
        }
        
        // 更新存储设置部分
        const storageSection = settingsSections[1];
        if (storageSection) {
            const storageItem = storageSection.querySelector('.settings-item');
            if (storageItem) {
                storageItem.innerHTML = `
                    <div class="settings-item-row">
                        <span class="settings-item-label">${isEnglish ? 'Storage Location' : '存储位置'}</span>
                        <button class="select-dir-btn" onclick="selectCustomDirectory()">
                            ${isEnglish ? 'Select Storage Location' : '选择存储位置'}
                        </button>
                    </div>
                    <div class="settings-item-row">
                        <span class="settings-item-label">${isEnglish ? 'Update' : '更新'}</span>
                        <button class="update-folder-btn" onclick="updateFolders()">
                            ${isEnglish ? 'Update Folders' : '更新文件夹'}
                        </button>
                    </div>
                `;
            }
        }
        
        // 重新绑定主题切换按钮事件
        document.getElementById('themeToggleBtn').onclick = toggleTheme;
        // 重新绑定语言切换按钮事件
        document.getElementById('langToggleBtn').onclick = toggleLanguage;
    }
}

async function updateFolders() {
    try {
        // 获取所有子文件夹
        const subfolders = [];
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'directory' && entry.name !== 'node_modules') {
                subfolders.push(entry.name);
            }
        }
        
        // 更新文件夹列表
        const container = document.querySelector('.subfolders-content');
        container.innerHTML = '';
        
        subfolders.sort().forEach(folder => {
            const div = document.createElement('div');
            div.className = 'subfolder-item';
            div.textContent = folder;
            div.addEventListener('click', () => switchFolder(folder));
            container.appendChild(div);
        });
        
        return true;
    } catch (error) {
        console.error('更新文件夹失败:', error);
        alert(isEnglish ? 'Failed to update folders' : '更新文件夹失败');
        return false;
    }
}

// 切换文件夹
async function switchFolder(folder) {
    try {
        if (!currentConversation) return;
        
        // 如果已经在这个文件夹，不需要切换
        if (currentConversation.currentFolder === folder) {
            closeSubfoldersModal();
            return;
        }
        
        // 更新当前对话的文件夹
        currentConversation.currentFolder = folder;
        await saveConfig();
        
        // 重新加载消息
        const messages = await loadMessages(currentConversation.id);
        displayMessages(messages);
        
        // 更新当前路径显示
        updateCurrentPath();
        
        // 关闭模态窗口
        closeSubfoldersModal();
        
        return true;
    } catch (error) {
        console.error('切换文件夹失败:', error);
        alert(isEnglish ? 'Failed to switch folder' : '切换文件夹失败');
        return false;
    }
}

// 更新当前路径显示
function updateCurrentPath() {
    const pathDiv = document.querySelector('.current-path');
    if (!pathDiv) return;
    
    if (!currentConversation || currentConversation.currentFolder === 'main') {
        pathDiv.style.display = 'none';
    } else {
        pathDiv.style.display = 'flex';
        pathDiv.innerHTML = `
            <span class="path-icon">📁</span>
            <span class="path-text">${currentConversation.currentFolder}</span>
        `;
    }
}

// 显示子文件夹模态窗口
function showSubfoldersModal() {
    const modal = document.querySelector('.subfolders-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    updateFolders();
}

// 关闭子文件夹模态窗口
function closeSubfoldersModal() {
    const modal = document.querySelector('.subfolders-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
}

// 创建新文件夹
async function createNewFolder() {
    const folderName = prompt(
        isEnglish ? 'Enter folder name:' : '请输入文件夹名称:'
    );
    
    if (!folderName) return;
    
    try {
        // 检查文件夹名称是否合法
        if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(folderName)) {
            throw new Error('文件夹名称包含非法字符');
        }
        
        // 检查文件夹是否已存在
        try {
            await directoryHandle.getDirectoryHandle(folderName);
            throw new Error('文件夹已存在');
        } catch (error) {
            if (error.name !== 'NotFoundError') {
                throw error;
            }
        }
        
        // 创建新文件夹
        await directoryHandle.getDirectoryHandle(folderName, { create: true });
        
        // 更新文件夹列表
        await updateFolders();
        
        return true;
    } catch (error) {
        console.error('创建文件夹失败:', error);
        alert(isEnglish ? 
            'Failed to create folder: ' + error.message : 
            '创建文件夹失败: ' + error.message
        );
        return false;
    }
}

// 重命名文件夹
async function renameFolder(oldName) {
    if (!oldName || oldName === 'main') return;
    
    const newName = prompt(
        isEnglish ? 'Enter new folder name:' : '请输入新的文件夹名称:',
        oldName
    );
    
    if (!newName || newName === oldName) return;
    
    try {
        // 检查新文件夹名称是否合法
        if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(newName)) {
            throw new Error('文件夹名称包含非法字符');
        }
        
        // 检查新文件夹是否已存在
        try {
            await directoryHandle.getDirectoryHandle(newName);
            throw new Error('文件夹已存在');
        } catch (error) {
            if (error.name !== 'NotFoundError') {
                throw error;
            }
        }
        
        // 获取旧文件夹句柄
        const oldHandle = await directoryHandle.getDirectoryHandle(oldName);
        
        // 创建新文件夹
        const newHandle = await directoryHandle.getDirectoryHandle(newName, { create: true });
        
        // 复制所有文件
        for await (const entry of oldHandle.values()) {
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                const newFileHandle = await newHandle.getFileHandle(entry.name, { create: true });
                const writable = await newFileHandle.createWritable();
                await writable.write(file);
                await writable.close();
            }
        }
        
        // 删除旧文件夹
        await directoryHandle.removeEntry(oldName, { recursive: true });
        
        // 更新使用该文件夹的对话
        conversations.forEach(conversation => {
            if (conversation.currentFolder === oldName) {
                conversation.currentFolder = newName;
            }
        });
        await saveConfig();
        
        // 更新文件夹列表和当前路径
        await updateFolders();
        updateCurrentPath();
        
        return true;
    } catch (error) {
        console.error('重命名文件夹失败:', error);
        alert(isEnglish ? 
            'Failed to rename folder: ' + error.message : 
            '重命名文件夹失败: ' + error.message
        );
        return false;
    }
}

// 删除文件夹
async function deleteFolder(folderName) {
    if (!folderName || folderName === 'main') return;
    
    const confirmed = confirm(
        isEnglish ? 
        'Are you sure to delete this folder and all its contents?' : 
        '确定要删除这个文件夹及其所有内容吗？'
    );
    
    if (!confirmed) return;
    
    try {
        // 删除文件夹
        await directoryHandle.removeEntry(folderName, { recursive: true });
        
        // 更新使用该文件夹的对话
        conversations.forEach(conversation => {
            if (conversation.currentFolder === folderName) {
                conversation.currentFolder = 'main';
            }
        });
        await saveConfig();
        
        // 更新文件夹列表和当前路径
        await updateFolders();
        updateCurrentPath();
        
        return true;
    } catch (error) {
        console.error('删除文件夹失败:', error);
        alert(isEnglish ? 'Failed to delete folder' : '删除文件夹失败');
        return false;
    }
}

// 工具函数
function showError(message) {
    // 这里可以实现一个错误提示UI
    alert(message);
}

function showSuccess(message) {
    // 这里可以实现一个成功提示UI
    console.log(message);
}

function updateConversationTitle(id) {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;
    
    const titleElement = document.querySelector('.current-conversation-title');
    if (titleElement) {
        titleElement.textContent = conversation.title;
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', initApp);

// 恢复上次的存储位置
async function restoreLastDirectory() {
    try {
        if (directoryHandle) {
            const config = await loadConfig();
            if (config) {
                await loadConversations();
                if (conversations.length > 0) {
                    await loadConversation(conversations[conversations.length - 1].id);
                }
            } else {
                // 新目录，创建配置文件
                await saveConfig();
            }
        }
    } catch (error) {
        console.error('恢复存储位置失败:', error);
    }
}

// 切换存储位置下拉菜单
function toggleDirDropdown(e) {
    e.stopPropagation();
    const dropdown = document.querySelector('.select-dir-dropdown');
    dropdown.classList.toggle('show');
}

// 选择自定义目录
async function selectCustomDirectory() {
    try {
        const handle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        
        // 立即验证权限
        const hasPermission = await verifyDirectoryPermission(handle);
        if (!hasPermission) {
            alert(isEnglish ? 'Failed to get directory permission' : '获取目录权限失败');
            return;
        }
        
        directoryHandle = handle;
        await restoreLastDirectory();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('选择目录失败:', error);
            alert(isEnglish ? 'Failed to select directory' : '选择目录失败，请重试');
        }
    }
}

// 添加新的权限验证函数
async function verifyDirectoryPermission(handle) {
    try {
        // 验证是否可以创建和写入文件
        const options = { mode: 'readwrite' };
        
        // 首先检查现有权限
        if (await handle.queryPermission(options) === 'granted') {
            return true;
        }
        
        // 请求权限
        if (await handle.requestPermission(options) === 'granted') {
            // 尝试创建一个临时文件来验证写入权限
            try {
                const testHandle = await handle.getFileHandle('test_permission.tmp', { create: true });
                const writable = await testHandle.createWritable();
                await writable.close();
                await handle.removeEntry('test_permission.tmp');
                return true;
            } catch (error) {
                console.error('写入权限验证失败:', error);
                return false;
            }
        }
        
        return false;
    } catch (error) {
        console.error('权限验证失败:', error);
        return false;
    }
}

// ... [继续添加其他函数] 