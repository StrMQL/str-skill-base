export default {
  nav: {
    installed: '本地资产管理',
    market: '技能市场',
    settings: '设置'
  },
  tabs: {
    installed: '本地资产',
    market: '技能市场'
  },
  theme: {
    light: '浅色',
    dark: '深色',
    system: '跟随系统'
  },
  status: {
    notConfigured: '未配置'
  },
  project: {
    pickRoot: '选择项目目录',
    picked: '项目目录: {path}'
  },
  search: {
    installed: '搜索本地 Skill...',
    market: '搜索技能名称、描述...',
    clear: '清除搜索',
    agentFilter: '筛选 Agent（名称或路径）...'
  },
  market: {
    favoritesOnly: '仅收藏',
    tags: '标签',
    tagHint: '可多选，匹配任一标签即显示',
    clear: '清除',
    refresh: '从服务器刷新列表',
    title: '技能市场',
    subtitle: '从 Skill Base 服务端拉取团队共享 Agent 能力。',
    loading: '加载中...',
    emptyFiltered: '无匹配结果，请调整搜索或筛选条件。',
    empty: '暂无技能，请检查服务器连接或点击刷新。',
    downloads: '下载次数',
    favorited: '已收藏',
    favoriteCount: '收藏数',
    openDetail: '在浏览器中打开详情',
    installed: '已安装',
    install: '安装'
  },
  installed: {
    title: '本地资产',
    count: '({count})',
    subtitle: '跨 Agent 目录集中管理，一键同步版本更新。',
    loading: '加载中...',
    empty: '暂无本地安装记录，前往技能市场安装。',
    syncAll: '同步更新所有 ({count})',
    selectUpdateDirs: '选择更新目录',
    update: '更新',
    upToDate: '已是最新',
    viewAll: '+{count} 查看全部',
    notMounted: '未挂载',
    revealHint: '在 Finder / 资源管理器中打开'
  },
  install: {
    title: '安装 / {name}',
    version: '版本',
    targets: '安装目标',
    global: '全局 Agent',
    project: '项目 Agent',
    custom: '自定义目录',
    globalHint: '可多选，安装到用户主目录下的 Agent 全局 skill 路径。',
    selected: '已选 {count} 个',
    noGlobalDirs: '暂无可用全局目录',
    noAgentMatch: '无匹配的 Agent',
    projectHint: '第一步选择项目根目录，第二步勾选 Agent 在项目内的相对路径（可多选）。',
    projectRoot: '① 项目根目录',
    pickProject: '请选择项目根目录',
    pickProjectBtn: '选择项目…',
    agentDirs: '② Agent 目录',
    projectStepHint: '请先完成第一步，再勾选要写入的 Agent 目录。',
    selectedRelative: '已选 {count} 个 · 相对项目根',
    customHint: '可添加多个文件夹，勾选要安装的目标（Skill 以子目录落地）。',
    addDir: '添加目录…',
    addDirEmpty: '请点击「添加目录」选择安装位置',
    dirExists: '目录已存在',
    overwrite: '覆盖已存在的同名目录',
    nestedConfirm: '确认在 Agent skill 目录内嵌套安装',
    cancel: '取消',
    confirm: '安装'
  },
  update: {
    title: '更新 / {skillId}',
    version: '版本',
    latest: '（最新）',
    uploader: '提交人',
    noChangelog: '暂无 changelog',
    viewOnline: '在线查看',
    compareInstalled: '对比当前安装版本',
    pickDirs: '选择要更新的目录',
    cancel: '取消',
    confirm: '更新'
  },
  settings: {
    title: '设置',
    generalHint: '配置界面语言与主题。',
    connectionHint:
      '配置 Skill Base 服务端与 CLI 登录（与 skb 共用 ~/.skill-base/config.json）。在浏览器打开登录页获取验证码，在此换取 PAT。',
    general: '通用',
    language: '界面语言',
    theme: '主题',
    connection: '连接',
    serverUrl: 'Server 根地址',
    save: '保存',
    openLogin: '在浏览器打开 CLI 登录页',
    verificationCode: '8 位验证码',
    codePlaceholder: '如 AB12-CD34',
    exchangePat: '换取 PAT',
    patReady: 'PAT 已就绪',
    patReadyUser: 'PAT 已就绪 · {username}',
    testConnection: '验证连接',
    logout: '退出登录',
    close: '关闭'
  },
  paths: {
    title: '安装路径 / {name}',
    count: '共 {count} 个目录',
    close: '关闭'
  },
  common: {
    unknown: '未知',
    cancel: '取消',
    close: '关闭',
    save: '保存'
  },
  toast: {
    openFailed: '打开失败: {message}',
    revealFailed: '无法打开: {message}',
    loadFailed: '加载失败: {message}',
    serverSaved: '服务器地址已保存',
    saveFailed: '保存失败: {message}',
    enterCode: '请输入验证码',
    loginSuccess: '登录成功: {username}',
    verifyFailed: '验证失败: {message}',
    connectionOk: '连接正常 · {username}',
    connectionOkNoLogin: '服务器连接正常（未登录）',
    notLoggedIn: '未登录，但服务器地址可访问（部分功能无需登录）',
    connectionFailed: '连接失败: {message}',
    loggedOut: '已退出登录',
    logoutFailed: '退出失败: {message}',
    configureServerFirst: '请先在设置中配置服务器地址',
    installFailed: '安装失败: {message}',
    installedTo: '已安装 {skillId} 到 {count} 个目录',
    updateFailed: '更新失败: {message}',
    updated: '已更新 {skillId}',
    updatedTo: '已更新 {skillId} → v{version}',
    versionsLoadFailed: '加载版本失败: {message}'
  }
};
