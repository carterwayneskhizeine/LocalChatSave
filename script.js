// 全局变量
let currentConversationId = null;
let conversations = [];
let directoryHandle = null;
const CONFIG_FILE = 'chat_config.json';
let isDarkMode = false;
let isEnglish = false; // 添加语言设置变量

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

        // 添加粘贴事件监听
        document.getElementById('messageInput').addEventListener('paste', handlePaste);

        // 添加消息容器滚动事件监听
        const messagesContainer = document.getElementById('messagesContainer');
        const scrollBottomBtn = document.getElementById('scrollBottomBtn');
        
        messagesContainer.addEventListener('scroll', () => {
            const scrollHeight = messagesContainer.scrollHeight;
            const scrollTop = messagesContainer.scrollTop;
            const clientHeight = messagesContainer.clientHeight;
            
            // 当距离底部超过200像素时显示按钮
            if (scrollHeight - scrollTop - clientHeight > 200) {
                scrollBottomBtn.classList.add('show');
            } else {
                scrollBottomBtn.classList.remove('show');
            }
        });
        
        // 添加跳转到底部按钮点击事件
        scrollBottomBtn.onclick = () => {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        };

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
                currentFolder: c.currentFolder, // 添加当前文件夹信息
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

// 加载已有对话
async function loadConversations() {
    try {
        conversations = [];
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'directory') {
                // 加载主对话文件夹
                const conversation = {
                    id: entry.name,
                    title: entry.name,
                    handle: entry,
                    subFolders: new Map(),
                    currentFolder: 'main'   // 默认为主文件夹
                };
                
                // 扫描所有子文件夹（包括嵌套的）
                await scanSubFolders(entry, conversation.subFolders, '');
                
                conversations.push(conversation);
            }
        }
        
        // 读取配置文件中的顺序信息和当前文件夹状态
        const config = await loadConfig();
        if (config && config.conversations) {
            // 根据配置文件中的顺序排序
            conversations.sort((a, b) => {
                const orderA = config.conversations.find(c => c.id === a.id)?.order ?? Infinity;
                const orderB = config.conversations.find(c => c.id === b.id)?.order ?? Infinity;
                return orderA - orderB;
            });
            
            // 恢复每个对话的当前文件夹状态
            conversations.forEach(conversation => {
                const savedConversation = config.conversations.find(c => c.id === conversation.id);
                if (savedConversation && savedConversation.currentFolder) {
                    // 确保子文件夹存在才恢复状态
                    if (savedConversation.currentFolder === 'main' || 
                        conversation.subFolders.has(savedConversation.currentFolder)) {
                        conversation.currentFolder = savedConversation.currentFolder;
                    }
                }
            });
        }
        
        renderConversationsList();
    } catch (error) {
        console.error('加载对话失败:', error);
    }
}

