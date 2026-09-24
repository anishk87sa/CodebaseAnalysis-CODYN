import { BrowserWindow, ipcMain, dialog } from 'electron'
import { getDirectoryTree } from '../services/repositoryService'
import { analyzeRepository } from '../services/storage/cstStorage'
import { generateGraph } from '../services/graph/graphExtractor'
import { getFileGraphData, getGlobalGraphData } from '../services/graph/graphReader'

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

  ipcMain.handle('graph:generate', async (_, dirPath: string) => {
    try {
      const result = await generateGraph(dirPath)
      return result
    } catch (err) {
      console.error(err)
      return null
    }
  })

  ipcMain.handle('graph:getFile', async (_, repoRoot: string, filePath: string) => {
    try {
      const data = await getFileGraphData(repoRoot, filePath)
      return data
    } catch (err) {
      console.error(err)
      return null
    }
  })

  ipcMain.handle('graph:getGlobal', async (_, repoRoot: string) => {
    try {
      const data = await getGlobalGraphData(repoRoot)
      return data
    } catch (err) {
      console.error(err)
      return null
    }
  })
}
