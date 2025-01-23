// 全局变量
let currentConversationId = null;
let conversations = [];
let directoryHandle = null;
const CONFIG_FILE = 'chat_config.json';
let isDarkMode = false;
let isEnglish = false; // 添加语言设置变量

// 初始化应用
async function initApp() {
    try {
        // 添加选择存储位置按钮和下拉菜单
        const selectDirContainer = document.getElementById('selectDirContainer');
        
        const selectDirBtn = document.createElement('button');
        selectDirBtn.textContent = '选择存储位置';
        selectDirBtn.className = 'select-dir-btn';
        selectDirBtn.onclick = toggleDirDropdown;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'select-dir-dropdown';
        
        // 默认位置选项
        const defaultDirItem = document.createElement('div');
        defaultDirItem.className = 'select-dir-item';
        defaultDirItem.innerHTML = `
            <span class="select-dir-item-icon">📁</span>
            <span>C:\\LocalChat</span>
            <span class="select-dir-item-copy" title="复制路径">📋</span>
        `;
        
        // 添加点击事件
        defaultDirItem.onclick = async (e) => {
            // 如果点击的是复制按钮
            if (e.target.classList.contains('select-dir-item-copy')) {
                e.stopPropagation();
                await navigator.clipboard.writeText('C:\\LocalChat');
                // 显示复制成功提示
                const originalText = e.target.textContent;
                e.target.textContent = '✓';
                setTimeout(() => {
                    e.target.textContent = '📋';
                }, 1000);
                return;
            }
            
            // 如果点击的是路径文本
            if (e.target.textContent === 'C:\\LocalChat') {
                e.stopPropagation();
                await navigator.clipboard.writeText('C:\\LocalChat');
                // 显示临时提示
                const tempSpan = document.createElement('span');
                tempSpan.textContent = ' (已复制)';
                tempSpan.style.color = 'var(--secondary-color)';
                e.target.appendChild(tempSpan);
                setTimeout(() => {
                    tempSpan.remove();
                }, 1000);
                return;
            }
            
            // 关闭下拉菜单
            dropdown.classList.remove('show');
            // 直接尝试打开C:\LocalChat
            try {
                const handle = await window.showDirectoryPicker({
                    mode: 'readwrite'
                });
                // 检查是否选择了正确的目录
                const dirName = handle.name;
                if (dirName.toLowerCase() === 'localchat' || confirm('您选择的不是 LocalChat 文件夹，是否继续使用该文件夹？')) {
                    directoryHandle = handle;
                    await restoreLastDirectory();
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('选择目录失败:', error);
                    alert('选择目录失败，请重试');
                }
            }
        };
        
        // 其他位置选项
        const otherDirItem = document.createElement('div');
        otherDirItem.className = 'select-dir-item';
        otherDirItem.innerHTML = `
            <span class="select-dir-item-icon">📂</span>
            <span>其它位置...</span>
        `;
        otherDirItem.onclick = () => selectCustomDirectory();
        
        dropdown.appendChild(defaultDirItem);
        dropdown.appendChild(otherDirItem);
        
        selectDirContainer.appendChild(selectDirBtn);
        selectDirContainer.appendChild(dropdown);

        // 添加文件选择事件监听
        document.getElementById('fileInput').addEventListener('change', handleFileSelect);

        // 点击其他地方关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!selectDirContainer.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        // 添加设置按钮点击事件
        document.getElementById('settingsBtn').onclick = toggleSettings;

        // 添加设置关闭按钮点击事件
        document.getElementById('settingsCloseBtn').onclick = toggleSettings;

        // 添加主题切换按钮点击事件
        document.getElementById('themeToggleBtn').onclick = toggleTheme;

        // 添加语言切换按钮点击事件
        document.getElementById('langToggleBtn').onclick = toggleLanguage;

        // ESC键关闭设置窗口
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('settingsModal');
                if (modal.classList.contains('show')) {
                    toggleSettings();
                }
            }
        });

        // 添加放大缩小按钮点击事件
        const expandBtn = document.getElementById('expandBtn');
        const chatContainer = document.querySelector('.chat-container');
        let isExpanded = false;

        expandBtn.onclick = () => {
            isExpanded = !isExpanded;
            chatContainer.classList.toggle('expanded');
            expandBtn.textContent = isExpanded ? '⧉' : '⛶';
            expandBtn.title = isExpanded ? '还原' : '放大';
        };

        // 添加侧边栏切换按钮点击事件
        const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        let isSidebarHidden = false;

        sidebarToggleBtn.onclick = () => {
            isSidebarHidden = !isSidebarHidden;
            sidebar.classList.toggle('hidden');
            mainContent.classList.toggle('full');
            sidebarToggleBtn.textContent = isSidebarHidden ? '⧉' : '⛶';
            sidebarToggleBtn.title = isSidebarHidden ? '显示侧边栏' : '隐藏侧边栏';
            // 保存侧边栏状态
            localStorage.setItem('sidebarHidden', isSidebarHidden);
        };

        // 恢复侧边栏状态
        const savedSidebarState = localStorage.getItem('sidebarHidden');
        if (savedSidebarState === 'true') {
            isSidebarHidden = true;
            sidebar.classList.add('hidden');
            mainContent.classList.add('full');
            sidebarToggleBtn.textContent = '⧉';
            sidebarToggleBtn.title = '显示侧边栏';
        }

        // 尝试恢复上次的存储位置
        await restoreLastDirectory();

        // 恢复主题和语言设置
        restoreTheme();
        restoreLanguage();
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