// 添加递归扫描子文件夹的函数
async function scanSubFolders(parentHandle, subFoldersMap, parentPath) {
    for await (const entry of parentHandle.values()) {
        if (entry.kind === 'directory') {
            // 构建完整路径
            const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
            
            // 将文件夹添加到 Map 中
            subFoldersMap.set(fullPath, {
                handle: entry,
                name: entry.name,
                fullPath: fullPath
            });
            
            // 递归扫描子文件夹
            await scanSubFolders(entry, subFoldersMap, fullPath);
        }
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
        if (!directoryHandle) {
            alert(isEnglish ? 'Please select a storage location first' : '请先选择保存目录');
            return;
        }

        // 重新验证目录权限
        const hasPermission = await verifyDirectoryPermission(directoryHandle);
        if (!hasPermission) {
            alert(isEnglish ? 'Please select the storage location again' : '请重新选择保存目录');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newConversationName = `对话_${timestamp}`;
        const newDirHandle = await directoryHandle.getDirectoryHandle(newConversationName, { create: true });
        
        const conversation = {
            id: newConversationName,
            title: newConversationName,
            handle: newDirHandle,
            subFolders: new Map(),
            currentFolder: 'main'
        };
        
        conversations.push(conversation);
        await saveConfig();
        renderConversationsList();
        await loadConversation(conversation.id);
    } catch (error) {
        console.error('创建新对话失败:', error);
        alert(isEnglish ? 'Failed to create new chat. Please make sure you have selected a storage location and have write permissions.' : '创建新对话失败，请确保您已选择了保存目录并具有写入权限');
    }
}

// 修改菜单项创建部分
function createDropdownMenu(conversation) {
    const menuItems = [
        { icon: '✏️', text: isEnglish ? 'Rename' : '重命名', action: () => renameConversation(conversation.id) },
        { icon: '📂', text: isEnglish ? 'Open Folder' : '打开文件夹', action: () => openConversationFolder(conversation.id) },
        { icon: '🗑️', text: isEnglish ? 'Delete' : '删除', action: () => deleteConversation(conversation.id) }
    ];
    
    // 如果不在主文件夹，添加"返回主文件夹"选项
    if (conversation.currentFolder !== 'main') {
        menuItems.unshift({
            icon: '⬆️',
            text: isEnglish ? 'Return to Main Folder' : '返回主文件夹',
            action: () => switchFolder(conversation.id, 'main')
        });
    }
    
    // 如果有子文件夹，添加"所有子文件夹"按钮
    if (conversation.subFolders.size > 0) {
        menuItems.push({ type: 'separator' });
        menuItems.push({
            icon: '📁',
            text: isEnglish ? 'All Subfolders' : '所有子文件夹',
            action: () => showSubfoldersModal(conversation)
        });
    }
    
    return menuItems;
}

// 显示子文件夹选择窗口
function showSubfoldersModal(conversation) {
    const modal = document.getElementById('subfoldersModal');
    const content = document.getElementById('subfoldersContent');
    content.innerHTML = '';
    
    // 将所有子文件夹按字母顺序排序
    const sortedFolders = Array.from(conversation.subFolders.entries())
        .sort(([pathA], [pathB]) => pathA.localeCompare(pathB));
    
    // 创建子文件夹列表
    for (const [fullPath, folder] of sortedFolders) {
        if (fullPath !== conversation.currentFolder) {
            const item = document.createElement('div');
            item.className = 'subfolder-item';
            item.innerHTML = `
                <span class="subfolder-icon">📁</span>
                <span class="subfolder-path">${fullPath}</span>
            `;
            item.onclick = () => {
                switchFolder(conversation.id, fullPath);
                closeSubfoldersModal();
            };
            content.appendChild(item);
        }
    }
    
    modal.classList.add('show');
}

// 关闭子文件夹选择窗口
function closeSubfoldersModal() {
    const modal = document.getElementById('subfoldersModal');
    modal.classList.remove('show');
}

// 修改渲染对话列表函数中的下拉菜单创建部分
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
        
        // 使用新的创建菜单函数
        const menuItems = createDropdownMenu(conversation);
        
        menuItems.forEach(menuItem => {
            if (menuItem.type === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'dropdown-separator';
                dropdown.appendChild(separator);
                return;
            }
            
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
            // 获取触发按钮的位置
            const menuBtn = dropdown.parentElement.querySelector('.conversation-menu-btn');
            const rect = menuBtn.getBoundingClientRect();
            
            // 设置下拉菜单的位置
            dropdown.style.top = `${rect.top}px`;
            
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
    
    const newTitle = prompt(isEnglish ? 'Enter new chat name:' : '请输入新的对话名称:', conversation.title);
    if (!newTitle || newTitle === conversation.title) return;
    
    try {
        // 创建新文件夹
        const newDirHandle = await directoryHandle.getDirectoryHandle(newTitle, { create: true });
        
        // 递归复制文件夹的函数
        async function copyFolder(sourceHandle, targetHandle) {
            for await (const entry of sourceHandle.values()) {
                if (entry.kind === 'file') {
                    // 复制文件
                    const file = await entry.getFile();
                    const content = await file.arrayBuffer();
                    const newFileHandle = await targetHandle.getFileHandle(entry.name, { create: true });
                    const writable = await newFileHandle.createWritable();
                    await writable.write(content);
                    await writable.close();
                } else if (entry.kind === 'directory') {
                    // 递归复制子文件夹
                    const newSubDirHandle = await targetHandle.getDirectoryHandle(entry.name, { create: true });
                    await copyFolder(entry, newSubDirHandle);
                }
            }
        }
        
        // 开始复制所有内容
        await copyFolder(conversation.handle, newDirHandle);
        
        // 删除旧文件夹
        await directoryHandle.removeEntry(conversationId, { recursive: true });
        
        // 更新会话信息
        conversation.title = newTitle;
        conversation.id = newTitle;
        conversation.handle = newDirHandle;
        
        // 重新扫描子文件夹
        conversation.subFolders = new Map();
        await scanSubFolders(newDirHandle, conversation.subFolders, '');
        
        // 如果当前正在查看这个对话，重新加载内容
        if (currentConversationId === conversationId) {
            currentConversationId = newTitle;
            await loadConversation(newTitle);
        }
        
        await saveConfig(); // 保存配置
        renderConversationsList();
        
        // 显示成功提示
        alert(isEnglish ? 'Chat renamed successfully' : '对话重命名成功');
    } catch (error) {
        console.error('重命名失败:', error);
        alert(isEnglish ? 'Failed to rename chat. Please make sure the new name is valid and not duplicate.' : '重命名失败，请确保新名称合法且没有重复');
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

// 扫描对话文件夹中的新文件
async function scanConversationFolder(conversation) {
    try {
        // 获取消息顺序文件
        const orderHandle = await conversation.handle.getFileHandle('messages_order.json', { create: true });
        const orderFile = await orderHandle.getFile();
        const orderContent = await orderFile.text();
        let messageOrder = orderContent ? JSON.parse(orderContent) : [];

        // 获取文件夹中的所有文件
        const existingFiles = new Set();
        for await (const entry of conversation.handle.values()) {
            if (entry.kind === 'file' && entry.name !== 'messages_order.json') {
                existingFiles.add(entry.name);
            }
        }

        // 获取已记录的文件
        const recordedFiles = new Set(messageOrder.map(m => {
            if (m.type === 'text') return `${m.id}.txt`;
            if (m.type === 'file') return m.filename;
            return null;
        }).filter(Boolean));

        // 找出新文件
        const newFiles = Array.from(existingFiles).filter(filename => !recordedFiles.has(filename));

        // 处理新文件
        for (const filename of newFiles) {
            const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            const timestamp = new Date().toISOString();

            // 如果不是文本文件，作为文件消息处理
            if (!filename.endsWith('.txt') || filename === 'messages_order.json') {
                messageOrder.push({
                    id: messageId,
                    type: 'file',
                    filename: filename,
                    timestamp: timestamp
                });
            } else {
                // 文本文件的处理
                const txtHandle = await conversation.handle.getFileHandle(filename);
                const txtFile = await txtHandle.getFile();
                const content = await txtFile.text();
                
                messageOrder.push({
                    id: messageId,
                    type: 'text',
                    timestamp: timestamp
                });

                // 保存文本内容
                const newTextHandle = await conversation.handle.getFileHandle(`${messageId}.txt`, { create: true });
                const writable = await newTextHandle.createWritable();
                await writable.write(content);
                await writable.close();

                // 删除原始文本文件
                await conversation.handle.removeEntry(filename).catch(() => {});
            }
        }

        // 按时间戳排序
        messageOrder.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // 保存更新后的消息顺序
        if (newFiles.length > 0) {
            const orderWritable = await orderHandle.createWritable();
            await orderWritable.write(JSON.stringify(messageOrder, null, 2));
            await orderWritable.close();
        }

        return messageOrder;
    } catch (error) {
        console.error('扫描对话文件夹失败:', error);
        return null;
    }
}

// 修改 loadConversation 函数
async function loadConversation(conversationId) {
    try {
        currentConversationId = conversationId;
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) return;
        
        // 获取正确的文件夹句柄
        const folderHandle = conversation.currentFolder === 'main' ? 
            conversation.handle : 
            conversation.subFolders.get(conversation.currentFolder).handle;
        
        // 清空消息容器
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';
        
        // 更新当前路径显示
        updateCurrentPath(conversation);
        
        // 重新绑定滚动事件监听
        const scrollBottomBtn = document.getElementById('scrollBottomBtn');
        messagesContainer.onscroll = () => {
            const scrollHeight = messagesContainer.scrollHeight;
            const scrollTop = messagesContainer.scrollTop;
            const clientHeight = messagesContainer.clientHeight;
            
            // 当距离底部超过200像素时显示按钮
            if (scrollHeight - scrollTop - clientHeight > 200) {
                scrollBottomBtn.classList.add('show');
            } else {
                scrollBottomBtn.classList.remove('show');
            }
        };
        
        // 扫描并加载当前文件夹的消息
        const messageOrder = await scanConversationFolder({
            id: conversationId,
            handle: folderHandle
        });
        
        if (messageOrder) {
            // 按顺序加载每条消息
            for (const messageInfo of messageOrder) {
                if (messageInfo.type === 'text') {
                    const textHandle = await folderHandle.getFileHandle(`${messageInfo.id}.txt`);
                    const textFile = await textHandle.getFile();
                    const content = await textFile.text();
                    
                    await renderMessage({
                        id: messageInfo.id,
                        type: 'text',
                        content: content,
                        timestamp: messageInfo.timestamp
                    });
                } else if (messageInfo.type === 'file') {
                    await renderMessage({
                        id: messageInfo.id,
                        type: 'file',
                        filename: messageInfo.filename,
                        timestamp: messageInfo.timestamp
                    });
                }
            }
        }
        
        renderConversationsList();
    } catch (error) {
        console.error('加载对话内容失败:', error);
    }
}

// 修改 sendMessage 函数
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
        
        // 获取当前文件夹的句柄
        const currentFolderHandle = conversation.currentFolder === 'main' ? 
            conversation.handle : 
            conversation.subFolders.get(conversation.currentFolder).handle;
        
        // 发送文本消息
        if (text) {
            const messageId = Date.now().toString();
            const message = {
                id: messageId,
                type: 'text',
                content: text,
                timestamp: new Date().toISOString()
            };
            await saveMessage(currentFolderHandle, message);
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
            
            // 保存文件到当前文件夹
            const fileHandle = await currentFolderHandle.getFileHandle(file.name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(file);
            await writable.close();
            
            await saveMessage(currentFolderHandle, fileMessage);
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
        alert(isEnglish ? 'Failed to send message' : '发送消息失败');
    }
}

// 修改 saveMessage 函数，使用传入的文件夹句柄
async function saveMessage(folderHandle, message) {
    try {
        // 读取或创建消息顺序文件
        let orderHandle = await folderHandle.getFileHandle('messages_order.json', { create: true });
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
            const textHandle = await folderHandle.getFileHandle(`${message.id}.txt`, { create: true });
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
    messageElement.dataset.messageId = message.id;
    
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
            copyBtn.textContent = isEnglish ? 'Copy' : '复制';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(message.content);
                copyBtn.textContent = isEnglish ? 'Copied' : '已复制';
                setTimeout(() => copyBtn.textContent = isEnglish ? 'Copy' : '复制', 2000);
            };
            
            contentContainer.appendChild(copyBtn);
            contentContainer.appendChild(pre);
            
            // 添加文件信息
            const fileInfo = document.createElement('div');
            fileInfo.className = 'message-file-info';
            
            const filename = document.createElement('span');
            filename.className = 'message-filename';
            filename.innerHTML = `<span class="message-folder-icon">📄</span>${message.id}.txt`;
            filename.title = isEnglish ? 'Click to rename' : '点击重命名';
            filename.onclick = () => enterMessageRenameMode(filename, message);
            
            const folder = document.createElement('span');
            folder.className = 'message-folder';
            const conversation = conversations.find(c => c.id === currentConversationId);
            const folderPath = conversation.currentFolder === 'main' ? conversation.title : `${conversation.title}/${conversation.currentFolder}`;
            folder.innerHTML = `<span class="message-folder-icon">📁</span>${folderPath}`;
            
            fileInfo.appendChild(filename);
            fileInfo.appendChild(folder);
            contentContainer.appendChild(fileInfo);
        } else {
            contentContainer.textContent = message.content;
            
            // 添加文件信息
            const fileInfo = document.createElement('div');
            fileInfo.className = 'message-file-info';
            
            const filename = document.createElement('span');
            filename.className = 'message-filename';
            filename.innerHTML = `<span class="message-folder-icon">📄</span>${message.id}.txt`;
            filename.title = isEnglish ? 'Click to rename' : '点击重命名';
            filename.onclick = () => enterMessageRenameMode(filename, message);
            
            const folder = document.createElement('span');
            folder.className = 'message-folder';
            const conversation = conversations.find(c => c.id === currentConversationId);
            const folderPath = conversation.currentFolder === 'main' ? conversation.title : `${conversation.title}/${conversation.currentFolder}`;
            folder.innerHTML = `<span class="message-folder-icon">📁</span>${folderPath}`;
            
            fileInfo.appendChild(filename);
            fileInfo.appendChild(folder);
            contentContainer.appendChild(fileInfo);
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
            
            // 创建图片信息容器
            const imageInfo = document.createElement('div');
            imageInfo.className = 'image-info';
            
            // 创建图片名称元素
            const imageName = document.createElement('span');
            imageName.className = 'image-name';
            imageName.textContent = message.filename;
            imageName.title = isEnglish ? 'Click to rename' : '点击重命名';
            imageName.onclick = () => enterImageRenameMode(imageName, message);
            
            // 创建图片分辨率元素
            const imageResolution = document.createElement('span');
            imageResolution.className = 'image-resolution';
            
            // 获取图片分辨率
            img.onload = () => {
                imageResolution.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
                URL.revokeObjectURL(img.src);
            };
            
            imageInfo.appendChild(imageName);
            imageInfo.appendChild(imageResolution);
            
            contentContainer.appendChild(img);
            contentContainer.appendChild(imageInfo);
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
    
    if (message.type === 'text') {
        // 添加编辑按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'message-edit-btn';
        editBtn.textContent = isEnglish ? 'Edit' : '编辑';
        editBtn.onclick = () => enterEditMode(message, contentContainer);
        actionContainer.appendChild(editBtn);
    }
    
    // 添加删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'message-delete-btn';
    deleteBtn.textContent = isEnglish ? 'Delete' : '删除';
    deleteBtn.onclick = () => deleteMessage(message);
    
    actionContainer.appendChild(deleteBtn);
    
    // 将内容和操作按钮添加到消息元素
    messageElement.appendChild(contentContainer);
    messageElement.appendChild(actionContainer);
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 在添加消息后检查是否需要显示跳转按钮
    const scrollHeight = messagesContainer.scrollHeight;
    const scrollTop = messagesContainer.scrollTop;
    const clientHeight = messagesContainer.clientHeight;
    
    const scrollBottomBtn = document.getElementById('scrollBottomBtn');
    if (scrollHeight - scrollTop - clientHeight > 200) {
        scrollBottomBtn.classList.add('show');
    } else {
        scrollBottomBtn.classList.remove('show');
    }
    
    // 如果用户正在查看底部，自动滚动到新消息
    if (scrollHeight - scrollTop - clientHeight < 300) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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

// 修改 readFile 函数
async function readFile(filename) {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) throw new Error('未找到对话');
    
    // 获取当前文件夹的句柄
    const currentFolderHandle = conversation.currentFolder === 'main' ? 
        conversation.handle : 
        conversation.subFolders.get(conversation.currentFolder).handle;
    
    const fileHandle = await currentFolderHandle.getFileHandle(filename);
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
        '存储位置': 'Storage Location',
        '更新': 'Update'  // 添加"更新"的翻译
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

    // 更新跳转到底部按钮的提示文本
    const scrollBottomBtn = document.getElementById('scrollBottomBtn');
    if (scrollBottomBtn) {
        scrollBottomBtn.title = isEnglish ? 'Scroll to bottom' : '跳转到底部';
    }

    // 更新"更新文件夹"按钮文本
    const updateFolderBtn = document.querySelector('.update-folder-btn');
    if (updateFolderBtn) {
        updateFolderBtn.textContent = isEnglish ? 'Update Folders' : '更新文件夹';
    }

    // 更新子文件夹窗口的标题
    const subfoldersTitle = document.querySelector('.subfolders-title');
    if (subfoldersTitle) {
        subfoldersTitle.textContent = isEnglish ? 'All Subfolders' : '所有子文件夹';
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
        
        // 更新设置部分
        const settingsSections = document.querySelectorAll('.settings-section');
        
        // 更新常规设置部分
        const generalSection = settingsSections[0];
        if (generalSection) {
            const generalItems = generalSection.querySelectorAll('.settings-item');
            
            // 主题设置
            generalItems[0].innerHTML = `
                <div class="settings-item-row">
                    <span class="settings-item-label">${isEnglish ? 'Theme' : '主题'}</span>
                    <button id="themeToggleBtn" class="theme-toggle-btn">
                        ${isEnglish ? 'Toggle Theme' : '切换主题'}
                    </button>
                </div>
            `;
            
            // 语言设置
            generalItems[1].innerHTML = `
                <div class="settings-item-row">
                    <span class="settings-item-label">${isEnglish ? 'Language' : '语言'}</span>
                    <button id="langToggleBtn" class="lang-toggle-btn">
                        ${isEnglish ? 'CH' : 'EN'}
                    </button>
                </div>
            `;
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

// 进入编辑模式
function enterEditMode(message, contentContainer) {
    const messageElement = contentContainer.closest('.message');
    messageElement.classList.add('editing');
    
    // 保存原始内容
    const originalContent = message.content;
    
    // 创建编辑区域
    const textarea = document.createElement('textarea');
    textarea.value = originalContent;
    
    // 创建操作按钮
    const editActions = document.createElement('div');
    editActions.className = 'edit-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-save-btn';
    saveBtn.textContent = isEnglish ? 'Save' : '保存';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-cancel-btn';
    cancelBtn.textContent = isEnglish ? 'Cancel' : '取消';
    
    editActions.appendChild(saveBtn);
    editActions.appendChild(cancelBtn);
    
    // 清空原有内容并添加编辑界面
    contentContainer.innerHTML = '';
    contentContainer.appendChild(textarea);
    contentContainer.appendChild(editActions);
    
    // 自动聚焦并将光标移到末尾
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    
    // 保存编辑
    saveBtn.onclick = async () => {
        const newContent = textarea.value.trim();
        if (newContent === '') return;
        if (newContent === originalContent) {
            exitEditMode(messageElement, contentContainer, originalContent);
            return;
        }
        
        try {
            await saveEditedMessage(message.id, newContent);
            message.content = newContent;
            exitEditMode(messageElement, contentContainer, newContent);
        } catch (error) {
            console.error('保存编辑失败:', error);
            alert(isEnglish ? 'Failed to save changes' : '保存修改失败');
        }
    };
    
    // 取消编辑
    cancelBtn.onclick = () => {
        exitEditMode(messageElement, contentContainer, originalContent);
    };
    
    // ESC键取消编辑
    textarea.onkeydown = (e) => {
        if (e.key === 'Escape') {
            exitEditMode(messageElement, contentContainer, originalContent);
        }
    };
}

// 退出编辑模式
function exitEditMode(messageElement, contentContainer, content) {
    messageElement.classList.remove('editing');
    if (isCode(content)) {
        contentContainer.className = 'message-content code';
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = content;
        pre.appendChild(code);
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = isEnglish ? 'Copy' : '复制';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(content);
            copyBtn.textContent = isEnglish ? 'Copied' : '已复制';
            setTimeout(() => copyBtn.textContent = isEnglish ? 'Copy' : '复制', 2000);
        };
        
        contentContainer.innerHTML = '';
        contentContainer.appendChild(copyBtn);
        contentContainer.appendChild(pre);
    } else {
        contentContainer.className = 'message-content';
        contentContainer.textContent = content;
    }
}

// 保存编辑后的消息
async function saveEditedMessage(messageId, newContent) {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) throw new Error('未找到对话');
    
    // 保存新的文本内容
    const textHandle = await conversation.handle.getFileHandle(`${messageId}.txt`, { create: true });
    const writable = await textHandle.createWritable();
    await writable.write(newContent);
    await writable.close();
}

// 添加图片重命名相关函数
async function enterImageRenameMode(nameElement, message) {
    const imageInfo = nameElement.parentElement;
    const oldName = message.filename;
    
    // 创建输入框
    const input = document.createElement('input');
    input.className = 'image-name-input';
    input.value = oldName;
    input.type = 'text';
    
    // 创建操作按钮容器
    const actions = document.createElement('div');
    actions.className = 'image-rename-actions';
    
    // 创建保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.className = 'image-rename-save';
    saveBtn.textContent = isEnglish ? 'Save' : '保存';
    
    // 创建取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'image-rename-cancel';
    cancelBtn.textContent = isEnglish ? 'Cancel' : '取消';
    
    // 保存重命名
    saveBtn.onclick = async () => {
        const newName = input.value.trim();
        if (!newName || newName === oldName) {
            exitImageRenameMode(imageInfo, nameElement);
            return;
        }
        
        // 验证文件名
        if (!newName.match(/\.(jpg|jpeg|png|gif)$/i)) {
            alert(isEnglish ? 'Please keep the image extension' : '请保留图片扩展名');
            return;
        }
        
        try {
            await renameImage(message, newName);
            nameElement.textContent = newName;
            exitImageRenameMode(imageInfo, nameElement);
        } catch (error) {
            console.error('重命名图片失败:', error);
            alert(isEnglish ? 'Failed to rename image' : '重命名图片失败');
        }
    };
    
    // 取消重命名
    cancelBtn.onclick = () => {
        exitImageRenameMode(imageInfo, nameElement);
    };
    
    // ESC键取消重命名
    input.onkeydown = (e) => {
        if (e.key === 'Escape') {
            exitImageRenameMode(imageInfo, nameElement);
        } else if (e.key === 'Enter') {
            saveBtn.click();
        }
    };
    
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    
    // 替换原有内容
    imageInfo.innerHTML = '';
    imageInfo.appendChild(input);
    imageInfo.appendChild(actions);
    
    // 聚焦输入框并选中文件名部分（不包括扩展名）
    input.focus();
    const extIndex = oldName.lastIndexOf('.');
    input.setSelectionRange(0, extIndex);
}

// 退出图片重命名模式
function exitImageRenameMode(imageInfo, nameElement) {
    const resolution = imageInfo.querySelector('.image-resolution');
    imageInfo.innerHTML = '';
    imageInfo.appendChild(nameElement);
    if (resolution) {
        imageInfo.appendChild(resolution);
    }
}

// 重命名图片文件
async function renameImage(message, newName) {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) throw new Error('未找到对话');
    
    try {
        // 读取原文件内容
        const oldFileHandle = await conversation.handle.getFileHandle(message.filename);
        const file = await oldFileHandle.getFile();
        const content = await file.arrayBuffer();
        
        // 创建新文件
        const newFileHandle = await conversation.handle.getFileHandle(newName, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        
        // 删除旧文件
        await conversation.handle.removeEntry(message.filename);
        
        // 更新消息顺序文件中的文件名
        const orderHandle = await conversation.handle.getFileHandle('messages_order.json');
        const orderFile = await orderHandle.getFile();
        const orderContent = await orderFile.text();
        let messageOrder = JSON.parse(orderContent);
        
        const targetMessage = messageOrder.find(m => m.id === message.id);
        if (targetMessage) {
            targetMessage.filename = newName;
            const orderWritable = await orderHandle.createWritable();
            await orderWritable.write(JSON.stringify(messageOrder, null, 2));
            await orderWritable.close();
        }
        
        // 更新消息对象
        message.filename = newName;
    } catch (error) {
        console.error('重命名图片失败:', error);
        throw error;
    }
}

// 处理粘贴事件
async function handlePaste(e) {
    const items = e.clipboardData.items;
    let hasImage = false;

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            hasImage = true;
            const file = item.getAsFile();
            const timestamp = Date.now();
            const ext = item.type.split('/')[1];
            const filename = `clipboard_image_${timestamp}.${ext}`;
            
            // 创建一个新的 File 对象，使用我们生成的文件名
            const renamedFile = new File([file], filename, { type: file.type });
            
            // 创建预览
            const filePreviewArea = document.getElementById('filePreviewArea');
            const previewItem = document.createElement('div');
            previewItem.className = 'file-preview-item';
            
            const fileName = document.createElement('span');
            fileName.className = 'file-preview-name';
            fileName.textContent = filename;
            
            const removeButton = document.createElement('button');
            removeButton.className = 'file-preview-remove';
            
            previewItem.appendChild(fileName);
            previewItem.appendChild(removeButton);
            filePreviewArea.appendChild(previewItem);
            
            // 将重命名后的图片添加到文件输入
            const fileInput = document.getElementById('fileInput');
            const dt = new DataTransfer();
            
            // 保留现有的文件
            if (fileInput.files) {
                Array.from(fileInput.files).forEach(existingFile => {
                    dt.items.add(existingFile);
                });
            }
            
            // 添加新的剪贴板图片（使用重命名后的文件）
            dt.items.add(renamedFile);
            fileInput.files = dt.files;
            
            // 设置移除按钮事件
            removeButton.onclick = () => removeFileFromSelection(renamedFile);
        }
    }
    
    // 如果粘贴的是图片，阻止默认行为（防止图片URL被粘贴到输入框）
    if (hasImage) {
        e.preventDefault();
    }
}

// 添加切换文件夹的函数
async function switchFolder(conversationId, folderPath) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    try {
        // 更新当前文件夹
        conversation.currentFolder = folderPath;
        
        // 获取正确的文件夹句柄
        const folderHandle = folderPath === 'main' ? 
            conversation.handle : 
            conversation.subFolders.get(folderPath).handle;
        
        // 清空消息容器
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';
        
        // 更新当前路径显示
        updateCurrentPath(conversation);
        
        // 扫描并加载新文件夹的消息
        const messageOrder = await scanConversationFolder({
            id: conversationId,
            handle: folderHandle
        });
        
        if (messageOrder) {
            // 按顺序加载每条消息
            for (const messageInfo of messageOrder) {
                if (messageInfo.type === 'text') {
                    const textHandle = await folderHandle.getFileHandle(`${messageInfo.id}.txt`);
                    const textFile = await textHandle.getFile();
                    const content = await textFile.text();
                    
                    await renderMessage({
                        id: messageInfo.id,
                        type: 'text',
                        content: content,
                        timestamp: messageInfo.timestamp
                    });
                } else if (messageInfo.type === 'file') {
                    await renderMessage({
                        id: messageInfo.id,
                        type: 'file',
                        filename: messageInfo.filename,
                        timestamp: messageInfo.timestamp
                    });
                }
            }
        }
        
        // 更新界面
        renderConversationsList();
    } catch (error) {
        console.error('切换文件夹失败:', error);
        alert(isEnglish ? 'Failed to switch folder' : '切换文件夹失败');
    }
}

// 添加更新当前路径的函数
function updateCurrentPath(conversation) {
    const pathDisplay = document.getElementById('currentPath');
    if (!pathDisplay) {
        // 如果路径显示元素不存在，创建它
        const mainContent = document.querySelector('.main-content');
        const pathDisplay = document.createElement('div');
        pathDisplay.id = 'currentPath';
        pathDisplay.className = 'current-path';
        
        // 将路径显示元素插入到主内容区域的顶部
        mainContent.insertBefore(pathDisplay, mainContent.firstChild);
    }
    
    // 更新路径显示
    if (conversation.currentFolder !== 'main') {
        pathDisplay.innerHTML = `<span class="path-icon">📂</span> ${conversation.currentFolder}`;
        pathDisplay.style.display = 'block';
    } else {
        pathDisplay.style.display = 'none';
    }
}

// 添加消息重命名模式函数
async function enterMessageRenameMode(nameElement, message) {
    const fileInfo = nameElement.parentElement;
    const oldName = `${message.id}.txt`;
    
    // 创建输入框
    const input = document.createElement('input');
    input.className = 'message-filename-input';
    input.value = oldName;
    input.type = 'text';
    
    // 创建操作按钮容器
    const actions = document.createElement('div');
    actions.className = 'message-rename-actions';
    
    // 创建保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.className = 'message-rename-save';
    saveBtn.textContent = isEnglish ? 'Save' : '保存';
    
    // 创建取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'message-rename-cancel';
    cancelBtn.textContent = isEnglish ? 'Cancel' : '取消';
    
    // 保存重命名
    saveBtn.onclick = async () => {
        const newName = input.value.trim();
        if (!newName || newName === oldName) {
            exitMessageRenameMode(fileInfo, nameElement);
            return;
        }
        
        // 验证文件名
        if (!newName.endsWith('.txt')) {
            alert(isEnglish ? 'Please keep the .txt extension' : '请保留.txt扩展名');
            return;
        }
        
        try {
            await renameMessageFile(message, newName);
            nameElement.innerHTML = `<span class="message-folder-icon">📄</span>${newName}`;
            exitMessageRenameMode(fileInfo, nameElement);
            
            // 保存配置以确保更改被持久化
            await saveConfig();
        } catch (error) {
            console.error('重命名消息文件失败:', error);
            alert(isEnglish ? 'Failed to rename message file' : '重命名消息文件失败');
        }
    };
    
    // 取消重命名
    cancelBtn.onclick = () => {
        exitMessageRenameMode(fileInfo, nameElement);
    };
    
    // ESC键取消重命名
    input.onkeydown = (e) => {
        if (e.key === 'Escape') {
            exitMessageRenameMode(fileInfo, nameElement);
        } else if (e.key === 'Enter') {
            saveBtn.click();
        }
    };
    
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    
    // 替换原有内容
    const folder = fileInfo.querySelector('.message-folder');
    fileInfo.innerHTML = '';
    fileInfo.appendChild(input);
    fileInfo.appendChild(actions);
    fileInfo.appendChild(folder);
    
    // 聚焦输入框并选中文件名部分（不包括扩展名）
    input.focus();
    const extIndex = oldName.lastIndexOf('.');
    input.setSelectionRange(0, extIndex);
}

// 退出消息重命名模式
function exitMessageRenameMode(fileInfo, nameElement) {
    const folder = fileInfo.querySelector('.message-folder');
    fileInfo.innerHTML = '';
    fileInfo.appendChild(nameElement);
    fileInfo.appendChild(folder);
}

// 重命名消息文件
async function renameMessageFile(message, newName) {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) throw new Error('未找到对话');
    
    try {
        // 获取当前文件夹的句柄
        const currentFolderHandle = conversation.currentFolder === 'main' ? 
            conversation.handle : 
            conversation.subFolders.get(conversation.currentFolder).handle;
        
        // 从新文件名中提取新的消息ID（去掉.txt扩展名）
        const newMessageId = newName.replace('.txt', '');
        
        // 检查是否存在同名文件
        let existingContent = '';
        let existingMessageId = '';
        let existingMessage = null;
        try {
            // 尝试读取同名文件
            const existingHandle = await currentFolderHandle.getFileHandle(newName);
            const existingFile = await existingHandle.getFile();
            existingContent = await existingFile.text();
            
            // 查找现有消息的ID
            const orderHandle = await currentFolderHandle.getFileHandle('messages_order.json');
            const orderFile = await orderHandle.getFile();
            const orderContent = await orderFile.text();
            let messageOrder = JSON.parse(orderContent);
            
            // 找到对应的消息记录
            existingMessage = messageOrder.find(m => m.type === 'text' && `${m.id}.txt` === newName);
            if (existingMessage) {
                existingMessageId = existingMessage.id;
            }
        } catch (error) {
            // 文件不存在，继续正常重命名流程
        }
        
        // 读取当前文件内容
        const oldFileHandle = await currentFolderHandle.getFileHandle(`${message.id}.txt`);
        const file = await oldFileHandle.getFile();
        const content = await file.text();
        
        if (existingContent) {
            // 如果存在同名文件，合并内容
            const mergedContent = existingContent + '\n\n' + content;
            
            // 更新现有文件
            const writable = await currentFolderHandle.getFileHandle(newName, { create: true }).then(handle => handle.createWritable());
            await writable.write(mergedContent);
            await writable.close();
            
            // 删除旧文件
            await currentFolderHandle.removeEntry(`${message.id}.txt`);
            
            // 更新消息顺序文件
            const orderHandle = await currentFolderHandle.getFileHandle('messages_order.json');
            const orderFile = await orderHandle.getFile();
            const orderContent = await orderFile.text();
            let messageOrder = JSON.parse(orderContent);
            
            // 移除被合并的消息
            messageOrder = messageOrder.filter(m => m.id !== message.id);
            
            // 更新现有消息的内容
            if (existingMessage) {
                const messageElement = document.querySelector(`.message[data-message-id="${existingMessageId}"]`);
                if (messageElement) {
                    const contentContainer = messageElement.querySelector('.message-content');
                    if (isCode(mergedContent)) {
                        contentContainer.className = 'message-content code';
                        const pre = document.createElement('pre');
                        const code = document.createElement('code');
                        code.textContent = mergedContent;
                        pre.appendChild(code);
                        
                        const copyBtn = document.createElement('button');
                        copyBtn.className = 'copy-btn';
                        copyBtn.textContent = isEnglish ? 'Copy' : '复制';
                        copyBtn.onclick = () => {
                            navigator.clipboard.writeText(mergedContent);
                            copyBtn.textContent = isEnglish ? 'Copied' : '已复制';
                            setTimeout(() => copyBtn.textContent = isEnglish ? 'Copy' : '复制', 2000);
                        };
                        
                        contentContainer.innerHTML = '';
                        contentContainer.appendChild(copyBtn);
                        contentContainer.appendChild(pre);
                    } else {
                        contentContainer.className = 'message-content';
                        contentContainer.textContent = mergedContent;
                    }
                }
            }
            
            // 保存更新后的消息顺序
            const orderWritable = await orderHandle.createWritable();
            await orderWritable.write(JSON.stringify(messageOrder, null, 2));
            await orderWritable.close();
            
            // 从界面上移除被合并的消息元素
            const messageElement = document.querySelector(`.message[data-message-id="${message.id}"]`);
            if (messageElement) {
                messageElement.remove();
            }
        } else {
            // 如果不存在同名文件，执行普通的重命名操作
            const newFileHandle = await currentFolderHandle.getFileHandle(newName, { create: true });
            const writable = await newFileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            
            // 删除旧文件
            await currentFolderHandle.removeEntry(`${message.id}.txt`);
            
            // 更新消息顺序文件中的消息ID
            const orderHandle = await currentFolderHandle.getFileHandle('messages_order.json');
            const orderFile = await orderHandle.getFile();
            const orderContent = await orderFile.text();
            let messageOrder = JSON.parse(orderContent);
            
            const targetMessage = messageOrder.find(m => m.id === message.id);
            if (targetMessage) {
                targetMessage.id = newMessageId;
                const orderWritable = await orderHandle.createWritable();
                await orderWritable.write(JSON.stringify(messageOrder, null, 2));
                await orderWritable.close();
            }
            
            // 更新消息对象
            message.id = newMessageId;
            
            // 更新DOM元素的data-message-id属性
            const messageElement = document.querySelector(`.message[data-message-id="${message.id}"]`);
            if (messageElement) {
                messageElement.dataset.messageId = newMessageId;
            }
        }
    } catch (error) {
        console.error('重命名消息文件失败:', error);
        throw error;
    }
}

