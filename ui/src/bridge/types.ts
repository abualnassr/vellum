export type ThemeMode = 'system' | 'light' | 'dark' | 'paper';
export type ResolvedTheme = 'light' | 'dark' | 'paper';
export type ReadingFont = 'sans' | 'serif';
export type ReadingWidth = 'narrow' | 'comfortable' | 'wide' | 'full';
export type ViewMode = 'read' | 'split' | 'source';
export type StartupView = 'welcome' | 'lastSession' | 'new' | 'showcase';
export type TextDirection = 'auto' | 'ltr' | 'rtl';

export interface SpellIssue {
  start: number;
  length: number;
  word: string;
  language: string;
  suggestions: string[];
}

export interface SpellLanguagesInfo {
  available: string[];
  activeEnglish: string | null;
  activeArabic: string | null;
}

export interface AppSettings {
  theme: ThemeMode;
  readingFont: ReadingFont;
  readingFontSize: number;
  editorFontSize: number;
  readingWidth: ReadingWidth;
  defaultViewMode: ViewMode;
  startupView: StartupView;
  startupSidebar: boolean;
  startupOutline: boolean;
  textDirection: TextDirection;
  spellCheck: boolean;
  spellCheckLanguage: string;
  wordWrap: boolean;
  lineNumbers: boolean;
  syncScroll: boolean;
  autoSave: boolean;
  zoom: number;
  splitRatio: number;
  recentFiles: string[];
  lastOpenedFolder: string | null;
  lastSessionFiles: string[];
  lastSessionActivePath: string | null;
}

export interface FileDocument {
  path: string;
  name: string;
  content: string;
  encoding: string;
  lineEnding: 'CRLF' | 'LF';
  lastModifiedUtc: string;
  sizeBytes: number;
  readOnly: boolean;
}

export interface DirectoryNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: DirectoryNode[];
}

export interface AssocStatus {
  isRegistered: boolean;
  isDefaultForMd: boolean;
  executablePath: string;
}

export interface TabDoc {
  id: string;
  path: string | null;
  title: string;
  content: string;
  savedContent: string;
  encoding: string;
  lineEnding: 'CRLF' | 'LF';
  readOnly: boolean;
  externallyModified: boolean;
  viewMode: ViewMode;
  isShowcase?: boolean;
  cursorLine: number;
  cursorCol: number;
}

export type BridgeEvent =
  | { event: 'file:open'; payload: FileDocument }
  | { event: 'file:externalChanged'; payload: { path: string; lastModifiedUtc: string } }
  | { event: 'file:externalDeleted'; payload: { path: string } }
  | { event: 'window:stateChanged'; payload: { isMaximized: boolean } }
  | { event: 'app:requestClose'; payload: { dirtyCount: number } }
  | { event: 'app:error'; payload: { message: string } };
