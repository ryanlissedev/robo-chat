#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Mapping from Phosphor icons to Lucide icons
const iconMap = {
  // Common icons
  'X': 'X',
  'Check': 'Check',
  'Info': 'Info',
  'Key': 'Key',
  'Eye': 'Eye',
  'EyeSlash': 'EyeOff',
  'Warning': 'AlertTriangle',
  'CheckCircle': 'CheckCircle',
  'Circle': 'Circle',
  'ArrowLeft': 'ArrowLeft',
  'ArrowUp': 'ArrowUp',
  'ArrowUpRight': 'ArrowUpRight',
  'ArrowUpIcon': 'ArrowUp',
  'Stop': 'Square',
  'StopIcon': 'Square',
  'CaretDown': 'ChevronDown',
  'CaretUp': 'ChevronUp',
  'CaretRight': 'ChevronRight',
  'CaretDownIcon': 'ChevronDown',
  'MagnifyingGlass': 'Search',
  'GlobeIcon': 'Globe',
  'FileArrowUp': 'FileUp',
  'Paperclip': 'Paperclip',
  'ChatCircleIcon': 'MessageCircle',
  
  // Settings icons
  'Brain': 'Brain',
  'Database': 'Database',
  'Shield': 'Shield',
  
  // Tool icons
  'Globe': 'Globe',
  'Image': 'Image',
  'Lightbulb': 'Lightbulb',
  'FileSearch': 'FileSearch',
  'File': 'File',
  'FileText': 'FileText',
  'Book': 'Book',
  'MapTrifold': 'Map',
  'Question': 'HelpCircle',
  'ImageSquare': 'ImageIcon',
  'TextAlignLeft': 'AlignLeft',
  'MagnifyingGlassPlus': 'ZoomIn',
  'RocketLaunch': 'Rocket',
  'Wrench': 'Wrench',
  'ArrowCounterClockwise': 'RotateCcw',
  'Pencil': 'Pencil',
  'Trash': 'Trash',
  'User': 'User',
  'UserPlus': 'UserPlus',
  'House': 'Home',
  'ChatCircle': 'MessageCircle',
  'Sparkle': 'Sparkle',
  'DotsThreeOutline': 'MoreHorizontal',
  'Plus': 'Plus',
  'MicrophoneIcon': 'Mic',
  'MicrophoneSlashIcon': 'MicOff',
  'PlayIcon': 'Play',
  'StopCircleIcon': 'StopCircle',
  'ArrowRightIcon': 'ArrowRight',
  'XIcon': 'X',
  'Link': 'Link',
  'Copy': 'Copy',
  'Download': 'Download',
  'ExternalLink': 'ExternalLink',
  'Upload': 'Upload',
  'FolderOpen': 'FolderOpen',
  'Folder': 'Folder',
  'Gauge': 'Gauge',
  'ThumbsUp': 'ThumbsUp',
  'ThumbsDown': 'ThumbsDown',
  'Clipboard': 'Clipboard',
  'ClipboardText': 'ClipboardList',
  'Code': 'Code',
  'CodeBlock': 'Code',
  'Terminal': 'Terminal',
  'Bug': 'Bug',
  'GitBranch': 'GitBranch',
  'GitCommit': 'GitCommit',
  'GitMerge': 'GitMerge',
  'GitPullRequest': 'GitPullRequest',
  'Hash': 'Hash',
  'Clock': 'Clock',
  'Calendar': 'Calendar',
  'Bell': 'Bell',
  'BellOff': 'BellOff',
  'Sun': 'Sun',
  'Moon': 'Moon',
  'Settings': 'Settings',
  'Gear': 'Settings',
  'Sliders': 'Sliders',
  'List': 'List',
  'Grid': 'Grid',
  'Layers': 'Layers',
  'Package': 'Package',
  'Zap': 'Zap',
  'Star': 'Star',
  'Heart': 'Heart',
  'Share': 'Share',
  'Share2': 'Share2',
  'Send': 'Send',
  'Save': 'Save',
  'Edit': 'Edit',
  'Edit2': 'Edit2',
  'Edit3': 'Edit3',
  'Feather': 'Feather',
  'Filter': 'Filter',
  'Flag': 'Flag',
  'Bookmark': 'Bookmark',
  'Award': 'Award',
  'Activity': 'Activity',
  'Anchor': 'Anchor',
  'Archive': 'Archive',
  'AlertCircle': 'AlertCircle',
  'AlertTriangle': 'AlertTriangle',
  'AlignCenter': 'AlignCenter',
  'AlignJustify': 'AlignJustify',
  'AlignLeft': 'AlignLeft',
  'AlignRight': 'AlignRight',
  'Aperture': 'Aperture',
  'ArrowDown': 'ArrowDown',
  'ArrowDownCircle': 'ArrowDownCircle',
  'ArrowDownLeft': 'ArrowDownLeft',
  'ArrowDownRight': 'ArrowDownRight',
  'ArrowLeftCircle': 'ArrowLeftCircle',
  'ArrowRight': 'ArrowRight',
  'ArrowRightCircle': 'ArrowRightCircle',
  'ArrowUpCircle': 'ArrowUpCircle',
  'ArrowUpLeft': 'ArrowUpLeft',
  'BarChart': 'BarChart',
  'BarChart2': 'BarChart2',
  'Battery': 'Battery',
  'BatteryCharging': 'BatteryCharging',
  'Bluetooth': 'Bluetooth',
  'Bold': 'Bold',
  'BookOpen': 'BookOpen',
  'Box': 'Box',
  'Briefcase': 'Briefcase',
  'Camera': 'Camera',
  'CameraOff': 'CameraOff',
  'Cast': 'Cast',
  'CheckSquare': 'CheckSquare',
  'ChevronDown': 'ChevronDown',
  'ChevronLeft': 'ChevronLeft',
  'ChevronRight': 'ChevronRight',
  'ChevronUp': 'ChevronUp',
  'Chrome': 'Chrome',
  'Cloud': 'Cloud',
  'CloudDrizzle': 'CloudDrizzle',
  'CloudLightning': 'CloudLightning',
  'CloudOff': 'CloudOff',
  'CloudRain': 'CloudRain',
  'CloudSnow': 'CloudSnow',
  'Codepen': 'Codepen',
  'Codesandbox': 'Codesandbox',
  'Coffee': 'Coffee',
  'Command': 'Command',
  'Compass': 'Compass',
  'Cpu': 'Cpu',
  'CreditCard': 'CreditCard',
  'Crop': 'Crop',
  'Crosshair': 'Crosshair',
  'Delete': 'Delete',
  'Disc': 'Disc',
  'DollarSign': 'DollarSign',
  'DownloadCloud': 'CloudDownload',
  'Droplet': 'Droplet',
  'ExternalLinkIcon': 'ExternalLink',
  'FastForward': 'FastForward',
  'FileMinus': 'FileMinus',
  'FilePlus': 'FilePlus',
  'Film': 'Film',
  'Frown': 'Frown',
  'Gift': 'Gift',
  'GitBranchIcon': 'GitBranch',
  'GitCommitIcon': 'GitCommit',
  'GitMergeIcon': 'GitMerge',
  'GitPullRequestIcon': 'GitPullRequest',
  'Github': 'Github',
  'Gitlab': 'Gitlab',
  'GlobeAlt': 'Globe',
  'HardDrive': 'HardDrive',
  'Headphones': 'Headphones',
  'HelpCircle': 'HelpCircle',
  'Hexagon': 'Hexagon',
  'Home': 'Home',
  'Inbox': 'Inbox',
  'Instagram': 'Instagram',
  'Italic': 'Italic',
  'Layout': 'Layout',
  'LifeBuoy': 'LifeBuoy',
  'Link2': 'Link2',
  'Linkedin': 'Linkedin',
  'Loader': 'Loader',
  'Lock': 'Lock',
  'LogIn': 'LogIn',
  'LogOut': 'LogOut',
  'Mail': 'Mail',
  'MapPin': 'MapPin',
  'Maximize': 'Maximize',
  'Maximize2': 'Maximize2',
  'Meh': 'Meh',
  'Menu': 'Menu',
  'MessageCircle': 'MessageCircle',
  'MessageSquare': 'MessageSquare',
  'Mic': 'Mic',
  'MicOff': 'MicOff',
  'Minimize': 'Minimize',
  'Minimize2': 'Minimize2',
  'Minus': 'Minus',
  'MinusCircle': 'MinusCircle',
  'MinusSquare': 'MinusSquare',
  'Monitor': 'Monitor',
  'MoreHorizontal': 'MoreHorizontal',
  'MoreVertical': 'MoreVertical',
  'MousePointer': 'MousePointer',
  'Move': 'Move',
  'Music': 'Music',
  'Navigation': 'Navigation',
  'Navigation2': 'Navigation2',
  'Octagon': 'Octagon',
  'Pause': 'Pause',
  'PauseCircle': 'PauseCircle',
  'PenTool': 'PenTool',
  'Percent': 'Percent',
  'Phone': 'Phone',
  'PhoneCall': 'PhoneCall',
  'PhoneForwarded': 'PhoneForwarded',
  'PhoneIncoming': 'PhoneIncoming',
  'PhoneMissed': 'PhoneMissed',
  'PhoneOff': 'PhoneOff',
  'PhoneOutgoing': 'PhoneOutgoing',
  'PieChart': 'PieChart',
  'Play': 'Play',
  'PlayCircle': 'PlayCircle',
  'PlusCircle': 'PlusCircle',
  'PlusSquare': 'PlusSquare',
  'Pocket': 'Pocket',
  'Power': 'Power',
  'Printer': 'Printer',
  'Radio': 'Radio',
  'RefreshCcw': 'RefreshCcw',
  'RefreshCw': 'RefreshCw',
  'Repeat': 'Repeat',
  'Rewind': 'Rewind',
  'Rss': 'Rss',
  'Scissors': 'Scissors',
  'Search': 'Search',
  'Server': 'Server',
  'ShoppingBag': 'ShoppingBag',
  'ShoppingCart': 'ShoppingCart',
  'Shuffle': 'Shuffle',
  'Sidebar': 'Sidebar',
  'SkipBack': 'SkipBack',
  'SkipForward': 'SkipForward',
  'Slack': 'Slack',
  'Slash': 'Slash',
  'Smartphone': 'Smartphone',
  'Smile': 'Smile',
  'Speaker': 'Speaker',
  'Square': 'Square',
  'Sunrise': 'Sunrise',
  'Sunset': 'Sunset',
  'Tablet': 'Tablet',
  'Tag': 'Tag',
  'Target': 'Target',
  'Thermometer': 'Thermometer',
  'ToggleLeft': 'ToggleLeft',
  'ToggleRight': 'ToggleRight',
  'Tool': 'Tool',
  'Trash2': 'Trash2',
  'Trello': 'Trello',
  'TrendingDown': 'TrendingDown',
  'TrendingUp': 'TrendingUp',
  'Triangle': 'Triangle',
  'Truck': 'Truck',
  'Tv': 'Tv',
  'Twitch': 'Twitch',
  'Twitter': 'Twitter',
  'Type': 'Type',
  'Umbrella': 'Umbrella',
  'Underline': 'Underline',
  'Unlock': 'Unlock',
  'UploadCloud': 'CloudUpload',
  'UserCheck': 'UserCheck',
  'UserMinus': 'UserMinus',
  'UserX': 'UserX',
  'Users': 'Users',
  'Video': 'Video',
  'VideoOff': 'VideoOff',
  'Voicemail': 'Voicemail',
  'Volume': 'Volume',
  'Volume1': 'Volume1',
  'Volume2': 'Volume2',
  'VolumeX': 'VolumeX',
  'Watch': 'Watch',
  'Wifi': 'Wifi',
  'WifiOff': 'WifiOff',
  'Wind': 'Wind',
  'XCircle': 'XCircle',
  'XOctagon': 'XOctagon',
  'XSquare': 'XSquare',
  'Youtube': 'Youtube',
  'ZapOff': 'ZapOff',
  'ZoomIn': 'ZoomIn',
  'ZoomOut': 'ZoomOut'
};

function replaceIconsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file has Phosphor imports
  if (!content.includes('@phosphor-icons')) {
    return false;
  }
  
  // Replace import statements
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@phosphor-icons\/react(?:\/dist\/ssr)?['"]/g;
  
  content = content.replace(importRegex, (match, icons) => {
    modified = true;
    const iconList = icons.split(',').map(icon => {
      const trimmed = icon.trim();
      const mapped = iconMap[trimmed];
      if (!mapped) {
        console.warn(`No mapping for Phosphor icon: ${trimmed} in ${filePath}`);
        return trimmed;
      }
      return mapped;
    });
    
    // Remove duplicates
    const uniqueIcons = [...new Set(iconList)];
    
    return `import { ${uniqueIcons.join(', ')} } from 'lucide-react'`;
  });
  
  // Replace icon usage in JSX (handle cases where icon names changed)
  Object.entries(iconMap).forEach(([phosphor, lucide]) => {
    if (phosphor !== lucide) {
      // Replace component usage
      const componentRegex = new RegExp(`<${phosphor}([\\s/>])`, 'g');
      if (componentRegex.test(content)) {
        content = content.replace(componentRegex, `<${lucide}$1`);
        modified = true;
      }
      
      // Replace closing tags
      const closingRegex = new RegExp(`</${phosphor}>`, 'g');
      if (closingRegex.test(content)) {
        content = content.replace(closingRegex, `</${lucide}>`);
        modified = true;
      }
      
      // Replace Icon={IconName} patterns
      const propRegex = new RegExp(`Icon={${phosphor}}`, 'g');
      if (propRegex.test(content)) {
        content = content.replace(propRegex, `Icon={${lucide}}`);
        modified = true;
      }
      
      // Replace icon={IconName} patterns
      const propRegex2 = new RegExp(`icon={${phosphor}}`, 'g');
      if (propRegex2.test(content)) {
        content = content.replace(propRegex2, `icon={${lucide}}`);
        modified = true;
      }
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
    return true;
  }
  
  return false;
}

// Find all TypeScript/React files
const files = glob.sync('**/*.{ts,tsx}', {
  ignore: ['node_modules/**', 'scripts/**', '.next/**', 'dist/**', 'build/**']
});

console.log(`Found ${files.length} TypeScript/React files to check...`);

let updatedCount = 0;
files.forEach(file => {
  if (replaceIconsInFile(file)) {
    updatedCount++;
  }
});

console.log(`\n✨ Updated ${updatedCount} files with Lucide icons`);