// 添加更新文件夹功能
async function updateFolders() {
    if (!directoryHandle) {
        alert(isEnglish ? 'Please select a storage location first' : '请先选择存储位置');
        return;
    }

    try {
        // 扫描所有文件夹
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'directory') {
                // 检查是否已经是对话文件夹
                const isExistingConversation = conversations.some(c => c.id === entry.name);
                if (!isExistingConversation) {
                    // 创建新的对话对象
                    const conversation = {
                        id: entry.name,
                        title: entry.name,
                        handle: entry,
                        subFolders: new Map(),
                        currentFolder: 'main'
                    };
                    
                    // 扫描子文件夹
                    await scanSubFolders(entry, conversation.subFolders, '');
                    
                    // 创建或更新 messages_order.json
                    await initializeMessageOrder(entry);
                    
                    conversations.push(conversation);
                }
            }
        }
        
        // 保存配置
        await saveConfig();
        
        // 重新渲染对话列表
        renderConversationsList();
        
        alert(isEnglish ? 'Folders updated successfully' : '文件夹更新成功');
    } catch (error) {
        console.error('更新文件夹失败:', error);
        alert(isEnglish ? 'Failed to update folders' : '更新文件夹失败');
    }
}

// 初始化消息顺序文件
async function initializeMessageOrder(folderHandle) {
    try {
        // 检查是否已存在 messages_order.json
        let messageOrder = [];
        try {
            const orderHandle = await folderHandle.getFileHandle('messages_order.json');
            const orderFile = await orderHandle.getFile();
            const orderContent = await orderFile.text();
            messageOrder = JSON.parse(orderContent);
        } catch {
            // 文件不存在，创建新的
            messageOrder = [];
        }
        
        // 扫描文件夹中的所有文件
        for await (const entry of folderHandle.values()) {
            if (entry.kind === 'file' && entry.name !== 'messages_order.json') {
                const isTextFile = entry.name.endsWith('.txt');
                const messageId = isTextFile ? entry.name.replace('.txt', '') : Date.now().toString();
                
                // 检查是否已在消息列表中
                const existingMessage = messageOrder.find(m => 
                    (m.type === 'text' && `${m.id}.txt` === entry.name) ||
                    (m.type === 'file' && m.filename === entry.name)
                );
                
                if (!existingMessage) {
                    messageOrder.push({
                        id: messageId,
                        type: isTextFile ? 'text' : 'file',
                        filename: isTextFile ? `${messageId}.txt` : entry.name,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        // 保存更新后的消息顺序
        const orderHandle = await folderHandle.getFileHandle('messages_order.json', { create: true });
        const writable = await orderHandle.createWritable();
        await writable.write(JSON.stringify(messageOrder, null, 2));
        await writable.close();
    } catch (error) {
        console.error('初始化消息顺序文件失败:', error);
        throw error;
    }
}

// 初始化应用
initApp(); 