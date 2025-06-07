// main.js (Electron 主进程)
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { glob } = require('glob');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,       // 启用上下文隔离
            nodeIntegration: false,       // 禁用 Node.js 集成
            sandbox: false,               // 禁用沙盒（如果需要使用 Node.js API）
            enableRemoteModule: false,    // 禁用 remote 模块（已弃用）
        },
    });

    mainWindow.loadFile('index.html');
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// 处理文件选择对话框
ipcMain.handle('show-open-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    return await dialog.showSaveDialog(mainWindow, options);
});

// 处理配置文件保存/加载
ipcMain.handle('save-config', async (event, filePath, config) => {
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
});

ipcMain.handle('load-config', async (event, filePath) => {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
});

// 处理文件转换请求
ipcMain.handle('convert-images', async (event, options) => {
    const { sourceDir, outputDir, mappings, deleteSource } = options;
    const results = { total: 0, success: 0, errors: [] };

    try {
        // 遍历每个映射规则
        for (const mapping of mappings) {
            const { sourcePattern, targetName } = mapping;

            // 使用 glob 查找所有匹配的文件
            const files = await glob(`${sourceDir}/**/${sourcePattern}`, { nodir: true });

            for (const file of files) {
                results.total++;

                // 构建输出路径
                const relativePath = path.relative(sourceDir, path.dirname(file));
                const outputPath = path.join(outputDir, relativePath);
                const targetPath = path.join(outputPath, targetName);

                // 创建输出目录（如果不存在）
                await fs.mkdir(outputPath, { recursive: true });

                try {
                    // 使用 sharp 转换图片格式
                    await sharp(file).toFile(targetPath);
                    // 如果需要删除源文件
                    if (deleteSource) {
                        await fs.unlink(file); // 删除源文件
                        appendLogToMain(`🗑️ 删除源文件: ${file}`); // 可选：添加日志
                    }
                    results.success++;

                    // 发送进度更新
                    event.sender.send('conversion-progress', {
                        file,
                        status: 'success',
                        results
                    });
                } catch (err) {
                    results.errors.push({ file, error: err.message });

                    // 发送错误更新
                    event.sender.send('conversion-progress', {
                        file,
                        status: 'error',
                        error: err.message,
                        results
                    });
                }
            }
        }

        return results;
    } catch (err) {
        console.error('转换过程中出错:', err);
        throw err;
    }
});

// 辅助函数：向渲染进程发送日志（可选）
function appendLogToMain(message) {
    mainWindow.webContents.send('append-log', message);
}