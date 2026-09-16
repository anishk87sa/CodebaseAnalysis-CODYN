import { BrowserWindow, ipcMain, dialog } from 'electron'
import { getDirectoryTree } from '../services/repositoryService'
import { analyzeRepository } from '../services/storage/cstStorage'

export function registerIpcHandlers(win: BrowserWindow) {
  ipcMain.handle('repository:selectFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  })

  ipcMain.handle('repository:getTree', async (_, dirPath: string) => {
    try {
      const tree = await getDirectoryTree(dirPath)
      return tree
    } catch (err) {
      console.error(err)
      return null
    }
  })

  ipcMain.handle('repository:analyzeCST', async (_, dirPath: string) => {
    try {
      const result = await analyzeRepository(dirPath)
      return result
    } catch (err) {
      console.error(err)
      return null
    }
  })
}
