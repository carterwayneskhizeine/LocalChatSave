// 全局变量
let currentConversationId = null;
let conversations = [];
let directoryHandle = null;
const CONFIG_FILE = 'chat_config.json';

// 初始化应用
async function initApp() {
    try {
        // 添加选择存储位置按钮
        const selectDirBtn = document.createElement('button');
        selectDirBtn.textContent = '选择存储位置';
        selectDirBtn.className = 'select-dir-btn';
        selectDirBtn.onclick = requestDirectoryPermission;
        document.querySelector('.sidebar-header').insertBefore(selectDirBtn, document.getElementById('newChatBtn'));

        // 尝试恢复上次的存储位置
        await restoreLastDirectory();
    } catch (error) {
        console.error('初始化失败:', error);
    }
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
    
    conversations.forEach(conversation => {
        const item = document.createElement('div');
        item.className = `conversation-item ${conversation.id === currentConversationId ? 'active' : ''}`;
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'conversation-title';
        titleContainer.textContent = conversation.title;
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'conversation-buttons';
        
        // 重命名按钮
        const renameBtn = document.createElement('button');
        renameBtn.textContent = '重命名';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            renameConversation(conversation.id);
        };
        
        // 打开文件夹按钮
        const openFolderBtn = document.createElement('button');
        openFolderBtn.textContent = '打开文件夹';
        openFolderBtn.onclick = (e) => {
            e.stopPropagation();
            openConversationFolder(conversation.id);
        };
        
        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteConversation(conversation.id);
        };
        
        buttonsContainer.appendChild(renameBtn);
        buttonsContainer.appendChild(openFolderBtn);
        buttonsContainer.appendChild(deleteBtn);
        
        item.appendChild(titleContainer);
        item.appendChild(buttonsContainer);
        
        item.onclick = () => loadConversation(conversation.id);
        conversationsList.appendChild(item);
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
        
        // 读取对话内容文件
        const fileHandle = await conversation.handle.getFileHandle('messages.json', { create: true });
        const file = await fileHandle.getFile();
        const content = await file.text();
        const messages = content ? JSON.parse(content) : [];
        
        // 渲染消息
        messages.forEach(message => renderMessage(message));
        
        renderConversationsList();
    } catch (error) {
        console.error('加载对话内容失败:', error);
    }
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const text = input.value.trim();
    const files = fileInput.files;
    
    if (!text && files.length === 0) return;
    
    try {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;
        
        const message = {
            type: 'text',
            content: text,
            timestamp: new Date().toISOString()
        };
        
        // 保存文本消息
        if (text) {
            await saveMessage(conversation.handle, message);
            renderMessage(message);
        }
        
        // 保存文件
        for (const file of files) {
            const fileMessage = {
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
            renderMessage(fileMessage);
        }
        
        // 清空输入
        input.value = '';
        fileInput.value = '';
    } catch (error) {
        console.error('发送消息失败:', error);
        alert('发送消息失败');
    }
}

// 保存消息到文件
async function saveMessage(conversationHandle, message) {
    try {
        const fileHandle = await conversationHandle.getFileHandle('messages.json', { create: true });
        const file = await fileHandle.getFile();
        const content = await file.text();
        const messages = content ? JSON.parse(content) : [];
        
        messages.push(message);
        
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(messages, null, 2));
        await writable.close();
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
    
    if (message.type === 'text') {
        // 检查是否是代码
        if (isCode(message.content)) {
            messageElement.className += ' code';
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
            
            messageElement.appendChild(copyBtn);
            messageElement.appendChild(pre);
        } else {
            messageElement.textContent = message.content;
        }
    } else if (message.type === 'file') {
        const filename = message.filename.toLowerCase();
        if (filename.endsWith('.mp4')) {
            const video = document.createElement('video');
            video.className = 'video-preview';
            video.controls = true;
            const fileContent = await readFile(message.filename);
            video.src = URL.createObjectURL(new Blob([fileContent]));
            messageElement.appendChild(video);
        } else if (filename.match(/\.(jpg|jpeg|png|gif)$/)) {
            const img = document.createElement('img');
            const fileContent = await readFile(message.filename);
            img.src = URL.createObjectURL(new Blob([fileContent]));
            messageElement.appendChild(img);
        } else {
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
            messageElement.appendChild(link);
        }
    }
    
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

        // 创建一个临时文件在目标文件夹中
        const tempFileName = '.folder_opener_' + Date.now() + '.txt';
        const fileHandle = await conversation.handle.getFileHandle(tempFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write('This is a temporary file to help open the folder.');
        await writable.close();

        // 让用户"下载"这个文件，这会打开文件所在的文件夹
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = tempFileName;
        a.click();
        URL.revokeObjectURL(url);

        // 延迟一段时间后删除临时文件
        setTimeout(async () => {
            try {
                await conversation.handle.removeEntry(tempFileName);
            } catch {}
        }, 1000);
    } catch (error) {
        console.error('打开文件夹失败:', error);
        alert('打开文件夹失败，请手动打开文件夹位置');
    }
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

// 初始化应用
initApp(); 