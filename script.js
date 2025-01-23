// 全局变量
let currentConversationId = null;
let conversations = [];
let directoryHandle = null;
const CONFIG_FILE = 'chat_config.json';
let isDarkMode = false;

// 初始化应用
async function initApp() {
    try {
        // 添加选择存储位置按钮
        const selectDirBtn = document.createElement('button');
        selectDirBtn.textContent = '选择存储位置';
        selectDirBtn.className = 'select-dir-btn';
        selectDirBtn.onclick = requestDirectoryPermission;
        document.querySelector('.sidebar-header').insertBefore(selectDirBtn, document.getElementById('newChatBtn'));

        // 添加文件选择事件监听
        document.getElementById('fileInput').addEventListener('change', handleFileSelect);

        // 添加主题切换事件监听
        document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

        // 恢复主题设置
        restoreTheme();

        // 尝试恢复上次的存储位置
        await restoreLastDirectory();
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
    const themeIcon = document.querySelector('.theme-icon');
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.textContent = '🌙';
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.textContent = '🌞';
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
                title: c.title
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

// 请求目录访问权限
async function requestDirectoryPermission() {
    try {
        directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        await restoreLastDirectory();
        return true;
    } catch (error) {
        console.error('获取目录权限失败:', error);
        alert('请选择一个文件夹来保存对话内容。如果您取消了选择，部分功能将无法使用。');
        return false;
    }
}

// 确保有目录访问权限
async function ensureDirectoryPermission() {
    if (!directoryHandle) {
        return await requestDirectoryPermission();
    }
    try {
        // 验证权限是否仍然有效
        await directoryHandle.requestPermission({ mode: 'readwrite' });
        return true;
    } catch (error) {
        return await requestDirectoryPermission();
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
        renderConversationsList();
    } catch (error) {
        console.error('加载对话失败:', error);
    }
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
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'conversation-title';
        titleContainer.textContent = conversation.title;
        
        const menuButton = document.createElement('button');
        menuButton.className = 'conversation-menu-btn';
        menuButton.innerHTML = '⋮'; // 竖直三点图标
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
        
        item.appendChild(titleContainer);
        item.appendChild(menuButton);
        item.appendChild(dropdown);
        
        item.onclick = () => loadConversation(conversation.id);
        conversationsList.appendChild(item);
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

// 初始化应用
initApp(); 