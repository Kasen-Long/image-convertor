// preload.js (Electron 预加载脚本)
const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 文件选择对话框
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

    // 配置文件操作
    saveConfig: (filePath, config) => ipcRenderer.invoke('save-config', filePath, config),
    loadConfig: (filePath) => ipcRenderer.invoke('load-config', filePath),

    // 图片转换
    convertImages: (options) => ipcRenderer.invoke('convert-images', options),

    // 监听进度更新
    onConversionProgress: (callback) => ipcRenderer.on('conversion-progress', callback),
});