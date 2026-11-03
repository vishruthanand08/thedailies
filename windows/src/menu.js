// The menu bar (hidden until Alt, like the window's look), with the Mac app's commands on Ctrl.
const { app, Menu, dialog } = require('electron')

// `on` holds the actions (src/main.js)
function buildMenu(on) {
  const template = [
    {
      label: '&File',
      submenu: [
        { label: 'Add Score…', accelerator: 'CmdOrCtrl+N', click: on.addScore },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Paste Result', accelerator: 'CmdOrCtrl+Shift+V', click: on.pasteResult },
      ],
    },
    {
      label: '&Go',
      submenu: [
        { label: 'Today', accelerator: 'CmdOrCtrl+1', click: () => on.tab('Today') },
        { label: 'Feed', accelerator: 'CmdOrCtrl+2', click: () => on.tab('Feed') },
        { label: 'Friends', accelerator: 'CmdOrCtrl+3', click: () => on.tab('Friends') },
        { label: 'You', accelerator: 'CmdOrCtrl+4', click: () => on.tab('You') },
        { type: 'separator' },
        { label: 'Previous Day', accelerator: 'CmdOrCtrl+[', click: () => on.day(-1) },
        { label: 'Next Day', accelerator: 'CmdOrCtrl+]', click: () => on.day(1) },
        { label: 'Back to Today', accelerator: 'CmdOrCtrl+T', click: () => on.day(0) },
      ],
    },
    {
      label: '&View',
      submenu: [
        { label: 'Reload', accelerator: 'F5', click: on.reload },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
      ],
    },
    {
      label: '&Help',
      submenu: [
        { label: 'Support', click: () => on.openPage('/support') },
        { label: 'Privacy Policy', click: () => on.openPage('/privacy') },
        { type: 'separator' },
        { label: 'Check for Updates…', click: on.checkForUpdates },
        { label: 'Open Log File', click: on.openLog },
        {
          label: 'About The Dailies',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'About The Dailies',
            message: 'The Dailies',
            detail: `Version ${app.getVersion()}\nA friends leaderboard for daily games.`,
          }),
        },
      ],
    },
  ]
  return Menu.buildFromTemplate(template)
}

module.exports = { buildMenu }
