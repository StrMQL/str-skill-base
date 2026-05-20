import { contextBridge, ipcRenderer } from 'electron';

const channels = [
  'config:get',
  'config:setServer',
  'config:getGlobalTargets',
  'config:getProjectTargets',
  'config:getProjectTargetTemplates',
  'project:getRoot',
  'project:setRoot',
  'project:pickRoot',
  'project:pickInstallDir',
  'shell:revealPath',
  'auth:openLogin',
  'auth:exchangePat',
  'auth:whoami',
  'auth:logout',
  'skills:search',
  'skills:getVersions',
  'skills:getRemote',
  'skills:getInstalled',
  'skills:install',
  'skills:update',
  'skills:openWebPage'
];

contextBridge.exposeInMainWorld('skb', {
  invoke(channel, ...args) {
    if (!channels.includes(channel)) {
      return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  }
});