// 切换主题
function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
    saveTheme();
}

// 应用主题
function applyTheme() {
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
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

// 保存配置文件
async function saveConfig() {
    if (!directoryHandle) return;
    
    try {
        const config = {
            lastAccessed: new Date().toISOString(),
            conversations: conversations.map(c => ({
                id: c.id,
                title: c.title,
                order: conversations.indexOf(c) // 添加顺序信息
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

// 加载配置文件
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
        directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        document.querySelector('.select-dir-dropdown').classList.remove('show');
        await restoreLastDirectory();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('选择目录失败:', error);
            alert('选择目录失败，请重试');
        }
    }
}

// 加载已有对话
async function loadConversations() {
    try {
        conversations = [];
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'directory') {
                const conversation = {
                    id: entry.name,
                    title: entry.name,
                    handle: entry
                };
                conversations.push(conversation);
            }
        }
        
        // 读取配置文件中的顺序信息
        const config = await loadConfig();
        if (config && config.conversations) {
            // 根据配置文件中的顺序排序
            conversations.sort((a, b) => {
                const orderA = config.conversations.find(c => c.id === a.id)?.order ?? Infinity;
                const orderB = config.conversations.find(c => c.id === b.id)?.order ?? Infinity;
                return orderA - orderB;
            });
        }
        
        renderConversationsList();
    } catch (error) {
        console.error('加载对话失败:', error);
    }
}

// 确保有目录访问权限
async function ensureDirectoryPermission() {
    if (!directoryHandle) return false;
    const options = { mode: 'readwrite' };
    if ((await directoryHandle.queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await directoryHandle.requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
}

// 创建新对话
async function createNewConversation() {
    try {
        // 确保有目录访问权限
        const hasPermission = await ensureDirectoryPermission();
        if (!hasPermission) {
            alert('需要选择保存目录才能创建新对话');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newConversationName = `对话_${timestamp}`;
        const newDirHandle = await directoryHandle.getDirectoryHandle(newConversationName, { create: true });
        
        const conversation = {
            id: newConversationName,
            title: newConversationName,
            handle: newDirHandle
        };
        
        conversations.push(conversation);
        await saveConfig(); // 保存配置
        renderConversationsList();
        await loadConversation(conversation.id);
    } catch (error) {
        console.error('创建新对话失败:', error);
        alert('创建新对话失败，请确保您已选择了保存目录并具有写入权限');
    }
}

// 渲染对话列表
function renderConversationsList() {
    const conversationsList = document.getElementById('conversationsList');
    conversationsList.innerHTML = '';
    
    // 关闭下拉菜单的点击事件监听
    document.addEventListener('click', (e) => {
        const dropdowns = document.querySelectorAll('.conversation-dropdown.show');
        dropdowns.forEach(dropdown => {
            if (!dropdown.parentElement.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    });
    
    conversations.forEach(conversation => {
        const item = document.createElement('div');
        item.className = `conversation-item ${conversation.id === currentConversationId ? 'active' : ''}`;
        item.draggable = true;
        
        // 添加拖动手柄
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '⋮⋮';
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'conversation-title';
        titleContainer.textContent = conversation.title;
        
        const menuButton = document.createElement('button');
        menuButton.className = 'conversation-menu-btn';
        menuButton.innerHTML = '⋮';
        menuButton.onclick = (e) => {
            e.stopPropagation();
            toggleDropdown(conversation.id);
        };
        
        const dropdown = document.createElement('div');
        dropdown.className = 'conversation-dropdown';
        dropdown.id = `dropdown-${conversation.id}`;
        
        // 下拉菜单项
        const menuItems = [
            { icon: '✏️', text: '重命名', action: () => renameConversation(conversation.id) },
            { icon: '📂', text: '打开文件夹', action: () => openConversationFolder(conversation.id) },
            { icon: '🗑️', text: '删除', action: () => deleteConversation(conversation.id) }
        ];
        
        menuItems.forEach(menuItem => {
            const dropdownItem = document.createElement('div');
            dropdownItem.className = 'dropdown-item';
            dropdownItem.innerHTML = `
                <span class="dropdown-item-icon">${menuItem.icon}</span>
                <span>${menuItem.text}</span>
            `;
            dropdownItem.onclick = (e) => {
                e.stopPropagation();
                menuItem.action();
                dropdown.classList.remove('show');
            };
            dropdown.appendChild(dropdownItem);
        });
        
        item.appendChild(dragHandle);
        item.appendChild(titleContainer);
        item.appendChild(menuButton);
        item.appendChild(dropdown);
        
        // 添加拖拽事件监听
        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.setData('text/plain', conversation.id);
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
        
        item.onclick = (e) => {
            // 如果点击的是拖动手柄，不加载对话
            if (!e.target.classList.contains('drag-handle')) {
                loadConversation(conversation.id);
            }
        };
        
        conversationsList.appendChild(item);
    });
    
    // 添加放置区域事件监听
    conversationsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = document.querySelector('.dragging');
        const siblings = [...conversationsList.querySelectorAll('.conversation-item:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const box = sibling.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            return offset < 0;
        });
        
        if (nextSibling) {
            conversationsList.insertBefore(draggingItem, nextSibling);
        } else {
            conversationsList.appendChild(draggingItem);
        }
    });
    
    // 添加放置事件监听
    conversationsList.addEventListener('drop', async (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        const items = [...conversationsList.querySelectorAll('.conversation-item')];
        const newOrder = items.map(item => {
            const titleEl = item.querySelector('.conversation-title');
            return conversations.find(c => c.title === titleEl.textContent);
        });
        
        // 更新conversations数组顺序
        conversations = newOrder;
        
        // 保存新的顺序到配置文件
        await saveConfig();
    });
}

// 切换下拉菜单显示状态
function toggleDropdown(conversationId) {
    const dropdowns = document.querySelectorAll('.conversation-dropdown');
    dropdowns.forEach(dropdown => {
        if (dropdown.id === `dropdown-${conversationId}`) {
            dropdown.classList.toggle('show');
        } else {
            dropdown.classList.remove('show');
        }
    });
}

// 重命名对话
async function renameConversation(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    const newTitle = prompt('请输入新的对话名称:', conversation.title);
    if (!newTitle || newTitle === conversation.title) return;
    
    try {
        // 创建新文件夹
        const newDirHandle = await directoryHandle.getDirectoryHandle(newTitle, { create: true });
        
        // 复制所有文件到新文件夹
        for await (const entry of conversation.handle.values()) {
            if (entry.kind === 'file') {
                // 读取原文件
                const file = await entry.getFile();
                const content = await file.arrayBuffer();
                
                // 在新文件夹中创建文件
                const newFileHandle = await newDirHandle.getFileHandle(entry.name, { create: true });
                const writable = await newFileHandle.createWritable();
                await writable.write(content);
                await writable.close();
            }
        }
        
        // 删除旧文件夹
        await directoryHandle.removeEntry(conversationId, { recursive: true });
        
        // 更新会话信息
        conversation.title = newTitle;
        conversation.id = newTitle;
        conversation.handle = newDirHandle;
        
        await saveConfig(); // 保存配置
        renderConversationsList();
    } catch (error) {
        console.error('重命名失败:', error);
        alert('重命名失败，请确保新名称合法且没有重复');
        try {
            // 如果失败，尝试删除可能创建的新文件夹
            await directoryHandle.removeEntry(newTitle).catch(() => {});
        } catch {}
    }
}

// 删除对话
async function deleteConversation(conversationId) {
    if (!confirm('确定要删除这个对话吗？')) return;
    
    try {
        const index = conversations.findIndex(c => c.id === conversationId);
        if (index === -1) return;
        
        await directoryHandle.removeEntry(conversationId, { recursive: true });
        conversations.splice(index, 1);
        
        if (currentConversationId === conversationId) {
            currentConversationId = null;
            if (conversations.length > 0) {
                await loadConversation(conversations[conversations.length - 1].id);
            } else {
                await createNewConversation();
            }
        }
        
        await saveConfig(); // 保存配置
        renderConversationsList();
    } catch (error) {
        console.error('删除对话失败:', error);
        alert('删除对话失败');
    }
}

// 加载对话内容
async function loadConversation(conversationId) {
    try {
        currentConversationId = conversationId;
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) return;
        
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';
        
        // 读取消息顺序文件
        const orderHandle = await conversation.handle.getFileHandle('messages_order.json', { create: true });
        const orderFile = await orderHandle.getFile();
        const orderContent = await orderFile.text();
        const messageOrder = orderContent ? JSON.parse(orderContent) : [];
        
        // 按顺序加载每条消息
        for (const messageInfo of messageOrder) {
            if (messageInfo.type === 'text') {
                // 读取文本消息
                const textHandle = await conversation.handle.getFileHandle(`${messageInfo.id}.txt`);
                const textFile = await textHandle.getFile();
                const content = await textFile.text();
                
                await renderMessage({
                    id: messageInfo.id,
                    type: 'text',
                    content: content,
                    timestamp: messageInfo.timestamp
                });
            } else if (messageInfo.type === 'file') {
                // 使用保存的文件名加载文件
                try {
                    await renderMessage({
                        id: messageInfo.id,
                        type: 'file',
                        filename: messageInfo.filename,
                        timestamp: messageInfo.timestamp
                    });
                } catch (error) {
                    console.error('加载文件失败:', messageInfo.filename, error);
                }
            }
        }
        
        renderConversationsList();
    } catch (error) {
        console.error('加载对话内容失败:', error);
    }
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const filePreviewArea = document.getElementById('filePreviewArea');
    const text = input.value.trim();
    const files = fileInput.files;
    
    if (!text && files.length === 0) return;
    
    try {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;
        
        // 发送文本消息
        if (text) {
            const messageId = Date.now().toString();
            const message = {
                id: messageId,
                type: 'text',
                content: text,
                timestamp: new Date().toISOString()
            };
            await saveMessage(conversation.handle, message);
            await renderMessage(message);
        }
        
        // 发送文件
        for (const file of files) {
            const messageId = Date.now().toString();
            const fileMessage = {
                id: messageId,
                type: 'file',
                filename: file.name,
                timestamp: new Date().toISOString()
            };
            
            // 保存文件到对话文件夹
            const fileHandle = await conversation.handle.getFileHandle(file.name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(file);
            await writable.close();
            
            await saveMessage(conversation.handle, fileMessage);
            await renderMessage(fileMessage);
        }
        
        // 清空输入
        input.value = '';
        fileInput.value = '';
        filePreviewArea.innerHTML = '';
        const dt = new DataTransfer();
        fileInput.files = dt.files;
    } catch (error) {
        console.error('发送消息失败:', error);
        alert('发送消息失败');
    }
}

// 保存消息到文件
async function saveMessage(conversationHandle, message) {
    try {
        // 读取或创建消息顺序文件
        let orderHandle = await conversationHandle.getFileHandle('messages_order.json', { create: true });
        let orderFile = await orderHandle.getFile();
        let orderContent = await orderFile.text();
        let messageOrder = orderContent ? JSON.parse(orderContent) : [];
        
        // 添加新消息到顺序列表
        const messageInfo = {
            id: message.id,
            type: message.type,
            timestamp: message.timestamp
        };

        // 如果是文件消息，保存文件名
        if (message.type === 'file') {
            messageInfo.filename = message.filename;
        }
        
        messageOrder.push(messageInfo);
        
        // 保存消息内容
        if (message.type === 'text') {
            // 保存文本消息
            const textHandle = await conversationHandle.getFileHandle(`${message.id}.txt`, { create: true });
            const textWritable = await textHandle.createWritable();
            await textWritable.write(message.content);
            await textWritable.close();
        }
        
        // 保存顺序文件
        const orderWritable = await orderHandle.createWritable();
        await orderWritable.write(JSON.stringify(messageOrder, null, 2));
        await orderWritable.close();
    } catch (error) {
        console.error('保存消息失败:', error);
        throw error;
    }
}

// 渲染消息
async function renderMessage(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.dataset.messageId = message.id; // 添加消息ID
    
    // 创建消息内容容器
    const contentContainer = document.createElement('div');
    contentContainer.className = 'message-content';
    
    if (message.type === 'text') {
        // 检查是否是代码
        if (isCode(message.content)) {
            contentContainer.className += ' code';
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = message.content;
            pre.appendChild(code);
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = '复制';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(message.content);
                copyBtn.textContent = '已复制';
                setTimeout(() => copyBtn.textContent = '复制', 2000);
            };
            
            contentContainer.appendChild(copyBtn);
            contentContainer.appendChild(pre);
        } else {
            contentContainer.textContent = message.content;
        }
    } else if (message.type === 'file') {
        const filename = message.filename.toLowerCase();
        if (filename.endsWith('.mp4')) {
            const video = document.createElement('video');
            video.className = 'video-preview';
            video.controls = true;
            const fileContent = await readFile(message.filename);
            video.src = URL.createObjectURL(new Blob([fileContent]));
            contentContainer.appendChild(video);
        } else if (filename.match(/\.(jpg|jpeg|png|gif)$/)) {
            const img = document.createElement('img');
            const fileContent = await readFile(message.filename);
            img.src = URL.createObjectURL(new Blob([fileContent]));
            contentContainer.appendChild(img);
        } else {
            // 其他类型的文件显示为可下载的链接
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = message.filename;
            link.onclick = async (e) => {
                e.preventDefault();
                const fileContent = await readFile(message.filename);
                const blob = new Blob([fileContent]);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = message.filename;
                a.click();
                URL.revokeObjectURL(url);
            };
            // 添加文件图标或类型标识
            const fileIcon = document.createElement('span');
            fileIcon.className = 'file-icon';
            fileIcon.textContent = '📎 ';
            contentContainer.appendChild(fileIcon);
            contentContainer.appendChild(link);
        }
    }
    
    // 创建消息操作按钮容器
    const actionContainer = document.createElement('div');
    actionContainer.className = 'message-actions';
    
    // 添加删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'message-delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.onclick = () => deleteMessage(message);
    
    actionContainer.appendChild(deleteBtn);
    
    // 将内容和操作按钮添加到消息元素
    messageElement.appendChild(contentContainer);
    messageElement.appendChild(actionContainer);
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 检查文本是否是代码
function isCode(text) {
    // 简单的代码检测逻辑
    const codePatterns = [
        /^(function|class|const|let|var|if|for|while)\s/,
        /[{};]/,
        /^\s*(public|private|protected)\s/,
        /^import\s/,
        /^export\s/,
        /^#include/,
        /^package\s/,
        /^using\s/
    ];
    
    return codePatterns.some(pattern => pattern.test(text));
}

// 读取文件内容
async function readFile(filename) {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) throw new Error('未找到对话');
    
    const fileHandle = await conversation.handle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
}

// 打开对话文件夹
async function openConversationFolder(conversationId) {
    try {
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) return;

        // 使用 File System Access API 打开文件选择器
        await window.showOpenFilePicker({
            startIn: conversation.handle,
            multiple: true // 允许多选，这样用户可以看到所有文件
        });
    } catch (error) {
        console.error('打开文件夹失败:', error);
        // 用户取消选择时不显示错误提示
        if (error.name !== 'AbortError') {
            alert('打开文件夹失败');
        }
    }
}

// 处理文件选择
function handleFileSelect(event) {
    const filePreviewArea = document.getElementById('filePreviewArea');
    const files = event.target.files;
    
    // 清空预览区域
    filePreviewArea.innerHTML = '';
    
    // 显示选择的文件
    Array.from(files).forEach(file => {
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        
        const fileName = document.createElement('span');
        fileName.className = 'file-preview-name';
        fileName.textContent = file.name;
        
        const removeButton = document.createElement('button');
        removeButton.className = 'file-preview-remove';
        removeButton.textContent = '×';
        removeButton.onclick = () => removeFileFromSelection(file);
        
        previewItem.appendChild(fileName);
        previewItem.appendChild(removeButton);
        filePreviewArea.appendChild(previewItem);
    });
}

// 从选择中移除文件
function removeFileFromSelection(fileToRemove) {
    const fileInput = document.getElementById('fileInput');
    const filePreviewArea = document.getElementById('filePreviewArea');
    
    // 创建新的 FileList
    const dt = new DataTransfer();
    Array.from(fileInput.files)
        .filter(file => file !== fileToRemove)
        .forEach(file => dt.items.add(file));
    
    // 更新文件输入
    fileInput.files = dt.files;
    
    // 重新显示预览
    handleFileSelect({ target: fileInput });
}

// 事件监听
document.getElementById('newChatBtn').onclick = createNewConversation;
document.getElementById('sendButton').onclick = sendMessage;
document.getElementById('messageInput').onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};

// 删除消息
async function deleteMessage(message) {
    if (!confirm('确定要删除这条消息吗？')) return;
    
    try {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;
        
        // 读取消息顺序文件
        const orderHandle = await conversation.handle.getFileHandle('messages_order.json');
        const orderFile = await orderHandle.getFile();
        const orderContent = await orderFile.text();
        let messageOrder = JSON.parse(orderContent);
        
        // 从顺序列表中移除消息
        messageOrder = messageOrder.filter(m => m.id !== message.id);
        
        try {
            // 如果是文本消息，删除对应的文本文件
            if (message.type === 'text') {
                await conversation.handle.removeEntry(`${message.id}.txt`).catch(() => {});
            }
            // 如果是文件消息，删除对应的文件
            else if (message.type === 'file') {
                await conversation.handle.removeEntry(message.filename).catch(() => {});
            }
        } catch (error) {
            console.error('删除文件失败，继续更新消息列表:', error);
        }
        
        // 保存更新后的顺序文件
        const orderWritable = await orderHandle.createWritable();
        await orderWritable.write(JSON.stringify(messageOrder, null, 2));
        await orderWritable.close();
        
        // 从界面上移除消息
        const messageElement = document.querySelector(`.message[data-message-id="${message.id}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    } catch (error) {
        console.error('删除消息失败:', error);
        alert('删除消息失败');
    }
}

// 切换语言
function toggleLanguage() {
    isEnglish = !isEnglish;
    const langBtn = document.getElementById('langToggleBtn');
    langBtn.textContent = isEnglish ? 'CH' : 'EN';
    applyLanguage();
    saveLanguage();
}

// 应用语言设置
function applyLanguage() {
    // 更新设置按钮文本
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        const settingsText = settingsBtn.querySelector('span:last-child');
        if (settingsText) {
            settingsText.textContent = isEnglish ? 'Settings' : '设置';
        }
    }

    // 更新新建对话按钮
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.textContent = isEnglish ? 'New Chat' : '新建对话';
    }

    // 更新发送按钮
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
        sendButton.textContent = isEnglish ? 'Send' : '发送';
    }

    // 更新消息输入框占位符
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.placeholder = isEnglish ? 'Type a message...' : '输入消息...';
    }

    // 更新设置窗口的文本
    const settingsTitle = document.querySelector('.settings-title');
    if (settingsTitle) {
        settingsTitle.textContent = isEnglish ? 'Settings' : '设置';
    }

    // 更新设置分区标题
    const sectionTitles = document.querySelectorAll('.settings-section-title');
    if (sectionTitles.length >= 2) {
        sectionTitles[0].textContent = isEnglish ? 'General' : '常规设置';
        sectionTitles[1].textContent = isEnglish ? 'Storage' : '存储设置';
    }

    // 更新设置项标签
    const settingsLabels = document.querySelectorAll('.settings-item-label');
    const labelTexts = {
        '主题': 'Theme',
        '语言': 'Language',
        '存储位置': 'Storage Location'
    };

    settingsLabels.forEach(label => {
        const currentText = label.textContent;
        if (isEnglish && labelTexts[currentText]) {
            label.textContent = labelTexts[currentText];
        } else if (!isEnglish && Object.values(labelTexts).includes(currentText)) {
            label.textContent = Object.keys(labelTexts).find(key => labelTexts[key] === currentText);
        }
    });

    // 更新主题切换按钮文本
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = isEnglish ? 'Toggle Theme' : '切换主题';
    }

    // 更新选择存储位置按钮文本
    const selectDirBtn = document.querySelector('.select-dir-btn');
    if (selectDirBtn) {
        selectDirBtn.textContent = isEnglish ? 'Select Storage Location' : '选择存储位置';
    }

    // 更新其他位置选项文本
    const otherLocationSpan = document.querySelector('.select-dir-item:last-child span:last-child');
    if (otherLocationSpan) {
        otherLocationSpan.textContent = isEnglish ? 'Other Location...' : '其它位置...';
    }

    // 更新文件选择按钮文本
    const fileBtnText = document.querySelector('.file-btn-text');
    if (fileBtnText) {
        fileBtnText.textContent = isEnglish ? 'Choose File' : '选择文件';
    }

    // 更新对话操作菜单文本
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    const menuTexts = {
        '重命名': 'Rename',
        '打开文件夹': 'Open Folder',
        '删除': 'Delete'
    };

    dropdownItems.forEach(item => {
        const textSpan = item.querySelector('span:last-child');
        if (textSpan) {
            const currentText = textSpan.textContent;
            if (isEnglish && menuTexts[currentText]) {
                textSpan.textContent = menuTexts[currentText];
            } else if (!isEnglish && Object.values(menuTexts).includes(currentText)) {
                textSpan.textContent = Object.keys(menuTexts).find(key => menuTexts[key] === currentText);
            }
        }
    });

    // 更新删除消息按钮文本
    const deleteButtons = document.querySelectorAll('.message-delete-btn');
    deleteButtons.forEach(button => {
        button.textContent = isEnglish ? 'Delete' : '删除';
    });

    // 更新复制按钮文本
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(button => {
        button.textContent = isEnglish ? 'Copy' : '复制';
    });

    // 更新放大缩小按钮提示文本
    const expandBtn = document.getElementById('expandBtn');
    if (expandBtn) {
        expandBtn.title = isEnglish ? 
            (expandBtn.textContent === '⧉' ? 'Restore' : 'Expand') : 
            (expandBtn.textContent === '⧉' ? '还原' : '放大');
    }

    // 更新侧边栏切换按钮提示文本
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    if (sidebarToggleBtn) {
        const isSidebarHidden = document.querySelector('.sidebar').classList.contains('hidden');
        sidebarToggleBtn.title = isEnglish ? 
            (isSidebarHidden ? 'Show Sidebar' : 'Hide Sidebar') : 
            (isSidebarHidden ? '显示侧边栏' : '隐藏侧边栏');
    }
}

// 保存语言设置
function saveLanguage() {
    localStorage.setItem('language', isEnglish ? 'en' : 'zh');
}

// 恢复语言设置
function restoreLanguage() {
    const savedLanguage = localStorage.getItem('language');
    isEnglish = savedLanguage === 'en';
    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
        langBtn.textContent = isEnglish ? 'CH' : 'EN';
    }
    applyLanguage();
}

// 切换设置窗口
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.toggle('show');
    
    // 当设置窗口打开时，更新设置项的状态
    if (modal.classList.contains('show')) {
        // 更新语言按钮状态
        const langBtn = document.getElementById('langToggleBtn');
        langBtn.textContent = isEnglish ? 'CH' : 'EN';
    }
}

// 初始化应用
initApp(); 