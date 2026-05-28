export default {
  nav: {
    installed: 'Local Assets',
    market: 'Skill Market',
    settings: 'Settings'
  },
  tabs: {
    installed: 'Local Assets',
    market: 'Skill Market'
  },
  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'Match system'
  },
  status: {
    notConfigured: 'Not configured'
  },
  project: {
    pickRoot: 'Choose project folder',
    picked: 'Project folder: {path}'
  },
  search: {
    installed: 'Search local skills...',
    market: 'Search by name or description...',
    clear: 'Clear search',
    agentFilter: 'Filter agents (name or path)...'
  },
  market: {
    favoritesOnly: 'Favorites only',
    tags: 'Tags',
    tagHint: 'Multi-select; match any selected tag',
    clear: 'Clear',
    refresh: 'Refresh from server',
    title: 'Skill Market',
    subtitle: 'Browse team-shared agent skills from your Skill Base server.',
    loading: 'Loading...',
    emptyFiltered: 'No matches. Adjust search or filters.',
    empty: 'No skills found. Check server connection or refresh.',
    downloads: 'Downloads',
    favorited: 'Favorited',
    favoriteCount: 'Favorites',
    openDetail: 'Open in browser',
    installed: 'Installed',
    install: 'Install'
  },
  installed: {
    title: 'Local Assets',
    count: '({count})',
    subtitle: 'Manage skills across agent directories and sync updates in one place.',
    loading: 'Loading...',
    empty: 'No local installs yet. Install from the Skill Market.',
    syncAll: 'Sync all updates ({count})',
    selectUpdateDirs: 'Choose directories to update',
    update: 'Update',
    upToDate: 'Up to date',
    viewAll: '+{count} view all',
    notMounted: 'Not mounted',
    revealHint: 'Reveal in Finder / file manager'
  },
  install: {
    title: 'Install / {name}',
    version: 'Version',
    targets: 'Install targets',
    global: 'Global agents',
    project: 'Project agents',
    custom: 'Custom folders',
    globalHint: 'Select one or more global agent skill directories under your home folder.',
    selected: '{count} selected',
    noGlobalDirs: 'No global directories available',
    noAgentMatch: 'No matching agents',
    projectHint:
      'Pick a project root first, then select agent paths relative to that root (multi-select).',
    projectRoot: '① Project root',
    pickProject: 'Choose project root',
    pickProjectBtn: 'Choose project…',
    agentDirs: '② Agent directories',
    projectStepHint: 'Complete step ① before selecting agent directories.',
    selectedRelative: '{count} selected · relative to project root',
    customHint: 'Add folders and select install destinations (skill installs as a subfolder).',
    addDir: 'Add folder…',
    addDirEmpty: 'Click “Add folder” to choose a destination',
    dirExists: 'Directory exists',
    overwrite: 'Overwrite existing folder with the same name',
    nestedConfirm: 'Confirm nested install inside agent skill directory',
    cancel: 'Cancel',
    confirm: 'Install'
  },
  update: {
    title: 'Update / {skillId}',
    version: 'Version',
    latest: ' (latest)',
    uploader: 'Uploader',
    noChangelog: 'No changelog',
    viewOnline: 'View online',
    compareInstalled: 'Compare with installed version',
    pickDirs: 'Directories to update',
    cancel: 'Cancel',
    confirm: 'Update'
  },
  settings: {
    title: 'Settings',
    generalHint: 'Set the interface language and theme.',
    connectionHint:
      'Configure the Skill Base server and CLI login (shared with skb via ~/.skill-base/config.json). Open the login page in your browser for a verification code, then exchange it here for a PAT.',
    general: 'General',
    language: 'Language',
    theme: 'Theme',
    connection: 'Connection',
    serverUrl: 'Server base URL',
    save: 'Save',
    openLogin: 'Open CLI login page in browser',
    verificationCode: '8-character code',
    codePlaceholder: 'e.g. AB12-CD34',
    exchangePat: 'Exchange for PAT',
    patReady: 'PAT ready',
    patReadyUser: 'PAT ready · {username}',
    testConnection: 'Test connection',
    logout: 'Sign out',
    close: 'Close'
  },
  paths: {
    title: 'Install paths / {name}',
    count: '{count} directories',
    close: 'Close'
  },
  common: {
    unknown: 'Unknown',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save'
  },
  toast: {
    openFailed: 'Failed to open: {message}',
    revealFailed: 'Cannot reveal: {message}',
    loadFailed: 'Failed to load: {message}',
    serverSaved: 'Server URL saved',
    saveFailed: 'Failed to save: {message}',
    enterCode: 'Enter verification code',
    loginSuccess: 'Signed in: {username}',
    verifyFailed: 'Verification failed: {message}',
    connectionOk: 'Connected · {username}',
    connectionOkNoLogin: 'Server reachable (not signed in)',
    notLoggedIn: 'Not signed in, but server is reachable (some features work without login)',
    connectionFailed: 'Connection failed: {message}',
    loggedOut: 'Signed out',
    logoutFailed: 'Sign out failed: {message}',
    configureServerFirst: 'Configure the server URL in Settings first',
    installFailed: 'Install failed: {message}',
    installedTo: 'Installed {skillId} to {count} location(s)',
    updateFailed: 'Update failed: {message}',
    updated: 'Updated {skillId}',
    updatedTo: 'Updated {skillId} → v{version}',
    versionsLoadFailed: 'Failed to load versions: {message}'
  }
};
